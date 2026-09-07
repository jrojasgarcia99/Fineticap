import { notFound } from "next/navigation";
import { getPersonalContext, getFamilyBudgetContext } from "@/lib/data";
import { tFor, mesesLabel } from "@/lib/i18n";
import {
  formatoMoneda,
  proyeccionInteresCompuesto,
  tasaNetaDeComision,
  aniosRestantes as aniosRestantesFn,
  serieProyeccion,
} from "@/lib/calculations";
import type { Fondo, FondoMovimiento, FondoPosicion } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { FondoMenu } from "@/components/patrimonio/FondoMenu";
import { AgregarRendimientoDialog } from "@/components/patrimonio/AgregarRendimientoDialog";
import { FondoPosicionDialog } from "@/components/patrimonio/FondoPosicionDialog";
import { DonutChart } from "@/components/patrimonio/DonutChart";
import { ProjectionChart } from "@/components/patrimonio/ProjectionChart";
import { MovimientoItem } from "@/components/patrimonio/MovimientoItem";
import {
  updateFondo,
  deleteFondo,
  agregarRendimiento,
  createFondoPosicion,
  updateFondoPosicion,
  deleteFondoPosicion,
  eliminarMovimientoFondo,
  editarMovimientoFondo,
} from "../../actions";

export default async function FondoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, currency, user, locale } = await getPersonalContext();
  const t = tFor(locale);
  const MESES = mesesLabel(locale);

  const { data: fondoRaw } = await supabase.from("fondos").select("*").eq("id", id).maybeSingle();
  const fondo = fondoRaw as Fondo | null;
  if (!fondo) notFound();

  const isFamilyMember = !!(await getFamilyBudgetContext({ supabase, user }));

  const [{ data: movRaw }, { data: posRaw }] = await Promise.all([
    supabase
      .from("fondo_movimientos")
      .select("*")
      .eq("fondo_id", id)
      .order("anio", { ascending: false })
      .order("mes", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("fondo_posiciones").select("*").eq("fondo_id", id).order("orden"),
  ]);
  const movimientos = (movRaw ?? []) as FondoMovimiento[];
  const posiciones = (posRaw ?? []) as FondoPosicion[];
  const posicionNombre = new Map(posiciones.map((p) => [p.id, p.nombre]));

  const budgetItemIds = movimientos
    .filter((m) => m.tipo === "aporte_presupuesto" && m.budget_item_id)
    .map((m) => m.budget_item_id as string);
  const { data: budgetItemsRaw } = budgetItemIds.length
    ? await supabase.from("budget_items").select("id, categoria").in("id", budgetItemIds)
    : { data: [] as { id: string; categoria: string }[] };
  const categoriaPorItem = new Map((budgetItemsRaw ?? []).map((b) => [b.id, b.categoria]));

  // Nombres de quién aportó qué, solo relevante si el fondo es compartido.
  let nombrePorUsuario = new Map<string, string>();
  if (fondo.scope_type === "family") {
    const { data: roster } = await supabase.rpc("family_budget_roster");
    nombrePorUsuario = new Map(
      ((roster ?? []) as { user_id: string; display_name: string }[]).map((r) => [
        r.user_id,
        r.display_name,
      ]),
    );
  }

  const saldoTotal = movimientos.reduce((a, m) => a + Number(m.monto), 0);
  let acumuladoAhorro = 0;
  let ganadoInversion = 0;
  for (const m of movimientos) {
    const monto = Number(m.monto);
    if (m.tipo === "rendimiento") {
      ganadoInversion += monto;
    } else if (categoriaPorItem.get(m.budget_item_id ?? "") === "inversion") {
      ganadoInversion += monto;
    } else {
      acumuladoAhorro += monto;
    }
  }

  const saldoPorPosicion = (posId: string) =>
    movimientos.filter((m) => m.posicion_id === posId).reduce((a, m) => a + Number(m.monto), 0);

  function aportePromedio(filtro: (m: FondoMovimiento) => boolean): number {
    const mesesMap = new Map<string, number>();
    for (const m of movimientos) {
      if (m.tipo !== "aporte_presupuesto" || !filtro(m)) continue;
      const key = `${m.anio}-${m.mes}`;
      mesesMap.set(key, (mesesMap.get(key) ?? 0) + Number(m.monto));
    }
    return mesesMap.size
      ? Array.from(mesesMap.values()).reduce((a, v) => a + v, 0) / mesesMap.size
      : 0;
  }

  // Aporte mensual promedio real del fondo entero (solo aportes de
  // presupuesto), para la calculadora sin posiciones — nunca inventamos una
  // tasa de ahorro futura.
  const aporteMensualPromedio = aportePromedio(() => true);

  const fmt = (v: number) => formatoMoneda(v, fondo.moneda);
  const totalPorcentajeAsignado = posiciones.reduce((a, p) => a + Number(p.porcentaje), 0);

  // Con posiciones: la proyección del fondo es la suma de la proyección de
  // cada posición (cada una a su propia tasa/plazo/comisión/años ya
  // transcurridos). Las que no tienen tasa/plazo configurado aportan su
  // saldo actual, sin asumir crecimiento.
  type FilaProyeccion = {
    nombre: string;
    tasaNeta: number;
    restantes: number;
    asumido: number;
    valor: number;
  };
  let filasProyeccion: FilaProyeccion[] = [];
  let proyeccionTotal: number | null = null;
  let chartData: Record<string, number>[] = [];
  let chartSeries: string[] = [];

  if (posiciones.length > 0) {
    const posicionesConTasa = posiciones.filter(
      (p) => p.tasa_retorno_estimada != null && p.plazo_proyeccion_anios != null,
    );
    let total = 0;
    for (const p of posiciones) {
      const saldoP = saldoPorPosicion(p.id);
      if (p.tasa_retorno_estimada != null && p.plazo_proyeccion_anios != null) {
        const asumido = aportePromedio((m) => m.posicion_id === p.id);
        const tasaNeta = tasaNetaDeComision(p.tasa_retorno_estimada, p.comision_anual_pct);
        const restantes = aniosRestantesFn(p.plazo_proyeccion_anios, p.anios_transcurridos);
        const valor = proyeccionInteresCompuesto(saldoP, asumido, tasaNeta, restantes);
        filasProyeccion.push({ nombre: p.nombre, tasaNeta, restantes, asumido, valor });
        total += valor;
      } else {
        total += saldoP;
      }
    }
    proyeccionTotal = total;

    const maxAnios = Math.max(
      0,
      ...posicionesConTasa.map((p) =>
        aniosRestantesFn(p.plazo_proyeccion_anios!, p.anios_transcurridos),
      ),
    );
    if (maxAnios > 0) {
      chartSeries = posicionesConTasa.length > 1 ? [...posicionesConTasa.map((p) => p.nombre), "Total"] : ["Total"];
      for (let anio = 0; anio <= maxAnios; anio++) {
        const punto: Record<string, number> = { anio };
        let totalAnio = 0;
        for (const p of posiciones) {
          const saldoP = saldoPorPosicion(p.id);
          let valor = saldoP;
          if (p.tasa_retorno_estimada != null && p.plazo_proyeccion_anios != null) {
            const asumido = aportePromedio((m) => m.posicion_id === p.id);
            const tasaNeta = tasaNetaDeComision(p.tasa_retorno_estimada, p.comision_anual_pct);
            const restantes = aniosRestantesFn(p.plazo_proyeccion_anios, p.anios_transcurridos);
            valor = proyeccionInteresCompuesto(saldoP, asumido, tasaNeta, Math.min(anio, restantes));
            punto[p.nombre] = valor;
          }
          totalAnio += valor;
        }
        punto["Total"] = totalAnio;
        chartData.push(punto);
      }
    }
  } else if (fondo.tasa_retorno_estimada != null && fondo.plazo_proyeccion_anios != null) {
    const tasaNeta = tasaNetaDeComision(fondo.tasa_retorno_estimada, fondo.comision_anual_pct);
    const restantes = aniosRestantesFn(fondo.plazo_proyeccion_anios, fondo.anios_transcurridos);
    proyeccionTotal = proyeccionInteresCompuesto(saldoTotal, aporteMensualPromedio, tasaNeta, restantes);
    if (restantes > 0) {
      chartSeries = ["Total"];
      chartData = serieProyeccion(saldoTotal, aporteMensualPromedio, tasaNeta, restantes).map((pt) => ({
        anio: pt.anio,
        Total: pt.valor,
      }));
    }
  }

  return (
    <div>
      <BackButton href="/patrimonio" label={t("patrimonio.title")} />

      <Card className="mb-6">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-navy">{fondo.nombre}</h1>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                {t(`fondos.type.${fondo.tipo}`)}
                {fondo.scope_type === "family" && ` · ${t("fondos.shared")}`}
              </p>
            </div>
            <FondoMenu
              fondo={fondo}
              currency={currency}
              isFamilyMember={isFamilyMember}
              tienePosiciones={posiciones.length > 0}
              updateAction={updateFondo}
              deleteAction={deleteFondo}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{t("fondos.balance")}</p>
            <p className="text-[2.25rem] font-bold leading-tight text-navy">{fmt(saldoTotal)}</p>
          </div>

          <AgregarRendimientoDialog
            fondoId={fondo.id}
            moneda={fondo.moneda}
            posiciones={posiciones}
            action={agregarRendimiento}
          />
        </CardBody>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-gray-500">{t("fondos.fromSavings")}</p>
          <p className="text-lg font-semibold text-green">{fmt(acumuladoAhorro)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-gray-500">{t("fondos.fromInvestment")}</p>
          <p className="text-lg font-semibold text-gold">{fmt(ganadoInversion)}</p>
        </Card>
        <Card className="col-span-2 p-4 sm:col-span-1">
          <p className="text-xs uppercase text-gray-500">{t("fondos.monthlyContribution")}</p>
          <p className="text-lg font-semibold text-navy">{fmt(aporteMensualPromedio)}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("fondos.positions")}</CardTitle>
          {posiciones.length > 0 && (
            <span
              className={`text-sm font-semibold ${
                totalPorcentajeAsignado === 100 ? "text-green" : "text-red"
              }`}
            >
              {t("fondos.totalAssigned", { n: totalPorcentajeAsignado })}
            </span>
          )}
        </CardHeader>
        <CardBody className="flex flex-wrap items-start gap-6">
          <div className="min-w-[14rem] flex-1 space-y-3">
            {posiciones.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700">
                    {p.nombre} <span className="text-xs text-gray-400">({p.porcentaje}%)</span>
                  </p>
                  {p.tasa_retorno_estimada != null && p.plazo_proyeccion_anios != null && (
                    <p className="text-xs text-gray-400">
                      {p.tasa_retorno_estimada}% · {p.plazo_proyeccion_anios} {t("fondos.years")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy">{fmt(saldoPorPosicion(p.id))}</span>
                  <FondoPosicionDialog
                    fondoId={fondo.id}
                    posicion={p}
                    asignadoOtras={totalPorcentajeAsignado - Number(p.porcentaje)}
                    createAction={createFondoPosicion}
                    updateAction={updateFondoPosicion}
                    deleteAction={deleteFondoPosicion}
                  />
                </div>
              </div>
            ))}
            <FondoPosicionDialog
              fondoId={fondo.id}
              asignadoOtras={totalPorcentajeAsignado}
              createAction={createFondoPosicion}
              updateAction={updateFondoPosicion}
              deleteAction={deleteFondoPosicion}
            />
          </div>
          {posiciones.length > 0 && (
            <DonutChart
              data={posiciones.map((p) => ({ nombre: p.nombre, valor: saldoPorPosicion(p.id) }))}
              moneda={fondo.moneda}
            />
          )}
        </CardBody>
      </Card>

      {proyeccionTotal != null && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("fondos.projectionTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-gray-400">{t("fondos.projectionDisclaimer")}</p>

            {posiciones.length > 0 ? (
              <div className="space-y-2 text-sm">
                {filasProyeccion.map((f) => (
                  <div key={f.nombre} className="flex items-center justify-between gap-2">
                    <span className="text-gray-600">
                      {f.nombre}{" "}
                      <span className="text-xs text-gray-400">
                        ({f.tasaNeta}% · {f.restantes} {t("fondos.yearsLeft")})
                      </span>
                    </span>
                    <span className="font-medium text-navy">{fmt(f.valor)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2 font-semibold">
                  <span className="text-gray-700">{t("fondos.projectedValue")}</span>
                  <span className="text-navy-light">{fmt(proyeccionTotal)}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">{t("fondos.estimatedRate")}</span>
                  <p className="font-medium text-navy">{fondo.tasa_retorno_estimada}%</p>
                </div>
                <div>
                  <span className="text-gray-500">{t("fondos.term")}</span>
                  <p className="font-medium text-navy">
                    {fondo.plazo_proyeccion_anios} {t("fondos.years")}
                    {fondo.anios_transcurridos > 0 &&
                      ` · ${aniosRestantesFn(fondo.plazo_proyeccion_anios!, fondo.anios_transcurridos)} ${t("fondos.yearsLeft")}`}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">{t("fondos.assumedMonthly")}</span>
                  <p className="font-medium text-navy">{fmt(aporteMensualPromedio)}</p>
                </div>
                <div>
                  <span className="text-gray-500">{t("fondos.projectedValue")}</span>
                  <p className="text-lg font-semibold text-navy-light">{fmt(proyeccionTotal)}</p>
                </div>
              </div>
            )}

            {chartData.length > 1 && (
              <div className="mt-4 border-t border-border pt-4">
                <ProjectionChart
                  data={chartData}
                  series={chartSeries}
                  moneda={fondo.moneda}
                  yearLabel={t("fondos.year")}
                />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("fondos.history")}</CardTitle>
          {movimientos.length > 0 && (
            <a
              href={`/api/fondo-xlsx?fondoId=${fondo.id}`}
              className="text-sm text-navy-light hover:underline"
            >
              {t("fondos.exportExcel")}
            </a>
          )}
        </CardHeader>
        <CardBody>
          {movimientos.length === 0 ? (
            <p className="text-sm text-gray-400">{t("fondos.noMovements")}</p>
          ) : (
            <div className="space-y-1">
              {Array.from(new Set(movimientos.map((m) => m.anio))).map((anio, idx) => {
                const delAnio = movimientos.filter((m) => m.anio === anio);
                const totalAnio = delAnio.reduce((a, m) => a + Number(m.monto), 0);
                return (
                  <details key={anio} open={idx === 0} className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 py-2 text-sm font-medium text-navy">
                      <span>
                        {anio} <span className="text-gray-400">({delAnio.length})</span>
                      </span>
                      <span>{fmt(totalAnio)}</span>
                    </summary>
                    <ul className="divide-y divide-border pl-1">
                      {delAnio.map((m) => (
                        <MovimientoItem
                          key={m.id}
                          movimiento={m}
                          titulo={
                            m.tipo === "rendimiento"
                              ? m.descripcion || t("fondos.returnGeneric")
                              : m.tipo === "saldo_inicial"
                                ? t("fondos.initialLabel")
                                : `${MESES[m.mes - 1]} ${m.anio}`
                          }
                          subtitulo={
                            <>
                              {m.tipo === "rendimiento"
                                ? t("fondos.returnLabel")
                                : m.tipo === "saldo_inicial"
                                  ? t("fondos.initialLabel")
                                  : t("fondos.contributionLabel")}
                              {m.posicion_id && <> · {posicionNombre.get(m.posicion_id) || "—"}</>}
                              {fondo.scope_type === "family" && m.created_by && (
                                <> · {nombrePorUsuario.get(m.created_by) || "—"}</>
                              )}
                            </>
                          }
                          montoFmt={fmt(Number(m.monto))}
                          editable={m.tipo !== "aporte_presupuesto"}
                          editAction={editarMovimientoFondo}
                          deleteAction={eliminarMovimientoFondo}
                        />
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
