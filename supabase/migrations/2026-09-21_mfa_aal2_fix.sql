-- ============================================================================
-- FIX: las 13 políticas RESTRICTIVE de AAL2 del 2026-09-20 rompían el acceso
-- normal de TODAS las cuentas (con o sin MFA activado) — el rol `authenticated`
-- no tiene (ni puede tener fácilmente) permiso de lectura sobre `auth.mfa_factors`,
-- una tabla interna que Supabase bloquea a propósito fuera de los roles de la
-- API. La política intentaba leerla directo, Postgres respondía con un error
-- de permisos en vez de simplemente filtrar filas, y la app trataba ese error
-- como "no hay datos" (mandaba de vuelta a /onboarding a cuentas ya
-- configuradas). Confirmado también por la comunidad de Supabase:
-- github.com/supabase/supabase/issues/17168 — la plantilla oficial de la doc
-- da por hecho un acceso que los proyectos actuales no tienen por defecto.
--
-- Este archivo reemplaza esas 13 políticas por una versión que llama a una
-- función `security definer` (mfa_user_requires_aal2) en vez de leer
-- auth.mfa_factors directo desde la política — mismo patrón que ya usan
-- owns_space()/is_family_member() para exactamente este tipo de problema.
-- Probado en producción, tabla por tabla, antes de re-aplicar a las 13.
-- ============================================================================

create or replace function mfa_user_requires_aal2()
returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  );
$$;

drop policy if exists "require aal2 if mfa enrolled" on personal_spaces;
create policy "require aal2 if mfa enrolled" on personal_spaces
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on family_budgets;
create policy "require aal2 if mfa enrolled" on family_budgets
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on family_budget_members;
create policy "require aal2 if mfa enrolled" on family_budget_members
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on family_budget_categories;
create policy "require aal2 if mfa enrolled" on family_budget_categories
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on family_budget_items;
create policy "require aal2 if mfa enrolled" on family_budget_items
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on budget_items;
create policy "require aal2 if mfa enrolled" on budget_items
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on personal_budget_categories;
create policy "require aal2 if mfa enrolled" on personal_budget_categories
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on activos;
create policy "require aal2 if mfa enrolled" on activos
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on pasivos;
create policy "require aal2 if mfa enrolled" on pasivos
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on deudas;
create policy "require aal2 if mfa enrolled" on deudas
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on debt_payments;
create policy "require aal2 if mfa enrolled" on debt_payments
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on payment_methods;
create policy "require aal2 if mfa enrolled" on payment_methods
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on envelopes;
create policy "require aal2 if mfa enrolled" on envelopes
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "require aal2 if mfa enrolled" on envelope_movements;
create policy "require aal2 if mfa enrolled" on envelope_movements
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');
