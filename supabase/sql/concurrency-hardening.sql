-- Protecoes aditivas para compras, uploads e busca facial concorrentes.
-- Este script nao remove nem modifica fotos, arquivos ou pedidos existentes.

create unique index if not exists payment_orders_pending_checkout_fingerprint_uidx
  on public.payment_orders ((metadata ->> 'checkout_fingerprint'))
  where status = 'pending'
    and purpose = 'event_purchase'
    and metadata ? 'checkout_fingerprint';

create or replace function public.reserve_photo_purchase_order(
  p_organization_id uuid,
  p_event_id uuid,
  p_visitor_id uuid,
  p_amount numeric,
  p_items jsonb,
  p_token_hash text,
  p_event_slug text,
  p_checkout_fingerprint text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
  v_created boolean := false;
begin
  if coalesce(p_checkout_fingerprint, '') = '' then
    raise exception 'CHECKOUT_FINGERPRINT_REQUIRED';
  end if;

  -- Serializa somente compras com o mesmo visitante, evento e carrinho.
  perform pg_advisory_xact_lock(hashtextextended(p_checkout_fingerprint, 0));

  select *
    into v_order
    from public.payment_orders
   where event_id = p_event_id
     and visitor_id = p_visitor_id
     and purpose = 'event_purchase'
     and status = 'pending'
     and metadata ->> 'checkout_fingerprint' = p_checkout_fingerprint
   order by created_at desc
   limit 1
   for update;

  if found then
    update public.payment_orders
       set metadata = jsonb_set(
             metadata,
             '{public_token_hashes}',
             (
               select coalesce(jsonb_agg(recent.value), '[]'::jsonb)
                 from (
                   select entry.value
                     from jsonb_array_elements(
                       case
                         when coalesce(metadata -> 'public_token_hashes', '[]'::jsonb) @> jsonb_build_array(p_token_hash)
                           then coalesce(metadata -> 'public_token_hashes', '[]'::jsonb)
                         else coalesce(metadata -> 'public_token_hashes', '[]'::jsonb) || jsonb_build_array(p_token_hash)
                       end
                     ) with ordinality as entry(value, position)
                    order by entry.position desc
                    limit 20
                 ) as recent
             ),
             true
           ),
           updated_at = now()
     where id = v_order.id
     returning * into v_order;

    return jsonb_build_object('created', false, 'order', to_jsonb(v_order));
  end if;

  insert into public.payment_orders (
    organization_id,
    event_id,
    visitor_id,
    provider,
    status,
    amount,
    platform_fee_amount,
    organization_net_amount,
    payment_method,
    items,
    purpose,
    metadata
  ) values (
    p_organization_id,
    p_event_id,
    p_visitor_id,
    'asaas',
    'pending',
    p_amount,
    0,
    p_amount,
    'UNDEFINED',
    p_items,
    'event_purchase',
    jsonb_build_object(
      'public_token_hash', p_token_hash,
      'event_slug', p_event_slug,
      'checkout_fingerprint', p_checkout_fingerprint
    )
  )
  returning * into v_order;

  v_created := true;
  return jsonb_build_object('created', v_created, 'order', to_jsonb(v_order));
end;
$$;

revoke all on function public.reserve_photo_purchase_order(uuid, uuid, uuid, numeric, jsonb, text, text, text) from public;
revoke all on function public.reserve_photo_purchase_order(uuid, uuid, uuid, numeric, jsonb, text, text, text) from anon;
revoke all on function public.reserve_photo_purchase_order(uuid, uuid, uuid, numeric, jsonb, text, text, text) from authenticated;
grant execute on function public.reserve_photo_purchase_order(uuid, uuid, uuid, numeric, jsonb, text, text, text) to service_role;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

create table if not exists private.face_search_rate_limits (
  event_id uuid not null,
  limiter_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (event_id, limiter_key, window_start)
);

create index if not exists face_search_rate_limits_window_idx
  on private.face_search_rate_limits (window_start);

revoke all on private.face_search_rate_limits from public;
revoke all on private.face_search_rate_limits from anon;
revoke all on private.face_search_rate_limits from authenticated;
grant select, insert, update, delete on private.face_search_rate_limits to service_role;

create or replace function public.check_face_search_rate_limit(
  p_event_id uuid,
  p_client_key text,
  p_client_limit integer default 30,
  p_event_limit integer default 120
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_client_count integer;
  v_event_count integer;
  v_retry_after integer := greatest(1, 60 - extract(second from now())::integer);
begin
  delete from private.face_search_rate_limits
   where window_start < now() - interval '2 days';

  insert into private.face_search_rate_limits(event_id, limiter_key, window_start, request_count, updated_at)
  values (p_event_id, 'client:' || p_client_key, v_window, 1, now())
  on conflict (event_id, limiter_key, window_start)
  do update set request_count = private.face_search_rate_limits.request_count + 1, updated_at = now()
  returning request_count into v_client_count;

  insert into private.face_search_rate_limits(event_id, limiter_key, window_start, request_count, updated_at)
  values (p_event_id, 'event', v_window, 1, now())
  on conflict (event_id, limiter_key, window_start)
  do update set request_count = private.face_search_rate_limits.request_count + 1, updated_at = now()
  returning request_count into v_event_count;

  return jsonb_build_object(
    'allowed', v_client_count <= greatest(1, p_client_limit) and v_event_count <= greatest(1, p_event_limit),
    'retry_after', v_retry_after,
    'client_count', v_client_count,
    'event_count', v_event_count
  );
end;
$$;

revoke all on function public.check_face_search_rate_limit(uuid, text, integer, integer) from public;
revoke all on function public.check_face_search_rate_limit(uuid, text, integer, integer) from anon;
revoke all on function public.check_face_search_rate_limit(uuid, text, integer, integer) from authenticated;
grant execute on function public.check_face_search_rate_limit(uuid, text, integer, integer) to service_role;
