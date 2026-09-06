"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Repeat, GripVertical, PiggyBank } from "lucide-react";
import { formatoMoneda } from "@/lib/calculations";
import { aPrimaria, type CurrencyConfig } from "@/lib/currency";
import { useT } from "@/components/i18n/I18nProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import { BudgetRowDialog, type FondoOption } from "./BudgetRowDialog";
import type { Moneda } from "@/lib/types";

export type BudgetRowItem = {
  id: string;
  concepto: string;
  monto: number;
  moneda: Moneda;
  automatico: boolean;
  recurrente: boolean;
};

export function EditableBudgetRow({
  item,
  currency,
  updateAction,
  deleteAction,
  categoria,
  fondosDisponibles,
  fondoActualId,
  distribuirAction,
  quitarDistribucionAction,
}: {
  item: BudgetRowItem;
  currency: CurrencyConfig;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  categoria?: string;
  fondosDisponibles?: FondoOption[];
  fondoActualId?: string | null;
  distribuirAction?: (formData: FormData) => void | Promise<void>;
  quitarDistribucionAction?: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const enPrimaria = aPrimaria(item.monto, item.moneda, currency);
  const esSecundaria =
    (item.moneda === "CRC" || item.moneda === "USD") && item.moneda !== currency.primaria;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: open });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-1.5 py-1">
      {/* Arrastrar para reordenar: sólo en escritorio. */}
      <Tooltip content={t("tip.drag")} className="max-md:hidden">
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label={t("cat.dragHandle")}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </Tooltip>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-between gap-2 rounded-lg py-1.5 text-left transition-colors hover:bg-gray-50"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-gray-700">
          {item.recurrente && (
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-green/10 text-green"
              aria-label={t("cat.recurring")}
            >
              <Repeat size={12} strokeWidth={2.25} />
            </span>
          )}
          {fondoActualId && (
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-navy-light/10 text-navy-light"
              aria-label={t("fondos.distributedBadge")}
            >
              <PiggyBank size={12} strokeWidth={2.25} />
            </span>
          )}
          {item.automatico && (
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gold/15 text-gold"
              aria-label={t("cat.automatic")}
            >
              <CalendarClock size={12} strokeWidth={2.25} />
            </span>
          )}
          <span className="truncate text-[15px]">{item.concepto}</span>
        </span>
        <span className="shrink-0 text-[15px] text-gray-600">
          {formatoMoneda(enPrimaria, currency.primaria)}
          {esSecundaria && (
            <span className="ml-1.5 text-xs text-gray-400">
              · {formatoMoneda(item.monto, item.moneda)}
            </span>
          )}
        </span>
      </button>

      <BudgetRowDialog
        open={open}
        onClose={() => setOpen(false)}
        item={item}
        currency={currency}
        action={updateAction}
        deleteAction={deleteAction}
        categoria={categoria}
        fondosDisponibles={fondosDisponibles}
        fondoActualId={fondoActualId}
        distribuirAction={distribuirAction}
        quitarDistribucionAction={quitarDistribucionAction}
      />
    </li>
  );
}
