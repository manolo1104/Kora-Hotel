import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import {
  getMaintenanceTasks,
  createMaintenanceTask,
  updateMaintenanceTask,
  type MaintenanceEstado,
  type MaintenancePrioridad,
} from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// GET → MaintenanceTask[]
export async function GET() {
  return rutaSegura("admin.mantenimiento.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:leer");
  if (no) return no;

  const tasks = await getMaintenanceTasks(ctx.hotelId);
  return NextResponse.json(tasks);
  });
}

// POST → crea tarea. Acepta { titulo, suite?, prioridad?, notas? }. Devuelve { ok, id }.
export async function POST(req: NextRequest) {
  return rutaSegura("admin.mantenimiento.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  try {
    const data = await req.json();
    const titulo = data?.titulo ?? data?.tarea;
    if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
    const id = await createMaintenanceTask(ctx.hotelId, {
      suite: data.suite ?? "",
      titulo,
      prioridad: (data.prioridad as MaintenancePrioridad) ?? "media",
      notas: data.notas ?? "",
    });
    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  });
}

// PATCH → edita tarea. Requiere { id } + (estado|prioridad|titulo|notas).
export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.mantenimiento.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  try {
    const { id, estado, prioridad, titulo, notas } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    await updateMaintenanceTask(ctx.hotelId, id, {
      ...(estado !== undefined ? { estado: estado as MaintenanceEstado } : {}),
      ...(prioridad !== undefined ? { prioridad: prioridad as MaintenancePrioridad } : {}),
      ...(titulo !== undefined ? { titulo } : {}),
      ...(notas !== undefined ? { notas } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  });
}
