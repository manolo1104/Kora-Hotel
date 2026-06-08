"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { ETAPAS, type Lead } from "@/lib/crm/types";
import { api } from "./util";

const input =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-kora-text text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent";
const label = "block text-xs font-medium text-kora-muted mb-1";

const ORIGENES = ["Instagram", "Facebook", "Google Ads", "Referido", "WhatsApp", "Evento", "Otro"];

export function LeadForm({
  lead,
  onClose,
  onSaved,
}: {
  lead?: Lead | null;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const edit = Boolean(lead);
  const [f, setF] = useState({
    hotel_nombre: lead?.hotel_nombre ?? "",
    tomador_nombre: lead?.tomador_nombre ?? "",
    tomador_puesto: lead?.tomador_puesto ?? "",
    contacto: lead?.contacto ?? "",
    email: lead?.email ?? "",
    ciudad: lead?.ciudad ?? "",
    origen: lead?.origen ?? "",
    etapa: lead?.etapa ?? "nuevo",
    valor_estimado: lead?.valor_estimado != null ? String(lead.valor_estimado) : "",
    proximo_seguimiento: lead?.proximo_seguimiento ?? "",
    notas: lead?.notas ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.hotel_nombre.trim()) {
      setError("El nombre del hotel es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api<{ lead: Lead }>(
        edit ? `/api/crm/leads/${lead!.id}` : "/api/crm/leads",
        { method: edit ? "PATCH" : "POST", body: JSON.stringify(f) }
      );
      onSaved(res.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-kora-text">{edit ? "Editar lead" : "Nuevo lead"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-kora-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className={label}>Hotel *</label>
            <input
              className={input}
              value={f.hotel_nombre}
              onChange={(e) => set("hotel_nombre", e.target.value)}
              placeholder="Hotel Paraíso Encantado"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Tomador de decisiones</label>
              <input className={input} value={f.tomador_nombre} onChange={(e) => set("tomador_nombre", e.target.value)} placeholder="Nombre" />
            </div>
            <div>
              <label className={label}>Puesto</label>
              <input className={input} value={f.tomador_puesto} onChange={(e) => set("tomador_puesto", e.target.value)} placeholder="Dueño, gerente…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Contacto (tel/WhatsApp)</label>
              <input className={input} value={f.contacto} onChange={(e) => set("contacto", e.target.value)} placeholder="55 1234 5678" />
            </div>
            <div>
              <label className={label}>Correo</label>
              <input className={input} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="correo@hotel.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Ciudad</label>
              <input className={input} value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Xilitla, S.L.P." />
            </div>
            <div>
              <label className={label}>Origen</label>
              <select className={input} value={f.origen} onChange={(e) => set("origen", e.target.value)}>
                <option value="">—</option>
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Etapa</label>
              <select className={input} value={f.etapa} onChange={(e) => set("etapa", e.target.value)}>
                {ETAPAS.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Valor (MXN)</label>
              <input className={input} type="number" min="0" value={f.valor_estimado} onChange={(e) => set("valor_estimado", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={label}>Próximo seguim.</label>
              <input className={input} type="date" value={f.proximo_seguimiento} onChange={(e) => set("proximo_seguimiento", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label}>Notas</label>
            <textarea className={`${input} resize-none`} rows={3} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Contexto, necesidades, objeciones…" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kora-muted hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-kora-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-kora-primary-dark disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : edit ? "Guardar" : "Crear lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
