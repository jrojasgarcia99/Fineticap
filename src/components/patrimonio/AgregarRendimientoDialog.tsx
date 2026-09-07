"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useT } from "@/components/i18n/I18nProvider";
import type { Moneda, FondoPosicion } from "@/lib/types";

export function AgregarRendimientoDialog({
  fondoId,
  moneda,
  posiciones,
  action,
}: {
  fondoId: string;
  moneda: Moneda;
  posiciones?: FondoPosicion[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/25"
      >
        <Plus size={15} />
        {t("fondos.addReturn")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("fondos.addReturn")}>
        <form
          action={async (fd) => {
            await action(fd);
            setOpen(false);
          }}
          className="space-y-4 p-5"
        >
          <input type="hidden" name="fondo_id" value={fondoId} />
          <input type="hidden" name="moneda" value={moneda} />
          {posiciones && posiciones.length > 0 && (
            <Field label={t("fondos.forPosition")}>
              <Select name="posicion_id" defaultValue="">
                <option value="">{t("fondos.splitByPct")}</option>
                {posiciones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t("fondos.returnAmount")}>
            <Input type="number" step="0.01" min="0" name="monto" required autoFocus />
          </Field>
          <Field label={t("fondos.returnDesc")}>
            <Input name="descripcion" placeholder={t("fondos.returnDescPh")} />
          </Field>
          <Button type="submit" className="w-full">
            {t("common.add")}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
