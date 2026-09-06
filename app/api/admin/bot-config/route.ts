import { negar, puedeCtx } from "@/lib/panel/permisos";
// Configuración + entrenamiento de Camila para el hotel de la cuenta activa.
// GET: estado (on/off, idioma), entrenamiento actual (extras.bot) y un resumen de
// "lo que Camila ya sabe" (sacado ESTRICTAMENTE de los datos de este hotel).
// POST: guarda on/off, idioma y entrenamiento. Auth por getActiveHotel().

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { saveBotConfig, type BotTrainingInput } from "@/lib/db/admin";
import { hotelRooms } from "@/lib/booking";
import { normalizeFaqs } from "@/lib/bot/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max = 4000) =>
  typeof v === "string" ? v.trim().slice(0, max) : undefined;

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const noLee = negar(ctx, "bot:leer");
  if (noLee) return noLee;

  // La CLABE y el número admin son del DUEÑO. `bot:leer` es de mando, así que
  // la encargada abre esta pantalla — y hasta ahora se llevaba la cuenta de
  // banco entera en la respuesta. Poder verla es media fuga: el aviso de la
  // pantalla de equipo le promete al dueño que esos datos son sólo suyos.
  // Se le mandan vacíos, y el POST de abajo ignora lo que devuelva, así que
  // reenviar el formulario no los borra.
  const puedeConfigurar = puedeCtx(ctx, "bot:configurar");

  const hotel = ctx.hotel;
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const bot = (extras.bot ?? {}) as Record<string, unknown>;
  const pago = (bot.pago ?? {}) as Record<string, unknown>;
  const emojis = (bot.emojis ?? {}) as Record<string, unknown>;
  const rooms = hotelRooms(hotel);

  return NextResponse.json({
    enabled: cfg.bot_enabled === undefined ? true : cfg.bot_enabled !== false,
    lang: cfg.bot_lang === "en" ? "en" : "es",
    whatsapp: hotel.whatsapp, // default para "escalar a humano"
    adminPhone: puedeConfigurar ? (str(cfg.bot_admin_phone, 40) ?? "") : "",
    // Para que el panel sepa esconder esos campos en vez de enseñarlos vacíos.
    puedeConfigurar,
    bot: {
      nombre: str(bot.nombre) ?? "",
      tono: str(bot.tono) ?? "",
      saludo: str(bot.saludo) ?? "",
      instrucciones: str(bot.instrucciones) ?? "",
      escalarWhatsapp: str(bot.escalarWhatsapp) ?? "",
      pago: puedeConfigurar
        ? {
            titular: str(pago.titular) ?? "",
            banco: str(pago.banco) ?? "",
            clabe: str(pago.clabe) ?? "",
            cuenta: str(pago.cuenta) ?? "",
            notas: str(pago.notas) ?? "",
          }
        : { titular: "", banco: "", clabe: "", cuenta: "", notas: "" },
      emojis: {
        nivel: ["nada", "bajo", "medio", "alto"].includes(emojis.nivel as string)
          ? (emojis.nivel as string)
          : "medio",
        preferidos: str(emojis.preferidos, 80) ?? "",
      },
      faqs: normalizeFaqs(bot.faqs),
      entrenadoAt: str(bot.entrenadoAt) ?? null,
      probadoAt: str(bot.probadoAt) ?? null, // ya probó el bot (paso 5)
      pruebas: Number(bot.pruebas) || 0, // interacciones de prueba exitosas (meta: 3)
    },
    // Lo que Camila ya sabe, de los datos REALES de este hotel.
    conocimiento: {
      descripcion: hotel.descripcion ?? "",
      cuartos: rooms.map((r) => ({ nombre: r.name, maxHuespedes: r.maxGuests })),
      amenidades: (extras.amenidades as string[]) ?? [],
      faqs: normalizeFaqs(extras.faqs), // FAQs reales del panel (ya normalizadas)
      politicas: (extras.politicas as Record<string, unknown>) ?? {},
      guia: (hotel.guia as Record<string, unknown>) ?? {},
    },
  });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  // Entrenar a Camila es trabajo operativo: lo hace también la encargada.
  const noEsMando = negar(ctx, "bot:entrenar");
  if (noEsMando) return noEsMando;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // Dos campos de este POST no son configuración, son dinero y credenciales, y
  // sólo los toca el dueño:
  //
  // · `bot.pago` (titular/banco/CLABE/cuenta) entra LITERAL al prompt con el que
  //   Camila habla con los huéspedes. Cambiar la CLABE ahí hace que el propio
  //   hotel le dicte a cada huésped que pida transferencia una cuenta ajena,
  //   pidiéndole el comprobante para "confirmar la reserva". El hotelero no se
  //   entera hasta que llega alguien con un depósito que nunca aterrizó.
  // · `adminPhone` es la ÚNICA credencial del comando de apagado por WhatsApp:
  //   quien lo ponga en su celular se queda con el interruptor del bot.
  //
  // Antes ninguna de las seis rutas `bot-*` miraba el rol: bastaba ser miembro,
  // así que recepción, cocina o limpieza podían hacer las dos cosas.
  // SE DESCARTA LO PROTEGIDO, NO SE RECHAZA TODO.
  //
  // Antes bastaba con que la clave `pago` VINIERA en el cuerpo para exigir
  // `bot:configurar`, y el autoguardado del panel manda siempre el objeto `bot`
  // entero — pago incluido, aunque el hotelero sólo haya tocado el saludo. Al
  // cerrar la escalada de permisos, la encargada dejó de tener ese permiso y con
  // él perdió la capacidad de guardar NADA: cada tecla acababa en un 403 que el
  // panel enseñaba como un fallo de conexión.
  //
  // Lo que protege la CLABE no es rechazar la petición entera: es no escribirla.
  // Quien no puede configurar guarda su entrenamiento y los campos del dueño se
  // quedan como estaban. Y como el GET tampoco se los manda, reenviar el
  // formulario no los borra.
  const puedeConfigurar = puedeCtx(ctx, "bot:configurar");
  if (!puedeConfigurar) {
    if (body.bot && typeof body.bot === "object") {
      delete (body.bot as Record<string, unknown>).pago;
    }
    delete body.adminPhone;
  }

  const input: {
    enabled?: boolean;
    lang?: "es" | "en";
    adminPhone?: string;
    probadoAt?: string;
    prueba?: boolean;
    bot?: BotTrainingInput;
  } = {};
  if (typeof body.enabled === "boolean") input.enabled = body.enabled;
  if (body.lang === "es" || body.lang === "en") input.lang = body.lang;
  // Número admin para controlar a Camila por WhatsApp: guardamos solo dígitos.
  if (typeof body.adminPhone === "string") {
    input.adminPhone = body.adminPhone.replace(/\D/g, "").slice(0, 20);
  }
  // Una interacción de prueba exitosa (chat demo o verificador): el servidor
  // lleva la cuenta y marca probadoAt al llegar a 3 (criterio honesto).
  if (body.prueba === true) input.prueba = true;
  // Compat: el flag viejo marcaba probadoAt directo con un solo mensaje.
  else if (body.probado === true) input.prueba = true;

  if (body.bot && typeof body.bot === "object") {
    const b = body.bot as Record<string, unknown>;
    const faqs = Array.isArray(b.faqs)
      ? normalizeFaqs(b.faqs)
          .slice(0, 30) // tope sano
          .map((f) => ({ q: f.q, a: f.a ?? "" }))
      : undefined;
    const p = (b.pago && typeof b.pago === "object" ? b.pago : {}) as Record<string, unknown>;
    const em = (b.emojis && typeof b.emojis === "object" ? b.emojis : {}) as Record<string, unknown>;
    input.bot = {
      nombre: str(b.nombre, 60),
      tono: str(b.tono, 2000),
      saludo: str(b.saludo, 600),
      instrucciones: str(b.instrucciones, 4000),
      escalarWhatsapp: str(b.escalarWhatsapp, 40),
      pago: {
        titular: str(p.titular, 120),
        banco: str(p.banco, 80),
        clabe: str(p.clabe, 40),
        cuenta: str(p.cuenta, 40),
        notas: str(p.notas, 600),
      },
      emojis: {
        nivel: ["nada", "bajo", "medio", "alto"].includes(em.nivel as string)
          ? (em.nivel as "nada" | "bajo" | "medio" | "alto")
          : "medio",
        preferidos: str(em.preferidos, 80),
      },
      ...(faqs ? { faqs } : {}),
    };
  }

  // Si no se guardó, se dice: el panel enseña "Guardado ✓" y mueve el
  // interruptor con este `ok`, así que un ok:true de mentira le hacía creer al
  // hotelero que había apagado a Camila (o que su entrenamiento estaba puesto)
  // cuando en la base no había cambiado nada.
  const guardado = await saveBotConfig(ctx.hotelId, input);
  if (!guardado) {
    return NextResponse.json({ ok: false, error: "no-guardado" }, { status: 503 });
  }
  // Lo que de VERDAD quedó guardado, no lo que se mandó: los textos se recortan
  // al guardar (tono 2000, instrucciones 4000…) y el panel seguía enseñando el
  // texto completo con un "Guardado" al lado. Devolverlo deja que la pantalla
  // muestre lo que existe.
  return NextResponse.json({ ok: true, bot: input.bot ?? null });
}
