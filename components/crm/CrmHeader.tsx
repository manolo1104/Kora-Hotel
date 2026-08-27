"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "./util";

// Cabecera del área del fundador. La navegación se agregó al partir el CRM en
// tres: antes /crm era sólo el tablero de leads y /crm/hoteles no se enlazaba
// desde ningún lado — había que escribir la URL a mano para llegar.

const NAV = [
  { href: "/crm", label: "Operaciones" },
  { href: "/crm/leads", label: "Leads" },
  { href: "/crm/hoteles", label: "Hoteles" },
];

export function CrmHeader() {
  const path = usePathname() ?? "";

  async function logout() {
    try {
      await api("/api/crm/logout", { method: "POST" });
    } finally {
      window.location.href = "/crm";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/crm" className="flex items-center gap-2 flex-shrink-0">
            <span className="font-bold text-kora-text tracking-tight">Kora</span>
            <span className="rounded-md bg-kora-primary/10 px-2 py-0.5 text-xs font-semibold text-kora-primary">
              CRM
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              // "Operaciones" sólo se marca en la raíz exacta; si no, quedaría
              // activo también en /crm/leads y /crm/hoteles.
              const activo = n.href === "/crm" ? path === "/crm" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    activo
                      ? "bg-kora-primary/10 font-semibold text-kora-primary"
                      : "text-kora-muted hover:text-kora-text"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          onClick={logout}
          className="inline-flex flex-shrink-0 items-center gap-1.5 text-sm text-kora-muted hover:text-kora-text transition-colors"
        >
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
