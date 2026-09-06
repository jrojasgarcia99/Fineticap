"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/components/i18n/I18nProvider";
import { FONDO_PLAZOS, type FondoPosicion } from "@/lib/types";

export function FondoPosicionDialog({
  fondoId,
  posicion,
  createAction,
  updateAction,
  deleteAction,
}: {
  fondoId: string;
  posicion?: FondoPosicion;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const isEdit = !!posicion;
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isEdit
            ? "grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-navy"
            : "flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-gray-500 hover:border-navy-light hover:text-navy"
        }
      >
        {isEdit ? <Pencil size={15} /> : (
          <>
            <Plus size={15} />
            {t("fondos.newPosition")}
          </>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={isEdit ? t("fondos.editPosition") : t("fondos.newPosition")}>
        <form
          action={async (fd) => {
            await (isEdit ? updateAction : createAction)(fd);
            setOpen(false);
          }}
          className="space-y-4 p-5"
        >
          {isEdit ? (
            <input type="hidden" name="id" value={posicion!.id} />
          ) : (
            <input type="hidden" name="fondo_id" value={fondoId} />
          )}
          <Field label={t("fondos.positionName")}>
            <Input name="nombre" defaultValue={posicion?.nombre} required autoFocus />
          </Field>
          <Field label={t("fondos.positionPct")}>
            <Input type="number" step="1" min="0" max="100" name="porcentaje" defaultValue={posicion?.porcentaje ?? 0} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fondos.estimatedRate")}>
              <Input
                type="number"
                step="0.1"
                min="0"
                name="tasa_retorno_estimada"
                defaultValue={posicion?.tasa_retorno_estimada ?? ""}
                placeholder="0"
              />
            </Field>
            <Field label={t("fondos.term")}>
              <Select name="plazo_proyeccion_anios" defaultValue={posicion?.plazo_proyeccion_anios ?? ""}>
                <option value="">—</option>
                {FONDO_PLAZOS.map((p) => (
                  <option key={p} value={p}>
                    {p} {t("fondos.years")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
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
              title={t("fondos.editPosition")}
              message={t("fondos.positionDeleteConfirm")}
              onCancel={() => setConfirmDel(false)}
              onConfirm={async () => {
                const fd = new FormData();
                fd.set("id", posicion!.id);
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
