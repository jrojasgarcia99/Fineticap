"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatoMoneda } from "@/lib/calculations";
import { aPrimaria, type CurrencyConfig } from "@/lib/currency";
import { ActivoDialog } from "@/components/patrimonio/ActivoDialog";
import { useT } from "@/components/i18n/I18nProvider";
import type { Activo } from "@/lib/types";

export function ActivosCard({
  items,
  total,
  currency,
  createAction,
  updateAction,
  deleteAction,
}: {
  items: Activo[];
  total: number;
  currency: CurrencyConfig;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("patrimonio.assets")}</CardTitle>
        <span className="text-sm font-semibold text-green">{formatoMoneda(total, currency.primaria)}</span>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-border mb-3">
          {items.length === 0 && (
            <li className="text-sm text-gray-400 py-2">{t("valueList.noRecords")}</li>
          )}
          {items.map((item) => {
            const enPrimaria = aPrimaria(item.valor, item.moneda, currency);
            const esSecundaria =
              (item.moneda === "CRC" || item.moneda === "USD") && item.moneda !== currency.primaria;
            const detalles = item.detalles
              ? Object.entries(item.detalles).map(([k, v]) => (k === "tipo" ? t(`activos.opt.${v}`) : v))
              : [];
            return (
              <li key={item.id} className="text-sm">
                <ActivoDialog
                  activo={item}
                  currency={currency}
                  createAction={createAction}
                  updateAction={updateAction}
                  deleteAction={deleteAction}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-gray-700">{item.concepto}</p>
                    <p className="truncate text-xs text-gray-400">
                      {t(`activos.cat.${item.categoria}`)}
                      {detalles.length > 0 && <> · {detalles.join(" · ")}</>}
                    </p>
                  </div>
                  <span className="shrink-0 text-gray-600">
                    {formatoMoneda(enPrimaria, currency.primaria)}
                    {esSecundaria && (
                      <span className="ml-1.5 text-xs text-gray-400">
                        · {formatoMoneda(item.valor, item.moneda)}
                      </span>
                    )}
                  </span>
                </ActivoDialog>
              </li>
            );
          })}
        </ul>
        <ActivoDialog
          currency={currency}
          createAction={createAction}
          updateAction={updateAction}
          deleteAction={deleteAction}
        />
      </CardBody>
    </Card>
  );
}
