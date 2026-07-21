"use client";

// Detalle de una habitación: galería clickeable (lightbox a pantalla completa),
// info completa (camas, capacidad, descripción, amenidades) y CTA de reserva.
// El color/tipografía vienen de la marca del hotel (mismas CSS vars que el sitio).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HotelImage } from "@/components/HotelImage";
import {
  ArrowLeft,
  Users,
  BedDouble,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  MessageCircle,
} from "lucide-react";

interface RoomDetail {
  nombre: string;
  descripcion: string | null;
  capacidad: number | null;
  fotos: string[];
  camas: { tipo: string; cantidad: number }[];
  features: string[];
  precioTexto: string | null;
  precioDesde: boolean;
}

export default function RoomDetailClient({
  hotelNombre,
  ubicacion,
  backHref,
  color,
  ink,
  font,
  room,
  amenidades,
  motorActivo,
  reservarHref,
  waHref,
}: {
  hotelNombre: string;
  ubicacion: string | null;
  backHref: string;
  color: string;
  ink: string;
  font: string;
  room: RoomDetail;
  amenidades: string[];
  motorActivo: boolean;
  reservarHref: string;
  waHref: string | null;
}) {
  const fotos = room.fotos;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const abierto = lightbox !== null;

  const cerrar = useCallback(() => setLightbox(null), []);
  const mover = useCallback(
    (d: number) => setLightbox((i) => (i === null ? i : (i + d + fotos.length) % fotos.length)),
    [fotos.length],
  );

  // Teclado: Esc cierra, flechas navegan.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowRight") mover(1);
      else if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", onKey);
    // Evita el scroll del fondo mientras el lightbox está abierto.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [abierto, cerrar, mover]);

  const ctaHref = motorActivo ? reservarHref : waHref || reservarHref;
  const ctaExtern = motorActivo ? {} : { target: "_blank" as const, rel: "noopener noreferrer" };

  return (
    <div
      className="min-h-screen bg-kora-bg"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          fontFamily: font,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {/* Volver */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Volver a {hotelNombre}
        </Link>

        {/* Galería */}
        {fotos.length > 0 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setLightbox(0)}
              className="block w-full overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              aria-label="Ampliar foto"
            >
              <HotelImage
                src={fotos[0]}
                alt={`${room.nombre} — foto 1`}
                className="h-64 w-full sm:h-80"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </button>
            {fotos.length > 1 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {fotos.slice(1, 9).map((url, k) => {
                  const idx = k + 1;
                  const last = idx === 8 && fotos.length > 9;
                  return (
                    <button
                      key={url + idx}
                      type="button"
                      onClick={() => setLightbox(idx)}
                      className="relative block overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                      aria-label={`Ampliar foto ${idx + 1}`}
                    >
                      <HotelImage
                        src={url}
                        alt={`${room.nombre} — foto ${idx + 1}`}
                        className="h-20 w-full sm:h-24"
                        sizes="(max-width: 768px) 25vw, 190px"
                      />
                      {last && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">
                          +{fotos.length - 9}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            className="mt-4 flex h-52 w-full items-center justify-center rounded-2xl text-3xl font-extrabold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)", opacity: 0.9 }}
          >
            {room.nombre}
          </div>
        )}

        {/* Encabezado */}
        <div className="mt-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-kora-text break-words sm:text-3xl">
            {room.nombre}
          </h1>
          {ubicacion && <p className="mt-1 text-sm text-kora-muted">{hotelNombre} · {ubicacion}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-kora-muted">
            {room.capacidad && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={15} aria-hidden="true" /> Hasta {room.capacidad} personas
              </span>
            )}
            {room.camas.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <BedDouble size={15} aria-hidden="true" />{" "}
                {room.camas.map((c) => `${c.cantidad} ${c.tipo}`).join(" · ")}
              </span>
            )}
          </div>
        </div>

        {/* Descripción */}
        {room.descripcion && (
          <p className="mt-4 whitespace-pre-line leading-relaxed text-kora-text">{room.descripcion}</p>
        )}

        {/* Amenidades del hotel */}
        {amenidades.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold" style={{ color: "var(--brand)" }}>
              Servicios y amenidades
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {amenidades.map((a) => (
                <span key={a} className="inline-flex items-center gap-1.5 text-sm text-kora-text">
                  <Check size={14} style={{ color: "var(--brand)" }} aria-hidden="true" /> {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Características propias de la habitación */}
        {room.features.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {room.features.map((f) => (
              <span
                key={f}
                className="rounded-full border border-gray-100 bg-white px-3 py-1 text-xs text-kora-text"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Barra de reserva fija abajo */}
      <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <div>
            {room.precioTexto ? (
              <>
                <span className="block text-lg font-extrabold tabular-nums" style={{ color: "var(--brand)" }}>
                  {room.precioTexto}
                </span>
                <span className="block text-xs text-kora-muted">
                  {room.precioDesde ? "desde · por noche" : "por noche"}
                </span>
              </>
            ) : (
              <span className="text-sm text-kora-muted">Consulta disponibilidad</span>
            )}
          </div>
          <Link
            href={ctaHref}
            {...ctaExtern}
            className="btn-press ml-auto inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {motorActivo ? "Reservar esta habitación" : (
              <>
                <MessageCircle size={16} aria-hidden="true" /> Reservar por WhatsApp
              </>
            )}
          </Link>
        </div>
      </div>

      {/* Lightbox a pantalla completa */}
      {abierto && lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={cerrar}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${lightbox + 1} de ${fotos.length}`}
        >
          <button
            type="button"
            onClick={cerrar}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[lightbox]}
            alt={`${room.nombre} — foto ${lightbox + 1}`}
            className="max-h-[90vh] max-w-[92vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  mover(-1);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Foto anterior"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  mover(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Foto siguiente"
              >
                <ChevronRight size={26} />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                {lightbox + 1} / {fotos.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
