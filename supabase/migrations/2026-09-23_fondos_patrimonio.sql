-- ============================================================================
-- FONDOS — Patrimonio alimentado por Ahorro/Inversión, personal y compartido.
-- ============================================================================
-- Decisiones acordadas con el usuario (ver tarjeta "patrimonio" del tablero):
--  - Una línea de budget_items (ahorros/inversion) se distribuye a UN solo
--    fondo (no split N:M) — simplifica "editar ajusta el fondo" y la UI.
--  - Fondos compartidos (scope_type='family'): mismo patrón que envelopes/
--    sobres — cada miembro aporta por separado desde su propio presupuesto
--    personal, apuntando al fondo familiar; queda registrado quién aportó
--    qué (created_by).
--  - tasa_retorno_estimada/plazo_proyeccion_anios son SOLO para la
--    calculadora ilustrativa de interés compuesto — nunca entran al saldo
--    real ni al patrimonio.
--  - Líneas de ahorro/inversión previas a este cambio, nunca distribuidas,
--    quedan intactas pero no cuentan para ningún fondo (arranca de cero).
-- ============================================================================

create table if not exists fondos (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('personal','family')),
  space_id uuid references personal_spaces(id) on delete cascade,
  family_budget_id uuid references family_budgets(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ahorro','inversion','emergencia','gasto_anual')),
  moneda text not null check (moneda in ('CRC','USD')),
  porcentaje_ahorro numeric not null default 0,
  porcentaje_inversion numeric not null default 0,
  tasa_retorno_estimada numeric,
  plazo_proyeccion_anios int check (plazo_proyeccion_anios in (10,15,20,25,30)),
  orden int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'personal' and space_id is not null and family_budget_id is null)
    or (scope_type = 'family' and family_budget_id is not null and space_id is null)
  )
);
alter table fondos enable row level security;
create policy "fondos access" on fondos for all
  using (
    (scope_type = 'personal' and owns_space(space_id))
    or (scope_type = 'family' and is_family_member(family_budget_id))
  )
  with check (
    (scope_type = 'personal' and owns_space(space_id))
    or (scope_type = 'family' and is_family_member(family_budget_id))
  );
create index if not exists fondos_space_idx on fondos (space_id);
create index if not exists fondos_family_idx on fondos (family_budget_id);

create table if not exists fondo_movimientos (
  id uuid primary key default gen_random_uuid(),
  fondo_id uuid not null references fondos(id) on delete cascade,
  tipo text not null check (tipo in ('aporte_presupuesto','rendimiento')),
  monto numeric not null,
  moneda text not null check (moneda in ('CRC','USD')),
  anio int not null,
  mes int not null check (mes between 1 and 12),
  budget_item_id uuid references budget_items(id) on delete set null,
  descripcion text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (budget_item_id)
);
alter table fondo_movimientos enable row level security;
create policy "fondo movimientos access" on fondo_movimientos for all
  using (exists (select 1 from fondos f where f.id = fondo_id and (
    (f.scope_type = 'personal' and owns_space(f.space_id))
    or (f.scope_type = 'family' and is_family_member(f.family_budget_id)))))
  with check (exists (select 1 from fondos f where f.id = fondo_id and (
    (f.scope_type = 'personal' and owns_space(f.space_id))
    or (f.scope_type = 'family' and is_family_member(f.family_budget_id)))));
create index if not exists fondo_movimientos_fondo_idx on fondo_movimientos (fondo_id, anio, mes);

-- Protege del DELETE cualquier línea de budget_items ya distribuida a un
-- fondo — a nivel de base de datos, no solo un aviso en pantalla. La UI
-- ofrece "editar el monto" en su lugar (ver acción distribuirAFondo /
-- editarLineaDistribuida en el server action).
create or replace function prevent_delete_distributed_budget_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.fondo_movimientos where budget_item_id = old.id) then
    raise exception 'BUDGET_ITEM_DISTRIBUTED_TO_FUND';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_prevent_delete_distributed_budget_item on budget_items;
create trigger trg_prevent_delete_distributed_budget_item
  before delete on budget_items
  for each row execute function prevent_delete_distributed_budget_item();

-- Total de fondos PERSONALES de cada miembro del Presupuesto Familiar, por
-- moneda (para el agregado de Patrimonio Familiar) — solo el total, nunca el
-- detalle de sus fondos individuales (misma línea de privacidad que ya usa
-- family_budget_roster() con el salario).
create or replace function family_patrimonio_roster()
returns table (user_id uuid, display_name text, total_crc numeric, total_usd numeric)
language sql security definer set search_path = public as $$
  select
    m.user_id,
    coalesce(ps.display_name, ''),
    coalesce((
      select sum(fm.monto) from fondo_movimientos fm join fondos f on f.id = fm.fondo_id
      where f.scope_type = 'personal' and f.space_id = ps.id and fm.moneda = 'CRC'
    ), 0),
    coalesce((
      select sum(fm.monto) from fondo_movimientos fm join fondos f on f.id = fm.fondo_id
      where f.scope_type = 'personal' and f.space_id = ps.id and fm.moneda = 'USD'
    ), 0)
  from family_budget_members m
  left join personal_spaces ps on ps.owner_id = m.user_id
  where m.family_budget_id = (
    select family_budget_id from family_budget_members where user_id = auth.uid() limit 1
  )
  order by m.joined_at;
$$;

revoke all on table fondos, fondo_movimientos from anon;
