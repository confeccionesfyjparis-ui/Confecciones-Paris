"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { logout } from "@/lib/actions/auth";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/ordenes", label: "Órdenes" },
  { href: "/admin/tarifas", label: "Operaciones y tarifas" },
  { href: "/admin/colaboradores", label: "Colaboradores" },
  { href: "/admin/periodos", label: "Períodos" },
  { href: "/admin/liquidaciones", label: "Liquidaciones" },
  { href: "/admin/auditoria", label: "Auditoría" },
  { href: "/admin/usuarios-consulta", label: "Usuarios de consulta" },
];

export function AdminShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center bg-[var(--navy-deep)] text-white px-5 py-4">
        <div>
          <div className="text-base font-semibold">Panel administrativo</div>
          <div className="text-xs text-[#B7C0CC] mt-0.5">{adminName} · Taller de confección</div>
        </div>
        <button
          className="border border-[#47566B] text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={isPending}
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

      <div className="flex bg-white border-b border-[var(--card-border)] overflow-x-auto whitespace-nowrap">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3.5 py-3 text-[13px] shrink-0 ${
              pathname === t.href
                ? "font-semibold text-[var(--navy)] border-b-[3px] border-[var(--mustard)]"
                : "text-[var(--muted)]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="p-4 max-w-3xl mx-auto">{children}</div>
    </div>
  );
}
