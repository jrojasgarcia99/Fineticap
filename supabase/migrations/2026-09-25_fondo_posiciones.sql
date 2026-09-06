-- ============================================================================
-- POSICIONES dentro de un fondo — diversificación (ej. un fondo "Inversión"
-- con 20% S&P 500, 40% Nasdaq, 40% BTC, cada una con su propia tasa
-- estimada). Decisiones acordadas con el usuario:
--  - La tasa/plazo del FONDO deja de usarse una vez que tiene posiciones —
--    la proyección del fondo pasa a ser la suma de la proyección de cada
--    posición (cada una a su propia tasa/plazo). Sin posiciones, el fondo
--    sigue funcionando exactamente igual que antes (tasa/plazo propios).
--  - Al distribuir una línea de Ahorro/Inversión a un fondo CON posiciones,
--    el monto se reparte automático según el % de cada una (editable a
--    mano ese mes antes de confirmar).
--  - Un rendimiento/dividendo puede cargarse a una posición específica O al
--    fondo en general (posicion_id nulo).
-- ============================================================================

create table if not exists fondo_posiciones (
  id uuid primary key default gen_random_uuid(),
  fondo_id uuid not null references fondos(id) on delete cascade,
  nombre text not null,
  porcentaje numeric not null default 0,
  tasa_retorno_estimada numeric,
  plazo_proyeccion_anios int check (plazo_proyeccion_anios in (10,15,20,25,30)),
  orden int not null default 0,
  created_at timestamptz not null default now()
);
alter table fondo_posiciones enable row level security;
create policy "fondo posiciones access" on fondo_posiciones for all
  using (exists (select 1 from fondos f where f.id = fondo_id and (
    (f.scope_type = 'personal' and owns_space(f.space_id))
    or (f.scope_type = 'family' and is_family_member(f.family_budget_id)))))
  with check (exists (select 1 from fondos f where f.id = fondo_id and (
    (f.scope_type = 'personal' and owns_space(f.space_id))
    or (f.scope_type = 'family' and is_family_member(f.family_budget_id)))));
create index if not exists fondo_posiciones_fondo_idx on fondo_posiciones (fondo_id, orden);

alter table fondo_movimientos
  add column if not exists posicion_id uuid references fondo_posiciones(id) on delete set null;
create index if not exists fondo_movimientos_posicion_idx on fondo_movimientos (posicion_id);

-- Antes, una línea de presupuesto solo podía ir a UN fondo completo (1 fila).
-- Ahora, si el fondo tiene posiciones, una línea se reparte en VARIAS filas
-- (una por posición) — hace falta permitir más de una fila por
-- budget_item_id. La protección contra duplicados accidentales pasa al
-- server action (revisa antes de insertar), no a esta constraint.
alter table fondo_movimientos drop constraint if exists fondo_movimientos_budget_item_id_key;

revoke all on table fondo_posiciones from anon;
