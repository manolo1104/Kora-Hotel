import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import {
  getMaintenanceTasks,
  createMaintenanceTask,
  updateMaintenanceTask,
} from "@/lib/db/admin";
import { leerCuerpo, zTextoCorto, zTextoLargo, zId } from "@/lib/api/cuerpo";
import { z } from "zod";

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
// `estado` y `prioridad` iban a la base con un `as`: un valor inventado
// reventaba contra el CHECK de la tabla, y el `catch` de la ruta le devolvía al
// navegador el texto crudo de Postgres.
const CREAR_SCHEMA = z.object({
  suite: zTextoCorto.optional(),
  titulo: zTextoCorto.optional(),
  tarea: zTextoCorto.optional(), // nombre viejo del mismo campo
  prioridad: z.enum(["baja", "media", "alta"]).optional(),
  notas: zTextoLargo.optional(),
});

const EDITAR_SCHEMA = z.object({
  id: zId,
  estado: z.enum(["ABIERTA", "EN_PROCESO", "CERRADA"]).optional(),
  prioridad: z.enum(["baja", "media", "alta"]).optional(),
  titulo: zTextoCorto.optional(),
  notas: zTextoLargo.optional(),
});

export async function POST(req: NextRequest) {
  return rutaSegura("admin.mantenimiento.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  const c = await leerCuerpo(req, CREAR_SCHEMA);
  if (!c.ok) return c.respuesta;
  const titulo = c.datos.titulo ?? c.datos.tarea;
  if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
  const id = await createMaintenanceTask(ctx.hotelId, {
    suite: c.datos.suite ?? "",
    titulo,
    prioridad: c.datos.prioridad ?? "media",
    notas: c.datos.notas ?? "",
  });
  return NextResponse.json({ ok: true, id });
  });
}

// PATCH → edita tarea. Requiere { id } + (estado|prioridad|titulo|notas).
export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.mantenimiento.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  const c = await leerCuerpo(req, EDITAR_SCHEMA);
  if (!c.ok) return c.respuesta;
  const { id, estado, prioridad, titulo, notas } = c.datos;
  await updateMaintenanceTask(ctx.hotelId, id, {
    ...(estado !== undefined ? { estado } : {}),
    ...(prioridad !== undefined ? { prioridad } : {}),
    ...(titulo !== undefined ? { titulo } : {}),
    ...(notas !== undefined ? { notas } : {}),
  });
  return NextResponse.json({ ok: true });
  });
}
