import { NextResponse } from "next/server";
import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado } from "@/lib/api/rate-limit";
import { agregarFaqBot } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// «Camila contestó esto y estuvo mal; debió contestar esto otro.»
//
// Es el único bucle de aprendizaje REAL que tiene Camila. Hasta hoy el
// entrenamiento era de una sola dirección —el hotelero rellenaba unas casillas
// al principio y ya— y las conversaciones guardadas no modificaban nada: nadie
// leía `camila_conversaciones` para cambiar el prompt.
//
// La corrección se guarda como una FAQ del bot, que es la MISMA lista
// (`extras.bot.faqs`) que ya usa el entrenamiento y que `normalizeFaqs` mete en
// el prompt pisando a la FAQ vieja del sitio. Como el prompt se arma en el
// servidor en cada mensaje, la corrección llega al bot vivo sin tocar Railway.
//
// Permiso `bot:entrenar` y no `bot:responder`: esto no contesta un mensaje,
// cambia lo que Camila le dirá a TODOS los huéspedes a partir de ahora.

const ESQUEMA = z.object({
  // Lo que preguntó el huésped, tal como lo escribió. Sale de la conversación,
  // así que puede venir tal cual del mensaje.
  pregunta: z.string().trim().min(3).max(200),
  respuesta: z.string().trim().min(2).max(1_000),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:entrenar");
  if (no) return no;

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) {
    return NextResponse.json(
      { ok: false, error: "Escribe la pregunta y lo que Camila debió contestar." },
      { status: 400 },
    );
  }

  // Cada corrección reescribe `extras.bot` entero (lectura-modificación-
  // escritura). Sin tope, un clic repetido se pelea consigo mismo sobre la
  // misma fila del hotel.
  if (await limitado("camila.corregir", ctx.hotelId, { max: 60, ventanaMs: 10 * 60_000 })) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas correcciones seguidas. Espera un momento." },
      { status: 429 },
    );
  }

  const ok = await agregarFaqBot(ctx.hotelId, c.datos.pregunta, c.datos.respuesta);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "No pude guardar la corrección. Inténtalo de nuevo." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
