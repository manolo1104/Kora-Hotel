import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import {
  getCleaningTasks,
  createCleaningTask,
  updateCleaningTask,
  type CleaningTaskEstado,
} from "@/lib/db/admin";

export const dynamic = "force-dynamic";

function todayMX(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// GET → CleaningTask[] (opcional ?fecha=YYYY-MM-DD para filtrar a ese día).
export async function GET(req: NextRequest) {
  return rutaSegura("admin.limpieza.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:leer");
  if (no) return no;

  const fecha = req.nextUrl.searchParams.get("fecha") || undefined;
  const tasks = await getCleaningTasks(ctx.hotelId);
  const filtered = fecha ? tasks.filter((t) => t.fecha === fecha) : tasks;
  return NextResponse.json(filtered);
  });
}

// POST → crea una tarea de limpieza. Acepta { suite, fecha?, asignado?, notas? }.
// Devuelve { ok, id }.
export async function POST(req: NextRequest) {
  return rutaSegura("admin.limpieza.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  try {
    const data = await req.json();
    if (!data?.suite) {
      return NextResponse.json({ error: "suite requerida" }, { status: 400 });
    }
    const id = await createCleaningTask(ctx.hotelId, {
      suite: data.suite,
      fecha: data.fecha || todayMX(),
      asignado: data.asignado ?? data.personal ?? "",
      notas: data.notas ?? data.observaciones ?? "",
    });
    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  });
}

// PATCH → edita una tarea de limpieza. Requiere { id } + (estado|asignado|notas).
export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.limpieza.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  try {
    const { id, estado, asignado, notas } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await updateCleaningTask(ctx.hotelId, id, {
      ...(estado !== undefined ? { estado: estado as CleaningTaskEstado } : {}),
      ...(asignado !== undefined ? { asignado } : {}),
      ...(notas !== undefined ? { notas } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  });
}
