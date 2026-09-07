"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatoMoneda } from "@/lib/calculations";
import type { Moneda } from "@/lib/types";

export const DONUT_COLORS = [
  "#0F2A4A",
  "#D4AF37",
  "#2E7D32",
  "#4A6FA5",
  "#B85C38",
  "#6B4C9A",
  "#0E7C86",
  "#C0392B",
];

/** Gráfico circular pequeño y genérico (diversificación de un fondo,
 *  composición del patrimonio) — sin datos, no renderiza nada. `size` en px
 *  (por defecto 160); usá el mismo orden de `data` en cualquier leyenda
 *  externa para que los colores coincidan (ver DONUT_COLORS). */
export function DonutChart({
  data,
  moneda,
  size = 160,
}: {
  data: { nombre: string; valor: number }[];
  moneda: Moneda;
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.valor, 0);
  if (total <= 0) return null;
  const outerRadius = size / 2 - 8;
  const innerRadius = outerRadius * 0.62;

  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="nombre"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatoMoneda(Number(value), moneda), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
