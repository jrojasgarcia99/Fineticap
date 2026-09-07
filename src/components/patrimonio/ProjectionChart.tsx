"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatoMoneda } from "@/lib/calculations";
import type { Moneda } from "@/lib/types";

const COLORS = ["#D4AF37", "#4A6FA5", "#2E7D32", "#B85C38", "#6B4C9A", "#0E7C86", "#C0392B"];
const TOTAL_KEY = "Total";

/** Línea por cada serie (una diversificación, o "Total" si es la única) —
 *  proyección año a año, no solo el valor final. */
export function ProjectionChart({
  data,
  series,
  moneda,
  yearLabel,
}: {
  data: Record<string, number>[];
  series: string[];
  moneda: Moneda;
  yearLabel: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="anio" tickFormatter={(v) => `${yearLabel} ${v}`} fontSize={12} />
          <YAxis
            tickFormatter={(v) => formatoMoneda(Number(v), moneda)}
            width={72}
            fontSize={11}
          />
          <Tooltip
            formatter={(value) => formatoMoneda(Number(value), moneda)}
            labelFormatter={(v) => `${yearLabel} ${v}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={key === TOTAL_KEY ? "#0F2A4A" : COLORS[i % COLORS.length]}
              strokeWidth={key === TOTAL_KEY ? 2.5 : 1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
