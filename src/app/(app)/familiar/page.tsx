import Link from "next/link";
import {
  getPersonalContext,
  getFamilyBudgetContext,
  getFamilyRepartoContext,
  rolloverForMe,
} from "@/lib/data";
import { formatoMoneda, formatoPct } from "@/lib/calculations";
import { aPrimaria } from "@/lib/currency";
import { tFor, familyCategoryLabel } from "@/lib/i18n";
import type { FamilyBudgetCategory, FamilyBudgetItem, Moneda, Fondo, FondoMovimiento } from "@/lib/types";
import { FondoCard } from "@/components/patrimonio/FondoCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthSwitcher } from "@/components/layout/MonthSwitcher";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { InfoHint } from "@/components/ui/Tooltip";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ExchangeRateWidget } from "@/components/layout/ExchangeRateWidget";
import { FamilyBoard, type FamilySection } from "@/components/familiar/FamilyBoard";
import { BudgetIO } from "@/components/presupuesto/BudgetIO";
import { CategoryReorder } from "@/components/presupuesto/CategoryReorder";
import {
  addFamilyItem,
  updateFamilyItem,
  deleteFamilyItem,
  addFamilyCategory,
  deleteFamilyCategory,
  updateFamilyTipoCambio,
  applyFamilyOrder,
  reorderFamilyCategories,
} from "./actions";

export default async function FamiliarPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string }>;
}) {
  const { supabase: personalSupabase, user, locale } = await getPersonalContext();
  const t = tFor(locale);
  const fam = await getFamilyBudgetContext({ supabase: personalSupabase, user });

  if (!fam) {
    return (
      <div>
        <PageHeader title={t("familiar.title")} description={t("familiar.descShort")} />
        <Card>
          <CardBody className="text-sm text-gray-600">
            {t("familiar.notLinked")}{" "}
            <Link href="/config" className="text-navy-light hover:underline">
              {t("familiar.configLink")}
            </Link>
            .
          </CardBody>
        </Card>
      </div>
    );
  }

  const { supabase, familyBudget, members, currency } = fam;
  const now = new Date();
  const sp = await searchParams;
  const mes = Number(sp.mes) || now.getMonth() + 1;
  const anio = Number(sp.anio) || now.getFullYear();

  // Ninguna depende de la otra: en paralelo. La siguiente tanda de selects sí
  // depende de que rolloverForMe ya haya escrito.
  const [, reparto] = await Promise.all([
    rolloverForMe(anio, mes),
    getFamilyRepartoContext(currency, { supabase: personalSupabase, user }),
  ]);

  const [{ data: cats }, { data: items }, { data: fondosFam }, { data: roster }] = await Promise.all([
    supabase
      .from("family_budget_categories")
      .select("*")
      .eq("family_budget_id", familyBudget.id)
      .order("orden", { ascending: true }),
    supabase
      .from("family_budget_items")
      .select("*")
      .eq("family_budget_id", familyBudget.id)
      .eq("mes", mes)
      .eq("anio", anio)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("fondos").select("*").eq("family_budget_id", familyBudget.id).order("orden"),
    supabase.rpc("family_patrimonio_roster"),
  ]);

  const fondosFamiliares = (fondosFam ?? []) as Fondo[];
  const fondoIds = fondosFamiliares.map((f) => f.id);
  const { data: movsFam } = fondoIds.length
    ? await supabase.from("fondo_movimientos").select("*").in("fondo_id", fondoIds)
    : { data: [] as FondoMovimiento[] };
  const movsFamList = (movsFam ?? []) as FondoMovimiento[];
  const saldoFondoFamiliar = (fondoId: string) =>
    movsFamList.filter((m) => m.fondo_id === fondoId).reduce((a, m) => a + Number(m.monto), 0);
  const totalFondosCompartidos = fondosFamiliares.reduce(
    (a, f) => a + aPrimaria(saldoFondoFamiliar(f.id), f.moneda, currency),
    0,
  );
  const rosterList = (roster ?? []) as {
    user_id: string;
    display_name: string;
    total_crc: number;
    total_usd: number;
  }[];
  const totalFondosPersonales = rosterList.reduce(
    (a, r) =>
      a +
      aPrimaria(Number(r.total_crc), "CRC", currency) +
      aPrimaria(Number(r.total_usd), "USD", currency),
    0,
  );
  const patrimonioFamiliarTotal = totalFondosCompartidos + totalFondosPersonales;

  const categorias = (cats ?? []) as FamilyBudgetCategory[];
  const itemsList = (items ?? []) as FamilyBudgetItem[];
  const fmt = (v: number) => formatoMoneda(v, currency.primaria);
  const enPrimaria = (it: { monto: number; moneda: Moneda }) =>
    aPrimaria(Number(it.monto), it.moneda, currency);

  const totalGastosMes = itemsList.reduce((a, it) => a + enPrimaria(it), 0);
  const detalle = reparto ? reparto.detalle(mes, anio) : [];
  const secundaria: Moneda | null =
    currency.activas.find((m) => m !== currency.primaria) ?? null;

  const sections: FamilySection[] = categorias.map((cat) => {
    const catItems = itemsList.filter((it) => it.categoria === cat.nombre);
    return {
      key: cat.nombre,
      label: familyCategoryLabel(cat.nombre, locale),
      categoriaId: cat.id,
      total: catItems.reduce((a, it) => a + enPrimaria(it), 0),
      items: catItems.map((it) => ({
        id: it.id,
        concepto: it.concepto,
        monto: Number(it.monto),
        moneda: it.moneda,
        automatico: Boolean(it.automatico),
        recurrente: Boolean(it.recurrente),
      })),
    };
  });

  return (
    <div>
      <PageHeader
        title={t("familiar.title")}
        description={t("familiar.descLong")}
        action={<MonthSwitcher mes={mes} anio={anio} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("familiar.totalMonthExpenses")}</p>
          <p className="text-xl font-semibold text-navy">{fmt(totalGastosMes)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("familiar.linkedAccounts")}</p>
          <p className="text-xl font-semibold text-navy">{members.length}</p>
        </Card>
        <Card className="p-4 flex flex-col gap-2">
          <p className="flex items-center gap-1 text-xs text-gray-500 uppercase">
            {t("familiar.familyExchangeRate")}
            <InfoHint content={t("tip.fxFamiliar")} />
          </p>
          {secundaria ? (
            <ExchangeRateWidget
              primaria={currency.primaria}
              secundaria={secundaria}
              tipoCambio={currency.tipoCambio}
              updateAction={updateFamilyTipoCambio}
            />
          ) : (
            <p className="text-sm text-gray-400">{t("common.oneCurrencyActive")}</p>
          )}
        </Card>
      </div>

      <Card className="mb-6 hidden md:block">
        <CardBody className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            {t("xlsx.toolbarTitle")}
            <InfoHint content={t("xlsx.toolbarHint")} />
          </span>
          <BudgetIO scope="family" mes={mes} anio={anio} />
        </CardBody>
      </Card>

      <CategoryReorder
        items={categorias.map((c) => ({ id: c.id, label: familyCategoryLabel(c.nombre, locale) }))}
        action={reorderFamilyCategories}
      />

      <FamilyBoard
        sections={sections}
        currency={currency}
        mes={mes}
        anio={anio}
        addAction={addFamilyItem}
        updateAction={updateFamilyItem}
        deleteAction={deleteFamilyItem}
        deleteCategoryAction={deleteFamilyCategory}
        applyOrder={applyFamilyOrder}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("familiar.addCategory")}</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={addFamilyCategory} className="flex items-end gap-2 max-w-sm">
            <Field label={t("familiar.categoryName")}>
              <Input name="nombre" placeholder={t("familiar.categoryNamePh")} required />
            </Field>
            <Button type="submit" variant="secondary">
              {t("common.add")}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            {t("familiar.splitTitle")}
            <InfoHint content={t("tip.reparto")} />
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-xs text-gray-500 mb-4">
            {t("familiar.splitDesc", { total: fmt(totalGastosMes) })}
          </p>
          <ul className="divide-y divide-border text-sm">
            {detalle.map((d) => (
              <li key={d.userId} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{d.nombre || "—"}</span>
                  <span className="font-semibold text-navy">{fmt(d.monto)}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {fmt(d.peso)}{" "}
                  {d.fuente === "fijo" ? t("familiar.sourceFixed") : t("familiar.sourceDisposable")}
                  {" · "}
                  {t("familiar.repartoCalc", {
                    peso: fmt(d.peso),
                    total: fmt(d.pesoTotal),
                    pct: formatoPct(d.fraccion),
                  })}
                </p>
              </li>
            ))}
            {detalle.length === 0 && (
              <li className="py-2 text-gray-400">{t("familiar.noMembers")}</li>
            )}
          </ul>
          {detalle.length > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-gray-400">
              {t("familiar.repartoFormula")}
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("familiar.patrimonioTitle")}</CardTitle>
          <span className="text-sm font-semibold text-navy">
            {formatoMoneda(patrimonioFamiliarTotal, currency.primaria)}
          </span>
        </CardHeader>
        <CardBody>
          <p className="text-xs text-gray-500 mb-4">{t("familiar.patrimonioDesc")}</p>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("familiar.patrimonioPerMember")}
          </p>
          <ul className="divide-y divide-border text-sm mb-5">
            {rosterList.map((r) => (
              <li key={r.user_id} className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-700">{r.display_name || "—"}</span>
                <span className="text-navy">
                  {formatoMoneda(
                    aPrimaria(Number(r.total_crc), "CRC", currency) +
                      aPrimaria(Number(r.total_usd), "USD", currency),
                    currency.primaria,
                  )}
                </span>
              </li>
            ))}
            {rosterList.length === 0 && (
              <li className="py-2 text-gray-400">{t("familiar.noMembers")}</li>
            )}
          </ul>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("familiar.sharedFunds")}
          </p>
          <div className="space-y-2">
            {fondosFamiliares.map((f) => (
              <FondoCard
                key={f.id}
                id={f.id}
                nombre={f.nombre}
                tipo={f.tipo}
                moneda={f.moneda}
                saldo={saldoFondoFamiliar(f.id)}
                compartido
              />
            ))}
            {fondosFamiliares.length === 0 && (
              <p className="text-sm text-gray-400">
                {t("familiar.noSharedFunds")}{" "}
                <Link href="/patrimonio" className="text-navy-light hover:underline">
                  {t("nav.patrimonio")}
                </Link>
                .
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
