"use client";

import { ETAPAS, type Lead } from "@/lib/crm/types";
import { money, seguimiento } from "./util";

export function PipelineSummary({ leads }: { leads: Lead[] }) {
  const activos = leads.filter((l) => l.etapa !== "ganado" && l.etapa !== "perdido");
  const vencidos = activos.filter((l) => seguimiento(l.proximo_seguimiento) === "vencido").length;
  const hoy = activos.filter((l) => seguimiento(l.proximo_seguimiento) === "hoy").length;
  const pipeline = activos.reduce((s, l) => s + (l.valor_estimado || 0), 0);
  const ganado = leads
    .filter((l) => l.etapa === "ganado")
    .reduce((s, l) => s + (l.valor_estimado || 0), 0);

  const card = "rounded-2xl border border-gray-100 bg-white p-4";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <div className="text-xs text-kora-muted">Leads activos</div>
          <div className="text-2xl font-bold text-kora-text">{activos.length}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-kora-muted">Pipeline (estimado)</div>
          <div className="text-2xl font-bold text-kora-text">{money(pipeline)}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-kora-muted">Ganado</div>
          <div className="text-2xl font-bold text-kora-accent-dark">{money(ganado)}</div>
        </div>
        <div className={card}>
          <div className="text-xs text-kora-muted">Seguimientos</div>
          <div className="text-2xl font-bold text-kora-text">
            {vencidos > 0 ? <span className="text-red-600">{vencidos} venc.</span> : "0 venc."}
            {hoy > 0 && <span className="text-amber-600 text-base font-semibold"> · {hoy} hoy</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ETAPAS.map((e) => {
          const n = leads.filter((l) => l.etapa === e.id).length;
          return (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-100 px-3 py-1 text-xs font-medium text-kora-text"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.label}
              <span className="text-kora-muted">{n}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
