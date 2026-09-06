"use server";

import { revalidatePath } from "next/cache";
import { getPersonalContext, getFamilyBudgetContext } from "@/lib/data";
import { normalizarMoneda } from "@/lib/currency";
import { FONDO_TIPOS, FONDO_PLAZOS, type FondoTipo } from "@/lib/types";

async function ctx() {
  const { space, currency, supabase, user } = await getPersonalContext();
  return { space, currency, supabase, user };
}

export async function addActivo(formData: FormData) {
  const { space, currency, supabase } = await ctx();
  const concepto = String(formData.get("concepto") || "").trim();
  const valor = Number(formData.get("valor") || 0);
  const moneda = normalizarMoneda(formData.get("moneda"), currency.activas, currency.primaria);
  if (!concepto) return;
  await supabase.from("activos").insert({ space_id: space.id, concepto, valor, moneda });
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

export async function updateActivo(formData: FormData) {
  const { space, currency, supabase } = await ctx();
  const id = String(formData.get("id"));
  const concepto = String(formData.get("concepto") || "").trim();
  const valor = Number(formData.get("valor") || 0);
  const moneda = normalizarMoneda(formData.get("moneda"), currency.activas, currency.primaria);
  if (!id || !concepto) return;
  await supabase
    .from("activos")
    .update({ concepto, valor, moneda })
    .eq("id", id)
    .eq("space_id", space.id);
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

export async function deleteActivo(formData: FormData) {
  const { space, supabase } = await ctx();
  const id = String(formData.get("id"));
  await supabase.from("activos").delete().eq("id", id).eq("space_id", space.id);
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

export async function addPasivo(formData: FormData) {
  const { space, currency, supabase } = await ctx();
  const concepto = String(formData.get("concepto") || "").trim();
  const valor = Number(formData.get("valor") || 0);
  const moneda = normalizarMoneda(formData.get("moneda"), currency.activas, currency.primaria);
  if (!concepto) return;
  await supabase.from("pasivos").insert({ space_id: space.id, concepto, valor, moneda });
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

export async function updatePasivo(formData: FormData) {
  const { space, currency, supabase } = await ctx();
  const id = String(formData.get("id"));
  const concepto = String(formData.get("concepto") || "").trim();
  const valor = Number(formData.get("valor") || 0);
  const moneda = normalizarMoneda(formData.get("moneda"), currency.activas, currency.primaria);
  if (!id || !concepto) return;
  await supabase
    .from("pasivos")
    .update({ concepto, valor, moneda })
    .eq("id", id)
    .eq("space_id", space.id);
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

export async function deletePasivo(formData: FormData) {
  const { space, supabase } = await ctx();
  const id = String(formData.get("id"));
  await supabase.from("pasivos").delete().eq("id", id).eq("space_id", space.id);
  revalidatePath("/patrimonio");
  revalidatePath("/dashboard");
}

// ============================================================================
// FONDOS
// ============================================================================

function parseFondoFields(formData: FormData) {
  const nombre = String(formData.get("nombre") || "").trim();
  const tipoRaw = String(formData.get("tipo") || "");
  const tipo = (FONDO_TIPOS as string[]).includes(tipoRaw) ? (tipoRaw as FondoTipo) : "ahorro";
  const tasaRaw = formData.get("tasa_retorno_estimada");
  const tasa_retorno_estimada = tasaRaw === null || tasaRaw === "" ? null : Number(tasaRaw);
  const plazoRaw = Number(formData.get("plazo_proyeccion_anios") || 0);
  const plazo_proyeccion_anios = (FONDO_PLAZOS as readonly number[]).includes(plazoRaw)
    ? plazoRaw
    : null;
  return { nombre, tipo, tasa_retorno_estimada, plazo_proyeccion_anios };
}

export async function createFondo(formData: FormData) {
  const { space, currency, supabase, user } = await ctx();
  const fields = parseFondoFields(formData);
  if (!fields.nombre) return;
  const moneda = normalizarMoneda(formData.get("moneda"), currency.activas, currency.primaria);
  const isFamily = String(formData.get("scope_type")) === "family";
  const montoInicial = Number(formData.get("monto_inicial") || 0);

  let fondoId: string | null = null;
  if (isFamily) {
    const fam = await getFamilyBudgetContext({ supabase, user });
    if (!fam) return;
    const { data } = await supabase
      .from("fondos")
      .insert({
        scope_type: "family",
        family_budget_id: fam.familyBudget.id,
        moneda,
        created_by: user.id,
        ...fields,
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    fondoId = data?.id ?? null;
  } else {
    const { data } = await supabase
      .from("fondos")
      .insert({
        scope_type: "personal",
        space_id: space.id,
        moneda,
        created_by: user.id,
        ...fields,
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    fondoId = data?.id ?? null;
  }

  if (fondoId && montoInicial > 0) {
    const now = new Date();
    await supabase.from("fondo_movimientos").insert({
      fondo_id: fondoId,
      tipo: "saldo_inicial",
      monto: montoInicial,
      moneda,
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
      descripcion: "Saldo inicial",
      created_by: user.id,
    });
  }
  revalidatePath("/patrimonio");
  revalidatePath("/familiar");
}

export async function updateFondo(formData: FormData) {
  const { supabase } = await ctx();
  const id = String(formData.get("id"));
  if (!id) return;
  const fields = parseFondoFields(formData);
  await supabase.from("fondos").update(fields).eq("id", id);
  revalidatePath("/patrimonio");
  revalidatePath("/familiar");
}

export async function deleteFondo(formData: FormData) {
  const { supabase } = await ctx();
  const id = String(formData.get("id"));
  if (!id) return;
  await supabase.from("fondos").delete().eq("id", id);
  revalidatePath("/patrimonio");
  revalidatePath("/familiar");
}

/** Distribuye una línea de Ahorro/Inversión del presupuesto a un fondo. Si el
 *  fondo tiene posiciones (diversificación), reparte el monto entre ellas
 *  (según `overrides`, o proporcional a su % si no se mandó override) — una
 *  fila de movimiento por posición. Sin posiciones, una sola fila como antes. */
export async function distribuirBudgetItem(formData: FormData) {
  const { supabase, user } = await ctx();
  const budget_item_id = String(formData.get("budget_item_id") || "");
  const fondo_id = String(formData.get("fondo_id") || "");
  if (!budget_item_id || !fondo_id) return;

  const { data: item } = await supabase
    .from("budget_items")
    .select("monto, moneda, mes, anio")
    .eq("id", budget_item_id)
    .maybeSingle<{ monto: number; moneda: string; mes: number; anio: number }>();
  if (!item) return;

  // Por si ya había una distribución previa (reasignar a otro fondo): se
  // limpia antes de insertar la nueva, ya no hay constraint única que lo haga.
  await supabase.from("fondo_movimientos").delete().eq("budget_item_id", budget_item_id);

  const { data: posiciones } = await supabase
    .from("fondo_posiciones")
    .select("id, porcentaje")
    .eq("fondo_id", fondo_id)
    .order("orden");

  if (posiciones && posiciones.length > 0) {
    const overridesRaw = String(formData.get("overrides") || "{}");
    let overrides: Record<string, number> = {};
    try {
      overrides = JSON.parse(overridesRaw);
    } catch {
      overrides = {};
    }
    const totalPct = posiciones.reduce((a, p) => a + Number(p.porcentaje), 0) || 100;
    const filas = posiciones.map((p) => ({
      fondo_id,
      budget_item_id,
      posicion_id: p.id,
      tipo: "aporte_presupuesto" as const,
      monto:
        overrides[p.id] != null && !Number.isNaN(overrides[p.id])
          ? overrides[p.id]
          : (item.monto * Number(p.porcentaje)) / totalPct,
      moneda: item.moneda,
      mes: item.mes,
      anio: item.anio,
      created_by: user.id,
    }));
    await supabase.from("fondo_movimientos").insert(filas);
  } else {
    await supabase.from("fondo_movimientos").insert({
      fondo_id,
      budget_item_id,
      tipo: "aporte_presupuesto",
      monto: item.monto,
      moneda: item.moneda,
      mes: item.mes,
      anio: item.anio,
      created_by: user.id,
    });
  }
  revalidatePath("/patrimonio");
  revalidatePath("/presupuesto");
}

/** Quita la distribución de una línea (sin borrar la línea del presupuesto) —
 *  por si el usuario se equivocó de fondo y quiere reasignarla. */
export async function quitarDistribucion(formData: FormData) {
  const { supabase } = await ctx();
  const budget_item_id = String(formData.get("budget_item_id") || "");
  if (!budget_item_id) return;
  await supabase.from("fondo_movimientos").delete().eq("budget_item_id", budget_item_id);
  revalidatePath("/patrimonio");
  revalidatePath("/presupuesto");
}

/** Corrige el monto de una línea ya distribuida (el trigger bloquea el DELETE,
 *  pero editar el monto sí se permite) — reescala TODOS los movimientos
 *  ligados (puede haber varios si se repartió entre posiciones) por la misma
 *  proporción, para que el saldo del fondo siga cuadrando. */
export async function editarLineaDistribuida(formData: FormData) {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "");
  const monto = Number(formData.get("monto") || 0);
  if (!id) return;

  const { data: movs } = await supabase
    .from("fondo_movimientos")
    .select("id, monto")
    .eq("budget_item_id", id);

  await supabase.from("budget_items").update({ monto }).eq("id", id);

  if (movs && movs.length > 0) {
    const totalActual = movs.reduce((a, m) => a + Number(m.monto), 0);
    const factor = totalActual > 0 ? monto / totalActual : 0;
    await Promise.all(
      movs.map((m) =>
        supabase
          .from("fondo_movimientos")
          .update({ monto: Number(m.monto) * factor })
          .eq("id", m.id),
      ),
    );
  }
  revalidatePath("/patrimonio");
  revalidatePath("/presupuesto");
}

/** Rendimiento/dividendo cargado a mano — a una posición específica, o al
 *  fondo en general si no se elige ninguna. */
export async function agregarRendimiento(formData: FormData) {
  const { supabase, user } = await ctx();
  const fondo_id = String(formData.get("fondo_id") || "");
  const posicion_id = String(formData.get("posicion_id") || "") || null;
  const monto = Number(formData.get("monto") || 0);
  const moneda = String(formData.get("moneda") || "CRC");
  const descripcion = String(formData.get("descripcion") || "").trim() || null;
  if (!fondo_id || !monto) return;
  const now = new Date();
  await supabase.from("fondo_movimientos").insert({
    fondo_id,
    posicion_id,
    tipo: "rendimiento",
    monto,
    moneda,
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
    descripcion,
    created_by: user.id,
  });
  revalidatePath("/patrimonio");
  revalidatePath("/familiar");
}

// ============================================================================
// POSICIONES (diversificación dentro de un fondo)
// ============================================================================

export async function createFondoPosicion(formData: FormData) {
  const { supabase } = await ctx();
  const fondo_id = String(formData.get("fondo_id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  if (!fondo_id || !nombre) return;
  const tasaRaw = formData.get("tasa_retorno_estimada");
  const tasa_retorno_estimada = tasaRaw === null || tasaRaw === "" ? null : Number(tasaRaw);
  const plazoRaw = Number(formData.get("plazo_proyeccion_anios") || 0);
  const plazo_proyeccion_anios = (FONDO_PLAZOS as readonly number[]).includes(plazoRaw)
    ? plazoRaw
    : null;

  // El % nunca puede hacer que el total del fondo pase de 100 — se topa acá
  // también, por si el límite del lado del cliente se saltó de alguna forma.
  const { data: otras } = await supabase
    .from("fondo_posiciones")
    .select("porcentaje")
    .eq("fondo_id", fondo_id);
  const asignadoOtras = (otras ?? []).reduce((a, p) => a + Number(p.porcentaje), 0);
  const porcentaje = Math.max(0, Math.min(Number(formData.get("porcentaje") || 0), 100 - asignadoOtras));

  await supabase
    .from("fondo_posiciones")
    .insert({ fondo_id, nombre, porcentaje, tasa_retorno_estimada, plazo_proyeccion_anios });
  revalidatePath("/patrimonio");
}

export async function updateFondoPosicion(formData: FormData) {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const nombre = String(formData.get("nombre") || "").trim();
  const tasaRaw = formData.get("tasa_retorno_estimada");
  const tasa_retorno_estimada = tasaRaw === null || tasaRaw === "" ? null : Number(tasaRaw);
  const plazoRaw = Number(formData.get("plazo_proyeccion_anios") || 0);
  const plazo_proyeccion_anios = (FONDO_PLAZOS as readonly number[]).includes(plazoRaw)
    ? plazoRaw
    : null;

  const { data: actual } = await supabase
    .from("fondo_posiciones")
    .select("fondo_id")
    .eq("id", id)
    .maybeSingle<{ fondo_id: string }>();
  let porcentaje = Number(formData.get("porcentaje") || 0);
  if (actual) {
    const { data: otras } = await supabase
      .from("fondo_posiciones")
      .select("porcentaje")
      .eq("fondo_id", actual.fondo_id)
      .neq("id", id);
    const asignadoOtras = (otras ?? []).reduce((a, p) => a + Number(p.porcentaje), 0);
    porcentaje = Math.max(0, Math.min(porcentaje, 100 - asignadoOtras));
  }

  await supabase
    .from("fondo_posiciones")
    .update({ nombre, porcentaje, tasa_retorno_estimada, plazo_proyeccion_anios })
    .eq("id", id);
  revalidatePath("/patrimonio");
}

export async function deleteFondoPosicion(formData: FormData) {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("fondo_posiciones").delete().eq("id", id);
  revalidatePath("/patrimonio");
}

