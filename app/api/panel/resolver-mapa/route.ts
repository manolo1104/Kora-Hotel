import { negar } from "@/lib/panel/permisos";
// Expande un link CORTO de Google Maps (maps.app.goo.gl / goo.gl) siguiendo su
// redirección, y devuelve { embedUrl, mapsUrl } listos para el editor. Solo
// resuelve dominios de Google (evita usarse como proxy SSRF) y requiere sesión.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { construirMapa, esLinkCorto } from "@/lib/maps";
import { saltoPermitido, MAX_SALTOS } from "@/lib/maps-redirecciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hosts de link corto de Google que aceptamos expandir.
const HOSTS_PERMITIDOS = ["maps.app.goo.gl", "goo.gl", "g.co", "maps.google.com"];

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;

  let input = "";
  try {
    const body = (await req.json()) as { input?: string };
    input = String(body.input ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  if (!input) return NextResponse.json({ error: "Falta la dirección o el link." }, { status: 400 });

  // Si NO es link corto, resolvemos directo sin salir a la red.
  if (!esLinkCorto(input)) {
    return NextResponse.json(construirMapa(input));
  }

  // Validar host antes de hacer fetch.
  let host = "";
  try {
    host = new URL(input.startsWith("http") ? input : `https://${input}`).hostname.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }
  if (!HOSTS_PERMITIDOS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return NextResponse.json({ error: "Solo se pueden expandir links de Google Maps." }, { status: 400 });
  }

  try {
    // Seguir la redirección A MANO para obtener la URL final (con coordenadas /
    // place), comprobando el destino de CADA salto.
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    let urlActual = input.startsWith("http") ? input : `https://${input}`;
    for (let salto = 0; salto < MAX_SALTOS; salto++) {
      const res = await fetch(urlActual, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KoraBot/1.0)" },
      });
      if (res.status < 300 || res.status >= 400) break; // llegamos al final
      const destino = res.headers.get("location");
      if (!destino) break;
      const absoluto = new URL(destino, urlActual).toString();
      // Un salto fuera de Google no se sigue: se corta y se deja el link corto.
      if (!saltoPermitido(absoluto)) break;
      urlActual = absoluto;
    }
    clearTimeout(t);
    const urlFinal = urlActual;
    // A veces Google redirige a una página de consentimiento (consent.google.com)
    // en lugar del mapa; en ese caso no podemos armar el embed.
    const esMapa = /\/maps\b/.test(urlFinal) || /@-?\d+\.\d+,/.test(urlFinal);
    const resultado = esMapa ? construirMapa(urlFinal) : { embedUrl: "", mapsUrl: input, needsResolve: false };
    // Conservamos el link corto original como "Cómo llegar" (es más limpio de compartir).
    return NextResponse.json({ ...resultado, mapsUrl: input, needsResolve: false });
  } catch {
    // No se pudo expandir: al menos dejamos el link como "Cómo llegar".
    return NextResponse.json({ embedUrl: "", mapsUrl: input, needsResolve: false });
  }
}
