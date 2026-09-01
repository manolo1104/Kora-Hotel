// Qué PANTALLAS ve cada persona del equipo, una por una.
//
// POR QUÉ EXISTE: el puesto (`rol`) decidía las dos cosas a la vez —qué puede
// HACER alguien y qué PANTALLAS ve—. El hotel de Nealtican dio de alta a su
// camarista y se encontró con que, por venir con el paquete de "Limpieza",
// también veía la pestaña de Reservas con los totales de cada noche: *"no me
// parece bien que pueda ver la parte de ganancias en reserva porque puede
// empezar a especular"*.
//
// ═══ LA REGLA (decisión de Manolo, 1 sep 2026) ═══
//
// **El puesto es una PLANTILLA, no un techo.** Quien dio de alta el hotel elige
// SIN BLOQUEOS qué pestañas ve cada quien: puede quitar las que trae el puesto y
// puede dar las que no. Elegir el puesto sólo pre-marca unas casillas.
//
// La consecuencia que hay que respetar al tocar esto: **marcar una pestaña
// concede TAMBIÉN los permisos de esa pestaña** (`permisos` de cada entrada).
// Media concesión —ver la pantalla pero que su API conteste 403— se ve como que
// el panel se descompuso, y quien recibe la llamada es el hotelero. Por eso el
// mapa de abajo es la lista COMPLETA de lo que hace cada pantalla, y por eso
// `permisosDe()` es lo que consultan `negar()` y `puedeCtx()`, no `puede()`.
//
// Lo que NO se puede dar con una casilla, porque no es una pantalla de este
// panel sino una acción de "Mis hoteles": `datos:exportar` (bajarse el fichero
// completo de huéspedes) y `hotel:eliminar`. Los dos siguen siendo SOLO_DUENO
// en lib/panel/permisos.ts y ninguna entrada de aquí los concede.
import type { RolHotel } from "@/lib/tenant";
import { puede, PERMISOS, type Permiso } from "@/lib/panel/permisos";

export type PantallaId =
  | "insights"
  | "camila"
  | "calendario"
  | "reservas"
  | "cotizaciones"
  | "ingresos"
  | "pagos"
  | "clientes"
  | "operaciones"
  | "canales"
  | "facturacion"
  | "sitio"
  | "equipo";

export interface Pantalla {
  id: PantallaId;
  /** Tal como aparece en el menú lateral. */
  label: string;
  /**
   * TODO lo que la pantalla necesita para funcionar entera. Marcar la casilla
   * concede esta lista; el primero es además el que decide si se puede abrir.
   */
  permisos: [Permiso, ...Permiso[]];
  /** Una línea para el dueño: qué se ve ahí dentro. */
  que: string;
  /**
   * Advertencia cuando dársela a alguien tiene una consecuencia que no se
   * adivina desde el nombre de la pestaña. NO bloquea: se enseña al lado de la
   * casilla para que la decisión se tome con el dato a la vista.
   */
  aviso?: string;
}

/** El orden es el del menú lateral: la lista de casillas se lee igual que el panel. */
export const PANTALLAS: Pantalla[] = [
  {
    id: "insights",
    label: "Inicio",
    permisos: ["ingresos:ver", "ia:usar"],
    que: "Resumen del mes: facturación, ocupación y qué se vendió.",
  },
  {
    id: "camila",
    label: "Camila (bot)",
    permisos: ["bot:leer", "bot:entrenar", "bot:configurar", "bot:vincular"],
    que: "El bot de WhatsApp: sus respuestas, su tono y las conversaciones.",
    aviso:
      "Incluye la cuenta de banco que Camila le dicta a los huéspedes y el QR para vincular el WhatsApp del hotel.",
  },
  {
    id: "calendario",
    label: "Calendario",
    permisos: ["reservas:leer", "reservas:dinero", "reservas:escribir", "calendario:escribir"],
    que: "Qué cuartos están ocupados cada noche, y bloquear fechas.",
  },
  {
    id: "reservas",
    label: "Reservas",
    permisos: ["reservas:leer", "reservas:dinero", "reservas:escribir", "reservas:cancelar", "marketing:enviar"],
    que: "La lista de reservas con quién llega, cuándo y por cuánto.",
  },
  {
    id: "cotizaciones",
    label: "Cotizaciones",
    permisos: ["cotizaciones:leer", "cotizaciones:escribir", "marketing:enviar"],
    que: "Presupuestos mandados a huéspedes que aún no reservan.",
  },
  {
    id: "ingresos",
    label: "Ingresos",
    permisos: ["ingresos:ver"],
    que: "Cuánto entró: por mes, por cuarto y comparado con el año pasado.",
  },
  {
    id: "pagos",
    label: "Pagos",
    permisos: ["pagos:ver", "pagos:conectar"],
    que: "La cuenta de Stripe del hotel y a dónde cae el dinero.",
    aviso:
      "Desde ahí se abre tu panel de Stripe, donde se cambia la cuenta de banco que recibe los depósitos.",
  },
  {
    id: "clientes",
    label: "Clientes",
    permisos: ["clientes:leer", "clientes:escribir"],
    que: "El fichero de huéspedes con su correo y su teléfono.",
  },
  {
    id: "operaciones",
    label: "Operaciones",
    permisos: ["operaciones:leer", "operaciones:escribir"],
    que: "Limpieza, mantenimiento y el estado de cada cuarto hoy.",
  },
  {
    id: "canales",
    label: "Canales OTA",
    permisos: ["canales:leer", "canales:escribir"],
    que: "La conexión con Booking y Expedia.",
  },
  {
    id: "facturacion",
    label: "Facturación",
    permisos: ["facturacion:usar"],
    que: "Facturas (CFDI) de las reservas.",
  },
  {
    id: "sitio",
    label: "Editar mi sitio",
    permisos: ["sitio:leer", "sitio:editar", "ia:usar"],
    que: "La página pública del hotel: fotos, textos, precios y blog.",
    aviso: "Cambia lo que ven los huéspedes en tu página, incluidos los precios.",
  },
  {
    id: "equipo",
    label: "Quién trabaja aquí",
    permisos: ["equipo:gestionar"],
    que: "Dar de alta y quitar gente. Esta misma pantalla.",
    aviso:
      "Quien la tenga puede dar de alta a quien quiera y darse a sí misma cualquier puesto, incluido dueño.",
  },
];

const POR_ID = new Map(PANTALLAS.map((p) => [p.id, p]));

export const ES_PANTALLA = (v: string): v is PantallaId => POR_ID.has(v as PantallaId);

/**
 * Las que el puesto trae de fábrica. Es la PLANTILLA que se pre-marca al elegir
 * el puesto, no un límite: `pantallasPermitidas` no la usa para recortar.
 */
export function pantallasDelRol(rol: RolHotel): PantallaId[] {
  return PANTALLAS.filter((p) => puede(rol, p.permisos[0])).map((p) => p.id);
}

/**
 * Lo que esta persona ve DE VERDAD.
 *
 * @param elegidas lo guardado en `hotel_members.pantallas`. `null` = "las de su
 *   puesto" — que es el comportamiento de siempre y lo que tienen las filas que
 *   ya existían.
 *
 * Al DUEÑO se le da todo siempre: es el único que puede volver a abrir una
 * puerta cerrada, y un dueño que se esconde "Quién trabaja aquí" a sí mismo se
 * queda sin forma de arreglarlo desde adentro. Mismo criterio que
 * `protegerUltimoDueno`.
 */
export function pantallasPermitidas(
  rol: RolHotel,
  elegidas: readonly string[] | null | undefined,
): Set<PantallaId> {
  if (rol === "dueno") return new Set(PANTALLAS.map((p) => p.id));
  if (!elegidas) return new Set(pantallasDelRol(rol));
  return new Set(elegidas.filter(ES_PANTALLA));
}

/** ¿Esta persona puede abrir esta pantalla? */
export function verPantalla(
  rol: RolHotel,
  elegidas: readonly string[] | null | undefined,
  id: PantallaId,
): boolean {
  return pantallasPermitidas(rol, elegidas).has(id);
}

/**
 * TODO lo que esta persona puede hacer: lo de su puesto MÁS lo que abren las
 * pestañas que le marcaron.
 *
 * Es la función que consultan `negar()` y `puedeCtx()` en las 47 rutas del
 * panel. Sin ella, dar una pestaña sería darla a medias: la pantalla abriría y
 * su API contestaría 403.
 *
 * NUNCA concede `datos:exportar` ni `hotel:eliminar`: no son pantallas de este
 * panel, y siguen siendo del dueño en la matriz.
 */
export function permisosDe(
  rol: RolHotel,
  elegidas: readonly string[] | null | undefined,
): Set<Permiso> {
  const fuera = new Set<Permiso>();
  // Lo del puesto siempre se conserva: quitar una pestaña esconde la pantalla,
  // no le retira a alguien el permiso que su puesto le da en otra parte.
  for (const p of Object.keys(PERMISOS) as Permiso[]) {
    if (puede(rol, p)) fuera.add(p);
  }
  if (rol === "dueno") return fuera;

  for (const id of pantallasPermitidas(rol, elegidas)) {
    for (const p of POR_ID.get(id)?.permisos ?? []) fuera.add(p);
  }
  return fuera;
}

/**
 * POR QUÉ está cerrada una pantalla, o `null` si está abierta.
 *
 *   "puesto"    → su puesto no la trae y nadie se la marcó.
 *   "escondida" → su puesto sí la trae, pero se la quitaron a mano.
 *
 * La diferencia no es cosmética: al empleado se le dicen cosas distintas
 * ("esto lo ve el dueño" vs "el dueño decidió que no aparezca en tu panel"), y
 * la segunda evita que le escriba al hotelero creyendo que el panel falla.
 */
export type MotivoCierre = "puesto" | "escondida";

export function motivoCierre(
  rol: RolHotel,
  elegidas: readonly string[] | null | undefined,
  id: PantallaId,
): MotivoCierre | null {
  if (pantallasPermitidas(rol, elegidas).has(id)) return null;
  return pantallasDelRol(rol).includes(id) ? "escondida" : "puesto";
}

/**
 * Limpia lo que llega del panel antes de guardarlo: sólo ids reales.
 *
 * NO recorta por puesto: ésa es la decisión de Manolo del 1 sep 2026 — quien
 * administra el hotel elige sin bloqueos. Lo único que se sigue exigiendo es
 * que quede al menos una pestaña.
 *
 * Devuelve `null` cuando la selección coincide con la plantilla del puesto,
 * para que no haya dos formas de decir lo mismo.
 */
export function sanearPantallas(
  rol: RolHotel,
  entrada: readonly string[] | null | undefined,
): { ok: true; pantallas: PantallaId[] | null } | { ok: false; error: string } {
  if (rol === "dueno") return { ok: true, pantallas: null }; // al dueño no se le recorta
  if (!entrada) return { ok: true, pantallas: null };

  // Se conserva el orden del catálogo para que dos selecciones iguales se
  // guarden idénticas y `null` signifique siempre lo mismo.
  const marcadas = PANTALLAS.map((p) => p.id).filter((id) => entrada.includes(id));

  // Dejar a alguien sin NINGUNA pantalla es darle una cuenta que al entrar
  // enseña un panel vacío. Desde fuera eso no se lee como "no te toca", se lee
  // como "el sistema se descompuso" — y quien llama es el dueño.
  if (marcadas.length === 0) return { ok: false, error: "sin-pantallas" };

  const plantilla = pantallasDelRol(rol);
  const igualALaPlantilla =
    marcadas.length === plantilla.length && marcadas.every((id) => plantilla.includes(id));
  if (igualALaPlantilla) return { ok: true, pantallas: null };

  return { ok: true, pantallas: marcadas };
}
