// Fuente única de lo que cuesta el saldo del bot de WhatsApp.
//
// LA UNIDAD ES EL MENSAJE, NO EL DINERO. El saldo se guarda en enteros
// (`saldo_bot.mensajes`); los pesos viven sólo aquí y en el checkout de Stripe.
// Así no hay decimales que redondear ni deriva de coma flotante en el saldo de
// un cliente.
//
// ── DE DÓNDE SALE EL PRECIO ──────────────────────────────────────────────────
//
// El coste real de una respuesta de Camila es de ANTHROPIC, no de Meta: Kora usa
// `whatsapp-web.js`, no la API oficial de WhatsApp. Medido sobre el prompt de un
// hotel real (10.900 caracteres ≈ 3.114 tokens, cacheados) con Sonnet 5 a
// $2/$10 por millón:
//
//     lectura de caché  $0.0006
//   + historial ~1.500 tokens  $0.0030
//   + respuesta ~250 tokens    $0.0025
//   × ~1,5 llamadas al modelo cuando hay herramienta de por medio
//   ────────────────────────────────
//   ≈ $0.0092 USD por mensaje  ≈ $0.18 MXN
//
// A $0.33 MXN el mensaje son 45 % de margen bruto, ~38 % después de la comisión
// de Stripe. Se descartó anclar al precio de Meta ($0.0085 + 20 % = $0.0102),
// que contra un coste de $0.0092 deja un 3 % después de Stripe: eso no es
// margen, es cubrir coste.

/** Un paquete de recarga. `mxn` es lo que se cobra; `mensajes`, lo que se acredita. */
export interface Paquete {
  mxn: number;
  mensajes: number;
  /** Marcado en la calculadora como el que casi todos eligen. */
  destacado?: boolean;
}

/**
 * Los importes que se pueden cobrar. **Es una lista blanca**: el servidor sólo
 * cobra un importe que esté aquí. Nunca se cobra un número que venga del
 * navegador — es lo que impide que alguien edite el precio en el inspector y
 * compre 3.000 mensajes por un peso.
 */
export const PAQUETES: Paquete[] = [
  { mxn: 100, mensajes: 300 },
  { mxn: 200, mensajes: 600, destacado: true },
  { mxn: 500, mensajes: 1_500 },
  { mxn: 1_000, mensajes: 3_000 },
];

/** El mínimo que se puede recargar. */
export const MINIMO_MXN = PAQUETES[0].mxn;

/** Cuántos mensajes trae cada peso. Sólo para textos («≈ N mensajes»). */
export const MENSAJES_POR_PESO = PAQUETES[0].mensajes / PAQUETES[0].mxn;

/** Cuántos mensajes de regalo lleva un hotel nuevo (y los ya registrados). */
export const REGALO_BIENVENIDA = 300;

/** Por debajo de esto se le avisa al hotelero de que se le está acabando. */
export const UMBRAL_AVISO_BAJO = 60;

export function paquetePorMxn(mxn: unknown): Paquete | null {
  const n = typeof mxn === "number" ? mxn : Number(mxn);
  if (!Number.isFinite(n)) return null;
  return PAQUETES.find((p) => p.mxn === n) ?? null;
}

/** «$100» → «$100 MXN». Un solo sitio para que no bailen los formatos. */
export function pesos(mxn: number): string {
  return `$${mxn.toLocaleString("es-MX")} MXN`;
}

/**
 * Cuántos días le quedan al ritmo que lleva.
 *
 * Devuelve `null` cuando no hay con qué estimar (sin consumo medido), en vez de
 * inventarse un número: decirle a un hotelero «te quedan 3 días» a partir de
 * nada es peor que no decirle nada.
 */
export function diasQueAlcanzan(mensajes: number, consumoDiario: number): number | null {
  if (!Number.isFinite(consumoDiario) || consumoDiario <= 0) return null;
  if (!Number.isFinite(mensajes) || mensajes <= 0) return 0;
  return Math.floor(mensajes / consumoDiario);
}
