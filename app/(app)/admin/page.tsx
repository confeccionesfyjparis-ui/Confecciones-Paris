import { getDashboardData } from "@/lib/actions/dashboard";

function fmtCOP(n: number) {
  return "$" + Math.round(n || 0).toLocaleString("es-CO");
}

export default async function DashboardPage() {
  const d = await getDashboardData();

  return (
    <div>
      {!d.period && (
        <div className="bg-[#FBF0DC] border border-[#E9CE93] text-[#7A5B12] rounded-lg px-3.5 py-2.5 text-sm mb-4">
          No hay período abierto. Ve a la pestaña "Períodos" para crear y abrir el corte actual.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard label="Producción de hoy" value={fmtCOP(d.totalToday)} />
        <StatCard label="Producción del corte" value={fmtCOP(d.totalPeriod)} />
        <StatCard label="Unidades del corte" value={d.unitsPeriod.toLocaleString("es-CO")} />
        <StatCard label="Colaboradores activos" value={String(d.activeEmployees)} />
      </div>

      <div className="app-card p-4 mb-4">
        <div className="text-[13.5px] font-semibold text-[var(--navy)]">Utilidad del corte actual</div>
        <div className="text-[11.5px] text-[var(--muted)] mt-0.5 mb-3">
          Ingreso por prendas que terminaron TODAS sus operaciones durante este corte, menos lo
          pagado en mano de obra en el mismo corte.
        </div>
        {d.missingPriceGarments.length > 0 && (
          <div className="bg-[#FBF0DC] border border-[#E9CE93] text-[#7A5B12] rounded-lg px-3.5 py-2.5 text-sm mb-3">
            Faltan precios de venta para: {d.missingPriceGarments.join(", ")}. Defínelos en
            "Operaciones y tarifas" para que la utilidad sea exacta.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard label="Ingreso estimado del corte" value={fmtCOP(d.revenuePeriod)} />
          <StatCard label="Costo de mano de obra del corte" value={fmtCOP(d.totalPeriod)} />
        </div>
        <div className="flex justify-between items-center mt-3 px-4 py-3.5 rounded-lg" style={{ background: "#F7F1E3" }}>
          <div className="text-[13.5px] font-semibold text-[var(--navy)]">Utilidad del corte</div>
          <div className="text-xl font-bold" style={{ color: d.profitPeriod >= 0 ? "var(--green)" : "var(--red)" }}>
            {fmtCOP(d.profitPeriod)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
        <div className="app-card p-4">
          <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">Top de productividad (corte actual)</div>
          {d.topEmployees.length === 0 ? (
            <div className="text-sm text-[var(--muted)] py-3 text-center">Sin registros todavía en este corte.</div>
          ) : (
            d.topEmployees.map((e) => (
              <BarRow key={e.name} label={e.name} value={fmtCOP(e.total)} pct={(e.total / d.topEmployees[0].total) * 100} />
            ))
          )}
        </div>
        <div className="app-card p-4">
          <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">Operaciones con mayor producción</div>
          {d.topOperations.length === 0 ? (
            <div className="text-sm text-[var(--muted)] py-3 text-center">Sin registros todavía en este corte.</div>
          ) : (
            d.topOperations.map((o) => (
              <BarRow key={o.name} label={o.name} value={`${o.qty} u`} pct={(o.qty / d.topOperations[0].qty) * 100} />
            ))
          )}
        </div>
      </div>

      <div className="app-card p-4">
        <div className="text-[13.5px] font-semibold text-[var(--navy)] mb-2">Alertas de inventario</div>
        {d.inventoryAlerts.length === 0 ? (
          <div className="text-sm text-[var(--muted)] py-3 text-center">No hay operaciones cerca de agotarse.</div>
        ) : (
          d.inventoryAlerts.map((a, i) => (
            <div key={i} className="text-sm text-[var(--mustard-deep)] py-1.5 border-t border-[var(--card-border)]">
              {a}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-card p-3.5">
      <div className="text-[19px] font-bold text-[var(--navy)]">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}

function BarRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="flex justify-between text-[12.5px] mb-1">
        <span>{label}</span>
        <span className="text-[var(--muted)] font-semibold">{value}</span>
      </div>
      <div className="h-1.5 bg-[#EEECE3] rounded overflow-hidden">
        <div className="h-full bg-[var(--mustard)] rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
