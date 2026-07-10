"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { trackBeginCheckout } from "@/lib/analytics";
import { PRECIO_DESDE } from "@/lib/oferta";

// Punto único de entrada al pago: /pago/iniciar?plan=kora
// - Sin sesión → manda a /entrar conservando el plan (y regresa aquí al entrar).
// - Con sesión → crea el Checkout de Stripe y redirige.
function Iniciar() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan") ?? "";
  const [error, setError] = useState("");

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
          body: JSON.stringify({ plan }),
        });
        const data = await res.json().catch(() => ({}));
        if (!activo) return;
        if (res.status === 401) {
          router.replace(`/entrar?plan=${encodeURIComponent(plan)}`);
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
    };
  }, [plan, router]);

  return (
    <div className="max-w-md mx-auto px-4 text-center">
      {error ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <p className="text-kora-text font-semibold">{error}</p>
          <p className="mt-3 text-sm text-kora-muted leading-relaxed">
            También puedes apartar tu lugar directo con nosotros.
          </p>
          <Link
            href="/#contacto"
            className="btn-press mt-5 inline-flex items-center justify-center px-6 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Contactar a Kora
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-kora-muted">
          <Loader2 size={28} className="animate-spin text-kora-primary" />
          <p className="text-sm">Preparando tu pago seguro…</p>
        </div>
      )}
    </div>
  );
}

export default function PagoIniciarPage() {
  return (
    <main className="pt-16">
      <section className="py-24 sm:py-32 bg-kora-bg min-h-[70vh] flex items-center justify-center">
        <Suspense fallback={null}>
          <Iniciar />
        </Suspense>
      </section>
    </main>
  );
}
