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

export const dynamic = "force-dynamic";

// La plataforma se valida ANTES de escribir. Un valor fuera de estos dos
// reventaba el CHECK del SQL, ese error se perdía en un console.error, y la ruta
// respondía {ok:true}: el hotelero creía que había guardado su canal.
const CANAL = z.object({
  // Deliberadamente SIN `.uuid()`: lo que decide si este id se puede tocar es la
  // comprobación de pertenencia de abajo, no su formato. Exigir uuid rompería
  // cualquier canal guardado con otro formato antes de hoy.
  id: z.string().min(1).max(100).optional(),
  roomName: z.string().min(1).max(200),
  platform: z.enum(["booking_com", "expedia"]),
  // Igual: `.url()` de zod es más estricto que lo que ya hay guardado. Basta con
  // que sea http(s) — la sincronización ya falla sola si la URL no sirve.
  icalUrl: z.string().min(1).max(2000).regex(/^https?:\/\//i, "la URL debe empezar por http"),
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
  const { roomName, platform, icalUrl, active, id } = parseado.data;

  // EL ROBO DE CANAL. `saveOTACalendar` hace `upsert(..., { onConflict: "id" })`
  // con la service-role key, así que mandar el `id` de un canal AJENO reescribía
  // esa fila y le ponía tu `hotel_id`: le quitabas el canal de Booking a otro
  // hotel, y desde ese momento su disponibilidad la mandaba tu calendario.
  //
  // Si viene `id`, tiene que ser un canal DE ESTE HOTEL. Si no viene, es nuevo.
  let idFinal: string = randomUUID();
  if (id) {
    const mios = await getAllOTACalendars(ctx.hotelId);
    if (!mios.some((c) => c.id === id)) {
      return NextResponse.json({ error: "Ese canal no existe en tu hotel." }, { status: 404 });
    }
    idFinal = id;
  }

  await saveOTACalendar(ctx.hotelId, {
    id: idFinal,
    roomName,
    platform,
    icalUrl,
    active,
  });
  return NextResponse.json({ ok: true });
  });
}
