"use client";

import { Field, Input, Select } from "@/components/ui/Input";
import { useT } from "@/components/i18n/I18nProvider";
import type { ActivoCategoria } from "@/lib/types";

type CampoDef =
  | { key: string; labelKey: string; type: "text" }
  | { key: string; labelKey: string; type: "select"; opciones: string[] };

/** Campos opcionales por categoría — solo "tipo" usa opciones fijas
 *  (traducidas vía activos.opt.*), el resto es texto libre. */
const CAMPOS: Record<ActivoCategoria, CampoDef[]> = {
  efectivo_bancos: [{ key: "banco", labelKey: "activos.field.banco", type: "text" }],
  inversion_otra: [{ key: "emisor", labelKey: "activos.field.emisor", type: "text" }],
  bienes_raices: [
    { key: "tipo", labelKey: "activos.field.tipoInmueble", type: "select", opciones: ["casa", "apartamento", "terreno", "otro"] },
    { key: "ubicacion", labelKey: "activos.field.ubicacion", type: "text" },
  ],
  vehiculo: [
    { key: "tipo", labelKey: "activos.field.tipoVehiculo", type: "select", opciones: ["carro", "moto", "otro"] },
    { key: "marcaModelo", labelKey: "activos.field.marcaModelo", type: "text" },
    { key: "anio", labelKey: "activos.field.anioVehiculo", type: "text" },
  ],
  negocio_propio: [{ key: "participacion", labelKey: "activos.field.participacion", type: "text" }],
  objetos_valor: [
    { key: "tipo", labelKey: "activos.field.tipoObjeto", type: "select", opciones: ["joyas", "arte", "electronica", "otro"] },
  ],
  otro: [{ key: "detalle", labelKey: "activos.field.detalle", type: "text" }],
};

/** Campos opcionales que cambian según la categoría elegida — cada uno se
 *  manda al servidor como `detalle_<key>`, sin necesidad de serializar JSON. */
export function ActivoDetallesFields({
  categoria,
  defaultValues,
}: {
  categoria: ActivoCategoria;
  defaultValues?: Record<string, string> | null;
}) {
  const t = useT();
  const campos = CAMPOS[categoria] ?? [];
  if (campos.length === 0) return null;

  return (
    <div className="space-y-3">
      {campos.map((c) => (
        <Field key={c.key} label={t(c.labelKey)}>
          {c.type === "select" ? (
            <Select name={`detalle_${c.key}`} defaultValue={defaultValues?.[c.key] ?? ""}>
              <option value="">—</option>
              {c.opciones.map((o) => (
                <option key={o} value={o}>
                  {t(`activos.opt.${o}`)}
                </option>
              ))}
            </Select>
          ) : (
            <Input name={`detalle_${c.key}`} defaultValue={defaultValues?.[c.key] ?? ""} />
          )}
        </Field>
      ))}
    </div>
  );
}
