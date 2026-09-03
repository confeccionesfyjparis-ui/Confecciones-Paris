"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openNextPeriod, closeOpenPeriod } from "@/lib/actions/periods";

function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

type Period = { id: string; start_date: string; end_date: string; status: string };

export function PeriodsClient({ initialPeriods }: { initialPeriods: Period[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);

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
        <div className="app-card p-4 mb-4">
          <div className="text-sm font-semibold">Período abierto: {fmtDateHuman(openPeriod.start_date)} – {fmtDateHuman(openPeriod.end_date)}</div>
          <div className="text-sm text-[var(--muted)] my-2">
            Todos los registros de producción de hoy se asocian automáticamente a este corte.
          </div>
          <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold" disabled={isPending} onClick={handleClose}>
            Cerrar período y generar liquidaciones
          </button>
        </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
