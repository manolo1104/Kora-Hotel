// Las cinco cosas que un hotel pequeño escribe a mano todos los días.
//
// No son plantillas «editables» guardadas en la base: son funciones PURAS que
// producen un borrador con los datos reales del huésped, y el hotelero lo
// reescribe antes de mandarlo si quiere. Esa es la diferencia entre esto y un
// correo automático — aquí siempre hay una persona que lo lee antes de enviar.
//
// Regla dura: NINGUNA cifra se teclea aquí. Las fechas, el total, el anticipo y
// la política de cancelación llegan ya calculadas por quien llama (la ruta del
// panel, que las saca del motor y del CRM). Si esta función inventara un número
// —«el anticipo suele ser el 30%»— sería la misma trampa que ya costó un correo
// prometiendo un código de descuento que el motor rechazaba.
//
// Y si a una plantilla le falta un dato para poder decir la verdad, lo DECLARA
// en `requiere` y la ruta se niega a enviar. Un correo con un hueco es peor que
// no mandarlo.

import { fechaLarga, money } from "@/lib/email/design";

export type PlantillaId = "blanco" | "llegada" | "como_llegar" | "anticipo" | "gracias" | "cotizacion";

/** Todo lo que una plantilla puede necesitar. Lo llena la ruta, no el navegador. */
export interface DatosCorreo {
  hotelNombre: string;
  huesped: string;
  ubicacion?: string;
  /** Próxima estancia (o la última, para «gracias»). ISO `YYYY-MM-DD`. */
  checkin?: string;
  checkout?: string;
  noches?: number;
  huespedes?: number;
  habitacion?: string;
  confirmacion?: string;
  total?: number;
  /** Lo que el huésped YA pagó como anticipo (`bookings.anticipo`). */
  anticipoPagado?: number;
  /**
   * Lo que falta por pagar para apartar, calculado con `calcDepositAmount` — la
   * MISMA función que usa el motor al cobrar. Cero si ya lo pagó.
   */
  anticipoPorPagar?: number;
  /** Total − anticipo pagado: lo que liquida al llegar. */
  pendiente?: number;
  /** De `hoteles.guia.checkin` / `.checkout` — «3:00 PM». */
  checkinHora?: string;
  checkoutHora?: string;
  /** Texto derivado de `lib/politica.ts`; el mismo que lee el huésped al reservar. */
  politicaCancelacion?: string;
  ultimaEstancia?: string;
  totalReservas?: number;
}

/** Los campos que una plantilla exige para no mentir. */
export type CampoRequerido =
  | "checkin"
  | "checkout"
  | "habitacion"
  | "anticipoPorPagar"
  | "checkinHora"
  | "checkoutHora"
  | "ultimaEstancia"
  | "total";

/** Cómo se le llama a cada campo cuando hay que pedírselo al hotelero. */
export const ETIQUETA_CAMPO: Record<CampoRequerido, string> = {
  checkin: "una reserva próxima de este huésped",
  checkout: "la fecha de salida de esa reserva",
  habitacion: "la habitación de esa reserva",
  anticipoPorPagar: "un anticipo pendiente (esta reserva ya lo tiene pagado)",
  checkinHora: "la hora de entrada (Editar mi sitio → Guía)",
  checkoutHora: "la hora de salida (Editar mi sitio → Guía)",
  ultimaEstancia: "una estancia ya terminada de este huésped",
  total: "el total de la estancia",
};

/** Qué botón lleva. La URL la arma la ruta; aquí sólo se declara cuál. */
export type TipoCta = "reserva" | "maps" | "resena" | "motor";

export interface BorradorCorreo {
  asunto: string;
  parrafos: string[];
  datos?: { k: string; v: string }[];
  nota?: string;
}

export interface Plantilla {
  id: PlantillaId;
  nombre: string;
  /** Una línea de ayuda en el selector: cuándo se usa. */
  cuando: string;
  requiere: CampoRequerido[];
  cta?: TipoCta;
  ctaTexto?: string;
  armar(d: DatosCorreo): BorradorCorreo;
}

// ── Ayudantes de formato ─────────────────────────────────────────────────────

const dia = (iso?: string) => (iso ? fechaLarga(iso) : "");

/** Sólo pinta la fila si el dato existe de verdad. `0` no cuenta como importe. */
function fila(k: string, v: string | number | undefined | null): { k: string; v: string }[] {
  if (v === undefined || v === null || v === "") return [];
  return [{ k, v: String(v) }];
}
function filaDinero(k: string, n: number | undefined): { k: string; v: string }[] {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return [];
  return [{ k, v: money(n) }];
}

/** Las filas de estancia que comparten casi todas las plantillas. */
function filasEstancia(d: DatosCorreo) {
  return [
    ...fila("Entrada", dia(d.checkin)),
    ...fila("Salida", dia(d.checkout)),
    ...fila("Habitación", d.habitacion),
    ...fila("Huéspedes", d.huespedes),
    ...fila("Noches", d.noches),
    ...fila("Folio", d.confirmacion),
  ];
}

// ── Las cinco ────────────────────────────────────────────────────────────────

export const PLANTILLAS: Plantilla[] = [
  {
    id: "llegada",
    nombre: "Confirmación y detalles de tu llegada",
    cuando: "Cuando ya está reservado y quieres que tenga todo a la mano.",
    requiere: ["checkin", "checkout", "habitacion"],
    cta: "reserva",
    ctaTexto: "Ver mi reserva",
    armar: (d) => ({
      asunto: `Tu llegada a ${d.hotelNombre}: ${dia(d.checkin)}`,
      parrafos: [
        "Ya está todo listo para tu llegada. Te dejo aquí los datos de tu estancia para que los tengas a la mano.",
        "Si necesitas cambiar algo —la hora de llegada, el número de personas, lo que sea— contéstame este mismo correo y lo vemos.",
        "Nos da mucho gusto recibirte.",
      ],
      datos: [
        ...filasEstancia(d),
        ...filaDinero("Total de la estancia", d.total),
        ...filaDinero("Anticipo pagado", d.anticipoPagado),
        ...filaDinero("Pendiente al llegar", d.pendiente),
      ],
      nota: d.politicaCancelacion,
    }),
  },

  {
    id: "como_llegar",
    nombre: "Cómo llegar y horarios",
    cuando: "Uno o dos días antes, para que no lo busque el día del viaje.",
    requiere: ["checkinHora", "checkoutHora"],
    cta: "maps",
    ctaTexto: "Ver cómo llegar",
    armar: (d) => ({
      asunto: `Cómo llegar a ${d.hotelNombre} y horarios de entrada`,
      parrafos: [
        "Te comparto los horarios y la ubicación, para que no tengas que buscarlo el día del viaje.",
        "Si vas a llegar fuera de ese horario, avísame con tiempo y lo acomodamos sin problema.",
        "Cualquier duda del camino, contéstame este correo.",
      ],
      datos: [
        ...fila("Entrada a partir de", d.checkinHora),
        ...fila("Salida antes de", d.checkoutHora),
        ...fila("Dirección", d.ubicacion),
        ...fila("Tu llegada", dia(d.checkin)),
      ],
    }),
  },

  {
    id: "anticipo",
    nombre: "Recordatorio de anticipo pendiente",
    cuando: "Cuando apartaste la habitación y el anticipo no ha entrado.",
    requiere: ["checkin", "anticipoPorPagar"],
    cta: "reserva",
    ctaTexto: "Ver mi reserva",
    armar: (d) => ({
      asunto: `Tu habitación en ${d.hotelNombre} está apartada — falta el anticipo`,
      parrafos: [
        `Tengo tu habitación apartada para el ${dia(d.checkin)}. Para dejarla confirmada falta el anticipo.`,
        "Contéstame este correo y te paso el link de pago o los datos para transferencia, lo que te quede más cómodo.",
        "En cuanto entre el pago te mando la confirmación.",
      ],
      datos: [
        ...filasEstancia(d),
        ...filaDinero("Total de la estancia", d.total),
        ...filaDinero("Anticipo para apartar", d.anticipoPorPagar),
      ],
      nota: d.politicaCancelacion,
    }),
  },

  {
    id: "gracias",
    nombre: "Gracias por tu estancia + reseña",
    cuando: "Uno o dos días después de que se fue.",
    requiere: ["ultimaEstancia"],
    cta: "resena",
    ctaTexto: "Dejar mi reseña",
    armar: (d) => ({
      asunto: `Gracias por tu visita a ${d.hotelNombre}`,
      parrafos: [
        "Gracias por dejarnos ser parte de tu viaje. Ojalá te hayas ido descansando.",
        "Si tienes un minuto, una reseña nos ayuda muchísimo: somos un hotel chico y es como nos encuentra la gente.",
        "Y si algo no salió como esperabas, dímelo a mí primero — quiero saberlo.",
      ],
      datos: [
        ...fila("Tu última estancia", dia(d.ultimaEstancia)),
        ...fila("Veces que nos has visitado", d.totalReservas),
      ],
    }),
  },

  {
    id: "cotizacion",
    nombre: "Cotización a medida",
    cuando: "Cuando te preguntaron precio y quieres dejarlo por escrito.",
    // A propósito NO exige nada: una cotización es justo para quien TODAVÍA no
    // tiene reserva. Las cifras las escribe el hotelero en el cuerpo; si además
    // hay una reserva próxima (una manual recién creada desde el panel), la
    // tabla de datos se rellena sola con las de verdad.
    requiere: [],
    cta: "motor",
    ctaTexto: "Reservar en línea",
    armar: (d) => ({
      asunto: `Tu cotización en ${d.hotelNombre}`,
      parrafos: [
        "Te dejo por escrito lo que platicamos, para que lo tengas con calma.",
        "Los precios son para esas fechas en concreto; si mueves los días puede cambiar, y con gusto te lo vuelvo a cotizar.",
        "Cuando quieras apartarlo, contéstame este correo o resérvalo en línea.",
      ],
      datos: [
        ...filasEstancia(d),
        ...filaDinero("Total de la estancia", d.total),
        ...filaDinero("Anticipo para apartar", d.anticipoPorPagar),
      ],
      nota: d.politicaCancelacion,
    }),
  },

  {
    id: "blanco",
    nombre: "En blanco",
    cuando: "Escribe tú desde cero, con la marca de tu hotel.",
    requiere: [],
    armar: () => ({ asunto: "", parrafos: [] }),
  },
];

export function plantillaPorId(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id);
}

/**
 * Qué le falta a esta plantilla para poder mandarse con este huésped.
 *
 * Se mira el DATO, no la plantilla: un `anticipo` de 0 es tan «falta» como uno
 * ausente, porque un correo que dice «falta tu anticipo de $0» no lo manda nadie.
 */
export function faltantes(p: Plantilla, d: DatosCorreo): CampoRequerido[] {
  return p.requiere.filter((campo) => {
    const v = d[campo];
    if (typeof v === "number") return !Number.isFinite(v) || v <= 0;
    return typeof v !== "string" || !v.trim();
  });
}
