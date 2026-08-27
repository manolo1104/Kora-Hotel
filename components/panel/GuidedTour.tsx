"use client";

// Tour guiado del panel: resalta elementos del menú (por [data-tour="..."]) con
// un spotlight y una tarjeta que explica para qué sirve cada sección. Arranca
// solo la primera vez (extras.onboarding.tourVisto !== true) y se puede relanzar
// disparando el evento window "kora:iniciar-tour". Sin dependencias externas.

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";

interface PasoTour {
  key: string; // data-tour del elemento a resaltar
  titulo: string;
  texto: string;
}

const PASOS: PasoTour[] = [
  {
    key: "nav-insights",
    titulo: "Tu panel de control",
    texto: "Aquí ves de un vistazo tu ocupación, ingresos y próximas reservas.",
  },
  {
    key: "nav-sitio",
    titulo: "Edita tu sitio y motor",
    texto:
      "Configura tus habitaciones (camas, fotos, precios), amenidades, extras y experiencias. Es lo que ven tus huéspedes al reservar.",
  },
  {
    key: "nav-camila",
    titulo: "Camila, tu bot de WhatsApp",
    texto:
      "Entrénala con la personalidad de tu hotel y conéctala escaneando un QR. Contesta, cotiza y cierra reservas 24/7.",
  },
  {
    key: "nav-calendario",
    titulo: "Tu calendario",
    texto: "Revisa la disponibilidad y bloquea fechas cuando lo necesites.",
  },
  {
    key: "nav-reservas",
    titulo: "Tus reservas",
    texto: "Todas las reservas que entran por tu motor y por Camila, en un solo lugar.",
  },
  {
    key: "nav-pagos",
    titulo: "Conecta tus cobros",
    texto: "Vincula tu cuenta para recibir el dinero de las reservas directo, sin comisiones de OTAs.",
  },
  // El paso de "Canales (OTAs)" se quitó con la pestaña: un tour que señala un
  // botón que no está deja al hotelero buscándolo. Vuelve si vuelve la pestaña
  // (CANALES_OTA_DISPONIBLES en lib/panel/canales-ota.ts).
  {
    key: "nav-motor",
    titulo: "Ve tu motor en vivo",
    texto: "Abre tu página de reservas tal como la ve un huésped. ¡Ya estás listo para empezar!",
  },
];

export default function GuidedTour({ initialVisto }: { initialVisto: boolean }) {
  const [activo, setActivo] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Arranque automático la primera vez.
  useEffect(() => {
    if (initialVisto) return;
    const t = setTimeout(() => setActivo(true), 700);
    return () => clearTimeout(t);
  }, [initialVisto]);

  // Relanzar desde "Ver el tour otra vez".
  useEffect(() => {
    const start = () => {
      setIdx(0);
      setActivo(true);
    };
    window.addEventListener("kora:iniciar-tour", start);
    return () => window.removeEventListener("kora:iniciar-tour", start);
  }, []);

  const medir = useCallback(() => {
    if (!activo) return;
    const key = PASOS[idx]?.key;
    const el = key ? document.querySelector<HTMLElement>(`[data-tour="${key}"]`) : null;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      setRect(r.width > 0 && r.height > 0 ? r : null);
    } else {
      setRect(null);
    }
  }, [activo, idx]);

  useLayoutEffect(() => {
    medir();
  }, [medir]);

  useEffect(() => {
    if (!activo) return;
    const onMove = () => medir();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [activo, medir]);

  const cerrar = useCallback(async (marcar: boolean) => {
    setActivo(false);
    if (marcar) {
      try {
        await fetch("/api/panel/tour-visto", { method: "POST" });
      } catch {
        /* best-effort: si no guarda, a lo sumo se vuelve a mostrar */
      }
    }
  }, []);

  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void cerrar(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activo, cerrar]);

  if (!activo) return null;
  const paso = PASOS[idx];
  if (!paso) return null;
  const ultimo = idx === PASOS.length - 1;

  // Posición de la tarjeta: a la derecha del elemento en escritorio; centrada
  // abajo en móvil o si no encontramos el elemento.
  const anchoVentana = typeof window !== "undefined" ? window.innerWidth : 1024;
  const altoVentana = typeof window !== "undefined" ? window.innerHeight : 768;
  const desktop = anchoVentana >= 900;
  const cardStyle: React.CSSProperties =
    rect && desktop
      ? {
          position: "fixed",
          left: Math.min(rect.right + 16, anchoVentana - 340),
          top: Math.max(16, Math.min(rect.top, altoVentana - 220)),
          width: 320,
        }
      : {
          position: "fixed",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%)",
          width: "min(340px, calc(100vw - 32px))",
        };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Spotlight (o velo completo si no hay elemento) */}
      {rect ? (
        <div
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            transition: "top .2s, left .2s, width .2s, height .2s",
          }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      )}

      {/* Tarjeta */}
      <div
        style={cardStyle}
        className="rounded-2xl border border-black/10 bg-white p-4 shadow-xl"
        role="dialog"
        aria-label={paso.titulo}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold text-kora-primary">
            Paso {idx + 1} de {PASOS.length}
          </p>
          <button
            onClick={() => void cerrar(true)}
            className="text-kora-muted hover:text-kora-text"
            aria-label="Cerrar tour"
          >
            <X size={16} />
          </button>
        </div>
        <h3 className="mt-1 text-base font-bold text-kora-text">{paso.titulo}</h3>
        <p className="mt-1 text-sm text-kora-muted">{paso.texto}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => void cerrar(true)}
            className="text-xs font-semibold text-kora-muted hover:underline"
          >
            Saltar
          </button>
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="btn-press inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-kora-text hover:border-kora-accent"
              >
                <ArrowLeft size={13} /> Atrás
              </button>
            )}
            <button
              onClick={() => (ultimo ? void cerrar(true) : setIdx((i) => i + 1))}
              className="btn-press inline-flex items-center gap-1 rounded-full bg-kora-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-kora-primary-dark"
            >
              {ultimo ? (
                <>
                  Terminar <Check size={13} />
                </>
              ) : (
                <>
                  Siguiente <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
