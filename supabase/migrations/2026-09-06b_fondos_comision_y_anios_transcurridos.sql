-- Proyección de fondos: cuánto tiempo ya lleva la inversión (para proyectar
-- solo los años que faltan, no el plazo completo desde cero) y una comisión
-- anual opcional (seguro, costo de administración) que reduce el rendimiento
-- neto usado en la proyección.
alter table fondos add column if not exists anios_transcurridos int not null default 0;
alter table fondos add column if not exists comision_anual_pct numeric;

alter table fondo_posiciones add column if not exists anios_transcurridos int not null default 0;
alter table fondo_posiciones add column if not exists comision_anual_pct numeric;

-- Fondos de tipo 'emergencia' se fusionan con 'ahorro' (la app ya no ofrece
-- crear ese tipo por separado).
update fondos set tipo = 'ahorro' where tipo = 'emergencia';
alter table fondos drop constraint if exists fondos_tipo_check;
alter table fondos add constraint fondos_tipo_check check (tipo in ('inversion','ahorro','gasto_anual'));
