// ============================================================================
// Finéticap · Presupuesto — soporte de múltiples monedas
// Cada monto se guarda en su moneda original y se convierte a la moneda
// primaria del hogar SOLO al momento de mostrarlo. Así, si el tipo de cambio
// cambia después, todos los totales se recalculan solos.
// ============================================================================
import type { BudgetItem, Deuda, Moneda } from "./types";
import { MONEDAS } from "./types";

export type CurrencyConfig = {
  primaria: Moneda;
  activas: Moneda[];
  /**
   * Unidades de la moneda primaria que equivalen a 1 unidad de la moneda
   * secundaria. Con primaria = CRC, es "₡ por $1" (idéntico al valor histórico).
   */
  tipoCambio: number;
};

export function simbolo(m: Moneda): string {
  return MONEDAS.find((x) => x.code === m)?.symbol ?? m;
}

/** Valida el valor de moneda recibido de un formulario; si no sirve, usa la primaria. */
export function normalizarMoneda(
  value: unknown,
  activas: Moneda[],
  primaria: Moneda,
): Moneda {
  const v = String(value ?? "");
  if ((v === "CRC" || v === "USD") && activas.includes(v)) return v;
  return primaria;
}

/** Convierte un monto desde su moneda de origen a la moneda primaria del hogar. */
export function aPrimaria(
  monto: number,
  origen: Moneda | null | undefined,
  cfg: CurrencyConfig,
): number {
  const n = Number(monto || 0);
  // Sin moneda de origen conocida, o ya en la primaria: no se convierte.
  if (origen !== "CRC" && origen !== "USD") return n;
  if (origen === cfg.primaria) return n;
  const tc = Number(cfg.tipoCambio || 0);
  if (!tc || !Number.isFinite(tc)) return n; // sin tipo de cambio válido: no se convierte
  return n * tc;
}

/** La otra moneda activa además de la primaria, si el hogar tiene dos habilitadas. */
export function secundariaDe(cfg: CurrencyConfig): Moneda | null {
  return cfg.activas.find((m) => m !== cfg.primaria) ?? null;
}

/** Convierte un monto ya expresado en la moneda primaria a la secundaria (la
 *  inversa de `aPrimaria`) — `null` si no hay secundaria activa o tipo de
 *  cambio configurado. */
export function aSecundaria(montoPrimaria: number, cfg: CurrencyConfig): number | null {
  if (!secundariaDe(cfg)) return null;
  const tc = Number(cfg.tipoCambio || 0);
  if (!tc || !Number.isFinite(tc)) return null;
  return montoPrimaria / tc;
}

/** Copia de las partidas con `monto` ya expresado en la moneda primaria. */
export function convertirBudgetItems(
  items: BudgetItem[],
  cfg: CurrencyConfig,
): BudgetItem[] {
  return items.map((i) => ({
    ...i,
    monto: aPrimaria(Number(i.monto || 0), i.moneda, cfg),
    moneda: cfg.primaria,
  }));
}

/** Copia de las deudas con sus montos (no la tasa) en la moneda primaria. */
export function convertirDeudas(deudas: Deuda[], cfg: CurrencyConfig): Deuda[] {
  return deudas.map((d) => ({
    ...d,
    monto_original: aPrimaria(Number(d.monto_original || 0), d.moneda, cfg),
    saldo_actual: aPrimaria(Number(d.saldo_actual || 0), d.moneda, cfg),
    cuota_minima: aPrimaria(Number(d.cuota_minima || 0), d.moneda, cfg),
    moneda: cfg.primaria,
  }));
}
