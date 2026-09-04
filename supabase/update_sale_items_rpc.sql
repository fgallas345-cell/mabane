-- ============================================================================
-- ⚠️  CE FICHIER EST OBSOLÈTE — NE PAS EXÉCUTER
-- Cette RPC (update_sale_items) a été intégrée dans supabase/schema.sql.
-- Exécutez uniquement schema.sql lors d'un nouveau déploiement.
-- ============================================================================
-- Anciennement : RPC function to update sale items and manage stock accordingly
-- Execute this in Supabase SQL Editor

create or replace function public.update_sale_items(
  p_sale_id uuid,
  p_items jsonb
)
returns public.sales
language plpgsql
security definer
as $$
declare
  v_sale public.sales;
  v_item jsonb;
  v_old_item record;
  v_new_quantity integer;
  v_purchase_price numeric;
  v_new_subtotal numeric := 0;
  v_new_total numeric;
  v_line_total numeric;
  v_current_stock integer;
begin
  -- Fetch the sale
  select * into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Facture introuvable.';
  end if;

  if v_sale.status = 'annulee' then
    raise exception 'Impossible de modifier une facture annulée.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La facture doit contenir au moins un article.';
  end if;

  -- Delete old sale items and update stock
  for v_old_item in
    select id, product_id, quantity
    from public.sale_items
    where sale_id = p_sale_id
  loop
    -- Restore stock for items being removed/modified
    if v_old_item.product_id is not null then
      update public.products
      set stock = stock + v_old_item.quantity, updated_at = now()
      where id = v_old_item.product_id;

      -- Record stock movement (reversal of original sale)
      insert into public.stock_movements (product_id, type, quantity, reason, user_id)
      values (
        v_old_item.product_id,
        'entree',
        v_old_item.quantity,
        'Rectification facture ' || v_sale.invoice_number,
        auth.uid()
      );
    end if;

    -- Delete old item
    delete from public.sale_items where id = v_old_item.id;
  end loop;

  -- Insert new items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_new_quantity := (v_item->>'quantity')::integer;

    if v_new_quantity <= 0 then
      raise exception 'La quantité doit être supérieure à zéro pour le produit %', v_item->>'product_name';
    end if;

    if (v_item->>'unit_price')::numeric < 0 then
      raise exception 'Le prix de vente ne peut pas être négatif pour le produit %', v_item->>'product_name';
    end if;

    v_line_total := v_new_quantity * (v_item->>'unit_price')::numeric;
    v_new_subtotal := v_new_subtotal + v_line_total;

    -- Lock product and check stock
    select stock, purchase_price into v_current_stock, v_purchase_price
    from public.products
    where id = (v_item->>'product_id')::uuid
    for update;

    if v_current_stock is null then
      raise exception 'Produit introuvable : %', v_item->>'product_name';
    end if;

    if v_current_stock < v_new_quantity then
      raise exception 'Stock insuffisant pour le produit % (disponible: %)', v_item->>'product_name', v_current_stock;
    end if;

    -- Decrement stock
    update public.products
    set stock = stock - v_new_quantity, updated_at = now()
    where id = (v_item->>'product_id')::uuid;

    -- Record stock movement
    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
    values (
      (v_item->>'product_id')::uuid,
      'sortie',
      v_new_quantity,
      'Vente rectifiée ' || v_sale.invoice_number,
      auth.uid()
    );

    -- Insert new sale item
    insert into public.sale_items (sale_id, product_id, product_name, quantity, purchase_price, unit_price, line_total)
    values (
      v_sale.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_new_quantity,
      coalesce((v_item->>'purchase_price')::numeric, v_purchase_price),
      (v_item->>'unit_price')::numeric,
      v_line_total
    );
  end loop;

  -- Recalculate and update sale totals
  v_new_total := v_new_subtotal - coalesce(v_sale.discount, 0);

  update public.sales
  set subtotal = v_new_subtotal,
      total = v_new_total,
      status = case
        when v_sale.amount_paid >= v_new_total and v_new_total > 0 then 'payee'
        when v_sale.amount_paid > 0 then 'partielle'
        else 'credit'
      end
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

grant execute on function public.update_sale_items(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
