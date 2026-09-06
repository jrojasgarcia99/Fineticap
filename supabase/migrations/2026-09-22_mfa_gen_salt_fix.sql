-- ============================================================================
-- FIX: mfa_generate_recovery_codes()/mfa_consume_recovery_code() usaban
-- gen_salt()/crypt() sin calificar — con search_path = '' (vacío, por
-- endurecimiento), Postgres no las encuentra: viven en el schema `extensions`
-- (confirmado con pg_extension), no en `public`. Error real:
-- "function gen_salt(unknown) does not exist".
-- ============================================================================
create or replace function mfa_generate_recovery_codes()
returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_codes text[] := '{}';
  v_code text;
  i int;
begin
  delete from public.mfa_recovery_codes where user_id = (select auth.uid());

  for i in 1..10 loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 10)
    );
    v_code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
    v_codes := array_append(v_codes, v_code);
    insert into public.mfa_recovery_codes (user_id, code_hash)
      values ((select auth.uid()), extensions.crypt(v_code, extensions.gen_salt('bf')));
  end loop;

  return v_codes;
end;
$$;

create or replace function mfa_consume_recovery_code(p_code text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id
    from public.mfa_recovery_codes
    where user_id = (select auth.uid())
      and used_at is null
      and code_hash = extensions.crypt(p_code, code_hash)
    limit 1;

  if v_id is null then
    return false;
  end if;

  update public.mfa_recovery_codes set used_at = now() where id = v_id;
  return true;
end;
$$;
