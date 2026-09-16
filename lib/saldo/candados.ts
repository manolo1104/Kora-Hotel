// Las reglas del prepago de Camila en el CRM (/crm/prepago), PURAS: sin base,
// sin reloj. Se usan en dos sitios:
//
//   · la API (`app/api/crm/saldo/route.ts`), que es la que decide;
//   · la pantalla (`components/crm/Prepago.tsx`), para apagar de antemano el
//     interruptor que la API va a rechazar y decir por qué.
//
// Que las dos usen la MISMA función es lo que evita el botón que invita a
// encender el bloqueo y la API que contesta «no se puede» (es la lección de
// lib/crm/acciones.ts). Por eso aquí sólo hay `import type` de lo que toca la
// service-role: este archivo lo carga el navegador.

import type { FasesSaldo } from "@/lib/saldo/fases";
import { MENSAJES_REGALO_MAX } from "@/lib/crm/acciones";
import { REGALO_BIENVENIDA } from "@/lib/saldo/paquetes";

// ─── La etiqueta y el `ref` de un regalo a todos ─────────────────────────────

/**
 * La etiqueta de la recarga de seguridad. Es la MISMA que documenta
 * scripts/regalar-saldo.mjs (`--todos --etiqueta antes-del-bloqueo`): si alguien
 * ya la hizo con el script, el CRM la da por hecha.
 */
export const ETIQUETA_SEGURIDAD = "antes-del-bloqueo";

/** Lo que regala la recarga de seguridad si no se cambia: lo mismo que el script (300). */
export const MENSAJES_SEGURIDAD = REGALO_BIENVENIDA;

/** Tope de mensajes por hotel en un regalo a todos. El mismo que el de la ficha. */
export const MENSAJES_TODOS_MAX = MENSAJES_REGALO_MAX;

export const ETIQUETA_MIN = 3;
export const ETIQUETA_MAX = 60;

/**
 * Minúsculas, números y guiones sueltos entre palabras: `disculpa-sep`,
 * `arranque-2026-09`. Los números hacen falta porque la etiqueta por defecto del
 * script lleva fecha. Nada de espacios, acentos ni mayúsculas: la etiqueta
 * acaba dentro del `ref`, y «Disculpa Sep» y «disculpa-sep» serían dos regalos
 * distintos para la base aunque Manolo quisiera decir el mismo.
 */
const ETIQUETA_FORMATO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function etiquetaValida(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length >= ETIQUETA_MIN &&
    v.length <= ETIQUETA_MAX &&
    ETIQUETA_FORMATO.test(v)
  );
}

/**
 * Lo que la pantalla hace con lo que se teclea antes de validar: minúsculas y
 * espacios a guiones. No quita acentos: «señal» se queda inválida y se le dice,
 * en vez de convertirla en otra palabra sin avisar.
 */
export function normalizarEtiqueta(v: string): string {
  return v.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
}

/**
 * El `ref` con el que se acredita un regalo a todos: `regalo-<etiqueta>`.
 *
 * EXACTAMENTE el formato de scripts/regalar-saldo.mjs (`p_ref: \`regalo-${ETIQUETA}\``).
 * `saldo_acreditar` no acredita dos veces el mismo `ref` en el mismo hotel
 * (índice único por hotel y ref), así que repetir el regalo —desde el CRM o
 * desde el script— no suma dos veces. Si este formato cambiara, un regalo hecho
 * antes con el script dejaría de contar y la recarga de seguridad se repetiría
 * entera. tests/saldo-candados.test.ts compara los dos archivos.
 */
export function refDeRegalo(etiqueta: string): string {
  return `regalo-${etiqueta}`;
}

/**
 * Lo mínimo que puede regalar un regalo a todos con esta etiqueta.
 *
 * La recarga de seguridad no baja del regalo de bienvenida. Su `ref` se aplica
 * UNA vez por hotel: si se hiciera con 3 mensajes por un dedo que se comió un
 * cero, el candado del bloqueo la daría por hecha, los hoteles en cero se
 * callarían a los tres mensajes y ya no habría forma de repetirla con la cifra
 * buena (la base diría «ya lo tenía»). Más de 300 sí se puede.
 */
export function mensajesMinimos(etiqueta: string): number {
  return etiqueta === ETIQUETA_SEGURIDAD ? MENSAJES_SEGURIDAD : 1;
}

export function mensajesTodosValidos(v: unknown, etiqueta = ""): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= mensajesMinimos(etiqueta) &&
    v <= MENSAJES_TODOS_MAX
  );
}

/** Quién recibe un regalo a todos y quién no, porque ya tenía ese `ref`. */
export function planRegaloATodos<H extends { id: string }>(
  hoteles: readonly H[],
  yaLoTienen: ReadonlySet<string>,
): { tocan: H[]; yaLoTenian: H[] } {
  const tocan: H[] = [];
  const yaLoTenian: H[] = [];
  for (const h of hoteles) (yaLoTienen.has(h.id) ? yaLoTenian : tocan).push(h);
  return { tocan, yaLoTenian };
}

// ─── La recarga de seguridad ─────────────────────────────────────────────────

export interface SeguridadPrepago {
  /** false = no se pudo comprobar (no se leyó el saldo o los movimientos). */
  leida: boolean;
  /** Hoteles con fila en `saldo_bot`: los únicos a los que el bloqueo puede callar. */
  total: number;
  /** Ids de los que tienen fila y NO tienen el regalo `regalo-antes-del-bloqueo`. */
  faltan: string[];
}

/**
 * ¿Ya recibió la recarga de seguridad cada hotel al que el bloqueo podría callar?
 *
 * Sólo cuentan los hoteles CON fila: uno sin fila está fuera del prepago y
 * `sinSaldo()` nunca lo calla (lib/db/saldo.ts). Un hotel creado DESPUÉS de la
 * recarga de seguridad trae su regalo de bienvenida pero no este `ref`, así que
 * vuelve a salir en `faltan`: repetir la recarga le da el regalo sólo a él.
 */
export function seguridadDelPrepago(
  hotelesConFila: readonly string[],
  conRegalo: ReadonlySet<string>,
): SeguridadPrepago {
  return {
    leida: true,
    total: hotelesConFila.length,
    faltan: hotelesConFila.filter((id) => !conRegalo.has(id)),
  };
}

/** Los que se callarían en el instante de encender el bloqueo: con fila y en cero. */
export function mudosSiSeEnciende(saldos: Iterable<{ mensajes: number }>): number {
  let n = 0;
  for (const s of saldos) if (s.mensajes <= 0) n++;
  return n;
}

// ─── Los dos interruptores ───────────────────────────────────────────────────

export type Interruptores = { recarga: boolean; bloqueo: boolean };

export type Veredicto = { ok: true } | { ok: false; motivo: string };

const SI: Veredicto = { ok: true };
const no = (motivo: string): Veredicto => ({ ok: false, motivo });

/**
 * Lo que de verdad está pasando. El bloqueo guardado SIN recargas abiertas no
 * calla a nadie (`bloqueoEncendido()` de lib/saldo/fases.ts exige las dos), así
 * que para decidir se usa esto y no el dato crudo.
 */
export function efectivas(f: Interruptores): Interruptores {
  return { recarga: f.recarga, bloqueo: f.recarga && f.bloqueo };
}

/**
 * Lo que se guarda al tocar UN interruptor en la pantalla.
 *
 * Se parte de lo EFECTIVO, no de lo guardado. Si en el servidor quedó un
 * bloqueo puesto sin recargas (una variable de entorno mal puesta), abrir las
 * recargas a partir del dato crudo guardaría también ese bloqueo y callaría a
 * Camila sin que nadie hubiera tocado ese botón. Así, abrir recargas es sólo
 * abrir recargas.
 */
export function pedidoAlTocar(actual: Interruptores, cual: keyof Interruptores): Interruptores {
  const e = efectivas(actual);
  return cual === "recarga" ? { recarga: !e.recarga, bloqueo: e.bloqueo } : { recarga: e.recarga, bloqueo: !e.bloqueo };
}

/**
 * ¿Se puede pasar de `actual` a `pedido`? Los candados, en el orden en que se
 * le explican a Manolo:
 *
 *   1. No se cierran las recargas con el bloqueo encendido. Primero se apaga el
 *      bloqueo: si no, un hotel sin saldo queda mudo y sin forma de recargar.
 *   2. No se enciende el bloqueo si las recargas quedan cerradas. Mismo motivo.
 *   3. No se enciende nada si el prepago no está instalado (sin la tabla de
 *      saldo, un pago no tendría dónde acreditarse).
 *   4. No se enciende el bloqueo sin la recarga de seguridad en TODOS los
 *      hoteles con saldo, ni si no se pudo comprobar. Mientras se mide, el saldo
 *      baja sin callar a nadie: el hotel que ya gastó sus mensajes se quedaría
 *      mudo en el instante de encenderlo, sin aviso y sin haber podido pagar.
 *
 * Apagar el bloqueo pasa siempre: es la dirección segura.
 */
export function evaluarCambioFases(a: {
  actual: Interruptores;
  pedido: Interruptores;
  saldoInstalado: boolean;
  seguridad: { leida: boolean; faltan: number };
}): Veredicto {
  const antes = efectivas(a.actual);
  const { pedido } = a;

  if (antes.bloqueo && !pedido.recarga) {
    return no(
      "Primero apaga «Callar a Camila sin saldo». Si cierras las recargas con eso encendido, un hotel que se quede sin saldo no tendría cómo recargar.",
    );
  }
  if (pedido.bloqueo && !pedido.recarga) {
    return no(
      "Primero abre las recargas. Si Camila se calla sin saldo y el hotelero no puede pagar, se queda mudo y sin salida.",
    );
  }

  const abreRecarga = pedido.recarga && !antes.recarga;
  const enciendeBloqueo = pedido.bloqueo && !antes.bloqueo;

  if ((abreRecarga || enciendeBloqueo) && !a.saldoInstalado) {
    return no("El prepago todavía no está instalado: falta correr sql/kora-saldo-bot.sql en Supabase.");
  }

  if (enciendeBloqueo) {
    if (!a.seguridad.leida) {
      return no(
        "No pude comprobar si ya se hizo la recarga de seguridad. Recarga la página e inténtalo otra vez.",
      );
    }
    if (a.seguridad.faltan > 0) {
      const n = a.seguridad.faltan;
      return no(
        `Falta la recarga de seguridad en ${n} hotel${n === 1 ? "" : "es"}. Hazla primero: si no, quien ya gastó sus mensajes se queda mudo en cuanto enciendas esto.`,
      );
    }
  }

  return SI;
}

/**
 * ¿El pedido ENCIENDE algo que la pantalla creía que ya estaba encendido?
 *
 * La pantalla manda los DOS interruptores, y el diálogo sólo habla del que se
 * tocó. Si desde otra pestaña se cerraron las recargas y en esta (sin recargar)
 * se enciende el bloqueo, el pedido {recarga:true, bloqueo:true} volvería a
 * abrir las recargas sin que Manolo lo hubiera leído en ninguna parte. Con esto
 * la API contesta «esto cambió, recarga la página» en vez de hacerlo.
 *
 * Sólo mira lo que se ENCIENDE: apagar pasa siempre, aunque la pantalla esté
 * vieja, porque es la dirección segura.
 */
export function enciendeSinVerlo(a: {
  actual: Interruptores;
  vistos: Interruptores;
  pedido: Interruptores;
}): boolean {
  const antes = efectivas(a.actual);
  const vistos = efectivas(a.vistos);
  return (
    (a.pedido.recarga && !antes.recarga && vistos.recarga) ||
    (a.pedido.bloqueo && !antes.bloqueo && vistos.bloqueo)
  );
}

// ─── Lo que viaja a la pantalla ──────────────────────────────────────────────

export interface HotelPrepago {
  id: string;
  slug: string;
  nombre: string;
  /** null = sin fila en `saldo_bot`: fuera del prepago, nunca se le calla (≠ 0). */
  mensajes: number | null;
  /** Mensajes de Camila en 30 días. null = no se pudo contar, o está fuera del prepago. */
  consumo30d: number | null;
  /** Días que le alcanzan al ritmo de 30 días (`diasQueAlcanzan`). null = sin con qué estimar. */
  dias: number | null;
  /** Ya recibió la recarga de seguridad. null = no se pudo comprobar. */
  seguridad: boolean | null;
}

export interface PanoramaPrepago {
  fases: FasesSaldo;
  /** false = falta `sql/kora-saldo-bot.sql` (o no se pudo saber). */
  saldoInstalado: boolean;
  /** false = no se pudo leer la lista de hoteles: `hoteles` viene vacía por eso. */
  hotelesLeidos: boolean;
  /**
   * false = no se pudo leer `saldo_bot`. Entonces TODAS las filas traen
   * `mensajes: null`, y eso NO significa «fuera del prepago» (ver
   * `estadoSaldoHotel`).
   */
  saldosLeidos: boolean;
  /**
   * false = falta `sql/kora-crm-mando.sql` (no existe `kora_ajustes`): los
   * interruptores no se pueden guardar desde aquí y mandan las variables de
   * Vercel. Ante la duda sale true y el guardado lo dirá.
   */
  fasesGuardables: boolean;
  hoteles: HotelPrepago[];
  /** Hoteles con fila en `saldo_bot`. null = no se pudo leer. */
  enPrepago: number | null;
  /** Con fila y en cero: se callarían al encender el bloqueo. null = no se pudo leer. */
  mudosHoy: number | null;
  seguridad: SeguridadPrepago;
  /** Banda roja: algo no se pudo leer y los números de abajo pueden estar mal. */
  fallos: string[];
  /** Nota gris: pasos de instalación pendientes. */
  pendientes: string[];
}

export type EstadoSaldoHotel = "numero" | "fuera" | "sin-leer";

/**
 * Qué enseñar en la columna «Mensajes» de un hotel.
 *
 * «Fuera del prepago» es una AFIRMACIÓN: quiere decir «nunca se le acreditó
 * nada, así que a este hotel no se le calla por saldo». Cuando la lectura de
 * `saldo_bot` falla, todos los hoteles llegan con `mensajes: null`, y pintarlos
 * como «fuera del prepago» convertiría un fallo de lectura en esa afirmación
 * sobre TODOS a la vez — justo lo que esta pantalla no puede hacer, porque es
 * desde donde se decide callar a Camila. Sin lectura no se dice nada: «—».
 */
export function estadoSaldoHotel(mensajes: number | null, saldosLeidos: boolean): EstadoSaldoHotel {
  if (mensajes !== null) return "numero";
  return saldosLeidos ? "fuera" : "sin-leer";
}

/** Respuesta del ensayo de un regalo a todos (no escribe nada). */
export interface EnsayoRegalo {
  etiqueta: string;
  ref: string;
  mensajes: number;
  /** false = no se pudo leer cuánto tiene cada uno: los `mensajes` de `tocan` vienen en null. */
  saldosLeidos: boolean;
  /** A quién se le sumaría. `mensajes` = lo que tiene hoy (null = fuera del prepago). */
  tocan: { slug: string; nombre: string; mensajes: number | null }[];
  /** Quién ya recibió este mismo regalo (mismo `ref`) y no se le vuelve a sumar. */
  yaLoTenian: { slug: string; nombre: string }[];
}
