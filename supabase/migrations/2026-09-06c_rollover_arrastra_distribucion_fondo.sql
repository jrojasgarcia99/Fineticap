-- Cuando una línea recurrente de Ahorro/Inversión ya está distribuida a un
-- fondo (o repartida entre sus diversificaciones), el rollover mensual la
-- copiaba al mes nuevo pero NO su distribución — había que volver a
-- distribuirla a mano cada mes. Ahora se replica automáticamente, con el
-- mismo reparto por diversificación que ya tenía. Corre una vez por cada
-- espacio personal (rollover_for_me / run_monthly_rollover ya lo llaman así),
-- por lo que si el fondo es compartido y ambas cuentas tienen su propia línea
-- recurrente distribuida ahí, cada una arrastra la suya por separado.
create or replace function rollover_recurring(
  p_scope_type text, p_scope_id uuid, p_anio int, p_mes int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  src_mes int; src_anio int;
  tgt_key int := p_anio * 12 + p_mes;
  src_key int;
  r record;
  v_new_id uuid;
begin
  if p_scope_type = 'personal' then
    if exists (select 1 from budget_items
               where space_id = p_scope_id and anio = p_anio and mes = p_mes) then
      return;
    end if;
    select mes, anio into src_mes, src_anio
      from budget_items where space_id = p_scope_id
      order by anio desc, mes desc limit 1;
    if src_mes is null then return; end if;
    src_key := src_anio * 12 + src_mes;
    if tgt_key < src_key then return; end if;             -- solo hacia adelante

    for r in
      select id, space_id, categoria, concepto, monto, moneda, automatico, orden, created_by
      from budget_items
      where space_id = p_scope_id and mes = src_mes and anio = src_anio and recurrente = true
    loop
      insert into budget_items
        (space_id, categoria, concepto, monto, moneda, automatico, recurrente, orden, mes, anio, created_by)
      values
        (r.space_id, r.categoria, r.concepto, r.monto, r.moneda, r.automatico, true, r.orden, p_mes, p_anio, r.created_by)
      returning id into v_new_id;

      insert into fondo_movimientos
        (fondo_id, budget_item_id, posicion_id, tipo, monto, moneda, mes, anio, created_by)
      select fm.fondo_id, v_new_id, fm.posicion_id, 'aporte_presupuesto', fm.monto, r.moneda, p_mes, p_anio, r.created_by
      from fondo_movimientos fm
      where fm.budget_item_id = r.id;
    end loop;

  elsif p_scope_type = 'family' then
    if exists (select 1 from family_budget_items
               where family_budget_id = p_scope_id and anio = p_anio and mes = p_mes) then
      return;
    end if;
    select mes, anio into src_mes, src_anio
      from family_budget_items where family_budget_id = p_scope_id
      order by anio desc, mes desc limit 1;
    if src_mes is null then return; end if;
    src_key := src_anio * 12 + src_mes;
    if tgt_key < src_key then return; end if;

    insert into family_budget_items
      (family_budget_id, categoria, concepto, monto, moneda, automatico, recurrente, orden, mes, anio, created_by)
    select family_budget_id, categoria, concepto, monto, moneda, automatico, true, orden, p_mes, p_anio, created_by
    from family_budget_items
    where family_budget_id = p_scope_id and mes = src_mes and anio = src_anio and recurrente = true;
  end if;
end;
$$;
