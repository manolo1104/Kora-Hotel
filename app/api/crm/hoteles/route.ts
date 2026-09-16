import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { cargarListaHoteles } from "@/lib/crm/ficha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Devuelve lo mismo que /crm/hoteles y espera a las mismas fuentes lentas
// (cuentas de Auth, servidor de Camila, conteo de consumo): con el tope corto
// por defecto contestaría un error de la plataforma en vez de la lista con sus
// fallos declarados.
export const maxDuration = 60;

// La lista de hoteles del CRM, en JSON (la misma que pinta /crm/hoteles).
//
// GET → { ok, hoteles, lecturas, fallos, pendientes }
//
// Aquí vivía también el POST de bloquear/desbloquear. Se mudó a
// POST /api/crm/hoteles/[slug] junto con el resto de acciones de la ficha: ahí
// pasa por la guarda de origen, pide motivo y queda en la bitácora. Esta ruta
// ya no escribe nada (un POST aquí responde 405).
//
// `ok: false` cuando los hoteles no se pudieron leer: la lista viene vacía y NO
// significa «no hay hoteles». La versión vieja devolvía la lista vacía igual y
// la pantalla decía «No hay hoteles todavía» con la base caída.

export async function GET() {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;

  const lista = await cargarListaHoteles();
  return NextResponse.json(
    { ok: lista.lecturas.hoteles, ...lista },
    { status: lista.lecturas.hoteles ? 200 : 503 },
  );
}
