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
  calcularPosicionPatrimonial,
  simularSnowball,
  edadDesde,
  formatoMoneda,
  formatoPct,
} from "@/lib/calculations";
import { convertirBudgetItems, convertirDeudas, aPrimaria } from "@/lib/currency";
import { resumenSobre } from "@/lib/envelopes";
import { mesesLabel, type Locale } from "@/lib/i18n";
import type {
  BudgetItem,
  Deuda,
  Activo,
  PersonalBudgetCategory,
  Envelope,
  EnvelopeMovement,
  Semaforo,
} from "@/lib/types";

const SEM_ES: Record<Semaforo, string> = {
  verde: "verde",
  amarillo: "amarillo",
  naranja: "naranja",
  rojo: "rojo",
};
const SEM_EN: Record<Semaforo, string> = {
  verde: "green",
  amarillo: "yellow",
  naranja: "orange",
  rojo: "red",
};

const SALUD_TXT: Record<string, { es: string; en: string }> = {
  "salud.deficit": { es: "déficit (gastás más de lo que entra)", en: "deficit (spending more than income)" },
  "salud.saludable": { es: "saludable", en: "healthy" },
  "salud.riesgo": { es: "en riesgo", en: "at risk" },
  "salud.estable": { es: "estable", en: "stable" },
};

/**
 * Junta todo lo que el asistente necesita: el resumen financiero compacto del
 * mes actual (en el idioma de la persona), sus instrucciones personalizadas, y
 * las piezas para el límite de uso. Reusa `getPersonalContext` (exige sesión).
 */
export async function assembleAssistantPayload() {
  const { supabase, space, currency, user, locale } = await getPersonalContext();

  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  const fam = await getFamilyBudgetContext({ supabase, user });

  const [
    ,
    { data: items },
    { data: deudas },
    { data: activos },
    { data: cats },
    { data: envs },
    totalFondos,
  ] = await Promise.all([
    ensurePersonalCategories({ supabase, space }),
    supabase.from("budget_items").select("*").eq("space_id", space.id).eq("mes", mes).eq("anio", anio),
    supabase.from("deudas").select("*").eq("space_id", space.id),
    supabase.from("activos").select("*").eq("space_id", space.id),
    supabase.from("personal_budget_categories").select("*").eq("space_id", space.id).order("orden", { ascending: true }),
    supabase.from("envelopes").select("*").order("orden", { ascending: true }),
    getTotalFondos({ supabase, space, familyBudgetId: fam?.familyBudget.id, currency }),
  ]);

  const categorias = (cats ?? []) as PersonalBudgetCategory[];
  const budgetItems = convertirBudgetItems((items ?? []) as BudgetItem[], currency);
  const deudasList = convertirDeudas((deudas ?? []) as Deuda[], currency);
  const activosList = (activos ?? []) as Activo[];
  const envelopes = (envs ?? []) as Envelope[];

  const envIds = envelopes.map((e) => e.id);
  const { data: movRaw } = envIds.length
    ? await supabase.from("envelope_movements").select("*").in("envelope_id", envIds)
    : { data: [] as EnvelopeMovement[] };
  const movsByEnv = new Map<string, EnvelopeMovement[]>();
  for (const m of (movRaw ?? []) as EnvelopeMovement[]) {
    const arr = movsByEnv.get(m.envelope_id);
    if (arr) arr.push(m);
    else movsByEnv.set(m.envelope_id, [m]);
  }

  const reparto = await getFamilyRepartoContext(currency, { supabase, user });
  const aporteFamiliar = reparto ? reparto.shareFor(mes, anio) : 0;

  const metaDeuda = Number(space.meta_deuda) || 0;
  const tot = calcularTotales(budgetItems, deudasList, categorias, mes, anio, aporteFamiliar);
  const semaforos = calcularSemaforos(tot, categorias, metaDeuda, locale === "en" ? "Debt" : "Deuda");
  const fondo = calcularFondoEmergencia(tot, 0, space);
  const salud = saludFinancieraGeneral(tot, categorias, metaDeuda, fondo.pctIdeal);

  const totalActivos = activosList.reduce((a, x) => a + aPrimaria(Number(x.valor), x.moneda, currency), 0);
  const deudasActivas = deudasList.filter((d) => d.estado === "Activa");
  const saldoDeudas = deudasActivas.reduce((a, d) => a + Number(d.saldo_actual), 0);
  const patrimonioNeto = totalFondos + totalActivos - saldoDeudas;

  const edad = edadDesde(space.fecha_nacimiento);
  const posicion = calcularPosicionPatrimonial(Number(space.salario_mensual) * 12, edad, patrimonioNeto);
  const snowball = simularSnowball(deudasActivas, Number(space.pago_extra_base) || 0);

  const resumen = formatResumen({
    locale,
    mes,
    anio,
    moneda: currency.primaria,
    tot,
    semaforos,
    saludKey: salud.mensajeKey,
    categorias,
    aporteFamiliar,
    patrimonio: { totalFondos, totalActivos, totalPasivos: saldoDeudas, patrimonioNeto, edad, posicion },
    deudas: { saldo: saldoDeudas, n: deudasActivas.length, snowball },
    fondo,
    fondoAcumulado: Number(space.fondo_acumulado) || 0,
    sobres: envelopes.map((e) => ({ env: e, r: resumenSobre(e, movsByEnv.get(e.id) ?? []) })),
    salarioMensual: Number(space.salario_mensual) || 0,
  });

  return {
    supabase,
    spaceId: space.id,
    locale,
    instrucciones: space.asistente_instrucciones?.trim() || null,
    resumen,
  };
}

type FormatArgs = {
  locale: Locale;
  mes: number;
  anio: number;
  moneda: "CRC" | "USD";
  tot: ReturnType<typeof calcularTotales>;
  semaforos: ReturnType<typeof calcularSemaforos>;
  saludKey: string;
  categorias: PersonalBudgetCategory[];
  aporteFamiliar: number;
  patrimonio: {
    totalFondos: number;
    totalActivos: number;
    totalPasivos: number;
    patrimonioNeto: number;
    edad: number | null;
    posicion: ReturnType<typeof calcularPosicionPatrimonial>;
  };
  deudas: { saldo: number; n: number; snowball: ReturnType<typeof simularSnowball> };
  fondo: ReturnType<typeof calcularFondoEmergencia>;
  fondoAcumulado: number;
  sobres: { env: Envelope; r: ReturnType<typeof resumenSobre> }[];
  salarioMensual: number;
};

function formatResumen(a: FormatArgs): string {
  const en = a.locale === "en";
  const L = (es: string, eng: string) => (en ? eng : es);
  const sem = en ? SEM_EN : SEM_ES;
  const m = (v: number) => formatoMoneda(v, a.moneda);
  const p = (v: number) => formatoPct(v);
  const mesNombre = mesesLabel(a.locale)[a.mes - 1];

  const lines: string[] = [];
  lines.push(`${L("FECHA", "DATE")}: ${mesNombre} ${a.anio} · ${L("Moneda", "Currency")}: ${a.moneda}`);
  lines.push("");

  lines.push(L("MES ACTUAL", "CURRENT MONTH"));
  lines.push(`- ${L("Salario mensual", "Monthly salary")}: ${m(a.salarioMensual)}`);
  lines.push(`- ${L("Ingreso disponible", "Disposable income")}: ${m(a.tot.ingresoDisponible)}`);
  lines.push(
    `- ${L("Balance del mes", "Month balance")}: ${m(a.tot.balance)} (${p(
      a.tot.ingresoDisponible ? a.tot.balance / a.tot.ingresoDisponible : 0,
    )} ${L("del ingreso disponible", "of disposable income")})`,
  );
  if (a.aporteFamiliar > 0) {
    lines.push(`- ${L("Aporte al Presupuesto Familiar", "Family Budget contribution")}: ${m(a.aporteFamiliar)}`);
  }
  lines.push(`- ${L("Por categoría", "By category")}:`);
  for (const c of a.categorias) {
    const s = a.semaforos.find((x) => x.key === c.clave);
    if (!s) continue;
    lines.push(
      `  · ${c.nombre}: ${m(s.valor)} — ${L("semáforo", "light")} ${sem[s.semaforo]}, ${L(
        "meta",
        "target",
      )} ${p(c.meta)} (${c.tipo === "maximo" ? L("máx.", "max") : L("mín.", "min")}), ${L("va", "at")} ${p(s.pct)}`,
    );
  }
  const sd = a.semaforos.find((x) => x.key === "deuda");
  lines.push(
    `- ${L("Cuotas de deuda del mes", "Debt payments this month")}: ${m(a.tot.deuda)}${
      sd ? ` — ${L("semáforo", "light")} ${sem[sd.semaforo]}, ${L("va", "at")} ${p(sd.pct)}` : ""
    }`,
  );
  lines.push(
    `- ${L("Salud financiera general", "Overall financial health")}: ${
      en ? SALUD_TXT[a.saludKey]?.en : SALUD_TXT[a.saludKey]?.es
    }`,
  );
  lines.push("");

  lines.push(L("PATRIMONIO", "NET WORTH"));
  lines.push(
    `- ${L("Fondos de inversión/ahorro", "Investment/savings funds")}: ${m(a.patrimonio.totalFondos)} · ${L(
      "Activos",
      "Assets",
    )}: ${m(a.patrimonio.totalActivos)} · ${L("Deudas", "Debts")}: ${m(
      a.patrimonio.totalPasivos,
    )} · ${L("Patrimonio neto", "Net worth")}: ${m(a.patrimonio.patrimonioNeto)}`,
  );
  if (a.patrimonio.edad && a.patrimonio.posicion.posicion) {
    lines.push(
      `- ${L("Método Millonario de al lado", "Millionaire Next Door method")} (${L("edad", "age")} ${
        a.patrimonio.edad
      }): ${L("posición", "position")} ${a.patrimonio.posicion.posicion}, ${L(
        "patrimonio deseado",
        "target net worth",
      )} ${m(a.patrimonio.posicion.patrimonioDeseado)}`,
    );
  }
  lines.push("");

  lines.push(L("DEUDAS", "DEBTS"));
  if (a.deudas.n === 0) {
    lines.push(`- ${L("Sin deudas activas.", "No active debts.")}`);
  } else {
    lines.push(
      `- ${L("Saldo total activo", "Total active balance")}: ${m(a.deudas.saldo)} · ${a.deudas.n} ${L(
        "deuda(s) activa(s)",
        "active debt(s)",
      )}`,
    );
    const mpl = a.deudas.snowball.mesesParaLibertad;
    lines.push(
      `- ${L("Meses para libertad (bola de nieve)", "Months to freedom (snowball)")}: ${
        mpl == null ? L("más de 20 años", "over 20 years") : mpl
      }`,
    );
    if (a.deudas.snowball.ahorroEnIntereses > 0) {
      lines.push(
        `- ${L("Ahorro en intereses vs. pagar solo mínimos", "Interest saved vs. minimums only")}: ${m(
          a.deudas.snowball.ahorroEnIntereses,
        )}`,
      );
    }
  }
  lines.push("");

  const sobresActivos = a.sobres;
  if (sobresActivos.length) {
    lines.push(L("SOBRES", "ENVELOPES"));
    for (const { env, r } of sobresActivos) {
      lines.push(
        `- ${env.nombre}: ${L("disponible", "available")} ${m(r.disponible)} ${L("de", "of")} ${m(
          r.total + r.ingresos,
        )} (${L("gastado", "spent")} ${m(r.gastado)}, ${L("semáforo", "light")} ${sem[r.semaforo]})`,
      );
    }
    lines.push("");
  }

  lines.push(L("FONDO DE EMERGENCIA", "EMERGENCY FUND"));
  lines.push(
    `- ${L("Acumulado", "Saved")}: ${m(a.fondoAcumulado)} · ${L("meta ideal", "ideal goal")}: ${m(
      a.fondo.metaIdeal,
    )} (${p(a.fondo.pctIdealReal)}) · ${L("gasto mensual real", "real monthly spend")}: ${m(
      a.fondo.gastoMensualReal,
    )}`,
  );

  return lines.join("\n");
}

/** System prompt: reglas + contexto financiero + instrucciones de la persona. */
export function buildSystemPrompt(
  locale: Locale,
  resumen: string,
  instrucciones: string | null,
): string {
  const base =
    locale === "en"
      ? EN_BASE
      : ES_BASE;

  const ctxHeader =
    locale === "en"
      ? "\n\n=== USER'S FINANCIAL CONTEXT (current month) ===\n"
      : "\n\n=== CONTEXTO FINANCIERO DE LA PERSONA (mes actual) ===\n";

  let out = base + ctxHeader + resumen;

  if (instrucciones) {
    out +=
      locale === "en"
        ? "\n\n=== THE PERSON'S OWN INSTRUCTIONS & NOTES ===\n(They wrote this to personalize your answers. Follow it unless it conflicts with the rules above.)\n"
        : "\n\n=== INSTRUCCIONES Y NOTAS DE LA PERSONA ===\n(Lo escribió para personalizar tus respuestas. Seguilo mientras no contradiga las reglas de arriba.)\n";
    out += instrucciones;
  }

  return out;
}

const ES_BASE = `Te llamás **Lía**. Sos la asistente de Finéticap, una app personal de finanzas: una mujer cálida, cercana y práctica. Hablás en primera persona ("yo", "te ayudo"), con voseo costarricense (vos, tenés, mirá, dale), en tono amable pero directo — sin rodeos ni sonar a folleto. Un emoji ocasional está bien, no en cada mensaje. Si te preguntan quién sos: sos Lía, la asistente de Finéticap (no una persona real).

El método de la app: presupuesto por categorías editables (Gastos, Ahorros, Inversión, Jugar, Donativos, Formación…), semáforos por meta (verde/amarillo/naranja/rojo), plan de deudas "bola de nieve", Fondo de Emergencia (meses de gasto real) y Patrimonio Neto con el método "El millonario de la puerta de al lado" (patrimonio deseado = salario anual × edad ÷ 10; posiciones PAR/MAR/SAR).

Tu rol:
- Ayudás a la persona a ENTENDER sus propios números y la metodología de la app. Sos educativo, descriptivo y concreto.
- Apoyate en el contexto de abajo; si un dato no está, decilo en vez de inventarlo. Nunca inventes cifras.
- NO sos asesor financiero licenciado. No des recomendaciones personalizadas de inversión ni consejos como si fueras un asesor certificado (qué acción/fondo/cripto comprar, cuánto invertir, decisiones fiscales o legales concretas). Si te lo piden, aclará que no sos un asesor financiero licenciado y sugerí consultar a uno.
- Podés explicar conceptos generales, la metodología de la app y qué muestran los números de la persona.

Formato de la respuesta:
- Escribí en español y en **Markdown**.
- Sé conciso: 120–180 palabras salvo que pidan más detalle. Respondé lo que preguntan; no vuelques todo el contexto.
- Usá **negrita** para las cifras y los términos clave, y listas con "- " cuando enumeres. Subtítulos "###" solo si la respuesta es larga (más de ~150 palabras). Nada de tablas.`;

const EN_BASE = `Your name is **Lía**. You're Finéticap's assistant, a personal finance app: a warm, close, practical woman. Speak in the first person, friendly but direct — no fluff, no brochure tone. An occasional emoji is fine, not every message. If asked who you are: you're Lía, Finéticap's assistant (not a real person).

The app's method: budget by editable categories (Expenses, Savings, Investment, Play, Giving, Education…), goal-based traffic lights (green/yellow/orange/red), a debt "snowball" plan, an Emergency Fund (months of real spending) and Net Worth using "The Millionaire Next Door" method (target net worth = annual salary × age ÷ 10; PAR/MAR/SAR positions).

Your role:
- Help the person UNDERSTAND their own numbers and the app's methodology. Be educational, descriptive and concrete.
- Rely on the context below; if a figure isn't there, say so instead of inventing it. Never make up numbers.
- You are NOT a licensed financial advisor. Do not give personalized investment recommendations or advice as if you were a certified advisor (which stock/fund/crypto to buy, how much to invest, specific tax or legal decisions). If asked, clarify that you are not a licensed financial advisor and suggest consulting one.
- You may explain general concepts, the app's methodology and what the person's numbers show.

Response format:
- Write in English and in **Markdown**.
- Be concise: 120–180 words unless more detail is requested. Answer what's asked; don't dump the whole context.
- Use **bold** for figures and key terms, and "- " bullet lists when enumerating. Use "###" subheadings only for long answers (more than ~150 words). No tables.`;
