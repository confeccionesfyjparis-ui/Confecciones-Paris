"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openNextPeriod, closeOpenPeriod, reopenPeriod } from "@/lib/actions/periods";
import { addDeduction, deleteDeduction } from "@/lib/actions/deductions";
import { DEDUCTION_CONCEPTS } from "@/lib/constants";

function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

type Period = { id: string; start_date: string; end_date: string; status: string };
type Employee = { id: string; name: string; active: boolean };
type Deduction = {
  id: string;
  employee_id: string;
  employee_name: string;
  concept: string;
  amount: number;
  note: string | null;
};

export function PeriodsClient({
  initialPeriods,
  initialDeductions,
  employees,
}: {
  initialPeriods: Period[];
  initialDeductions: Deduction[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [concept, setConcept] = useState<string>(DEDUCTION_CONCEPTS[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const openPeriod = initialPeriods.find((p) => p.status === "abierto");

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  function handleOpen() {
    startTransition(async () => {
      try {
        const res = await openNextPeriod();
        notify(`Período abierto: ${fmtDateHuman(res.start)} – ${fmtDateHuman(res.end)}`);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo abrir el período.", "error");
      }
    });
  }

  function handleClose() {
    startTransition(async () => {
      try {
        const res = await closeOpenPeriod();
        notify(`Período cerrado. Se generaron ${res.count} liquidaciones.`);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo cerrar el período.", "error");
      }
    });
  }

  function handleAddDeduction() {
    if (!employeeId || !amount) {
      notify("Selecciona el colaborador y escribe el monto.", "error");
      return;
    }
    startTransition(async () => {
      try {
        await addDeduction({ employeeId, concept, amount: Number(amount), note });
        notify("Deducción agregada.");
        setEmployeeId("");
        setAmount("");
        setNote("");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo agregar la deducción.", "error");
      }
    });
  }

  function handleDeleteDeduction(id: string) {
    if (!confirm("¿Eliminar esta deducción?")) return;
    startTransition(async () => {
      try {
        await deleteDeduction(id);
        notify("Deducción eliminada.");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo eliminar la deducción.", "error");
      }
    });
  }

  function handleReopen(periodId: string, label: string) {
    if (
      !confirm(
        `¿Reabrir el período ${label}? Esto devuelve todos los registros de producción a "activo" y ELIMINA las liquidaciones ya generadas de ese período (incluidas las que ya tengan PDF descargado). Tendrás que volver a cerrarlo cuando corresponda.`
      )
    )
      return;
    startTransition(async () => {
      try {
        const res = await reopenPeriod(periodId);
        notify(
          `Período reabierto. ${res.recordsReverted} registros devueltos a activo, ${res.settlementsDeleted} liquidaciones eliminadas.`
        );
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo reabrir el período.", "error");
      }
    });
  }

  return (
    <div>
      <div className="text-[15px] font-semibold text-[var(--navy)] mb-3.5">Cortes de producción (viernes a jueves)</div>

      {toast && (
        <div className={`rounded-lg px-3.5 py-2.5 text-sm mb-3.5 ${toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"}`}>
          {toast.msg}
        </div>
      )}

      {!openPeriod ? (
        <div className="app-card p-4 mb-4">
          <div className="text-sm text-[var(--muted)] mb-3">
            No hay ningún período abierto. Se abrirá automáticamente el siguiente corte
            viernes–jueves disponible, continuando justo después del último período creado.
          </div>
          <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold" disabled={isPending} onClick={handleOpen}>
            Abrir período actual
          </button>
        </div>
      ) : (
        <>
          <div className="app-card p-4 mb-4">
            <div className="text-sm font-semibold">Período abierto: {fmtDateHuman(openPeriod.start_date)} – {fmtDateHuman(openPeriod.end_date)}</div>
            <div className="text-sm text-[var(--muted)] my-2">
              Todos los registros de producción de hoy se asocian automáticamente a este corte.
            </div>
            <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold" disabled={isPending} onClick={handleClose}>
              Cerrar período y generar liquidaciones
            </button>
          </div>

          <div className="app-card p-4 mb-4">
            <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">Deducciones de este corte (novedades)</div>
            <div className="text-xs text-[var(--muted)] mb-3">
              Se restan del total de cada colaborador al cerrar el período y quedan como línea aparte en su recibo.
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <select className="in" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Selecciona colaborador</option>
                {employees.filter((e) => e.active).map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <select className="in" value={concept} onChange={(e) => setConcept(e.target.value)}>
                {DEDUCTION_CONCEPTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input type="number" className="in" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input className="in" placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-sm font-semibold mt-3" disabled={isPending} onClick={handleAddDeduction}>
              Agregar deducción
            </button>

            {initialDeductions.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {initialDeductions.map((d) => (
                  <div key={d.id} className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: "#F7F1E3" }}>
                    <div>
                      <div className="text-[13px] font-semibold">{d.employee_name}</div>
                      <div className="text-xs text-[var(--muted)]">{d.concept}{d.note ? ` · ${d.note}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--red)" }}>- {fmtCOP(d.amount)}</span>
                      <button className="ghost-btn" onClick={() => handleDeleteDeduction(d.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="text-[15px] font-semibold text-[var(--navy)] mb-3">Historial de períodos</div>
      {initialPeriods.length === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no se ha creado ningún período.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {initialPeriods.map((p) => (
            <div key={p.id} className="app-card flex justify-between items-center px-3.5 py-3">
              <div>
                <div className="text-sm font-semibold">{fmtDateHuman(p.start_date)} – {fmtDateHuman(p.end_date)}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{p.status === "abierto" ? "Abierto" : "Cerrado"}</div>
              </div>
              {p.status === "cerrado" && (
                <button
                  className="ghost-btn"
                  style={{ color: "var(--red)", borderColor: "#E3BBAB" }}
                  disabled={isPending}
                  onClick={() => handleReopen(p.id, `${fmtDateHuman(p.start_date)} – ${fmtDateHuman(p.end_date)}`)}
                >
                  Reabrir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
        .ghost-btn { background: transparent; color: var(--muted); border: 1px solid var(--card-border); border-radius: 7px; padding: 6px 10px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
