"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { api } from "./util";

export function CrmHeader() {
  async function logout() {
    try {
      await api("/api/crm/logout", { method: "POST" });
    } finally {
      window.location.href = "/crm";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/crm" className="flex items-center gap-2">
          <span className="font-bold text-kora-text tracking-tight">Kora</span>
          <span className="rounded-md bg-kora-primary/10 px-2 py-0.5 text-xs font-semibold text-kora-primary">
            CRM
          </span>
        </Link>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 text-sm text-kora-muted hover:text-kora-text transition-colors"
        >
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </div>
    </header>
  );
}
