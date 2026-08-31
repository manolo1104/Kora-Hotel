import { ETAPAS, type Etapa } from "./types";

const ETAPA_IDS = ETAPAS.map((e) => e.id);

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

// Saca solo los campos válidos de un lead desde un body arbitrario.
// modo "create" exige hotel_nombre; "patch" solo incluye lo que venga.
export function sanitizeLead(
  body: Record<string, unknown>,
  modo: "create" | "patch"
): { data?: Record<string, unknown>; error?: string } {
  const out: Record<string, unknown> = {};

  if (modo === "create" || "hotel_nombre" in body) {
    const nombre = str(body.hotel_nombre);
    if (!nombre) return { error: "El nombre del hotel es obligatorio." };
    out.hotel_nombre = nombre;
  }

  for (const f of ["tomador_nombre", "tomador_puesto", "contacto", "email", "ciudad", "origen", "notas"]) {
    if (f in body) out[f] = str(body[f]);
  }

  if ("etapa" in body) {
    const e = str(body.etapa) as Etapa | null;
    if (!e || !ETAPA_IDS.includes(e)) return { error: "Etapa inválida." };
    out.etapa = e;
  }

  if ("valor_estimado" in body) {
    const raw = body.valor_estimado;
    if (raw === null || raw === "" || raw === undefined) out.valor_estimado = null;
    else {
      const n = Number(raw);
      out.valor_estimado = Number.isFinite(n) ? n : null;
    }
  }

  // El interruptor de la secuencia automática. `crm_leads.secuencia_pausada` la
  // LEÍA el cron (app/api/cron/leads/route.ts) y NADIE la escribía: no había
  // forma de sacar a un lead de la secuencia. Un hotelero al que Manolo ya llamó
  // por teléfono seguía recibiendo los correos de venta del día 3 y del día 7,
  // que es como se quema un lead que ya estaba caliente.
  if ("secuencia_pausada" in body) {
    out.secuencia_pausada = body.secuencia_pausada === true;
  }

  if ("proximo_seguimiento" in body) {
    const d = str(body.proximo_seguimiento);
    out.proximo_seguimiento = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }

  return { data: out };
}
