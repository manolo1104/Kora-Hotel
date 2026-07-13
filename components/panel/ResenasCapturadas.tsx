"use client";

import { useEffect, useState } from "react";
import { Star, ShieldCheck, MessageSquare, Eye, EyeOff } from "lucide-react";

interface Resena {
  id: string;
  cliente: string;
  estrellas: number;
  texto: string;
  respuesta: string | null;
  publicada: boolean;
  fecha: string;
  confirmacion: string | null;
}

function Estrellas({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          style={{ color: i <= n ? "#f5a623" : "#d1d5db" }}
          fill={i <= n ? "#f5a623" : "none"}
        />
      ))}
    </span>
  );
}

// Reseñas VERIFICADAS (tabla reviews) — las que dejan los huéspedes reales desde
// el correo del día 7. Se gestionan por API (no viven en extras): responder y
// ocultar. Autónomo: se fetchea solo al montar.
export function ResenasCapturadas() {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/reviews");
        const data = await res.json().catch(() => ({ resenas: [] }));
        if (vivo) setResenas(Array.isArray(data.resenas) ? data.resenas : []);
      } catch {
        // silencioso: la tabla puede no existir aún (fail-safe)
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function accion(id: string, body: Record<string, unknown>) {
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRespuesta(id: string) {
    const ok = await accion(id, { action: "responder", respuesta: borrador });
    if (ok) {
      setResenas((rs) => rs.map((r) => (r.id === id ? { ...r, respuesta: borrador.trim() || null } : r)));
      setRespondiendo(null);
      setBorrador("");
    }
  }

  async function togglePublicada(r: Resena) {
    const ok = await accion(r.id, { action: "ocultar", publicada: !r.publicada });
    if (ok) setResenas((rs) => rs.map((x) => (x.id === r.id ? { ...x, publicada: !x.publicada } : x)));
  }

  if (cargando) {
    return <p className="text-sm text-kora-muted">Cargando reseñas verificadas…</p>;
  }

  const promedio =
    resenas.length > 0
      ? (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1)
      : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-base font-bold text-kora-text inline-flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-600" />
          Reseñas verificadas
        </h3>
        {promedio && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-text">
            <Estrellas n={Math.round(Number(promedio))} />
            {promedio} · {resenas.length}
          </span>
        )}
      </div>
      <p className="text-xs text-kora-muted mb-4">
        Las dejan tus huéspedes reales desde el correo posterior a su estancia. Solo estas cuentan como
        reseñas verificadas en tu página.
      </p>

      {resenas.length === 0 ? (
        <p className="rounded-xl bg-gray-50 p-4 text-sm text-kora-muted">
          Aún no hay reseñas verificadas. Se irán llenando conforme tus huéspedes respondan el correo del
          día 7. (Si acabas de activarlas, corre <code>sql/kora-reviews.sql</code> en Supabase.)
        </p>
      ) : (
        <div className="space-y-3">
          {resenas.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 ${
                r.publicada ? "border-gray-100 bg-white" : "border-gray-200 bg-gray-50 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Estrellas n={r.estrellas} />
                  <p className="mt-1.5 text-sm text-kora-text leading-relaxed">
                    {r.texto ? `“${r.texto}”` : <span className="italic text-kora-muted">Sin comentario</span>}
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-kora-muted">
                    — {r.cliente}
                    {r.fecha ? ` · ${r.fecha}` : ""}
                    {r.confirmacion ? ` · ${r.confirmacion}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePublicada(r)}
                  disabled={guardando}
                  title={r.publicada ? "Ocultar de tu página" : "Mostrar en tu página"}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-kora-muted hover:bg-gray-50"
                >
                  {r.publicada ? <Eye size={13} /> : <EyeOff size={13} />}
                  {r.publicada ? "Visible" : "Oculta"}
                </button>
              </div>

              {r.respuesta && respondiendo !== r.id && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] font-semibold text-kora-muted">Tu respuesta</p>
                  <p className="mt-1 text-sm text-kora-text leading-relaxed">{r.respuesta}</p>
                </div>
              )}

              {respondiendo === r.id ? (
                <div className="mt-3">
                  <textarea
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    rows={3}
                    maxLength={1500}
                    placeholder="Responde con amabilidad — se muestra debajo de la reseña en tu página."
                    className="w-full resize-none rounded-xl border border-gray-200 p-2.5 text-sm text-kora-text outline-none focus:border-kora-primary"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => guardarRespuesta(r.id)}
                      disabled={guardando}
                      className="rounded-full bg-kora-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Guardar respuesta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRespondiendo(null);
                        setBorrador("");
                      }}
                      className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-kora-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRespondiendo(r.id);
                    setBorrador(r.respuesta ?? "");
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary hover:underline"
                >
                  <MessageSquare size={13} />
                  {r.respuesta ? "Editar respuesta" : "Responder"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
