"use client";

import { useState } from "react";
import { Repeat, CalendarClock } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { MontoConMoneda } from "@/components/ui/MontoConMoneda";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/components/i18n/I18nProvider";
import type { CurrencyConfig } from "@/lib/currency";
import type { BudgetRowItem } from "./EditableBudgetRow";

export type FondoOption = { id: string; nombre: string; compartido: boolean };

/**
 * Ventana para agregar, editar o eliminar una línea del presupuesto (personal o
 * familiar). Si viene `item` es edición y muestra "Eliminar" al final; si no,
 * es alta y necesita `categoria` / `mes` / `anio`.
 */
export function BudgetRowDialog({
  open,
  onClose,
  currency,
  action,
  deleteAction,
  item,
  categoria,
  mes,
  anio,
  fondosDisponibles,
  fondoActualId,
  distribuirAction,
  quitarDistribucionAction,
}: {
  open: boolean;
  onClose: () => void;
  currency: CurrencyConfig;
  action: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  item?: BudgetRowItem;
  categoria?: string;
  mes?: number;
  anio?: number;
  fondosDisponibles?: FondoOption[];
  fondoActualId?: string | null;
  distribuirAction?: (formData: FormData) => void | Promise<void>;
  quitarDistribucionAction?: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const isEdit = !!item;
  const [confirmDel, setConfirmDel] = useState(false);
  const puedeDistribuir =
    isEdit && (categoria === "ahorros" || categoria === "inversion") && fondosDisponibles;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? t("presupuesto.editLine") : t("cat.addLine")}
    >
      <form
        action={async (fd) => {
          await action(fd);
          onClose();
        }}
        className="space-y-4 p-5"
      >
        {isEdit ? (
          <input type="hidden" name="id" value={item!.id} />
        ) : (
          <>
            <input type="hidden" name="categoria" value={categoria} />
            <input type="hidden" name="mes" value={mes} />
            <input type="hidden" name="anio" value={anio} />
          </>
        )}

        <Field label={t("common.concepto")}>
          <Input name="concepto" defaultValue={item?.concepto} required />
        </Field>

        <Field label={t("common.monto")}>
          <MontoConMoneda
            activas={currency.activas}
            primaria={currency.primaria}
            defaultMonto={item?.monto}
            defaultMoneda={item?.moneda}
            required
            wrapperClassName="flex items-center gap-2"
            montoClassName="flex-1"
          />
        </Field>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 has-[:checked]:border-green">
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <Repeat size={16} className="text-green" />
            {t("cat.recurring")}
          </span>
          <input
            type="checkbox"
            name="recurrente"
            defaultChecked={item?.recurrente ?? false}
            className="h-5 w-5 accent-navy"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 has-[:checked]:border-gold">
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarClock size={16} className="text-gold" />
            {t("cat.automatic")}
          </span>
          <input
            type="checkbox"
            name="automatico"
            defaultChecked={item?.automatico ?? false}
            className="h-5 w-5 accent-navy"
          />
        </label>

        <Button type="submit" className="w-full">
          {isEdit ? t("common.save") : t("common.add")}
        </Button>
      </form>

      {puedeDistribuir && (
        <div className="border-t border-border p-5 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">{t("fondos.distributeTitle")}</p>
          {fondoActualId ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-600">
                {t("fondos.distributedTo")}{" "}
                <strong>{fondosDisponibles!.find((f) => f.id === fondoActualId)?.nombre ?? "—"}</strong>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs text-navy-light hover:underline"
                onClick={async () => {
                  const fd = new FormData();
                  fd.set("budget_item_id", item!.id);
                  await quitarDistribucionAction?.(fd);
                }}
              >
                {t("fondos.undistribute")}
              </button>
            </div>
          ) : (
            <form
              action={async (fd) => {
                fd.set("budget_item_id", item!.id);
                await distribuirAction?.(fd);
              }}
              className="flex items-center gap-2"
            >
              <Select name="fondo_id" required className="flex-1">
                <option value="">{t("fondos.selectFund")}</option>
                {fondosDisponibles!.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                    {f.compartido ? ` (${t("fondos.shared")})` : ""}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary">
                {t("common.add")}
              </Button>
            </form>
          )}
        </div>
      )}

      {isEdit && deleteAction && !fondoActualId && (
        <div className="border-t border-border p-5 pt-4">
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="w-full rounded-full border border-red/30 py-2.5 text-[15px] font-medium text-red transition-colors hover:bg-red/5"
          >
            {t("common.delete")}
          </button>
          <ConfirmDialog
            open={confirmDel}
            title={t("presupuesto.editLine")}
            message={t("presupuesto.deleteLineConfirm")}
            onCancel={() => setConfirmDel(false)}
            onConfirm={async () => {
              const fd = new FormData();
              fd.set("id", item!.id);
              await deleteAction(fd);
              setConfirmDel(false);
              onClose();
            }}
          />
        </div>
      )}
      {isEdit && fondoActualId && (
        <p className="border-t border-border p-5 pt-4 text-xs text-gray-400">
          {t("fondos.deleteBlockedHint")}
        </p>
      )}
    </Sheet>
  );
}
