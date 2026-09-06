-- ============================================================================
-- Ajustes a Fondos, pedidos tras las primeras pruebas:
--  - porcentaje_ahorro/porcentaje_inversion nunca se llegaron a usar (la
--    distribución quedó como "una línea → un fondo completo", no reparto por
--    %) — se quitan para no dejar un campo confuso sin ninguna lógica detrás.
--  - Nuevo tipo de movimiento 'saldo_inicial': monto de arranque al crear un
--    fondo, para no perder el historial de "cuánto tenía ya ahorrado".
-- ============================================================================

alter table fondos drop column if exists porcentaje_ahorro;
alter table fondos drop column if exists porcentaje_inversion;

alter table fondo_movimientos drop constraint if exists fondo_movimientos_tipo_check;
alter table fondo_movimientos add constraint fondo_movimientos_tipo_check
  check (tipo in ('aporte_presupuesto', 'rendimiento', 'saldo_inicial'));
