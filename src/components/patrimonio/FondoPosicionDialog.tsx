"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DiversificacionNombreField } from "@/components/patrimonio/DiversificacionNombreField";
import { useT } from "@/components/i18n/I18nProvider";
import { FONDO_PLAZOS, type FondoPosicion } from "@/lib/types";

export function FondoPosicionDialog({
  fondoId,
  posicion,
  /** % ya asignado por las DEMÁS posiciones del fondo (sin contar esta) —
   *  define cuánto queda disponible para esta. */
  asignadoOtras,
  createAction,
  updateAction,
  deleteAction,
}: {
  fondoId: string;
  posicion?: FondoPosicion;
  asignadoOtras: number;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const isEdit = !!posicion;
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // String, no number — así se puede borrar el campo sin que reaparezca un
  // "0" forzado delante de lo que se escriba después. Al agregar una nueva
  // (no al editar una ya existente), se sugiere todo el % que queda libre.
  const [porcentajeStr, setPorcentajeStr] = useState(() =>
    isEdit ? String(posicion!.porcentaje) : String(Math.max(0, 100 - asignadoOtras)),
  );
  const porcentaje = Number(porcentajeStr) || 0;
  // Informativo, no bloquea — si las otras posiciones ya suman de más (datos
  // previos a esta corrección), forzar un tope acá dejaría sin forma de
  // arreglarlas. Se avisa, pero se deja escribir cualquier valor.
  const disponible = 100 - asignadoOtras;
  const seExcede = porcentaje > disponible;

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
            <DiversificacionNombreField name="nombre" defaultValue={posicion?.nombre} required />
          </Field>
          <Field label={t("fondos.positionPct")}>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              name="porcentaje"
              value={porcentajeStr}
              onChange={(e) => setPorcentajeStr(e.target.value)}
            />
          </Field>
          <p className={`text-xs ${seExcede ? "text-red" : "text-gray-400"}`}>
            {seExcede
              ? t("fondos.pctOverBy", { n: porcentaje - disponible })
              : t("fondos.pctAvailable", { n: disponible })}
          </p>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fondos.yearsElapsed")}>
              <Input
                type="number"
                step="1"
                min="0"
                name="anios_transcurridos"
                defaultValue={posicion?.anios_transcurridos || ""}
                placeholder="0"
              />
            </Field>
            <Field label={t("fondos.annualFee")}>
              <Input
                type="number"
                step="0.1"
                min="0"
                name="comision_anual_pct"
                defaultValue={posicion?.comision_anual_pct ?? ""}
                placeholder="0"
              />
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
