// La foto completa del negocio para el fundador. SOLO servidor (service-role).
//
// Una sola función que junta lo que hoy está repartido en cuatro sitios: el CRM
// (leads), /crm/hoteles (bloqueos), el digest diario (que sólo llega por correo
// y no se puede consultar) y la tabla `suscripciones` (que no se veía en ningún
// lado). Sin esto, la pregunta "¿este hotel ya usó el producto o me va a dejar?"
// no se podía contestar sin abrir Supabase a mano.
//
// 15 sep 2026: Manolo pidió que /crm fuera la vista de TODO el negocio. Se suman
// las fuentes que no se miraban (lib/crm/fuentes.ts): todas las cuentas —también
// quien se registró y nunca creó hotel—, el estado real de Camila, los cobros de
// Stripe Connect de verdad, el saldo prepago y las suscripciones como las ve
// Stripe. Con eso salen el MRR real, el embudo de alta y las alertas nuevas.
//
// REGLA HEREDADA DEL DIGEST: el silencio y el cero tienen que verse distintos.
// Cada consulta que falla se registra y la pantalla lo dice; nunca se pinta un 0
// que en realidad significa "no pude leer".
//
// Y una segunda distinción, que es la que hace que la alarma se siga mirando:
// "esta tabla todavía no existe" NO es un fallo. Es un SQL sin correr, y sale
// como nota gris con el archivo que hay que correr. Si eso pintara la banda roja
// de "pantalla incompleta", la banda estaría encendida todos los días y en dos
// semanas nadie la leería — que es exactamente cómo muere un panel de alarmas.
//
// Las cuentas (MRR, embudo, registrados sin hotel, alertas) son funciones PURAS
// exportadas: el digest usa la misma del MRR y tests/crm-operaciones.test.ts las
// fija. `cargarOperaciones` sólo lee y reparte.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import {
  bloqueoDelHotel,
  pruebaDelHotel,
  tienePlanActivo,
  type EstadoSuscripcion,
  type Suscripcion,
} from "@/lib/suscripcion";
import { PRECIO_DESDE, planPorClave } from "@/lib/oferta";
import { DIAS_SIN_RESERVAS_PAGANDO, VENTANA_DIAS, rutaFichaHotel } from "@/lib/crm/types";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { hotelRooms } from "@/lib/booking/rooms";
import { diasExtraSanos, situacionHotel } from "@/lib/crm/acciones";
// Las dos son PURAS y viven en la bandeja porque es quien manda en qué cuenta
// como «pide atención». Se importan para que /crm y /crm/bandeja no puedan
// contar distinto el mismo chat (bandeja.ts sólo importa el cliente de admin:
// no hay ciclo).
import { estadoDelChat, normalizarMensajes } from "@/lib/crm/bandeja";
import {
  cobrosPorHotel,
  estadoCamilaTodos,
  saldosPorHotel,
  suscripcionesStripe,
  todosLosUsuarios,
  type Lectura,
  type SaldoDeHotel,
  type SuscripcionStripe,
  type UsuarioKora,
} from "@/lib/crm/fuentes";

/** Códigos de PostgREST/Postgres para "esa tabla o columna no existe aquí". */
const NO_EXISTE = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);
const SIN_COLUMNA = new Set(["42703", "PGRST204"]);

/** Topes de filas que se traen para agregar en memoria. */
const TOPE_RESERVAS = 5000;
const TOPE_LEADS = 5000;
const TOPE_SUSCRIPTORES = 20000;

/** De cuántas en cuántas se piden (el máximo por respuesta de Supabase). Ver `leerPaginado`. */
const PAGINA = 1000;

const DIA_MS = 86_400_000;

/**
 * Días de prueba a partir de los cuales se avisa de un hotel con el motor en
 * modo prueba. Más corto que el aviso general de prueba: aquí lo que hay que
 * resolver es concreto (terminar Stripe) y se hace en una llamada.
 */
export const DIAS_AVISO_MODO_PRUEBA = 5;

/** Ventana de «se registró hace poco y no creó hotel»: todavía se acuerda de Kora. */
export const HORAS_REGISTRO_RECIENTE = 48;

/**
 * En qué situación está un hotel, en una sola palabra. La regla vive en
 * `situacionHotel` (lib/crm/acciones.ts) para que la ficha, la lista y esta
 * vista no puedan contar distinto.
 *
 * ESTE ORDEN ES EL DE LA IMPLEMENTACIÓN: gana la primera que aplique, y
 * `cancelada` se comprueba ANTES que la prueba (quien canceló su plan sale
 * «cancelada» aunque le queden días de prueba). Antes esta lista ponía
 * `cancelada` al final y el comentario decía que el orden importaba: quien la
 * leyera para escribir otra pantalla contaría distinto.
 * tests/crm-acciones.test.ts fija el orden de verdad.
 */
export type SituacionHotel =
  | "bloqueado" // Kora lo apagó a mano
  | "demo" // hotel de demostración, nunca caduca
  | "moroso" // tuvo plan y el cobro falló
  | "pago" // plan al corriente
  | "cortesia" // acceso regalado
  | "cancelada" // canceló el plan
  | "prueba" // dentro de los días de prueba
  | "prueba_vencida"; // se le acabó y no pagó

export interface ReservasHotel {
  total: number;
  recientes: number; // en la ventana de VENTANA_DIAS
  gmvTotal: number;
  gmvReciente: number;
  ultima: string | null; // ISO de la última reserva
  /** Hechas por un huésped (motor web o Camila) y vivas. Ver `esReservaReal`. */
  reales: number;
}

/**
 * Lo que dice el servidor de Camila, agrupado en lo que le importa al fundador.
 * Los estados crudos salen de agentes/camila/index.js.
 */
export type TipoCamila = "conectada" | "por-vincular" | "caida" | "sin-sitio" | "arrancando" | "otro";

/** Cobros del motor: `null` en HotelOps = no se pudo leer. */
export type CobrosHotelOps = "listos" | "a-medias" | "sin-cuenta";

export interface HotelOps {
  id: string;
  slug: string;
  nombre: string;
  ownerId: string;
  ownerEmail: string | null;
  publicado: boolean;
  createdAt: string | null;
  /** Hotel de demostración (`extras.demo`): no es cliente, no cuenta en el embudo. */
  demo: boolean;
  /** null = no se pudo saber (no se leyó el plan del dueño). Nunca se adivina. */
  situacion: SituacionHotel | null;
  estadoSuscripcion: EstadoSuscripcion | null;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
  avisosDunning: number;
  diasPrueba: number | null; // null si no aplica
  /**
   * La suscripción del dueño como la ve STRIPE. `trialing` = puso tarjeta pero
   * todavía no paga (la tabla `suscripciones` lo guarda como `activa`). null =
   * sin suscripción en Stripe, o Stripe no se pudo leer.
   */
  stripe: { status: string; montoMxn: number | null; trialEnd: string | null } | null;
  /**
   * Si el motor puede cobrar en la cuenta del HOTEL. `a-medias` = empezó su
   * cuenta de Stripe y todavía no cobra: el caso caro, porque antes salía «con
   * Stripe» y el dinero caía en la cuenta de Kora. null = no se pudo leer.
   */
  cobros: CobrosHotelOps | null;
  /** En prueba y sin cobros listos: el motor simula el pago. null = no se sabe. */
  modoPrueba: boolean | null;
  /** null = el servidor de Camila no tiene a este hotel (o no se pudo leer: ver `lecturas.camila`). */
  camila: { status: string; tipo: TipoCamila } | null;
  /** El hotelero apagó a Camila desde su panel. */
  botApagado: boolean;
  /** null = fuera del prepago (≠ saldo 0), o no se pudo leer: ver `lecturas.saldo`. */
  saldo: SaldoDeHotel | null;
  habitacionesConPrecio: number;
  reservas: ReservasHotel;
  /** Días desde que se dio de alta. Para juzgar si "sin reservas" es grave. */
  diasDeVida: number;
}

export interface Alerta {
  id: string;
  severidad: "alta" | "media";
  titulo: string;
  detalle: string;
  /** Adónde se resuelve: la ficha del hotel, la bandeja, los leads… */
  href: string;
  /** Texto del botón, con la acción primero. */
  accion: string;
}

export interface Metricas {
  hoteles: number;
  pago: number;
  /**
   * De los de `pago`, cuántos siguen en la prueba de Stripe (puso tarjeta y no
   * ha pagado nada). La tabla `suscripciones` los guarda como `activa`, así que
   * «N pagando» a secas contradecía al MRR de al lado. 0 si Stripe no se leyó:
   * mira `lecturas.stripe`.
   */
  pagoEnPruebaStripe: number;
  cortesia: number;
  prueba: number;
  pruebaVencida: number;
  morosos: number;
  bloqueados: number;
  canceladas: number;
  /**
   * Hoteles de demostración de Kora. No son clientes y no cuentan en el embudo,
   * pero SÍ están en `hoteles`: sin enseñarlos, el desglose («N pagando · N en
   * prueba…») no sumaba el total de arriba y ese hueco no lo explicaba nada.
   */
  demo: number;
  /** Hoteles cuya situación no se pudo saber (falló la lectura de planes). */
  sinSaber: number;
  sinPublicar: number;
  sinNingunaReserva: number;
  /** null = no se pudo leer si pueden cobrar. */
  modoPrueba: number | null;
  reservasRecientes: number;
  gmvReciente: number;
  reservasTotal: number;
  gmvTotal: number;
  /** null = no se pudieron leer los leads. */
  leadsNuevos: number | null;
  leadsActivos: number | null;
  /** null = no se pudo leer la lista de correo. */
  suscriptoresActivos: number | null;
  suscriptoresNuevos7d: number | null;
  bajas: number | null;
  /** null = no se pudo saber (tabla ausente o consulta rota), NO es cero. */
  chatsEscalados: number | null;
  /** true = sólo cuenta los que nadie ha marcado como atendidos en la bandeja. */
  chatsSinAtender: boolean;
  /** Cuentas de posibles clientes (sin personal de equipo). null = no se pudieron leer. */
  cuentas: number | null;
  registros7d: number | null;
  registros30d: number | null;
  /** Mensajes de Camila gastados en 30 días, sumando los hoteles del prepago. */
  mensajesCamila30d: number | null;
  /** true = la suma de arriba le faltan hoteles que no se pudieron contar. */
  mensajesCamilaIncompleto: boolean;
  hotelesEnPrepago: number | null;
}

/** Qué columnas son de fiar. false = la pantalla dice «no se pudo leer», no «no». */
export interface LecturasOps {
  /**
   * Sin hoteles, todo lo que se cuenta por hotel (situaciones, reservas, modo
   * prueba) sale 0 aunque sí haya: la pantalla tiene que pintar «—». Antes no
   * existía y con la consulta rota la tarjeta decía «0 hoteles, 0 reservas».
   */
  hoteles: boolean;
  suscripciones: boolean;
  reservas: boolean;
  usuarios: boolean;
  equipo: boolean;
  cobros: boolean;
  camila: boolean;
  saldo: boolean;
  stripe: boolean;
}

export interface RegistradoSinHotel {
  id: string;
  email: string | null;
  creado: string;
  correoConfirmado: boolean;
  ultimoAcceso: string | null;
  /** Si ya tiene fila en `suscripciones` (pagó antes de crear su hotel, o cortesía). */
  estadoPlan: EstadoSuscripcion | null;
}

export type IdPasoEmbudo = "registro" | "hotel" | "habitaciones" | "cobros" | "camila" | "reserva" | "pagando";

export interface PasoEmbudo {
  id: IdPasoEmbudo;
  titulo: string;
  /** Cómo se cuenta, en palabras del fundador. */
  criterio: string;
  /** null = no se pudo leer (NUNCA es cero). */
  n: number | null;
  /** Porcentaje respecto al paso anterior. null en el primero o si falta un dato. */
  pct: number | null;
  /** Por qué no hay número, o un aviso sobre el que hay. */
  nota: string | null;
}

export interface Mrr {
  /** 'stripe' = lo que Stripe cobra. 'estimado' = tabla de planes × precio. 'sin-datos' = ninguna de las dos. */
  fuente: "stripe" | "estimado" | "sin-datos";
  /** Pesos al mes. null sólo con 'sin-datos'. */
  mrr: number | null;
  /** Cuentas que pagan hoy (con 'estimado' incluye a quien está en prueba con tarjeta). */
  pagando: number;
  pagandoIds: string[];
  /** Pusieron tarjeta y siguen en prueba de Stripe: NO son ingreso. null = no se sabe ('estimado'). */
  enPruebaConTarjeta: number | null;
  /** Lo que sumarían al MRR cuando se les acabe la prueba. */
  mrrEnPrueba: number | null;
  cortesia: number;
  /** Cobrando en Stripe pero con un monto que no se pudo leer (no en pesos, por ejemplo): no suman. */
  sinMonto: number;
  /** Activas en Stripe con un cliente que no está en la tabla `suscripciones`: no suman. */
  enStripeSinFila: number;
  /**
   * Al revés: `activa` en Kora (la ficha y la tabla dicen «Pagando») pero Stripe
   * no la cobra (cancelada, vencida, o ni siquiera la tiene). Tampoco suman, y
   * sin este número el MRR bajaba sin que nada explicara por qué.
   */
  enKoraSinCobro: number;
  /** Por qué no es de Stripe, cuando no lo es. */
  motivo: string | null;
}

export interface Operaciones {
  metricas: Metricas;
  mrr: Mrr;
  hoteles: HotelOps[];
  alertas: Alerta[];
  embudo: PasoEmbudo[];
  /** Nota que explica cómo leer el embudo. */
  notaEmbudo: string;
  /** null = no se pudo leer (cuentas o equipo): no se muestra una lista a medias. */
  registradosSinHotel: RegistradoSinHotel[] | null;
  lecturas: LecturasOps;
  /** Origen → altas de la lista de correo. Dice QUÉ superficie capta. */
  origenesSuscriptores: { origen: string; n: number }[];
  /** Consultas que fallaron de verdad. Si trae algo, la pantalla NO es de fiar. */
  fallos: string[];
  /** Tablas que aún no existen: falta correr su SQL. No es una avería. */
  pendientes: string[];
  /** true si se alcanzó el tope de reservas y los totales están recortados. */
  reservasRecortadas: boolean;
}

const diasDesde = (iso: string | null | undefined, ahora: number): number =>
  iso ? Math.floor((ahora - Date.parse(iso)) / DIA_MS) : 0;

const plural = (n: number, s = "s") => (n === 1 ? "" : s);

// ─── Piezas puras ────────────────────────────────────────────────────────────

/** El estado crudo del servidor de Camila, agrupado. */
export function tipoCamila(status: string): TipoCamila {
  switch (status) {
    case "ready":
      return "conectada";
    case "qr":
    case "sin-vincular":
      return "por-vincular";
    case "disconnected":
    case "auth_failure":
    case "error":
      return "caida";
    // El hotel está bien: el que no da más es el servidor de Kora. Se separa de
    // «caída» porque lo que hay que hacer es distinto —ahí no sirve pedirle al
    // hotelero que re-escanee nada— y porque es lo que avisa de que hay que
    // ampliar antes de que se caiga alguien.
    case "sin-sitio":
      return "sin-sitio";
    case "starting":
      return "arrancando";
    default:
      return "otro";
  }
}

/** Orígenes que sólo puede escribir un huésped: el motor web y Camila. */
const ORIGENES_HUESPED = new Set(["web", "web-pago-hotel", "bot"]);

/**
 * ¿Esta reserva la hizo un HUÉSPED por el producto? Es lo que dice «Kora ya le
 * trajo una venta», que es distinto de «el hotelero apuntó algo».
 *
 * - Cancelada o reembolsada no cuenta: puede ser el propio hotelero probando
 *   con su tarjeta y devolviéndose el dinero.
 * - `origen` web, web-pago-hotel o bot → sí.
 * - `origen` manual, panel o cotizacion (lo apunta el hotel desde su panel) u
 *   otro cualquiera → no.
 * - Sin `origen` (reservas viejas): se decide por el estado; MANUAL no cuenta.
 */
export function esReservaReal(b: { origen: string | null; estado: string | null }): boolean {
  if (!reservaCuenta(b.estado)) return false;
  const origen = (b.origen ?? "").trim();
  if (origen) return ORIGENES_HUESPED.has(origen);
  return b.estado !== "MANUAL";
}

export interface FilaSuscMrr {
  user_id: string;
  plan: string | null;
  estado: EstadoSuscripcion;
  stripe_customer_id: string | null;
}

function motivoSinStripe(error: string | undefined): string {
  if (error === "sin-stripe") return "este entorno no tiene la llave de Stripe";
  if (error === "recortado") return "Stripe devolvió la lista de suscripciones incompleta";
  return "Stripe no contestó";
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * El MRR, con la misma cuenta en /crm y en el digest diario.
 *
 * Con Stripe legible: suma el monto mensual de las suscripciones en `active`
 * de los clientes que están en la tabla `suscripciones`. Las `trialing` NO
 * suman (puso tarjeta, todavía no paga): se cuentan aparte. La cortesía vale $0.
 * El webhook guarda `trialing` como `activa`, así que contar la tabla a secas
 * inflaba el MRR con gente que no había pagado nada.
 *
 * Sin Stripe: cae a la cuenta de antes (planes `activa` × su precio) y lo dice
 * en `motivo`, porque ese número incluye a quien sigue en prueba con tarjeta.
 *
 * Sólo se suman clientes de la tabla: la cuenta de Stripe podría tener otras
 * suscripciones que no son de Kora. Las activas sin fila se cuentan en
 * `enStripeSinFila` (suele ser un webhook que no llegó).
 *
 * Ojo: `montoMxn` es precio de lista, sin cupones (lib/crm/fuentes.ts).
 */
export function calcularMrr(
  filas: FilaSuscMrr[] | null,
  stripe: Lectura<Map<string, SuscripcionStripe>> | null,
): Mrr {
  const cortesia = (filas ?? []).filter((f) => f.estado === "cortesia").length;

  if (stripe?.ok) {
    let mrr = 0;
    let mrrEnPrueba = 0;
    let enPrueba = 0;
    let sinMonto = 0;
    const pagandoIds: string[] = [];
    const vistos = new Set<string>();

    if (filas) {
      for (const f of filas) {
        const cid = f.stripe_customer_id;
        if (!cid || vistos.has(cid)) continue;
        vistos.add(cid);
        const s = stripe.data.get(cid);
        if (!s) continue;
        if (s.status === "active") {
          pagandoIds.push(f.user_id);
          if (s.montoMxn === null) sinMonto++;
          else mrr += s.montoMxn;
        } else if (s.status === "trialing") {
          enPrueba++;
          mrrEnPrueba += s.montoMxn ?? 0;
        }
      }
    }

    // `activa` en Kora que Stripe no está cobrando: un webhook que no llegó. La
    // tabla del CRM dice «Pagando» y el MRR no la suma; sin contarla aparte, las
    // dos cifras se contradecían sin explicación.
    let enKoraSinCobro = 0;
    for (const f of filas ?? []) {
      if (f.estado !== "activa") continue;
      const s = f.stripe_customer_id ? stripe.data.get(f.stripe_customer_id) : undefined;
      if (!s || (s.status !== "active" && s.status !== "trialing")) enKoraSinCobro++;
    }

    let enStripeSinFila = 0;
    // Sin la tabla no hay forma de separar lo de Kora: se suma todo lo de
    // Stripe y se dice. Con la tabla, lo que sobra sólo se cuenta.
    for (const [cid, s] of stripe.data) {
      if (filas && vistos.has(cid)) continue;
      if (filas) {
        if (s.status === "active") enStripeSinFila++;
        continue;
      }
      if (s.status === "active") {
        pagandoIds.push(cid);
        if (s.montoMxn === null) sinMonto++;
        else mrr += s.montoMxn;
      } else if (s.status === "trialing") {
        enPrueba++;
        mrrEnPrueba += s.montoMxn ?? 0;
      }
    }

    return {
      fuente: "stripe",
      mrr: redondear(mrr),
      pagando: pagandoIds.length,
      pagandoIds: filas ? pagandoIds : [],
      enPruebaConTarjeta: enPrueba,
      mrrEnPrueba: redondear(mrrEnPrueba),
      cortesia,
      sinMonto,
      enStripeSinFila,
      enKoraSinCobro,
      motivo: filas ? null : "no se pudo leer la tabla de planes: se suma todo lo que cobra Stripe",
    };
  }

  const motivo = motivoSinStripe(stripe?.error);
  if (!filas) {
    return {
      fuente: "sin-datos",
      mrr: null,
      pagando: 0,
      pagandoIds: [],
      enPruebaConTarjeta: null,
      mrrEnPrueba: null,
      cortesia: 0,
      sinMonto: 0,
      enStripeSinFila: 0,
      enKoraSinCobro: 0,
      motivo: `${motivo} y no se pudo leer la tabla de planes`,
    };
  }

  // La cuenta de siempre. La cortesía no entra: es ingreso que no existe, y un
  // MRR inflado es la cifra más fácil de creerse y más cara de corregir después.
  const activas = filas.filter((f) => f.estado === "activa");
  return {
    fuente: "estimado",
    mrr: activas.reduce((s, f) => s + (planPorClave(f.plan)?.precio ?? PRECIO_DESDE), 0),
    pagando: activas.length,
    pagandoIds: activas.map((f) => f.user_id),
    enPruebaConTarjeta: null,
    mrrEnPrueba: null,
    cortesia,
    sinMonto: 0,
    enStripeSinFila: 0,
    enKoraSinCobro: 0,
    motivo,
  };
}

/**
 * Quien se registró y no es dueño ni personal de ningún hotel: el lead que hoy
 * no ve nadie (no llega a `crm_leads` ni a ningún aviso). Los más nuevos primero.
 *
 * `personal` son los `user_id` de `hotel_members`. Hay que restarlos: un dueño
 * da de alta a su recepción con una cuenta propia (lib/db/equipo.ts) y esa
 * cuenta no tiene hotel a su nombre, pero no es un lead.
 */
export function registradosSinHotel(
  usuarios: UsuarioKora[],
  duenos: Set<string>,
  personal: Set<string>,
  planes: Map<string, EstadoSuscripcion> = new Map(),
): RegistradoSinHotel[] {
  return usuarios
    .filter((u) => !duenos.has(u.id) && !personal.has(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email,
      creado: u.created_at,
      correoConfirmado: Boolean(u.email_confirmed_at),
      ultimoAcceso: u.last_sign_in_at,
      estadoPlan: planes.get(u.id) ?? null,
    }))
    .sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
}

export interface HotelEmbudo {
  ownerId: string;
  demo: boolean;
  habitacionesConPrecio: number;
  cobrosListos: boolean;
  camilaConectada: boolean;
  reservaReal: boolean;
}

export interface EntradaEmbudo {
  /** null = no se pudieron leer todas las cuentas. */
  usuarios: { id: string }[] | null;
  /** `user_id` de `hotel_members`. null = no se pudo leer. */
  personal: Set<string> | null;
  /** null = no se pudieron leer los hoteles. */
  hoteles: HotelEmbudo[] | null;
  lecturas: { cobros: boolean; camila: boolean; reservas: boolean };
  /** null = no se sabe quién paga. */
  pagando: { ids: string[]; estimado: boolean } | null;
  reservasRecortadas?: boolean;
}

export const NOTA_EMBUDO =
  "Se cuentan cuentas, no hoteles: un dueño pasa un paso si cualquiera de sus hoteles lo cumple. Cada paso cuenta a quien lo tiene hecho HOY, aunque se haya saltado uno anterior (se puede cobrar sin tener a Camila), así que un paso puede tener más que el anterior. Los hoteles demo no cuentan.";

/**
 * El embudo de alta, de la cuenta nueva al plan pagado. PURA.
 *
 * La unidad es la CUENTA (el dueño): el registro es por persona y el plan
 * también, así que contar hoteles en medio mezclaría dos cosas. Cada paso es
 * independiente («lo tiene hecho hoy»), no «llegó sin saltarse nada»: con la
 * versión en cadena, un hotel que cobra y paga pero no vinculó a Camila
 * desaparecería de «pagando», y ese es justo el dato que no se puede esconder.
 */
export function calcularEmbudo(e: EntradaEmbudo): PasoEmbudo[] {
  const reales = e.hoteles?.filter((h) => !h.demo) ?? null;
  const duenosReales = new Set((reales ?? []).map((h) => h.ownerId));
  // Dueños que sólo tienen hoteles demo: son de Kora, no clientes.
  const soloDemo = new Set(
    (e.hoteles ?? []).filter((h) => h.demo && !duenosReales.has(h.ownerId)).map((h) => h.ownerId),
  );
  const todosLosDuenos = new Set((e.hoteles ?? []).map((h) => h.ownerId));

  const cuentasCon = (pasa: (h: HotelEmbudo) => boolean): number | null =>
    reales ? new Set(reales.filter(pasa).map((h) => h.ownerId)).size : null;

  let registrados: number | null = null;
  if (e.usuarios && e.personal && e.hoteles) {
    const personal = e.personal;
    registrados = e.usuarios.filter(
      (u) => !soloDemo.has(u.id) && !(personal.has(u.id) && !todosLosDuenos.has(u.id)),
    ).length;
  }

  const pasos: Omit<PasoEmbudo, "pct">[] = [
    {
      id: "registro",
      titulo: "Se registró",
      criterio:
        "Cuentas creadas en Kora. No cuenta al personal que un dueño da de alta en su equipo ni a las cuentas que sólo tienen hoteles demo.",
      n: registrados,
      nota: registrados === null ? "No se pudieron leer todas las cuentas o el equipo de cada hotel." : null,
    },
    {
      id: "hotel",
      titulo: "Creó su hotel",
      criterio: "Cuentas con al menos un hotel.",
      n: reales ? duenosReales.size : null,
      nota: reales ? null : "No se pudieron leer los hoteles.",
    },
    {
      id: "habitaciones",
      titulo: "Cargó habitaciones",
      criterio:
        "Tiene al menos una habitación con precio. Crear el hotel ya pide una, así que casi siempre coincide con el paso anterior: la diferencia son hoteles que se quedaron sin habitaciones.",
      n: cuentasCon((h) => h.habitacionesConPrecio > 0),
      nota: reales ? null : "No se pudieron leer los hoteles.",
    },
    {
      id: "cobros",
      titulo: "Cobros listos",
      criterio:
        "Su cuenta de Stripe ya puede cobrar; no basta con haberla empezado. Es el último dato que mandó Stripe.",
      n: e.lecturas.cobros ? cuentasCon((h) => h.cobrosListos) : null,
      nota: e.lecturas.cobros ? null : "No se pudo leer qué hoteles pueden cobrar.",
    },
    {
      id: "camila",
      titulo: "Camila vinculada",
      criterio: "El servidor de Camila dice que su WhatsApp está conectado ahora mismo.",
      n: e.lecturas.camila ? cuentasCon((h) => h.camilaConectada) : null,
      nota: e.lecturas.camila ? null : "No se pudo leer el estado de Camila.",
    },
    {
      id: "reserva",
      titulo: "Primera reserva real",
      criterio:
        "Al menos una reserva que hizo un huésped en su página o con Camila, sin cancelar ni devolver. No cuentan las que el hotel apunta a mano desde su panel (manuales o de cotización).",
      n: e.lecturas.reservas ? cuentasCon((h) => h.reservaReal) : null,
      nota: !e.lecturas.reservas
        ? "No se pudieron leer las reservas."
        : e.reservasRecortadas
          ? `Sólo se leyeron las ${TOPE_RESERVAS} reservas más recientes: puede faltar quien sólo vendió antes.`
          : null,
    },
    {
      id: "pagando",
      titulo: "Pagando",
      criterio: e.pagando?.estimado
        ? "Estimado con la tabla de planes porque Stripe no se pudo leer: incluye a quien puso tarjeta y sigue en prueba."
        : "Stripe le cobra el plan ahora mismo. Quien puso tarjeta y sigue en prueba no cuenta.",
      n: e.pagando ? e.pagando.ids.filter((id) => !soloDemo.has(id)).length : null,
      nota: e.pagando ? null : "No se pudo saber quién paga.",
    },
  ];

  return pasos.map((p, i) => {
    const previo = i > 0 ? pasos[i - 1].n : null;
    const pct = i > 0 && p.n !== null && previo !== null && previo > 0 ? Math.round((p.n / previo) * 100) : null;
    return { ...p, pct };
  });
}

export interface EntradaAlertas {
  hoteles: HotelOps[];
  /** null = no se pudieron leer los leads. */
  leads: { etapa: string | null; created_at: string | null }[] | null;
  chatsEscalados: number | null;
  chatsSinAtender: boolean;
  /** null = no se pudo leer. */
  registradosSinHotel: RegistradoSinHotel[] | null;
  /** Sin reservas leídas, «0 reservas» sería un cero falso: esas alertas no salen. */
  lecturas: Pick<LecturasOps, "camila" | "reservas">;
  /**
   * Sólo se leyeron las reservas más recientes. Los totales por hotel están
   * cortados: un hotel que sólo vendió antes del corte sale con 0, y afirmar
   * «no ha usado el producto» sería falso.
   */
  reservasRecortadas?: boolean;
  ahora: number;
}

/**
 * Lo que requiere atención HOY, cada cosa con el botón que lleva a donde se
 * resuelve. PURA. Ordenado por lo que cuesta dinero si no se atiende: primero
 * las altas, y dentro de cada severidad en el orden en que se escriben aquí.
 *
 * Antes sólo la alerta de leads llevaba enlace: las demás decían qué pasaba y
 * dejaban al fundador buscando el hotel a mano.
 */
export function calcularAlertas(e: EntradaAlertas): Alerta[] {
  const { hoteles, ahora } = e;
  const conReservas = e.lecturas.reservas;
  // «Tiene 0 reservas en total» sólo se puede afirmar con TODAS las reservas
  // leídas. Con la lista cortada, un 0 puede ser «vendió antes del corte».
  const conTotales = conReservas && !e.reservasRecortadas;
  const alertas: Alerta[] = [];
  const ficha = (h: HotelOps) => ({ href: rutaFichaHotel(h.slug), accion: "Abrir ficha" });

  for (const h of hoteles.filter((x) => x.situacion === "moroso")) {
    alertas.push({
      id: `moroso-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — el cobro falló`,
      detalle: `${h.avisosDunning} aviso${plural(h.avisosDunning)} de cobro enviado${plural(h.avisosDunning)}. ${h.ownerEmail ?? "sin correo"}. Es un cliente que ya te pagaba.`,
      ...ficha(h),
    });
  }

  // Hoteles que ya salieron con su alerta de prueba: la de «sin estrenar» de más
  // abajo repetiría el mismo hecho («todavía no procesa ninguna reserva») en una
  // segunda tarjeta, con menos severidad y la misma fecha. Es la misma razón por
  // la que el modo prueba va DENTRO de la alerta de prueba y no aparte.
  const yaAvisados = new Set<string>();

  // La prueba a punto de vencer es la única ventana en que la venta está caliente
  // y el hotelero todavía tiene el producto encendido.
  for (const h of hoteles.filter((x) => x.situacion === "prueba" && (x.diasPrueba ?? 99) <= 7)) {
    const dias = h.diasPrueba ?? 0;
    yaAvisados.add(h.id);
    const usoProducto = !conReservas
      ? ""
      : h.reservas.total > 0
        ? ` Ya procesó ${h.reservas.total} reserva${plural(h.reservas.total)}: el producto le funcionó.`
        : conTotales
          ? " Todavía no procesa ninguna reserva."
          : "";

    // Modo prueba: su motor simula el pago porque su Stripe todavía no cobra. Si
    // paga así, el motor vuelve a cobrar de verdad, pero en la cuenta de Kora
    // (app/api/h/[slug]/checkout). Va en la MISMA alerta y no en otra, para no
    // pintar dos veces al mismo hotel con la misma fecha.
    if (h.modoPrueba === true && dias <= DIAS_AVISO_MODO_PRUEBA) {
      alertas.push({
        id: `modo-prueba-${h.id}`,
        severidad: "alta",
        titulo: `${h.nombre} — le queda${plural(dias, "n")} ${dias} día${plural(dias)} y su motor sigue en modo prueba`,
        detalle: `Su cuenta de Stripe todavía no puede cobrar, así que sus reservas se simulan. Si activa su plan así, el dinero de sus reservas caerá en la cuenta de Kora y no en la suya. Ayúdale a terminar Stripe.${usoProducto}`,
        ...ficha(h),
      });
      continue;
    }

    alertas.push({
      id: `prueba-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — le queda${plural(dias, "n")} ${dias} día${plural(dias)} de prueba`,
      detalle: !conReservas
        ? "Es la ventana en que la venta está caliente."
        : h.reservas.total > 0
          ? `${usoProducto.trim()} Es el momento de cerrarlo.`
          : conTotales
            ? "Todavía no procesa ninguna reserva. Si no lo ayudas a estrenarlo, no va a pagar."
            : "Es la ventana en que la venta está caliente.",
      ...ficha(h),
    });
  }

  // Un hotel con acceso vivo que nunca estrenó el producto es una baja anunciada.
  // Se le da una semana de gracia: nadie configura su hotel el primer día.
  for (const h of hoteles.filter(
    (x) =>
      conTotales &&
      !yaAvisados.has(x.id) &&
      x.reservas.total === 0 &&
      x.diasDeVida >= 7 &&
      (x.situacion === "pago" || x.situacion === "cortesia" || x.situacion === "prueba"),
  )) {
    alertas.push({
      id: `sin-estrenar-${h.id}`,
      severidad: h.situacion === "pago" ? "alta" : "media",
      titulo: `${h.nombre} — ${h.diasDeVida} días sin una sola reserva`,
      detalle:
        h.situacion === "pago"
          ? "Está PAGANDO y no ha usado el producto. Es la baja más probable de tu lista."
          : "Nunca lo estrenó. Sin una primera reserva no hay nada que renovar.",
      ...ficha(h),
    });
  }

  // Paga, vendía, y dejó de vender. La alerta de arriba sólo ve «0 en total».
  for (const h of hoteles.filter(
    (x) => conReservas && x.situacion === "pago" && x.reservas.total > 0 && x.reservas.ultima,
  )) {
    const d = diasDesde(h.reservas.ultima, ahora);
    if (d < DIAS_SIN_RESERVAS_PAGANDO) continue;
    alertas.push({
      id: `sin-ventas-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — ${d} días sin reservas`,
      detalle: `Paga su plan y ya vendía (${h.reservas.total} reserva${plural(h.reservas.total)} en total), pero la última fue hace ${d} días. Pregúntale qué cambió: es la señal más temprana de una baja.`,
      ...ficha(h),
    });
  }

  // Camila, sólo en quien paga o tiene cortesía: es parte de lo que se le vende.
  // Si el hotelero la apagó o despublicó, fue decisión suya (o ya hay otra
  // alerta), no una caída.
  if (e.lecturas.camila) {
    for (const h of hoteles.filter(
      (x) => (x.situacion === "pago" || x.situacion === "cortesia") && x.publicado && !x.botApagado,
    )) {
      const quien = h.situacion === "pago" ? "Paga su plan" : "Tiene cortesía";
      if (!h.camila) {
        alertas.push({
          id: `camila-fuera-${h.id}`,
          severidad: "media",
          titulo: `${h.nombre} — Camila no está en el servidor`,
          detalle: `${quien}, está publicado y no apagó a Camila, pero el servidor de Camila no lo tiene. Si sigue igual al recargar más tarde, revisa su ficha.`,
          ...ficha(h),
        });
      } else if (h.camila.tipo === "caida") {
        alertas.push({
          id: `camila-caida-${h.id}`,
          severidad: "alta",
          titulo: `${h.nombre} — Camila está caída`,
          detalle: `${quien} y Camila no está contestando su WhatsApp: se desconectó o WhatsApp rechazó la sesión. Hay que volver a vincularla.`,
          ...ficha(h),
        });
      } else if (h.camila.tipo === "sin-sitio") {
        // La que avisa ANTES de perder a un cliente. El 21 sep 2026 esto no
        // existía: el contenedor llegó a su tope de procesos y el hotel que
        // paga se quedó sin Camila durante horas sin que nadie se enterara.
        alertas.push({
          id: `camila-sin-sitio-${h.id}`,
          severidad: "alta",
          titulo: `${h.nombre} — no cabe en el servidor de Camila`,
          detalle:
            `${quien}, pero el servidor de Camila está al tope y no puede abrirle su conexión. ` +
            `No es cosa del hotel: no hay nada que él pueda hacer. Hay que hacerle sitio (desconectar un hotel ` +
            `inactivo) o ampliar el servidor.`,
          ...ficha(h),
        });
      } else if (h.camila.tipo === "por-vincular") {
        alertas.push({
          id: `camila-sin-vincular-${h.id}`,
          severidad: "media",
          titulo: `${h.nombre} — Camila sin vincular`,
          detalle: `${quien} y su WhatsApp no está vinculado, así que Camila no le contesta a nadie. Ayúdale a escanear el código desde su panel.`,
          ...ficha(h),
        });
      }
    }
  }

  for (const h of hoteles.filter((x) => !x.publicado && !x.demo && x.diasDeVida >= 7)) {
    alertas.push({
      id: `sin-publicar-${h.id}`,
      severidad: "media",
      titulo: `${h.nombre} — sigue sin publicar`,
      detalle: `Lleva ${h.diasDeVida} días dado de alta. Sin publicar no puede cobrar ni una reserva.`,
      ...ficha(h),
    });
  }

  for (const h of hoteles.filter((x) => x.cancelaAlFinal)) {
    alertas.push({
      id: `cancela-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — pidió cancelar al final del periodo`,
      detalle: `Sigue activo hasta ${h.periodoFin ? h.periodoFin.slice(0, 10) : "el fin del periodo"}. Todavía se puede recuperar.`,
      ...ficha(h),
    });
  }

  // Se registró hace nada y no creó su hotel: todavía se acuerda de Kora. Una
  // sola alerta con todos, no una por cuenta, para no tapar lo de los hoteles.
  if (e.registradosSinHotel) {
    const desde = ahora - HORAS_REGISTRO_RECIENTE * 3_600_000;
    const nuevos = e.registradosSinHotel.filter((r) => Date.parse(r.creado) >= desde);
    if (nuevos.length) {
      const uno = nuevos.length === 1;
      const correos = nuevos
        .map((r) => r.email)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");
      alertas.push({
        id: "registrados-sin-hotel",
        severidad: "media",
        titulo: `${nuevos.length} cuenta${plural(nuevos.length)} nueva${plural(nuevos.length)} sin hotel en las últimas ${HORAS_REGISTRO_RECIENTE} horas`,
        // Concordancia en los dos números: antes el plural decía «Se registraron
        // y no llegó a crear su hotel. Escríbele».
        detalle: uno
          ? `Se registró y no llegó a crear su hotel${correos ? `: ${correos}` : ""}. Escríbele hoy, mientras todavía se acuerda de Kora.`
          : `Se registraron y no llegaron a crear su hotel${correos ? `: ${correos}${nuevos.length > 3 ? "…" : ""}` : ""}. Escríbeles hoy, mientras todavía se acuerdan de Kora.`,
        href: "#registrados-sin-hotel",
        accion: "Ver la lista",
      });
    }
  }

  if (e.leads) {
    const leadsViejos = e.leads.filter((l) => l.etapa === "nuevo" && diasDesde(l.created_at, ahora) >= 3);
    if (leadsViejos.length) {
      alertas.push({
        id: "leads-frios",
        severidad: "media",
        titulo: `${leadsViejos.length} lead${plural(leadsViejos.length)} sin contactar hace 3 días o más`,
        detalle: "Un lead que pidió información y nadie le escribió en tres días ya se enfrió.",
        href: "/crm/leads",
        accion: "Ver leads",
      });
    }
  }

  if (e.chatsEscalados && e.chatsEscalados > 0) {
    const n = e.chatsEscalados;
    alertas.push({
      id: "chats",
      severidad: "media",
      titulo: `${n} chat${plural(n)} de soporte escalado${plural(n)}${e.chatsSinAtender ? " por atender" : ""}`,
      detalle: "El bot no pudo resolverlos en los últimos 7 días.",
      // CON `?pestana=chats`: la bandeja sólo abre sola en los chats cuando no
      // hay ninguna alerta pendiente, así que con una sola alerta viva el clic
      // aterrizaba en «Alertas» y el fundador no veía los chats que fue a buscar.
      href: "/crm/bandeja?pestana=chats",
      accion: "Abrir bandeja",
    });
  }

  const orden = { alta: 0, media: 1 };
  // `sort` es estable: dentro de cada severidad se respeta el orden de arriba.
  return alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad]);
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

interface FilaHotel {
  id: string;
  slug: string;
  nombre: string;
  owner_id: string;
  publicado: boolean | null;
  extras: Record<string, unknown> | null;
  created_at: string | null;
  habitaciones: unknown;
  bot_enabled: unknown;
}

interface FilaSusc {
  user_id: string;
  plan: string | null;
  estado: EstadoSuscripcion;
  periodo_fin: string | null;
  cancela_al_final: boolean | null;
  avisos_dunning: number | null;
  stripe_customer_id: string | null;
}

interface FilaLead {
  id: string;
  etapa: string | null;
  created_at: string | null;
}

interface FilaSuscriptor {
  id: string;
  origen: string | null;
  baja_at: string | null;
  created_at: string | null;
}

interface FilaBooking {
  id: string;
  hotel_id: string;
  total: number | null;
  estado: string | null;
  origen: string | null;
  created_at: string | null;
}

type ErrorPg = { code?: string; message?: string } | null;

/**
 * Falta la TABLA entera (no una columna). Sólo esto permite leer «no hay filas»:
 * una columna ausente en `suscripciones` no dice que nadie pague, y tratarla
 * como tabla vacía pintaría a todos los hoteles de pago como «en prueba».
 */
function tablaAusente(error: ErrorPg): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

type RespuestaPagina = { data: unknown[] | null; error: unknown; count?: number | null };

/**
 * Lee una consulta de página en página hasta `tope` filas.
 *
 * Supabase corta cada respuesta en su máximo de filas (1000 por defecto) SIN
 * decir nada. Antes las reservas se pedían con un `limit(5000)` de una vez: la
 * base devolvía 1000, y el aviso de «recortadas», que comparaba con 5000, nunca
 * se encendía. Lo mismo la lista de correo (`limit(5000)`) y los leads.
 *
 * `recortadas` se decide con el `count` exacto de la primera página y no con
 * «llegué al tope»: si el máximo del servidor fuera menor que la página, el lote
 * corto parecería el final y los totales saldrían cortados sin aviso. Un fallo a
 * medio camino es un fallo: no se devuelven filas a medias.
 *
 * `pedir` tiene que ordenar con un desempate único (el `id`): con sólo
 * `created_at`, dos filas del mismo instante podían repetirse o saltarse entre
 * una página y la siguiente.
 */
async function leerPaginado<T extends { id: string }>(
  pedir: (desde: number, hasta: number, contar: boolean) => PromiseLike<RespuestaPagina>,
  tope: number,
): Promise<{ filas: T[]; error: ErrorPg; recortadas: boolean }> {
  const filas: T[] = [];
  // Una reserva que entra MIENTRAS se pagina se pone la primera (orden por
  // fecha descendente) y empuja una fila de la página ya leída a la siguiente:
  // sin esto, esa fila se contaba dos veces.
  const vistos = new Set<string>();
  let total: number | null = null;
  try {
    for (let desde = 0; desde < tope; desde += PAGINA) {
      const hasta = Math.min(desde + PAGINA, tope) - 1;
      const r = await pedir(desde, hasta, desde === 0);
      if (r.error) return { filas: [], error: r.error as ErrorPg, recortadas: false };
      if (desde === 0 && typeof r.count === "number") total = r.count;
      const lote = (r.data ?? []) as T[];
      for (const f of lote) {
        if (vistos.has(f.id)) continue;
        vistos.add(f.id);
        filas.push(f);
      }
      if (lote.length < hasta - desde + 1) break;
    }
    const recortadas = total !== null ? total > filas.length : filas.length >= tope;
    return { filas, error: null, recortadas };
  } catch (e) {
    return { filas: [], error: { message: e instanceof Error ? e.message : String(e) }, recortadas: false };
  }
}

type LecturaPruebas =
  | { estado: "ok"; mapa: Map<string, { inicio: string; diasExtra: number }>; faltaTabla: boolean }
  | { estado: "error" };

/** Una fila por dueño: con 20 000 se cubre cualquier tamaño que tenga sentido aquí. */
const TOPE_PRUEBAS = 20_000;

/**
 * El ancla y los días extra de TODOS los dueños, SIN tragarse el error.
 *
 * `anclasPruebaDeDuenos` (lib/db/prueba-dueno.ts) devuelve el mapa VACÍO cuando
 * la lectura falla, sin decirlo, y eso aquí era un cero falso de los caros: sin
 * ancla, la prueba de cada hotel se recalculaba desde su `created_at`, y como
 * casi todos los hoteles son más viejos que su prueba, TODO hotel sin plan salía
 * «prueba vencida» en /crm. De ahí salen las alertas y el desglose de la tarjeta
 * de Hoteles. Es la misma función que `leerPruebasDeTodos` de lib/crm/ficha.ts,
 * que es como la lista de hoteles ya lo evitaba: un fallo es un fallo, y la
 * situación de ese hotel queda «sin saber».
 *
 * Se lee la tabla entera (una fila por dueño) en vez de `.in(ids)`: con cientos
 * de dueños la lista de ids no cabe en la URL.
 */
async function leerPruebasDeDuenos(
  admin: ReturnType<typeof createAdminClient>,
): Promise<LecturaPruebas> {
  const mapa = new Map<string, { inicio: string; diasExtra: number }>();
  type Fila = { user_id: string; inicio: string | null; dias_extra?: unknown };

  const leer = async (columnas: string): Promise<{ filas: Fila[]; error: ErrorPg; recortadas: boolean }> => {
    const filas: Fila[] = [];
    let total: number | null = null;
    try {
      for (let desde = 0; desde < TOPE_PRUEBAS; desde += PAGINA) {
        const hasta = Math.min(desde + PAGINA, TOPE_PRUEBAS) - 1;
        const r = await admin
          .from("pruebas")
          .select(columnas, desde === 0 ? { count: "exact" as const } : undefined)
          .order("user_id", { ascending: true })
          .range(desde, hasta);
        if (r.error) return { filas: [], error: r.error as ErrorPg, recortadas: false };
        if (desde === 0 && typeof r.count === "number") total = r.count;
        const lote = (r.data ?? []) as unknown as Fila[];
        filas.push(...lote);
        if (lote.length < hasta - desde + 1) break;
      }
      return { filas, error: null, recortadas: total !== null ? total > filas.length : filas.length >= TOPE_PRUEBAS };
    } catch (e) {
      return { filas: [], error: { message: e instanceof Error ? e.message : String(e) }, recortadas: false };
    }
  };

  let r = await leer("user_id, inicio, dias_extra");
  // Falta `dias_extra` (sql/kora-crm-mando.sql sin correr): se lee sin ella y los
  // días extra valen 0, que es lo que valían antes de existir la columna.
  const sinDiasExtra =
    Boolean(r.error?.code && SIN_COLUMNA.has(r.error.code)) || (r.error?.message ?? "").includes("dias_extra");
  if (r.error && sinDiasExtra && !tablaAusente(r.error)) r = await leer("user_id, inicio");

  if (r.error) {
    if (tablaAusente(r.error)) return { estado: "ok", mapa, faltaTabla: true };
    console.error("[operaciones] no se pudieron leer las pruebas de los dueños:", r.error.message);
    return { estado: "error" };
  }
  // Recortada = no leída: al dueño que quedó fuera se le recalcularía la prueba
  // desde el alta de su hotel, que es justo el número falso que esto evita.
  if (r.recortadas) return { estado: "error" };
  for (const f of r.filas) {
    if (f?.user_id && f?.inicio) mapa.set(f.user_id, { inicio: f.inicio, diasExtra: diasExtraSanos(f.dias_extra) });
  }
  return { estado: "ok", mapa, faltaTabla: false };
}

/**
 * Cuántas filas de chats se miran para contar los que piden atención.
 *
 * Es el doble del tope de la bandeja (`CHATS_MAX` = 100) A PROPÓSITO, y no el
 * mismo: aquí se miran sólo los 7 últimos días y allí toda la vida del chat, así
 * que el mismo número no significaría lo mismo. Con este margen, la cifra de
 * /crm no se queda corta antes que la lista que la explica. Es una cifra de
 * pantalla, no un informe: leer el jsonb de los mensajes de miles de filas para
 * contar no lo vale.
 */
const CHATS_TOPE = 200;

/**
 * Chats de soporte de 7 días que PIDEN ATENCIÓN, contados con la MISMA regla que
 * /crm/bandeja (`estadoDelChat`): sin atender, o atendidos y el visitante volvió
 * a escribir después.
 *
 * Antes se contaba con `escalado = true AND atendido_at is null`, y eso dejaba
 * fuera al que vuelve a escribir tras ser atendido: la bandeja lo pinta en rojo
 * («Volvió a escribir») y esta pantalla decía 0. Dos números distintos del mismo
 * hecho, y el que se mira primero era el que decía que no pasaba nada.
 *
 * El `or(escalado, atendido_at not null)` es el de la bandeja: cubre los chats
 * cuya marca de escalada pisó la versión vieja de app/api/soporte/route.ts, que
 * la reescribía en cada turno.
 *
 * Se comparan los `ts` de los MENSAJES y no `updated_at`, porque el trigger
 * `soporte_touch` mueve `updated_at` también cuando el CRM escribe `atendido_at`:
 * con `updated_at` todo chat recién atendido contaría como «volvió» al instante.
 */
async function leerChatsEscalados(
  admin: ReturnType<typeof createAdminClient>,
  desde7: string,
): Promise<{ n: number | null; sinAtender: boolean; error: ErrorPg }> {
  const base = (columnas: string, conAtendido: boolean) => {
    const q = admin.from("soporte_conversaciones").select(columnas);
    return (conAtendido ? q.or("escalado.eq.true,atendido_at.not.is.null") : q.eq("escalado", true))
      .gte("updated_at", desde7)
      .order("updated_at", { ascending: false })
      .limit(CHATS_TOPE);
  };
  try {
    let r = await base("id, mensajes, atendido_at", true);
    let conAtendido = true;
    if (r.error) {
      const e = r.error as ErrorPg;
      const faltaColumna =
        !tablaAusente(e) &&
        (Boolean(e?.code && SIN_COLUMNA.has(e.code)) || (e?.message ?? "").includes("atendido_at"));
      // Sin `atendido_at` (bloque E de sql/kora-crm-mando.sql sin correr) no se
      // puede marcar nada: se cuentan todos los escalados, como antes.
      if (!faltaColumna) return { n: null, sinAtender: false, error: e };
      conAtendido = false;
      r = await base("id, mensajes", false);
    }
    if (r.error) return { n: null, sinAtender: false, error: r.error as ErrorPg };

    // `as unknown as`: con las columnas en una variable, postgrest-js tipa las
    // filas como `GenericStringError[]` (misma razón que lib/crm/bandeja.ts).
    const filas = (r.data ?? []) as unknown as Array<{ atendido_at?: string | null; mensajes?: unknown }>;
    if (!conAtendido) return { n: filas.length, sinAtender: false, error: null };
    const n = filas.filter(
      (f) => estadoDelChat(f.atendido_at ?? null, normalizarMensajes(f.mensajes)) !== "atendido",
    ).length;
    return { n, sinAtender: true, error: null };
  } catch (e) {
    return { n: null, sinAtender: false, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export async function cargarOperaciones(): Promise<Operaciones> {
  const fallos: string[] = [];
  const pendientes: string[] = [];
  const lecturas: LecturasOps = {
    hoteles: false,
    suscripciones: false,
    reservas: false,
    usuarios: false,
    equipo: false,
    cobros: false,
    camila: false,
    saldo: false,
    stripe: false,
  };

  if (!adminEnvReady) {
    fallos.push("No hay conexión a la base de datos (falta SUPABASE_SERVICE_ROLE_KEY).");
    const embudo = calcularEmbudo({
      usuarios: null,
      personal: null,
      hoteles: null,
      lecturas: { cobros: false, camila: false, reservas: false },
      pagando: null,
    });
    return {
      metricas: {
        hoteles: 0, pago: 0, pagoEnPruebaStripe: 0, cortesia: 0, prueba: 0, pruebaVencida: 0, morosos: 0,
        bloqueados: 0, canceladas: 0, demo: 0, sinSaber: 0, sinPublicar: 0, sinNingunaReserva: 0,
        modoPrueba: null, reservasRecientes: 0, gmvReciente: 0, reservasTotal: 0, gmvTotal: 0,
        leadsNuevos: null, leadsActivos: null, suscriptoresActivos: null,
        suscriptoresNuevos7d: null, bajas: null, chatsEscalados: null, chatsSinAtender: false,
        cuentas: null, registros7d: null, registros30d: null, mensajesCamila30d: null,
        mensajesCamilaIncompleto: false, hotelesEnPrepago: null,
      },
      mrr: calcularMrr(null, null),
      hoteles: [],
      alertas: [],
      embudo,
      notaEmbudo: NOTA_EMBUDO,
      registradosSinHotel: null,
      lecturas,
      origenesSuscriptores: [],
      fallos,
      pendientes,
      reservasRecortadas: false,
    };
  }

  const admin = createAdminClient();
  const ahora = Date.now();
  const desdeVentana = new Date(ahora - VENTANA_DIAS * DIA_MS).toISOString();
  const desde7 = new Date(ahora - 7 * DIA_MS).toISOString();

  const [
    rHoteles,
    rSusc,
    reservasLeidas,
    rLeads,
    rSuscriptores,
    chats,
    rPruebas,
    rMiembros,
    usuarios,
    cobros,
    camila,
    saldos,
    stripe,
  ] = await Promise.all([
    admin
      .from("hoteles")
      // Sólo `bot_enabled` de `config`: el objeto entero trae el entrenamiento
      // de Camila de cada hotel y aquí no se usa.
      .select("id, slug, nombre, owner_id, publicado, extras, created_at, habitaciones, bot_enabled:config->bot_enabled")
      .order("created_at", { ascending: true }),
    admin
      .from("suscripciones")
      .select("user_id, plan, estado, periodo_fin, cancela_al_final, avisos_dunning, stripe_customer_id"),
    leerPaginado<FilaBooking>(
      (desde, hasta, contar) =>
        admin
          .from("bookings")
          .select("id, hotel_id, total, estado, origen, created_at", contar ? { count: "exact" as const } : undefined)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(desde, hasta),
      TOPE_RESERVAS,
    ),
    leerPaginado<FilaLead>(
      (desde, hasta, contar) =>
        admin
          .from("crm_leads")
          .select("id, etapa, created_at", contar ? { count: "exact" as const } : undefined)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(desde, hasta),
      TOPE_LEADS,
    ),
    leerPaginado<FilaSuscriptor>(
      (desde, hasta, contar) =>
        admin
          .from("suscriptores")
          .select("id, origen, baja_at, created_at", contar ? { count: "exact" as const } : undefined)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(desde, hasta),
      TOPE_SUSCRIPTORES,
    ),
    leerChatsEscalados(admin, desde7),
    leerPruebasDeDuenos(admin),
    admin.from("hotel_members").select("user_id", { count: "exact" }),
    todosLosUsuarios(),
    cobrosPorHotel(),
    estadoCamilaTodos(),
    saldosPorHotel(),
    suscripcionesStripe(),
  ]);

  // Cada consulta cae en uno de tres cajones: bien, tabla-sin-crear (nota gris
  // con el SQL que falta) o rota de verdad (banda roja).
  for (const [nombre, error, sql] of [
    ["los hoteles", rHoteles.error, "sql/kora-fase4-schema.sql"],
    ["las suscripciones", rSusc.error, "sql/kora-suscripciones-schema.sql"],
    ["las reservas", reservasLeidas.error, "sql/kora-multitenant-fase0.sql"],
    ["los leads", rLeads.error, "sql/kora-crm-schema.sql"],
    ["la lista de correo", rSuscriptores.error, "sql/kora-suscriptores.sql"],
    ["los chats de soporte", chats.error, "sql/kora-soporte-schema.sql"],
  ] as const) {
    if (!error) continue;
    const code = (error as { code?: string }).code;
    if (code && NO_EXISTE.has(code)) {
      pendientes.push(`Falta correr ${sql}: por eso no se ven ${nombre}.`);
    } else {
      console.error(`[operaciones] no se pudo leer ${nombre}:`, (error as { message?: string }).message);
      fallos.push(`No se pudieron leer ${nombre}.`);
    }
  }

  // Sin la tabla de suscripciones nadie puede tener plan: eso sí es un dato. Una
  // consulta rota, no: ahí la situación de cada hotel queda «sin saber».
  lecturas.hoteles = !rHoteles.error;
  lecturas.suscripciones = !rSusc.error || tablaAusente(rSusc.error);
  lecturas.reservas = !reservasLeidas.error;

  const filasHotel = rHoteles.error ? null : ((rHoteles.data ?? []) as FilaHotel[]);
  const filasSusc = lecturas.suscripciones ? ((rSusc.data ?? []) as FilaSusc[]) : null;
  const filasBooking = reservasLeidas.filas;
  const reservasRecortadas = lecturas.reservas && reservasLeidas.recortadas;
  if (reservasRecortadas) {
    fallos.push(
      `Sólo se leyeron las ${filasBooking.length} reservas más recientes: los totales históricos están recortados.`,
    );
  }

  // Sin las anclas de la prueba, todo hotel sin plan saldría «prueba vencida»
  // (se recalcularía desde el alta de su hotel). Se dice y su situación queda
  // «sin saber», que es lo que enseña el desglose de la tarjeta de Hoteles.
  if (rPruebas.estado === "error") {
    fallos.push("No se pudo leer cuándo empezó la prueba de cada dueño: los que no tienen plan salen sin situación.");
  } else if (rPruebas.faltaTabla) {
    pendientes.push("Falta correr sql/kora-prueba-por-dueno.sql: la prueba se cuenta desde el alta de cada hotel.");
  }

  // ── Las fuentes nuevas: cada una dice si falló ────────────────────────────
  lecturas.usuarios = usuarios.ok;
  if (!usuarios.ok) {
    fallos.push(
      "No se pudieron leer todas las cuentas: los registros, el embudo y la lista de registrados sin hotel no se muestran.",
    );
  }

  const miembrosRecortados =
    !rMiembros.error && typeof rMiembros.count === "number" && rMiembros.count > (rMiembros.data ?? []).length;
  lecturas.equipo = !rMiembros.error && !miembrosRecortados;
  if (rMiembros.error) {
    if (tablaAusente(rMiembros.error)) {
      pendientes.push(
        "Falta correr sql/kora-multitenant-fase0.sql: sin el equipo de cada hotel no se puede separar al personal de los registrados.",
      );
    } else {
      console.error("[operaciones] no se pudo leer el equipo de los hoteles:", rMiembros.error.message);
      fallos.push("No se pudo leer el equipo de los hoteles: la lista de registrados sin hotel no se muestra.");
    }
  } else if (miembrosRecortados) {
    fallos.push("La lista del equipo de los hoteles vino recortada: la lista de registrados sin hotel no se muestra.");
  }

  lecturas.cobros = cobros.ok;
  if (!cobros.ok) {
    if (cobros.error === "falta-sql") {
      pendientes.push("Falta correr sql/kora-pagos-fase3.sql: sin él no se sabe qué hotel puede cobrar.");
    } else {
      fallos.push("No se pudo leer qué hoteles pueden cobrar con Stripe.");
    }
  }

  lecturas.camila = camila.ok;
  if (!camila.ok) {
    if (camila.error === "sin-runtime") {
      pendientes.push("Este entorno no tiene configurado el servidor de Camila: no se ve su estado.");
    } else if (camila.error === "sin-respuesta") {
      fallos.push("El servidor de Camila no contestó a tiempo: no se ve su estado.");
    } else {
      fallos.push("El servidor de Camila contestó con un error: no se ve su estado.");
    }
  }

  const consumoIncompleto = !saldos.ok && (saldos.error ?? "").startsWith("consumo-incompleto");
  lecturas.saldo = saldos.ok || consumoIncompleto;
  if (!saldos.ok) {
    if (saldos.error === "falta-sql") {
      pendientes.push("Falta correr sql/kora-saldo-bot.sql: todavía no hay prepago de Camila.");
    } else if (consumoIncompleto) {
      fallos.push("No se pudo contar el consumo de Camila de algunos hoteles: la cifra de mensajes está incompleta.");
    } else {
      fallos.push("No se pudo leer el saldo de Camila.");
    }
  }

  lecturas.stripe = stripe.ok;
  if (!stripe.ok) {
    if (stripe.error === "sin-stripe") {
      pendientes.push("Este entorno no tiene la llave de Stripe: el MRR es estimado.");
    } else {
      fallos.push(
        `No se pudo leer Stripe (${motivoSinStripe(stripe.error)}): el MRR es estimado y cuenta como pagando a quien sigue en prueba con tarjeta.`,
      );
    }
  }

  // ── Reservas agregadas por hotel ──────────────────────────────────────────
  // Una CANCELADA no es venta y una REEMBOLSADA se devolvió: ninguna suma al
  // volumen. Sí cuentan como "este hotel movió el producto", que es lo que
  // responde la pregunta de si lo activó.
  const porHotel = new Map<string, ReservasHotel>();
  for (const b of filasBooking) {
    if (!b.hotel_id) continue;
    const acc = porHotel.get(b.hotel_id) ?? {
      total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null, reales: 0,
    };
    const vale = reservaCuenta(b.estado);
    const monto = vale ? Number(b.total ?? 0) : 0;
    const reciente = Boolean(b.created_at && b.created_at >= desdeVentana);

    acc.total++;
    acc.gmvTotal += monto;
    if (esReservaReal(b)) acc.reales++;
    if (reciente) {
      acc.recientes++;
      acc.gmvReciente += monto;
    }
    // La consulta viene ordenada por created_at desc, así que la primera que se
    // ve de cada hotel es la más reciente.
    if (!acc.ultima && b.created_at) acc.ultima = b.created_at;
    porHotel.set(b.hotel_id, acc);
  }

  const suscPorDueno = new Map((filasSusc ?? []).map((s) => [s.user_id, s]));
  const correos = new Map(usuarios.data.map((u) => [u.id, u.email]));
  const anclasPrueba = rPruebas.estado === "ok" ? rPruebas.mapa : null;

  // ── Un hotel a la vez ─────────────────────────────────────────────────────
  const hoteles: HotelOps[] = (filasHotel ?? []).map((h) => {
    const extras = h.extras ?? {};
    const demo = (extras as { demo?: boolean }).demo === true;
    const bloqueo = bloqueoDelHotel(extras);
    const sub = suscPorDueno.get(h.owner_id) ?? null;
    const ancla = anclasPrueba?.get(h.owner_id);
    // Sin las anclas NO se calcula la prueba: con el `created_at` a secas saldría
    // un número de días que no es el suyo (ver `leerPruebasDeDuenos`).
    const prueba = anclasPrueba
      ? pruebaDelHotel({ created_at: h.created_at, extras }, ancla?.inicio ?? null, ancla?.diasExtra ?? 0)
      : null;

    const situacion = situacionHotel({
      bloqueado: Boolean(bloqueo),
      demo,
      suscripcionLeida: lecturas.suscripciones,
      estado: sub?.estado ?? null,
      // `pruebaDelHotel` sólo devuelve null con un demo, que ya decidió arriba;
      // el null de aquí es «no se pudieron leer las anclas» y deja la situación
      // sin saber en vez de inventarle una prueba vencida.
      pruebaVencida: anclasPrueba ? (prueba ? prueba.vencida : true) : null,
    });

    const c = cobros.data.get(h.id);
    const estadoCobros: CobrosHotelOps | null = !lecturas.cobros
      ? null
      : c?.chargesEnabled
        ? "listos"
        : c?.accountId
          ? "a-medias"
          : "sin-cuenta";

    // La misma regla que `decidirModoPrueba` (lib/motor/modo-prueba.ts), con lo
    // que ya está leído: sin plan activo, prueba vigente, sin cobros listos. Con
    // una diferencia que hay que saber: aquí «cobros listos» sale del caché, y el
    // checkout consulta a Stripe en vivo si el caché tiene más de un día.
    const planActivo = tienePlanActivo(sub as unknown as Suscripcion | null);
    const modoPrueba =
      // Sin las anclas tampoco se sabe: «no está en modo prueba» y «no pude
      // calcular su prueba» no pueden salir los dos como `false`.
      !lecturas.suscripciones || estadoCobros === null || !anclasPrueba
        ? null
        : !demo && !bloqueo && !planActivo && Boolean(prueba && !prueba.vencida) && estadoCobros !== "listos";

    const cid = sub?.stripe_customer_id ?? null;
    const s = cid ? stripe.data.get(cid) : undefined;
    const runtime = camila.data.get(h.slug);

    return {
      id: h.id,
      slug: h.slug,
      nombre: h.nombre,
      ownerId: h.owner_id,
      ownerEmail: correos.get(h.owner_id) ?? null,
      publicado: h.publicado !== false,
      createdAt: h.created_at,
      demo,
      situacion,
      estadoSuscripcion: sub?.estado ?? null,
      periodoFin: sub?.periodo_fin ?? null,
      cancelaAlFinal: sub?.cancela_al_final === true,
      avisosDunning: sub?.avisos_dunning ?? 0,
      diasPrueba: situacion === "prueba" && prueba ? prueba.diasRestantes : null,
      stripe: s ? { status: s.status, montoMxn: s.montoMxn, trialEnd: s.trialEnd } : null,
      cobros: estadoCobros,
      modoPrueba,
      camila: runtime ? { status: runtime.status, tipo: tipoCamila(runtime.status) } : null,
      botApagado: h.bot_enabled === false,
      saldo: saldos.data.get(h.id) ?? null,
      habitacionesConPrecio: hotelRooms({ habitaciones: h.habitaciones }).filter((r) => r.price > 0).length,
      reservas: porHotel.get(h.id) ?? {
        total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null, reales: 0,
      },
      diasDeVida: diasDesde(h.created_at, ahora),
    };
  });

  // ── Cuentas: registros y registrados sin hotel ────────────────────────────
  const personal = lecturas.equipo
    ? new Set(((rMiembros.data ?? []) as { user_id: string }[]).map((m) => m.user_id))
    : null;
  const duenos = new Set(hoteles.map((h) => h.ownerId));
  const duenosReales = new Set(hoteles.filter((h) => !h.demo).map((h) => h.ownerId));
  // Los mismos que cuenta el primer paso del embudo: sin personal y sin cuentas
  // que sólo tienen hoteles demo.
  const cuentasClientes =
    lecturas.usuarios && personal && filasHotel
      ? usuarios.data.filter((u) => {
          if (duenos.has(u.id)) return duenosReales.has(u.id);
          return !personal.has(u.id);
        })
      : null;
  const planes = new Map((filasSusc ?? []).map((s) => [s.user_id, s.estado]));
  const sinHotel =
    lecturas.usuarios && personal && filasHotel
      ? registradosSinHotel(usuarios.data, duenos, personal, planes)
      : null;

  const mrr = calcularMrr(filasSusc, stripe);

  const embudo = calcularEmbudo({
    usuarios: lecturas.usuarios ? usuarios.data : null,
    personal,
    hoteles: filasHotel
      ? hoteles.map((h) => ({
          ownerId: h.ownerId,
          demo: h.demo,
          habitacionesConPrecio: h.habitacionesConPrecio,
          cobrosListos: h.cobros === "listos",
          camilaConectada: h.camila?.tipo === "conectada",
          reservaReal: h.reservas.reales > 0,
        }))
      : null,
    lecturas: { cobros: lecturas.cobros, camila: lecturas.camila, reservas: lecturas.reservas },
    pagando: mrr.fuente === "sin-datos" || !filasSusc ? null : { ids: mrr.pagandoIds, estimado: mrr.fuente === "estimado" },
    reservasRecortadas,
  });

  // ── Métricas ──────────────────────────────────────────────────────────────
  const cuenta = (s: SituacionHotel) => hoteles.filter((h) => h.situacion === s).length;

  const suscriptores = rSuscriptores.error ? null : rSuscriptores.filas;
  if (rLeads.recortadas) fallos.push(`Sólo se leyeron los ${rLeads.filas.length} leads más recientes: las cifras de leads están recortadas.`);
  if (rSuscriptores.recortadas) {
    fallos.push(
      `Sólo se leyeron los ${rSuscriptores.filas.length} suscriptores más recientes: las cifras de la lista de correo están recortadas.`,
    );
  }
  const activosLista = suscriptores?.filter((s) => !s.baja_at) ?? null;

  const origenes = new Map<string, number>();
  for (const s of activosLista ?? []) {
    // "blog:slug" y "herramienta:slug" se agrupan por familia: saber que el blog
    // capta 40 importa; saber que un artículo concreto captó 2, no.
    const familia = (s.origen ?? "sin origen").split(":")[0];
    origenes.set(familia, (origenes.get(familia) ?? 0) + 1);
  }

  const leads = rLeads.error ? null : rLeads.filas;

  let mensajesCamila30d: number | null = null;
  if (lecturas.saldo) {
    mensajesCamila30d = 0;
    for (const s of saldos.data.values()) mensajesCamila30d += s.consumo30d ?? 0;
  }

  const desde30Ms = ahora - VENTANA_DIAS * DIA_MS;
  const desde7Ms = ahora - 7 * DIA_MS;

  const metricas: Metricas = {
    hoteles: hoteles.length,
    pago: cuenta("pago"),
    pagoEnPruebaStripe: hoteles.filter((h) => h.situacion === "pago" && h.stripe?.status === "trialing").length,
    cortesia: cuenta("cortesia"),
    prueba: cuenta("prueba"),
    pruebaVencida: cuenta("prueba_vencida"),
    morosos: cuenta("moroso"),
    bloqueados: cuenta("bloqueado"),
    canceladas: cuenta("cancelada"),
    demo: cuenta("demo"),
    sinSaber: hoteles.filter((h) => h.situacion === null).length,
    sinPublicar: hoteles.filter((h) => !h.publicado && !h.demo).length,
    sinNingunaReserva: hoteles.filter((h) => h.reservas.total === 0 && !h.demo).length,
    modoPrueba:
      lecturas.hoteles && lecturas.cobros && lecturas.suscripciones && anclasPrueba
        ? hoteles.filter((h) => h.modoPrueba === true).length
        : null,
    reservasRecientes: hoteles.reduce((s, h) => s + h.reservas.recientes, 0),
    gmvReciente: hoteles.reduce((s, h) => s + h.reservas.gmvReciente, 0),
    reservasTotal: hoteles.reduce((s, h) => s + h.reservas.total, 0),
    gmvTotal: hoteles.reduce((s, h) => s + h.reservas.gmvTotal, 0),
    leadsNuevos: leads ? leads.filter((l) => l.etapa === "nuevo").length : null,
    leadsActivos: leads ? leads.filter((l) => l.etapa !== "ganado" && l.etapa !== "perdido").length : null,
    suscriptoresActivos: activosLista ? activosLista.length : null,
    suscriptoresNuevos7d: activosLista ? activosLista.filter((s) => (s.created_at ?? "") >= desde7).length : null,
    bajas: suscriptores && activosLista ? suscriptores.length - activosLista.length : null,
    chatsEscalados: chats.n,
    chatsSinAtender: chats.sinAtender,
    cuentas: cuentasClientes ? cuentasClientes.length : null,
    registros7d: cuentasClientes ? cuentasClientes.filter((u) => Date.parse(u.created_at) >= desde7Ms).length : null,
    registros30d: cuentasClientes ? cuentasClientes.filter((u) => Date.parse(u.created_at) >= desde30Ms).length : null,
    mensajesCamila30d,
    mensajesCamilaIncompleto: consumoIncompleto,
    hotelesEnPrepago: lecturas.saldo ? saldos.data.size : null,
  };

  const alertas = calcularAlertas({
    hoteles,
    leads,
    chatsEscalados: chats.n,
    chatsSinAtender: chats.sinAtender,
    registradosSinHotel: sinHotel,
    lecturas: { camila: lecturas.camila, reservas: lecturas.reservas },
    reservasRecortadas,
    ahora,
  });

  return {
    metricas,
    mrr,
    hoteles,
    alertas,
    embudo,
    notaEmbudo: NOTA_EMBUDO,
    registradosSinHotel: sinHotel,
    lecturas,
    origenesSuscriptores: [...origenes.entries()]
      .map(([origen, n]) => ({ origen, n }))
      .sort((a, b) => b.n - a.n),
    fallos,
    pendientes,
    reservasRecortadas,
  };
}
