"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "./util";

// Cabecera del área del fundador. La navegación se agregó al partir el CRM en
// tres: antes /crm era sólo el tablero de leads y /crm/hoteles no se enlazaba
// desde ningún lado — había que escribir la URL a mano para llegar.
//
// 15 sep 2026: el CRM pasa a ser la vista de TODO el negocio y a operarse con
// botones (Manolo pidió dejar el SQL y los scripts). El orden va de lo que se
// mira cada día a lo que se mira de vez en cuando: Operaciones (qué pide
// atención hoy), Hoteles (cada cuenta y sus acciones), Prepago (saldo de Camila
// e interruptores), Bandeja (chats y alertas por atender) y Leads.

const NAV = [
  { href: "/crm", label: "Operaciones" },
  { href: "/crm/hoteles", label: "Hoteles" },
  { href: "/crm/prepago", label: "Prepago" },
  { href: "/crm/bandeja", label: "Bandeja" },
  { href: "/crm/leads", label: "Leads" },
];

/**
 * ¿Es la ficha de un lead (/crm/<uuid>)? Se compara con el uuid y no con «todo
 * lo que cuelga de /crm» para no marcar "Leads" en una página nueva que alguien
 * añada mañana bajo /crm.
 */
function esFichaDeLead(path: string): boolean {
  return /^\/crm\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(path);
}

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
          {/* Con cinco pestañas no caben a 400 px: se desplazan de lado en vez de
              empujar el botón de Salir fuera de la pantalla. */}
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {NAV.map((n) => {
              // "Operaciones" sólo se marca en la raíz exacta; si no, quedaría
              // activo también en /crm/leads y /crm/hoteles.
              //
              // La ficha de un lead vive en /crm/<uuid> (app/crm/[id]), que no
              // empieza por ninguna de las cinco rutas: sin esto, al abrir un
              // prospecto no se marcaba NINGUNA pestaña y el CRM parecía haberse
              // salido de sí mismo. Se marca "Leads", que es de donde se llega.
              const activo =
                n.href === "/crm"
                  ? path === "/crm"
                  : n.href === "/crm/leads"
                    ? path.startsWith("/crm/leads") || esFichaDeLead(path)
                    : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
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
