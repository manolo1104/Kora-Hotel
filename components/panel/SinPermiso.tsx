import Link from "next/link";
import { Lock } from "lucide-react";
import type { RolHotel } from "@/lib/tenant";
import {
  pantallasPermitidas,
  PANTALLAS,
  type PantallaId,
  type MotivoCierre,
} from "@/lib/panel/pantallas";

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
  motivo = "puesto",
}: {
  /** Nombre de la pantalla, tal como aparece en el menú. */
  titulo: string;
  /** Hasta qué nivel llega el permiso, para redactar el "sólo pueden…". */
  quien?: "dueno" | "encargada" | "recepcion";
  /** A dónde mandarlo: su pantalla de siempre. */
  volverA: string;
  /**
   * Por qué está cerrada. "escondida" = su puesto sí la incluye pero el dueño
   * se la quitó desde "Quién trabaja aquí"; decirlo evita que el empleado crea
   * que el panel se descompuso y le escriba al hotelero.
   */
  motivo?: MotivoCierre;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-kora-accent/15">
        <Lock size={22} className="text-kora-primary" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-kora-text">{titulo}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-kora-muted">
        {motivo === "escondida" ? (
          <>
            El dueño del hotel decidió que esta pantalla no aparezca en tu panel.
            No es un error: tu cuenta está bien y el resto te funciona igual.
          </>
        ) : (
          <>
            Esta pantalla la ve {QUIEN[quien]}. No es un error: tu cuenta está
            bien y el resto del panel te funciona igual.
          </>
        )}
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

/**
 * A dónde mandar a cada quien cuando se le cierra una puerta (y al entrar).
 *
 * Mira TAMBIÉN las pestañas que el dueño le dejó: sin eso, a una camarista a la
 * que le escondieron "Operaciones" el botón "Volver a lo mío" la mandaba justo
 * a la pantalla que no puede abrir, y de ahí otra vez aquí. Un bucle.
 */
export function pantallaDe(
  rol: RolHotel,
  slug: string,
  pantallas?: readonly string[] | null,
): string {
  const base = `/panel/${slug}`;
  const visibles = pantallasPermitidas(rol, pantallas);

  const preferidas: PantallaId[] =
    rol === "limpieza"
      ? ["operaciones", "reservas", "calendario"]
      : rol === "recepcion" || rol === "cocina"
        ? ["reservas", "calendario", "operaciones"]
        : ["insights", "reservas", "operaciones"];

  const elegida =
    preferidas.find((id) => visibles.has(id)) ??
    PANTALLAS.find((p) => visibles.has(p.id))?.id;

  // Sin ninguna pantalla no hay a dónde mandarla: el selector de hoteles es lo
  // único que siempre existe, y desde ahí puede cerrar sesión.
  return elegida ? `${base}/${elegida}` : "/panel";
}
