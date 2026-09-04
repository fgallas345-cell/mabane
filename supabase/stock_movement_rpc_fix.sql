-- ============================================================================
-- ⚠️  CE FICHIER EST OBSOLÈTE — NE PAS EXÉCUTER
-- La version définitive de update_stock_movement / delete_stock_movement a été
-- intégrée directement dans supabase/schema.sql.
-- Exécutez uniquement schema.sql lors d'un nouveau déploiement.
-- ============================================================================
-- Anciennement : Execute this file in Supabase SQL Editor to enable editing/deleting stock movements.
-- It creates the RPC functions used by the Stock page and reloads PostgREST schema cache.

drop function if exists public.update_stock_movement(uuid, uuid, text, integer, text, uuid);
drop function if exists public.update_stock_movement(uuid, uuid, integer, text, text, uuid);
drop function if exists public.delete_stock_movement(uuid);

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
set search_path = public
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

create or replace function public.delete_stock_movement(
  p_movement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
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
