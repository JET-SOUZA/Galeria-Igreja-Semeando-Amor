-- Conta somente os originais que pertencem ao backend informado.
-- Fotos antigas sem backend_id continuam atribuídas pelo provider legado.
create index if not exists photos_original_backend_event_idx
  on public.photos (original_storage_backend_id, event_id)
  where deleted_at is null and original_storage_path is not null;

create index if not exists photos_legacy_provider_event_idx
  on public.photos (original_storage_provider, event_id)
  where deleted_at is null
    and original_storage_path is not null
    and original_storage_backend_id is null;

create or replace function public.storage_backend_usage(p_backend_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_bytes bigint;
  v_objects bigint;
begin
  select b.provider into v_provider
  from public.storage_backends b
  where b.id = p_backend_id;

  if v_provider is null then
    raise exception 'STORAGE_BACKEND_NOT_FOUND';
  end if;

  with matched as (
    select coalesce(p.original_bytes, p.bytes, 0) as size_bytes
    from public.photos p
    where p.deleted_at is null
      and p.original_storage_path is not null
      and p.original_storage_backend_id = p_backend_id
    union all
    select coalesce(p.original_bytes, p.bytes, 0) as size_bytes
    from public.photos p
    where p.deleted_at is null
      and p.original_storage_path is not null
      and p.original_storage_backend_id is null
      and p.original_storage_provider = v_provider
  )
  select coalesce(sum(size_bytes), 0), count(*)
    into v_bytes, v_objects
  from matched;

  return jsonb_build_object('bytes', v_bytes, 'objects', v_objects);
end;
$$;

create or replace function public.event_storage_backend_usage(p_event_id uuid, p_backend_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_bytes bigint;
  v_objects bigint;
begin
  select b.provider into v_provider
  from public.storage_backends b
  where b.id = p_backend_id;

  if v_provider is null then
    raise exception 'STORAGE_BACKEND_NOT_FOUND';
  end if;

  with matched as (
    select coalesce(p.original_bytes, p.bytes, 0) as size_bytes
    from public.photos p
    where p.event_id = p_event_id
      and p.deleted_at is null
      and p.original_storage_path is not null
      and p.original_storage_backend_id = p_backend_id
    union all
    select coalesce(p.original_bytes, p.bytes, 0) as size_bytes
    from public.photos p
    where p.event_id = p_event_id
      and p.deleted_at is null
      and p.original_storage_path is not null
      and p.original_storage_backend_id is null
      and p.original_storage_provider = v_provider
  )
  select coalesce(sum(size_bytes), 0), count(*)
    into v_bytes, v_objects
  from matched;

  return jsonb_build_object('bytes', v_bytes, 'objects', v_objects);
end;
$$;

revoke all on function public.storage_backend_usage(uuid) from public;
revoke all on function public.event_storage_backend_usage(uuid, uuid) from public;
grant execute on function public.storage_backend_usage(uuid) to service_role;
grant execute on function public.event_storage_backend_usage(uuid, uuid) to service_role;
