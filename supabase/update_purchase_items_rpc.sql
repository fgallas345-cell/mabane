-- RPC function to update purchase items and manage stock accordingly
-- Execute this in Supabase SQL Editor

create or replace function public.update_purchase_items(
  p_purchase_id uuid,
  p_items jsonb
)
returns public.purchases
language plpgsql
security definer
as $$
declare
  v_purchase public.purchases;
  v_item jsonb;
  v_old_item record;
  v_new_quantity integer;
  v_new_subtotal numeric := 0;
  v_line_total numeric;
  v_current_stock integer;
begin
  -- Fetch the purchase
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id
  for update;

  if v_purchase.id is null then
    raise exception 'Achat introuvable.';
  end if;

  if v_purchase.status = 'annulee' then
    raise exception 'Impossible de modifier un achat annulé.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'L''achat doit contenir au moins un article.';
  end if;

  -- Delete old purchase items and revert stock
  for v_old_item in
    select id, product_id, quantity
    from public.purchase_items
    where purchase_id = p_purchase_id
  loop
    -- Remove stock for items being removed/modified
    if v_old_item.product_id is not null then
      select stock into v_current_stock
      from public.products
      where id = v_old_item.product_id
      for update;

      if v_current_stock is null then
        raise exception 'Produit introuvable : %', v_old_item.product_id;
      end if;

      if v_current_stock < v_old_item.quantity then
        raise exception 'Impossible de modifier : le produit a déjà été vendu ou son stock a changé.';
      end if;

      update public.products
      set stock = stock - v_old_item.quantity, updated_at = now()
      where id = v_old_item.product_id;

      -- Record stock movement (reversal of original purchase)
      insert into public.stock_movements (product_id, type, quantity, reason, user_id)
      values (
        v_old_item.product_id,
        'sortie',
        v_old_item.quantity,
        'Rectification achat ' || v_purchase.purchase_number,
        auth.uid()
      );
    end if;

    -- Delete old item
    delete from public.purchase_items where id = v_old_item.id;
  end loop;

  -- Insert new items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_new_quantity := (v_item->>'quantity')::integer;

    if v_new_quantity <= 0 then
      raise exception 'La quantité doit être supérieure à zéro pour le produit %', v_item->>'product_name';
    end if;

    if (v_item->>'unit_cost')::numeric < 0 then
      raise exception 'Le prix d''achat ne peut pas être négatif pour le produit %', v_item->>'product_name';
    end if;

    v_line_total := v_new_quantity * (v_item->>'unit_cost')::numeric;
    v_new_subtotal := v_new_subtotal + v_line_total;

    -- Lock product and check stock
    select stock into v_current_stock
    from public.products
    where id = (v_item->>'product_id')::uuid
    for update;

    if v_current_stock is null then
      raise exception 'Produit introuvable : %', v_item->>'product_name';
    end if;

    -- Increment stock
    update public.products
    set stock = stock + v_new_quantity,
        purchase_price = (v_item->>'unit_cost')::numeric,
        updated_at = now()
    where id = (v_item->>'product_id')::uuid;

    -- Record stock movement
    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
    values (
      (v_item->>'product_id')::uuid,
      'entree',
      v_new_quantity,
      'Achat rectifié ' || v_purchase.purchase_number,
      auth.uid()
    );

    -- Insert new purchase item
    insert into public.purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, line_total)
    values (
      v_purchase.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_new_quantity,
      (v_item->>'unit_cost')::numeric,
      v_line_total
    );
  end loop;

  -- Recalculate and update purchase totals
  update public.purchases
  set subtotal = v_new_subtotal,
      total = v_new_subtotal,
      status = case
        when v_purchase.amount_paid >= v_new_subtotal and v_new_subtotal > 0 then 'payee'
        when v_purchase.amount_paid > 0 then 'partielle'
        else 'credit'
      end
  where id = p_purchase_id
  returning * into v_purchase;

  return v_purchase;
end;
$$;

grant execute on function public.update_purchase_items(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
