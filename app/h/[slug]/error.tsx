"use client";

// Pantalla de error del sitio público del HOTEL. Copy NEUTRAL, sin marca Kora: el
// visitante cree estar en el sitio del hotel, y una pantalla de otra empresa a
// mitad de una compra rompe esa ilusión justo en el peor momento.
//
// Importa sobre todo para `/h/[slug]/reservar`: si el motor truena, el huésped
// tiene que ver esto y no una página en blanco con su tarjeta en la mano.

import { RefreshCw } from "lucide-react";

export default function ErrorHotel({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[70dvh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">No pudimos cargar esta página.</h1>
        <p className="text-neutral-500 leading-relaxed max-w-xs mx-auto">
          Vuelve a intentarlo en un momento. Tus datos no se perdieron.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-neutral-900 text-white font-semibold text-sm hover:bg-neutral-700 transition-colors"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Reintentar
        </button>
      </div>
    </main>
  );
}
