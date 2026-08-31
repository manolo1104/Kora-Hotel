// Sirve el HTML crudo de un correo del catálogo, tal cual saldría del
// constructor. La pantalla lo mete en un <iframe> para que los estilos del
// correo no se mezclen con los del panel — que es exactamente lo que pasa en el
// cliente de correo real.
//
// SOLO EN DESARROLLO: en producción esta ruta no existe (404). El catálogo
// importa `lib/email/reserva.ts`, que arrastra el cliente service-role, así que
// tampoco conviene que exista.

import { NextRequest, NextResponse } from "next/server";
import { buscarEntrada, type Lang } from "@/lib/email/preview";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const url = new URL(req.url);
  const entrada = buscarEntrada(url.searchParams.get("id") ?? "");
  if (!entrada) return new NextResponse("Ese correo no está en el catálogo.", { status: 404 });

  const lang: Lang = url.searchParams.get("lang") === "en" ? "en" : "es";

  let html: string;
  try {
    html = entrada.render(lang).html;
  } catch (e) {
    // Que una plantilla reviente es un hallazgo, no un accidente: enseñarlo.
    const msg = e instanceof Error ? `${e.message}\n\n${e.stack ?? ""}` : String(e);
    return new NextResponse(
      `<pre style="font:13px ui-monospace,monospace;color:#b91c1c;padding:24px;white-space:pre-wrap;">` +
        `La plantilla "${entrada.id}" lanzó una excepción al construirse:\n\n${msg}</pre>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
