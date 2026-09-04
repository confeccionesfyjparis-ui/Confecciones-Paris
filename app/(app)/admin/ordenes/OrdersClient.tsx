"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrder, setOrderStatus, deleteOrder } from "@/lib/actions/orders";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

type Garment = { id: string; name: string };
type OrderOp = { id: string; operation_name: string; rate: number; total_qty: number; processed_qty: number };
type Order = {
  id: string;
  number: string;
  client: string | null;
  color: string | null;
  size: string | null;
  initial_qty: number;
  status: string;
  garment_name: string;
  operations: OrderOp[];
};

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_produccion: "En producción",
  terminada: "Terminada",
  cerrada: "Cerrada",
};
const STATUS_STYLE: Record<string, string> = {
  pendiente: "bg-[#EFE9DC] text-[#6B5B3A]",
  en_produccion: "bg-[#DCE8E3] text-[#2A5A47]",
  terminada: "bg-[#DCE3EE] text-[#2A3F5A]",
  cerrada: "bg-[#E7E5E0] text-[#57534C]",
};
const NEXT_STATUS: Record<string, string> = {
  pendiente: "en_produccion",
  en_produccion: "terminada",
  terminada: "cerrada",
};
const NEXT_LABEL: Record<string, string> = {
  pendiente: "Marcar en producción",
  en_produccion: "Marcar terminada",
  terminada: "Cerrar orden",
};

export function OrdersClient({ initialOrders, garments }: { initialOrders: Order[]; garments: Garment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [form, setForm] = useState({
    number: "",
    garmentId: garments[0]?.id || "",
    client: "",
    color: "",
    size: "",
    initialQty: "",
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
  });
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }

  function submitOrder() {
    startTransition(async () => {
      try {
        const res = await createOrder({
          number: form.number,
          garmentId: form.garmentId,
          client: form.client,
          color: form.color,
          size: form.size,
          initialQty: Number(form.initialQty),
          startDate: form.startDate,
          dueDate: form.dueDate,
        });
        notify(`Orden ${res.number} creada con ${res.operationsCount} operaciones.`);
        setForm({ ...form, number: "", client: "", color: "", size: "", initialQty: "" });
        setShowForm(false);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo crear la orden.", "error");
      }
    });
  }

  function changeStatus(orderId: string, status: string) {
    startTransition(async () => {
      try {
        await setOrderStatus(orderId, status);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo cambiar el estado.", "error");
      }
    });
  }

  function removeOrder(orderId: string, number: string) {
    if (!confirm(`¿Eliminar la orden ${number}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteOrder(orderId);
        notify(`Orden ${number} eliminada.`);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo eliminar la orden.", "error");
      }
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <div className="text-[15px] font-semibold text-[var(--navy)]">Órdenes de producción</div>
        <button
          className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "Nueva orden"}
        </button>
      </div>

      {toast && (
        <div
          className={`rounded-lg px-3.5 py-2.5 text-sm mb-3.5 ${
            toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {showForm && (
        <div className="app-card p-4 mb-4">
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Número de orden">
              <input className="in" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="ORD-001" />
            </Field>
            <Field label="Referencia">
              <select className="in" value={form.garmentId} onChange={(e) => setForm({ ...form, garmentId: e.target.value })}>
                {garments.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Cliente">
              <input className="in" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Opcional" />
            </Field>
            <Field label="Color">
              <input className="in" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Ej: Negro" />
            </Field>
            <Field label="Talla">
              <input className="in" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="Ej: S, M, L" />
            </Field>
            <Field label="Cantidad inicial">
              <input type="number" min="1" className="in" value={form.initialQty} onChange={(e) => setForm({ ...form, initialQty: e.target.value })} placeholder="500" />
            </Field>
            <Field label="Fecha inicio">
              <input type="date" className="in" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Fecha límite">
              <input type="date" className="in" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
          </div>
          <button
            className="w-full mt-4 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={isPending || !form.number || !form.initialQty}
            onClick={submitOrder}
          >
            Crear orden y generar operaciones
          </button>
        </div>
      )}

      {initialOrders.length === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no hay órdenes creadas.</div>
      ) : (
        initialOrders.map((o) => {
          const finishedUnits = o.operations.length > 0 ? Math.min(...o.operations.map((op) => op.processed_qty)) : 0;
          const totalCapacity = o.operations.reduce((s, op) => s + op.total_qty, 0);
          const totalProcessed = o.operations.reduce((s, op) => s + op.processed_qty, 0);
          const avgPct = totalCapacity > 0 ? Math.round((totalProcessed / totalCapacity) * 100) : 0;
          const bottleneck = o.operations.reduce(
            (min, op) => (!min || op.processed_qty < min.processed_qty ? op : min),
            null as OrderOp | null
          );
          const isOpen = openOrderId === o.id;

          return (
            <div key={o.id} className="app-card mb-2.5 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3.5 cursor-pointer" onClick={() => setOpenOrderId(isOpen ? null : o.id)}>
                <div>
                  <div className="text-sm font-semibold">{o.number} · {o.garment_name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {o.client ? `${o.client} · ` : ""}
                    {o.color ? `Color ${o.color} · ` : ""}
                    {o.size ? `Talla ${o.size} · ` : ""}
                    {o.initial_qty} unidades · avance promedio {avgPct}%
                  </div>
                  <div className="text-xs font-semibold text-[var(--green)] mt-1">
                    Prendas terminadas (todas sus operaciones): {finishedUnits} de {o.initial_qty}
                  </div>
                </div>
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full shrink-0 ml-2 ${STATUS_STYLE[o.status]}`}>
                  {STATUS_LABEL[o.status]}
                </span>
              </div>

              {isOpen && (
                <div className="border-t border-[var(--card-border)] px-4 py-3">
                  {o.operations.map((op) => {
                    const pct = op.total_qty > 0 ? Math.round((op.processed_qty / op.total_qty) * 100) : 0;
                    const pending = op.total_qty - op.processed_qty;
                    const isBottleneck = bottleneck?.id === op.id && pending > 0;
                    return (
                      <div
                        key={op.id}
                        className={`grid grid-cols-[1.6fr_1fr_auto] items-center gap-2.5 py-1.5 ${isBottleneck ? "bg-[#FBF0DC] rounded px-1.5" : ""}`}
                      >
                        <div className="text-xs">
                          {op.operation_name}
                          {isBottleneck && <span className="text-[var(--mustard-deep)] font-semibold text-[11px]"> · cuello de botella</span>}
                        </div>
                        <div className="h-[5px] bg-[#EEECE3] rounded overflow-hidden">
                          <div className="h-full bg-[var(--green)] rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[11.5px] text-[var(--muted)] text-right">
                          {op.processed_qty}/{op.total_qty} · faltan {pending} · {fmtCOP(op.rate)}/u
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 mt-3">
                    {NEXT_STATUS[o.status] && (
                      <button
                        className="border border-[var(--navy)] text-[var(--navy)] rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          changeStatus(o.id, NEXT_STATUS[o.status]);
                        }}
                      >
                        {NEXT_LABEL[o.status]}
                      </button>
                    )}
                    <button
                      className="border border-[var(--red)] text-[var(--red)] rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOrder(o.id, o.number);
                      }}
                    >
                      Eliminar orden
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
