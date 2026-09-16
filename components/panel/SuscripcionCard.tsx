"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CreditCard, Sparkles } from "lucide-react";
import { postJson, mensajeDeError } from "@/lib/ui/api";
import { WHATSAPP } from "@/lib/contacto";
import { GARANTIA, PRECIO_DESDE, RUTA_ACTIVAR } from "@/lib/oferta";

const WA_KORA = WHATSAPP;

// Cifras de la oferta: salen de lib/oferta.ts, nunca escritas aquí. Es un
// componente de CLIENTE, así que los días vienen de `GARANTIA.diasPrueba` y no
// de `PRUEBA_DIAS` (lib/suscripcion usa la service-role); una prueba vigila que
// las dos digan lo mismo (tests/prueba-14-dias.test.ts).
const PRECIO = `$${PRECIO_DESDE.toLocaleString("es-MX")}/mes`;

// Tarjeta de suscripción en el panel: muestra el plan/estado y abre el
// Customer Portal de Stripe (cambiar tarjeta, recibos, cancelar) sin
// intervención de Kora.

const ESTADOS: Record<string, { label: string; cls: string }> = {
  activa: { label: "Activa", cls: "bg-emerald-100 text-emerald-800" },
  cortesia: { label: "Fundador", cls: "bg-kora-accent/30 text-kora-primary" },
  pago_vencido: { label: "Pago pendiente", cls: "bg-amber-100 text-amber-800" },
  cancelada: { label: "Cancelada", cls: "bg-panel-surface-2 text-kora-muted" },
  incompleta: { label: "Sin completar", cls: "bg-panel-surface-2 text-kora-muted" },
};

export function SuscripcionCard({
  plan,
  estado,
  esStripe,
  sinHoteles = false,
  prueba = null,
}: {
  plan: string | null;
  estado: string | null;
  esStripe: boolean;
  /** El usuario todavia no tiene ningun hotel: su siguiente paso es crearlo,
   *  NO pagar. Sin esto la barra ofrece "Activar mi plan" con el mismo amarillo
   *  que "Crear mi hotel" y arriba de el, y la gente pica el de pagar: se topa
   *  con la tarjeta de Stripe y cree que Kora la exige para entrar. */
  sinHoteles?: boolean;
  /**
   * La prueba de ESTE DUEÑO, ya calculada en el servidor (`pruebaDelHotel` con el
   * ancla del dueño). null = no está en prueba o no se pudo saber: entonces no
   * se dan días. El hub no decía cuántos le quedaban, y el texto de siempre
   * («cada hotel nuevo incluye N días») era falso dos veces: la prueba es por
   * dueño —recrear el hotel no la reinicia— y quien entró antes del 6 sep tiene
   * más días que la prueba de hoy.
   */
  prueba?: { diasRestantes: number; vencida: boolean } | null;
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
      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-kora-primary/15 bg-panel-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-kora-primary" aria-hidden="true" />
          <p className="text-sm text-kora-text">
            <span className="font-bold">
              {prueba?.vencida
                ? "Prueba gratis terminada."
                : prueba
                  ? `Prueba gratis: ${
                      prueba.diasRestantes === 1 ? "hoy es tu último día." : `te quedan ${prueba.diasRestantes} días.`
                    }`
                  : "Prueba gratis."}
            </span>{" "}
            <span className="text-kora-muted">{textoPrueba(sinHoteles, prueba)}</span>
          </p>
        </div>
        {/* Sin hoteles no ofrecemos pagar: sería el único botón de la pantalla
            compitiendo con "Crear mi hotel" y ganándole por estar arriba. */}
        {!sinHoteles && (
          <Link
            href={RUTA_ACTIVAR}
            className="btn-press inline-flex items-center px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Activar mi plan
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-kora-primary/15 bg-panel-surface px-5 py-4">
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
            {/* Quien pulsó «Activar mi plan» durante su prueba y no terminó el
                pago queda en «incompleta» CON cliente de Stripe, y cae aquí y no
                en la barra de la prueba: el hub le escondía justo los días que
                le quedaban, aunque su motor sigue abierto por la prueba. */}
            {prueba && !prueba.vencida &&
              (prueba.diasRestantes === 1
                ? " Hoy es el último día de tu prueba gratis."
                : ` Te quedan ${prueba.diasRestantes} días de tu prueba gratis.`)}
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
            className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-panel-border text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors disabled:opacity-60"
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
            href={RUTA_ACTIVAR}
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

/** El texto de la barra para quien no tiene plan. Ninguna cifra a mano. */
function textoPrueba(
  sinHoteles: boolean,
  prueba: { diasRestantes: number; vencida: boolean } | null,
): string {
  if (prueba?.vencida) {
    return `Tu motor está en pausa hasta que actives tu plan (${PRECIO}). Tus datos siguen intactos.`;
  }
  if (prueba) {
    return sinHoteles
      ? "Tu prueba empezó con tu primer hotel y no se reinicia al crear otro. No te pedimos tarjeta: el plan lo activas cuando quieras."
      : `Es una sola prueba por cuenta y sin tarjeta; al terminar, tu motor se pausa hasta que actives tu plan (${PRECIO}).`;
  }
  return sinHoteles
    ? `Tus ${GARANTIA.diasPrueba} días empiezan cuando crees tu primer hotel, aquí abajo. No te pedimos tarjeta para empezar: el plan (${PRECIO}) lo activas después, desde esta misma barra.`
    : `Es una sola prueba por cuenta y sin tarjeta, aunque tengas más de un hotel; al terminar, el motor se pausa hasta que actives tu plan (${PRECIO}).`;
}
