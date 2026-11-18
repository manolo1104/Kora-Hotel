import { negar } from "@/lib/panel/permisos";
import { z } from "zod";
import { rutaSegura } from "@/lib/api/responder";
// Canales OTA del hotel activo. Portado de mi-hotel/app/api/admin/canales.
// El hotel sale de getActiveHotel() (la pestaña que pidió + sesión); el
// hotelId NUNCA viene del body. saveOTACalendar recibe hotelId primero.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getAllOTACalendars, saveOTACalendar } from "@/lib/db/admin";
import { randomUUID } from "crypto";
import { unitNamesOf } from "@/lib/booking";
import { PLATAFORMAS_ICAL, PLATAFORMAS_NUEVAS } from "@/lib/canales/plataformas";
import { fuenteDe } from "@/lib/canales/ical";
import { borrarBloqueosOTA } from "@/lib/db/availability";

export const dynamic = "force-dynamic";

// La plataforma se valida ANTES de escribir. Un valor fuera de la lista
// reventaba el CHECK del SQL, ese error se perdía en un console.error, y la ruta
// respondía {ok:true}: el hotelero creía que había guardado su canal.
const CANAL = z.object({
  // Deliberadamente SIN `.uuid()`: lo que decide si este id se puede tocar es la
  // comprobación de pertenencia de abajo, no su formato. Exigir uuid rompería
  // cualquier canal guardado con otro formato antes de hoy.
  id: z.string().min(1).max(100).optional(),
  // Nombre de la UNIDAD física. Se comprueba abajo contra las del hotel.
  roomName: z.string().min(1).max(200),
  platform: z.enum(PLATAFORMAS_ICAL),
  etiqueta: z.string().trim().max(60).optional(),
  // Igual: `.url()` de zod es más estricto que lo que ya hay guardado. Basta con
  // que sea http(s) — la sincronización ya falla sola si la URL no sirve.
  // webcal:// es lo que copian Airbnb y Google; se guarda como https.
  icalUrl: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .transform((u) => u.replace(/^webcal:\/\//i, "https://"))
    .refine((u) => /^https?:\/\//i.test(u), "la URL debe empezar por http"),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  return rutaSegura("admin.canales.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "canales:leer");
  if (no) return no;

  const calendars = await getAllOTACalendars(ctx.hotelId);
  return NextResponse.json(calendars);
  });
}

export async function POST(req: NextRequest) {
  return rutaSegura("admin.canales.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "canales:escribir");
  if (no) return no;

  const parseado = CANAL.safeParse(await req.json());
  if (!parseado.success) {
    return NextResponse.json(
      { error: "Faltan campos o la plataforma no está soportada." },
      { status: 400 },
    );
  }
  const { roomName, platform, icalUrl, active, id, etiqueta } = parseado.data;

  // Sólo unidades reales: un nombre inventado guardaba bloqueos que ningún
  // calendario mira, y el hotelero creía que su Airbnb estaba enlazado.
  if (!unitNamesOf(ctx.hotel).includes(roomName)) {
    return NextResponse.json({ error: "Esa habitación no existe en tu hotel." }, { status: 400 });
  }
  if (!id && !PLATAFORMAS_NUEVAS.includes(platform)) {
    return NextResponse.json({ error: "Para Expedia elige «Expedia (Vrbo)»." }, { status: 400 });
  }

  // EL ROBO DE CANAL. `saveOTACalendar` hace `upsert(..., { onConflict: "id" })`
  // con la service-role key, así que mandar el `id` de un canal AJENO reescribía
  // esa fila y le ponía tu `hotel_id`: le quitabas el canal de Booking a otro
  // hotel, y desde ese momento su disponibilidad la mandaba tu calendario.
  //
  // Si viene `id`, tiene que ser un canal DE ESTE HOTEL. Si no viene, es nuevo.
  let idFinal: string = randomUUID();
  if (id) {
    const mios = await getAllOTACalendars(ctx.hotelId);
    const previo = mios.find((c) => c.id === id);
    if (!previo) {
      return NextResponse.json({ error: "Ese canal no existe en tu hotel." }, { status: 404 });
    }
    idFinal = id;
    // Si cambia la unidad o la plataforma, los bloqueos que trajo antes ya no
    // son de nadie: se quitan para no dejar noches cerradas por error.
    if (previo.roomName !== roomName || previo.platform !== platform) {
      await borrarBloqueosOTA(ctx.hotelId, previo.roomName, fuenteDe({ id, tipo: previo.platform }));
    }
  }

  await saveOTACalendar(ctx.hotelId, {
    id: idFinal,
    roomName,
    platform,
    icalUrl,
    active,
    ...(platform === "otro" && etiqueta ? { etiqueta } : {}),
  });
  return NextResponse.json({ ok: true });
  });
}
