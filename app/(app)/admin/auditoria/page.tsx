import { getAuditLogs } from "@/lib/actions/audit";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AuditPage() {
  const logs = await getAuditLogs();

  return (
    <div>
      <div className="text-[15px] font-semibold text-[var(--navy)] mb-3.5">Historial de auditoría</div>
      {logs.length === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-6">Todavía no hay eventos registrados.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div key={log.id} className="app-card px-3.5 py-3">
              <div className="text-sm font-semibold">{log.action}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                {log.actor_name ? `${log.actor_name} · ` : ""}
                {fmtDateTime(log.created_at)}
                {log.detail ? ` · ${log.detail}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
