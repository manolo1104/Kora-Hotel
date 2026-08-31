import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api/rate-limit";
import { passwordOk, setCrmCookie } from "@/lib/crm/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  if (rateLimited("crm.login", ip, { max: 10, ventanaMs: 5 * 60_000 })) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = body?.password ?? "";
  } catch {
    /* sin cuerpo */
  }
  if (!passwordOk(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }
  await setCrmCookie();
  return NextResponse.json({ ok: true });
}
