import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  FamilyBudget,
  FamilyBudgetMember,
  Moneda,
  PersonalSpace,
} from "@/lib/types";
import { aPrimaria, type CurrencyConfig } from "@/lib/currency";
import { normalizeLocale } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/locale";

type MonedaConfigRow = {
  monedas_activas: Moneda[] | null;
  moneda_primaria: Moneda | null;
  tipo_cambio: number | null;
};

/** Deriva la config de monedas (primaria / activas / tipo de cambio) de una fila. */
export function deriveCurrency(row: MonedaConfigRow): CurrencyConfig {
  const activasRaw = (row.monedas_activas ?? ["CRC"]) as Moneda[];
  const activas =
    Array.isArray(activasRaw) && activasRaw.length ? activasRaw : (["CRC"] as Moneda[]);
  const primaria: Moneda =
    row.moneda_primaria && activas.includes(row.moneda_primaria)
      ? row.moneda_primaria
      : activas[0];
  return { primaria, activas, tipoCambio: Number(row.tipo_cambio) || 0 };
}

/**
 * Contexto del espacio personal privado del usuario actual. Si aún no tiene
 * uno (cuenta nueva, o cuenta que quedó sin migrar), lo crea al vuelo.
 *
 * `cache()` de React deduplica esto dentro de una misma navegación: el layout
 * raíz la llama (para el nombre/avatar del menú) y casi toda página la vuelve
 * a llamar por su cuenta — sin esto, cada clic pegaba dos veces a Supabase
 * (auth + el select de personal_spaces) antes de siquiera tocar los datos
 * propios de la pantalla.
 */
export const getPersonalContext = cache(async function getPersonalContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: space } = await supabase
    .from("personal_spaces")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle<PersonalSpace>();

  if (!space) {
    // Alta atómica: `upsert` con conflicto en owner_id devuelve la fila exista o
    // no (sin la carrera de insert-y-luego-select). Sembramos el idioma con el
    // que eligió en las banderas de login/registro.
    const idioma = await getRequestLocale();
    const { data: created, error } = await supabase
      .from("personal_spaces")
      .upsert({ owner_id: user.id, idioma }, { onConflict: "owner_id" })
      .select("*")
      .maybeSingle<PersonalSpace>();
    if (!created) {
      throw new Error(
        `No se pudo crear/cargar tu espacio personal${
          error ? ` (${error.message})` : ""
        }. Revisa las políticas RLS de "personal_spaces" (SELECT e INSERT/UPDATE).`,
      );
    }
    space = created;
  }

  return {
    supabase,
    user,
    space,
    currency: deriveCurrency(space),
    locale: normalizeLocale(space.idioma),
  };
});

/**
 * Copia las líneas recurrentes (del espacio personal del usuario Y de su
 * Presupuesto Familiar) al mes indicado, si ese mes está vacío y es igual o
 * posterior al último mes con datos. Lo hace la función SQL `rollover_for_me`
 * (idempotente). El pago mensual real de deudas NO ocurre acá — solo desde el
 * cron `run_monthly_rollover`.
 */
export async function rolloverForMe(anio: number, mes: number): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("rollover_for_me", { p_anio: anio, p_mes: mes });
}

/** Métodos de pago por defecto para una cuenta nueva (editables después). */
export const DEFAULT_PAYMENT_METHODS = [
  "Efectivo",
  "Tarjeta de Débito",
  "Tarjeta de Crédito",
  "SINPE Móvil",
  "Transferencia Bancaria",
];

/**
 * Siembra los métodos de pago por defecto si la cuenta no tiene ninguno.
 * Se llama al abrir /sobres y /config. Idempotente.
 */
export async function ensurePaymentMethods(ctx?: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
}) {
  // Si el caller ya resolvió sesión/cliente (p. ej. via getPersonalContext),
  // los reutiliza en vez de repetir el viaje de red a auth.getUser().
  const supabase = ctx?.supabase ?? (await createClient());
  const user =
    ctx?.user ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) return;

  const { count } = await supabase
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) return;

  await supabase.from("payment_methods").insert(
    DEFAULT_PAYMENT_METHODS.map((nombre, i) => ({
      user_id: user.id,
      nombre,
      orden: i,
    })),
  );
}

/** Las 6 categorías base del presupuesto personal (semilla para cuentas nuevas). */
export const DEFAULT_PERSONAL_CATEGORIES: {
  clave: string;
  nombreEs: string;
  nombreEn: string;
  tipo: "maximo" | "minimo";
  meta: number;
}[] = [
  { clave: "gastos", nombreEs: "Gastos", nombreEn: "Expenses", tipo: "maximo", meta: 0.5 },
  { clave: "ahorros", nombreEs: "Ahorros", nombreEn: "Savings", tipo: "minimo", meta: 0.1 },
  { clave: "inversion", nombreEs: "Inversión", nombreEn: "Investment", tipo: "minimo", meta: 0.1 },
  { clave: "jugar", nombreEs: "Jugar", nombreEn: "Play", tipo: "maximo", meta: 0.1 },
  { clave: "donativos", nombreEs: "Donativos", nombreEn: "Donations", tipo: "minimo", meta: 0.1 },
  { clave: "formacion", nombreEs: "Formación", nombreEn: "Education", tipo: "minimo", meta: 0.1 },
];

/**
 * Siembra las 6 categorías base si el espacio personal no tiene ninguna.
 * Se llama al abrir /presupuesto, /dashboard y /sobres/nuevo. Idempotente.
 */
export async function ensurePersonalCategories(ctx?: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  space: { id: string; idioma: string };
}) {
  // Si el caller ya resolvió cliente/espacio (p. ej. via getPersonalContext),
  // los reutiliza en vez de repetir auth.getUser() + el select de personal_spaces.
  let supabase = ctx?.supabase;
  let space = ctx?.space ?? null;
  if (!supabase) {
    supabase = await createClient();
  }
  if (!space) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("personal_spaces")
      .select("id, idioma")
      .eq("owner_id", user.id)
      .maybeSingle<{ id: string; idioma: string }>();
    if (!data) return;
    space = data;
  }

  const { count } = await supabase
    .from("personal_budget_categories")
    .select("id", { count: "exact", head: true })
    .eq("space_id", space.id);
  if ((count ?? 0) > 0) return;

  const es = space.idioma !== "en";
  await supabase.from("personal_budget_categories").insert(
    DEFAULT_PERSONAL_CATEGORIES.map((c, i) => ({
      space_id: space.id,
      clave: c.clave,
      nombre: es ? c.nombreEs : c.nombreEn,
      tipo: c.tipo,
      meta: c.meta,
      orden: i + 1,
    })),
  );
}

export type FamilyBudgetContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  familyBudget: FamilyBudget;
  members: FamilyBudgetMember[];
  currency: CurrencyConfig;
};

/**
 * Contexto del Presupuesto Familiar del usuario, o `null` si su cuenta no está
 * vinculada a ninguno.
 */
export async function getFamilyBudgetContext(ctx?: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
}): Promise<FamilyBudgetContext | null> {
  // Si el caller ya resolvió sesión/cliente (p. ej. via getPersonalContext),
  // los reutiliza en vez de repetir el viaje de red a auth.getUser().
  const supabase = ctx?.supabase ?? (await createClient());
  let user = ctx?.user ?? null;
  if (!user) {
    const {
      data: { user: fetched },
    } = await supabase.auth.getUser();
    if (!fetched) redirect("/login");
    user = fetched;
  }

  const { data: membership } = await supabase
    .from("family_budget_members")
    .select("family_budget_id")
    .eq("user_id", user.id)
    .maybeSingle<{ family_budget_id: string }>();

  if (!membership) return null;

  const { data: familyBudget } = await supabase
    .from("family_budgets")
    .select("*")
    .eq("id", membership.family_budget_id)
    .maybeSingle<FamilyBudget>();

  if (!familyBudget) return null;

  // Los nombres y salarios de los demás miembros viven en sus espacios
  // personales (privados), así que se leen por una función SECURITY DEFINER.
  const { data: roster } = await supabase.rpc("family_budget_roster");

  const members: FamilyBudgetMember[] = (
    (roster ?? []) as {
      user_id: string;
      display_name: string;
      salario_mensual: number;
      salario_fuente: string | null;
      joined_at: string;
    }[]
  ).map((r) => ({
    id: r.user_id,
    family_budget_id: familyBudget.id,
    user_id: r.user_id,
    joined_at: r.joined_at,
    display_name: r.display_name,
    salario_mensual: Number(r.salario_mensual) || 0,
    salario_fuente: r.salario_fuente === "fijo" ? "fijo" : "disponible",
  }));

  return {
    supabase,
    user,
    familyBudget,
    members,
    currency: deriveCurrency(familyBudget),
  };
}

/**
 * Saldo total de todos los fondos de inversión/ahorro de una cuenta (los
 * personales, y los familiares compartidos si aplica) — es una suma de sus
 * movimientos, igual que en la página de detalle de cada fondo. Centralizado
 * acá porque el patrimonio neto se muestra en varias páginas (Dashboard,
 * Patrimonio, el asistente IA) y todas deben coincidir.
 */
export async function getTotalFondos(ctx: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  space: { id: string };
  familyBudgetId?: string | null;
  currency: CurrencyConfig;
}): Promise<number> {
  const { supabase, space, familyBudgetId, currency } = ctx;
  const queries = [supabase.from("fondos").select("id, moneda").eq("space_id", space.id)];
  if (familyBudgetId) {
    queries.push(supabase.from("fondos").select("id, moneda").eq("family_budget_id", familyBudgetId));
  }
  const results = await Promise.all(queries);
  const fondosList = results.flatMap((r) => (r.data ?? []) as { id: string; moneda: Moneda }[]);
  if (fondosList.length === 0) return 0;

  const { data: movimientos } = await supabase
    .from("fondo_movimientos")
    .select("fondo_id, monto")
    .in(
      "fondo_id",
      fondosList.map((f) => f.id),
    );
  const monedaPorFondo = new Map(fondosList.map((f) => [f.id, f.moneda]));
  return ((movimientos ?? []) as { fondo_id: string; monto: number }[]).reduce(
    (a, m) => a + aPrimaria(Number(m.monto), monedaPorFondo.get(m.fondo_id) ?? currency.primaria, currency),
    0,
  );
}

/**
 * Reparto proporcional del Presupuesto Familiar. El "peso" de cada miembro para
 * un mes es su monto fijo (salario_fuente = 'fijo') o su Ingreso Disponible de
 * ese mes (salario_fuente = 'disponible', por defecto).
 *
 *   aporte_i(mes) = (peso_i / Σ pesos) × total de gastos del familiar ese mes
 *
 * Devuelve `null` si la cuenta no está en un Presupuesto Familiar.
 */
export async function getFamilyRepartoContext(
  personalCurrency: CurrencyConfig,
  ctx?: { supabase: Awaited<ReturnType<typeof createClient>>; user: User },
) {
  const fam = await getFamilyBudgetContext(ctx);
  if (!fam) return null;

  const { supabase, familyBudget, members, currency, user } = fam;

  const [{ data: rowsRaw }, { data: dispRaw }] = await Promise.all([
    supabase
      .from("family_budget_items")
      .select("monto, moneda, mes, anio")
      .eq("family_budget_id", familyBudget.id),
    supabase.rpc("family_member_disponible"),
  ]);

  const rows = (rowsRaw ?? []) as { monto: number; moneda: Moneda; mes: number; anio: number }[];

  const dispMap = new Map<string, number>();
  for (const d of (dispRaw ?? []) as {
    user_id: string;
    anio: number;
    mes: number;
    disponible: number;
  }[]) {
    dispMap.set(`${d.user_id}|${d.anio}|${d.mes}`, Number(d.disponible) || 0);
  }

  const pesoDe = (m: FamilyBudgetMember, mes: number, anio: number) =>
    m.salario_fuente === "fijo"
      ? Number(m.salario_mensual) || 0
      : Math.max(dispMap.get(`${m.user_id}|${anio}|${mes}`) ?? 0, 0);

  const totalGastos = (mes: number, anio: number) =>
    rows
      .filter((r) => r.mes === mes && r.anio === anio)
      .reduce((a, r) => a + aPrimaria(Number(r.monto), r.moneda, currency), 0);

  return {
    /** Aporte del usuario para (mes, anio), en la moneda primaria personal. */
    shareFor(mes: number, anio: number): number {
      const pesos = members.map((m) => pesoDe(m, mes, anio));
      const suma = pesos.reduce((a, b) => a + b, 0);
      const i = members.findIndex((m) => m.user_id === user.id);
      const fraccion = suma > 0 && i >= 0 ? pesos[i] / suma : 0;
      return aPrimaria(totalGastos(mes, anio) * fraccion, currency.primaria, personalCurrency);
    },

    /** Detalle por miembro para (mes, anio), en la moneda del Presupuesto Familiar. */
    detalle(mes: number, anio: number) {
      const pesos = members.map((m) => pesoDe(m, mes, anio));
      const suma = pesos.reduce((a, b) => a + b, 0);
      const total = totalGastos(mes, anio);
      return members.map((m, idx) => {
        const fraccion = suma > 0 ? pesos[idx] / suma : 0;
        return {
          userId: m.user_id,
          nombre: m.display_name,
          fuente: m.salario_fuente,
          /** monto base que pondera a este miembro (salario fijo o ingreso disponible del mes) */
          peso: pesos[idx],
          /** suma de los pesos de todos los miembros ese mes */
          pesoTotal: suma,
          fraccion,
          monto: total * fraccion,
        };
      });
    },
  };
}
