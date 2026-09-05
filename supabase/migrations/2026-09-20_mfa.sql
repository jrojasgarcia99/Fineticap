-- ============================================================================
-- AUTENTICACIÓN DE DOS FACTORES (2FA/MFA) — TOTP nativo de Supabase Auth.
-- ============================================================================
-- MFA es OPCIONAL: quien no lo activa sigue en AAL1 con normalidad. Quien sí
-- activa un factor TOTP verificado queda obligado a alcanzar AAL2 para tocar
-- las tablas financieras (políticas restrictivas al final de este archivo).
--
-- Supabase no genera códigos de recuperación por sí solo — se implementan acá
-- con nuestra propia tabla, guardando solo el hash (pgcrypto `crypt`, nunca el
-- código en texto plano). El flujo de "perdí mi dispositivo" NO intenta
-- falsear AAL2 (no es posible: el claim `aal` viene firmado por GoTrue en el
-- JWT, ninguna función de Postgres puede emitirlo) — en vez de eso, un código
-- de recuperación válido autoriza a desactivar el factor TOTP vía el Admin
-- API de Supabase (`auth.admin.mfa.deleteFactor`, server-side con
-- service_role — es la única forma documentada de remover un factor sin ya
-- estar en AAL2, ver supabase.com/docs/reference/javascript/auth-admin-mfa-deletefactor).
-- Eso deja a la cuenta sin MFA (como perderlo intencionalmente), lista para
-- volver a activarlo con un dispositivo nuevo.
-- ============================================================================

create table if not exists mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mfa_recovery_codes_user_idx
  on mfa_recovery_codes (user_id) where used_at is null;

alter table mfa_recovery_codes enable row level security;

-- Solo lectura directa (para poder mostrar "te quedan N códigos"). Generar y
-- consumir códigos pasa SIEMPRE por las funciones security definer de abajo
-- — no hay políticas de insert/update/delete porque el cliente nunca debe
-- escribir esta tabla directamente.
drop policy if exists "own recovery codes" on mfa_recovery_codes;
create policy "own recovery codes" on mfa_recovery_codes
  for select using (user_id = (select auth.uid()));

-- Genera 10 códigos nuevos de un solo uso, invalidando cualquier set previo
-- (se borran, no se guardan "usados" de sets viejos). Devuelve los códigos en
-- texto plano — es la ÚNICA vez que existen sin hashear; el llamador debe
-- mostrarlos una sola vez y no puede volver a pedirlos (no se guarda el texto
-- plano en ningún lado).
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
    -- 10 caracteres en base32-ish (sin 0/O/1/I para evitar confusión visual),
    -- formateado XXXXX-XXXXX.
    v_code := (
      select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 10)
    );
    v_code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
    v_codes := array_append(v_codes, v_code);
    insert into public.mfa_recovery_codes (user_id, code_hash)
      values ((select auth.uid()), crypt(v_code, gen_salt('bf')));
  end loop;

  return v_codes;
end;
$$;

-- Verifica un código de recuperación y lo marca usado (de un solo uso). No
-- toca auth.mfa_factors — eso lo hace el servidor por separado con el Admin
-- API tras confirmar aquí que el código es válido.
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
      and code_hash = crypt(p_code, code_hash)
    limit 1;

  if v_id is null then
    return false;
  end if;

  update public.mfa_recovery_codes set used_at = now() where id = v_id;
  return true;
end;
$$;

-- ============================================================================
-- Exigir AAL2 a quien tenga un factor TOTP verificado (opt-in — quien no
-- activó MFA sigue en AAL1 con normalidad). Patrón oficial de Supabase:
-- supabase.com/docs/guides/auth/auth-mfa (sección "Enforce Rules for MFA Logins").
-- IMPORTANTE: son políticas RESTRICTIVE — se combinan con AND sobre las
-- políticas PERMISSIVE ya existentes, no las reemplazan ni las debilitan.
-- ============================================================================
create policy "require aal2 if mfa enrolled" on personal_spaces
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on family_budgets
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on family_budget_members
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on family_budget_categories
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on family_budget_items
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on budget_items
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on personal_budget_categories
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on activos
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on pasivos
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on deudas
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on debt_payments
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on payment_methods
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on envelopes
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));

create policy "require aal2 if mfa enrolled" on envelope_movements
  as restrictive for all to authenticated
  using (array[(select auth.jwt()->>'aal')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1','aal2'] end
    from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'));
