"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CreditCard, Sparkles } from "lucide-react";
import { postJson, mensajeDeError } from "@/lib/ui/api";

const WA_KORA = process.env.NEXT_PUBLIC_WHATSAPP_KORA || "";

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
  sinHoteles = false,
}: {
  plan: string | null;
  estado: string | null;
  esStripe: boolean;
  /** El usuario todavia no tiene ningun hotel: su siguiente paso es crearlo,
   *  NO pagar. Sin esto la barra ofrece "Activar mi plan" con el mismo amarillo
   *  que "Crear mi hotel" y arriba de el, y la gente pica el de pagar: se topa
   *  con la tarjeta de Stripe y cree que Kora la exige para entrar. */
  sinHoteles?: boolean;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");
  const [atascado, setAtascado] = useState(false);

  async function abrirPortal() {
    setAbriendo(true);
    setError("");
    setAtascado(false);
    try {
      const data = await postJson<{ url?: string }>("/api/stripe/portal");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No pudimos abrir el portal de pagos.");
      setAtascado(true);
    } catch (e) {
      // El portal de Stripe es la ÚNICA salida que tiene un cliente para cambiar
      // su tarjeta o cancelar. Si no abre —un stripe_customer_id que ya no
      // existe, por ejemplo— quedaba encerrado con un mensaje genérico y sin a
      // dónde ir. Se le enseña el motivo real y una salida humana.
      setError(mensajeDeError(e));
      setAtascado(true);
    } finally {
      setAbriendo(false);
    }
  }

  const info = estado ? ESTADOS[estado] : null;
  // "Cerrada" = tuvo plan y ya no lo tiene (canceló) o nunca llegó a completarlo.
  const cerrada = estado === "cancelada" || estado === "incompleta";

  // Invitación a los planes SOLO para quien nunca llegó a Stripe.
  //
  // Antes caía aquí también quien había CANCELADO, y pasaban dos cosas malas: se
  // le hablaba de "prueba gratis, 30 días sin tarjeta" —que ya no es cierto y que
  // suena a burla cuando acabas de darte de baja— y, sobre todo, se le quitaba el
  // botón del portal de Stripe, que es su única vía para bajar sus recibos.
  if (!info || (cerrada && !esStripe)) {
    return (
      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-kora-primary/15 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-kora-primary" aria-hidden="true" />
          <p className="text-sm text-kora-text">
            <span className="font-bold">Prueba gratis.</span>{" "}
            <span className="text-kora-muted">
              {sinHoteles
                ? "Tus 30 días empiezan cuando crees tu hotel, aquí abajo. No te pedimos tarjeta para empezar: el plan ($550/mes) lo activas después, desde esta misma barra."
                : "Cada hotel nuevo incluye 30 días completos sin tarjeta; al vencer, su motor se pausa hasta que actives tu plan ($550/mes)."}
            </span>
          </p>
        </div>
        {/* Sin hoteles no ofrecemos pagar: sería el único botón de la pantalla
            compitiendo con "Crear mi hotel" y ganándole por estar arriba. */}
        {!sinHoteles && (
          <Link
            href="/pago/iniciar?plan=kora"
            className="btn-press inline-flex items-center px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Activar mi plan
          </Link>
        )}
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
        {cerrada && (
          <p className="text-xs text-kora-muted">
            {estado === "cancelada"
              ? "Tus recibos siguen disponibles y puedes reactivarlo cuando quieras."
              : "Tu pago quedó a medias. Puedes retomarlo cuando quieras."}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600">
            {error}
            {atascado && WA_KORA && (
              <>
                {" "}
                <a
                  href={`https://wa.me/${WA_KORA.replace(/\D/g, "")}?text=${encodeURIComponent(
                    "Hola, no puedo abrir el portal de pagos de Kora.",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Escríbenos por WhatsApp
                </a>{" "}
                y lo resolvemos.
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
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
            {cerrada ? "Mis recibos" : "Administrar mi pago"}
          </button>
        )}
        {/* Reactivar: el portal de Stripe no revive una suscripción ya cancelada,
            así que la única vía de vuelta es un checkout nuevo. Sin este botón,
            quien canceló no tenía forma de volver desde su panel. */}
        {cerrada && (
          <Link
            href="/pago/iniciar?plan=kora"
            className="btn-press inline-flex items-center px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Activar mi plan
          </Link>
        )}
        {/* La promesa del sitio ("cancela en un clic") debe verse aquí, no
            escondida: mismo portal, sin llamadas ni correos. No se ofrece a quien
            ya canceló: no hay nada que cancelar. */}
        {esStripe && !cerrada && (
          <button
            type="button"
            onClick={abrirPortal}
            disabled={abriendo}
            className="text-xs font-semibold text-kora-muted underline underline-offset-2 hover:text-kora-text transition-colors disabled:opacity-60"
          >
            Cancelar suscripción
          </button>
        )}
      </div>
    </div>
  );
}
