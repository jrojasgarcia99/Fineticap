"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/components/i18n/I18nProvider";
import { FONDO_TIPOS, FONDO_PLAZOS, type Fondo } from "@/lib/types";
import type { CurrencyConfig } from "@/lib/currency";

type AllocRow = { key: string; nombre: string; porcentaje: string; tasa: string; plazo: string };
let allocRowSeq = 0;
const blankAllocRow = (): AllocRow => ({
  key: String(++allocRowSeq),
  nombre: "",
  porcentaje: "",
  tasa: "",
  plazo: "",
});

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
  const router = useRouter();
  const isEdit = !!fondo;
  const [confirmDel, setConfirmDel] = useState(false);
  const [allocRows, setAllocRows] = useState<AllocRow[]>([]);
  const totalPct = allocRows.reduce((a, r) => a + (Number(r.porcentaje) || 0), 0);

  function updateAllocRow(key: string, patch: Partial<AllocRow>) {
    setAllocRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeAllocRow(key: string) {
    setAllocRows((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? t("fondos.editTitle") : t("fondos.newTitle")}
    >
      <form
        action={async (fd) => {
          if (!isEdit && allocRows.length > 0) {
            const validas = allocRows.filter((r) => r.nombre.trim());
            fd.set(
              "asignaciones",
              JSON.stringify(
                validas.map((r) => ({
                  nombre: r.nombre.trim(),
                  porcentaje: Number(r.porcentaje) || 0,
                  tasa_retorno_estimada: r.tasa === "" ? null : Number(r.tasa),
                  plazo_proyeccion_anios: r.plazo === "" ? null : Number(r.plazo),
                })),
              ),
            );
          }
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

        {tienePosiciones || (!isEdit && allocRows.length > 0) ? (
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

        {!isEdit && (
          <div className="space-y-2 rounded-lg bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">{t("fondos.positions")}</p>
            <p className="text-xs text-gray-400">{t("fondos.positionsDesc")}</p>
            {allocRows.map((r) => (
              <div key={r.key} className="space-y-2 rounded-lg border border-border bg-white p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t("fondos.positionName")}
                    value={r.nombre}
                    onChange={(e) => updateAllocRow(r.key, { nombre: e.target.value })}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="%"
                      value={r.porcentaje}
                      onChange={(e) => updateAllocRow(r.key, { porcentaje: e.target.value })}
                      className="w-16 text-right"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAllocRow(r.key)}
                    aria-label={t("common.delete")}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-red"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder={t("fondos.estimatedRate")}
                    value={r.tasa}
                    onChange={(e) => updateAllocRow(r.key, { tasa: e.target.value })}
                  />
                  <Select
                    value={r.plazo}
                    onChange={(e) => updateAllocRow(r.key, { plazo: e.target.value })}
                  >
                    <option value="">{t("fondos.term")}</option>
                    {FONDO_PLAZOS.map((p) => (
                      <option key={p} value={p}>
                        {p} {t("fondos.years")}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
            {allocRows.length > 0 && (
              <p className={`text-xs ${totalPct === 100 ? "text-green" : "text-red"}`}>
                {t("fondos.totalAssigned", { n: totalPct })}
              </p>
            )}
            <button
              type="button"
              onClick={() => setAllocRows((prev) => [...prev, blankAllocRow()])}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-gray-500 hover:border-navy-light hover:text-navy"
            >
              <Plus size={15} />
              {t("fondos.newPosition")}
            </button>
          </div>
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
              // Si se borró desde la propia página de detalle del fondo
              // (/patrimonio/fondos/[id]), esa ruta ya no existe — hay que
              // salir de ahí, si no la próxima recarga da 404.
              router.push("/patrimonio");
            }}
          />
        </div>
      )}
    </Sheet>
  );
}
