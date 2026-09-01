import Link from "next/link";
import { Clock, Lock, ArrowRight, Database } from "lucide-react";
import type { PruebaHotel } from "@/lib/suscripcion";
import { EMAIL_CONTACTO } from "@/lib/contacto";

// Estado de la prueba de 30 días en el panel operativo (server components).
// - Banner: cuenta regresiva discreta pero visible, con CTA a activar el plan.
// - Pantalla vencida: firme pero honesta — los datos están a salvo, nada se borra.

export function PruebaBanner({ prueba }: { prueba: PruebaHotel }) {
  const urgente = prueba.diasRestantes <= 5;
  return (
    <div
      className={`flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 text-sm ${
        urgente ? "bg-amber-50 border-b border-amber-200" : "bg-kora-bg border-b border-panel-border-soft"
      }`}
    >
      <p className={`flex items-center gap-2 ${urgente ? "text-amber-900" : "text-kora-text"}`}>
        <Clock size={15} className={urgente ? "text-amber-600" : "text-kora-primary"} aria-hidden="true" />
        <span>
          <strong>
            {prueba.diasRestantes === 1
              ? "Último día de tu prueba gratis"
              : `Te quedan ${prueba.diasRestantes} días de prueba gratis`}
          </strong>{" "}
          — todo lo que configures se queda contigo.
        </span>
      </p>
      <Link
        href="/pago/iniciar?plan=kora"
        className="btn-press inline-flex items-center gap-1.5 rounded-full bg-kora-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-kora-primary-dark transition-colors"
      >
        Activar mi plan — $550/mes
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function PruebaVencida({ hotelNombre }: { hotelNombre: string }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full rounded-3xl border border-panel-border-soft bg-panel-surface p-8 sm:p-10 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100" aria-hidden="true">
          <Lock size={26} className="text-amber-600" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-kora-text">
          Tu prueba gratis terminó
        </h1>
        <p className="mt-3 text-sm text-kora-muted leading-relaxed">
          El panel de <span className="font-semibold text-kora-text">{hotelNombre}</span>{" "}
          está en pausa y tu motor de reservas dejó de recibir pagos. Activa tu
          plan y todo vuelve a funcionar al instante, exactamente como lo dejaste.
        </p>
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-kora-bg px-4 py-3 text-left">
          <Database size={15} className="mt-0.5 flex-shrink-0 text-kora-primary" aria-hidden="true" />
          <p className="text-xs text-kora-muted leading-relaxed">
            <span className="font-semibold text-kora-text">Tus datos están a salvo:</span>{" "}
            reservas, huéspedes, fotos y configuración se conservan íntegros — no
            borramos nada. Y siguen siendo tuyos: puedes descargarlos en Excel
            desde tu panel cuando quieras, también hoy.
          </p>
        </div>
        <Link
          href="/pago/iniciar?plan=kora"
          className="btn-press btn-fill mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-kora-accent px-7 py-3.5 text-sm font-bold text-kora-primary hover:bg-kora-accent-dark transition-colors"
        >
          Activar mi plan — $550 MXN/mes
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <p className="mt-3 text-[11px] text-kora-muted">
          Mes a mes, sin permanencia · cancelas tú mismo en un clic
        </p>
      </div>
    </div>
  );
}

/**
 * Cuenta BLOQUEADA por Kora (no es la prueba ni el plan: es una decisión
 * manual). Sustituye al panel entero: no hay nada que tocar aquí, solo el
 * mensaje y a quién escribirle. El texto lo pone Kora al bloquear.
 */
export function HotelBloqueado({
  hotelNombre,
  mensaje,
}: {
  hotelNombre: string;
  mensaje: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-red-200 bg-panel-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <Lock size={26} className="text-red-600" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-kora-text">
          Tu cuenta está bloqueada
        </h1>
        <p className="mt-1.5 text-sm text-kora-muted">{hotelNombre}</p>

        <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">
            Mensaje de Kora
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-red-900">
            {mensaje}
          </p>
        </div>

        <p className="mt-6 flex items-start justify-center gap-2 text-left text-xs leading-relaxed text-kora-muted">
          <Database size={13} className="mt-0.5 flex-shrink-0 text-kora-primary" aria-hidden="true" />
          <span>
            Tus datos siguen completos: reservas, huéspedes, fotos y
            configuración están tal como los dejaste. Nada se borró.
          </span>
        </p>

        <p className="mt-5 text-xs leading-relaxed text-kora-muted">
          Mientras el bloqueo siga, tu página de reservas y tu bot de WhatsApp
          están apagados. Para resolverlo, escribe a{" "}
          <a
            href={`mailto:${EMAIL_CONTACTO}`}
            className="font-semibold text-kora-primary hover:underline"
          >
            {EMAIL_CONTACTO}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
