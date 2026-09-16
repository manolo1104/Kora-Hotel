// Fuente única de la oferta comercial.

// Mensualidad del plan (el "desde" que se comunica).
export const PRECIO_DESDE = 550;

// Horas que tardó en quedar operando el montaje de Paraíso Encantado.
//
// 🔴 YA NO ES UNA PROMESA COMERCIAL. Hasta el 15 sep 2026 la web vendía «24
// horas de implementación, nosotros lo configuramos». Ese día Manolo decidió
// pasar a autoservicio: el hotelero se registra, lo configura él mismo y le
// ayudamos si quiere (ver `PASOS_ALTA` y `AYUDA_ALTA` abajo). Kora no se
// compromete a configurar cada hotel a mano ni en un plazo, así que ninguna
// superficie de venta debe volver a usar este número como plazo de entrega.
//
// Se conserva SÓLO porque el caso de estudio de Paraíso cuenta lo que tardó su
// montaje (`lib/caso-paraiso.ts`, la página del caso y `CasoTabs`): es un hecho
// de ese caso, no una oferta. Historia: estuvo escrito a mano en ~30 lugares con
// tres valores distintos (48 h, «48 a 72 horas», 72 h) hasta que se fijó en uno
// el 31 ago 2026; `tests/caso-paraiso-congruente.test.ts` sigue vigilando que no
// reaparezcan los otros.
export const IMPLEMENTACION_HORAS = 24;

// Días que el forecast de ocupación del panel mira hacia adelante.
//
// 🔴 ESTE NÚMERO ES UNA PROMESA PÚBLICA. Hasta el 1 sep 2026 el sitio prometía
// 30 días de forecast en DIEZ superficies (portada, precios, características,
// FAQ de ciudades, dos entradas del glosario, personas, llms.txt y dos
// componentes de la landing) mientras el panel calculaba SIETE
// (`lib/admin/insights.ts`). Nadie lo notó porque el 30 estaba escrito a mano en
// cada sitio y el 7 vivía en un `Array.from({ length: 7 })`.
//
// Decisión de Manolo (1 sep 2026): el texto dice la verdad HOY (7 días) y los 30
// se construyen después. Cuando se construyan, este número pasa a 30 y las diez
// superficies se actualizan solas — que es justo el punto de tenerlo aquí.
//
// Quien lo cambie tiene que cambiar también la gráfica del panel: `ForecastBars`
// dibuja una barra por día en un SVG de 480 px y con 30 barras las etiquetas ya
// no caben en móvil. `tests/caso-paraiso-congruente.test.ts` vigila que ningún
// texto vuelva a escribirlo a mano.
export const FORECAST_DIAS = 7;

// ─── La garantía ──────────────────────────────────────────────────────────────
//
// 🔴 EL ANUNCIO Y EL CONTRATO TIENEN QUE DECIR LO MISMO. Hasta el 31 ago 2026 no
// lo decían: /precios prometía la "Garantía Reservas Directas" —«si en 60 días
// no recuperas tu mensualidad en comisiones ahorradas, seguimos trabajando
// gratis hasta lograrlo»— y los Términos §6 decían, literalmente, que «Kora no
// garantiza resultados específicos en ocupación, ingresos o reservas». Una
// promesa publicitaria que el propio contrato niega es publicidad engañosa
// (LFPC art. 32), y encima era incobrable: nada en el panel mide "comisiones
// ahorradas", así que cada reclamación se habría negociado a mano.
//
// Decisión de Manolo (31 ago 2026): se sustituye por la garantía que YA estaba
// en los Términos y sí se puede cumplir. Quien toque este texto tiene que tocar
// también `app/terminos/page.tsx`, y al revés.
export const GARANTIA = {
  titulo: "Sin riesgo para ti",
  /**
   * Días de prueba gratis, antes de pedir ningún dato de pago.
   *
   * DEBE coincidir con `PRUEBA_DIAS` de lib/suscripcion.ts, que es lo que el
   * sistema aplica de verdad. Se quedó en 30 cuando la prueba bajó a 14, y de
   * esta constante cuelgan la caja "Sin riesgo para ti", la tarjeta de
   * garantías, los términos y los ficheros llms.txt: la portada acabó
   * prometiendo 14 y 30 días en la misma pantalla.
   */
  diasPrueba: 14,
  /** Días tras el PRIMER PAGO en los que se devuelve esa mensualidad. */
  diasDevolucion: 30,
} as const;

// ─── El alta: regístrate y pruébalo por dentro ─────────────────────────────────
//
// Decisión de Manolo (15 sep 2026): el botón principal de TODO el sitio es el
// registro, y la promesa es «lo configuras tú y te ayudamos si quieres». WhatsApp
// queda sólo como apoyo («¿Dudas? Escríbenos»).
//
// Las rutas viven aquí para que ningún botón las escriba a mano: el día que el
// alta cambie de sitio, cambia en un solo lugar.

/**
 * La ruta que abre el alta. Sin sesión, la página redirige a
 * `/entrar?registro=1`, que abre el formulario en «Crear cuenta»; con sesión,
 * lleva directo a cargar el hotel.
 */
export const RUTA_REGISTRO = "/panel/onboarding";

/** La ruta para activar el plan de pago (sin sesión, pasa antes por /entrar). */
export const RUTA_ACTIVAR = "/pago/iniciar?plan=kora";

/**
 * Los pasos del alta, tal como funciona el producto HOY. Los usan
 * /como-funciona, la landing y el panel.
 *
 * 🔴 CADA PASO TIENE QUE SER VERDAD. Nada de importar reservas, conectar con
 * Booking o Expedia, ni «nosotros lo configuramos»: no existen. Y ninguna cifra a
 * mano: los días, el precio y la garantía salen de las constantes de arriba, que
 * son las que vigilan las pruebas.
 */
export const PASOS_ALTA: readonly { titulo: string; texto: string }[] = [
  {
    titulo: "Crea tu cuenta",
    texto: `Solo con tu correo y sin tarjeta. Tienes ${GARANTIA.diasPrueba} días gratis para probar Kora con tu propio hotel.`,
  },
  {
    titulo: "Carga tu hotel",
    texto:
      "Escribe el nombre, tus habitaciones y sus tarifas. Las fotos y las reglas de cobro las puedes añadir cuando quieras.",
  },
  {
    titulo: "Pruébalo por dentro",
    texto:
      "Habla con Camila en el chat de prueba con los datos de tu hotel, haz una reserva de prueba en tu motor sin que se cobre nada y recorre el panel.",
  },
  {
    titulo: "Conéctalo",
    texto:
      "Conecta tus cobros con Stripe para recibir el dinero directo en tu cuenta y vincula tu WhatsApp escaneando un código QR.",
  },
  {
    titulo: "Activa tu plan si te convence",
    texto: `$${PRECIO_DESDE.toLocaleString("es-MX")} MXN al mes, sin permanencia. Si cancelas dentro de los ${GARANTIA.diasDevolucion} días siguientes a tu primer pago, te devolvemos esa mensualidad.`,
  },
] as const;

/** El apoyo humano, siempre como opción y nunca como el camino principal. */
export const AYUDA_ALTA =
  "¿Prefieres que te acompañemos? Escríbenos por WhatsApp y te ayudamos a dejarlo listo.";

// ─── Plan de suscripción (fuente única) ───────────────────────────────────────
// Los price IDs de Stripe viven en variables de entorno porque cambian entre
// modo prueba y modo live (se generan con: node scripts/stripe-setup.mjs).
//
// Por ahora hay UN SOLO plan:
//   • Kora ($550/mes) → todo incluido, con habitaciones ilimitadas: motor de
//     reservas directo, PMS, Camila (WhatsApp con IA), dashboard y CRM.
//     (El pricing dinámico queda fuera por ahora.)

export type PlanClave = "kora";

export interface Plan {
  clave: PlanClave;
  nombre: string;
  rango: string;
  precio: number; // MXN al mes
  destacado: boolean;
  priceId: string | undefined; // Stripe price ID (server-only)
}

export const PLANES: Plan[] = [
  {
    clave: "kora",
    nombre: "Plan Kora",
    rango: "Todo incluido · habitaciones ilimitadas",
    precio: PRECIO_DESDE,
    destacado: true,
    priceId: process.env.STRIPE_PRICE_KORA,
  },
];

export function planPorClave(clave: string | null | undefined): Plan | null {
  return PLANES.find((p) => p.clave === clave) ?? null;
}

export function planPorPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANES.find((p) => p.priceId === priceId) ?? null;
}
