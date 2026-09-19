"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSettlement, deleteManualSettlement } from "@/lib/actions/settlements";
import { addNovedad, deleteDeduction } from "@/lib/actions/deductions";
import { NOVEDAD_CONCEPTS } from "@/lib/constants";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}
function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

type Line = { operationName: string; garmentName?: string; qty: number; rate: number; total: number };
type DeductionLine = { concept: string; amount: number; note: string | null };
type Settlement = {
  id: string;
  employee_id: string;
  employee_name: string;
  total: number;
  lines: Line[];
  deductions: DeductionLine[];
  net_total: number;
  is_manual: boolean;
  sealed: boolean;
  period_start: string;
  period_end: string;
};
type Employee = { id: string; name: string; active: boolean };
type Period = { id: string; start_date: string; end_date: string; status: string };

export function SettlementsClient({
  initialSettlements,
  employees,
  periods,
}: {
  initialSettlements: Settlement[];
  employees: Employee[];
  periods: Period[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualPeriodId, setManualPeriodId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualNote, setManualNote] = useState("");

  const [addingNovedadFor, setAddingNovedadFor] = useState<string | null>(null);
  const [novedadConcept, setNovedadConcept] = useState<string>(NOVEDAD_CONCEPTS[0].label);
  const [novedadAmount, setNovedadAmount] = useState("");
  const [novedadNote, setNovedadNote] = useState("");

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  }

  const byPeriod = new Map<string, { label: string; periodId: string; items: Settlement[] }>();
  for (const s of initialSettlements) {
    const key = `${s.period_start}_${s.period_end}`;
    if (!byPeriod.has(key)) {
      byPeriod.set(key, {
        label: `${fmtDateHuman(s.period_start)} – ${fmtDateHuman(s.period_end)}`,
        periodId: periods.find((p) => p.start_date === s.period_start && p.end_date === s.period_end)?.id || "",
        items: [],
      });
    }
    byPeriod.get(key)!.items.push(s);
  }

  function downloadPdf(id: string) {
    window.open(`/api/settlements/${id}/pdf`, "_blank");
    setTimeout(() => router.refresh(), 1200);
  }

  function downloadExcelForPeriod(periodId: string) {
    window.open(`/api/settlements/export?periodId=${periodId}`, "_blank");
  }

  function submitManualSettlement() {
    if (!manualEmployeeId || !manualPeriodId || !manualAmount) {
      notify("Completa colaborador, período y monto.", "error");
      return;
    }
    startTransition(async () => {
      try {
        await createManualSettlement({
          employeeId: manualEmployeeId,
          periodId: manualPeriodId,
          amount: Number(manualAmount),
          note: manualNote,
        });
        notify("Liquidación manual creada.");
        setManualEmployeeId("");
        setManualPeriodId("");
        setManualAmount("");
        setManualNote("");
        setShowManualForm(false);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo crear la liquidación.", "error");
      }
    });
  }

  function removeManualSettlement(id: string) {
    if (!confirm("¿Eliminar esta liquidación manual? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      try {
        await deleteManualSettlement(id);
        notify("Liquidación manual eliminada.");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo eliminar.", "error");
      }
    });
  }

  function submitNovedad(settlementId: string) {
    if (!novedadAmount) {
      notify("Escribe el monto de la novedad.", "error");
      return;
    }
    startTransition(async () => {
      try {
        await addNovedad({
          settlementId,
          concept: novedadConcept,
          amount: Number(novedadAmount),
          note: novedadNote,
        });
        notify("Novedad agregada.");
        setAddingNovedadFor(null);
        setNovedadAmount("");
        setNovedadNote("");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo agregar la novedad.", "error");
      }
    });
  }

  function removeNovedad(deductionId: string) {
    if (!confirm("¿Eliminar esta novedad?")) return;
    startTransition(async () => {
      try {
        await deleteDeduction(deductionId);
        notify("Novedad eliminada.");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo eliminar la novedad.", "error");
      }
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="text-[15px] font-semibold text-[var(--navy)]">Liquidaciones generadas</div>
        <button
          className="bg-[var(--navy)] text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          onClick={() => setShowManualForm((v) => !v)}
        >
          {showManualForm ? "Cancelar" : "Crear liquidación manual"}
        </button>
      </div>

      {toast && (
        <div className={`rounded-lg px-3.5 py-2.5 text-sm mb-3.5 ${toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"}`}>
          {toast.msg}
        </div>
      )}

      {showManualForm && (
        <div className="app-card p-4 mb-4">
          <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">Liquidación manual — Prestación de servicios</div>
          <div className="text-xs text-[var(--muted)] mb-3">
            Para colaboradores de salario fijo, independiente de la producción por destajo.
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <select className="in" value={manualEmployeeId} onChange={(e) => setManualEmployeeId(e.target.value)}>
              <option value="">Selecciona colaborador</option>
              {employees.filter((e) => e.active).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <select className="in" value={manualPeriodId} onChange={(e) => setManualPeriodId(e.target.value)}>
              <option value="">Selecciona período</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {fmtDateHuman(p.start_date)} – {fmtDateHuman(p.end_date)} {p.status === "abierto" ? "(abierto)" : ""}
                </option>
              ))}
            </select>
            <input type="number" className="in" placeholder="Monto" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
            <input className="in" placeholder="Nota (opcional)" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
          </div>
          <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-sm font-semibold mt-3" disabled={isPending} onClick={submitManualSettlement}>
            Crear liquidación
          </button>
        </div>
      )}

      {byPeriod.size === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no se ha cerrado ningún período.</div>
      ) : (
        Array.from(byPeriod.entries()).map(([key, group]) => (
          <div key={key} className="app-card p-4 mb-3.5">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[13.5px] font-semibold text-[var(--navy)]">{group.label}</div>
              {group.periodId && (
                <button className="ghost-btn" onClick={() => downloadExcelForPeriod(group.periodId)}>
                  Descargar Excel de este período
                </button>
              )}
            </div>
            {group.items
              .sort((a, b) => b.total - a.total)
              .map((s) => {
                const isOpen = openId === s.id;
                return (
                  <div key={s.id} className="app-card mb-2.5 overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 cursor-pointer" onClick={() => setOpenId(isOpen ? null : s.id)}>
                      <div>
                        <div className="text-sm font-semibold">{s.employee_name}</div>
                        <div className="flex gap-2 mt-0.5">
                          {s.is_manual && <div className="text-[11px] text-[var(--mustard-deep)] font-semibold">Manual · Prestación de servicios</div>}
                          {s.sealed && <div className="text-[11px] text-[var(--green)] font-semibold">Sellada · PDF generado</div>}
                        </div>
                      </div>
                      <div className="font-medium">{fmtCOP(s.net_total ?? s.total)}</div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-[var(--card-border)] px-4 py-3">
                        {s.lines.map((l, i) => (
                          <div key={`${l.operationName}-${i}`} className="grid grid-cols-[1.6fr_1fr_auto] gap-2.5 py-1.5 text-[12.5px]">
                            <div>
                              {l.operationName}
                              {l.garmentName && <div className="text-[11px] text-[var(--muted)]">{l.garmentName}</div>}
                            </div>
                            <div className="text-[var(--muted)]">{l.qty} u × {fmtCOP(l.rate)}</div>
                            <div className="font-medium">{fmtCOP(l.total)}</div>
                          </div>
                        ))}

                        {s.deductions && s.deductions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[var(--card-border)]">
                            {s.deductions.map((d: any, i) => {
                              const isPositive = NOVEDAD_CONCEPTS.find((c) => c.label === d.concept)?.sign === 1;
                              return (
                                <div key={i} className="flex justify-between items-center py-1 text-[12.5px]">
                                  <div className="text-[var(--muted)]">{d.concept}{d.note ? ` · ${d.note}` : ""}</div>
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium" style={{ color: isPositive ? "var(--green)" : "var(--red)" }}>
                                      {isPositive ? "+ " : "- "}{fmtCOP(d.amount)}
                                    </div>
                                    {d.id && (
                                      <button
                                        className="text-[11px] underline"
                                        style={{ color: "var(--red)" }}
                                        onClick={(e) => { e.stopPropagation(); removeNovedad(d.id); }}
                                      >
                                        quitar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex justify-between pt-1.5 mt-1 border-t border-[var(--card-border)] text-[13px] font-semibold">
                              <div>Total neto</div>
                              <div>{fmtCOP(s.net_total ?? s.total)}</div>
                            </div>
                          </div>
                        )}

                        {addingNovedadFor === s.id ? (
                          <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
                            <select className="in" value={novedadConcept} onChange={(e) => setNovedadConcept(e.target.value)}>
                              {NOVEDAD_CONCEPTS.map((c) => (
                                <option key={c.label} value={c.label}>{c.label}</option>
                              ))}
                            </select>
                            <div className="flex gap-2 mt-2">
                              <input type="number" className="in" placeholder="Monto" value={novedadAmount} onChange={(e) => setNovedadAmount(e.target.value)} />
                              <input className="in" placeholder="Nota (opcional)" value={novedadNote} onChange={(e) => setNovedadNote(e.target.value)} />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                className="bg-[var(--navy)] text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                                onClick={(e) => { e.stopPropagation(); submitNovedad(s.id); }}
                              >
                                Guardar novedad
                              </button>
                              <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setAddingNovedadFor(null); }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="ghost-btn mt-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingNovedadFor(s.id);
                              setNovedadConcept(NOVEDAD_CONCEPTS[0].label);
                              setNovedadAmount("");
                              setNovedadNote("");
                            }}
                          >
                            + Agregar novedad
                          </button>
                        )}

                        <div className="flex gap-2 mt-3">
                          <button
                            className="flex-1 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPdf(s.id);
                            }}
                          >
                            {s.sealed ? "Volver a descargar PDF" : "Generar PDF y sellar liquidación"}
                          </button>
                          {s.is_manual && (
                            <button
                              className="ghost-btn"
                              style={{ color: "var(--red)", borderColor: "#E3BBAB" }}
                              onClick={(e) => { e.stopPropagation(); removeManualSettlement(s.id); }}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))
      )}

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
        .ghost-btn { background: transparent; color: var(--muted); border: 1px solid var(--card-border); border-radius: 7px; padding: 6px 10px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
