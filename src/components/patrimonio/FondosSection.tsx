"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatoMoneda } from "@/lib/calculations";
import { FondoCard } from "@/components/patrimonio/FondoCard";
import { FondoDialog } from "@/components/patrimonio/FondoDialog";
import { useT } from "@/components/i18n/I18nProvider";
import type { CurrencyConfig } from "@/lib/currency";
import type { Moneda, FondoTipo } from "@/lib/types";

export type FondoListItem = {
  id: string;
  nombre: string;
  tipo: FondoTipo;
  moneda: Moneda;
  saldo: number;
  compartido?: boolean;
};

export function FondosSection({
  items,
  total,
  currency,
  isFamilyMember,
  createAction,
  updateAction,
  deleteAction,
}: {
  items: FondoListItem[];
  total: number;
  currency: CurrencyConfig;
  isFamilyMember: boolean;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fondos.title")}</CardTitle>
        <span className="text-sm font-semibold text-navy">
          {formatoMoneda(total, currency.primaria)}
        </span>
      </CardHeader>
      <CardBody>
        <div className="space-y-2 mb-3">
          {items.length === 0 && (
            <p className="text-sm text-gray-400 py-2">{t("fondos.empty")}</p>
          )}
          {items.map((f) => (
            <FondoCard key={f.id} {...f} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-gray-500 transition-colors hover:border-navy-light hover:text-navy"
        >
          <Plus size={16} />
          {t("fondos.newTitle")}
        </button>
        <FondoDialog
          open={open}
          onClose={() => setOpen(false)}
          currency={currency}
          createAction={createAction}
          updateAction={updateAction}
          deleteAction={deleteAction}
          isFamilyMember={isFamilyMember}
        />
      </CardBody>
    </Card>
  );
}
