-- ============================================================================
-- QUINCAILLERIE MABANE — Petites ventes (ventes rapides SANS facture)
-- À exécuter dans Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- 1. TABLE small_sales (une petite vente rapide, sans numéro de facture)
-- ============================================================================
create table if not exists public.small_sales (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  notes text,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_small_sales_user on public.small_sales(user_id);
create index if not exists idx_small_sales_created on public.small_sales(created_at);

-- ============================================================================
-- 2. TABLE small_sale_items (lignes de produits d'une petite vente)
-- ============================================================================
create table if not exists public.small_sale_items (
  id uuid primary key default uuid_generate_v4(),
  small_sale_id uuid references public.small_sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, -- copie du nom au moment de la vente
  quantity integer not null,
  purchase_price numeric(12,2) not null default 0, -- copie du prix d'achat au moment de la vente
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create index if not exists idx_small_sale_items_sale on public.small_sale_items(small_sale_id);
create index if not exists idx_small_sale_items_product on public.small_sale_items(product_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.small_sales enable row level security;
alter table public.small_sale_items enable row level security;

drop policy if exists "Authenticated read small_sales" on public.small_sales;
create policy "Authenticated read small_sales" on public.small_sales
  for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write small_sales" on public.small_sales;
create policy "Authenticated write small_sales" on public.small_sales
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Admin delete small_sales" on public.small_sales;
create policy "Admin delete small_sales" on public.small_sales
  for delete using (public.is_admin());

drop policy if exists "Authenticated read small_sale_items" on public.small_sale_items;
create policy "Authenticated read small_sale_items" on public.small_sale_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write small_sale_items" on public.small_sale_items;
create policy "Authenticated write small_sale_items" on public.small_sale_items
  for insert with check (auth.role() = 'authenticated');

-- ============================================================================
-- FONCTION RPC : créer une petite vente (rapide, sans facture) de façon atomique
-- items = jsonb array: [{product_id, product_name, quantity, unit_price}, ...]
-- ============================================================================
create or replace function public.create_small_sale(
  p_items jsonb,
  p_user_id uuid default null,
  p_notes text default null,
  p_discount numeric default 0
)
returns public.small_sales
language plpgsql
security definer
as $$
declare
  v_sale public.small_sales;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_line_total numeric;
  v_current_stock integer;
  v_purchase_price numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La petite vente doit contenir au moins un article.';
  end if;

  if coalesce(p_discount, 0) < 0 then
    raise exception 'La remise ne peut pas être négative.';
  end if;

  -- Calcul du sous-total et validation
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::integer <= 0 then
      raise exception 'La quantité doit être supérieure à zéro pour le produit %', v_item->>'product_name';
    end if;
    if (v_item->>'unit_price')::numeric < 0 then
      raise exception 'Le prix de vente ne peut pas être négatif pour le produit %', v_item->>'product_name';
    end if;
    v_subtotal := v_subtotal + ((v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric);
  end loop;

  if coalesce(p_discount, 0) > v_subtotal then
    raise exception 'La remise ne peut pas dépasser le sous-total.';
  end if;

  insert into public.small_sales (user_id, notes, subtotal, discount, total)
  values (
    p_user_id,
    nullif(p_notes, ''),
    v_subtotal,
    coalesce(p_discount, 0),
    v_subtotal - coalesce(p_discount, 0)
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric;

    -- Verrouiller le produit pour éviter les ventes concurrentes
    select stock, purchase_price into v_current_stock, v_purchase_price
    from public.products
    where id = (v_item->>'product_id')::uuid
    for update;

    if v_current_stock is null then
      raise exception 'Produit introuvable : %', v_item->>'product_name';
    end if;

    if v_current_stock < (v_item->>'quantity')::integer then
      raise exception 'Stock insuffisant pour le produit %', v_item->>'product_name';
    end if;

    insert into public.small_sale_items (small_sale_id, product_id, product_name, quantity, purchase_price, unit_price, line_total)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      coalesce(v_purchase_price, 0),
      (v_item->>'unit_price')::numeric,
      v_line_total
    );

    -- Décrémenter le stock
    update public.products
    set stock = stock - (v_item->>'quantity')::integer, updated_at = now()
    where id = (v_item->>'product_id')::uuid;

    -- Historiser le mouvement de stock
    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
    values (
      (v_item->>'product_id')::uuid,
      'sortie',
      (v_item->>'quantity')::integer,
      'Petite vente rapide',
      p_user_id
    );
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.create_small_sale(jsonb, uuid, text, numeric) to authenticated;

notify pgrst, 'reload schema';

