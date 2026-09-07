"use client";

import { useState, type ReactNode } from "react";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/components/i18n/I18nProvider";
import type { FondoMovimiento } from "@/lib/types";

/** Una fila del historial de un fondo, tocable: abre una hoja para editar
 *  monto/descripción (si aplica) o eliminarla — en vez de un ícono suelto por
 *  fila, para mantenerlo minimalista. Los aportes distribuidos desde el
 *  Presupuesto no se editan acá (su monto vive en el presupuesto, cambiarlo
 *  acá los desincronizaría) — solo se pueden eliminar. */
export function MovimientoItem({
  movimiento,
  titulo,
  subtitulo,
  montoFmt,
  editable,
  editAction,
  deleteAction,
}: {
  movimiento: FondoMovimiento;
  titulo: string;
  subtitulo: ReactNode;
  montoFmt: string;
  editable: boolean;
  editAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [montoStr, setMontoStr] = useState(String(movimiento.monto));
  const [descripcion, setDescripcion] = useState(movimiento.descripcion ?? "");

  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-mx-1 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-left text-sm hover:bg-gray-50"
        >
          <div className="min-w-0">
            <p className="text-gray-700">{titulo}</p>
            <p className="text-xs text-gray-400">{subtitulo}</p>
          </div>
          <span
            className={`shrink-0 font-medium ${movimiento.tipo === "rendimiento" ? "text-gold" : "text-navy"}`}
          >
            {montoFmt}
          </span>
        </button>
      </li>
      <Sheet open={open} onClose={() => setOpen(false)} title={titulo}>
        <div className="space-y-4 p-5">
          {editable ? (
            <form
              action={async (fd) => {
                await editAction(fd);
                setOpen(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={movimiento.id} />
              <Field label={t("fondos.returnAmount")}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  name="monto"
                  value={montoStr}
                  onChange={(e) => setMontoStr(e.target.value)}
                  required
                />
              </Field>
              <Field label={t("fondos.returnDesc")}>
                <Input
                  name="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </Field>
              <Button type="submit" className="w-full">
                {t("common.save")}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-gray-400">{t("fondos.editFromBudgetHint")}</p>
          )}
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="w-full rounded-full border border-red/30 py-2.5 text-[15px] font-medium text-red transition-colors hover:bg-red/5"
          >
            {t("common.delete")}
          </button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDel}
        title={t("fondos.deleteMovement")}
        message={t("fondos.deleteMovementConfirm")}
        onCancel={() => setConfirmDel(false)}
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("id", movimiento.id);
          await deleteAction(fd);
          setConfirmDel(false);
          setOpen(false);
        }}
      />
    </>
  );
}
