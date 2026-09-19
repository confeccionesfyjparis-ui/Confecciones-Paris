import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export async function GET(req: NextRequest) {
  await requireAdmin();
  const periodId = req.nextUrl.searchParams.get("periodId");

  const res = await pool.query(
    periodId
      ? `SELECT s.employee_id, e.name AS employee_name, s.total, s.deductions, s.net_total, s.sealed, s.is_manual,
                pp.start_date::text AS period_start, pp.end_date::text AS period_end
         FROM settlements s
         JOIN employees e ON e.id = s.employee_id
         JOIN production_periods pp ON pp.id = s.period_id
         WHERE s.period_id = $1
         ORDER BY e.name`
      : `SELECT s.employee_id, e.name AS employee_name, s.total, s.deductions, s.net_total, s.sealed, s.is_manual,
                pp.start_date::text AS period_start, pp.end_date::text AS period_end
         FROM settlements s
         JOIN employees e ON e.id = s.employee_id
         JOIN production_periods pp ON pp.id = s.period_id
         ORDER BY pp.start_date DESC, e.name`,
    periodId ? [periodId] : []
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Taller de confección";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Liquidaciones");
  sheet.columns = [
    { header: "Período", key: "period", width: 24 },
    { header: "Colaborador", key: "employee", width: 26 },
    { header: "Concepto", key: "concept", width: 18 },
    { header: "Producción bruta", key: "gross", width: 18 },
    { header: "Novedades", key: "deductions", width: 16 },
    { header: "Total neto", key: "net", width: 16 },
    { header: "Estado", key: "status", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const s of res.rows) {
    const deductionsList: { concept: string; amount: number }[] = s.deductions || [];
    const deductionsSum = deductionsList.reduce((sum, d) => sum + Number(d.amount), 0);
    const gross = Number(s.total);
    const net = Number(s.net_total ?? s.total);

    totalGross += gross;
    totalDeductions += deductionsSum;
    totalNet += net;

    sheet.addRow({
      period: `${fmtDateHuman(s.period_start)} - ${fmtDateHuman(s.period_end)}`,
      employee: s.employee_name,
      concept: s.is_manual ? "Prestación de servicios" : "Producción",
      gross,
      deductions: deductionsSum,
      net,
      status: s.sealed ? "Sellada" : "Pendiente",
    });
  }

  sheet.addRow({});
  const totalsRow = sheet.addRow({
    period: "",
    employee: "TOTALES",
    concept: "",
    gross: totalGross,
    deductions: totalDeductions,
    net: totalNet,
    status: "",
  });
  totalsRow.font = { bold: true };

  ["gross", "deductions", "net"].forEach((key) => {
    sheet.getColumn(key).numFmt = '"$"#,##0';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const label = res.rows[0] ? `${res.rows[0].period_start}` : new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidaciones_${label}.xlsx"`,
    },
  });
}
