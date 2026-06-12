"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CreditCard, Sparkles } from "lucide-react";

// Tarjeta de suscripción en el panel: muestra el plan/estado y abre el
// Customer Portal de Stripe (cambiar tarjeta, recibos, cancelar) sin
// intervención de Kora.

const ESTADOS: Record<string, { label: string; cls: string }> = {
  activa: { label: "Activa", cls: "bg-emerald-100 text-emerald-800" },
  cortesia: { label: "Fundador", cls: "bg-kora-accent/30 text-kora-primary" },
  pago_vencido: { label: "Pago pendiente", cls: "bg-amber-100 text-amber-800" },
  cancelada: { label: "Cancelada", cls: "bg-gray-100 text-gray-600" },
  incompleta: { label: "Sin completar", cls: "bg-gray-100 text-gray-600" },
};

export function SuscripcionCard({
  plan,
  estado,
  esStripe,
}: {
  plan: string | null;
  estado: string | null;
  esStripe: boolean;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");

  async function abrirPortal() {
    setAbriendo(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) window.location.href = data.url;
      else setError(data.error || "No pudimos abrir el portal de pagos.");
    } catch {
      setError("No pudimos abrir el portal de pagos.");
    } finally {
      setAbriendo(false);
    }
  }

  const info = estado ? ESTADOS[estado] : null;

  // Sin suscripción: invitación discreta a los planes.
  if (!info || estado === "cancelada" || estado === "incompleta") {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-kora-primary/15 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-kora-primary" aria-hidden="true" />
          <p className="text-sm text-kora-text">
            <span className="font-bold">Página gratis.</span>{" "}
            <span className="text-kora-muted">
              Con Kora Pro tu hotel se opera solo: reservas, WhatsApp con IA y más.
            </span>
          </p>
        </div>
        <Link
          href="/precios"
          className="btn-press inline-flex items-center px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
        >
          Ver planes
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-kora-primary/15 bg-white px-5 py-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${info.cls}`}>
          {info.label}
        </span>
        <p className="text-sm font-semibold text-kora-text">
          Plan {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Kora"}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      {esStripe && (
        <button
          type="button"
          onClick={abrirPortal}
          disabled={abriendo}
          className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors disabled:opacity-60"
        >
          {abriendo ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <CreditCard size={14} aria-hidden="true" />
          )}
          Administrar mi pago
        </button>
      )}
    </div>
  );
}
