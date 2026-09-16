import { alertar } from "@/lib/alertas";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { emailDigest } from "@/lib/email/templates";
import { calcularMrr, type FilaSuscMrr } from "@/lib/crm/operaciones";
import { suscripcionesStripe, type Lectura, type SuscripcionStripe } from "@/lib/crm/fuentes";
import { leer } from "@/lib/db/result";
import { correosFallidos, anotarReintento, MAX_INTENTOS } from "@/lib/email/bitacora";
import { sendConfirmacionReserva } from "@/lib/email/reserva";
import { bookingBrandFromHotel } from "@/lib/email/booking-branded";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
// El mismo `esc` que los correos: aquí había otra copia, y también sin comillas.
import { esc } from "@/lib/email/design";
import { limpiarLimitador } from "@/lib/api/rate-limit";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Desde que el MRR sale de Stripe, esta ruta espera a alguien de fuera (hasta 6 s,
// ver `STRIPE_TOPE_MS`) ANTES de armar el correo, y después reenvía una por una
// las confirmaciones que no salieron. Con el tope corto por defecto, un Stripe
// lento se come el presupuesto y el resumen del día NO se manda: ni los leads sin
// contactar ni los pagos vencidos. Mismo número que /crm y que los demás crons.
export const maxDuration = 60;

// Digest diario para el fundador (cron de Vercel, ver vercel.json).
// Junta lo que requiere su atención: leads nuevos, seguimientos vencidos,
// pagos con problema y chats escalados. Si no hay nada, no manda correo.

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto) return false;
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}

/**
 * Stripe con un tope propio, más corto que el de `suscripcionesStripe` (15 s).
 * El MRR es una línea del correo; los leads sin contactar y los pagos vencidos
 * son el correo. Si Stripe tarda y la función se queda sin tiempo, no sale
 * NADA. Pasado el tope, el MRR sale estimado y el correo dice por qué.
 */
const STRIPE_TOPE_MS = 6_000;

function stripeConTope(): Promise<Lectura<Map<string, SuscripcionStripe>>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<Lectura<Map<string, SuscripcionStripe>>>((resolver) => {
    timer = setTimeout(() => resolver({ ok: false, data: new Map(), error: "sin-respuesta" }), STRIPE_TOPE_MS);
  });
  return Promise.race([suscripcionesStripe(), tope]).finally(() => clearTimeout(timer));
}

function linkWa(contacto: string | null, nombre: string | null): string {
  const digitos = (contacto ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  const numero = digitos.length === 10 ? `52${digitos}` : digitos;
  const txt = encodeURIComponent(`Hola ${nombre ?? ""}, soy Manolo de Kora 👋`.trim());
  return ` — <a href="https://wa.me/${numero}?text=${txt}">WhatsApp</a>`;
}

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady || !NOTIFY_EMAIL) {
    return NextResponse.json({ ok: false, motivo: "Sin BD o sin NOTIFY_EMAIL." });
  }

  const admin = createAdminClient();
  const hace24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const hoy = new Date().toISOString().slice(0, 10);

  const [leadsNuevos, seguimientos, vencidos, escalados, activas, stripe] = await Promise.all([
    // TODOS los leads que siguen en "nuevo", no solo los de las últimas 24 h.
    // Antes se filtraba por `created_at >= hace24h`: un lead que no contestabas
    // hoy desaparecía del resumen mañana y ya nadie lo volvía a recordar.
    admin
      .from("crm_leads")
      .select("hotel_nombre, tomador_nombre, contacto, origen, created_at")
      .eq("etapa", "nuevo")
      .order("created_at", { ascending: true })
      .limit(40),
    admin
      .from("crm_leads")
      .select("hotel_nombre, tomador_nombre, contacto, etapa, proximo_seguimiento")
      .lte("proximo_seguimiento", hoy)
      .not("etapa", "in", '("ganado","perdido")')
      .order("proximo_seguimiento", { ascending: true })
      .limit(20),
    admin
      .from("suscripciones")
      .select("user_id, plan, avisos_dunning")
      .eq("estado", "pago_vencido"),
    admin
      .from("soporte_conversaciones")
      .select("pagina, mensajes")
      .eq("escalado", true)
      .gte("updated_at", hace24h)
      .limit(10),
    // TODAS las filas, no sólo activa/cortesía: el MRR se calcula con la misma
    // función que /crm (`calcularMrr`) y tiene que recibir lo mismo para dar el
    // mismo número.
    admin.from("suscripciones").select("user_id, plan, estado, stripe_customer_id"),
    // Stripe dice quién paga de verdad: el webhook guarda como `activa` a quien
    // sigue en prueba con tarjeta. No lanza; si falla, el MRR sale estimado y
    // el correo lo dice.
    stripeConTope(),
  ]);

  const secciones: { encabezado: string; lineas: string[] }[] = [];

  // El silencio y el cero tienen que verse distintos. Antes cada sección se
  // comprobaba sólo con `.data?.length`, así que una consulta rota era
  // indistinguible de "no hay nada" y el resumen —el mecanismo entero de que
  // nada se pierda— omitía la sección sin decirlo. Un lead sin contactar
  // desaparecía del correo y nadie se enteraba nunca.
  const rotas: string[] = [];
  for (const [nombre, r] of [
    ["leads nuevos", leadsNuevos],
    ["seguimientos de hoy", seguimientos],
    ["pagos vencidos", vencidos],
    ["chats escalados", escalados],
    ["suscripciones activas", activas],
  ] as const) {
    if (r.error) {
      console.error(`[cron/digest] no se pudo leer ${nombre}:`, r.error.message);
      rotas.push(nombre);
    }
  }
  if (rotas.length) {
    secciones.push({
      encabezado: "⚠️ Datos que no se pudieron leer",
      lineas: rotas.map((n) => `⚠️ No se pudo leer ${n}`),
    });
  }

  if (leadsNuevos.data?.length) {
    // Los más viejos primero y con los días que llevan esperando: un lead de 5
    // días sin contactar debe verse peor que uno de hoy.
    const dias = (iso: string | null) =>
      iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : 0;
    secciones.push({
      encabezado: `🆕 Leads sin contactar (${leadsNuevos.data.length})`,
      lineas: leadsNuevos.data.map((l) => {
        const d = dias(l.created_at as string | null);
        const espera =
          d === 0 ? "hoy" : d === 1 ? "<b>lleva 1 día</b>" : `<b>lleva ${d} días</b>`;
        return `<b>${esc(l.hotel_nombre)}</b> (${esc(l.tomador_nombre ?? "?")}, vía ${esc(l.origen ?? "?")}) — ${espera}${linkWa(l.contacto, l.tomador_nombre)}`;
      }),
    });
  }

  if (seguimientos.data?.length) {
    secciones.push({
      encabezado: `📅 Seguimientos vencidos (${seguimientos.data.length})`,
      lineas: seguimientos.data.map(
        (l) =>
          `<b>${esc(l.hotel_nombre)}</b> — etapa ${esc(l.etapa)}, tocaba el ${l.proximo_seguimiento}${linkWa(l.contacto, l.tomador_nombre)}`
      ),
    });
  }

  if (vencidos.data?.length) {
    secciones.push({
      encabezado: `💳 Suscripciones con pago vencido (${vencidos.data.length})`,
      lineas: vencidos.data.map(
        (s) => `Plan ${esc(s.plan ?? "?")} — ${s.avisos_dunning} aviso(s) enviados`
      ),
    });
  }

  if (escalados.data?.length) {
    secciones.push({
      encabezado: `💬 Chats de soporte escalados (${escalados.data.length})`,
      lineas: escalados.data.map((c) => {
        const msgs = Array.isArray(c.mensajes) ? c.mensajes : [];
        const ultimo = [...msgs].reverse().find((m) => m?.rol === "user");
        return `En ${esc(c.pagina ?? "?")}: “${esc(String(ultimo?.texto ?? "").slice(0, 120))}”`;
      }),
    });
  }

  // MRR: la MISMA cuenta que /crm. El comentario de aquí decía «cortesía cuenta
  // $0», pero la consulta traía activa Y cortesía y les sumaba a las dos el
  // precio del plan (las cortesías se dan con plan='kora'): cada cortesía
  // inflaba el MRR del correo en una mensualidad entera, y el correo y /crm
  // daban dos cifras distintas del mismo negocio. Tampoco distinguía a quien
  // sigue en prueba de Stripe, que todavía no ha pagado nada.
  const filas = activas.error ? null : ((activas.data ?? []) as FilaSuscMrr[]);
  const conPlanDePago = (filas ?? []).filter((s) => s.estado === "activa").length;
  const deCortesia = (filas ?? []).filter((s) => s.estado === "cortesia").length;
  const conPlan = conPlanDePago + deCortesia;
  if (filas && conPlan > 0) {
    const mrr = calcularMrr(filas, stripe);
    const pesos = `$${Math.round(mrr.mrr ?? 0).toLocaleString("es-MX")} MXN`;
    const detalle: string[] = [];
    if (mrr.fuente === "stripe") {
      detalle.push(`${mrr.pagando} cobrando en Stripe`);
      if (mrr.enPruebaConTarjeta) detalle.push(`${mrr.enPruebaConTarjeta} en prueba con tarjeta, no suman`);
    }
    if (mrr.cortesia) detalle.push(`${mrr.cortesia} de cortesía, $0`);
    secciones.push({
      encabezado: "📈 Estado del negocio",
      lineas: [
        // La cortesía NO es una suscripción activa. La línea de siempre decía
        // «6 suscripción(es) activa(s)» contando también las regaladas, justo
        // encima de un MRR que sólo suma las que cobran: dos cifras que se
        // contradecían en el mismo recuadro.
        `${conPlanDePago} cuenta${conPlanDePago === 1 ? "" : "s"} con plan activo` +
          (deCortesia ? ` y ${deCortesia} de cortesía` : ""),
        mrr.fuente === "stripe"
          ? `MRR: ${pesos}${detalle.length ? ` (${detalle.join("; ")})` : ""}`
          : `MRR aproximado: ${pesos} — estimado porque ${esc(mrr.motivo ?? "Stripe no se pudo leer")}: cuenta como pagando a quien sigue en prueba con tarjeta${detalle.length ? ` (${detalle.join("; ")})` : ""}`,
      ],
    });
  }

  // ── Correos que no salieron: se reintentan y se reportan ──────────────────
  // Va colgado del digest y NO de un cron nuevo: Vercel Hobby ya tiene los 7
  // que permite el plan, y éste es el primero que corre cada día (14:00 UTC).
  const reintento = await reintentarConfirmaciones(admin);
  if (reintento.lineas.length > 0) {
    secciones.push({ encabezado: "📮 Correos que no salieron", lineas: reintento.lineas });
  }

  // Poda del limitador por IP. Va enganchada aquí y no en su propio cron porque
  // Vercel Hobby sólo admite crons de una vez al día y ya hay ocho; añadir el
  // noveno para un `delete` de una línea no lo vale. Su resultado NO entra en el
  // resumen: al hotelero no le dice nada, y este correo compite por su atención
  // con todo lo demás que sí tiene que leer.
  const podadas = await limpiarLimitador();

  if (secciones.length === 0) {
    return NextResponse.json({
      ok: true,
      enviado: false,
      motivo: "Nada que reportar.",
      limitadorPodado: podadas,
    });
  }
  if (rotas.length === 5) {
    // Las cinco consultas rotas no es "un resumen con avisos": es la base caída.
    await alertar("el resumen diario no pudo leer nada", `Fallaron las 5 consultas del digest.`);
  }

  const envio = await enviarEmail({
    to: NOTIFY_EMAIL,
    ...emailDigest({ titulo: "☀️ Tu resumen de Kora de hoy", secciones }),
  });

  return NextResponse.json({
    ok: true,
    enviado: envio.ok,
    error: envio.ok ? undefined : envio.error,
    secciones: secciones.length,
    correosReintentados: reintento.reintentados,
    correosRecuperados: reintento.recuperados,
    limitadorPodado: podadas,
  });
}

/**
 * Reintenta las confirmaciones de reserva que quedaron marcadas como fallidas.
 *
 * El HTML no se guarda en ningún sitio, así que el correo se vuelve a ARMAR
 * desde la reserva —igual que el botón de reenviar del portal—. Eso también
 * significa que si la reserva se canceló mientras tanto, el reintento se salta:
 * mandarle su confirmación a alguien al que ya se le devolvió el dinero es
 * decirle que su reserva sigue en pie.
 */
async function reintentarConfirmaciones(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ reintentados: number; recuperados: number; lineas: string[] }> {
  const fallidos = await correosFallidos();
  if (fallidos.length === 0) return { reintentados: 0, recuperados: 0, lineas: [] };

  const lineas: string[] = [];
  let reintentados = 0;
  let recuperados = 0;

  for (const fila of fallidos) {
    if (fila.email_type !== "confirmacion_reserva" || !fila.confirmacion) continue;

    const reserva = await leer<BookingParaCorreo>(
      "digest.reservaDelCorreoFallido",
      admin
        .from("bookings")
        .select("confirmacion, cliente, email, habitaciones, checkin, checkout, total, anticipo, estado, rate_plan, hoteles(nombre, config, extras, whatsapp, ubicacion)")
        .eq("hotel_id", fila.hotel_id)
        .eq("confirmacion", fila.confirmacion)
        .maybeSingle(),
    );
    if (!reserva) continue;
    if (!reservaCuenta(reserva.estado)) {
      // Ya no cuenta: se cierra la fila para que no se reintente para siempre.
      await anotarReintento(fila, { ok: true, id: null });
      continue;
    }

    const destino = reserva.email || fila.email_destino || "";
    if (!destino.includes("@")) continue;

    reintentados++;
    const hotelRow = reserva.hoteles;
    const resultado = await sendConfirmacionReserva(
      destino,
      {
        hotelNombre: hotelRow?.nombre ?? "el hotel",
        confirmacion: reserva.confirmacion,
        habitaciones: (reserva.habitaciones ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        checkin: reserva.checkin,
        checkout: reserva.checkout,
        anticipo: Number(reserva.anticipo) || 0,
        pendiente: Math.max(0, (Number(reserva.total) || 0) - (Number(reserva.anticipo) || 0)),
        cliente: reserva.cliente,
        ratePlan: reserva.rate_plan,
        portalUrl: `${SITE}/reserva/consultar`,
        brand: hotelRow ? bookingBrandFromHotel(hotelRow) : undefined,
      },
      (hotelRow?.config?.email_from as string) || null,
    );
    await anotarReintento(fila, resultado);

    if (resultado.ok) {
      recuperados++;
      lineas.push(`✅ <strong>${esc(reserva.confirmacion)}</strong> — reenviada a ${esc(destino)}`);
    } else {
      const n = fila.intentos + 1;
      lineas.push(
        `❌ <strong>${esc(reserva.confirmacion)}</strong> — intento ${n}/${MAX_INTENTOS}: ${esc(resultado.error)}` +
          (n >= MAX_INTENTOS ? " · <strong>se deja de reintentar</strong>" : ""),
      );
    }
  }

  return { reintentados, recuperados, lineas };
}

interface BookingParaCorreo {
  confirmacion: string;
  cliente: string | null;
  email: string | null;
  habitaciones: string | null;
  checkin: string;
  checkout: string;
  total: number | null;
  anticipo: number | null;
  estado: string;
  rate_plan: string | null;
  hoteles: {
    nombre: string;
    config?: Record<string, unknown> | null;
    extras?: Record<string, unknown> | null;
    whatsapp?: string | null;
    ubicacion?: string | null;
  } | null;
}
