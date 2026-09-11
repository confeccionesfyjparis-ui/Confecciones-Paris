"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin, loginEmployee, loginViewer } from "@/lib/actions/auth";

export function LoginForm({
  employees,
  viewers,
}: {
  employees: { id: string; name: string }[];
  viewers: { id: string; username: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [empError, setEmpError] = useState("");

  const [showAdmin, setShowAdmin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const [viewerUsername, setViewerUsername] = useState("");
  const [viewerPassword, setViewerPassword] = useState("");
  const [viewerError, setViewerError] = useState("");

  function submitEmployee() {
    setEmpError("");
    startTransition(async () => {
      try {
        await loginEmployee(employeeId, pin);
        router.push("/employee");
        router.refresh();
      } catch (err: any) {
        setEmpError(err.message || "No se pudo iniciar sesión.");
      }
    });
  }

  function submitAdmin() {
    setAdminError("");
    startTransition(async () => {
      try {
        await loginAdmin(username, password);
        router.push("/admin");
        router.refresh();
      } catch (err: any) {
        setAdminError(err.message || "No se pudo iniciar sesión.");
      }
    });
  }

  function submitViewer() {
    setViewerError("");
    startTransition(async () => {
      try {
        await loginViewer(viewerUsername, viewerPassword);
        router.push("/consulta");
        router.refresh();
      } catch (err: any) {
        setViewerError(err.message || "No se pudo iniciar sesión.");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-7">
          <div
            className="w-10 h-10 rounded-full shrink-0"
            style={{
              background:
                "conic-gradient(#c89b3c 0deg 90deg, #2d3b4e 90deg 180deg, #c89b3c 180deg 270deg, #2d3b4e 270deg 360deg)",
            }}
          />
          <div>
            <div className="text-[19px] font-semibold tracking-tight">Taller de confección</div>
            <div className="text-[13px] text-[var(--muted)]">Control de producción por operación</div>
          </div>
        </div>

        <div className="app-card p-4 mb-3.5">
          <div className="text-[13px] font-semibold text-[var(--navy)] mb-2.5">Soy colaborador</div>
          <select
            className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm"
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setPin("");
              setEmpError("");
            }}
          >
            <option value="">Selecciona tu nombre</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          {employeeId && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm mt-2.5"
              placeholder="Tu PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          )}
          {empError && <div className="text-xs text-[var(--red)] mt-1.5">{empError}</div>}
          <button
            className="w-full mt-3 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={!employeeId || !pin || isPending}
            onClick={submitEmployee}
          >
            Entrar a registrar producción
          </button>
        </div>

        <div className="app-card p-4 mb-3.5">
          <div className="text-[13px] font-semibold text-[var(--navy)] mb-2.5">Soy administrador</div>
          {showAdmin ? (
            <div>
              <input
                className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm mb-2.5"
                placeholder="Usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <input
                type="password"
                className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdmin()}
              />
              {adminError && <div className="text-xs text-[var(--red)] mt-1.5">{adminError}</div>}
              <button
                className="w-full mt-3 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
                disabled={!username || !password || isPending}
                onClick={submitAdmin}
              >
                Entrar
              </button>
            </div>
          ) : (
            <button
              className="w-full border border-[var(--navy)] text-[var(--navy)] rounded-lg py-2.5 text-sm font-semibold"
              onClick={() => setShowAdmin(true)}
            >
              Entrar al panel administrativo
            </button>
          )}
        </div>

        <div className="app-card p-4 mb-3.5">
          <div className="text-[13px] font-semibold text-[var(--navy)] mb-2.5">Soy usuario de consulta</div>
          <select
            className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm"
            value={viewerUsername}
            onChange={(e) => {
              setViewerUsername(e.target.value);
              setViewerPassword("");
              setViewerError("");
            }}
          >
            <option value="">Selecciona tu nombre</option>
            {viewers.map((v) => (
              <option key={v.id} value={v.username}>
                {v.username}
              </option>
            ))}
          </select>
          {viewerUsername && (
            <input
              type="password"
              className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm mt-2.5"
              placeholder="Contraseña"
              value={viewerPassword}
              onChange={(e) => setViewerPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitViewer()}
            />
          )}
          {viewerError && <div className="text-xs text-[var(--red)] mt-1.5">{viewerError}</div>}
          <button
            className="w-full mt-3 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={!viewerUsername || !viewerPassword || isPending}
            onClick={submitViewer}
          >
            Entrar a consultar órdenes e inventario
          </button>
        </div>

        <div className="text-xs text-[var(--muted)] leading-relaxed">
          Cada colaborador tiene su propio PIN y cada administrador su propio usuario y
          contraseña, verificados en el servidor — nadie puede registrar producción a nombre de
          otra persona.
        </div>
      </div>
    </div>
  );
}
