import Link from "next/link";
import {
  getPersonalContext,
  getFamilyBudgetContext,
  getFamilyRepartoContext,
  getTotalFondos,
  ensurePersonalCategories,
} from "@/lib/data";
import {
  calcularTotales,
  calcularSemaforos,
  saludFinancieraGeneral,
  calcularFondoEmergencia,
  formatoMoneda,
  formatoPct,
} from "@/lib/calculations";
import { convertirBudgetItems, convertirDeudas, aPrimaria } from "@/lib/currency";
import { tFor } from "@/lib/i18n";
import type { BudgetItem, Deuda, Activo, PersonalBudgetCategory } from "@/lib/types";
import { SEMAFORO_COLOR } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { SemaforoBadge, ProgressBar } from "@/components/ui/Semaforo";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}) {
  const { supabase, space, currency, user, locale } = await getPersonalContext();
  const t = tFor(locale);
  const now = new Date();
  const sp = await searchParams;
  const mes = Number(sp.mes) || now.getMonth() + 1;
  const anio = Number(sp.anio) || now.getFullYear();

  // Ninguna depende de la otra: en paralelo. La siguiente tanda de selects sí
  // depende de que ensurePersonalCategories haya sembrado categorías.
  const [, reparto, fam] = await Promise.all([
    ensurePersonalCategories({ supabase, space }),
    getFamilyRepartoContext(currency, { supabase, user }),
    getFamilyBudgetContext({ supabase, user }),
  ]);

  const [{ data: items }, { data: deudas }, { data: activos }, { data: cats }, totalFondos] =
    await Promise.all([
      supabase.from("budget_items").select("*").eq("space_id", space.id).eq("mes", mes).eq("anio", anio),
      supabase.from("deudas").select("*").eq("space_id", space.id),
      supabase.from("activos").select("*").eq("space_id", space.id),
      supabase.from("personal_budget_categories").select("*").eq("space_id", space.id).order("orden", { ascending: true }),
      getTotalFondos({ supabase, space, familyBudgetId: fam?.familyBudget.id, currency }),
    ]);

  const categorias = (cats ?? []) as PersonalBudgetCategory[];
  const budgetItems = convertirBudgetItems((items ?? []) as BudgetItem[], currency);
  const deudasList = convertirDeudas((deudas ?? []) as Deuda[], currency);
  const activosList = (activos ?? []) as Activo[];
  const fmt = (v: number) => formatoMoneda(v, currency.primaria);

  const aporteFamiliar = reparto ? reparto.shareFor(mes, anio) : 0;

  const metaDeuda = Number(space.meta_deuda) || 0;
  const tot = calcularTotales(budgetItems, deudasList, categorias, mes, anio, aporteFamiliar);
  const semaforos = calcularSemaforos(tot, categorias, metaDeuda, t("sem.deuda"));

  const totalActivos = activosList.reduce((a, x) => a + aPrimaria(Number(x.valor), x.moneda, currency), 0);
  const saldoDeudas = deudasList
    .filter((d) => d.estado === "Activa")
    .reduce((a, d) => a + Number(d.saldo_actual), 0);
  const patrimonioNeto = totalFondos + totalActivos - saldoDeudas;

  const fondo = calcularFondoEmergencia(tot, 0, space);
  const salud = saludFinancieraGeneral(tot, categorias, metaDeuda, fondo.pctIdeal);
  const ingresoMensual = Number(space.salario_mensual);

  return (
    <div>
      <PageHeader
        title={
          space.display_name
            ? t("dashboard.helloName", { name: space.display_name })
            : t("dashboard.helloDefault")
        }
        description={t("dashboard.desc")}
      />

      <Card className="mb-6 overflow-hidden">
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: `${SEMAFORO_COLOR[salud.nivel]}14` }}
        >
          <SemaforoBadge nivel={salud.nivel} />
          <p className="text-sm text-gray-700">{t(salud.mensajeKey)}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label={t("dashboard.monthlyIncome")} value={fmt(ingresoMensual)} />
        <KpiCard label={t("dashboard.disposableIncome")} value={fmt(tot.ingresoDisponible)} accent="navy" />
        <KpiCard
          label={t("dashboard.monthBalance")}
          value={fmt(tot.balance)}
          accent={tot.balance >= 0 ? "green" : "red"}
        />
        <KpiCard label={t("dashboard.netWorth")} value={fmt(patrimonioNeto)} accent="gold" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.healthSemaforo")}</CardTitle>
            <Link href="/presupuesto" className="text-xs text-navy-light hover:underline">
              {t("dashboard.viewBudget")}
            </Link>
          </CardHeader>
          <CardBody className="space-y-4">
            {semaforos.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {t("dashboard.pctMeta", {
                        pct: formatoPct(s.pct),
                        meta: formatoPct(s.meta),
                      })}
                    </span>
                    <SemaforoBadge nivel={s.semaforo} />
                  </div>
                </div>
                <ProgressBar
                  value={s.meta ? s.pct / s.meta : 0}
                  color={SEMAFORO_COLOR[s.semaforo]}
                />
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.emergencyFund")}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>{t("dashboard.idealGoal6")}</span>
                  <span className="font-medium">{formatoPct(fondo.pctIdeal)}</span>
                </div>
                <ProgressBar value={fondo.pctIdeal} color="var(--gold)" />
              </div>
              <p className="text-xs text-gray-500">
                {fmt(space.fondo_acumulado)} / {fmt(fondo.metaIdeal)}
              </p>
              <Link href="/fondo-emergencia" className="text-xs text-navy-light hover:underline block pt-1">
                {t("dashboard.viewDetail")}
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.totalDebt")}</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-2xl font-semibold text-red">{fmt(saldoDeudas)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t("dashboard.activeDebts", {
                  n: deudasList.filter((d) => d.estado === "Activa").length,
                })}
              </p>
              <Link href="/deudas" className="text-xs text-navy-light hover:underline block pt-2">
                {t("dashboard.viewDebtPlan")}
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
