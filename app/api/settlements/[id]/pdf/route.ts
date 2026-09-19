import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pool, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}
function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  const res = await pool.query(
    `SELECT s.id, s.total, s.lines, s.deductions, s.net_total, s.is_manual, s.sealed, s.generated_at, e.name AS employee_name,
            pp.start_date::text AS period_start, pp.end_date::text AS period_end
     FROM settlements s
     JOIN employees e ON e.id = s.employee_id
     JOIN production_periods pp ON pp.id = s.period_id
     WHERE s.id = $1`,
    [id]
  );
  if (res.rowCount === 0) {
    return NextResponse.json({ error: "Liquidación no encontrada." }, { status: 404 });
  }
  const settlement = res.rows[0];
  const lines: { operationName: string; garmentName?: string; orderNumber?: string; qty: number; rate: number; total: number }[] = settlement.lines;
  const deductions: { concept: string; amount: number; note: string | null }[] = settlement.deductions || [];

  // sellar si es la primera vez (idempotente)
  if (!settlement.sealed) {
    await withTransaction(async (client) => {
      await client.query(`UPDATE settlements SET sealed = true, sealed_at = now() WHERE id = $1`, [id]);
      await insertAudit(client, "admin", session.name, "Liquidación sellada", settlement.employee_name);
    });
  }

  // --- Generar PDF en media carta (8.5 x 5.5 pulgadas = 612 x 396 puntos) ---
  const doc = await PDFDocument.create();
  const W = 396; // 5.5in
  const H = 612; // 8.5in
  let page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 28;
  let y = H - 40;
  const ink = rgb(0.14, 0.13, 0.12);
  const muted = rgb(0.42, 0.4, 0.37);

  page.drawText("Taller de confección", { x: marginX, y, size: 15, font: fontBold, color: ink });
  y -= 20;
  page.drawText("Recibo de liquidación de producción", { x: marginX, y, size: 11, font, color: ink });
  y -= 26;

  page.drawText(`Colaborador: ${settlement.employee_name}`, { x: marginX, y, size: 10, font, color: ink });
  y -= 16;
  page.drawText(`Período: ${fmtDateHuman(settlement.period_start)} - ${fmtDateHuman(settlement.period_end)}`, { x: marginX, y, size: 10, font, color: ink });
  y -= 16;
  page.drawText(`Fecha de generación: ${fmtDateHuman(new Date().toISOString().slice(0, 10))}`, { x: marginX, y, size: 10, font, color: ink });
  y -= 24;

  page.drawText("Operación", { x: marginX, y, size: 9, font: fontBold, color: ink });
  page.drawText("Cant.", { x: marginX + 210, y, size: 9, font: fontBold, color: ink });
  page.drawText("Tarifa", { x: marginX + 250, y, size: 9, font: fontBold, color: ink });
  page.drawText("Total", { x: marginX + 305, y, size: 9, font: fontBold, color: ink });
  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: W - marginX, y }, thickness: 0.7, color: muted });
  y -= 14;

  for (const line of lines) {
    if (y < 60) {
      page = doc.addPage([W, H]);
      y = H - 40;
    }
    const ref = [line.orderNumber, line.garmentName].filter(Boolean).join(" · ");
    const label = ref ? `${line.operationName} (${ref})` : line.operationName;
    page.drawText(truncate(label, 40), { x: marginX, y, size: 9, font, color: ink });
    page.drawText(String(line.qty), { x: marginX + 210, y, size: 9, font, color: ink });
    page.drawText(fmtCOP(line.rate), { x: marginX + 250, y, size: 9, font, color: ink });
    page.drawText(fmtCOP(line.total), { x: marginX + 305, y, size: 9, font, color: ink });
    y -= 15;
  }

  y -= 6;
  page.drawLine({ start: { x: marginX, y }, end: { x: W - marginX, y }, thickness: 0.9, color: ink });
  y -= 18;
  page.drawText(settlement.is_manual ? "Subtotal:" : "Subtotal producción:", { x: marginX, y, size: 10, font, color: ink });
  page.drawText(fmtCOP(settlement.total), { x: marginX + 250, y, size: 10, font, color: ink });
  y -= 16;

  if (deductions.length > 0) {
    if (y < 90) {
      page = doc.addPage([W, H]);
      y = H - 40;
    }
    for (const d of deductions) {
      page.drawText(`${d.concept}${d.note ? ` (${d.note})` : ""}`, { x: marginX, y, size: 9.5, font, color: muted });
      page.drawText(`- ${fmtCOP(d.amount)}`, { x: marginX + 250, y, size: 9.5, font, color: rgb(0.7, 0.27, 0.18) });
      y -= 15;
    }
    y -= 4;
  }

  y -= 4;
  page.drawLine({ start: { x: marginX, y }, end: { x: W - marginX, y }, thickness: 0.9, color: ink });
  y -= 22;
  page.drawText("Total a pagar:", { x: marginX, y, size: 12, font: fontBold, color: ink });
  page.drawText(fmtCOP(settlement.net_total ?? settlement.total), { x: marginX + 250, y, size: 12, font: fontBold, color: ink });

  y -= 26;
  page.drawText("Documento generado por el sistema de producción del taller.", { x: marginX, y, size: 7.5, font, color: muted });

  const bytes = await doc.save();

  const filename = `liquidacion_${slugify(settlement.employee_name)}_${settlement.period_start}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
