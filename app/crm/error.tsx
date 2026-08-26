"use client";

// Pantalla de error del CRM interno. Aquí SÍ se enseña el `digest`: esta es la
// consola de Manolo, no la de un cliente, y ese código es lo que permite
// encontrar el error exacto en los logs de Vercel sin adivinar.

import { RefreshCw } from "lucide-react";

export default function ErrorCRM({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-[70dvh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">El CRM no cargó.</h1>
        <p className="text-neutral-500 leading-relaxed">
          Reintenta. Si vuelve a pasar, busca este código en los logs de Vercel:
        </p>
        <code className="block rounded-lg bg-neutral-100 px-3 py-2 text-xs font-mono break-all">
          {error.digest ?? "(sin digest — mira la consola del servidor)"}
        </code>
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
