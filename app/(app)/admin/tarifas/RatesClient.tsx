"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGarment,
  addOperationToGarment,
  updateOperationRate,
  updateOperationName,
  updateGarmentSalePrice,
  deleteOperationFromGarment,
} from "@/lib/actions/garments";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

type Op = { id: string; name: string; rate: number };
type Garment = { id: string; name: string; sale_price: number | null; operations: Op[] };

export function RatesClient({ initialGarments }: { initialGarments: Garment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [openGarment, setOpenGarment] = useState<string | null>(initialGarments[0]?.id || null);

  const [showNewGarment, setShowNewGarment] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSalePrice, setNewSalePrice] = useState("");
  const [newOps, setNewOps] = useState([{ name: "", rate: "" }]);

  const [addingOpFor, setAddingOpFor] = useState<string | null>(null);
  const [newOpDraft, setNewOpDraft] = useState({ name: "", rate: "" });

  const [editingRate, setEditingRate] = useState<{ opId: string; value: string } | null>(null);
  const [editingName, setEditingName] = useState<{ opId: string; value: string } | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ garmentId: string; value: string } | null>(null);

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }

  function submitNewGarment() {
    const cleanOps = newOps
      .map((r) => ({ name: r.name.trim(), rate: Number(r.rate) }))
      .filter((r) => r.name && r.rate > 0);
    startTransition(async () => {
      try {
        const res = await createGarment({ name: newName, salePrice: Number(newSalePrice) || null, operations: cleanOps });
        notify(`Prenda "${res.name}" creada con ${cleanOps.length} operaciones.`);
        setNewName("");
        setNewSalePrice("");
        setNewOps([{ name: "", rate: "" }]);
        setShowNewGarment(false);
        setOpenGarment(res.id);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo crear la prenda.", "error");
      }
    });
  }

  function submitNewOp(garmentId: string) {
    startTransition(async () => {
      try {
        await addOperationToGarment(garmentId, newOpDraft.name, Number(newOpDraft.rate));
        notify(`Operación "${newOpDraft.name}" agregada.`);
        setAddingOpFor(null);
        setNewOpDraft({ name: "", rate: "" });
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo agregar la operación.", "error");
      }
    });
  }

  function saveRate() {
    if (!editingRate) return;
    startTransition(async () => {
      try {
        await updateOperationRate(editingRate.opId, Number(editingRate.value));
        notify("Tarifa actualizada.");
        setEditingRate(null);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo actualizar la tarifa.", "error");
      }
    });
  }

  function saveName() {
    if (!editingName) return;
    startTransition(async () => {
      try {
        await updateOperationName(editingName.opId, editingName.value);
        notify("Nombre de la operación corregido.");
        setEditingName(null);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo corregir el nombre.", "error");
      }
    });
  }

  function removeOperation(operationId: string, name: string) {
    if (!confirm(`¿Eliminar la operación "${name}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteOperationFromGarment(operationId);
        notify(`Operación "${name}" eliminada.`);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo eliminar la operación.", "error");
      }
    });
  }

  function saveSalePrice() {
    if (!editingPrice) return;
    startTransition(async () => {
      try {
        await updateGarmentSalePrice(editingPrice.garmentId, Number(editingPrice.value));
        notify("Precio de venta actualizado.");
        setEditingPrice(null);
        router.refresh();
      } catch (err: any) {
        notify(err.message || "No se pudo actualizar el precio.", "error");
      }
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <div className="text-[15px] font-semibold text-[var(--navy)]">Operaciones y tarifas por referencia</div>
        <button className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold" onClick={() => setShowNewGarment((v) => !v)}>
          {showNewGarment ? "Cancelar" : "Nueva prenda"}
        </button>
      </div>

      {toast && (
        <div className={`rounded-lg px-3.5 py-2.5 text-sm mb-3.5 ${toast.kind === "error" ? "bg-[var(--red-bg)] text-[var(--red)] border border-[#E3BBAB]" : "bg-[var(--green-bg)] text-[var(--green)] border border-[#BFDACB]"}`}>
          {toast.msg}
        </div>
      )}

      {showNewGarment && (
        <div className="app-card p-4 mb-4">
          <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">Nombre de la prenda / referencia</label>
          <input className="in" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Buzo Cangurera" />

          <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5 mt-4">Precio de venta (opcional)</label>
          <input type="number" className="in" value={newSalePrice} onChange={(e) => setNewSalePrice(e.target.value)} placeholder="Ej: 45000" />

          <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5 mt-4">Operaciones y tarifas</label>
          {newOps.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center mb-2">
              <input className="in flex-[2]" placeholder="Nombre de la operación" value={row.name} onChange={(e) => setNewOps((r) => r.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
              <input type="number" className="in flex-1" placeholder="Tarifa" value={row.rate} onChange={(e) => setNewOps((r) => r.map((x, i) => i === idx ? { ...x, rate: e.target.value } : x))} />
              {newOps.length > 1 && (
                <button className="ghost-btn" onClick={() => setNewOps((r) => r.filter((_, i) => i !== idx))}>Quitar</button>
              )}
            </div>
          ))}
          <button className="ghost-btn mt-1" onClick={() => setNewOps((r) => [...r, { name: "", rate: "" }])}>+ Agregar operación</button>

          <button className="w-full mt-4 bg-[var(--navy)] text-white rounded-lg py-2.5 text-sm font-semibold" disabled={isPending} onClick={submitNewGarment}>
            Crear prenda
          </button>
        </div>
      )}

      {initialGarments.map((g) => (
        <div key={g.id} className="app-card p-4 mb-3.5">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setOpenGarment(openGarment === g.id ? null : g.id)}>
            <div className="text-[13.5px] font-semibold text-[var(--navy)]">{g.name}</div>
            <div className="text-xs text-[var(--muted)]">{g.operations.length} operaciones</div>
          </div>

          {openGarment === g.id && (
            <div>
              <div className="flex justify-between items-center px-3 py-2.5 mt-2.5 mb-2 rounded-lg" style={{ background: "#F7F1E3" }}>
                <div>
                  <div className="text-[13px]">Precio de venta</div>
                  <div className="text-[11.5px] text-[var(--muted)]">Usado para calcular la utilidad en el Dashboard</div>
                </div>
                {editingPrice?.garmentId === g.id ? (
                  <div className="flex items-center gap-1.5">
                    <input type="number" className="in" style={{ width: 100 }} value={editingPrice.value} onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })} autoFocus />
                    <button className="primary-btn-sm" onClick={saveSalePrice}>Guardar</button>
                    <button className="ghost-btn" onClick={() => setEditingPrice(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13.5px] font-semibold">{g.sale_price ? fmtCOP(g.sale_price) : "Sin definir"}</span>
                    <button className="ghost-btn" onClick={() => setEditingPrice({ garmentId: g.id, value: String(g.sale_price || "") })}>
                      {g.sale_price ? "Editar" : "Definir"}
                    </button>
                  </div>
                )}
              </div>

              {g.operations.map((op) => (
                <div key={op.id} className="flex flex-col py-2 border-t border-[#F0EEE6]">
                  <div className="flex justify-between items-center">
                    {editingName?.opId === op.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input className="in" style={{ flex: 1 }} value={editingName.value} onChange={(e) => setEditingName({ ...editingName, value: e.target.value })} autoFocus />
                        <button className="primary-btn-sm" onClick={saveName}>Guardar</button>
                        <button className="ghost-btn" onClick={() => setEditingName(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="text-[13px] flex items-center gap-2">
                        {op.name}
                        <button className="text-[11px] underline" style={{ color: "var(--muted)" }} onClick={() => setEditingName({ opId: op.id, value: op.name })}>
                          corregir nombre
                        </button>
                      </div>
                    )}
                    {editingRate?.opId === op.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" className="in" style={{ width: 100 }} value={editingRate.value} onChange={(e) => setEditingRate({ ...editingRate, value: e.target.value })} autoFocus />
                        <button className="primary-btn-sm" onClick={saveRate}>Guardar</button>
                        <button className="ghost-btn" onClick={() => setEditingRate(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="text-[13.5px] font-semibold">{fmtCOP(op.rate)}</span>
                        <button className="ghost-btn" onClick={() => setEditingRate({ opId: op.id, value: String(op.rate) })}>Editar</button>
                        <button className="ghost-btn" style={{ color: "var(--red)", borderColor: "#E3BBAB" }} onClick={() => removeOperation(op.id, op.name)}>Eliminar</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {addingOpFor === g.id ? (
                <div className="flex gap-2 items-center mt-2.5">
                  <input className="in flex-[2]" placeholder="Nombre de la operación" value={newOpDraft.name} onChange={(e) => setNewOpDraft({ ...newOpDraft, name: e.target.value })} autoFocus />
                  <input type="number" className="in flex-1" placeholder="Tarifa" value={newOpDraft.rate} onChange={(e) => setNewOpDraft({ ...newOpDraft, rate: e.target.value })} />
                  <button className="primary-btn-sm" onClick={() => submitNewOp(g.id)}>Guardar</button>
                  <button className="ghost-btn" onClick={() => setAddingOpFor(null)}>Cancelar</button>
                </div>
              ) : (
                <button className="ghost-btn mt-2.5" onClick={() => { setAddingOpFor(g.id); setNewOpDraft({ name: "", rate: "" }); }}>
                  + Agregar operación a esta prenda
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <style jsx global>{`
        .in { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--card-border); padding: 0 10px; font-size: 14px; }
        .ghost-btn { background: transparent; color: var(--muted); border: 1px solid var(--card-border); border-radius: 7px; padding: 6px 10px; font-size: 12.5px; }
        .primary-btn-sm { background: var(--navy); color: white; border: none; border-radius: 7px; padding: 6px 10px; font-size: 12.5px; font-weight: 600; }
      `}</style>
    </div>
  );
}
