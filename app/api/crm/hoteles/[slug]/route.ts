import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmAuth } from "@/lib/crm/auth";
import { requireCrmMutacion } from "@/lib/crm/guardas";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { bloqueoDelHotel, finDePrueba, inicioDePrueba } from "@/lib/suscripcion";
import { sumarDiasExtraPrueba } from "@/lib/db/prueba-dueno";
import { acreditarMensajes, leerSaldo, SIN_DATO } from "@/lib/db/saldo";
import { registrarAccion } from "@/lib/crm/bitacora";
import {
  cargarFichaHotel,
  leerPruebaDelDueno,
  leerSuscripcionDelDueno,
  planActivoDe,
  type FilaSuscripcion,
} from "@/lib/crm/ficha";
import {
  DIA_MS,
  DIAS_EXTENSION,
  DIAS_EXTRA_TOPE,
  MENSAJE_BLOQUEO_MAX,
  MENSAJES_REGALO_MAX,
  MOTIVO_MAX,
  MOTIVO_MIN,
  REF_REGALO,
  calcularExtension,
  extrasCon,
  extrasSinAvisosPrueba,
  puedeDarCortesia,
  puedeDesbloquear,
  puedeExtenderPrueba,
  puedeMarcarDemo,
  puedeQuitarCortesia,
  puedeQuitarDemo,
} from "@/lib/crm/acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El GET arma la ficha entera (Auth, Camila, Stripe Connect y las suscripciones
// de Stripe, cada uno con su tope: se suman). El POST no tarda tanto, pero
// `maxDuration` es del archivo, no de cada método. Mismo número que /crm.
export const maxDuration = 60;

// Los botones de la ficha de un hotel en el CRM del fundador.
//
// GET  → la ficha entera (la misma que pinta /crm/hoteles/[slug]).
// POST → { accion, motivo, ... } — una acción por petición:
//   dar_cortesia · quitar_cortesia · extender_prueba {dias, diasExtraVistos} ·
//   regalar_mensajes {mensajes, ref} · marcar_demo · quitar_demo ·
//   bloquear {mensaje} · desbloquear
//
// Hasta el 15 sep 2026 cada una de estas cosas era un INSERT a mano en Supabase,
// un script de la terminal o, en el caso de alargar una prueba, imposible.
// Manolo pidió operarlo todo con botones. Cada acción:
//
//   · pasa por `requireCrmMutacion` (sesión + que la petición salga del CRM);
//   · valida con zod y con las reglas de lib/crm/acciones.ts (las mismas que
//     usa la ficha para apagar los botones que no aplican);
//   · lleva MOTIVO obligatorio: todas tocan acceso o dinero de alguien, y
//     «¿por qué este hotel tiene 30 días más?» tiene que tener respuesta;
//   · queda en la bitácora con el antes y el después;
//   · nunca devuelve el mensaje crudo de Postgres (la ruta vieja de bloqueo lo
//     hacía): va al log, y la pantalla dice qué pasó en palabras.

type Ctx = { params: Promise<{ slug: string }> };

const zMotivo = z.string().trim().min(MOTIVO_MIN).max(MOTIVO_MAX);

const ESQUEMA = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("dar_cortesia"), motivo: zMotivo }),
  z.object({ accion: z.literal("quitar_cortesia"), motivo: zMotivo }),
  z.object({
    accion: z.literal("extender_prueba"),
    motivo: zMotivo,
    dias: z
      .number()
      .int()
      .refine((d) => (DIAS_EXTENSION as readonly number[]).includes(d)),
    // Los días extra que la ficha ENSEÑABA al abrir el diálogo. Si en la base ya
    // hay otros, alguien (u otro clic) se adelantó: se rechaza en vez de fijar un
    // total calculado sobre un dato viejo. Es lo que hace que un reintento tras
    // un corte de red no regale dos veces.
    diasExtraVistos: z.number().int().min(0).max(DIAS_EXTRA_TOPE),
  }),
  z.object({
    accion: z.literal("regalar_mensajes"),
    motivo: zMotivo,
    mensajes: z.number().int().min(1).max(MENSAJES_REGALO_MAX),
    ref: z.string().regex(REF_REGALO),
  }),
  z.object({ accion: z.literal("marcar_demo"), motivo: zMotivo }),
  z.object({ accion: z.literal("quitar_demo"), motivo: zMotivo }),
  z.object({
    accion: z.literal("bloquear"),
    motivo: zMotivo,
    mensaje: z.string().trim().min(1).max(MENSAJE_BLOQUEO_MAX),
  }),
  z.object({ accion: z.literal("desbloquear"), motivo: zMotivo }),
]);

type Cuerpo = z.infer<typeof ESQUEMA>;

interface HotelAccion {
  id: string;
  slug: string;
  nombre: string;
  owner_id: string;
  extras: Record<string, unknown> | null;
  created_at: string | null;
}

type Extras = Record<string, unknown>;
type Admin = ReturnType<typeof createAdminClient>;

const NO_SE_CAMBIO = "No se cambió nada.";

function error(status: number, texto: string): NextResponse {
  return NextResponse.json({ error: texto }, { status });
}

/** Éxito, con el aviso de bitácora si el apunte no quedó. */
function listo(mensaje: string, apuntado: boolean, aviso?: string): NextResponse {
  const avisos = [aviso, apuntado ? null : "Se hizo, pero no quedó apuntado en la bitácora."].filter(Boolean);
  return NextResponse.json({ ok: true, mensaje, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) });
}

function fechaLarga(ms: number): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(ms);
}

function mensajeSuscripcionIlegible(estado: "falta-sql" | "error"): NextResponse {
  return estado === "falta-sql"
    ? error(409, `Falta correr sql/kora-suscripciones-schema.sql. ${NO_SE_CAMBIO}`)
    : error(503, `No se pudo leer el plan del dueño. ${NO_SE_CAMBIO} Intenta de nuevo en un momento.`);
}

// ─── `extras`: releer justo antes de escribir ────────────────────────────────
//
// `extras` es un solo JSON con todo lo del hotel (fotos, diseño, promos…) y
// PostgREST sólo sabe reemplazarlo entero. La ruta vieja de bloqueo lo leía al
// principio y lo escribía al final; cualquier cosa que el hotelero guardara en
// medio se perdía. Aquí se relee JUSTO antes del UPDATE, igual que el cron de la
// prueba y el editor del panel.
//
// LA CARRERA QUE QUEDA, dicha claro: si el hotelero guarda su editor en los
// milisegundos que hay entre esta relectura y el UPDATE, su cambio se pierde.
// Al revés no pasa nada con `demo` ni con `bloqueo`: tras correr
// sql/kora-crm-mando.sql el trigger de `hoteles` no deja que el navegador las
// toque, así que si su guardado llega DESPUÉS del nuestro, el trigger conserva lo
// que puso el CRM. Con `prueba.avisos` sí podría volver el valor viejo (esa llave
// no la protege el trigger); lo peor que pasa es que no le llegue un aviso.
// Cerrarlo del todo pide una función SQL que cambie una sola llave en un único
// UPDATE (`jsonb_set`), y eso es un SQL nuevo.

async function extrasFrescos(admin: Admin, hotelId: string): Promise<Extras | null> {
  const { data, error: e } = await admin.from("hoteles").select("extras").eq("id", hotelId).maybeSingle();
  if (e || !data) {
    if (e) console.error(`[crm/hoteles/accion] no se pudo releer extras de ${hotelId}:`, e.message);
    return null;
  }
  const extras = (data as { extras: unknown }).extras;
  return extras && typeof extras === "object" && !Array.isArray(extras) ? (extras as Extras) : {};
}

async function escribirExtras(admin: Admin, hotelId: string, extras: Extras): Promise<boolean> {
  const { error: e } = await admin.from("hoteles").update({ extras }).eq("id", hotelId);
  if (e) {
    console.error(`[crm/hoteles/accion] no se pudo guardar extras de ${hotelId}:`, e.message);
    return false;
  }
  return true;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Ctx) {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;
  const { slug } = await params;
  const r = await cargarFichaHotel(slug);
  if (r.tipo === "no-existe") return error(404, "No existe ese hotel.");
  if (r.tipo === "error") return error(503, r.detalle);
  return NextResponse.json({ ok: true, ficha: r.ficha });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: Ctx) {
  const no = await requireCrmMutacion(req);
  if (no) return no;
  if (!adminEnvReady) return error(503, "No hay conexión a la base de datos.");

  // Un tope holgado: el fundador no da 60 clics en 10 minutos. Está para que una
  // cookie robada o un script en bucle no pueda regalar saldo sin freno.
  if (await limitado("crm.hotel-accion", ipDe(req), { max: 60, ventanaMs: 10 * 60_000 })) {
    return error(429, "Demasiadas acciones seguidas. Espera unos minutos.");
  }

  const { slug } = await params;
  if (typeof slug !== "string" || !slug || slug.length > 200) return error(404, "No existe ese hotel.");

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return c.respuesta;
  const cuerpo = c.datos;

  const admin = createAdminClient();
  const { data, error: e } = await admin
    .from("hoteles")
    .select("id, slug, nombre, owner_id, extras, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (e) {
    console.error(`[crm/hoteles/accion] no se pudo leer el hotel ${slug}:`, e.message);
    return error(503, `No se pudo leer el hotel. ${NO_SE_CAMBIO}`);
  }
  if (!data) return error(404, "No existe ese hotel.");
  const hotel = data as HotelAccion;

  try {
    switch (cuerpo.accion) {
      case "dar_cortesia":
        return await darCortesia(admin, hotel, cuerpo);
      case "quitar_cortesia":
        return await quitarCortesia(admin, hotel, cuerpo);
      case "extender_prueba":
        return await extenderPrueba(admin, hotel, cuerpo);
      case "regalar_mensajes":
        return await regalarMensajes(hotel, cuerpo);
      case "marcar_demo":
      case "quitar_demo":
        return await cambiarDemo(admin, hotel, cuerpo);
      case "bloquear":
      case "desbloquear":
        return await cambiarBloqueo(admin, hotel, cuerpo);
    }
    // El esquema ya sólo deja pasar las acciones de arriba; esto es la red por si
    // alguien añade una al esquema y olvida su caso.
    return error(400, "Esa acción no existe.");
  } catch (err) {
    console.error(`[crm/hoteles/accion] ${cuerpo.accion} en ${slug} falló:`, err);
    return error(500, "Algo falló a medio camino. Recarga la ficha para ver en qué quedó antes de repetirlo.");
  }
}

// ─── Cortesía ────────────────────────────────────────────────────────────────

async function darCortesia(
  admin: Admin,
  hotel: HotelAccion,
  cuerpo: Extract<Cuerpo, { accion: "dar_cortesia" }>,
): Promise<NextResponse> {
  const lectura = await leerSuscripcionDelDueno(hotel.owner_id);
  if (lectura.estado !== "ok") return mensajeSuscripcionIlegible(lectura.estado);
  const sub = lectura.sub;

  const v = puedeDarCortesia(sub);
  if (!v.ok) return error(409, v.motivo);

  const cambiado = "El plan de este dueño cambió mientras tanto. Recarga la ficha y revísalo antes de repetirlo.";

  if (!sub) {
    const { error: e } = await admin
      .from("suscripciones")
      .insert({ user_id: hotel.owner_id, plan: "kora", estado: "cortesia" });
    if (e) {
      if (e.code === "23505") return error(409, cambiado);
      if (e.code === "23503") return error(409, `La cuenta del dueño ya no existe. ${NO_SE_CAMBIO}`);
      console.error("[crm/hoteles/accion] no se pudo crear la cortesía:", e.message);
      return error(500, `No se pudo guardar la cortesía. ${NO_SE_CAMBIO}`);
    }
  } else {
    // El UPDATE sólo aplica si la fila sigue como se leyó (mismo estado y misma
    // suscripción de Stripe). Si entre la lectura y aquí llegó el webhook de
    // Stripe con un pago, no se pisa: la regla de «a quien paga no se le da
    // cortesía» se decidió con el dato de hace un instante, no con el de ahora.
    let q = admin
      .from("suscripciones")
      .update({ plan: "kora", estado: "cortesia", cancela_al_final: false })
      .eq("user_id", hotel.owner_id)
      .eq("estado", sub.estado);
    q = sub.stripe_subscription_id
      ? q.eq("stripe_subscription_id", sub.stripe_subscription_id)
      : q.is("stripe_subscription_id", null);
    const { data, error: e } = await q.select("user_id");
    if (e) {
      console.error("[crm/hoteles/accion] no se pudo dar la cortesía:", e.message);
      return error(500, `No se pudo guardar la cortesía. ${NO_SE_CAMBIO}`);
    }
    if (!data || data.length === 0) return error(409, cambiado);
  }

  const apuntado = await registrarAccion({
    accion: "suscripcion.cortesia_dar",
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    userId: hotel.owner_id,
    motivo: cuerpo.motivo,
    antes: sub ? { estado: sub.estado, plan: sub.plan } : { estado: null },
    despues: { estado: "cortesia", plan: "kora" },
  });
  return listo("Listo: tiene cortesía. Aplica a todos los hoteles de este dueño.", apuntado);
}

async function quitarCortesia(
  admin: Admin,
  hotel: HotelAccion,
  cuerpo: Extract<Cuerpo, { accion: "quitar_cortesia" }>,
): Promise<NextResponse> {
  const lectura = await leerSuscripcionDelDueno(hotel.owner_id);
  if (lectura.estado !== "ok") return mensajeSuscripcionIlegible(lectura.estado);
  const sub: FilaSuscripcion | null = lectura.sub;

  const v = puedeQuitarCortesia(sub);
  if (!v.ok) return error(409, v.motivo);

  // Condicionado a que SIGA siendo cortesía: nunca se cancela desde aquí un plan
  // que en el último instante pasó a pagado.
  const { data, error: e } = await admin
    .from("suscripciones")
    .update({ estado: "cancelada" })
    .eq("user_id", hotel.owner_id)
    .eq("estado", "cortesia")
    .select("user_id");
  if (e) {
    console.error("[crm/hoteles/accion] no se pudo quitar la cortesía:", e.message);
    return error(500, `No se pudo quitar la cortesía. ${NO_SE_CAMBIO}`);
  }
  if (!data || data.length === 0) return error(409, "Ya no tenía cortesía. Recarga la ficha.");

  const apuntado = await registrarAccion({
    accion: "suscripcion.cortesia_quitar",
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    userId: hotel.owner_id,
    motivo: cuerpo.motivo,
    antes: { estado: "cortesia", plan: sub?.plan ?? null },
    despues: { estado: "cancelada" },
  });
  return listo("Listo: ya no tiene cortesía. Desde ahora manda su prueba (o su plan, si contrata).", apuntado);
}

// ─── Prueba ──────────────────────────────────────────────────────────────────

async function extenderPrueba(
  admin: Admin,
  hotel: HotelAccion,
  cuerpo: Extract<Cuerpo, { accion: "extender_prueba" }>,
): Promise<NextResponse> {
  const lectura = await leerSuscripcionDelDueno(hotel.owner_id);
  if (lectura.estado !== "ok") return mensajeSuscripcionIlegible(lectura.estado);

  const demo = (hotel.extras ?? {}).demo === true;
  const v = puedeExtenderPrueba({ planActivo: planActivoDe(lectura.sub), estado: lectura.sub?.estado ?? null, demo });
  if (!v.ok) return error(409, v.motivo);

  // Todos los hoteles del dueño: la prueba es POR DUEÑO, así que el inicio de
  // respaldo es el alta más antigua y los avisos se reinician en todos.
  const { data: hermanosData, error: eh } = await admin
    .from("hoteles")
    .select("id, created_at")
    .eq("owner_id", hotel.owner_id);
  if (eh) {
    console.error("[crm/hoteles/accion] no se pudieron leer los hoteles del dueño:", eh.message);
    return error(503, `No se pudieron leer los hoteles del dueño. ${NO_SE_CAMBIO}`);
  }
  const hermanos = (hermanosData ?? []) as { id: string; created_at: string | null }[];

  const prueba = await leerPruebaDelDueno(hotel.owner_id);
  if (prueba.estado === "error") return error(503, `No se pudo leer su prueba. ${NO_SE_CAMBIO}`);
  if (prueba.faltaTabla) {
    return error(409, "Falta correr sql/kora-prueba-por-dueno.sql y después sql/kora-crm-mando.sql. Sin eso no se pueden dar días.");
  }
  if (prueba.faltaColumna) {
    return error(409, "Falta correr sql/kora-crm-mando.sql. Sin eso no se pueden dar días.");
  }
  if (prueba.diasExtra !== cuerpo.diasExtraVistos) {
    return error(
      409,
      `Su prueba cambió desde que abriste la ficha (ahora tiene ${prueba.diasExtra} días extra). Recarga y vuelve a intentarlo.`,
    );
  }

  // Si el dueño no tiene fila en `pruebas`, `sumarDiasExtraPrueba` la crea con
  // esta fecha. Es el alta más antigua de sus hoteles: la misma con la que ya se
  // le calculaba la prueba, así que crearla no le mueve ni un día (y de paso deja
  // anclada su prueba: borrar y recrear el hotel ya no la reinicia).
  const altas = hermanos
    .map((x) => (x.created_at ? Date.parse(x.created_at) : NaN))
    .filter((t) => !Number.isNaN(t));
  const altaMasAntigua = altas.length ? new Date(Math.min(...altas)).toISOString() : hotel.created_at;
  const inicioMs = inicioDePrueba(altaMasAntigua, prueba.inicio);
  const inicioSiNoHay = new Date(inicioMs).toISOString();
  const finBaseMs = finDePrueba(inicioMs, 0).getTime();

  const calculo = calcularExtension({
    finBaseMs,
    diasExtraActuales: prueba.diasExtra,
    dias: cuerpo.dias,
    ahora: Date.now(),
  });
  if (!calculo.ok) return error(409, calculo.motivo);

  const r = await sumarDiasExtraPrueba(hotel.owner_id, calculo.diasExtra, inicioSiNoHay);
  if (!r.ok) {
    if (r.error === "falta-sql") return error(409, "Falta correr sql/kora-crm-mando.sql. Sin eso no se pueden dar días.");
    if (r.error === "usuario-no-existe") return error(409, `La cuenta del dueño ya no existe. ${NO_SE_CAMBIO}`);
    if (r.error === "datos-invalidos") return error(400, `Esos días no caben en el tope. ${NO_SE_CAMBIO}`);
    return error(500, `No se pudieron guardar los días. ${NO_SE_CAMBIO}`);
  }

  // Los avisos de «te quedan 7/3/1 días» y «motor pausado» se reinician DESPUÉS
  // de guardar los días, nunca antes: al revés, si guardar fallara, el cron
  // volvería a mandar un aviso que el hotelero ya recibió. Si el cron corre
  // justo en este instante con la fecha vieja, puede dejar una marca de más; lo
  // peor que pasa es que se salte un recordatorio, no que mande uno falso.
  let avisosSinReiniciar = 0;
  for (const h of hermanos) {
    const extras = await extrasFrescos(admin, h.id);
    if (!extras) {
      avisosSinReiniciar++;
      continue;
    }
    const limpio = extrasSinAvisosPrueba(extras);
    if (!limpio.cambio) continue;
    if (!(await escribirExtras(admin, h.id, limpio.extras))) avisosSinReiniciar++;
  }

  const finAntes = finBaseMs + prueba.diasExtra * DIA_MS;
  const apuntado = await registrarAccion({
    accion: "prueba.dias_extra",
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    userId: hotel.owner_id,
    motivo: cuerpo.motivo,
    antes: { diasExtra: prueba.diasExtra, fin: new Date(finAntes).toISOString() },
    despues: { diasExtra: calculo.diasExtra, fin: new Date(calculo.nuevoFinMs).toISOString() },
    detalle: { diasRegalados: cuerpo.dias, hoteles: hermanos.length, avisosSinReiniciar },
  });

  return listo(
    `Listo: su prueba llega hasta el ${fechaLarga(calculo.nuevoFinMs)}.`,
    apuntado,
    avisosSinReiniciar > 0
      ? `No se pudieron reiniciar los recordatorios de ${avisosSinReiniciar} hotel${avisosSinReiniciar === 1 ? "" : "es"}: puede que no le lleguen los avisos de la nueva fecha.`
      : undefined,
  );
}

// ─── Saldo de Camila ─────────────────────────────────────────────────────────

async function regalarMensajes(
  hotel: HotelAccion,
  cuerpo: Extract<Cuerpo, { accion: "regalar_mensajes" }>,
): Promise<NextResponse> {
  const antes = await leerSaldo(hotel.id);

  let nuevo: number;
  try {
    // `regalo` es el tipo que ya usa scripts/regalar-saldo.mjs: así los regalos
    // del CRM y los de la terminal se leen igual en `saldo_movimientos`.
    nuevo = await acreditarMensajes(hotel.id, cuerpo.mensajes, cuerpo.ref, "regalo");
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/does not exist|Could not find the function|PGRST202|42883/i.test(m)) {
      return error(409, `Falta correr sql/kora-saldo-bot.sql. ${NO_SE_CAMBIO}`);
    }
    console.error(`[crm/hoteles/accion] no se pudo regalar saldo a ${hotel.slug}:`, m);
    // No se sabe si llegó a la base. Repetir con el MISMO diálogo abierto es
    // seguro: el `ref` es el mismo y la base no acredita dos veces.
    return error(500, "No se pudo confirmar el regalo. Vuelve a darle a Regalar sin cerrar la ventana: no se suma dos veces.");
  }

  if (nuevo === SIN_DATO) {
    return NextResponse.json({ ok: true, mensaje: "Ese regalo ya se había aplicado: no se volvió a sumar." });
  }

  const enPrepagoAntes = antes.conocido && antes.mensajes !== SIN_DATO;
  const apuntado = await registrarAccion({
    accion: "saldo.regalar",
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    userId: hotel.owner_id,
    motivo: cuerpo.motivo,
    antes: { mensajes: enPrepagoAntes ? antes.mensajes : null, leido: antes.conocido },
    despues: { mensajes: nuevo },
    detalle: { regalados: cuerpo.mensajes, ref: cuerpo.ref },
  });
  return listo(
    `Listo: le regalaste ${cuerpo.mensajes.toLocaleString("es-MX")} mensajes. Ahora tiene ${nuevo.toLocaleString("es-MX")}.`,
    apuntado,
  );
}

// ─── Demo ────────────────────────────────────────────────────────────────────

async function cambiarDemo(
  admin: Admin,
  hotel: HotelAccion,
  cuerpo: Extract<Cuerpo, { accion: "marcar_demo" | "quitar_demo" }>,
): Promise<NextResponse> {
  const marcar = cuerpo.accion === "marcar_demo";

  const extras = await extrasFrescos(admin, hotel.id);
  if (!extras) return error(503, `No se pudo leer el hotel. ${NO_SE_CAMBIO}`);
  const demoAntes = extras.demo === true;

  if (marcar) {
    const lectura = await leerSuscripcionDelDueno(hotel.owner_id);
    if (lectura.estado !== "ok") return mensajeSuscripcionIlegible(lectura.estado);
    const v = puedeMarcarDemo({ demo: demoAntes, sub: lectura.sub });
    if (!v.ok) return error(409, v.motivo);
  } else {
    const v = puedeQuitarDemo(demoAntes);
    if (!v.ok) return error(409, v.motivo);
  }

  if (!(await escribirExtras(admin, hotel.id, extrasCon(extras, "demo", marcar ? true : undefined)))) {
    return error(500, `No se pudo guardar. ${NO_SE_CAMBIO}`);
  }

  const apuntado = await registrarAccion({
    accion: marcar ? "hotel.demo_marcar" : "hotel.demo_quitar",
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    userId: hotel.owner_id,
    motivo: cuerpo.motivo,
    antes: { demo: demoAntes },
    despues: { demo: marcar },
  });
  return listo(
    marcar
      ? "Listo: ahora es un hotel demo. No caduca, no cobra reservas y Camila no se conecta."
      : "Listo: ya no es demo. Desde ahora manda su prueba o su plan.",
    apuntado,
  );
}

// ─── Bloqueo ─────────────────────────────────────────────────────────────────
// El bloqueo se guarda en `hoteles.extras.bloqueo` y lo lee `accesoDelHotel`, el
// punto único por el que pasan panel, motor, checkout, bot y agente: con esta
// sola bandera se apaga la cuenta entera sin borrar nada. (Antes vivía en
// POST /api/crm/hoteles, sin bitácora y devolviendo el error crudo de Postgres.)

async function cambiarBloqueo(
  admin: Admin,
  hotel: HotelAccion,
  cuerpo: Extract<Cuerpo, { accion: "bloquear" | "desbloquear" }>,
): Promise<NextResponse> {
  const extras = await extrasFrescos(admin, hotel.id);
  if (!extras) return error(503, `No se pudo leer el hotel. ${NO_SE_CAMBIO}`);
  const antes = bloqueoDelHotel(extras);

  let nuevos: Extras;
  let despues: unknown;
  if (cuerpo.accion === "bloquear") {
    // Bloquear uno ya bloqueado cambia el mensaje (y la fecha): es la forma de
    // corregir un mensaje mal escrito sin desbloquear en medio.
    const bloqueo = { activo: true, mensaje: cuerpo.mensaje, fecha: new Date().toISOString() };
    nuevos = extrasCon(extras, "bloqueo", bloqueo);
    despues = bloqueo;
  } else {
    const v = puedeDesbloquear(Boolean(antes));
    if (!v.ok) return error(409, v.motivo);
    nuevos = extrasCon(extras, "bloqueo", undefined);
    despues = null;
  }

  if (!(await escribirExtras(admin, hotel.id, nuevos))) return error(500, `No se pudo guardar. ${NO_SE_CAMBIO}`);

  const apuntado = await registrarAccion({
    accion: cuerpo.accion === "bloquear" ? "hotel.bloquear" : "hotel.desbloquear",
    hotelId: hotel.id,
    hotelSlug: hotel.slug,
    userId: hotel.owner_id,
    motivo: cuerpo.motivo,
    antes: antes ?? null,
    despues,
  });
  return listo(
    cuerpo.accion === "bloquear"
      ? antes
        ? "Listo: se cambió el mensaje del bloqueo."
        : "Listo: la cuenta quedó bloqueada. Panel, reservas y Camila están apagados."
      : "Listo: la cuenta quedó desbloqueada.",
    apuntado,
  );
}
