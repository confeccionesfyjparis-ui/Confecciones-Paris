"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, toggleEmployeeActive, resetEmployeePin } from "@/lib/actions/employees";

type Employee = { id: string; name: string; active: boolean };

export function EmployeesClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 5000);
  }

  function addEmployee() {
    if (!name.trim()) {
      notify("Escribe un nombre.", "error");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createEmployee(name);
        notify(`${res.name} agregado. Su PIN de acceso es ${res.pin} — compártelo con él/ella.`);
        setName("");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo agregar.", "error");
      }
    });
  }

  function toggleActive(id: string) {
    startTransition(async () => {
      await toggleEmployeeActive(id);
      router.refresh();
    });
  }

  function resetPin(id: string) {
    startTransition(async () => {
      const res = await resetEmployeePin(id);
      notify(`Nuevo PIN: ${res.pin}`);
      setResettingId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="text-[15px] font-semibold text-[var(--navy)] mb-3.5">Colaboradores</div>

      {toast && (
        <div className={`rounded-lg px-3.5 py-2.5 text-sm mb-3.5 ${toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"}`}>
          {toast.msg}
        </div>
      )}

      <div className="app-card p-4 mb-4">
        <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">Nombre completo</label>
        <div className="flex gap-2">
          <input className="in flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
          <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-sm font-semibold" disabled={isPending} onClick={addEmployee}>
            Agregar
          </button>
        </div>
        <div className="text-xs text-[var(--muted)] mt-1.5">
          El PIN se genera automáticamente y se muestra una sola vez al crear o resetear — anótalo para compartirlo.
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {initialEmployees.map((e) => (
          <div key={e.id} className="app-card flex justify-between items-center px-3.5 py-3">
            <div>
              <div className="text-sm font-semibold">{e.name}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{e.active ? "Activo" : "Inactivo"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="ghost-btn" onClick={() => resetPin(e.id)} disabled={isPending}>
                Resetear PIN
              </button>
              <button className="ghost-btn" onClick={() => toggleActive(e.id)} disabled={isPending}>
                {e.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
        .ghost-btn { background: transparent; color: var(--muted); border: 1px solid var(--card-border); border-radius: 7px; padding: 6px 10px; font-size: 12.5px; }
      `}</style>
    </div>
  );
}
