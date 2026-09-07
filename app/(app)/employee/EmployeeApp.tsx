"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import {
  getOrderOperationsForEmployee,
  registerProduction,
  updateMyProductionQty,
} from "@/lib/actions/production";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}
function fmtDateHuman(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

type Order = { id: string; number: string; garment_name: string };
type OrderOp = {
  order_operation_id: string;
  operation_id: string;
  operation_name: string;
  rate: number;
  total_qty: number;
  processed_qty: number;
  available: number;
};
type Record_ = {
  id: string;
  operation_name: string;
  qty: number;
  rate: number;
  total: number;
  registered_at: string;
  order_number: string;
  garment_name: string;
};
type Period = { id: string; start_date: string; end_date: string } | null;

export function EmployeeApp({
  employeeName,
  orders,
  initialRecords,
  period,
}: {
  employeeName: string;
  orders: Order[];
  initialRecords: Record_[];
  period: Period;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"registrar" | "historial">("registrar");

  const [orderId, setOrderId] = useState("");
  const [ops, setOps] = useState<OrderOp[]>([]);
  const [operationId, setOperationId] = useState("");
  const [qty, setQty] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [records, setRecords] = useState(initialRecords);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setOperationId("");
    setQty("");
    setOps([]);
    if (!orderId) return;
    startTransition(async () => {
      const res = await getOrderOperationsForEmployee(orderId);
      setOps(res as OrderOp[]);
    });
  }, [orderId]);

  const selectedOp = ops.find((o) => o.operation_id === operationId);
  const myTotal = records.reduce((s, r) => s + Number(r.total), 0);

  function saveEdit(recordId: string) {
    const newQty = Number(editQty);
    if (!newQty || newQty <= 0) {
      setToast({ msg: "La cantidad debe ser mayor a cero.", kind: "error" });
      return;
    }
    startTransition(async () => {
      try {
        await updateMyProductionQty(recordId, newQty);
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId ? { ...r, qty: newQty, total: newQty * r.rate } : r
          )
        );
        setToast({ msg: "Registro corregido correctamente.", kind: "ok" });
        setEditingId(null);
        router.refresh();
      } catch (err: any) {
        setToast({ msg: err.message || "No se pudo corregir el registro.", kind: "error" });
      }
    });
  }

  function handleRegister() {
    if (!orderId || !operationId || !qty) return;
    startTransition(async () => {
      try {
        const res = await registerProduction({
          orderId,
          operationId,
          qty: Number(qty),
        });
        setToast({ msg: `Producción registrada. Disponible: ${res.available} unidades.`, kind: "ok" });
        setQty("");
        const opsRes = await getOrderOperationsForEmployee(orderId);
        setOps(opsRes as OrderOp[]);
        router.refresh();
        // recargar historial local rápido
        setRecords((prev) => [
          {
            id: res.recordId,
            operation_name: selectedOp!.operation_name,
            qty: Number(qty),
            rate: selectedOp!.rate,
            total: Number(qty) * selectedOp!.rate,
            registered_at: new Date().toISOString(),
            order_number: orders.find((o) => o.id === orderId)?.number || "",
            garment_name: orders.find((o) => o.id === orderId)?.garment_name || "",
          },
          ...prev,
        ]);
      } catch (err: any) {
        setToast({ msg: err.message || "No se pudo registrar.", kind: "error" });
      }
    });
  }

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center bg-[var(--navy-deep)] text-white px-5 py-4">
        <div>
          <div className="text-base font-semibold">{employeeName}</div>
          <div className="text-xs text-[#B7C0CC] mt-0.5">
            {period ? `Corte ${fmtDateHuman(period.start_date)} – ${fmtDateHuman(period.end_date)}` : "Sin período abierto"}
          </div>
        </div>
        <button
          className="border border-[#47566B] text-white rounded-lg px-3 py-1.5 text-sm"
          onClick={() => startTransition(async () => { await logout(); router.push("/login"); router.refresh(); })}
        >
          Salir
        </button>
      </div>

      {toast && (
        <div
          className={`mx-4 mt-3 rounded-lg px-3.5 py-2.5 text-sm ${
            toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex bg-white border-b border-[var(--card-border)]">
        <button
          onClick={() => setTab("registrar")}
          className={`flex-1 py-3.5 text-sm ${tab === "registrar" ? "font-semibold text-[var(--navy)] border-b-[3px] border-[var(--mustard)]" : "text-[var(--muted)]"}`}
        >
          Registrar
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`flex-1 py-3.5 text-sm ${tab === "historial" ? "font-semibold text-[var(--navy)] border-b-[3px] border-[var(--mustard)]" : "text-[var(--muted)]"}`}
        >
          Mi producción
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {tab === "registrar" && (
          <div>
            {!period && (
              <div className="bg-[#FBF0DC] border border-[#E9CE93] text-[#7A5B12] rounded-lg px-3.5 py-2.5 text-sm mb-4">
                No hay un período de producción abierto. Pide al administrador que lo abra antes de registrar.
              </div>
            )}
            <div className="app-card p-4">
              <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">Orden de producción</label>
              <select
                className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                <option value="">Selecciona una orden</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.number} · {o.garment_name}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5 mt-4">Operación</label>
              <select
                className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm"
                value={operationId}
                onChange={(e) => setOperationId(e.target.value)}
                disabled={!orderId}
              >
                <option value="">{orderId ? "Selecciona una operación" : "Primero elige una orden"}</option>
                {ops.map((o) => (
                  <option key={o.operation_id} value={o.operation_id} disabled={o.available <= 0}>
                    {o.operation_name} — disponible {o.available} · {fmtCOP(o.rate)}/u
                  </option>
                ))}
              </select>

              {selectedOp && (
                <div className="mt-2.5 flex items-baseline gap-2 bg-[var(--green-bg)] rounded-lg px-3 py-2.5">
                  <span className="text-xl font-bold text-[var(--green)]">{selectedOp.available}</span>
                  <span className="text-xs text-[#3E5A4C]">unidades disponibles para esta operación</span>
                </div>
              )}

              <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5 mt-4">Cantidad producida</label>
              <input
                type="number"
                min="1"
                className="w-full h-10 rounded-lg border border-[var(--card-border)] px-2.5 text-sm"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                disabled={!selectedOp}
              />

              <button
                className="w-full mt-5 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
                disabled={!selectedOp || !qty || !period || isPending}
                onClick={handleRegister}
              >
                Registrar producción
              </button>
            </div>

            <div className="flex gap-3 mt-4">
              <div className="flex-1 app-card text-center py-3.5">
                <div className="text-xl font-bold text-[var(--navy)]">{records.length}</div>
                <div className="text-xs text-[var(--muted)] mt-1">Registros este corte</div>
              </div>
              <div className="flex-1 app-card text-center py-3.5">
                <div className="text-xl font-bold text-[var(--navy)]">{fmtCOP(myTotal)}</div>
                <div className="text-xs text-[var(--muted)] mt-1">Acumulado del corte</div>
              </div>
            </div>
          </div>
        )}

        {tab === "historial" && (
          <div>
            <div className="flex justify-between items-center mb-3.5">
              <div className="text-[15px] font-semibold text-[var(--navy)]">Producción del período actual</div>
              <div className="text-base font-bold text-[var(--navy)]">{fmtCOP(myTotal)}</div>
            </div>
            {records.length === 0 ? (
              <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no has registrado producción en este corte.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {records.map((r) => (
                  <div key={r.id} className="app-card px-3.5 py-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-semibold">{r.operation_name}</div>
                        <div className="text-xs text-[var(--muted)] mt-0.5">
                          {r.order_number} · {r.garment_name}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] mt-0.5">
                          {fmtDateTime(r.registered_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--muted)]">{r.qty} u</div>
                        <div className="text-sm font-bold text-[var(--green)] mt-0.5">{fmtCOP(Number(r.total))}</div>
                      </div>
                    </div>

                    {isToday(r.registered_at) && (
                      <div className="mt-2 pt-2 border-t border-[var(--card-border)]">
                        {editingId === r.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              autoFocus
                              className="h-8 w-24 rounded-md border border-[var(--card-border)] px-2 text-sm"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                            />
                            <button
                              className="bg-[var(--navy)] text-white rounded-md px-3 py-1.5 text-xs font-semibold"
                              onClick={() => saveEdit(r.id)}
                            >
                              Guardar
                            </button>
                            <button
                              className="text-[var(--muted)] text-xs px-2"
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-xs text-[var(--navy)] font-semibold underline"
                            onClick={() => {
                              setEditingId(r.id);
                              setEditQty(String(r.qty));
                            }}
                          >
                            Corregir cantidad
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
