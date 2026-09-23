import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { emailAnuncio, TIPO_ANUNCIO } from "@/lib/email/anuncio";
import { emailAvisoCamila, TIPO_AVISO_CAMILA } from "@/lib/email/aviso-camila";
import { emailAvisoRecargas, TIPO_AVISO_RECARGAS } from "@/lib/email/aviso-recargas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El aviso de novedades a los HOTELEROS de Kora.
//
// El público son los dueños de los hoteles dados de alta, no la lista de
// captación: esto habla de dos cosas que ya están en SU panel, así que a quien
// sólo descargó la guía no le dice nada y a un cliente le dice bastante.
//
// Le escribe a personas reales y no se deshace, así que está montado para que
// sea difícil dispararlo sin querer e imposible mandarlo dos veces:
//
// 1. POR DEFECTO NO MANDA NADA. Sin parámetros cuenta a cuántos les llegaría.
// 2. HAY MODO PRUEBA: `?prueba=correo@x` manda UNA copia a esa dirección y
//    nada más — ni toca la lista ni deja apuntes.
// 3. NO SE PUEDE DUPLICAR. El apunte en `email_log` (único por
//    hotel+confirmacion+tipo) va ANTES del envío. Al revés, un fallo entre
//    medias le manda el mismo correo dos veces a la misma persona.
// 4. Sólo con `CRON_SECRET`, igual que el resto de los crons.
//
//   Ensayo:  curl -H "authorization: Bearer $CRON_SECRET" ".../api/cron/anuncio"
//   Prueba:  curl -H "authorization: Bearer $CRON_SECRET" ".../api/cron/anuncio?prueba=tu@correo.com"
//   Envío:   curl -H "authorization: Bearer $CRON_SECRET" ".../api/cron/anuncio?enviar=1"

/** Tope por corrida. Una lista grande se manda por partes. */
const TOPE = 500;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FilaHotel {
  id: string;
  nombre: string | null;
  owner_id: string | null;
  extras: Record<string, unknown> | null;
}

/** Un hotelero al que hay que escribirle, ya con su correo resuelto. */
interface Destinatario {
  hotelId: string;
  hotel: string;
  email: string;
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no-autorizado" }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, error: "sin-service-role" }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const prueba = (params.get("prueba") ?? "").trim();
  const enviar = params.get("enviar") === "1";

  // QUÉ correo se manda. Todo lo demás de esta ruta (el ensayo por defecto, el
  // modo prueba, el apunte antes del envío y el tope) es igual para todos: lo
  // único que cambia es el texto y el tipo con el que se apunta, que es lo que
  // impide mandar dos veces el mismo. Sin `?aviso=`, el de siempre.
  const AVISOS = {
    novedades: { construir: emailAnuncio, tipo: TIPO_ANUNCIO },
    "camila-mantenimiento": {
      construir: (d: { nombre?: string }) => emailAvisoCamila(d),
      tipo: TIPO_AVISO_CAMILA,
    },
    "recargas-octubre": {
      construir: (d: { nombre?: string }) => emailAvisoRecargas(d),
      tipo: TIPO_AVISO_RECARGAS,
    },
  } as const;
  const cual = (params.get("aviso") ?? "novedades") as keyof typeof AVISOS;
  if (!AVISOS[cual]) {
    return NextResponse.json(
      { ok: false, error: "ese-aviso-no-existe", disponibles: Object.keys(AVISOS) },
      { status: 400 },
    );
  }
  const { construir: emailDeEsteAviso, tipo: TIPO } = AVISOS[cual];

  const admin = createAdminClient();

  // ── Modo prueba: UNA copia, a una dirección, sin tocar nada más ──
  if (prueba) {
    if (!CORREO.test(prueba)) {
      return NextResponse.json({ ok: false, error: "ese-correo-no-es-valido" }, { status: 400 });
    }
    if (!resendEnvReady) return NextResponse.json({ ok: false, error: "sin-resend" }, { status: 503 });
    const envio = await enviarEmail({ to: prueba, ...emailDeEsteAviso({ nombre: "" }) });
    return NextResponse.json({
      ok: envio.ok,
      modo: "PRUEBA — sólo a esa dirección, la lista no se tocó",
      para: prueba,
      ...(envio.ok ? {} : { error: envio.error }),
    });
  }

  // ── El público: dueños de hoteles reales ──
  const { data, error } = await admin
    .from("hoteles")
    .select("id, nombre, owner_id, extras")
    .not("owner_id", "is", null)
    .limit(TOPE);

  if (error) {
    console.error("[cron/anuncio] no se pudieron leer los hoteles:", error.message);
    return NextResponse.json({ ok: false, error: "no-se-pudo-leer" }, { status: 500 });
  }

  // El hotel de demostración no es un cliente: no se le escribe.
  const hoteles = ((data ?? []) as FilaHotel[]).filter(
    (h) => (h.extras as { demo?: boolean } | null)?.demo !== true,
  );

  const destinatarios: Destinatario[] = [];
  const yaVisto = new Set<string>();
  let sinCorreo = 0;

  for (const h of hoteles) {
    const { data: u, error: e } = await admin.auth.admin.getUserById(h.owner_id!);
    const email = (u?.user?.email ?? "").trim().toLowerCase();
    if (e || !email) {
      sinCorreo++;
      if (e) console.error(`[cron/anuncio] sin correo para el dueño de ${h.nombre}:`, e.message);
      continue;
    }
    // Un dueño con tres hoteles recibe UN correo, no tres.
    if (yaVisto.has(email)) continue;
    yaVisto.add(email);
    destinatarios.push({ hotelId: h.id, hotel: h.nombre ?? "", email });
  }

  // ── Ensayo: se cuenta, no se manda ──
  if (!enviar) {
    return NextResponse.json({
      ok: true,
      modo: "ENSAYO — no se mandó nada",
      leLlegariaA: destinatarios.length,
      hoteles: destinatarios.map((d) => d.hotel),
      duenosSinCorreo: sinCorreo,
      correoConfigurado: resendEnvReady,
      aviso: cual,
      asunto: emailDeEsteAviso({}).subject,
      paraProbarlo: "?prueba=tu@correo.com",
      paraMandarloDeVerdad: "?enviar=1",
    });
  }

  if (!resendEnvReady) return NextResponse.json({ ok: false, error: "sin-resend" }, { status: 503 });

  const total = { enviados: 0, yaLoTenian: 0, fallidos: 0 };

  for (const d of destinatarios) {
    // El apunte va ANTES del envío: si esto se lanza dos veces, la segunda choca
    // contra el índice único (hotel_id, confirmacion, email_type) y no escribe.
    const { error: yaEstaba } = await admin.from("email_log").insert({
      hotel_id: d.hotelId,
      confirmacion: TIPO,
      email_type: TIPO,
      email_destino: d.email,
    });
    if (yaEstaba) {
      total.yaLoTenian++;
      continue;
    }

    const envio = await enviarEmail({ to: d.email, ...emailDeEsteAviso({ nombre: "" }) });
    if (envio.ok) {
      total.enviados++;
    } else {
      total.fallidos++;
      console.error("[cron/anuncio] no salió:", envio.error);
      // Se libera el apunte para poder reintentarlo en otra corrida.
      await admin
        .from("email_log")
        .delete()
        .eq("hotel_id", d.hotelId)
        .eq("confirmacion", TIPO)
        .eq("email_type", TIPO);
    }
  }

  console.log(`[cron/anuncio] enviados ${total.enviados}, ya lo tenían ${total.yaLoTenian}, fallidos ${total.fallidos}`);
  return NextResponse.json({ ok: true, modo: "ENVIADO", ...total });
}
