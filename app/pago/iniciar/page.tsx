"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { trackBeginCheckout } from "@/lib/analytics";
import { PRECIO_DESDE } from "@/lib/oferta";

// Llave PÚBLICA de Stripe (pk_...): habilita el pago embebido dentro del
// sitio. Si falta, el flujo cae al Checkout hospedado de Stripe (redirect).
const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

// Punto único de entrada al pago: /pago/iniciar?plan=kora
// - Sin sesión → manda a /entrar conservando el plan (y regresa aquí al entrar).
// - Con sesión → monta el pago EMBEBIDO (sin salir de Kora) o, sin llave
//   pública, redirige al Checkout hospedado.
function Iniciar() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan") ?? "";
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const checkoutRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    if (!plan) {
      router.replace("/precios");
      return;
    }
    // Todo intento de pago pasa por aquí: el punto único para medir el embudo.
    trackBeginCheckout(plan, PRECIO_DESDE);
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, embedded: Boolean(PK) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!activo) return;
        if (res.status === 401) {
          router.replace(`/entrar?plan=${encodeURIComponent(plan)}`);
          return;
        }
        if (res.ok && data.clientSecret && PK) {
          const stripe = await loadStripe(PK);
          if (!stripe) {
            if (activo) setError("No pudimos cargar el pago seguro. Recarga la página.");
            return;
          }
          const checkout = await stripe.createEmbeddedCheckoutPage({
            clientSecret: data.clientSecret,
          });
          if (!activo) {
            // El usuario salió antes de que Stripe terminara de cargar.
            checkout.destroy();
            return;
          }
          checkoutRef.current = checkout;
          checkout.mount("#stripe-checkout");
          setListo(true);
        } else if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error || "No pudimos iniciar el pago.");
        }
      } catch {
        if (activo) setError("No pudimos iniciar el pago. Revisa tu conexión.");
      }
    })();
    return () => {
      activo = false;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [plan, router]);

  return (
    <div className="max-w-3xl mx-auto px-4 w-full">
      {error ? (
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-kora-text font-semibold">{error}</p>
          <p className="mt-3 text-sm text-kora-muted leading-relaxed">
            También puedes escribirnos y te ayudamos a activar tu prueba.
          </p>
          <Link
            href="/#contacto"
            className="btn-press mt-5 inline-flex items-center justify-center px-6 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Contactar a Kora
          </Link>
          <div className="mt-4">
            <Link
              href="/precios"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Volver a precios
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Encabezado: salida clara (sin cargo) + señal de seguridad */}
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <Link
              href="/precios"
              className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Volver — no se hace ningún cargo
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-kora-muted">
              <Lock size={12} className="text-kora-primary" aria-hidden="true" />
              Pago seguro con Stripe, sin salir de Kora
            </span>
          </div>

          {!listo && (
            <div className="flex flex-col items-center gap-3 text-kora-muted py-16">
              <Loader2 size={28} className="animate-spin text-kora-primary" />
              <p className="text-sm">Preparando tu pago seguro…</p>
            </div>
          )}

          {/* Aquí monta Stripe su formulario embebido */}
          <div id="stripe-checkout" className="rounded-2xl overflow-hidden" />

          {listo && (
            <p className="mt-4 text-center text-xs text-kora-muted">
              Hoy no se cobra nada: tu prueba dura 30 días y puedes cancelar
              antes del primer cargo, tú mismo, desde tu panel.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function PagoIniciarPage() {
  return (
    <main className="pt-16">
      <section className="py-12 sm:py-16 bg-kora-bg min-h-[80vh] flex items-start justify-center">
        <Suspense fallback={null}>
          <Iniciar />
        </Suspense>
      </section>
    </main>
  );
}
