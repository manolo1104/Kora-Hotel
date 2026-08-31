"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, MessageCircle, Users, StickyNote,
  MapPin, Tag, Calendar, DollarSign, Loader2, Plus,
} from "lucide-react";
import {
  ETAPAS, TIPOS_ACTIVIDAD, TIPO_LABEL, type Etapa, type Lead, type Actividad, type TipoActividad,
} from "@/lib/crm/types";
import { api, money, fechaCorta, seguimiento, waLink, hoyISO } from "./util";
import { StageBadge } from "./StageBadge";
import { LeadForm } from "./LeadForm";

const ACT_ICON: Record<TipoActividad, React.ComponentType<{ className?: string }>> = {
  llamada: Phone,
  correo: Mail,
  whatsapp: MessageCircle,
  reunion: Users,
  nota: StickyNote,
};

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-kora-muted">{label}</div>
        <div className="text-sm text-kora-text break-words">{children || "—"}</div>
      </div>
    </div>
  );
}

export function LeadDetail({ initialLead, initialActs }: { initialLead: Lead; initialActs: Actividad[] }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [acts, setActs] = useState(initialActs);
  const [editing, setEditing] = useState(false);

  // form de actividad
  const [tipo, setTipo] = useState<TipoActividad>("llamada");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [savingAct, setSavingAct] = useState(false);

  const wa = waLink(lead.contacto);
  const seg = seguimiento(lead.proximo_seguimiento);

  async function cambiarEtapa(etapa: Etapa) {
    const prev = lead;
    setLead({ ...lead, etapa });
    try {
      await api(`/api/crm/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ etapa }) });
    } catch {
      setLead(prev);
      alert("No se pudo cambiar la etapa.");
    }
  }

  // Sacar a un lead de la secuencia automática. Antes no se podía: la columna
  // existía y el cron la leía, pero nada la escribía. Optimista, con vuelta
  // atrás si el PATCH falla — es un interruptor, no vale la pena un spinner.
  async function alternarSecuencia() {
    const prev = lead;
    const pausada = !lead.secuencia_pausada;
    setLead({ ...lead, secuencia_pausada: pausada });
    try {
      await api(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ secuencia_pausada: pausada }),
      });
    } catch {
      setLead(prev);
      alert("No se pudo cambiar la secuencia de correos.");
    }
  }

  async function eliminarLead() {
    if (!confirm(`¿Eliminar el lead "${lead.hotel_nombre}"? Esto borra también su historial.`)) return;
    try {
      await api(`/api/crm/leads/${lead.id}`, { method: "DELETE" });
      router.push("/crm/leads");
    } catch {
      alert("No se pudo eliminar.");
    }
  }

  async function agregarActividad(e: React.FormEvent) {
    e.preventDefault();
    setSavingAct(true);
    try {
      const res = await api<{ actividad: Actividad }>(`/api/crm/leads/${lead.id}/actividades`, {
        method: "POST",
        body: JSON.stringify({ tipo, nota, fecha }),
      });
      setActs((a) => [res.actividad, ...a]);
      setNota("");
    } catch {
      alert("No se pudo registrar la actividad.");
    } finally {
      setSavingAct(false);
    }
  }

  async function eliminarActividad(id: string) {
    setActs((a) => a.filter((x) => x.id !== id));
    try {
      await api(`/api/crm/actividades/${id}`, { method: "DELETE" });
    } catch {
      /* si falla, recargar */ router.refresh();
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-kora-accent";
  const quick = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors";

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/crm/leads" className="inline-flex items-center gap-1.5 text-sm text-kora-muted hover:text-kora-text mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      {/* Encabezado */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-kora-text">{lead.hotel_nombre}</h1>
            {lead.tomador_nombre && (
              <p className="text-sm text-kora-muted mt-0.5">
                {lead.tomador_nombre}{lead.tomador_puesto ? ` · ${lead.tomador_puesto}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className={`${quick} border border-gray-200 text-kora-muted hover:bg-gray-50`}>
              <Pencil className="h-4 w-4" /> Editar
            </button>
            <button onClick={eliminarLead} className={`${quick} text-red-600 hover:bg-red-50`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Etapa */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <StageBadge etapa={lead.etapa} />
          <select
            value={lead.etapa}
            onChange={(e) => cambiarEtapa(e.target.value as Etapa)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-kora-muted focus:outline-none focus:ring-1 focus:ring-kora-accent"
          >
            {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>

        {/* Contacto rápido */}
        {(wa || lead.email || lead.contacto) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`${quick} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {lead.contacto && (
              <a href={`tel:${lead.contacto.replace(/\s/g, "")}`} className={`${quick} bg-gray-100 text-kora-text hover:bg-gray-200`}>
                <Phone className="h-4 w-4" /> Llamar
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className={`${quick} bg-gray-100 text-kora-text hover:bg-gray-200`}>
                <Mail className="h-4 w-4" /> Correo
              </a>
            )}
          </div>
        )}

        {/* Datos */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-5">
          <Field icon={Phone} label="Contacto">{lead.contacto}</Field>
          <Field icon={Mail} label="Correo">{lead.email}</Field>
          <Field icon={MapPin} label="Ciudad">{lead.ciudad}</Field>
          <Field icon={Tag} label="Origen">{lead.origen}</Field>
          <Field icon={DollarSign} label="Valor estimado">{lead.valor_estimado ? money(lead.valor_estimado) : null}</Field>
          <Field icon={Calendar} label="Próximo seguimiento">
            {seg ? (
              <span className={seg === "vencido" ? "text-red-600 font-medium" : seg === "hoy" ? "text-amber-600 font-medium" : ""}>
                {fechaCorta(lead.proximo_seguimiento)}{seg === "vencido" ? " · vencido" : seg === "hoy" ? " · hoy" : ""}
              </span>
            ) : null}
          </Field>
        </div>
        {/* Correos automáticos. Sólo tiene sentido si hay correo: la secuencia
            no le escribe a quien sólo dejó WhatsApp. */}
        {lead.email && (
          <div className="mt-4 flex items-start gap-2.5 border-t border-gray-100 pt-4">
            <input
              id="secuencia-pausada"
              type="checkbox"
              checked={Boolean(lead.secuencia_pausada)}
              onChange={alternarSecuencia}
              className="mt-0.5 h-4 w-4 accent-kora-primary"
            />
            <label htmlFor="secuencia-pausada" className="text-sm text-kora-text">
              Pausar los correos automáticos
              <span className="block text-xs text-kora-muted">
                Enciéndelo cuando ya hablaste con él: deja de recibir los correos
                de seguimiento del día 3 y del día 7.
              </span>
            </label>
          </div>
        )}

        {lead.notas && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="text-xs text-kora-muted mb-1">Notas</div>
            <p className="text-sm text-kora-text whitespace-pre-wrap">{lead.notas}</p>
          </div>
        )}
      </div>

      {/* Registrar actividad */}
      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="font-bold text-kora-text mb-3">Registrar acción</h2>
        <form onSubmit={agregarActividad} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoActividad)} className={inputCls}>
              {TIPOS_ACTIVIDAD.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="¿Qué pasó? (ej. Llamé, pidió cotización para 12 cuartos)"
            className={`${inputCls} resize-none`}
          />
          <button type="submit" disabled={savingAct} className="inline-flex items-center gap-1.5 rounded-xl bg-kora-primary px-4 py-2 text-sm font-semibold text-white hover:bg-kora-primary-dark disabled:opacity-50">
            {savingAct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar
          </button>
        </form>
      </div>

      {/* Historial */}
      <div className="mt-5">
        <h2 className="font-bold text-kora-text mb-3 px-1">Historial</h2>
        {acts.length === 0 ? (
          <p className="text-sm text-kora-muted px-1">Sin acciones registradas todavía.</p>
        ) : (
          <ol className="space-y-2">
            {acts.map((a) => {
              const Icon = ACT_ICON[a.tipo];
              return (
                <li key={a.id} className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3">
                  <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-kora-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-kora-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-kora-text">{TIPO_LABEL[a.tipo]}</span>
                      <span className="text-xs text-kora-muted">{fechaCorta(a.fecha)}</span>
                    </div>
                    {a.nota && <p className="text-sm text-kora-muted mt-0.5 whitespace-pre-wrap">{a.nota}</p>}
                  </div>
                  <button onClick={() => eliminarActividad(a.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {editing && (
        <LeadForm
          lead={lead}
          onClose={() => setEditing(false)}
          onSaved={(l) => { setLead(l); setEditing(false); }}
        />
      )}
    </main>
  );
}
