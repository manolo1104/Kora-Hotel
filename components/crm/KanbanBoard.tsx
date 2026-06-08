"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Mail, Calendar, GripVertical } from "lucide-react";
import { ETAPAS, type Etapa, type Lead } from "@/lib/crm/types";
import { money, fechaCorta, seguimiento } from "./util";

const SEG_CLS: Record<string, string> = {
  vencido: "text-red-600",
  hoy: "text-amber-600",
  futuro: "text-kora-muted",
};

function LeadCard({
  lead,
  onStageChange,
  dragProps,
}: {
  lead: Lead;
  onStageChange: (id: string, etapa: Etapa) => void;
  dragProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const seg = seguimiento(lead.proximo_seguimiento);
  return (
    <div
      {...dragProps}
      className="group rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <Link href={`/crm/${lead.id}`} className="block">
            <div className="font-semibold text-kora-text text-sm leading-tight truncate hover:text-kora-primary">
              {lead.hotel_nombre}
            </div>
            {lead.tomador_nombre && (
              <div className="text-xs text-kora-muted truncate">
                {lead.tomador_nombre}
                {lead.tomador_puesto ? ` · ${lead.tomador_puesto}` : ""}
              </div>
            )}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-kora-muted">
            {lead.contacto && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {lead.contacto}
              </span>
            )}
            {lead.email && (
              <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                <Mail className="h-3 w-3" /> {lead.email}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            {lead.valor_estimado ? (
              <span className="text-xs font-semibold text-kora-text">{money(lead.valor_estimado)}</span>
            ) : (
              <span />
            )}
            {seg && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${SEG_CLS[seg]}`}>
                <Calendar className="h-3 w-3" /> {fechaCorta(lead.proximo_seguimiento)}
              </span>
            )}
          </div>
          {/* Cambio de etapa por menú (respaldo para móvil donde arrastrar es difícil) */}
          <select
            value={lead.etapa}
            onChange={(e) => onStageChange(lead.id, e.target.value as Etapa)}
            className="mt-2 w-full rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] text-kora-muted focus:outline-none focus:ring-1 focus:ring-kora-accent sm:hidden"
          >
            {ETAPAS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard({
  leads,
  onStageChange,
}: {
  leads: Lead[];
  onStageChange: (id: string, etapa: Etapa) => void;
}) {
  const [overCol, setOverCol] = useState<Etapa | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
      {ETAPAS.map((col) => {
        const items = leads.filter((l) => l.etapa === col.id);
        const total = items.reduce((s, l) => s + (l.valor_estimado || 0), 0);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.id);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              setOverCol(null);
              if (id) onStageChange(id, col.id);
            }}
            className={`w-[260px] shrink-0 rounded-2xl p-2 transition-colors ${
              overCol === col.id ? "bg-kora-accent/10 ring-2 ring-kora-accent/40" : "bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-kora-text">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                {col.label}
                <span className="text-kora-muted font-normal">{items.length}</span>
              </div>
              {total > 0 && <span className="text-[11px] text-kora-muted">{money(total)}</span>}
            </div>
            <div className="space-y-2 px-1 min-h-[40px]">
              {items.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onStageChange={onStageChange}
                  dragProps={{
                    draggable: true,
                    onDragStart: (e) => e.dataTransfer.setData("text/plain", lead.id),
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
