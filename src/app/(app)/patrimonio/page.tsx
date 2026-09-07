import Link from "next/link";
import { getPersonalContext, getFamilyBudgetContext } from "@/lib/data";
import { calcularPosicionPatrimonial, edadDesde, formatoMoneda } from "@/lib/calculations";
import { aPrimaria, aSecundaria, secundariaDe } from "@/lib/currency";
import { tFor } from "@/lib/i18n";
import type { Activo, Deuda, Fondo, FondoMovimiento } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ActivosCard } from "@/components/patrimonio/ActivosCard";
import { DonutChart, DONUT_COLORS } from "@/components/patrimonio/DonutChart";
import { FondosSection, type FondoListItem } from "@/components/patrimonio/FondosSection";
import {
  addActivo,
  updateActivo,
  deleteActivo,
  createFondo,
  updateFondo,
  deleteFondo,
} from "./actions";

export default async function PatrimonioPage() {
  const { supabase, space, currency, user, locale } = await getPersonalContext();
  const t = tFor(locale);
  const fam = await getFamilyBudgetContext({ supabase, user });

  const [{ data: activos }, { data: deudas }, { data: fondosPersonales }] =
    await Promise.all([
      supabase.from("activos").select("*").eq("space_id", space.id).order("created_at"),
      supabase.from("deudas").select("*").eq("space_id", space.id),
      supabase.from("fondos").select("*").eq("space_id", space.id).order("orden"),
    ]);

  const { data: fondosFamiliares } = fam
    ? await supabase.from("fondos").select("*").eq("family_budget_id", fam.familyBudget.id).order("orden")
    : { data: null };

  const activosList = (activos ?? []) as Activo[];
  const deudasList = (deudas ?? []) as Deuda[];
  const fondosList = [...((fondosPersonales ?? []) as Fondo[]), ...((fondosFamiliares ?? []) as Fondo[])];
  const fmt = (v: number) => formatoMoneda(v, currency.primaria);

  const fondoIds = fondosList.map((f) => f.id);
  const { data: movimientos } = fondoIds.length
    ? await supabase.from("fondo_movimientos").select("*").in("fondo_id", fondoIds)
    : { data: [] as FondoMovimiento[] };
  const movimientosList = (movimientos ?? []) as FondoMovimiento[];
  const saldoPorFondo = (fondoId: string) =>
    movimientosList.filter((m) => m.fondo_id === fondoId).reduce((a, m) => a + Number(m.monto), 0);

  const fondoItems: FondoListItem[] = fondosList.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    moneda: f.moneda,
    saldo: saldoPorFondo(f.id),
    compartido: f.scope_type === "family",
  }));
  const totalFondos = fondosList.reduce(
    (a, f) => a + aPrimaria(saldoPorFondo(f.id), f.moneda, currency),
    0,
  );

  const totalActivos = activosList.reduce((a, x) => a + aPrimaria(Number(x.valor), x.moneda, currency), 0);
  const saldoDeudas = deudasList
    .filter((d) => d.estado === "Activa")
    .reduce((a, d) => a + aPrimaria(Number(d.saldo_actual), d.moneda, currency), 0);
  const totalPasivos = saldoDeudas;
  const patrimonioNeto = totalFondos + totalActivos - totalPasivos;

  // Composición del patrimonio (para el gráfico circular): Fondos como una
  // categoría propia, y los Activos agrupados por su categoría.
  const totalPorCategoriaActivo = new Map<string, number>();
  for (const a of activosList) {
    const v = aPrimaria(Number(a.valor), a.moneda, currency);
    totalPorCategoriaActivo.set(a.categoria, (totalPorCategoriaActivo.get(a.categoria) ?? 0) + v);
  }
  const composicion = [
    ...(totalFondos > 0 ? [{ nombre: t("fondos.title"), valor: totalFondos }] : []),
    ...Array.from(totalPorCategoriaActivo.entries()).map(([cat, valor]) => ({
      nombre: t(`activos.cat.${cat}`),
      valor,
    })),
  ];

  const secundaria = secundariaDe(currency);
  const patrimonioNetoSecundario = secundaria ? aSecundaria(patrimonioNeto, currency) : null;

  const salarioAnual = Number(space.salario_mensual) * 12;
  const edad = edadDesde(space.fecha_nacimiento);
  const posicion = calcularPosicionPatrimonial(salarioAnual, edad, patrimonioNeto);

  const posicionLabel: Record<string, { key: string; color: string }> = {
    PAR: { key: "patrimonio.par", color: "text-green" },
    MAR: { key: "patrimonio.mar", color: "text-gold" },
    SAR: { key: "patrimonio.sar", color: "text-red" },
  };

  return (
    <div>
      <PageHeader title={t("patrimonio.title")} description={t("patrimonio.desc")} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("fondos.title")}</p>
          <p className="text-xl font-semibold text-navy-light">{fmt(totalFondos)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("patrimonio.totalAssets")}</p>
          <p className="text-xl font-semibold text-green">{fmt(totalActivos)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("patrimonio.totalLiabilities")}</p>
          <p className="text-xl font-semibold text-red">{fmt(totalPasivos)}</p>
        </Card>
        <Card className="p-4 bg-navy">
          <p className="text-xs text-white/60 uppercase">{t("patrimonio.netWorth")}</p>
          <p className="text-xl font-semibold text-white">{fmt(patrimonioNeto)}</p>
          {secundaria && patrimonioNetoSecundario != null && (
            <p className="text-xs text-white/50">
              {formatoMoneda(patrimonioNetoSecundario, secundaria)}
            </p>
          )}
        </Card>
      </div>

      <div className="mb-6">
        <FondosSection
          items={fondoItems}
          total={totalFondos}
          currency={currency}
          isFamilyMember={!!fam}
          createAction={createFondo}
          updateAction={updateFondo}
          deleteAction={deleteFondo}
        />
      </div>

      {composicion.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("patrimonio.compositionTitle")}</CardTitle>
            <span className="text-sm font-semibold text-navy">{fmt(totalFondos + totalActivos)}</span>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-center gap-8">
              <DonutChart data={composicion} moneda={currency.primaria} size={200} />
              <ul className="min-w-[14rem] flex-1 space-y-3">
                {composicion.map((c, i) => {
                  const pct = (c.valor / (totalFondos + totalActivos || 1)) * 100;
                  return (
                    <li key={c.nombre}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          />
                          {c.nombre}
                        </span>
                        <span className="font-medium text-navy">
                          {fmt(c.valor)} <span className="text-xs text-gray-400">({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
              <span className="text-gray-500">
                {t("patrimonio.assets")} + {t("fondos.title")}: <strong className="text-navy">{fmt(totalFondos + totalActivos)}</strong>
              </span>
              <span className="text-gray-500">
                {t("patrimonio.totalLiabilities")}: <strong className="text-red">-{fmt(totalPasivos)}</strong>
              </span>
              <span className="text-gray-700">
                {t("patrimonio.netWorth")}: <strong className="text-navy">{fmt(patrimonioNeto)}</strong>
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="mb-6">
        <ActivosCard
          items={activosList}
          total={totalActivos}
          currency={currency}
          createAction={addActivo}
          updateAction={updateActivo}
          deleteAction={deleteActivo}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("patrimonio.positionTitle")}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-xs text-gray-500 mb-4">{t("patrimonio.methodology")}</p>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t("patrimonio.annualSalary")}</span>
                <span className="font-medium">{fmt(salarioAnual)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t("patrimonio.refAge")}</span>
                <span className="font-medium">
                  {edad !== null ? (
                    t("perfil.ageIs", { n: edad })
                  ) : (
                    <Link href="/perfil" className="text-navy-light hover:underline">
                      {t("patrimonio.setBirthDate")}
                    </Link>
                  )}
                </span>
              </div>
              {posicion.posicion && (
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-500">{t("patrimonio.desiredNetWorth")}</span>
                  <span className="font-medium">{fmt(posicion.patrimonioDeseado)}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-gray-50 p-4 flex flex-col justify-center items-center text-center">
              {posicion.posicion ? (
                <>
                  <p className="text-xs text-gray-500 uppercase mb-1">{t("patrimonio.yourPosition")}</p>
                  <p className={`text-lg font-semibold ${posicionLabel[posicion.posicion].color}`}>
                    {t(posicionLabel[posicion.posicion].key)}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {t("patrimonio.parSarThresholds", {
                      par: fmt(posicion.umbralPAR),
                      sar: fmt(posicion.umbralSAR),
                    })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">
                  {t("patrimonio.enterAge")}{" "}
                  <Link href="/perfil" className="text-navy-light hover:underline">
                    {t("nav.perfil")}
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
