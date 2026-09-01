import { NextResponse } from "next/server";
import { getHotelMember } from "@/lib/tenant";
import { negar } from "@/lib/panel/permisos";
import { getAllBookings, getAllQuotes, buildCRM } from "@/lib/db/admin";
import { construirXlsx, type Hoja } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Descarga TODO lo del hotel en un solo Excel, con una hoja por cosa.
//
// Por qué existe: la página de precios y la pantalla de prueba vencida prometían
// "tus datos son tuyos, los exportas cuando quieras" y el panel no tenía ningún
// botón de exportar (K-8.3). Durante un tiempo se bajó el tono de la frase a "te
// los entregamos cuando los pidas" para no mentir; ahora la promesa vuelve
// entera porque el botón existe.
//
// No es un detalle de cortesía: es el argumento CONTRA el encierro de las OTAs.
// Un hotelero que no puede sacar su lista de huéspedes está tan atrapado con
// nosotros como lo estaba con Booking, y lo primero que pregunta quien ya se
// quemó una vez es cómo se sale.

/** Vacío en vez de "undefined"/"null" impresos dentro de una celda. */
const txt = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

/** Un número sólo si lo es de verdad; si no, celda vacía (nunca un 0 falso). */
const num = (v: unknown): number | "" =>
  typeof v === "number" && Number.isFinite(v) ? v : "";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const ctx = await getHotelMember(slug);
  if (!ctx) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }
  const no = negar(ctx, "datos:exportar");
  if (no) return no;

  // Las tres lecturas van en paralelo: son independientes y esta ruta corre en
  // Vercel Hobby, donde CUALQUIER función se corta a los 60 s. En serie, un
  // hotel con historial largo se acercaba al techo sin necesidad.
  let reservas, cotizaciones, huespedes;
  try {
    [reservas, cotizaciones, huespedes] = await Promise.all([
      getAllBookings(ctx.hotelId),
      getAllQuotes(ctx.hotelId),
      buildCRM(ctx.hotelId),
    ]);
  } catch (e) {
    console.error("[panel.exportar]", slug, e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "No pudimos armar tu archivo. Vuelve a intentarlo en un minuto." },
      { status: 500 },
    );
  }

  const hojas: Hoja[] = [
    {
      nombre: "Reservas",
      encabezados: [
        "Confirmación", "Fecha de la reserva", "Huésped", "Correo", "Teléfono",
        "Check-in", "Check-out", "Noches", "Huéspedes", "Habitaciones",
        "Total (MXN)", "Anticipo (MXN)", "Estado", "Origen",
        "Salida real", "Cómo nos conoció", "Notas",
      ],
      anchos: [16, 18, 26, 26, 16, 12, 12, 8, 10, 24, 13, 14, 13, 12, 12, 22, 42],
      filas: reservas.map((r) => [
        txt(r.confirmacion), txt(r.fecha), txt(r.cliente), txt(r.email), txt(r.telefono),
        txt(r.checkin), txt(r.checkout), num(r.noches), num(r.huespedes), txt(r.habitaciones),
        num(r.total), num(r.anticipo), txt(r.estado), txt(r.origen),
        txt(r.checkoutReal), txt(r.comoNosConocio), txt(r.notas),
      ]),
    },
    {
      // La lista de clientes es lo que un hotel se lleva cuando cambia de
      // sistema: sin ella hay que volver a ganarse a cada huésped que ya volvió
      // una vez.
      nombre: "Huéspedes",
      encabezados: [
        "Correo", "Nombre", "Teléfono", "Reservas", "Gastado (MXN)",
        "Última estancia", "Habitaciones favoritas", "Conversaciones WhatsApp", "Notas",
      ],
      anchos: [26, 26, 16, 10, 14, 15, 28, 22, 42],
      filas: huespedes.map((h) => [
        txt(h.email), txt(h.nombre), txt(h.telefono), num(h.totalReservas), num(h.totalGastado),
        txt(h.ultimaEstancia), h.suitesFavoritas.join(", "), num(h.waConversaciones), txt(h.notas),
      ]),
    },
    {
      nombre: "Cotizaciones",
      encabezados: [
        "Folio", "Fecha", "Cliente", "Correo", "Teléfono",
        "Habitación", "Check-in", "Check-out", "Noches", "Total (MXN)", "Estado", "Notas",
      ],
      anchos: [14, 12, 26, 26, 16, 24, 12, 12, 8, 13, 12, 42],
      filas: cotizaciones.map((c) => [
        txt(c.id), txt(c.fecha), txt(c.cliente), txt(c.email), txt(c.telefono),
        txt(c.suite), txt(c.checkin), txt(c.checkout), num(c.noches), num(c.precioTotal),
        txt(c.estado), txt(c.notas),
      ]),
    },
  ];

  const libro = construirXlsx(hojas);

  // El nombre lleva el slug y la fecha: quien exporte dos veces con un mes de
  // diferencia acaba con dos archivos distinguibles en su carpeta de descargas,
  // no con "exportar (1).xlsx".
  const hoy = new Date().toISOString().slice(0, 10);
  const archivo = `kora-${slug}-${hoy}.xlsx`;

  return new NextResponse(new Uint8Array(libro), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${archivo}"`,
      "content-length": String(libro.length),
      // Son datos personales de huéspedes: que no se queden en ninguna caché
      // intermedia ni en el historial del navegador de una computadora
      // compartida en recepción.
      "cache-control": "no-store, private",
    },
  });
}
