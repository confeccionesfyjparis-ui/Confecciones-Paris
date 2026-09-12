"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}
function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

type Line = { operationName: string; qty: number; rate: number; total: number };
type DeductionLine = { concept: string; amount: number; note: string | null };
type Settlement = {
  id: string;
  employee_name: string;
  total: number;
  lines: Line[];
  deductions: DeductionLine[];
  net_total: number;
  sealed: boolean;
  period_start: string;
  period_end: string;
};

export function SettlementsClient({ initialSettlements }: { initialSettlements: Settlement[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const byPeriod = new Map<string, { label: string; items: Settlement[] }>();
  for (const s of initialSettlements) {
    const key = `${s.period_start}_${s.period_end}`;
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { label: `${fmtDateHuman(s.period_start)} – ${fmtDateHuman(s.period_end)}`, items: [] });
    }
    byPeriod.get(key)!.items.push(s);
  }

  function downloadPdf(id: string) {
    window.open(`/api/settlements/${id}/pdf`, "_blank");
    setTimeout(() => router.refresh(), 1200);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="text-[15px] font-semibold text-[var(--navy)]">Liquidaciones generadas</div>
        {initialSettlements.length > 0 && (
          <button
            className="bg-[var(--navy)] text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold"
            onClick={() => window.open("/api/settlements/export", "_blank")}
          >
            Descargar Excel
          </button>
        )}
      </div>
      <div className="bg-[#EEF1E9] border border-[#D3DAC4] text-[#4B5540] rounded-lg px-3.5 py-2.5 text-sm mb-4 leading-relaxed">
        Genera el recibo en PDF (media carta) desde cada liquidación. Al generarlo por primera vez
        queda sellada: no se modifica aunque el colaborador siga registrando producción en
        períodos futuros.
      </div>

      {byPeriod.size === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no se ha cerrado ningún período.</div>
      ) : (
        Array.from(byPeriod.entries()).map(([key, group]) => (
          <div key={key} className="app-card p-4 mb-3.5">
            <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">{group.label}</div>
            {group.items
              .sort((a, b) => b.total - a.total)
              .map((s) => {
                const isOpen = openId === s.id;
                return (
                  <div key={s.id} className="app-card mb-2.5 overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 cursor-pointer" onClick={() => setOpenId(isOpen ? null : s.id)}>
                      <div>
                        <div className="text-sm font-semibold">{s.employee_name}</div>
                        {s.sealed && <div className="text-[11px] text-[var(--green)] font-semibold mt-0.5">Sellada · PDF generado</div>}
                      </div>
                      <div className="font-medium">{fmtCOP(s.net_total ?? s.total)}</div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-[var(--card-border)] px-4 py-3">
                        {s.lines.map((l) => (
                          <div key={l.operationName} className="grid grid-cols-[1.6fr_1fr_auto] gap-2.5 py-1.5 text-[12.5px]">
                            <div>{l.operationName}</div>
                            <div className="text-[var(--muted)]">{l.qty} u × {fmtCOP(l.rate)}</div>
                            <div className="font-medium">{fmtCOP(l.total)}</div>
                          </div>
                        ))}
                        {s.deductions && s.deductions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[var(--card-border)]">
                            {s.deductions.map((d, i) => (
                              <div key={i} className="flex justify-between py-1 text-[12.5px]">
                                <div className="text-[var(--muted)]">{d.concept}{d.note ? ` · ${d.note}` : ""}</div>
                                <div className="font-medium" style={{ color: "var(--red)" }}>- {fmtCOP(d.amount)}</div>
                              </div>
                            ))}
                            <div className="flex justify-between pt-1.5 mt-1 border-t border-[var(--card-border)] text-[13px] font-semibold">
                              <div>Total neto</div>
                              <div>{fmtCOP(s.net_total ?? s.total)}</div>
                            </div>
                          </div>
                        )}
                        <button
                          className="w-full mt-3 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPdf(s.id);
                          }}
                        >
                          {s.sealed ? "Volver a descargar PDF" : "Generar PDF y sellar liquidación"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))
      )}
    </div>
  );
}
