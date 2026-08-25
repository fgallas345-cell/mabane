-- ============================================================================
-- QUINCAILLERIE MABANE — Schéma Supabase (PostgreSQL)
-- À exécuter dans Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- Extensions utiles
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. TABLE users (profil lié à auth.users)
-- ============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role text not null default 'employe' check (role in ('admin', 'caissier', 'employe')),
  phone text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 2. TABLE categories
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. TABLE products
-- ============================================================================
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  purchase_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  stock integer not null default 0,
  alert_threshold integer not null default 5,
  image_url text,
  unit text default 'unité',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_products_category on public.products(category_id);

-- ============================================================================
-- 4. TABLE clients
-- ============================================================================
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null, -- numéro WhatsApp
  address text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 5. TABLE suppliers (fournisseurs)
-- ============================================================================
create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  products_supplied text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_suppliers_name on public.suppliers(name);

-- ============================================================================
-- 5b. TABLE supplier_products (relation fournisseur / produit)
-- ============================================================================
create table if not exists public.supplier_products (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references public.suppliers(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  unique (supplier_id, product_id)
);

create index if not exists idx_supplier_products_supplier on public.supplier_products(supplier_id);
create index if not exists idx_supplier_products_product on public.supplier_products(product_id);

-- ============================================================================
-- 5c. TABLE purchases (achats fournisseurs / factures d'achat)
-- ============================================================================
create table if not exists public.purchases (
  id uuid primary key default uuid_generate_v4(),
  purchase_number text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null, -- copie du nom au moment de l'achat (historique conservé même si fournisseur supprimé)
  user_id uuid references public.users(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'credit' check (status in ('payee', 'partielle', 'credit', 'annulee')),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_purchases_supplier on public.purchases(supplier_id);
create index if not exists idx_purchases_status on public.purchases(status);

-- ============================================================================
-- 5d. TABLE purchase_items (lignes de facture d'achat)
-- ============================================================================
create table if not exists public.purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, -- copie du nom au moment de l'achat
  quantity integer not null,
  unit_cost numeric(12,2) not null default 0, -- prix d'achat unitaire payé à CE fournisseur
  line_total numeric(12,2) not null
);

create index if not exists idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index if not exists idx_purchase_items_product on public.purchase_items(product_id);

-- ============================================================================
-- 6. TABLE sales (ventes / factures)
-- ============================================================================
create table if not exists public.sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'payee' check (status in ('payee', 'partielle', 'credit', 'annulee')),
  delivery_status text not null default 'livree' check (delivery_status in ('en_attente', 'partielle', 'livree')),
  created_at timestamptz default now()
);

-- Compatibilité avec une base déjà déployée (ajout de la colonne + élargissement du statut)
alter table public.sales add column if not exists amount_paid numeric(12,2) not null default 0;
update public.sales set amount_paid = total where status = 'payee' and amount_paid = 0 and total > 0;
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check check (status in ('payee', 'partielle', 'credit', 'annulee'));
alter table public.sales add column if not exists delivery_status text not null default 'livree' check (delivery_status in ('en_attente', 'partielle', 'livree'));

-- ============================================================================
-- 7. TABLE sale_items (lignes de facture)
-- ============================================================================
create table if not exists public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, -- copie du nom au moment de la vente
  quantity integer not null,
  purchase_price numeric(12,2) not null default 0, -- copie du prix d'achat au moment de la vente
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

alter table public.sale_items
  add column if not exists purchase_price numeric(12,2) not null default 0;

-- ============================================================================
-- 8. TABLE deliveries (bons de livraison)
-- ============================================================================
create table if not exists public.deliveries (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references public.sales(id) on delete cascade,
  delivery_number text not null unique,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_deliveries_sale on public.deliveries(sale_id);

-- ============================================================================
-- 9. TABLE delivery_items (lignes de bon de livraison)
-- ============================================================================
create table if not exists public.delivery_items (
  id uuid primary key default uuid_generate_v4(),
  delivery_id uuid references public.deliveries(id) on delete cascade,
  sale_item_id uuid references public.sale_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity_delivered integer not null check (quantity_delivered > 0)
);

create index if not exists idx_delivery_items_delivery on public.delivery_items(delivery_id);
create index if not exists idx_delivery_items_sale_item on public.delivery_items(sale_item_id);

-- ============================================================================
-- 8. TABLE stock_movements (historique des entrées / sorties)
-- ============================================================================
create table if not exists public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.products(id) on delete cascade,
  type text not null check (type in ('entree', 'sortie')),
  quantity integer not null,
  reason text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id);

-- ============================================================================
-- 9. TABLE expenses (dépenses)
-- ============================================================================
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  amount numeric(12,2) not null,
  category text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================================
-- 10. TABLE shop_settings (paramètres généraux de la boutique — ligne unique)
-- ============================================================================
create table if not exists public.shop_settings (
  id boolean primary key default true,
  name text not null default 'QUINCAILLERIE MABANE',
  owner text not null default 'MAMADOU FAYE Alias MOMO FAYE',
  address text not null default 'DIOUROUP - SENEGAL',
  phone1 text,
  phone2 text,
  phone3 text,
  low_stock_default_threshold integer not null default 5,
  updated_at timestamptz default now(),
  constraint shop_settings_singleton check (id)
);

insert into public.shop_settings (id, name, owner, address, phone1, phone2, phone3)
values (true, 'QUINCAILLERIE MABANE', 'MAMADOU FAYE Alias MOMO FAYE', 'DIOUROUP - SENEGAL', '+221 77 845 28 72', '+221 78 213 33 12', '+221 77 979 20 90')
on conflict (id) do nothing;

-- ============================================================================
-- FONCTION : générer le prochain numéro de facture (FAC-2026-0001)
-- ============================================================================
create or replace function public.next_invoice_number()
returns text
language plpgsql
as $$
declare
  year_part text := to_char(now(), 'YYYY');
  max_number integer;
  result text;
begin
  perform pg_advisory_xact_lock(hashtext('mabane_invoice_' || year_part));

  select max( (regexp_replace(invoice_number, '^FAC-' || year_part || '-', ''))::integer ) into max_number
  from public.sales
  where invoice_number like 'FAC-' || year_part || '-%';

  result := 'FAC-' || year_part || '-' || lpad(COALESCE(max_number + 1, 1)::text, 4, '0');
  return result;
end;
$$;

-- ============================================================================
-- FONCTION RPC : créer une vente complète (facture + lignes + stock) de façon atomique
-- items = jsonb array: [{product_id, product_name, quantity, unit_price}, ...]
-- p_delivery_mode = 'immediate' (défaut) ou 'staged' (livraison échelonnée)
-- ============================================================================
create or replace function public.create_sale(
  p_client_id uuid,
  p_user_id uuid,
  p_discount numeric,
  p_items jsonb,
  p_amount_paid numeric default null,
  p_delivery_mode text default 'immediate'
)
returns public.sales
language plpgsql
security definer
as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_line_total numeric;
  v_invoice_number text;
  v_current_stock integer;
  v_purchase_price numeric;
  v_total numeric;
  v_amount_paid numeric;
  v_status text;
  v_delivery_status text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La vente doit contenir au moins un article.';
  end if;

  if p_delivery_mode not in ('immediate', 'staged') then
    raise exception 'Mode de livraison invalide : % (immediate ou staged)', p_delivery_mode;
  end if;

  if coalesce(p_discount, 0) < 0 then
    raise exception 'La remise ne peut pas être négative.';
  end if;

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

  v_total := v_subtotal - coalesce(p_discount, 0);

  v_amount_paid := coalesce(p_amount_paid, v_total);

  if v_amount_paid < 0 then
    raise exception 'Le montant payé ne peut pas être négatif.';
  end if;
  if v_amount_paid > v_total then
    raise exception 'Le montant payé ne peut pas dépasser le total de la facture.';
  end if;

  v_status := case
    when v_amount_paid >= v_total and v_total > 0 then 'payee'
    when v_amount_paid > 0 then 'partielle'
    else 'credit'
  end;

  v_delivery_status := case when p_delivery_mode = 'staged' then 'en_attente' else 'livree' end;

  v_invoice_number := public.next_invoice_number();

  insert into public.sales (invoice_number, client_id, user_id, subtotal, discount, total, amount_paid, status, delivery_status)
  values (
    v_invoice_number,
    p_client_id,
    p_user_id,
    v_subtotal,
    coalesce(p_discount, 0),
    v_total,
    v_amount_paid,
    v_status,
    v_delivery_status
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric;

    insert into public.sale_items (sale_id, product_id, product_name, quantity, purchase_price, unit_price, line_total)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      coalesce((v_item->>'purchase_price')::numeric, 0),
      (v_item->>'unit_price')::numeric,
      v_line_total
    );

    if p_delivery_mode = 'immediate' then
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

      update public.products
      set stock = stock - (v_item->>'quantity')::integer, updated_at = now()
      where id = (v_item->>'product_id')::uuid;

      insert into public.stock_movements (product_id, type, quantity, reason, user_id)
      values (
        (v_item->>'product_id')::uuid,
        'sortie',
        (v_item->>'quantity')::integer,
        'Vente ' || v_invoice_number,
        p_user_id
      );
    end if;
  end loop;

  return v_sale;
end;
$$;

-- ============================================================================
-- FONCTION RPC : entrée de stock (achat fournisseur / réapprovisionnement)
-- ============================================================================
create or replace function public.add_stock_entry(
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantité d''entrée doit être supérieure à zéro.';
  end if;

  update public.products
  set stock = stock + p_quantity, updated_at = now()
  where id = p_product_id;

  if not found then
    raise exception 'Produit introuvable.';
  end if;

  insert into public.stock_movements (product_id, type, quantity, reason, user_id)
  values (p_product_id, 'entree', p_quantity, coalesce(p_reason, 'Réapprovisionnement'), p_user_id);
end;
$$;

-- ============================================================================
-- FONCTION RPC : créer un bon de livraison (livraison partielle ou totale)
-- items = jsonb array: [{sale_item_id, quantity_delivered}, ...]
-- ============================================================================
create or replace function public.create_delivery(
  p_sale_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns public.deliveries
language plpgsql
security definer
as $$
declare
  v_delivery public.deliveries;
  v_item jsonb;
  v_sale_item record;
  v_already_delivered integer;
  v_remaining_to_deliver integer;
  v_current_stock integer;
  v_delivery_number text;
begin
  select * into v_sale_item from public.sales where id = p_sale_id for update;
  if v_sale_item.id is null then
    raise exception 'Facture introuvable.';
  end if;

  if v_sale_item.status = 'annulee' then
    raise exception 'Impossible de livrer une facture annulée.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La livraison doit contenir au moins un article.';
  end if;

  v_delivery_number := public.next_delivery_number();

  insert into public.deliveries (sale_id, delivery_number, notes, created_by)
  values (p_sale_id, v_delivery_number, nullif(p_notes, ''), auth.uid())
  returning * into v_delivery;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'quantity_delivered')::integer <= 0 then
      raise exception 'La quantité livrée doit être supérieure à zéro.';
    end if;

    select quantity into v_remaining_to_deliver
    from public.sale_items
    where id = (v_item->>'sale_item_id')::uuid;

    if v_remaining_to_deliver is null then
      raise exception 'Article de facture introuvable.';
    end if;

    select coalesce(sum(quantity_delivered), 0) into v_already_delivered
    from public.delivery_items di
    join public.deliveries d on d.id = di.delivery_id
    where d.sale_id = p_sale_id
      and di.sale_item_id = (v_item->>'sale_item_id')::uuid;

    if v_already_delivered + (v_item->>'quantity_delivered')::integer > v_remaining_to_deliver then
      raise exception 'Quantité livrée dépasse la quantité commandée pour l''article %', v_remaining_to_deliver;
    end if;

    select stock into v_current_stock
    from public.products
    where id = (select product_id from public.sale_items where id = (v_item->>'sale_item_id')::uuid)
    for update;

    if v_current_stock is null then
      raise exception 'Produit introuvable.';
    end if;

    if v_current_stock < (v_item->>'quantity_delivered')::integer then
      raise exception 'Stock insuffisant pour la livraison (disponible: %).', v_current_stock;
    end if;

    update public.products
    set stock = stock - (v_item->>'quantity_delivered')::integer, updated_at = now()
    where id = (select product_id from public.sale_items where id = (v_item->>'sale_item_id')::uuid);

    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
    values (
      (select product_id from public.sale_items where id = (v_item->>'sale_item_id')::uuid),
      'sortie',
      (v_item->>'quantity_delivered')::integer,
      'Livraison ' || v_delivery_number,
      auth.uid()
    );

    insert into public.delivery_items (delivery_id, sale_item_id, product_id, quantity_delivered)
    values (
      v_delivery.id,
      (v_item->>'sale_item_id')::uuid,
      (select product_id from public.sale_items where id = (v_item->>'sale_item_id')::uuid),
      (v_item->>'quantity_delivered')::integer
    );
  end loop;

  update public.sales
  set delivery_status = case
    when (select sum(quantity) from public.sale_items where sale_id = p_sale_id)
         <= (select coalesce(sum(di.quantity_delivered), 0)
             from public.delivery_items di
             join public.deliveries d on d.id = di.delivery_id
             where d.sale_id = p_sale_id)
    then 'livree'
    else 'partielle'
  end
  where id = p_sale_id;

  return v_delivery;
end;
$$;
drop function if exists public.update_stock_movement(uuid, uuid, text, integer, text, uuid);
drop function if exists public.update_stock_movement(uuid, uuid, integer, text, text, uuid);

create or replace function public.update_stock_movement(
  p_movement_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_type text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_old public.stock_movements;
  v_old_delta integer;
  v_new_delta integer;
  v_current_stock integer;
begin
  if p_type not in ('entree', 'sortie') then
    raise exception 'Type de mouvement invalide.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantité doit être supérieure à zéro.';
  end if;

  select * into v_old
  from public.stock_movements
  where id = p_movement_id
  for update;

  if not found then
    raise exception 'Mouvement de stock introuvable.';
  end if;

  v_old_delta := case when v_old.type = 'entree' then v_old.quantity else -v_old.quantity end;
  v_new_delta := case when p_type = 'entree' then p_quantity else -p_quantity end;

  update public.products
  set stock = stock - v_old_delta, updated_at = now()
  where id = v_old.product_id
  returning stock into v_current_stock;

  if not found then
    raise exception 'Ancien produit introuvable.';
  end if;

  if v_current_stock < 0 then
    raise exception 'Modification impossible : le stock de l''ancien produit deviendrait négatif.';
  end if;

  update public.products
  set stock = stock + v_new_delta, updated_at = now()
  where id = p_product_id
  returning stock into v_current_stock;

  if not found then
    raise exception 'Produit introuvable.';
  end if;

  if v_current_stock < 0 then
    raise exception 'Modification impossible : le stock du produit deviendrait négatif.';
  end if;

  update public.stock_movements
  set product_id = p_product_id,
      type = p_type,
      quantity = p_quantity,
      reason = coalesce(p_reason, ''),
      user_id = p_user_id
  where id = p_movement_id;
end;
$$;

-- ============================================================================
-- FONCTION RPC : supprimer un mouvement de stock et annuler son effet
-- ============================================================================
create or replace function public.delete_stock_movement(
  p_movement_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_old public.stock_movements;
  v_delta integer;
  v_current_stock integer;
begin
  select * into v_old
  from public.stock_movements
  where id = p_movement_id
  for update;

  if not found then
    raise exception 'Mouvement de stock introuvable.';
  end if;

  v_delta := case when v_old.type = 'entree' then v_old.quantity else -v_old.quantity end;

  update public.products
  set stock = stock - v_delta, updated_at = now()
  where id = v_old.product_id
  returning stock into v_current_stock;

  if not found then
    raise exception 'Produit introuvable.';
  end if;

  if v_current_stock < 0 then
    raise exception 'Suppression impossible : le stock deviendrait négatif.';
  end if;

delete from public.stock_movements
  where id = p_movement_id;
end;
$$;

grant execute on function public.update_stock_movement(uuid, uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.delete_stock_movement(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- FONCTION : générer le prochain numéro de bon d'achat (ACH-2026-0001)
-- ============================================================================
create or replace function public.next_purchase_number()
returns text
language plpgsql
as $$
declare
  year_part text := to_char(now(), 'YYYY');
  max_number integer;
  result text;
begin
  perform pg_advisory_xact_lock(hashtext('mabane_purchase_' || year_part));

  select max( (regexp_replace(purchase_number, '^ACH-' || year_part || '-', ''))::integer ) into max_number
  from public.purchases
  where purchase_number like 'ACH-' || year_part || '-%';

  result := 'ACH-' || year_part || '-' || lpad(COALESCE(max_number + 1, 1)::text, 4, '0');
  return result;
end;
$$;

-- ============================================================================
-- FONCTION : générer le prochain numéro de bon de livraison (BL-2026-0001)
-- ============================================================================
create sequence if not exists public.delivery_number_seq;

create or replace function public.next_delivery_number()
returns text
language plpgsql
as $$
declare
  year_part text := to_char(now(), 'YYYY');
  max_number integer;
  result text;
begin
  perform pg_advisory_xact_lock(hashtext('mabane_delivery_' || year_part));

  select max( (regexp_replace(delivery_number, '^BL-' || year_part || '-', ''))::integer ) into max_number
  from public.deliveries
  where delivery_number like 'BL-' || year_part || '-%';

  result := 'BL-' || year_part || '-' || lpad(COALESCE(max_number + 1, 1)::text, 4, '0');
  return result;
end;
$$;

-- ============================================================================
-- FONCTION RPC : créer un achat fournisseur complet (facture + lignes + stock) de façon atomique
-- items = jsonb array: [{product_id, product_name, quantity, unit_cost}, ...]
-- Le prix d'achat catalogue du produit est mis à jour avec le dernier coût payé.
-- ============================================================================
create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_user_id uuid,
  p_amount_paid numeric,
  p_notes text,
  p_items jsonb
)
returns public.purchases
language plpgsql
security definer
as $$
declare
  v_purchase public.purchases;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_line_total numeric;
  v_purchase_number text;
  v_supplier_name text;
  v_status text;
  v_amount_paid numeric := coalesce(p_amount_paid, 0);
begin
  if p_supplier_id is null then
    raise exception 'Veuillez sélectionner un fournisseur.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'L''achat doit contenir au moins un article.';
  end if;

  select name into v_supplier_name from public.suppliers where id = p_supplier_id;
  if v_supplier_name is null then
    raise exception 'Fournisseur introuvable.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::integer <= 0 then
      raise exception 'La quantité doit être supérieure à zéro pour le produit %', v_item->>'product_name';
    end if;
    if (v_item->>'unit_cost')::numeric < 0 then
      raise exception 'Le prix d''achat ne peut pas être négatif pour le produit %', v_item->>'product_name';
    end if;
    v_subtotal := v_subtotal + ((v_item->>'quantity')::integer * (v_item->>'unit_cost')::numeric);
  end loop;

  if v_amount_paid < 0 then
    raise exception 'Le montant payé ne peut pas être négatif.';
  end if;
  if v_amount_paid > v_subtotal then
    raise exception 'Le montant payé ne peut pas dépasser le total de l''achat.';
  end if;

  v_status := case
    when v_amount_paid >= v_subtotal and v_subtotal > 0 then 'payee'
    when v_amount_paid > 0 then 'partielle'
    else 'credit'
  end;

  v_purchase_number := public.next_purchase_number();

  insert into public.purchases (purchase_number, supplier_id, supplier_name, user_id, subtotal, total, amount_paid, status, notes)
  values (v_purchase_number, p_supplier_id, v_supplier_name, p_user_id, v_subtotal, v_subtotal, v_amount_paid, v_status, nullif(p_notes, ''))
  returning * into v_purchase;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::integer * (v_item->>'unit_cost')::numeric;

    insert into public.purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, line_total)
    values (
      v_purchase.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_cost')::numeric,
      v_line_total
    );

    -- Incrémenter le stock et rafraîchir le prix d'achat catalogue avec le dernier coût payé
    update public.products
    set stock = stock + (v_item->>'quantity')::integer,
        purchase_price = (v_item->>'unit_cost')::numeric,
        updated_at = now()
    where id = (v_item->>'product_id')::uuid;

    -- Historiser le mouvement de stock
    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
    values (
      (v_item->>'product_id')::uuid,
      'entree',
      (v_item->>'quantity')::integer,
      'Achat ' || v_purchase_number || ' — ' || v_supplier_name,
      p_user_id
    );
  end loop;

  return v_purchase;
end;
$$;

-- ============================================================================
-- FONCTION RPC : enregistrer un paiement sur un achat fournisseur (dette)
-- ============================================================================
create or replace function public.add_purchase_payment(
  p_purchase_id uuid,
  p_amount numeric
)
returns public.purchases
language plpgsql
security definer
as $$
declare
  v_purchase public.purchases;
  v_new_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du paiement doit être supérieur à zéro.';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;

  if v_purchase.id is null then
    raise exception 'Achat introuvable.';
  end if;

  if v_purchase.status = 'annulee' then
    raise exception 'Cet achat est annulé, impossible d''y enregistrer un paiement.';
  end if;

  v_new_paid := v_purchase.amount_paid + p_amount;

  if v_new_paid > v_purchase.total then
    raise exception 'Ce paiement dépasse le solde restant dû (%).', v_purchase.total - v_purchase.amount_paid;
  end if;

  update public.purchases
  set amount_paid = v_new_paid,
      status = case
        when v_new_paid >= total then 'payee'
        when v_new_paid > 0 then 'partielle'
        else 'credit'
      end
  where id = p_purchase_id
  returning * into v_purchase;

  return v_purchase;
end;
$$;

-- ============================================================================
-- FONCTION RPC : annuler un achat fournisseur et retirer les articles du stock
-- ============================================================================
create or replace function public.cancel_purchase(
  p_purchase_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_purchase public.purchases;
  v_item record;
  v_current_stock integer;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'Seul un administrateur peut annuler un achat.';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;

  if v_purchase.id is null then
    raise exception 'Achat introuvable.';
  end if;

  if v_purchase.status = 'annulee' then
    raise exception 'Cet achat est déjà annulé.';
  end if;

  for v_item in
    select product_id, product_name, quantity
    from public.purchase_items
    where purchase_id = p_purchase_id and product_id is not null
  loop
    select stock into v_current_stock from public.products where id = v_item.product_id for update;

    if v_current_stock is null or v_current_stock < v_item.quantity then
      raise exception 'Impossible d''annuler : le produit "%" a déjà été vendu ou son stock a changé.', v_item.product_name;
    end if;

    update public.products
    set stock = stock - v_item.quantity, updated_at = now()
    where id = v_item.product_id;

    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
    values (
      v_item.product_id,
      'sortie',
      v_item.quantity,
      'Annulation achat ' || v_purchase.purchase_number || ' - ' || v_item.product_name,
      p_user_id
    );
  end loop;

  update public.purchases set status = 'annulee' where id = p_purchase_id;
end;
$$;

-- ============================================================================
-- FONCTION RPC : enregistrer un paiement sur une vente à crédit / partielle (client)
-- ============================================================================
create or replace function public.add_sale_payment(
  p_sale_id uuid,
  p_amount numeric
)
returns public.sales
language plpgsql
security definer
as $$
declare
  v_sale public.sales;
  v_new_paid numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du paiement doit être supérieur à zéro.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;

  if v_sale.id is null then
    raise exception 'Facture introuvable.';
  end if;

  if v_sale.status = 'annulee' then
    raise exception 'Cette facture est annulée, impossible d''y enregistrer un paiement.';
  end if;

  v_new_paid := v_sale.amount_paid + p_amount;

  if v_new_paid > v_sale.total then
    raise exception 'Ce paiement dépasse le solde restant dû (%).', v_sale.total - v_sale.amount_paid;
  end if;

  update public.sales
  set amount_paid = v_new_paid,
      status = case
        when v_new_paid >= total then 'payee'
        when v_new_paid > 0 then 'partielle'
        else 'credit'
      end
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

-- ============================================================================
-- FONCTION RPC : annuler une vente et remettre les articles en stock
-- ============================================================================
create or replace function public.cancel_sale(
  p_sale_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_sale public.sales;
  v_item record;
  v_delivered integer;
  v_undelivered integer;
  v_current_stock integer;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'Seul un administrateur peut annuler une vente.';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Vente introuvable.';
  end if;

  if v_sale.status = 'annulee' then
    raise exception 'Cette vente est déjà annulée.';
  end if;

  for v_item in
    select si.id, si.product_id, si.product_name, si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id and si.product_id is not null
  loop
    if v_sale.delivery_status = 'en_attente' then
      v_undelivered := 0;
    else
      select coalesce(sum(di.quantity_delivered), 0) into v_delivered
      from public.delivery_items di
      join public.deliveries d on d.id = di.delivery_id
      where d.sale_id = p_sale_id
        and di.sale_item_id = v_item.id;

      v_undelivered := v_item.quantity - v_delivered;
    end if;

    if v_undelivered > 0 then
      select stock into v_current_stock from public.products where id = v_item.product_id for update;

      if v_current_stock is null or v_current_stock < v_undelivered then
        raise exception 'Impossible d''annuler : le produit "%" a déjà été vendu ou son stock a changé.', v_item.product_name;
      end if;

      update public.products
      set stock = stock + v_undelivered, updated_at = now()
      where id = v_item.product_id;

      insert into public.stock_movements (product_id, type, quantity, reason, user_id)
      values (
        v_item.product_id,
        'entree',
        v_undelivered,
        'Annulation vente ' || v_sale.invoice_number || ' - ' || v_item.product_name,
        p_user_id
      );
    end if;
  end loop;

  update public.sales
  set status = 'annulee'
  where id = p_sale_id;
end;
$$;

-- ============================================================================
-- TRIGGER : création automatique du profil "users" à l'inscription (fallback)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case
      when not exists (select 1 from public.users) then 'admin'
      else 'employe'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;

-- Fonction utilitaire : l'utilisateur connecté est-il admin ?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- USERS : chacun voit son profil, l'admin voit tout le monde
drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id or public.is_admin());
drop policy if exists "Admin can insert users" on public.users;
create policy "Admin can insert users" on public.users
  for insert with check (public.is_admin() or (auth.uid() = id and role = 'employe'));
drop policy if exists "Admin can update users" on public.users;
create policy "Admin can update users" on public.users
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin can delete users" on public.users;
create policy "Admin can delete users" on public.users
  for delete using (public.is_admin());

-- Toutes les tables métier : accessibles en lecture/écriture à tout utilisateur authentifié
-- (Caissier/Employé peuvent gérer les opérations quotidiennes ; seul l'admin gère users)
drop policy if exists "Authenticated read categories" on public.categories;
create policy "Authenticated read categories" on public.categories for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write categories" on public.categories;
create policy "Authenticated write categories" on public.categories for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update categories" on public.categories;
create policy "Authenticated update categories" on public.categories for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete categories" on public.categories;
create policy "Authenticated delete categories" on public.categories for delete using (public.is_admin());

drop policy if exists "Authenticated read products" on public.products;
create policy "Authenticated read products" on public.products for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write products" on public.products;
create policy "Authenticated write products" on public.products for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update products" on public.products;
create policy "Authenticated update products" on public.products for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete products" on public.products;
create policy "Authenticated delete products" on public.products for delete using (public.is_admin());

drop policy if exists "Authenticated read clients" on public.clients;
create policy "Authenticated read clients" on public.clients for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write clients" on public.clients;
create policy "Authenticated write clients" on public.clients for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update clients" on public.clients;
create policy "Authenticated update clients" on public.clients for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete clients" on public.clients;
create policy "Authenticated delete clients" on public.clients for delete using (public.is_admin());

drop policy if exists "Authenticated read suppliers" on public.suppliers;
create policy "Authenticated read suppliers" on public.suppliers for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write suppliers" on public.suppliers;
create policy "Authenticated write suppliers" on public.suppliers for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update suppliers" on public.suppliers;
create policy "Authenticated update suppliers" on public.suppliers for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete suppliers" on public.suppliers;
create policy "Authenticated delete suppliers" on public.suppliers for delete using (public.is_admin());

drop policy if exists "Authenticated read supplier_products" on public.supplier_products;
create policy "Authenticated read supplier_products" on public.supplier_products for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write supplier_products" on public.supplier_products;
create policy "Authenticated write supplier_products" on public.supplier_products for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update supplier_products" on public.supplier_products;
create policy "Authenticated update supplier_products" on public.supplier_products for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete supplier_products" on public.supplier_products;
create policy "Authenticated delete supplier_products" on public.supplier_products for delete using (auth.role() = 'authenticated');

drop policy if exists "Authenticated read purchases" on public.purchases;
create policy "Authenticated read purchases" on public.purchases for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write purchases" on public.purchases;
create policy "Authenticated write purchases" on public.purchases for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update purchases" on public.purchases;
create policy "Authenticated update purchases" on public.purchases for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete purchases" on public.purchases;
create policy "Authenticated delete purchases" on public.purchases for delete using (public.is_admin());

drop policy if exists "Authenticated read purchase_items" on public.purchase_items;
create policy "Authenticated read purchase_items" on public.purchase_items for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write purchase_items" on public.purchase_items;
create policy "Authenticated write purchase_items" on public.purchase_items for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated read sales" on public.sales;
create policy "Authenticated read sales" on public.sales for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write sales" on public.sales;
create policy "Authenticated write sales" on public.sales for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update sales" on public.sales;
create policy "Authenticated update sales" on public.sales for update using (public.is_admin());
drop policy if exists "Authenticated delete sales" on public.sales;
create policy "Authenticated delete sales" on public.sales for delete using (public.is_admin());

drop policy if exists "Authenticated read sale_items" on public.sale_items;
create policy "Authenticated read sale_items" on public.sale_items for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write sale_items" on public.sale_items;
create policy "Authenticated write sale_items" on public.sale_items for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated read stock_movements" on public.stock_movements;
create policy "Authenticated read stock_movements" on public.stock_movements for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write stock_movements" on public.stock_movements;
create policy "Authenticated write stock_movements" on public.stock_movements for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated read expenses" on public.expenses;
create policy "Authenticated read expenses" on public.expenses for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write expenses" on public.expenses;
create policy "Authenticated write expenses" on public.expenses for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated update expenses" on public.expenses;
create policy "Authenticated update expenses" on public.expenses for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated delete expenses" on public.expenses;
create policy "Authenticated delete expenses" on public.expenses for delete using (public.is_admin());

drop policy if exists "Authenticated read deliveries" on public.deliveries;
create policy "Authenticated read deliveries" on public.deliveries for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write deliveries" on public.deliveries;
create policy "Authenticated write deliveries" on public.deliveries for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated read delivery_items" on public.delivery_items;
create policy "Authenticated read delivery_items" on public.delivery_items for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated write delivery_items" on public.delivery_items;
create policy "Authenticated write delivery_items" on public.delivery_items for insert with check (auth.role() = 'authenticated');

alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;

alter table public.shop_settings enable row level security;
drop policy if exists "Public read shop_settings" on public.shop_settings;
create policy "Public read shop_settings" on public.shop_settings for select using (true);
drop policy if exists "Admin update shop_settings" on public.shop_settings;
create policy "Admin update shop_settings" on public.shop_settings for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- CONTRAINTES MÉTIER (idempotentes)
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_non_negative_values') then
    alter table public.products
      add constraint products_non_negative_values
      check (purchase_price >= 0 and sale_price >= 0 and stock >= 0 and alert_threshold >= 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sale_items_positive_values') then
    alter table public.sale_items
      add constraint sale_items_positive_values
      check (quantity > 0 and purchase_price >= 0 and unit_price >= 0 and line_total >= 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sales_valid_amounts') then
    alter table public.sales
      add constraint sales_valid_amounts
      check (subtotal >= 0 and discount >= 0 and discount <= subtotal and total >= 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stock_movements_positive_quantity') then
    alter table public.stock_movements
      add constraint stock_movements_positive_quantity
      check (quantity > 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'expenses_non_negative_amount') then
    alter table public.expenses
      add constraint expenses_non_negative_amount
      check (amount >= 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchase_items_positive_values') then
    alter table public.purchase_items
      add constraint purchase_items_positive_values
      check (quantity > 0 and unit_cost >= 0 and line_total >= 0)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'purchases_valid_amounts') then
    alter table public.purchases
      add constraint purchases_valid_amounts
      check (subtotal >= 0 and total >= 0 and amount_paid >= 0 and amount_paid <= total)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sales_valid_amounts') then
    alter table public.sales
      add constraint sales_valid_amounts
      check (amount_paid >= 0 and amount_paid <= total)
      not valid;
  end if;
end $$;

-- ============================================================================
-- REALTIME (multi-utilisateurs en temps réel)
-- ============================================================================
-- Note: les tables sont ajoutées à la publication supabase_realtime pour l'écoute en temps réel
-- L'utilisation de SET TABLE est totalement idempotente (peut être exécutée plusieurs fois)
alter publication supabase_realtime set table public.products, public.sales, public.stock_movements, public.purchases, public.deliveries;

-- ============================================================================
-- GRANTS : fonctions RPC
-- ============================================================================
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.next_purchase_number() to authenticated;
grant execute on function public.next_delivery_number() to authenticated;
grant execute on function public.create_sale(uuid, uuid, numeric, jsonb, numeric, text) to authenticated;
grant execute on function public.create_delivery(uuid, jsonb, text) to authenticated;
grant execute on function public.add_sale_payment(uuid, numeric) to authenticated;
grant execute on function public.cancel_sale(uuid, uuid) to authenticated;
grant execute on function public.add_purchase_payment(uuid, numeric) to authenticated;
grant execute on function public.cancel_purchase(uuid, uuid) to authenticated;
grant execute on function public.add_stock_entry(uuid, integer, text, uuid) to authenticated;
grant execute on function public.update_stock_movement(uuid, uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.delete_stock_movement(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ============================================================================
-- DONNÉES DE DÉMARRAGE (catégories par défaut)
-- ============================================================================
insert into public.categories (name, description) values
  ('Ciment', 'Ciments et liants'),
  ('Fer', 'Fers à béton, tôles, métaux'),
  ('Électricité', 'Câbles, ampoules, appareillage électrique'),
  ('Plomberie', 'Tuyaux, robinetterie, raccords'),
  ('Divers', 'Autres articles de quincaillerie')
on conflict (name) do nothing;

-- ============================================================================
-- STORAGE : bucket pour les photos de produits
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects
  for select using (bucket_id = 'product-images');
drop policy if exists "Authenticated upload product images" on storage.objects;
create policy "Authenticated upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images" on storage.objects
  for update using (bucket_id = 'product-images' and auth.role() = 'authenticated');
drop policy if exists "Authenticated delete product images" on storage.objects;
create policy "Authenticated delete product images" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- ============================================================================
-- IMPORTANT : Pour créer le PREMIER compte admin :
-- 1. Inscrivez-vous depuis l'application (page /register) avec un email/mdp
-- 2. Puis exécutez dans le SQL Editor :
--    update public.users set role = 'admin' where email = 'votre-email@exemple.com';
-- ============================================================================
