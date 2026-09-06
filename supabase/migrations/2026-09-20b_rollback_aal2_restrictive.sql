-- ============================================================================
-- ROLLBACK DE EMERGENCIA — las políticas RESTRICTIVE de AAL2 del 2026-09-20
-- bloquearon el acceso normal (mandaba a cuentas ya onboardeadas de vuelta a
-- /onboarding). Se quitan mientras se investiga la causa exacta. El resto de
-- MFA (enroll/challenge/recovery codes) NO se toca — solo esto.
-- ============================================================================
drop policy if exists "require aal2 if mfa enrolled" on personal_spaces;
drop policy if exists "require aal2 if mfa enrolled" on family_budgets;
drop policy if exists "require aal2 if mfa enrolled" on family_budget_members;
drop policy if exists "require aal2 if mfa enrolled" on family_budget_categories;
drop policy if exists "require aal2 if mfa enrolled" on family_budget_items;
drop policy if exists "require aal2 if mfa enrolled" on budget_items;
drop policy if exists "require aal2 if mfa enrolled" on personal_budget_categories;
drop policy if exists "require aal2 if mfa enrolled" on activos;
drop policy if exists "require aal2 if mfa enrolled" on pasivos;
drop policy if exists "require aal2 if mfa enrolled" on deudas;
drop policy if exists "require aal2 if mfa enrolled" on debt_payments;
drop policy if exists "require aal2 if mfa enrolled" on payment_methods;
drop policy if exists "require aal2 if mfa enrolled" on envelopes;
drop policy if exists "require aal2 if mfa enrolled" on envelope_movements;
