"use client";

// La MISMA pantalla que `app/h/[slug]/error.tsx`, un nivel más arriba. No es
// duplicación por descuido: en Next, un `error.tsx` NO captura lo que lanza el
// layout de su propio segmento, y `app/h/[slug]/layout.tsx` llama a
// `resolveHotel` — que desde la Etapa 4 lanza cuando la base falla.
//
// Se comprobó midiendo: con la llave de Supabase rota, `/h/hotel` respondía 500
// con el cuerpo del 404 de Kora ("Esta habitación no existe"), que le miente al
// visitante y encima no se parece al sitio del hotel. Con este archivo, ese
// mismo caso cae aquí.

import { RefreshCw } from "lucide-react";

export default function ErrorSeccionHotel({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
