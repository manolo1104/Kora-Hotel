import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import {
  getCleaningTasks,
  createCleaningTask,
  updateCleaningTask,
} from "@/lib/db/admin";
import { leerCuerpo, zTextoCorto, zTextoLargo, zId, zFecha } from "@/lib/api/cuerpo";
import { z } from "zod";

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

// `estado` iba a la base con un `as CleaningTaskEstado`: un valor inventado
// reventaba contra el CHECK de la tabla y el `catch` de abajo le devolvía al
// navegador el texto crudo de Postgres. Ahora lo rechaza el esquema, y el 500
// honesto lo pone `rutaSegura`.
const CREAR_SCHEMA = z.object({
  suite: zTextoCorto,
  fecha: zFecha.optional(),
  asignado: zTextoCorto.optional(),
  personal: zTextoCorto.optional(), // nombre viejo del mismo campo
  notas: zTextoLargo.optional(),
  observaciones: zTextoLargo.optional(), // nombre viejo del mismo campo
});

const EDITAR_SCHEMA = z.object({
  id: zId,
  estado: z.enum(["PENDIENTE", "HECHA"]).optional(),
  asignado: zTextoCorto.optional(),
  notas: zTextoLargo.optional(),
});

// POST → crea una tarea de limpieza. Acepta { suite, fecha?, asignado?, notas? }.
// Devuelve { ok, id }.
export async function POST(req: NextRequest) {
  return rutaSegura("admin.limpieza.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  const c = await leerCuerpo(req, CREAR_SCHEMA);
  if (!c.ok) return c.respuesta;
  const { suite, fecha, asignado, personal, notas, observaciones } = c.datos;
  const id = await createCleaningTask(ctx.hotelId, {
    suite,
    fecha: fecha || todayMX(),
    asignado: asignado ?? personal ?? "",
    notas: notas ?? observaciones ?? "",
  });
  return NextResponse.json({ ok: true, id });
  });
}

// PATCH → edita una tarea de limpieza. Requiere { id } + (estado|asignado|notas).
export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.limpieza.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

  const c = await leerCuerpo(req, EDITAR_SCHEMA);
  if (!c.ok) return c.respuesta;
  const { id, estado, asignado, notas } = c.datos;
  await updateCleaningTask(ctx.hotelId, id, {
    ...(estado !== undefined ? { estado } : {}),
    ...(asignado !== undefined ? { asignado } : {}),
    ...(notas !== undefined ? { notas } : {}),
  });
  return NextResponse.json({ ok: true });
  });
}
