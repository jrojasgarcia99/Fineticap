"use client";

import Link from "next/link";
import { formatoMoneda } from "@/lib/calculations";
import { useT } from "@/components/i18n/I18nProvider";
import type { FondoTipo } from "@/lib/types";
import type { Moneda } from "@/lib/types";

const TIPO_COLOR: Record<FondoTipo, string> = {
  inversion: "bg-gold/15 text-gold",
  ahorro: "bg-green/10 text-green",
  gasto_anual: "bg-navy/10 text-navy",
};

export function FondoCard({
  id,
  nombre,
  tipo,
  moneda,
  saldo,
  compartido,
}: {
  id: string;
  nombre: string;
  tipo: FondoTipo;
  moneda: Moneda;
  saldo: number;
  compartido?: boolean;
}) {
  const t = useT();
  return (
    <Link
      href={`/patrimonio/fondos/${id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium text-gray-700">{nombre}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPO_COLOR[tipo]}`}>
            {t(`fondos.type.${tipo}`)}
          </span>
          {compartido && (
            <span className="shrink-0 rounded-full bg-navy-light/10 px-2 py-0.5 text-[10px] font-semibold text-navy-light">
              {t("fondos.shared")}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-[15px] font-semibold text-navy">
        {formatoMoneda(saldo, moneda)}
      </span>
    </Link>
  );
}
