-- ============================================================================
-- SIGNATURE ÉLECTRONIQUE DES DOCUMENTS (signature manuscrite + code PIN)
-- Migration autonome et idempotente : à exécuter une fois dans Supabase > SQL Editor.
-- (Le même bloc figure à la fin de schema.sql pour les nouveaux déploiements.)
--
-- Principe :
--  * chaque administrateur peut enregistrer SA signature (image PNG) protégée par
--    un code PIN à 4 chiffres, stocké haché (bcrypt) ;
--  * l'image et le hash ne sont JAMAIS lisibles directement (RLS sans policy) :
--    seules les RPC ci-dessous y accèdent, après vérification du PIN ;
--  * 5 PIN faux → signature bloquée 15 minutes ;
--  * documents signables : facture / devis (invoice), bon de livraison (delivery),
--    reçu de paiement (payment_receipt, identifié par son numéro), reçu de dépôt /
--    retrait (deposit_receipt) et relevé de dépôt d'un client (deposit_statement) ;
--  * chaque signature apposée est journalisée (qui, quand, quel document, quel
--    montant) dans document_signatures. Retirer une signature la marque comme
--    révoquée, elle n'est jamais effacée.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table if not exists public.user_signatures (
  user_id uuid primary key references public.users(id) on delete cascade,
  image text not null check (image like 'data:image/png;base64,%' and length(image) <= 1500000),
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_signatures enable row level security;
-- Aucune policy : ni lecture ni écriture directe, même pour un admin.
revoke all on public.user_signatures from anon, authenticated;

create table if not exists public.document_signatures (
  id uuid primary key default uuid_generate_v4(),
  doc_type text not null,
  doc_id text not null,                  -- id du document (uuid) ou numéro du reçu de paiement
  signed_by uuid references public.users(id) on delete set null,
  signer_name text not null,
  signature_image text not null,
  signed_amount numeric(12,2),           -- montant au moment de la signature (détecte une modification ultérieure)
  signed_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null
);

-- Mise à niveau si la première version (factures seules, doc_id uuid) a déjà été exécutée
alter table public.document_signatures alter column doc_id type text using doc_id::text;
alter table public.document_signatures drop constraint if exists document_signatures_doc_type_check;
alter table public.document_signatures add constraint document_signatures_doc_type_check
  check (doc_type in ('invoice', 'delivery', 'payment_receipt', 'deposit_receipt', 'deposit_statement'));
drop function if exists public.sign_document(text, uuid, text);
drop function if exists public.revoke_document_signature(text, uuid);

-- Une seule signature active par document
create unique index if not exists uq_document_signatures_active
  on public.document_signatures(doc_type, doc_id) where revoked_at is null;
create index if not exists idx_document_signatures_doc on public.document_signatures(doc_type, doc_id);

alter table public.document_signatures enable row level security;
drop policy if exists "Authenticated can read document signatures" on public.document_signatures;
create policy "Authenticated can read document signatures" on public.document_signatures
  for select using (auth.role() = 'authenticated');
-- Écriture uniquement via les RPC (security definer)
revoke insert, update, delete on public.document_signatures from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Helpers internes (non exposés au client)
-- ----------------------------------------------------------------------------
create or replace function public.signature_pin_is_valid(p_pin text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_pin, '') ~ '^[0-9]{4}$'
     and p_pin !~ '^(.)\1{3}$'
     and p_pin not in ('0123','1234','2345','3456','4567','5678','6789',
                       '9876','8765','7654','6543','5432','4321','3210');
$$;

-- Vérifie le PIN de l'utilisateur connecté et gère le compteur d'échecs.
-- Ne lève JAMAIS d'exception après avoir modifié le compteur (sinon le rollback l'annulerait).
create or replace function public.check_signature_pin(p_user_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sig public.user_signatures;
  v_failed integer;
begin
  select * into v_sig from public.user_signatures where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_signature',
      'message', 'Aucune signature enregistrée. Configurez-la dans Paramètres.');
  end if;

  if v_sig.locked_until is not null and v_sig.locked_until > now() then
    return jsonb_build_object('ok', false, 'code', 'locked', 'locked_until', v_sig.locked_until,
      'message', 'Trop d''essais incorrects. Signature bloquée jusqu''à ' ||
                 to_char(v_sig.locked_until at time zone 'Africa/Dakar', 'HH24:MI') || '.');
  end if;

  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and extensions.crypt(p_pin, v_sig.pin_hash) = v_sig.pin_hash then
    update public.user_signatures set failed_attempts = 0, locked_until = null where user_id = p_user_id;
    return jsonb_build_object('ok', true);
  end if;

  v_failed := v_sig.failed_attempts + 1;
  if v_failed >= 5 then
    update public.user_signatures
      set failed_attempts = 0, locked_until = now() + interval '15 minutes'
      where user_id = p_user_id;
    return jsonb_build_object('ok', false, 'code', 'locked', 'locked_until', now() + interval '15 minutes',
      'message', 'Code PIN incorrect. Trop d''essais : signature bloquée pendant 15 minutes.');
  end if;

  update public.user_signatures set failed_attempts = v_failed where user_id = p_user_id;
  return jsonb_build_object('ok', false, 'code', 'wrong_pin', 'remaining', 5 - v_failed,
    'message', 'Code PIN incorrect. ' || (5 - v_failed) || ' essai(s) restant(s).');
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC exposées
-- ----------------------------------------------------------------------------

-- État de MA signature (l'image n'est renvoyée qu'à son propriétaire)
create or replace function public.get_my_signature()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_auth();
  v_sig public.user_signatures;
begin
  select * into v_sig from public.user_signatures where user_id = v_uid;
  if not found then
    return jsonb_build_object('configured', false);
  end if;
  return jsonb_build_object(
    'configured', true,
    'image', v_sig.image,
    'locked_until', case when v_sig.locked_until > now() then v_sig.locked_until end,
    'updated_at', v_sig.updated_at
  );
end;
$$;

-- Crée ou modifie MA signature et/ou MON PIN.
-- Première configuration : p_image et p_new_pin obligatoires.
-- Modification : p_current_pin obligatoire ; p_image / p_new_pin à null = inchangé.
create or replace function public.save_my_signature(p_image text, p_new_pin text, p_current_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := public.require_auth();
  v_check jsonb;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut enregistrer une signature.';
  end if;
  if p_image is not null and (p_image not like 'data:image/png;base64,%' or length(p_image) > 1500000) then
    raise exception 'Image de signature invalide (PNG de 1 Mo maximum).';
  end if;
  if p_new_pin is not null and not public.signature_pin_is_valid(p_new_pin) then
    raise exception 'Le code PIN doit comporter 4 chiffres et ne pas être trop simple (ex. 0000, 1234).';
  end if;

  if exists (select 1 from public.user_signatures where user_id = v_uid) then
    v_check := public.check_signature_pin(v_uid, p_current_pin);
    if not (v_check->>'ok')::boolean then
      return v_check;
    end if;
    update public.user_signatures set
      image = coalesce(p_image, image),
      pin_hash = case when p_new_pin is null then pin_hash else extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)) end,
      updated_at = now()
    where user_id = v_uid;
  else
    if p_image is null or p_new_pin is null then
      raise exception 'Ajoutez l''image de la signature et choisissez un code PIN.';
    end if;
    insert into public.user_signatures (user_id, image, pin_hash)
    values (v_uid, p_image, extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)));
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- PIN oublié : supprime MA signature (l'interface redemande le mot de passe avant).
-- Il faut ensuite ré-importer l'image et choisir un nouveau PIN.
create or replace function public.reset_my_signature()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_auth();
begin
  delete from public.user_signatures where user_id = v_uid;
end;
$$;

-- Appose MA signature sur un document après vérification du PIN.
-- Le montant enregistré est lu en base (jamais fourni par le client) : il permet de
-- détecter une modification du document après signature.
create or replace function public.sign_document(p_doc_type text, p_doc_id text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_auth();
  v_found boolean;
  v_amount numeric;
  v_cancelled boolean := false;
  v_check jsonb;
  v_name text;
  v_row public.document_signatures;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut signer un document.';
  end if;
  if coalesce(p_doc_id, '') = '' or length(p_doc_id) > 100 then
    raise exception 'Document invalide.';
  end if;

  case p_doc_type
    when 'invoice' then
      select s.total, (s.status = 'annulee' or s.quote_status = 'cancelled')
        into v_amount, v_cancelled
        from public.sales s where s.id::text = p_doc_id;
      v_found := found;
    when 'delivery' then
      select null::numeric, (s.status = 'annulee')
        into v_amount, v_cancelled
        from public.deliveries d join public.sales s on s.id = d.sale_id
        where d.id::text = p_doc_id;
      v_found := found;
    when 'payment_receipt' then
      -- Le numéro de reçu courant est porté par la facture (dernier paiement enregistré)
      select (select p.amount from public.payments p where p.sale_id = s.id order by p.created_at desc limit 1),
             (s.status = 'annulee')
        into v_amount, v_cancelled
        from public.sales s where s.receipt_number = p_doc_id;
      v_found := found;
    when 'deposit_receipt' then
      select cd.amount, (cd.reversed_at is not null)
        into v_amount, v_cancelled
        from public.client_deposits cd
        where cd.id::text = p_doc_id and cd.type in ('depot', 'retrait');
      v_found := found;
    when 'deposit_statement' then
      select coalesce((select cd.balance_after from public.client_deposits cd
                       where cd.client_id = c.id order by cd.created_at desc, cd.id desc limit 1), 0)
        into v_amount
        from public.clients c where c.id::text = p_doc_id;
      v_found := found;
    else
      raise exception 'Type de document non pris en charge : %', p_doc_type;
  end case;

  if not v_found then
    raise exception 'Document introuvable.';
  end if;
  if v_cancelled then
    raise exception 'Impossible de signer un document annulé.';
  end if;
  if exists (select 1 from public.document_signatures
             where doc_type = p_doc_type and doc_id = p_doc_id and revoked_at is null) then
    raise exception 'Ce document est déjà signé.';
  end if;

  v_check := public.check_signature_pin(v_uid, p_pin);
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  select coalesce(nullif(trim(full_name), ''), email) into v_name from public.users where id = v_uid;

  insert into public.document_signatures (doc_type, doc_id, signed_by, signer_name, signature_image, signed_amount)
  select p_doc_type, p_doc_id, v_uid, v_name, s.image, v_amount
  from public.user_signatures s where s.user_id = v_uid
  returning * into v_row;

  return jsonb_build_object('ok', true, 'signature', to_jsonb(v_row));
end;
$$;

-- Retire (révoque) la signature active d'un document. Admin uniquement ; l'historique est conservé.
create or replace function public.revoke_document_signature(p_doc_type text, p_doc_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_auth();
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut retirer une signature.';
  end if;
  update public.document_signatures
    set revoked_at = now(), revoked_by = v_uid
    where doc_type = p_doc_type and doc_id = p_doc_id and revoked_at is null;
end;
$$;

-- ----------------------------------------------------------------------------
-- Droits d'exécution
-- ----------------------------------------------------------------------------
revoke execute on function public.signature_pin_is_valid(text) from public, anon, authenticated;
revoke execute on function public.check_signature_pin(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_my_signature() from public, anon;
revoke execute on function public.save_my_signature(text, text, text) from public, anon;
revoke execute on function public.reset_my_signature() from public, anon;
revoke execute on function public.sign_document(text, text, text) from public, anon;
revoke execute on function public.revoke_document_signature(text, text) from public, anon;

grant execute on function public.get_my_signature() to authenticated;
grant execute on function public.save_my_signature(text, text, text) to authenticated;
grant execute on function public.reset_my_signature() to authenticated;
grant execute on function public.sign_document(text, text, text) to authenticated;
grant execute on function public.revoke_document_signature(text, text) to authenticated;
