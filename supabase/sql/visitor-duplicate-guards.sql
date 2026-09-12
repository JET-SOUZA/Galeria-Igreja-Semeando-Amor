-- Keep visitor contacts canonical and reject new duplicate CPF/WhatsApp values
-- inside the same organization. Existing duplicate test records are preserved.

update public.visitors
set
  cpf = nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), ''),
  whatsapp = case
    when regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = '' then whatsapp
    when length(regexp_replace(whatsapp, '\D', '', 'g')) in (12, 13)
      and regexp_replace(whatsapp, '\D', '', 'g') like '55%'
      then substring(regexp_replace(whatsapp, '\D', '', 'g') from 3)
    else regexp_replace(whatsapp, '\D', '', 'g')
  end;

create index if not exists visitors_org_cpf_lookup_idx
  on public.visitors (organization_id, cpf)
  where cpf is not null and cpf <> '';

create index if not exists visitors_org_whatsapp_lookup_idx
  on public.visitors (organization_id, whatsapp)
  where whatsapp <> '' and whatsapp <> '-';

create schema if not exists private;

create or replace function private.enforce_visitor_unique_contacts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cpf_digits text;
  phone_digits text;
begin
  cpf_digits := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  phone_digits := regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g');

  if length(phone_digits) in (12, 13) and phone_digits like '55%' then
    phone_digits := substring(phone_digits from 3);
  end if;

  if cpf_digits <> '' then
    new.cpf := cpf_digits;
    -- Serialize registrations for the same contact so two simultaneous
    -- requests cannot both pass the existence check.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'visitor:cpf:' || coalesce(new.organization_id::text, '') || ':' || cpf_digits,
        0
      )
    );
    if exists (
      select 1
      from public.visitors existing
      where existing.organization_id is not distinct from new.organization_id
        and existing.id <> new.id
        and existing.cpf = cpf_digits
    ) then
      raise exception using
        errcode = '23505',
        message = 'VISITOR_DUPLICATE_CPF',
        constraint = 'visitors_org_cpf_guard';
    end if;
  else
    new.cpf := null;
  end if;

  if phone_digits <> '' then
    new.whatsapp := phone_digits;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'visitor:whatsapp:' || coalesce(new.organization_id::text, '') || ':' || phone_digits,
        0
      )
    );
    if exists (
      select 1
      from public.visitors existing
      where existing.organization_id is not distinct from new.organization_id
        and existing.id <> new.id
        and existing.whatsapp = phone_digits
    ) then
      raise exception using
        errcode = '23505',
        message = 'VISITOR_DUPLICATE_WHATSAPP',
        constraint = 'visitors_org_whatsapp_guard';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_visitor_unique_contacts() from public, anon, authenticated;

drop trigger if exists visitors_unique_contacts_guard on public.visitors;
create trigger visitors_unique_contacts_guard
before insert or update of organization_id, cpf, whatsapp
on public.visitors
for each row
execute function private.enforce_visitor_unique_contacts();
