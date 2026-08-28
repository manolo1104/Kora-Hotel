import Link from "next/link";
import { Lock } from "lucide-react";
import type { RolHotel } from "@/lib/tenant";

// Lo que ve alguien del equipo cuando abre una pantalla que no le toca.
//
// POR QUÉ EXISTE: `requireHotelMember` sólo comprueba MEMBRESÍA, así que hasta
// hoy 9 de las 10 pantallas del panel operativo cargaban sus datos para
// cualquier rol. Una camarista podía abrir /ingresos y ver la facturación del
// hotel. El mapa de permisos y `puede()` ya existían; sólo no se usaban aquí.
//
// El mensaje dice QUIÉN sí puede y ofrece una salida. Un "403" o una pantalla
// en blanco haría que el empleado crea que el panel se descompuso y le escriba
// al dueño.

const QUIEN: Record<string, string> = {
  dueno: "el dueño del hotel",
  encargada: "el dueño y la encargada",
  recepcion: "el dueño, la encargada y recepción",
};

export function SinPermiso({
  titulo,
  quien = "dueno",
  volverA,
}: {
  /** Nombre de la pantalla, tal como aparece en el menú. */
  titulo: string;
  /** Hasta qué nivel llega el permiso, para redactar el "sólo pueden…". */
  quien?: "dueno" | "encargada" | "recepcion";
  /** A dónde mandarlo: su pantalla de siempre. */
  volverA: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-kora-accent/15">
        <Lock size={22} className="text-kora-primary" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-kora-text">{titulo}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-kora-muted">
        Esta pantalla la ve {QUIEN[quien]}. No es un error: tu cuenta está bien y
        el resto del panel te funciona igual.
      </p>
      <Link
        href={volverA}
        className="btn-press mt-6 inline-flex items-center gap-2 rounded-full bg-kora-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-kora-primary-dark"
      >
        Volver a lo mío
      </Link>
    </div>
  );
}

/** A dónde mandar a cada rol cuando se le cierra una puerta (y al entrar). */
export function pantallaDe(rol: RolHotel, slug: string): string {
  const base = `/panel/${slug}`;
  if (rol === "limpieza") return `${base}/operaciones`;
  if (rol === "recepcion" || rol === "cocina") return `${base}/reservas`;
  return `${base}/insights`;
}
