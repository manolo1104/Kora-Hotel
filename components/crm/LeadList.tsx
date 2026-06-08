"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import type { Lead } from "@/lib/crm/types";
import { StageBadge } from "./StageBadge";
import { money, fechaCorta, seguimiento } from "./util";

const SEG_CLS: Record<string, string> = {
  vencido: "text-red-600",
  hoy: "text-amber-600",
  futuro: "text-kora-muted",
};

export function LeadList({ leads }: { leads: Lead[] }) {
  const router = useRouter();

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-kora-muted">
        No hay leads que coincidan.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-kora-muted">
            <th className="px-4 py-3 font-medium">Hotel</th>
            <th className="px-4 py-3 font-medium">Tomador</th>
            <th className="px-4 py-3 font-medium">Contacto</th>
            <th className="px-4 py-3 font-medium">Etapa</th>
            <th className="px-4 py-3 font-medium text-right">Valor</th>
            <th className="px-4 py-3 font-medium">Próximo</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const seg = seguimiento(lead.proximo_seguimiento);
            return (
              <tr
                key={lead.id}
                onClick={() => router.push(`/crm/${lead.id}`)}
                className="border-b border-gray-50 last:border-0 hover:bg-kora-bg cursor-pointer"
              >
                <td className="px-4 py-3 font-semibold text-kora-text">{lead.hotel_nombre}</td>
                <td className="px-4 py-3 text-kora-muted">
                  {lead.tomador_nombre || "—"}
                  {lead.tomador_puesto && (
                    <span className="block text-xs text-gray-400">{lead.tomador_puesto}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-kora-muted">
                  {lead.contacto || lead.email || "—"}
                </td>
                <td className="px-4 py-3">
                  <StageBadge etapa={lead.etapa} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-kora-text">
                  {lead.valor_estimado ? money(lead.valor_estimado) : "—"}
                </td>
                <td className="px-4 py-3">
                  {seg ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${SEG_CLS[seg]}`}>
                      <Calendar className="h-3 w-3" /> {fechaCorta(lead.proximo_seguimiento)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
