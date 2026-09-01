"use client";

// Pantalla de error del PANEL del hotelero. Copy accionable: quien la ve está
// trabajando y necesita saber qué hacer ahora, no una disculpa.

import { RefreshCw } from "lucide-react";
import { WHATSAPP } from "@/lib/contacto";

const WA_KORA = WHATSAPP;

export default function ErrorPanel({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[70dvh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-kora-text">
          No pudimos cargar tu panel.
        </h1>
        <p className="text-kora-muted leading-relaxed max-w-sm mx-auto">
          Tus reservas y tus datos están a salvo: esto es un problema al mostrar la
          pantalla, no al guardarlos. Reintenta; si sigue igual, escríbenos.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-primary text-white font-bold text-sm hover:bg-kora-primary-dark transition-colors"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Reintentar
          </button>
          {WA_KORA && (
            <a
              href={`https://wa.me/${WA_KORA.replace(/\D/g, "")}?text=${encodeURIComponent(
                "Hola, mi panel de Kora no carga.",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
