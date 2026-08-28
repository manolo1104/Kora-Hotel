// La foto completa del negocio para el fundador. SOLO servidor (service-role).
//
// Una sola función que junta lo que hoy está repartido en cuatro sitios: el CRM
// (leads), /crm/hoteles (bloqueos), el digest diario (que sólo llega por correo
// y no se puede consultar) y la tabla `suscripciones` (que no se veía en ningún
// lado). Sin esto, la pregunta "¿este hotel ya usó el producto o me va a dejar?"
// no se podía contestar sin abrir Supabase a mano.
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

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { bloqueoDelHotel, pruebaDelHotel, type EstadoSuscripcion } from "@/lib/suscripcion";
import { iniciosPruebaDeDuenos } from "@/lib/db/prueba-dueno";
import { PRECIO_DESDE } from "@/lib/oferta";
import { VENTANA_DIAS } from "@/lib/crm/types";
import { reservaCuenta } from "@/lib/booking/estado-reserva";

/** Códigos de PostgREST/Postgres para "esa tabla o columna no existe aquí". */
const NO_EXISTE = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

/** Tope de reservas que se traen para agregar en memoria. */
const TOPE_RESERVAS = 5000;

/**
 * En qué situación está un hotel, en una sola palabra. El orden importa: se
 * evalúa de arriba a abajo y gana la primera que aplique.
 */
export type SituacionHotel =
  | "bloqueado" // Kora lo apagó a mano
  | "demo" // hotel de demostración, nunca caduca
  | "moroso" // tuvo plan y el cobro falló
  | "pago" // plan al corriente
  | "cortesia" // acceso regalado
  | "prueba" // dentro de los 30 días
  | "prueba_vencida" // se le acabó y no pagó
  | "cancelada"; // canceló el plan

export interface ReservasHotel {
  total: number;
  recientes: number; // en la ventana de VENTANA_DIAS
  gmvTotal: number;
  gmvReciente: number;
  ultima: string | null; // ISO de la última reserva
}

export interface HotelOps {
  id: string;
  slug: string;
  nombre: string;
  ownerId: string;
  ownerEmail: string | null;
  publicado: boolean;
  createdAt: string | null;
  situacion: SituacionHotel;
  estadoSuscripcion: EstadoSuscripcion | null;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
  avisosDunning: number;
  diasPrueba: number | null; // null si no aplica
  cobraConStripe: boolean; // tiene Stripe Connect conectado
  reservas: ReservasHotel;
  /** Días desde que se dio de alta. Para juzgar si "sin reservas" es grave. */
  diasDeVida: number;
}

export interface Alerta {
  id: string;
  severidad: "alta" | "media";
  titulo: string;
  detalle: string;
  href?: string;
}

export interface Metricas {
  mrr: number;
  hoteles: number;
  pago: number;
  cortesia: number;
  prueba: number;
  pruebaVencida: number;
  morosos: number;
  bloqueados: number;
  canceladas: number;
  sinPublicar: number;
  sinNingunaReserva: number;
  reservasRecientes: number;
  gmvReciente: number;
  reservasTotal: number;
  gmvTotal: number;
  leadsNuevos: number;
  leadsActivos: number;
  suscriptoresActivos: number;
  suscriptoresNuevos7d: number;
  bajas: number;
  /** null = no se pudo saber (tabla ausente o consulta rota), NO es cero. */
  chatsEscalados: number | null;
}

export interface Operaciones {
  metricas: Metricas;
  hoteles: HotelOps[];
  alertas: Alerta[];
  /** Origen → altas de la lista de correo. Dice QUÉ superficie capta. */
  origenesSuscriptores: { origen: string; n: number }[];
  /** Consultas que fallaron de verdad. Si trae algo, la pantalla NO es de fiar. */
  fallos: string[];
  /** Tablas que aún no existen: falta correr su SQL. No es una avería. */
  pendientes: string[];
  /** true si se alcanzó el tope de reservas y los totales están recortados. */
  reservasRecortadas: boolean;
}

const dias = (iso: string | null | undefined): number =>
  iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : 0;

interface FilaHotel {
  id: string;
  slug: string;
  nombre: string;
  owner_id: string;
  publicado: boolean | null;
  extras: Record<string, unknown> | null;
  created_at: string | null;
  stripe_account_id: string | null;
}

interface FilaSusc {
  user_id: string;
  plan: string | null;
  estado: EstadoSuscripcion;
  periodo_fin: string | null;
  cancela_al_final: boolean | null;
  avisos_dunning: number | null;
}

interface FilaBooking {
  hotel_id: string;
  total: number | null;
  estado: string | null;
  created_at: string | null;
}

/** Los correos de los dueños. Falla en silencio: es un lujo, no un dato crítico. */
async function correosDeDuenos(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!ids.length) return mapa;
  try {
    // listUsers pagina de 50 en 50 por defecto. Con decenas de hoteles una
    // página basta; si algún día no basta, lo peor que pasa es que falten
    // correos en la tabla, no que la pantalla se caiga.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      console.error("[operaciones] no se pudieron leer los correos:", error.message);
      return mapa;
    }
    for (const u of data?.users ?? []) {
      if (u.id && u.email) mapa.set(u.id, u.email);
    }
  } catch (e) {
    console.error("[operaciones] error leyendo los correos:", e);
  }
  return mapa;
}

export async function cargarOperaciones(): Promise<Operaciones> {
  const fallos: string[] = [];
  const pendientes: string[] = [];
  const vacio = (): Operaciones => ({
    metricas: {
      mrr: 0, hoteles: 0, pago: 0, cortesia: 0, prueba: 0, pruebaVencida: 0,
      morosos: 0, bloqueados: 0, canceladas: 0, sinPublicar: 0, sinNingunaReserva: 0,
      reservasRecientes: 0, gmvReciente: 0, reservasTotal: 0, gmvTotal: 0,
      leadsNuevos: 0, leadsActivos: 0, suscriptoresActivos: 0,
      suscriptoresNuevos7d: 0, bajas: 0, chatsEscalados: null,
    },
    hoteles: [],
    alertas: [],
    origenesSuscriptores: [],
    fallos,
    pendientes,
    reservasRecortadas: false,
  });

  if (!adminEnvReady) {
    fallos.push("No hay conexión a la base de datos (falta SUPABASE_SERVICE_ROLE_KEY).");
    return vacio();
  }

  const admin = createAdminClient();
  const desdeVentana = new Date(Date.now() - VENTANA_DIAS * 86_400_000).toISOString();
  const desde7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [rHoteles, rSusc, rBookings, rLeads, rSuscriptores, rChats] = await Promise.all([
    admin
      .from("hoteles")
      .select("id, slug, nombre, owner_id, publicado, extras, created_at, stripe_account_id")
      .order("created_at", { ascending: true }),
    admin
      .from("suscripciones")
      .select("user_id, plan, estado, periodo_fin, cancela_al_final, avisos_dunning"),
    admin
      .from("bookings")
      .select("hotel_id, total, estado, created_at")
      .order("created_at", { ascending: false })
      .limit(TOPE_RESERVAS),
    admin
      .from("crm_leads")
      .select("id, etapa, created_at, proximo_seguimiento")
      .limit(1000),
    admin
      .from("suscriptores")
      .select("origen, baja_at, created_at")
      .limit(5000),
    admin
      .from("soporte_conversaciones")
      .select("id")
      .eq("escalado", true)
      .gte("updated_at", desde7),
  ]);

  // Cada consulta cae en uno de tres cajones: bien, tabla-sin-crear (nota gris
  // con el SQL que falta) o rota de verdad (banda roja).
  for (const [nombre, r, sql] of [
    ["los hoteles", rHoteles, "sql/kora-fase4-schema.sql"],
    ["las suscripciones", rSusc, "sql/kora-suscripciones-schema.sql"],
    ["las reservas", rBookings, "sql/kora-multitenant-fase0.sql"],
    ["los leads", rLeads, "sql/kora-crm-schema.sql"],
    ["la lista de correo", rSuscriptores, "sql/kora-suscriptores.sql"],
    ["los chats de soporte", rChats, "sql/kora-soporte-schema.sql"],
  ] as const) {
    if (!r.error) continue;
    const code = (r.error as { code?: string }).code;
    if (code && NO_EXISTE.has(code)) {
      pendientes.push(`Falta correr ${sql}: por eso no se ven ${nombre}.`);
    } else {
      console.error(`[operaciones] no se pudo leer ${nombre}:`, r.error.message);
      fallos.push(`No se pudieron leer ${nombre}.`);
    }
  }

  const filasHotel = (rHoteles.data ?? []) as FilaHotel[];
  const filasSusc = (rSusc.data ?? []) as FilaSusc[];
  const filasBooking = (rBookings.data ?? []) as FilaBooking[];
  const reservasRecortadas = filasBooking.length >= TOPE_RESERVAS;
  if (reservasRecortadas) {
    fallos.push(
      `Sólo se leyeron las ${TOPE_RESERVAS} reservas más recientes: los totales históricos están recortados.`,
    );
  }

  // ── Reservas agregadas por hotel ──────────────────────────────────────────
  // Una CANCELADA no es venta y una REEMBOLSADA se devolvió: ninguna suma al
  // volumen. Sí cuentan como "este hotel movió el producto", que es lo que
  // responde la pregunta de si lo activó.
  const porHotel = new Map<string, ReservasHotel>();
  for (const b of filasBooking) {
    if (!b.hotel_id) continue;
    const acc = porHotel.get(b.hotel_id) ?? {
      total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null,
    };
    const vale = reservaCuenta(b.estado);
    const monto = vale ? Number(b.total ?? 0) : 0;
    const reciente = Boolean(b.created_at && b.created_at >= desdeVentana);

    acc.total++;
    acc.gmvTotal += monto;
    if (reciente) {
      acc.recientes++;
      acc.gmvReciente += monto;
    }
    // La consulta viene ordenada por created_at desc, así que la primera que se
    // ve de cada hotel es la más reciente.
    if (!acc.ultima && b.created_at) acc.ultima = b.created_at;
    porHotel.set(b.hotel_id, acc);
  }

  const suscPorDueno = new Map(filasSusc.map((s) => [s.user_id, s]));
  const ownerIds = filasHotel.map((h) => h.owner_id).filter(Boolean);
  const [correos, iniciosPrueba] = await Promise.all([
    correosDeDuenos(admin, ownerIds),
    iniciosPruebaDeDuenos(ownerIds),
  ]);

  // ── Un hotel a la vez ─────────────────────────────────────────────────────
  const hoteles: HotelOps[] = filasHotel.map((h) => {
    const extras = h.extras ?? {};
    const demo = (extras as { demo?: boolean }).demo === true;
    const bloqueo = bloqueoDelHotel(extras);
    const sub = suscPorDueno.get(h.owner_id) ?? null;
    const prueba = pruebaDelHotel(
      { created_at: h.created_at, extras },
      iniciosPrueba.get(h.owner_id) ?? null,
    );

    let situacion: SituacionHotel;
    if (bloqueo) situacion = "bloqueado";
    else if (demo) situacion = "demo";
    else if (sub?.estado === "pago_vencido") situacion = "moroso";
    else if (sub?.estado === "activa") situacion = "pago";
    else if (sub?.estado === "cortesia") situacion = "cortesia";
    else if (sub?.estado === "cancelada") situacion = "cancelada";
    else if (prueba && !prueba.vencida) situacion = "prueba";
    else situacion = "prueba_vencida";

    return {
      id: h.id,
      slug: h.slug,
      nombre: h.nombre,
      ownerId: h.owner_id,
      ownerEmail: correos.get(h.owner_id) ?? null,
      publicado: h.publicado !== false,
      createdAt: h.created_at,
      situacion,
      estadoSuscripcion: sub?.estado ?? null,
      periodoFin: sub?.periodo_fin ?? null,
      cancelaAlFinal: sub?.cancela_al_final === true,
      avisosDunning: sub?.avisos_dunning ?? 0,
      diasPrueba: situacion === "prueba" && prueba ? prueba.diasRestantes : null,
      cobraConStripe: Boolean(h.stripe_account_id),
      reservas:
        porHotel.get(h.id) ?? { total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null },
      diasDeVida: dias(h.created_at),
    };
  });

  // ── Métricas ──────────────────────────────────────────────────────────────
  const cuenta = (s: SituacionHotel) => hoteles.filter((h) => h.situacion === s).length;
  // El MRR sólo cuenta el plan PAGADO. La cortesía no entra: es ingreso que no
  // existe, y un MRR inflado es la cifra más fácil de creerse y más cara de
  // corregir después.
  const pago = cuenta("pago");

  const suscriptores = (rSuscriptores.data ?? []) as {
    origen: string | null;
    baja_at: string | null;
    created_at: string | null;
  }[];
  const activosLista = suscriptores.filter((s) => !s.baja_at);

  const origenes = new Map<string, number>();
  for (const s of activosLista) {
    // "blog:slug" y "herramienta:slug" se agrupan por familia: saber que el blog
    // capta 40 importa; saber que un artículo concreto captó 2, no.
    const familia = (s.origen ?? "sin origen").split(":")[0];
    origenes.set(familia, (origenes.get(familia) ?? 0) + 1);
  }

  const leads = (rLeads.data ?? []) as {
    id: string;
    etapa: string | null;
    created_at: string | null;
    proximo_seguimiento: string | null;
  }[];
  const leadsActivos = leads.filter((l) => l.etapa !== "ganado" && l.etapa !== "perdido");

  const metricas: Metricas = {
    mrr: pago * PRECIO_DESDE,
    hoteles: hoteles.length,
    pago,
    cortesia: cuenta("cortesia"),
    prueba: cuenta("prueba"),
    pruebaVencida: cuenta("prueba_vencida"),
    morosos: cuenta("moroso"),
    bloqueados: cuenta("bloqueado"),
    canceladas: cuenta("cancelada"),
    sinPublicar: hoteles.filter((h) => !h.publicado && h.situacion !== "demo").length,
    sinNingunaReserva: hoteles.filter((h) => h.reservas.total === 0 && h.situacion !== "demo").length,
    reservasRecientes: hoteles.reduce((s, h) => s + h.reservas.recientes, 0),
    gmvReciente: hoteles.reduce((s, h) => s + h.reservas.gmvReciente, 0),
    reservasTotal: hoteles.reduce((s, h) => s + h.reservas.total, 0),
    gmvTotal: hoteles.reduce((s, h) => s + h.reservas.gmvTotal, 0),
    leadsNuevos: leads.filter((l) => l.etapa === "nuevo").length,
    leadsActivos: leadsActivos.length,
    suscriptoresActivos: activosLista.length,
    suscriptoresNuevos7d: activosLista.filter((s) => (s.created_at ?? "") >= desde7).length,
    bajas: suscriptores.length - activosLista.length,
    chatsEscalados: rChats.error ? null : (rChats.data ?? []).length,
  };

  // ── Lo que requiere atención HOY ──────────────────────────────────────────
  // Ordenado por lo que cuesta dinero si no se atiende, no por lo que es fácil.
  const alertas: Alerta[] = [];

  for (const h of hoteles.filter((x) => x.situacion === "moroso")) {
    alertas.push({
      id: `moroso-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — el cobro falló`,
      detalle: `${h.avisosDunning} aviso${h.avisosDunning === 1 ? "" : "s"} de cobro enviado${h.avisosDunning === 1 ? "" : "s"}. ${h.ownerEmail ?? "sin correo"}. Es un cliente que ya te pagaba.`,
    });
  }

  // La prueba a punto de vencer es la única ventana en que la venta está caliente
  // y el hotelero todavía tiene el producto encendido.
  for (const h of hoteles.filter((x) => x.situacion === "prueba" && (x.diasPrueba ?? 99) <= 7)) {
    alertas.push({
      id: `prueba-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — le quedan ${h.diasPrueba} día${h.diasPrueba === 1 ? "" : "s"} de prueba`,
      detalle:
        h.reservas.total > 0
          ? `Ya procesó ${h.reservas.total} reserva${h.reservas.total === 1 ? "" : "s"}: el producto le funcionó. Es el momento de cerrarlo.`
          : "Todavía no procesa ninguna reserva. Si no lo ayudas a estrenarlo, no va a pagar.",
    });
  }

  // Un hotel con acceso vivo que nunca estrenó el producto es una baja anunciada.
  // Se le da una semana de gracia: nadie configura su hotel el primer día.
  for (const h of hoteles.filter(
    (x) =>
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
    });
  }

  for (const h of hoteles.filter((x) => !x.publicado && x.situacion !== "demo" && x.diasDeVida >= 7)) {
    alertas.push({
      id: `sin-publicar-${h.id}`,
      severidad: "media",
      titulo: `${h.nombre} — sigue sin publicar`,
      detalle: `Lleva ${h.diasDeVida} días dado de alta. Sin publicar no puede cobrar ni una reserva.`,
    });
  }

  for (const h of hoteles.filter((x) => x.cancelaAlFinal)) {
    alertas.push({
      id: `cancela-${h.id}`,
      severidad: "alta",
      titulo: `${h.nombre} — pidió cancelar al final del periodo`,
      detalle: `Sigue activo hasta ${h.periodoFin ? h.periodoFin.slice(0, 10) : "el fin del periodo"}. Todavía se puede recuperar.`,
    });
  }

  const leadsViejos = leads.filter((l) => l.etapa === "nuevo" && dias(l.created_at) >= 3);
  if (leadsViejos.length) {
    alertas.push({
      id: "leads-frios",
      severidad: "media",
      titulo: `${leadsViejos.length} lead${leadsViejos.length === 1 ? "" : "s"} sin contactar hace 3 días o más`,
      detalle: "Un lead que pidió información y nadie le escribió en tres días ya se enfrió.",
      href: "/crm/leads",
    });
  }

  if (metricas.chatsEscalados && metricas.chatsEscalados > 0) {
    alertas.push({
      id: "chats",
      severidad: "media",
      titulo: `${metricas.chatsEscalados} chat${metricas.chatsEscalados === 1 ? "" : "s"} de soporte escalado${metricas.chatsEscalados === 1 ? "" : "s"}`,
      detalle: "El bot no pudo resolverlos en los últimos 7 días.",
    });
  }

  const orden = { alta: 0, media: 1 };
  alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad]);

  return {
    metricas,
    hoteles,
    alertas,
    origenesSuscriptores: [...origenes.entries()]
      .map(([origen, n]) => ({ origen, n }))
      .sort((a, b) => b.n - a.n),
    fallos,
    pendientes,
    reservasRecortadas,
  };
}
