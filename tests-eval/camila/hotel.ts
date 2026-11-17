// Hotel FICTICIO para el banco de pruebas de Camila. Realista a propósito: tarifas
// por número de personas (donde los errores de cotización se notan), una
// temporada con mínimo de noches, un cuarto de una sola unidad (donde el
// apartado propio choca consigo mismo), políticas, preguntas frecuentes y una
// guía con horarios y una clave de wifi que NO se debe revelar.
//
// Las fechas se calculan desde HOY (zona de México) para que el banco funcione
// cualquier día que se corra.

export const TZ = "America/Mexico_City";

/** Hoy en México como YYYY-MM-DD. */
export function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Suma días a una fecha YYYY-MM-DD. */
export function masDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function diaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** "viernes 4 de diciembre" */
export function fechaHumana(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** "Friday, December 4" */
export function fechaHumanaEn(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS_EN[d.getUTCDay()]}, ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function nombreDia(n: number): string {
  return DIAS[n];
}

/** Próximo día de la semana `dow` (0=dom) estrictamente después de `desde`, a ≥ `minDias`. */
export function proximo(dow: number, desde: string, minDias = 1): string {
  let d = masDias(desde, minDias);
  while (diaSemana(d) !== dow) d = masDias(d, 1);
  return d;
}

const HOY = hoyISO();

/** Fechas que usan los escenarios. Todas en el futuro y fuera de la temporada salvo `temporada*`. */
export const F = {
  hoy: HOY,
  // Una estancia normal de 2 noches, a ~3 semanas, entre semana (mar→jue).
  normalIn: proximo(2, HOY, 18),
  get normalOut() {
    return masDias(this.normalIn, 2);
  },
  // Temporada alta: empieza en ~6 semanas y dura 10 días, mínimo 2 noches.
  temporadaDesde: masDias(HOY, 42),
  get temporadaHasta() {
    return masDias(this.temporadaDesde, 10);
  },
  // Fin de semana más próximo (vie→dom) a ≥ 2 días.
  finIn: proximo(5, HOY, 2),
  get finOut() {
    return masDias(this.finIn, 2);
  },
  // Fechas donde la Suite Jardín (1 unidad) ya está vendida.
  suiteLlenaIn: proximo(4, HOY, 25),
  get suiteLlenaOut() {
    return masDias(this.suiteLlenaIn, 2);
  },
};

export const HOTEL_ID = "h-eval";
export const WHATSAPP_CAMILA = "524811234567";
export const WHATSAPP_PERSONA = "524819876543";
export const CLAVE_WIFI = "CeibaSegura2026";

/** La fila de `hoteles` tal como la lee /api/agent. */
export function hotelFicticio(over: { menoresPagan?: boolean } = {}) {
  return {
    id: HOTEL_ID,
    owner_id: "u-eval",
    slug: "casa-ceiba",
    nombre: "Casa Ceiba",
    ubicacion: "Calle Río Tampaón 12, Barrio El Mirador, Ciudad Valles, San Luis Potosí",
    descripcion:
      "Hotel boutique de 6 cuartos frente al río, con jardín tropical, alberca al aire libre y desayunos caseros. Ideal para parejas y familias que vienen a conocer la Huasteca.",
    whatsapp: WHATSAPP_CAMILA,
    publicado: true,
    created_at: "2026-01-01T00:00:00Z",
    stripe_account_id: "acct_eval",
    prefijo_confirmacion: "CC",
    fotos: [],
    habitaciones: [
      {
        nombre: "Cabaña Río",
        descripcion: "Cabaña de madera con terraza al río, una cama king y un sofá cama.",
        precio: 2200,
        capacidad: 4,
        cantidad: 2,
        tarifas: [
          { personas: 1, precio: 1800 },
          { personas: 2, precio: 2200 },
          { personas: 3, precio: 2600 },
          { personas: 4, precio: 3000 },
        ],
        camas: [{ tipo: "King", cantidad: 1 }, { tipo: "Sofá cama", cantidad: 1 }],
        features: ["Terraza", "Aire acondicionado", "Cafetera"],
      },
      {
        nombre: "Suite Jardín",
        descripcion: "Suite con jacuzzi privado y vista al jardín. Solo adultos.",
        precio: 2800,
        capacidad: 2,
        cantidad: 1,
        tarifas: [{ personas: 2, precio: 2800 }],
        camas: [{ tipo: "King", cantidad: 1 }],
        features: ["Jacuzzi", "Aire acondicionado"],
      },
      {
        nombre: "Habitación Doble",
        descripcion: "Habitación sencilla y cómoda con dos camas matrimoniales.",
        precio: 1500,
        capacidad: 2,
        cantidad: 3,
        tarifas: [
          { personas: 1, precio: 1200 },
          { personas: 2, precio: 1500 },
        ],
        camas: [{ tipo: "Matrimonial", cantidad: 2 }],
        features: ["Ventilador", "TV"],
      },
    ],
    guia: {
      checkin: "15:00",
      checkout: "12:00",
      wifiRed: "CasaCeiba",
      wifiClave: CLAVE_WIFI,
      recomendaciones: ["Cascada de Tamul (1 h en auto)", "Sótano de las Golondrinas (1.5 h)"],
    },
    config: { bot_lang: "es", bot_enabled: true },
    extras: {
      amenidades: ["pet_friendly", "estacionamiento", "alberca", "wifi"],
      formasPago: ["Tarjeta de crédito/débito", "Transferencia", "Efectivo"],
      idiomas: ["Español", "Inglés"],
      mapsUrl: "https://maps.google.com/?q=Casa+Ceiba+Ciudad+Valles",
      politicas: {
        mascotas: "Aceptamos perros pequeños (hasta 10 kg) con un cargo de $300 por noche. Solo en la Cabaña Río.",
        ninos: "Los niños son bienvenidos en la Cabaña Río y la Habitación Doble. La Suite Jardín es solo para adultos.",
      },
      faqs: [
        { pregunta: "¿Tienen estacionamiento?", respuesta: "Sí, estacionamiento gratuito dentro del hotel para 1 auto por cuarto." },
        { pregunta: "¿El desayuno está incluido?", respuesta: "No está incluido; lo ofrecemos por $250 por persona." },
      ],
      addons: [{ nombre: "Desayuno casero", precio: 250, tipo: "persona" }],
      experiencias: [
        {
          nombre: "Tour a la Cascada de Tamul",
          precio: 900,
          cobro: "persona",
          descripcion: "Salida 8:00 am, incluye transporte y lancha.",
          dias: [0, 3, 6],
        },
      ],
      reglas: {
        anticipoPct: 50,
        anticipoMinNoches: 2,
        minNoches: 1,
        cancelacionDias: 3,
        menoresPagan: over.menoresPagan === true,
        promos: [{ code: "VUELVE10", tipo: "porcentaje", valor: 10, activa: true }],
      },
      temporadas: [
        {
          id: "alta",
          nombre: "Temporada alta",
          desde: F.temporadaDesde,
          hasta: F.temporadaHasta,
          ajuste: { tipo: "porcentaje", valor: 30 },
          minNoches: 2,
        },
      ],
      bot: {
        nombre: "Camila",
        tono: "Cálida, cercana y alegre, como una anfitriona huasteca. Trata de tú.",
        saludo: "¡Hola! Soy Camila de Casa Ceiba 🌿 ¿En qué te ayudo?",
        instrucciones: "Cuando alguien cotice, recomienda el tour a la Cascada de Tamul.",
        escalarWhatsapp: WHATSAPP_PERSONA,
        pago: {
          titular: "Casa Ceiba SA de CV",
          banco: "BBVA",
          clabe: "012180001234567891",
        },
        emojis: { nivel: "bajo" },
      },
    },
  };
}

export type HotelFicticio = ReturnType<typeof hotelFicticio>;
