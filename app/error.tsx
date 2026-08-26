"use client";

// Pantalla de error del sitio PÚBLICO de Kora. Sin esto, cuando algo lanza en un
// Server Component el visitante ve la pantalla cruda de Next — en producción, una
// página en blanco con un código de diagnóstico y nada más.
//
// No es cosmética: es lo que hace aceptable que las lecturas de `lib/db/result.ts`
// ahora LANCEN en vez de devolver datos vacíos. Sin esta pantalla, "fallar
// ruidoso" significa "página en blanco".
//
// Regla que respetan las cuatro pantallas públicas: NUNCA se pinta
// `error.message`. Next lo redacta en producción, pero en desarrollo filtraría
// nombres de tabla y de ruta, y esa costumbre acaba copiándose.

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="pt-16">
      <section className="min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-16 bg-kora-bg">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
            Algo se rompió de nuestro lado.
          </h1>
          <p className="text-kora-muted leading-relaxed max-w-xs mx-auto">
            No es tu conexión. Vuelve a intentarlo en un momento; si sigue igual,
            escríbenos y lo revisamos.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-primary text-white font-bold text-sm hover:bg-kora-primary-dark transition-colors"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Reintentar
            </button>
            <Link
              href="/"
              className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
            >
              Volver al inicio
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
