"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MontoConMoneda } from "@/components/ui/MontoConMoneda";
import { ActivoDetallesFields } from "@/components/patrimonio/ActivoDetallesFields";
import { useT } from "@/components/i18n/I18nProvider";
import { ACTIVO_CATEGORIAS, type Activo, type ActivoCategoria } from "@/lib/types";
import type { CurrencyConfig } from "@/lib/currency";

export function ActivoDialog({
  activo,
  currency,
  createAction,
  updateAction,
  deleteAction,
  children,
}: {
  activo?: Activo;
  currency: CurrencyConfig;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  /** En modo edición: el contenido de la fila, que se vuelve el disparador
   *  tocable completo (en vez de un ícono de lápiz suelto). */
  children?: ReactNode;
}) {
  const t = useT();
  const isEdit = !!activo;
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [categoria, setCategoria] = useState<ActivoCategoria>(activo?.categoria ?? "efectivo_bancos");

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-mx-1 flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-gray-50"
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-gray-500 hover:border-navy-light hover:text-navy"
        >
          <Plus size={15} />
          {t("patrimonio.newAsset")}
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? t("common.edit") : t("patrimonio.newAsset")}
      >
        <form
          action={async (fd) => {
            await (isEdit ? updateAction : createAction)(fd);
            setOpen(false);
          }}
          className="space-y-4 p-5"
        >
          {isEdit && <input type="hidden" name="id" value={activo!.id} />}
          <Field label={t("common.concepto")}>
            <Input name="concepto" defaultValue={activo?.concepto} required autoFocus />
          </Field>
          <Field label={t("activos.category")}>
            <Select
              name="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as ActivoCategoria)}
            >
              {ACTIVO_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {t(`activos.cat.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <ActivoDetallesFields categoria={categoria} defaultValues={activo?.detalles} />
          <Field label={t("common.valor")}>
            <MontoConMoneda
              name="valor"
              activas={currency.activas}
              primaria={currency.primaria}
              defaultMonto={activo?.valor}
              defaultMoneda={activo?.moneda}
              required
            />
          </Field>
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
              title={t("common.delete")}
              message={t("valueList.deleteConfirm")}
              onCancel={() => setConfirmDel(false)}
              onConfirm={async () => {
                const fd = new FormData();
                fd.set("id", activo!.id);
                await deleteAction(fd);
                setConfirmDel(false);
                setOpen(false);
              }}
            />
          </div>
        )}
      </Sheet>
    </>
  );
}
