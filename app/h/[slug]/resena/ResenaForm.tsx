"use client";

import { useState } from "react";
import { Star, ExternalLink, CheckCircle } from "lucide-react";

interface Props {
  slug: string;
  r: string; // id de la reserva
  clienteName: string;
  reviewUrl: string; // link de Google "escribir reseña"
  lang: "es" | "en";
}

const COPY = {
  es: {
    titulo: "¿Cómo estuvo tu estancia?",
    sub: "Tu opinión ayuda a otros viajeros a decidir.",
    placeholder: "Cuéntanos qué fue lo que más te gustó (opcional)…",
    enviar: "Enviar mi reseña",
    enviando: "Enviando…",
    eligeEstrellas: "Elige una calificación",
    graciasTitulo: "¡Gracias por tu reseña!",
    graciasSub: "De verdad la valoramos.",
    googleInvite: "¿Nos ayudas con una reseña en Google también? Toma 30 segundos y llega a muchos más viajeros.",
    googleBtn: "Dejar mi reseña en Google",
    error: "No pudimos guardar tu reseña. Inténtalo de nuevo.",
  },
  en: {
    titulo: "How was your stay?",
    sub: "Your feedback helps other travelers decide.",
    placeholder: "Tell us what you liked most (optional)…",
    enviar: "Send my review",
    enviando: "Sending…",
    eligeEstrellas: "Pick a rating",
    graciasTitulo: "Thanks for your review!",
    graciasSub: "We truly appreciate it.",
    googleInvite: "Would you also leave a review on Google? It takes 30 seconds and reaches many more travelers.",
    googleBtn: "Leave my review on Google",
    error: "We couldn't save your review. Please try again.",
  },
};

export function ResenaForm({ slug, r, clienteName, reviewUrl, lang }: Props) {
  const c = COPY[lang];
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  async function enviar() {
    if (estrellas < 1 || enviando) return;
    setEnviando(true);
    setError(false);
    try {
      const res = await fetch(`/api/h/${slug}/resena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ r, estrellas, texto }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setDone(true);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setEnviando(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--brand) 14%, white)" }}
        >
          <CheckCircle size={36} style={{ color: "var(--brand)" }} />
        </div>
        <h1 className="text-xl font-bold" style={{ color: "var(--brand)" }}>
          {c.graciasTitulo}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{c.graciasSub}</p>

        {/* La invitación a Google la ve TODO el mundo (honesto, cumple Google). */}
        <p className="mt-6 text-sm leading-relaxed text-gray-700">{c.googleInvite}</p>
        <a
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand)" }}
        >
          <Star size={16} fill="currentColor" />
          {c.googleBtn}
          <ExternalLink size={15} />
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-xl font-bold" style={{ color: "var(--brand)" }}>
        {clienteName ? `${clienteName}, ${c.titulo.charAt(0).toLowerCase()}${c.titulo.slice(1)}` : c.titulo}
      </h1>
      <p className="mt-1 text-sm text-gray-500">{c.sub}</p>

      <div
        className="mt-6 flex items-center justify-center gap-1.5"
        role="radiogroup"
        aria-label={c.eligeEstrellas}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const activa = (hover || estrellas) >= n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={estrellas === n}
              aria-label={`${n}`}
              onClick={() => setEstrellas(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                size={40}
                style={{ color: activa ? "#f5a623" : "#d1d5db" }}
                fill={activa ? "#f5a623" : "none"}
              />
            </button>
          );
        })}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={c.placeholder}
        rows={4}
        maxLength={1500}
        className="mt-6 w-full resize-none rounded-2xl border border-gray-200 p-3 text-sm text-gray-800 outline-none focus:border-[var(--brand)]"
      />

      {error && <p className="mt-3 text-sm text-red-600">{c.error}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={estrellas < 1 || enviando}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "var(--brand)" }}
      >
        {enviando ? c.enviando : c.enviar}
      </button>
    </div>
  );
}
