"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createViewerUser, toggleViewerActive, resetViewerPassword } from "@/lib/actions/users";

type ViewerUser = { id: string; username: string; active: boolean };

export function ViewersClient({ initialUsers }: { initialUsers: ViewerUser[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 5000);
  }

  function addUser() {
    if (!username.trim() || !password.trim()) {
      notify("Escribe usuario y contraseña.", "error");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createViewerUser(username, password);
        notify(`Usuario "${res.username}" creado. Comparte el usuario y la contraseña que pusiste con esa persona.`);
        setUsername("");
        setPassword("");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo crear el usuario.", "error");
      }
    });
  }

  function toggleActive(id: string) {
    startTransition(async () => {
      await toggleViewerActive(id);
      router.refresh();
    });
  }

  function savePassword(id: string) {
    if (!resetPassword.trim()) {
      notify("Escribe la nueva contraseña.", "error");
      return;
    }
    startTransition(async () => {
      try {
        await resetViewerPassword(id, resetPassword);
        notify("Contraseña actualizada.");
        setResettingId(null);
        setResetPassword("");
      } catch (err: any) {
        notify(err.message || "No se pudo actualizar la contraseña.", "error");
      }
    });
  }

  return (
    <div>
      <div className="text-[15px] font-semibold text-[var(--navy)] mb-2">Usuarios de consulta</div>
      <div className="bg-[#EEF1E9] border border-[#D3DAC4] text-[#4B5540] rounded-lg px-3.5 py-2.5 text-sm mb-4 leading-relaxed">
        Estos usuarios solo pueden ver Órdenes de producción y Alertas de inventario — no ven
        tarifas, colaboradores, liquidaciones ni la utilidad del negocio.
      </div>

      {toast && (
        <div className={`rounded-lg px-3.5 py-2.5 text-sm mb-3.5 ${toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"}`}>
          {toast.msg}
        </div>
      )}

      <div className="app-card p-4 mb-4">
        <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">Usuario y contraseña</label>
        <div className="flex gap-2">
          <input className="in flex-1" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nombre de usuario" />
          <input className="in flex-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" />
          <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-sm font-semibold" disabled={isPending} onClick={addUser}>
            Crear
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {initialUsers.map((u) => (
          <div key={u.id} className="app-card px-3.5 py-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold">{u.username}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{u.active ? "Activo" : "Inactivo"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="ghost-btn" onClick={() => { setResettingId(u.id); setResetPassword(""); }} disabled={isPending}>
                  Cambiar contraseña
                </button>
                <button className="ghost-btn" onClick={() => toggleActive(u.id)} disabled={isPending}>
                  {u.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
            {resettingId === u.id && (
              <div className="flex gap-2 mt-2.5">
                <input className="in flex-1" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nueva contraseña" autoFocus />
                <button className="primary-btn-sm" onClick={() => savePassword(u.id)}>Guardar</button>
                <button className="ghost-btn" onClick={() => setResettingId(null)}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
        .ghost-btn { background: transparent; color: var(--muted); border: 1px solid var(--card-border); border-radius: 7px; padding: 6px 10px; font-size: 12.5px; }
        .primary-btn-sm { background: var(--navy); color: white; border: none; border-radius: 7px; padding: 6px 10px; font-size: 12.5px; font-weight: 600; }
      `}</style>
    </div>
  );
}
