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
  const porcentaje_ahorro = Number(formData.get("porcentaje_ahorro") || 0);
  const porcentaje_inversion = Number(formData.get("porcentaje_inversion") || 0);
  const tasaRaw = formData.get("tasa_retorno_estimada");
  const tasa_retorno_estimada = tasaRaw === null || tasaRaw === "" ? null : Number(tasaRaw);
  const plazoRaw = Number(formData.get("plazo_proyeccion_anios") || 0);
  const plazo_proyeccion_anios = (FONDO_PLAZOS as readonly number[]).includes(plazoRaw)
    ? plazoRaw
    : null;
  return { nombre, tipo, porcentaje_ahorro, porcentaje_inversion, tasa_retorno_estimada, plazo_proyeccion_anios };
}

export async function createFondo(formData: FormData) {
  const { space, currency, supabase, user } = await ctx();
  const fields = parseFondoFields(formData);
  if (!fields.nombre) return;
  const moneda = normalizarMoneda(formData.get("moneda"), currency.activas, currency.primaria);
  const isFamily = String(formData.get("scope_type")) === "family";

  if (isFamily) {
    const fam = await getFamilyBudgetContext({ supabase, user });
    if (!fam) return;
    await supabase.from("fondos").insert({
      scope_type: "family",
      family_budget_id: fam.familyBudget.id,
      moneda,
      created_by: user.id,
      ...fields,
    });
  } else {
    await supabase.from("fondos").insert({
      scope_type: "personal",
      space_id: space.id,
      moneda,
      created_by: user.id,
      ...fields,
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

/** Distribuye una línea de Ahorro/Inversión del presupuesto a UN fondo — crea
 *  el movimiento (tipo aporte_presupuesto) que queda ligado a esa línea. */
export async function distribuirBudgetItem(formData: FormData) {
  const { supabase } = await ctx();
  const budget_item_id = String(formData.get("budget_item_id") || "");
  const fondo_id = String(formData.get("fondo_id") || "");
  if (!budget_item_id || !fondo_id) return;

  const { data: item } = await supabase
    .from("budget_items")
    .select("monto, moneda, mes, anio")
    .eq("id", budget_item_id)
    .maybeSingle<{ monto: number; moneda: string; mes: number; anio: number }>();
  if (!item) return;

  await supabase.from("fondo_movimientos").insert({
    fondo_id,
    budget_item_id,
    tipo: "aporte_presupuesto",
    monto: item.monto,
    moneda: item.moneda,
    mes: item.mes,
    anio: item.anio,
  });
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
 *  pero editar el monto sí se permite) — ajusta también el movimiento del
 *  fondo para que el saldo cuadre. */
export async function editarLineaDistribuida(formData: FormData) {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "");
  const monto = Number(formData.get("monto") || 0);
  if (!id) return;
  await supabase.from("budget_items").update({ monto }).eq("id", id);
  await supabase.from("fondo_movimientos").update({ monto }).eq("budget_item_id", id);
  revalidatePath("/patrimonio");
  revalidatePath("/presupuesto");
}

/** Rendimiento/dividendo cargado a mano — cualquier tipo de fondo. */
export async function agregarRendimiento(formData: FormData) {
  const { supabase, user } = await ctx();
  const fondo_id = String(formData.get("fondo_id") || "");
  const monto = Number(formData.get("monto") || 0);
  const moneda = String(formData.get("moneda") || "CRC");
  const descripcion = String(formData.get("descripcion") || "").trim() || null;
  if (!fondo_id || !monto) return;
  const now = new Date();
  await supabase.from("fondo_movimientos").insert({
    fondo_id,
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

