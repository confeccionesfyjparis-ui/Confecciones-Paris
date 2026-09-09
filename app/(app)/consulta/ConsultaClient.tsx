"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}
function fmtDateHuman(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

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
  created_at: string;
  closed_at: string | null;
  operations: OrderOp[];
};

export function ConsultaClient({
  userName,
  orders,
  alerts,
}: {
  userName: string;
  orders: Order[];
  alerts: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center bg-[var(--navy-deep)] text-white px-5 py-4">
        <div>
          <div className="text-base font-semibold">{userName}</div>
          <div className="text-xs text-[#B7C0CC] mt-0.5">Consulta de órdenes e inventario</div>
        </div>
        <button
          className="border border-[#47566B] text-white rounded-lg px-3 py-1.5 text-sm"
          onClick={() =>
            startTransition(async () => {
              await logout();
              router.push("/login");
              router.refresh();
            })
          }
        >
          Salir
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="app-card p-4 mb-4">
          <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">Alertas de inventario</div>
          {alerts.length === 0 ? (
            <div className="text-sm text-[var(--muted)] py-3 text-center">No hay operaciones cerca de agotarse.</div>
          ) : (
            alerts.map((a, i) => (
              <div key={i} className="text-sm text-[var(--mustard-deep)] py-1.5 border-t border-[var(--card-border)]">
                {a}
              </div>
            ))
          )}
        </div>

        <div className="text-[15px] font-semibold text-[var(--navy)] mb-3">Órdenes de producción</div>
        {orders.length === 0 ? (
          <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no hay órdenes creadas.</div>
        ) : (
          orders.map((o) => {
            const totalCapacity = o.operations.reduce((s, op) => s + op.total_qty, 0);
            const totalProcessed = o.operations.reduce((s, op) => s + op.processed_qty, 0);
            const avgPct = totalCapacity > 0 ? Math.round((totalProcessed / totalCapacity) * 100) : 0;
            const finishedUnits = o.operations.length > 0 ? Math.min(...o.operations.map((op) => op.processed_qty)) : 0;
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
                      Prendas terminadas: {finishedUnits} de {o.initial_qty}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-1">
                      Creada: {fmtDateHuman(o.created_at)}
                      {o.closed_at ? ` · Cerrada: ${fmtDateHuman(o.closed_at)}` : ""}
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
