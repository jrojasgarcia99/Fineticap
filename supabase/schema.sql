-- ============================================================================
-- Finéticap · Presupuesto — esquema de base de datos (Supabase / Postgres)
-- ============================================================================
-- Modelo:
--   * personal_spaces  — 1 fila por cuenta. Espacio PRIVADO: perfil (nombre +
--     salario) y toda la configuración (monedas, metas, fondo, tipo de cambio).
--     Presupuesto, Patrimonio, Deudas y Fondo cuelgan de aquí (space_id) y solo
--     los ve/edita su dueño.
--   * family_budgets (+ members / categories / items) — Presupuesto Familiar
--     compartido OPCIONAL, con su propio código de invitación y su propia
--     configuración de monedas.
--
-- Instalación nueva: pega TODO este archivo en el SQL Editor y "Run".
-- (Para migrar una base que ya está en producción NO se usa este archivo: ver
--  los bloques incrementales que entrega el equipo.)
-- ============================================================================

create extension if not exists "pgcrypto";

create or replace function generate_invite_code()
returns text language sql as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

-- ----------------------------------------------------------------------------
-- ESPACIO PERSONAL — 1 por cuenta
-- ----------------------------------------------------------------------------
create table if not exists personal_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  salario_mensual numeric not null default 0,   -- monto fijo (si salario_fuente = 'fijo')
  -- fuente del "salario" para el reparto del Presupuesto Familiar
  salario_fuente text not null default 'disponible' check (salario_fuente in ('disponible','fijo')),
  created_at timestamptz not null default now(),

  -- Perfil  (display_name = nombre preferido, el que se muestra en la app)
  segundo_nombre text,
  apellidos text,
  profesion text,                   -- clave de la lista PROFESIONES
  genero text check (genero in ('masculino','femenino','otro','no_decir')),
  fecha_nacimiento date,            -- la edad de Patrimonio se deriva de acá
  avatar_path text,                 -- objeto en el bucket de Storage 'avatars'

  -- Monedas: por ahora Colones (CRC) y Dólares (USD).
  monedas_activas text[] not null default array['CRC']::text[],
  moneda_primaria text not null default 'CRC' check (moneda_primaria in ('CRC','USD')),
  -- Unidades de la moneda primaria por 1 unidad de la secundaria (₡ por $1 con
  -- primaria = CRC). Se edita desde el control fijo arriba a la derecha.
  tipo_cambio numeric not null default 0,

  -- Meta de Deuda (% del ingreso disponible). El resto de metas por categoría
  -- viven en personal_budget_categories (ver más abajo).
  meta_deuda numeric not null default 0.15,

  meses_fondo_basico int not null default 3,
  meses_fondo_ideal int not null default 6,
  fondo_acumulado numeric not null default 0,
  pago_extra_base numeric not null default 0,
  idioma text not null default 'es' check (idioma in ('es','en')),
  -- Tema de color (cada uno con variante clara y oscura). El claro/oscuro es
  -- aparte y vive sólo en el navegador (localStorage 'theme').
  tema text not null default 'clasico'
    check (tema in ('clasico','rosa','lavanda','menta','cielo','arena')),
  -- Asistente IA: instrucciones / conocimiento libre que la persona escribe; se
  -- inyecta en el system prompt de sus conversaciones.
  asistente_instrucciones text,
  -- Orden del menú a gusto (arreglo de rutas). NULL = orden por defecto.
  -- La 1ª ruta es la pantalla de inicio; las primeras 5 salen en la barra móvil.
  nav_order text[],
  -- Cuándo aceptó Términos/Privacidad en el onboarding. NULL = cuenta previa a
  -- este campo (no se le pide retroactivamente).
  terminos_aceptados_at timestamptz,

  constraint personal_spaces_monedas_activas_valid
    check (monedas_activas <@ array['CRC','USD'] and array_length(monedas_activas, 1) >= 1)
);

-- ----------------------------------------------------------------------------
-- PRESUPUESTO FAMILIAR (compartido, opcional)
-- ----------------------------------------------------------------------------
create table if not exists family_budgets (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  monedas_activas text[] not null default array['CRC']::text[],
  moneda_primaria text not null default 'CRC' check (moneda_primaria in ('CRC','USD')),
  tipo_cambio numeric not null default 0,
  constraint family_budgets_monedas_activas_valid
    check (monedas_activas <@ array['CRC','USD'] and array_length(monedas_activas, 1) >= 1)
);

create table if not exists family_budget_members (
  id uuid primary key default gen_random_uuid(),
  family_budget_id uuid not null references family_budgets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id),                       -- una cuenta = a lo sumo un familiar
  unique (family_budget_id, user_id)
);

create table if not exists family_budget_categories (
  id uuid primary key default gen_random_uuid(),
  family_budget_id uuid not null references family_budgets(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (family_budget_id, nombre)
);

create table if not exists family_budget_items (
  id uuid primary key default gen_random_uuid(),
  family_budget_id uuid not null references family_budgets(id) on delete cascade,
  categoria text not null,                 -- nombre libre (normalmente una categoría)
  concepto text not null,
  monto numeric not null default 0,
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  automatico boolean not null default false,
  recurrente boolean not null default false,
  orden int not null default 0,
  mes int not null check (mes between 1 and 12),
  anio int not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists family_budget_items_mes_idx
  on family_budget_items (family_budget_id, anio, mes);

-- ----------------------------------------------------------------------------
-- MÓDULOS PERSONALES — cuelgan de personal_spaces (space_id)
-- ----------------------------------------------------------------------------
create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references personal_spaces(id) on delete cascade,
  -- Una `clave`: 'ingresos', 'rebajos' (estructurales) o un
  -- personal_budget_categories.clave. Sin check: la lista es editable.
  categoria text not null,
  concepto text not null,
  monto numeric not null default 0,
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  automatico boolean not null default false,
  recurrente boolean not null default false,
  orden int not null default 0,
  mes int not null check (mes between 1 and 12),
  anio int not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists budget_items_space_mes_idx
  on budget_items (space_id, anio, mes);

-- Categorías del presupuesto personal (editables). Ingresos/Rebajos no están
-- acá (son estructurales en el código); Deuda tampoco (deriva de `deudas`).
create table if not exists personal_budget_categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references personal_spaces(id) on delete cascade,
  clave text not null,
  nombre text not null,
  tipo text not null check (tipo in ('maximo','minimo')),
  meta numeric not null default 0,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (space_id, clave)
);
alter table personal_budget_categories enable row level security;
create policy "own personal categories" on personal_budget_categories
  for all using (owns_space(space_id)) with check (owns_space(space_id));
create index if not exists personal_budget_categories_space_idx
  on personal_budget_categories (space_id, orden);

create table if not exists activos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references personal_spaces(id) on delete cascade,
  concepto text not null,
  valor numeric not null default 0,
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  created_at timestamptz not null default now()
);

create table if not exists pasivos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references personal_spaces(id) on delete cascade,
  concepto text not null,
  valor numeric not null default 0,
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  created_at timestamptz not null default now()
);

create table if not exists deudas (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references personal_spaces(id) on delete cascade,
  nombre text not null,
  institucion text,
  monto_original numeric not null default 0,
  saldo_actual numeric not null default 0,
  tasa_interes_anual numeric not null default 0,
  cuota_minima numeric not null default 0,
  moneda text not null default 'CRC' check (moneda in ('CRC','USD')),
  fecha_inicio date,
  estado text not null default 'Activa' check (estado in ('Activa','Pagada')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- SEGURIDAD (Row Level Security)
-- ============================================================================
alter table personal_spaces          enable row level security;
alter table family_budgets           enable row level security;
alter table family_budget_members    enable row level security;
alter table family_budget_categories enable row level security;
alter table family_budget_items      enable row level security;
alter table budget_items             enable row level security;
alter table activos                  enable row level security;
alter table pasivos                  enable row level security;
alter table deudas                   enable row level security;

create or replace function owns_space(s_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from personal_spaces where id = s_id and owner_id = auth.uid());
$$;

create or replace function is_family_member(fb_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from family_budget_members where family_budget_id = fb_id and user_id = auth.uid());
$$;

-- Nombres + salarios de los co-miembros (sus espacios personales son privados).
create or replace function family_budget_roster()
returns table (user_id uuid, display_name text, salario_mensual numeric,
               salario_fuente text, joined_at timestamptz)
language sql security definer set search_path = public as $$
  select m.user_id,
         coalesce(ps.display_name, ''),
         coalesce(ps.salario_mensual, 0),
         coalesce(ps.salario_fuente, 'disponible'),
         m.joined_at
  from family_budget_members m
  left join personal_spaces ps on ps.owner_id = m.user_id
  where m.family_budget_id = (
    select family_budget_id from family_budget_members where user_id = auth.uid() limit 1
  )
  order by m.joined_at;
$$;

-- Ingreso Disponible por miembro y por mes (para el reparto dinámico).
create or replace function family_member_disponible()
returns table (user_id uuid, anio int, mes int, disponible numeric)
language sql security definer set search_path = public as $$
  select m.user_id, bi.anio, bi.mes,
    coalesce(sum(bi.monto) filter (where bi.categoria = 'ingresos'), 0)
    - coalesce(sum(bi.monto) filter (where bi.categoria = 'rebajos'), 0)
  from family_budget_members m
  join personal_spaces ps on ps.owner_id = m.user_id
  join budget_items bi on bi.space_id = ps.id and bi.categoria in ('ingresos','rebajos')
  where m.family_budget_id = (
    select family_budget_id from family_budget_members where user_id = auth.uid() limit 1
  )
  group by m.user_id, bi.anio, bi.mes;
$$;

-- personal_spaces: cada quien, el suyo
create policy "own personal space - select" on personal_spaces for select using (owner_id = auth.uid());
create policy "own personal space - insert" on personal_spaces for insert with check (owner_id = auth.uid());
create policy "own personal space - update" on personal_spaces for update using (owner_id = auth.uid());
create policy "own personal space - delete" on personal_spaces for delete using (owner_id = auth.uid());

-- módulos personales
create policy "own budget items" on budget_items for all
  using (owns_space(space_id)) with check (owns_space(space_id));
create policy "own activos" on activos for all
  using (owns_space(space_id)) with check (owns_space(space_id));
create policy "own pasivos" on pasivos for all
  using (owns_space(space_id)) with check (owns_space(space_id));
create policy "own deudas" on deudas for all
  using (owns_space(space_id)) with check (owns_space(space_id));

-- presupuesto familiar
create policy "family budget - select" on family_budgets for select using (is_family_member(id));
create policy "family budget - update" on family_budgets for update using (is_family_member(id));
create policy "family members - select" on family_budget_members for select using (is_family_member(family_budget_id));
create policy "family members - leave" on family_budget_members for delete using (user_id = auth.uid());
create policy "family categories" on family_budget_categories for all
  using (is_family_member(family_budget_id)) with check (is_family_member(family_budget_id));
create policy "family items" on family_budget_items for all
  using (is_family_member(family_budget_id)) with check (is_family_member(family_budget_id));

-- ============================================================================
-- RPCs del Presupuesto Familiar
-- ============================================================================
create or replace function create_family_budget()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  code text;
  cfg record;
begin
  if exists (select 1 from family_budget_members where user_id = auth.uid()) then
    raise exception 'ALREADY_LINKED';
  end if;
  select monedas_activas, moneda_primaria, tipo_cambio into cfg
    from personal_spaces where owner_id = auth.uid();
  code := generate_invite_code();
  insert into family_budgets (invite_code, created_by, monedas_activas, moneda_primaria, tipo_cambio)
    values (code, auth.uid(),
            coalesce(cfg.monedas_activas, array['CRC']::text[]),
            coalesce(cfg.moneda_primaria, 'CRC'),
            coalesce(cfg.tipo_cambio, 0))
    returning id into new_id;
  insert into family_budget_members (family_budget_id, user_id) values (new_id, auth.uid());
  insert into family_budget_categories (family_budget_id, nombre, orden) values
    (new_id, 'Vivienda', 1),
    (new_id, 'Servicios Públicos', 2),
    (new_id, 'Supermercado', 3),
    (new_id, 'Transporte del Hogar', 4),
    (new_id, 'Mantenimiento', 5),
    (new_id, 'Seguros del Hogar', 6),
    (new_id, 'Otros', 7);
  return new_id;
end;
$$;

create or replace function join_family_budget(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  fb_id uuid;
  fb_primaria text;
  my_primaria text;
begin
  if exists (select 1 from family_budget_members where user_id = auth.uid()) then
    raise exception 'ALREADY_LINKED';
  end if;
  select id, moneda_primaria into fb_id, fb_primaria
    from family_budgets where invite_code = upper(join_family_budget.code);
  if fb_id is null then
    raise exception 'INVALID_CODE';
  end if;
  select moneda_primaria into my_primaria from personal_spaces where owner_id = auth.uid();
  if coalesce(my_primaria, 'CRC') <> coalesce(fb_primaria, 'CRC') then
    raise exception 'CURRENCY_MISMATCH';
  end if;
  insert into family_budget_members (family_budget_id, user_id)
    values (fb_id, auth.uid()) on conflict (user_id) do nothing;
  return fb_id;
end;
$$;

create or replace function leave_family_budget()
returns void language plpgsql security definer set search_path = public as $$
declare fb uuid;
begin
  select family_budget_id into fb from family_budget_members where user_id = auth.uid();
  if fb is null then return; end if;
  delete from family_budget_members where user_id = auth.uid();
  if not exists (select 1 from family_budget_members where family_budget_id = fb) then
    delete from family_budgets where id = fb;  -- cascade limpia categorías e items
  end if;
end;
$$;

-- ============================================================================
-- ROLLOVER MENSUAL — copia de líneas recurrentes + pago real de deudas
-- (ver supabase/migrations/2026-09-03_rollover_mensual.sql para los detalles)
-- ============================================================================
create table if not exists rollover_log (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('personal','family')),
  scope_id uuid not null,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  ran_at timestamptz not null default now(),
  unique (scope_type, scope_id, anio, mes)
);
alter table rollover_log enable row level security;  -- solo funciones SECURITY DEFINER

-- Historial de pagos de deudas (interés vs capital por mes) — lo escribe rollover_debts.
create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  deuda_id uuid not null references deudas(id) on delete cascade,
  space_id uuid not null references personal_spaces(id) on delete cascade,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  interes numeric not null default 0,
  capital numeric not null default 0,
  extra_aplicado numeric not null default 0,
  saldo_resultante numeric not null default 0,
  moneda text not null,
  created_at timestamptz not null default now(),
  unique (deuda_id, anio, mes)
);
alter table debt_payments enable row level security;
create policy "own debt payments" on debt_payments for select using (owns_space(space_id));
create policy "own debt payments - delete" on debt_payments for delete using (owns_space(space_id));
create index if not exists debt_payments_space_idx on debt_payments (space_id, anio, mes);

-- rollover_recurring / rollover_debts(space,anio,mes) / run_monthly_rollover /
-- rollover_for_me: ver supabase/migrations/2026-09-03_* y 2026-09-04_*. En una
-- instalación nueva, pegá esos archivos tras este schema.

-- Cron (requiere activar la extensión pg_cron en el panel de Supabase):
--   create extension if not exists pg_cron;
--   select cron.schedule('finetica-monthly-rollover', '0 7 * * *',
--     $$ select public.run_monthly_rollover() $$);


-- ============================================================================
-- SOBRES (envelope budgeting) — ver supabase/migrations/2026-09-05_sobres.sql
-- ============================================================================
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);
alter table payment_methods enable row level security;
create policy "own payment methods" on payment_methods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists payment_methods_user_idx on payment_methods (user_id, orden);

create table if not exists envelopes (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('personal','family')),
  space_id uuid references personal_spaces(id) on delete cascade,
  family_budget_id uuid references family_budgets(id) on delete cascade,
  nombre text not null,
  categoria text not null,
  moneda text not null check (moneda in ('CRC','USD')),
  limite_mensual numeric not null default 0,
  limite_ilimitado boolean not null default false,
  icono text not null default 'Wallet',
  reinicio_dia int check (reinicio_dia between 1 and 31),   -- null = fin de mes calendario
  sin_reinicio boolean not null default false,   -- true = no reinicia automáticamente
  ciclo_inicio date not null default current_date,
  orden int not null default 0,
  -- línea del presupuesto de la que nació el sobre (hereda nombre/monto/moneda);
  -- los movimientos del sobre NO crean líneas nuevas: ésta es la que cuenta.
  source_budget_item_id uuid references budget_items(id) on delete set null,
  source_family_budget_item_id uuid references family_budget_items(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'personal' and space_id is not null and family_budget_id is null)
    or (scope_type = 'family' and family_budget_id is not null and space_id is null)
  )
);
alter table envelopes enable row level security;
create policy "envelopes access" on envelopes
  for all using (
    (scope_type = 'personal' and owns_space(space_id))
    or (scope_type = 'family' and is_family_member(family_budget_id))
  )
  with check (
    (scope_type = 'personal' and owns_space(space_id))
    or (scope_type = 'family' and is_family_member(family_budget_id))
  );
create index if not exists envelopes_space_idx on envelopes (space_id);
create index if not exists envelopes_family_idx on envelopes (family_budget_id);

create table if not exists envelope_movements (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references envelopes(id) on delete cascade,
  tipo text not null check (tipo in ('income','expense')),
  descripcion text not null,
  monto numeric not null default 0,
  moneda text not null check (moneda in ('CRC','USD')),
  fecha date not null default current_date,
  metodo_pago text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table envelope_movements enable row level security;
create policy "envelope movements access" on envelope_movements
  for all using (
    exists (select 1 from envelopes e where e.id = envelope_id and (
      (e.scope_type = 'personal' and owns_space(e.space_id))
      or (e.scope_type = 'family' and is_family_member(e.family_budget_id))))
  )
  with check (
    exists (select 1 from envelopes e where e.id = envelope_id and (
      (e.scope_type = 'personal' and owns_space(e.space_id))
      or (e.scope_type = 'family' and is_family_member(e.family_budget_id))))
  );
create index if not exists envelope_movements_env_idx on envelope_movements (envelope_id, fecha desc);

-- envelope_period_start(dia,hoy) y reset_due_envelopes(): ver la migración.
-- run_monthly_rollover llama a reset_due_envelopes() al inicio (fuera de los guardas).


-- ============================================================================
-- ASISTENTE IA — conteo de mensajes por día (tope de uso).
-- Ver supabase/migrations/2026-09-13_asistente_ia.sql. Las instrucciones
-- personalizadas van en personal_spaces.asistente_instrucciones.
-- ============================================================================
create table if not exists assistant_usage (
  space_id uuid not null references personal_spaces(id) on delete cascade,
  dia date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (space_id, dia)
);
alter table assistant_usage enable row level security;
create policy "own assistant usage - select" on assistant_usage
  for select using (owns_space(space_id));
create index if not exists assistant_usage_space_idx on assistant_usage (space_id, dia);

-- Incremento atómico con tope diario; devuelve el conteo del día ya incluyendo
-- este mensaje, o p_limit + 1 (sin incrementar) si ya se alcanzó el tope.
create or replace function assistant_bump_usage(p_space_id uuid, p_limit int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not owns_space(p_space_id) then
    raise exception 'forbidden';
  end if;
  insert into assistant_usage (space_id, dia, count)
  values (p_space_id, (now() at time zone 'utc')::date, 0)
  on conflict (space_id, dia) do nothing;
  update assistant_usage
     set count = count + 1
   where space_id = p_space_id
     and dia = (now() at time zone 'utc')::date
     and count < p_limit
  returning count into v_count;
  return coalesce(v_count, p_limit + 1);
end;
$$;


-- ============================================================================
-- STORAGE — bucket 'avatars' (público) para las fotos de perfil.
-- Ver supabase/migrations/2026-09-09_perfil.sql (PASO C): crea el bucket y las
-- políticas en storage.objects (lectura pública; escribir/borrar solo en la
-- carpeta {auth.uid()}/).
-- ============================================================================


-- ============================================================================
-- ENDURECIMIENTO DE SEGURIDAD — auditoría de RLS.
-- Ver supabase/migrations/2026-09-18_endurecimiento_rls.sql para el detalle y
-- las notas de cada punto. Resumen: auth.uid() -> (select auth.uid()) en las
-- políticas/funciones que comparaban directo (mejor plan de ejecución, mismo
-- comportamiento); owns_space()/is_family_member() ahora con
-- search_path = ''; revoke de GRANTS de tabla a `anon` sobre todos los
-- módulos financieros (defensa en profundidad, RLS ya los bloqueaba).
-- ============================================================================
create or replace function owns_space(s_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.personal_spaces
    where id = s_id and owner_id = (select auth.uid())
  );
$$;

create or replace function is_family_member(fb_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_budget_members
    where family_budget_id = fb_id and user_id = (select auth.uid())
  );
$$;

drop policy if exists "own personal space - select" on personal_spaces;
create policy "own personal space - select" on personal_spaces
  for select using (owner_id = (select auth.uid()));

drop policy if exists "own personal space - insert" on personal_spaces;
create policy "own personal space - insert" on personal_spaces
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists "own personal space - update" on personal_spaces;
create policy "own personal space - update" on personal_spaces
  for update using (owner_id = (select auth.uid()));

drop policy if exists "own personal space - delete" on personal_spaces;
create policy "own personal space - delete" on personal_spaces
  for delete using (owner_id = (select auth.uid()));

drop policy if exists "family members - leave" on family_budget_members;
create policy "family members - leave" on family_budget_members
  for delete using (user_id = (select auth.uid()));

drop policy if exists "own payment methods" on payment_methods;
create policy "own payment methods" on payment_methods
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table
  personal_spaces,
  family_budgets, family_budget_members, family_budget_categories, family_budget_items,
  budget_items, personal_budget_categories,
  activos, pasivos, deudas, debt_payments,
  payment_methods, envelopes, envelope_movements,
  assistant_usage, rollover_log
from anon;
-- ============================================================================


-- ============================================================================
-- REGISTRO DE ACEPTACIÓN DE TÉRMINOS/PRIVACIDAD EN EL ONBOARDING.
-- Ver supabase/migrations/2026-09-19_terminos_onboarding.sql.
-- ============================================================================
alter table personal_spaces
  add column if not exists terminos_aceptados_at timestamptz;
-- ============================================================================


-- ============================================================================
-- AUTENTICACIÓN DE DOS FACTORES (2FA/MFA) — TOTP nativo de Supabase Auth.
-- Ver supabase/migrations/2026-09-20_mfa.sql para las notas completas de
-- diseño (por qué el flujo de recovery codes desactiva el factor en vez de
-- falsear AAL2, referencias a la documentación oficial, etc).
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

drop policy if exists "own recovery codes" on mfa_recovery_codes;
create policy "own recovery codes" on mfa_recovery_codes
  for select using (user_id = (select auth.uid()));

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

-- Exigir AAL2 a quien tenga un factor TOTP verificado (opt-in). Restrictive:
-- se combinan con AND sobre las políticas permissive existentes.
--
-- IMPORTANTE: la política NO lee auth.mfa_factors directo (el patrón que
-- documenta Supabase) — el rol `authenticated` no tiene permiso de lectura
-- sobre esa tabla interna en proyectos actuales (confirmado en
-- github.com/supabase/supabase/issues/17168), y hacerlo así rompía el acceso
-- de TODAS las cuentas con un error de permisos disfrazado de "no hay datos".
-- Se usa en cambio una función security definer (mismo patrón que
-- owns_space()/is_family_member()), que sí puede leerla. Ver
-- supabase/migrations/2026-09-21_mfa_aal2_fix.sql para el detalle del incidente.
create or replace function mfa_user_requires_aal2()
returns boolean
language sql security definer set search_path = '' as $$
  select exists (
    select 1 from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  );
$$;

create policy "require aal2 if mfa enrolled" on personal_spaces
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on family_budgets
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on family_budget_members
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on family_budget_categories
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on family_budget_items
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on budget_items
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on personal_budget_categories
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on activos
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on pasivos
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on deudas
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on debt_payments
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on payment_methods
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on envelopes
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');

create policy "require aal2 if mfa enrolled" on envelope_movements
  as restrictive for all to authenticated
  using (not mfa_user_requires_aal2() or (select auth.jwt()->>'aal') = 'aal2');
-- ============================================================================
