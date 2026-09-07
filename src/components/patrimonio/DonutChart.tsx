"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatoMoneda } from "@/lib/calculations";
import type { Moneda } from "@/lib/types";

const COLORS = ["#0F2A4A", "#D4AF37", "#2E7D32", "#4A6FA5", "#B85C38", "#6B4C9A", "#0E7C86", "#C0392B"];

/** Gráfico circular pequeño y genérico (diversificación de un fondo,
 *  composición del patrimonio) — sin datos, no renderiza nada. */
export function DonutChart({
  data,
  moneda,
}: {
  data: { nombre: string; valor: number }[];
  moneda: Moneda;
}) {
  const total = data.reduce((a, d) => a + d.valor, 0);
  if (total <= 0) return null;

  return (
    <div className="h-40 w-40 shrink-0">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="nombre"
            innerRadius={42}
            outerRadius={68}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
