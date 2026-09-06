import { notFound } from "next/navigation";
import { getPersonalContext, getFamilyBudgetContext } from "@/lib/data";
import { tFor, mesesLabel } from "@/lib/i18n";
import { formatoMoneda, proyeccionInteresCompuesto } from "@/lib/calculations";
import type { Fondo, FondoMovimiento } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { BackButton } from "@/components/ui/BackButton";
import { FondoMenu } from "@/components/patrimonio/FondoMenu";
import { AgregarRendimientoDialog } from "@/components/patrimonio/AgregarRendimientoDialog";
import { updateFondo, deleteFondo, agregarRendimiento } from "../../actions";

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

  const { data: movRaw } = await supabase
    .from("fondo_movimientos")
    .select("*")
    .eq("fondo_id", id)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false })
    .order("created_at", { ascending: false });
  const movimientos = (movRaw ?? []) as FondoMovimiento[];

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

  // Aporte mensual promedio real (solo de aportes de presupuesto), para la
  // calculadora — nunca inventamos una tasa de ahorro futura.
  const mesesConAporte = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== "aporte_presupuesto") continue;
    const key = `${m.anio}-${m.mes}`;
    mesesConAporte.set(key, (mesesConAporte.get(key) ?? 0) + Number(m.monto));
  }
  const aporteMensualPromedio = mesesConAporte.size
    ? Array.from(mesesConAporte.values()).reduce((a, v) => a + v, 0) / mesesConAporte.size
    : 0;

  const proyeccion =
    fondo.tasa_retorno_estimada != null && fondo.plazo_proyeccion_anios != null
      ? proyeccionInteresCompuesto(
          saldoTotal,
          aporteMensualPromedio,
          fondo.tasa_retorno_estimada,
          fondo.plazo_proyeccion_anios,
        )
      : null;

  const fmt = (v: number) => formatoMoneda(v, fondo.moneda);

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
              updateAction={updateFondo}
              deleteAction={deleteFondo}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{t("fondos.balance")}</p>
            <p className="text-[2.25rem] font-bold leading-tight text-navy">{fmt(saldoTotal)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <p className="text-xs text-gray-500">{t("fondos.fromSavings")}</p>
              <p className="text-base font-medium text-green">{fmt(acumuladoAhorro)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("fondos.fromInvestment")}</p>
              <p className="text-base font-medium text-gold">{fmt(ganadoInversion)}</p>
            </div>
          </div>

          <AgregarRendimientoDialog fondoId={fondo.id} moneda={fondo.moneda} action={agregarRendimiento} />
        </CardBody>
      </Card>

      {fondo.tasa_retorno_estimada != null && fondo.plazo_proyeccion_anios != null && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("fondos.projectionTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-xs text-gray-400">{t("fondos.projectionDisclaimer")}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t("fondos.estimatedRate")}</span>
                <p className="font-medium text-navy">{fondo.tasa_retorno_estimada}%</p>
              </div>
              <div>
                <span className="text-gray-500">{t("fondos.term")}</span>
                <p className="font-medium text-navy">
                  {fondo.plazo_proyeccion_anios} {t("fondos.years")}
                </p>
              </div>
              <div>
                <span className="text-gray-500">{t("fondos.assumedMonthly")}</span>
                <p className="font-medium text-navy">{fmt(aporteMensualPromedio)}</p>
              </div>
              <div>
                <span className="text-gray-500">{t("fondos.projectedValue")}</span>
                <p className="text-lg font-semibold text-navy-light">{fmt(proyeccion ?? 0)}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("fondos.history")}</CardTitle>
        </CardHeader>
        <CardBody>
          {movimientos.length === 0 ? (
            <p className="text-sm text-gray-400">{t("fondos.noMovements")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {movimientos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-700">
                      {m.tipo === "rendimiento"
                        ? m.descripcion || t("fondos.returnGeneric")
                        : `${MESES[m.mes - 1]} ${m.anio}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {m.tipo === "rendimiento" ? t("fondos.returnLabel") : t("fondos.contributionLabel")}
                      {fondo.scope_type === "family" && m.created_by && (
                        <> · {nombrePorUsuario.get(m.created_by) || "—"}</>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-medium ${m.tipo === "rendimiento" ? "text-gold" : "text-navy"}`}
                  >
                    {fmt(Number(m.monto))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
