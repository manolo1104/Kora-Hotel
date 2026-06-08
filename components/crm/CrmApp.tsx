"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Download, LayoutGrid, List } from "lucide-react";
import { ETAPAS, type Etapa, type Lead } from "@/lib/crm/types";
import { api } from "./util";
import { PipelineSummary } from "./PipelineSummary";
import { KanbanBoard } from "./KanbanBoard";
import { LeadList } from "./LeadList";
import { LeadForm } from "./LeadForm";

export function CrmApp({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [tab, setTab] = useState<"tablero" | "lista">("tablero");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Etapa | "">("");
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filtro && l.etapa !== filtro) return false;
      if (!needle) return true;
      return (
        l.hotel_nombre.toLowerCase().includes(needle) ||
        (l.tomador_nombre || "").toLowerCase().includes(needle) ||
        (l.ciudad || "").toLowerCase().includes(needle)
      );
    });
  }, [leads, q, filtro]);

  async function onStageChange(id: string, etapa: Etapa) {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, etapa } : l)));
    try {
      await api(`/api/crm/leads/${id}`, { method: "PATCH", body: JSON.stringify({ etapa }) });
    } catch {
      setLeads(prev); // revertir si falla
      alert("No se pudo cambiar la etapa.");
    }
  }

  function onCreated(lead: Lead) {
    setLeads((ls) => [lead, ...ls]);
    setShowForm(false);
  }

  const btn = "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors";

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-kora-text">Mis prospectos</h1>
          <p className="text-sm text-kora-muted">{leads.length} leads en total</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/crm/export" className={`${btn} border border-gray-200 text-kora-muted hover:bg-white`}>
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
          </a>
          <button onClick={() => setShowForm(true)} className={`${btn} bg-kora-primary text-white hover:bg-kora-primary-dark`}>
            <Plus className="h-4 w-4" /> Nuevo lead
          </button>
        </div>
      </div>

      <PipelineSummary leads={leads} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setTab("tablero")}
            className={`${btn} ${tab === "tablero" ? "bg-white shadow-sm text-kora-text" : "text-kora-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" /> Tablero
          </button>
          <button
            onClick={() => setTab("lista")}
            className={`${btn} ${tab === "lista" ? "bg-white shadow-sm text-kora-text" : "text-kora-muted"}`}
          >
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
        <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar hotel, persona, ciudad…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-kora-accent"
            />
          </div>
          {tab === "lista" && (
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as Etapa | "")}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent"
            >
              <option value="">Todas</option>
              {ETAPAS.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-kora-muted text-sm">Aún no tienes leads.</p>
          <button onClick={() => setShowForm(true)} className={`${btn} mt-4 bg-kora-primary text-white hover:bg-kora-primary-dark mx-auto`}>
            <Plus className="h-4 w-4" /> Agregar el primero
          </button>
        </div>
      ) : tab === "tablero" ? (
        <KanbanBoard leads={filtered} onStageChange={onStageChange} />
      ) : (
        <LeadList leads={filtered} />
      )}

      {showForm && <LeadForm onClose={() => setShowForm(false)} onSaved={onCreated} />}
    </main>
  );
}
