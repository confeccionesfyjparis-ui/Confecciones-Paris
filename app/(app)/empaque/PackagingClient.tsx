"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { registerPackaging } from "@/lib/actions/packaging";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Order = {
  id: string;
  number: string;
  garment_name: string;
  color: string | null;
  size: string | null;
  already_packaged: number;
};
type HistoryItem = { id: string; qty: number; registered_at: string; order_number: string; garment_name: string };

export function PackagingClient({
  userName,
  orders,
  initialHistory,
}: {
  userName: string;
  orders: Order[];
  initialHistory: HistoryItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"registrar" | "historial">("registrar");
  const [orderId, setOrderId] = useState("");
  const [qty, setQty] = useState("");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [history, setHistory] = useState(initialHistory);

  const selectedOrder = orders.find((o) => o.id === orderId);

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }

  function handleRegister() {
    if (!orderId || !qty) return;
    startTransition(async () => {
      try {
        const res = await registerPackaging(orderId, Number(qty));
        notify("Empaque registrado correctamente.");
        setHistory((prev) => [
          {
            id: res.id,
            qty: Number(qty),
            registered_at: new Date().toISOString(),
            order_number: selectedOrder?.number || "",
            garment_name: selectedOrder?.garment_name || "",
          },
          ...prev,
        ]);
        setQty("");
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo registrar.", "error");
      }
    });
  }

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center bg-[var(--navy-deep)] text-white px-5 py-4">
        <div>
          <div className="text-base font-semibold">{userName}</div>
          <div className="text-xs text-[#B7C0CC] mt-0.5">Empaque — control de prendas terminadas</div>
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
          Registrar empaque
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`flex-1 py-3.5 text-sm ${tab === "historial" ? "font-semibold text-[var(--navy)] border-b-[3px] border-[var(--mustard)]" : "text-[var(--muted)]"}`}
        >
          Mi historial
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {tab === "registrar" && (
          <div className="app-card p-4">
            <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">Orden / Referencia</label>
            <select className="in" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Selecciona una orden</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} · {o.garment_name}
                  {o.color ? ` · ${o.color}` : ""}
                  {o.size ? ` · Talla ${o.size}` : ""}
                </option>
              ))}
            </select>

            {selectedOrder && (
              <div className="mt-2.5 text-xs text-[var(--muted)]">
                Ya empacadas hasta ahora en esta orden: <span className="font-semibold">{selectedOrder.already_packaged}</span>
              </div>
            )}

            <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5 mt-4">Cantidad empacada</label>
            <input
              type="number"
              min="1"
              className="in"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              disabled={!orderId}
            />

            <button
              className="w-full mt-5 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
              disabled={!orderId || !qty || isPending}
              onClick={handleRegister}
            >
              Registrar empaque
            </button>
          </div>
        )}

        {tab === "historial" && (
          <div>
            {history.length === 0 ? (
              <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no has registrado ningún empaque.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((h) => (
                  <div key={h.id} className="app-card flex justify-between items-center px-3.5 py-3">
                    <div>
                      <div className="text-sm font-semibold">{h.order_number} · {h.garment_name}</div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">{fmtDateTime(h.registered_at)}</div>
                    </div>
                    <div className="text-sm font-bold text-[var(--navy)]">{h.qty} u</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
      `}</style>
    </div>
  );
}
