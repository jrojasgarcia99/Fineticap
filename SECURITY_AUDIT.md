# Auditoría de seguridad — RLS y privacidad de datos

Fecha: 2026-09-18/19. Alcance: aislamiento de datos por cuenta/hogar a nivel de
base de datos (Row Level Security), GRANTs de roles, y la página pública
`/seguridad`. No se tocó lógica de negocio ni estructura de tablas existentes.

## Nota de mapeo importante

El pedido original de esta auditoría mencionaba tablas `households` y
`household_members`. **Esas tablas ya no existen** — se eliminaron el
2026-09-01 (`supabase/migrations/2026-09-01_personal_spaces_y_familiar.sql`,
`drop table household_members cascade` / `drop table households cascade`)
cuando el proyecto migró del modelo "un hogar comparte todo" al actual:

- `personal_spaces` — espacio privado, 1 por cuenta (equivalente al viejo "household" pero privado, no compartido).
- `family_budgets` / `family_budget_members` — Presupuesto Familiar compartido, opcional (equivalente al viejo "household_members").

Esta auditoría se hizo sobre las tablas vigentes.

## 1. Tabla por tabla

| Tabla | RLS habilitado | Política restringe por dueño/miembro | Usa `(select auth.uid())` | Hallazgo / acción |
|---|---|---|---|---|
| `personal_spaces` | Sí | Sí (`owner_id`) | **No → corregido** | Las 4 políticas (select/insert/update/delete) comparaban `auth.uid()` directo. Reescritas. |
| `family_budgets` | Sí | Sí (vía `is_family_member()`) | N/A (no compara auth.uid() en la política misma) | Sin cambios necesarios. |
| `family_budget_members` | Sí | Sí | **No → corregido** en la política "leave" (`user_id = auth.uid()` directo) | Reescrita. |
| `family_budget_categories` | Sí | Sí (vía `is_family_member()`) | N/A | Sin cambios. |
| `family_budget_items` | Sí | Sí (vía `is_family_member()`) | N/A | Sin cambios. |
| `budget_items` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente (ver función) | Sin cambios en la política misma. |
| `personal_budget_categories` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente | — |
| `activos` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente | — |
| `pasivos` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente | — |
| `deudas` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente | — |
| `debt_payments` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente | — |
| `payment_methods` | Sí | Sí (`user_id`) | **No → corregido** | Comparaba `auth.uid()` directo en using y check. |
| `envelopes` | Sí | Sí (vía `owns_space()`/`is_family_member()`) | Corregido indirectamente | — |
| `envelope_movements` | Sí | Sí (subconsulta a `envelopes`) | N/A | Ver limitación conocida más abajo. |
| `assistant_usage` | Sí | Sí (vía `owns_space()`) | Corregido indirectamente | — |
| `rollover_log` | Sí | Sin política (solo accesible vía funciones `security definer`) | N/A | Correcto por diseño — nadie debería leerla directo. |

**Funciones `security definer` corregidas** (usadas como el mecanismo central
de las políticas de arriba): `owns_space(s_id)` e `is_family_member(fb_id)`.
Ambas comparaban `auth.uid()` directo dentro de su cuerpo — como se llaman en
cada fila evaluada por RLS, este era el punto de mayor impacto real en
rendimiento. Se reescribieron con `(select auth.uid())` y se les fijó
`set search_path = ''` (antes `'public'`), con sus referencias a tabla
completamente calificadas (`public.personal_spaces`, etc.) — más estricto
contra shadowing de objetos, sin cambiar su comportamiento.

## 2. Recursión entre políticas

Sin hallazgos que corregir en las tablas auditadas: ninguna política hace una
subconsulta directa hacia otra tabla protegida por RLS — todas pasan por
`owns_space()`/`is_family_member()`, que son `security definer` (el patrón
correcto para evitar recursión en Postgres/Supabase). No se creó ninguna
función nueva porque no hacía falta.

**Limitación conocida, fuera de este alcance, no corregida:**
`envelope_movements` sí hace un `EXISTS` directo contra `envelopes` (que tiene
su propia RLS) en vez de pasar por una función. No es un ciclo (no vuelve a
`envelope_movements`), así que no es un bug de seguridad, pero sí duplica la
evaluación de RLS de `envelopes` en cada fila. Si se quiere optimizar, se
puede envolver en una función `security definer` como las demás en una pasada
futura.

## 3. GRANTS de roles

No se tuvo acceso directo para consultar los GRANTS existentes en la base de
producción (sin conexión de base de datos disponible desde este entorno). Como
medida de endurecimiento explícita, se agregó un `REVOKE ALL ... FROM anon`
sobre las 16 tablas del módulo financiero (todas las de la tabla de arriba
salvo `family_budgets`/`family_budget_members`/`family_budget_categories`, que
también quedaron incluidas). Es defensa en profundidad: RLS ya bloqueaba a
`anon` (su `auth.uid()` es `null`), esto quita además el permiso de tabla.
No hay ninguna pantalla ni RPC en la app pensada para acceso anónimo sobre
estas tablas, así que este cambio no afecta ninguna funcionalidad existente.

## 4. Vistas (VIEWs)

No existe ninguna `VIEW` sobre estas tablas en el esquema actual
(`supabase/schema.sql` + `supabase/migrations/`). `security_invoker` no
aplica — nada que cambiar.

## 5. Página `/seguridad`

Publicada en `src/app/seguridad/page.tsx`, bilingüe (ES/EN), enlazada desde
`/privacidad` y `/terminos`. Explica: aislamiento por RLS, cifrado en
tránsito (TLS) y en reposo (infraestructura de Supabase), que la
certificación SOC 2 Tipo II es de Supabase como proveedor — no una
certificación propia de Finéticap como producto —, y que no se vende ni
comparte con terceros. Sin lenguaje de marketing exagerado.

## SQL aplicado

`supabase/migrations/2026-09-18_endurecimiento_rls.sql` (también anexado al
final de `supabase/schema.sql`). Ejecutado en producción y confirmado sin
errores por el usuario.

## Pendiente de tu parte

Ninguno para este tema puntual. La verificación manual de aislamiento
cruzado entre dos cuentas (descrita en el PR/commit correspondiente) sigue
disponible si en algún momento quieres volver a confirmarla manualmente.

## Adenda 2026-09-20/21 — incidente en producción con las políticas AAL2 de MFA

Al agregar 2FA (tarjeta "mfa"), las 13 políticas RESTRICTIVE que exigen AAL2
a quien tiene un factor verificado (parte de ese trabajo, no de esta
auditoría original) **rompieron el acceso normal de todas las cuentas**,
con o sin MFA activado — mandaban de vuelta a `/onboarding` a cuentas ya
configuradas. Causa: el patrón oficial de la documentación de Supabase hace
que la política lea `auth.mfa_factors` directamente, pero el rol
`authenticated` no tiene permiso de lectura sobre esa tabla interna en
proyectos actuales de Supabase (confirmado por la comunidad:
github.com/supabase/supabase/issues/17168) — la consulta fallaba con un
error de permisos, no con un simple "sin filas", y la app interpretaba ese
error como cuenta nueva.

**Corregido** reemplazando la lectura directa por una función
`security definer` (`mfa_user_requires_aal2()`, mismo patrón que
`owns_space()`/`is_family_member()`), que sí puede leer la tabla interna.
Probado tabla por tabla en producción antes de reaplicar a las 13. Ver
`supabase/migrations/2026-09-21_mfa_aal2_fix.sql`.

**Lección para la próxima vez que se copie una plantilla de RLS de la
documentación oficial de Supabase que referencie una tabla del schema
`auth`**: verificar primero si el rol `authenticated` tiene GRANT sobre
esa tabla (`select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'auth' and table_name = '...'`) — si no lo tiene,
envolver el acceso en una función `security definer` desde el principio,
en vez de aplicar la plantilla tal cual.
