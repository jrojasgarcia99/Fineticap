import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getPersonalContext } from "@/lib/data";
import { tFor, mesesLabel } from "@/lib/i18n";
import type { Fondo, FondoMovimiento } from "@/lib/types";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Exporta el historial completo de movimientos de un fondo a `.xlsx`.
 *  Solo lectura — no hay import de vuelta, es un respaldo/reporte. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fondoId = searchParams.get("fondoId");
  if (!fondoId) return new Response("Falta fondoId", { status: 400 });

  const { supabase, locale } = await getPersonalContext();
  const t = tFor(locale);
  const MESES = mesesLabel(locale);

  // RLS decide si el usuario puede ver este fondo (propio o compartido).
  const { data: fondoRaw } = await supabase.from("fondos").select("*").eq("id", fondoId).maybeSingle();
  const fondo = fondoRaw as Fondo | null;
  if (!fondo) return new Response("No autorizado", { status: 403 });

  const { data: movRaw } = await supabase
    .from("fondo_movimientos")
    .select("*")
    .eq("fondo_id", fondoId)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false })
    .order("created_at", { ascending: false });
  const movimientos = (movRaw ?? []) as FondoMovimiento[];

  let nombrePorUsuario = new Map<string, string>();
  if (fondo.scope_type === "family") {
    const { data: roster } = await supabase.rpc("family_budget_roster");
    nombrePorUsuario = new Map(
      ((roster ?? []) as { user_id: string; display_name: string }[]).map((r) => [
        r.user_id,
        r.display_name,
      ]),
    );
  }

  const tipoLabel = (tipo: FondoMovimiento["tipo"]) =>
    tipo === "rendimiento"
      ? t("fondos.returnLabel")
      : tipo === "saldo_inicial"
        ? t("fondos.initialLabel")
        : t("fondos.contributionLabel");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Finetica";
  wb.created = new Date();
  const ws = wb.addWorksheet(fondo.nombre.slice(0, 31) || "Fondo");

  const headers = [
    t("xlsx.fondoColAnio"),
    t("xlsx.fondoColMes"),
    t("xlsx.fondoColTipo"),
    t("xlsx.fondoColDescripcion"),
    t("xlsx.fondoColMonto"),
    t("xlsx.fondoColMoneda"),
    ...(fondo.scope_type === "family" ? [t("xlsx.fondoColRegistradoPor")] : []),
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };

  for (const m of movimientos) {
    const row = [
      m.anio,
      MESES[m.mes - 1],
      tipoLabel(m.tipo),
      m.descripcion || "",
      Number(m.monto),
      m.moneda,
    ];
    if (fondo.scope_type === "family") {
      row.push(m.created_by ? nombrePorUsuario.get(m.created_by) || "—" : "—");
    }
    ws.addRow(row);
  }

  ws.getColumn(5).numFmt = "#,##0.00";
  ws.columns.forEach((col) => {
    col.width = 18;
  });

  const totalRow = ws.addRow([]);
  totalRow.getCell(4).value = t("fondos.balance");
  totalRow.getCell(4).font = { bold: true };
  totalRow.getCell(5).value = movimientos.reduce((a, m) => a + Number(m.monto), 0);
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(5).numFmt = "#,##0.00";

  const buf = await wb.xlsx.writeBuffer();
  const filename = `${fondo.nombre.replace(/[^\w\-]+/g, "_")}-historial.xlsx`;

  return new Response(buf as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
