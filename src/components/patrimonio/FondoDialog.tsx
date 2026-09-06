"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/components/i18n/I18nProvider";
import { FONDO_TIPOS, FONDO_PLAZOS, type Fondo } from "@/lib/types";
import type { CurrencyConfig } from "@/lib/currency";

export function FondoDialog({
  open,
  onClose,
  currency,
  createAction,
  updateAction,
  deleteAction,
  fondo,
  isFamilyMember,
  tienePosiciones,
}: {
  open: boolean;
  onClose: () => void;
  currency: CurrencyConfig;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  fondo?: Fondo;
  isFamilyMember?: boolean;
  /** Si el fondo ya tiene posiciones, la tasa/plazo a nivel de fondo no se
   *  usa (la proyección pasa a ser la suma de cada posición) — se oculta
   *  para no confundir. */
  tienePosiciones?: boolean;
}) {
  const t = useT();
  const isEdit = !!fondo;
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? t("fondos.editTitle") : t("fondos.newTitle")}
    >
      <form
        action={async (fd) => {
          await (isEdit ? updateAction : createAction)(fd);
          onClose();
        }}
        className="space-y-4 p-5"
      >
        {isEdit && <input type="hidden" name="id" value={fondo!.id} />}

        <Field label={t("fondos.name")}>
          <Input name="nombre" defaultValue={fondo?.nombre} required />
        </Field>

        <Field label={t("fondos.type")}>
          <Select name="tipo" defaultValue={fondo?.tipo ?? "ahorro"} required>
            {FONDO_TIPOS.map((tp) => (
              <option key={tp} value={tp}>
                {t(`fondos.type.${tp}`)}
              </option>
            ))}
          </Select>
        </Field>

        {!isEdit && isFamilyMember && (
          <Field label={t("fondos.scope")}>
            <Select name="scope_type" defaultValue="personal">
              <option value="personal">{t("fondos.scopePersonal")}</option>
              <option value="family">{t("fondos.scopeFamily")}</option>
            </Select>
          </Field>
        )}

        {!isEdit && (
          <Field label={t("common.currency")}>
            <Select name="moneda" defaultValue={currency.primaria}>
              {currency.activas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {!isEdit && (
          <Field label={t("fondos.initialAmount")}>
            <Input type="number" step="0.01" min="0" name="monto_inicial" placeholder="0" />
          </Field>
        )}

        {tienePosiciones ? (
          <p className="text-xs text-gray-400">{t("fondos.rateMovedToPositions")}</p>
        ) : (
          <>
            <p className="text-xs text-gray-400">{t("fondos.projectionHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fondos.estimatedRate")}>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  name="tasa_retorno_estimada"
                  defaultValue={fondo?.tasa_retorno_estimada ?? ""}
                  placeholder="0"
                />
              </Field>
              <Field label={t("fondos.term")}>
                <Select name="plazo_proyeccion_anios" defaultValue={fondo?.plazo_proyeccion_anios ?? ""}>
                  <option value="">—</option>
                  {FONDO_PLAZOS.map((p) => (
                    <option key={p} value={p}>
                      {p} {t("fondos.years")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        )}

        <Button type="submit" className="w-full">
          {isEdit ? t("common.save") : t("common.add")}
        </Button>
      </form>

      {isEdit && (
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
            title={t("fondos.editTitle")}
            message={t("fondos.deleteConfirm")}
            onCancel={() => setConfirmDel(false)}
            onConfirm={async () => {
              const fd = new FormData();
              fd.set("id", fondo!.id);
              await deleteAction(fd);
              setConfirmDel(false);
              onClose();
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
