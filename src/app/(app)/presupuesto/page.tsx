import Link from "next/link";
import {
  getPersonalContext,
  getFamilyBudgetContext,
  getFamilyRepartoContext,
  rolloverForMe,
  ensurePersonalCategories,
} from "@/lib/data";
import { distribuirBudgetItem, quitarDistribucion } from "../patrimonio/actions";
import type { FondoOption } from "@/components/presupuesto/BudgetRowDialog";
import { calcularTotales, calcularSemaforos, formatoMoneda, formatoPct } from "@/lib/calculations";
import { convertirBudgetItems, convertirDeudas } from "@/lib/currency";
import { tFor } from "@/lib/i18n";
import { SEMAFORO_COLOR } from "@/lib/types";
import type { BudgetItem, Deuda, PersonalBudgetCategory } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthSwitcher } from "@/components/layout/MonthSwitcher";
import { BudgetBoard, type BudgetSection } from "@/components/presupuesto/BudgetBoard";
import { BudgetIO } from "@/components/presupuesto/BudgetIO";
import { AddCategoryForm } from "@/components/presupuesto/AddCategoryForm";
import { CategoryReorder } from "@/components/presupuesto/CategoryReorder";
import { Card, CardBody } from "@/components/ui/Card";
import { SemaforoBadge } from "@/components/ui/Semaforo";
import { InfoHint } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  addBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  applyBudgetOrder,
  addPersonalCategory,
  updatePersonalCategory,
  deletePersonalCategory,
  updateMetaDeuda,
  reorderPersonalCategories,
} from "./actions";

export default async function PresupuestoPage({
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
  // depende de que ensurePersonalCategories/rolloverForMe ya hayan escrito.
  const [, , reparto, fam] = await Promise.all([
    ensurePersonalCategories({ supabase, space }),
    rolloverForMe(anio, mes),
    getFamilyRepartoContext(currency, { supabase, user }),
    getFamilyBudgetContext({ supabase, user }),
  ]);

  const [{ data: cats }, { data: items }, { data: deudas }, { data: fondosPersonales }] =
    await Promise.all([
      supabase
        .from("personal_budget_categories")
        .select("*")
        .eq("space_id", space.id)
        .order("orden", { ascending: true }),
      supabase
        .from("budget_items")
        .select("*")
        .eq("space_id", space.id)
        .eq("mes", mes)
        .eq("anio", anio)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("deudas").select("*").eq("space_id", space.id),
      supabase.from("fondos").select("id, nombre").eq("space_id", space.id),
    ]);

  const { data: fondosFamiliares } = fam
    ? await supabase.from("fondos").select("id, nombre").eq("family_budget_id", fam.familyBudget.id)
    : { data: null };

  const categorias = (cats ?? []) as PersonalBudgetCategory[];
  const budgetItems = (items ?? []) as BudgetItem[];
  const deudasList = (deudas ?? []) as Deuda[];

  const fondosDisponibles: FondoOption[] = [
    ...(fondosPersonales ?? []).map((f) => ({ id: f.id, nombre: f.nombre, compartido: false })),
    ...(fondosFamiliares ?? []).map((f) => ({ id: f.id, nombre: f.nombre, compartido: true })),
  ];

  const ahorroInversionIds = budgetItems
    .filter((i) => i.categoria === "ahorros" || i.categoria === "inversion")
    .map((i) => i.id);
  const { data: movs } = ahorroInversionIds.length
    ? await supabase
        .from("fondo_movimientos")
        .select("budget_item_id, fondo_id")
        .in("budget_item_id", ahorroInversionIds)
    : { data: [] as { budget_item_id: string; fondo_id: string }[] };
  const distribucionMap: Record<string, string> = Object.fromEntries(
    (movs ?? []).map((m) => [m.budget_item_id, m.fondo_id]),
  );

  const aporteFamiliar = reparto ? reparto.shareFor(mes, anio) : 0;

  const itemsPrim = convertirBudgetItems(budgetItems, currency);
  const deudasPrim = convertirDeudas(deudasList, currency);
  const tot = calcularTotales(itemsPrim, deudasPrim, categorias, mes, anio, aporteFamiliar);
  const metaDeuda = Number(space.meta_deuda) || 0;
  const semaforos = calcularSemaforos(tot, categorias, metaDeuda, t("sem.deuda"));
  const semByKey = Object.fromEntries(semaforos.map((s) => [s.key, s]));
  const fmt = (v: number) => formatoMoneda(v, currency.primaria);

  const rowsByClave = (clave: string) =>
    budgetItems
      .filter((i) => i.categoria === clave)
      .map((i) => ({
        id: i.id,
        concepto: i.concepto,
        monto: Number(i.monto),
        moneda: i.moneda,
        automatico: Boolean(i.automatico),
        recurrente: Boolean(i.recurrente),
      }));

  const estructural = (clave: "ingresos" | "rebajos"): BudgetSection => ({
    categoria: clave,
    label: t(`categoria.${clave}`),
    kind: "estructural",
    total: clave === "ingresos" ? tot.ingresos : tot.rebajos,
    items: rowsByClave(clave),
  });

  const dinamicas: BudgetSection[] = categorias.map((c) => {
    const sk = semByKey[c.clave];
    return {
      categoria: c.clave,
      label: c.nombre,
      kind: "dinamica",
      categoriaId: c.id,
      tipo: c.tipo,
      meta: c.meta,
      pct: sk?.pct,
      semaforo: sk?.semaforo,
      total: tot.porCategoria[c.clave] ?? 0,
      extraLine:
        c.clave === "gastos" && aporteFamiliar > 0
          ? { label: t("presupuesto.familyShareLine"), monto: aporteFamiliar, href: "/familiar" }
          : undefined,
      items: rowsByClave(c.clave),
    };
  });

  const sections: BudgetSection[] = [estructural("ingresos"), estructural("rebajos"), ...dinamicas];
  const deudaSem = semByKey["deuda"];

  // --- Avisos de porcentaje --------------------------------------------
  const metasSum = categorias.reduce((a, c) => a + Number(c.meta || 0), 0) + metaDeuda;
  // `totalAsignado` ya incluye el aporte familiar (dentro de "gastos").
  const asignadoSum = tot.totalAsignado + tot.deuda + tot.aporteNoAsignado;
  const asignadoPct = tot.ingresoDisponible > 0 ? asignadoSum / tot.ingresoDisponible : 0;

  const advisorChip = (label: string, val: number) => {
    const d = val - 1;
    const ok = Math.abs(d) <= 0.005;
    const tone = ok ? "verde" : d < 0 ? "amarillo" : "rojo";
    const text = ok
      ? t("presupuesto.advisorOk", { pct: formatoPct(val) })
      : d < 0
        ? t("presupuesto.advisorUnder", { pct: formatoPct(val), rest: formatoPct(-d) })
        : t("presupuesto.advisorOver", { pct: formatoPct(val), rest: formatoPct(d) });
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
        style={{ backgroundColor: `${SEMAFORO_COLOR[tone]}1A`, color: SEMAFORO_COLOR[tone] }}
      >
        <span className="font-semibold">{label}:</span> {text}
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title={t("presupuesto.title")}
        description={t("presupuesto.desc")}
        action={<MonthSwitcher mes={mes} anio={anio} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("presupuesto.disposableIncome")}</p>
          <p className="text-xl font-semibold text-navy">{fmt(tot.ingresoDisponible)}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-gray-500 uppercase">
            {t("presupuesto.debtInstallments")}
            <InfoHint content={t("tip.deudaAuto")} />
          </p>
          <p className="text-xl font-semibold text-red">{fmt(tot.deuda)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("presupuesto.balance")}</p>
          <p className={`text-xl font-semibold ${tot.balance >= 0 ? "text-green" : "text-red"}`}>
            {fmt(tot.balance)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase">{t("presupuesto.balanceOverIncome")}</p>
          <p className="text-xl font-semibold text-navy">
            {formatoPct(tot.ingresoDisponible ? tot.balance / tot.ingresoDisponible : 0)}
          </p>
        </Card>
      </div>

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            {t("presupuesto.advisorTitle")}
            <InfoHint content={t("presupuesto.advisorHint")} />
          </span>
          {advisorChip(t("presupuesto.advisorGoals"), metasSum)}
          {advisorChip(t("presupuesto.advisorAssigned"), asignadoPct)}
        </CardBody>
      </Card>

      <Card className="mb-6 hidden md:block">
        <CardBody className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            {t("xlsx.toolbarTitle")}
            <InfoHint content={t("xlsx.toolbarHint")} />
          </span>
          <BudgetIO scope="personal" mes={mes} anio={anio} />
        </CardBody>
      </Card>

      <CategoryReorder
        items={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
        action={reorderPersonalCategories}
      />

      <BudgetBoard
        sections={sections}
        currency={currency}
        mes={mes}
        anio={anio}
        addAction={addBudgetItem}
        updateAction={updateBudgetItem}
        deleteAction={deleteBudgetItem}
        applyOrder={applyBudgetOrder}
        updateCategoryAction={updatePersonalCategory}
        deleteCategoryAction={deletePersonalCategory}
        fondosDisponibles={fondosDisponibles}
        distribucionMap={distribucionMap}
        distribuirAction={distribuirBudgetItem}
        quitarDistribucionAction={quitarDistribucion}
      />

      <AddCategoryForm action={addPersonalCategory} />

      <Card className="mt-6" id="deuda">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 font-medium text-navy">
              {t("presupuesto.debtSection")}
              {deudaSem?.semaforo && <SemaforoBadge nivel={deudaSem.semaforo} />}
            </p>
            <p className="text-xs text-gray-500">
              {t("presupuesto.debtSectionDesc")}{" "}
              <Link href="/deudas" className="text-navy-light hover:underline">
                {t("presupuesto.debtPlanLink")}
              </Link>
              .
            </p>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">{t("presupuesto.debtInstallments")}</p>
              <p className="text-lg font-semibold text-red">{fmt(tot.deuda)}</p>
            </div>
            <form action={updateMetaDeuda} className="flex items-end gap-2">
              <label className="block text-xs font-medium text-gray-500">
                {t("presupuesto.debtMetaLabel")}
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    name="meta"
                    defaultValue={Number((metaDeuda * 100).toFixed(2))}
                    className="w-28 pr-8"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    %
                  </span>
                </div>
              </label>
              <Button type="submit" variant="secondary">
                {t("common.save")}
              </Button>
            </form>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
