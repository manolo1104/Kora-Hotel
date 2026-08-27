import { NextResponse } from "next/server";
import { darDeBaja } from "@/lib/suscriptores-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La baja de un clic que disparan Gmail y Outlook desde su propio botón
// ("Cancelar suscripción", arriba del correo). Es el RFC 8058: el cliente de
// correo manda un POST a la URL del `List-Unsubscribe` sin abrir el navegador.
//
// Que esto exista es lo que evita que la gente marque spam en su lugar. Y el
// spam aquí no se paga barato: Kora manda desde el mismo dominio por el que
// salen las confirmaciones de reserva de los hoteles clientes.
//
// La versión con cara para humanos es /baja (app/baja/page.tsx).

async function procesar(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const r = await darDeBaja(token, "reporte");
  // 200 aunque el token no sirva: el cliente de correo no sabe qué hacer con un
  // error y reintentaría. Lo que importa es que la baja real sí se aplicó.
  return NextResponse.json({ ok: r.ok });
}

export async function POST(req: Request) {
  return procesar(req);
}

// Algunos clientes viejos siguen el List-Unsubscribe con GET.
export async function GET(req: Request) {
  return procesar(req);
}
