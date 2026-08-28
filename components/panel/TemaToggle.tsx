"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Interruptor de tema del panel (claro ↔ oscuro).
//
// El tema vive en el atributo `data-tema` del <html> y se guarda en
// localStorage. Los estilos que reacciona a él están en dos sitios, porque el
// panel usa dos sistemas: app/globals.css (las pantallas con Tailwind) y
// app/panel/[slug]/(operativo)/admin.module.css (el panel operativo, que va con
// variables propias).
//
// Los overrides oscuros están encerrados dentro de `.panel-root`, así que si el
// hotelero deja el modo oscuro prendido y se va a la página pública, la landing
// NO se oscurece.

export const TEMA_KEY = "kora-tema";
export type Tema = "claro" | "oscuro";

// Se aplica también desde el script anti-parpadeo de app/panel/layout.tsx.
// Si cambias el nombre de la clave o del atributo, cámbialo en los dos sitios.
function aplicar(tema: Tema) {
  const root = document.documentElement;
  if (tema === "oscuro") root.setAttribute("data-tema", "oscuro");
  else root.removeAttribute("data-tema");
}

function leerGuardado(): Tema {
  try {
    return localStorage.getItem(TEMA_KEY) === "oscuro" ? "oscuro" : "claro";
  } catch {
    // Safari en privado tira al leer localStorage. El panel no se cae por esto.
    return "claro";
  }
}

/** Lógica del tema, para que la barra lateral pinte su propio botón. */
export function useTema() {
  // Arranca en "claro" para que el HTML del servidor y el del cliente coincidan;
  // el valor real se lee en el efecto. El parpadeo lo evita el script del layout,
  // que ya puso el atributo antes de que React pinte.
  const [tema, setTema] = useState<Tema>("claro");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setTema(leerGuardado());
    setMontado(true);
  }, []);

  function alternar() {
    const siguiente: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setTema(siguiente);
    aplicar(siguiente);
    try {
      localStorage.setItem(TEMA_KEY, siguiente);
    } catch {
      // Sin persistencia el tema dura la sesión. Mejor eso que reventar.
    }
  }

  return { tema, oscuro: tema === "oscuro", montado, alternar };
}

export function TemaToggle({ className = "" }: { className?: string }) {
  const { oscuro, montado, alternar } = useTema();

  return (
    <button
      type="button"
      onClick={alternar}
      // Hasta que monta no sabemos el tema real: sin esto el lector de pantalla
      // anunciaría "activar modo oscuro" aunque ya estuviera oscuro.
      aria-label={
        montado
          ? oscuro
            ? "Cambiar a tema claro"
            : "Cambiar a tema oscuro"
          : "Cambiar el tema"
      }
      aria-pressed={montado ? oscuro : undefined}
      title={oscuro ? "Tema claro" : "Tema oscuro"}
      className={`btn-press inline-flex items-center gap-2 rounded-full border border-panel-border px-3 py-2 text-xs font-semibold text-kora-muted transition-colors hover:text-kora-text ${className}`}
    >
      {oscuro ? (
        <Sun size={15} aria-hidden="true" />
      ) : (
        <Moon size={15} aria-hidden="true" />
      )}
      <span>{oscuro ? "Claro" : "Oscuro"}</span>
    </button>
  );
}
