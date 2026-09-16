// Tipos y metadatos del CRM (compartidos cliente/servidor).

/**
 * Ventana "reciente" del panel de operaciones, en días.
 *
 * Vive aquí y no en lib/crm/operaciones.ts porque el panel es un componente
 * de cliente: importar un VALOR desde ese archivo arrastraría al bundle del
 * navegador el cliente de Supabase con service-role.
 */
export const VENTANA_DIAS = 30;

/**
 * Días sin reservas a partir de los cuales un hotel que PAGA y ya vendía se
 * marca en riesgo. La alerta vieja sólo miraba «0 reservas en total»: uno que
 * vendía y lleva un mes callado no levantaba nada, y es la baja más fácil de ver
 * venir. Dos semanas: menos es ruido de temporada baja. Vive aquí porque lo usan
 * las alertas (servidor) y el filtro «En riesgo» de la tabla (cliente).
 */
export const DIAS_SIN_RESERVAS_PAGANDO = 14;

/**
 * La ficha de un hotel en el CRM. Vive aquí por lo mismo que VENTANA_DIAS: la
 * usan el servidor (los enlaces de las alertas) y la tabla del panel, que es de
 * cliente. Escrita una sola vez para que una alerta y la tabla no lleven a dos
 * direcciones distintas del mismo hotel.
 */
export function rutaFichaHotel(slug: string): string {
  return `/crm/hoteles/${encodeURIComponent(slug)}`;
}

export type Etapa =
  | "nuevo"
  | "contactado"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido";

export type TipoActividad = "llamada" | "correo" | "whatsapp" | "reunion" | "nota";

export interface Lead {
  id: string;
  hotel_nombre: string;
  tomador_nombre: string | null;
  tomador_puesto: string | null;
  contacto: string | null;
  email: string | null;
  ciudad: string | null;
  origen: string | null;
  etapa: Etapa;
  valor_estimado: number | null;
  proximo_seguimiento: string | null; // YYYY-MM-DD
  notas: string | null;
  /**
   * `true` = a este lead NO le salen los correos automáticos del día 3 y del
   * día 7. Se enciende desde la ficha del lead en el CRM. Lo lee
   * app/api/cron/leads/route.ts.
   */
  secuencia_pausada: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Actividad {
  id: string;
  lead_id: string;
  tipo: TipoActividad;
  nota: string | null;
  fecha: string; // YYYY-MM-DD
  created_at: string;
}

// Orden + estilo de cada etapa (para Kanban, badges y resumen).
export const ETAPAS: { id: Etapa; label: string; color: string; chip: string }[] = [
  { id: "nuevo", label: "Nuevo", color: "#6B7280", chip: "bg-gray-100 text-gray-700" },
  { id: "contactado", label: "Contactado", color: "#2563EB", chip: "bg-blue-50 text-blue-700" },
  { id: "propuesta", label: "Propuesta", color: "#7C3AED", chip: "bg-violet-50 text-violet-700" },
  { id: "negociacion", label: "Negociación", color: "#D97706", chip: "bg-amber-50 text-amber-700" },
  { id: "ganado", label: "Ganado", color: "#2E7D5B", chip: "bg-emerald-50 text-emerald-700" },
  { id: "perdido", label: "Perdido", color: "#DC2626", chip: "bg-red-50 text-red-700" },
];

export const ETAPA_LABEL: Record<Etapa, string> = Object.fromEntries(
  ETAPAS.map((e) => [e.id, e.label])
) as Record<Etapa, string>;

export const TIPOS_ACTIVIDAD: { id: TipoActividad; label: string; icon: string }[] = [
  { id: "llamada", label: "Llamada", icon: "Phone" },
  { id: "correo", label: "Correo", icon: "Mail" },
  { id: "whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { id: "reunion", label: "Reunión", icon: "Users" },
  { id: "nota", label: "Nota", icon: "StickyNote" },
];

export const TIPO_LABEL: Record<TipoActividad, string> = Object.fromEntries(
  TIPOS_ACTIVIDAD.map((t) => [t.id, t.label])
) as Record<TipoActividad, string>;

/**
 * Campos editables de un lead.
 *
 * ⚠️ NO es la lista que valida el servidor, aunque lo pareciera: la viva es la
 * de `sanitizeLead` en lib/crm/server.ts, y hoy nadie importa esta constante.
 * Se conserva como referencia de los campos, pero si añades uno, el que hay que
 * tocar es `sanitizeLead`.
 */
export const LEAD_FIELDS = [
  "hotel_nombre",
  "tomador_nombre",
  "tomador_puesto",
  "contacto",
  "email",
  "ciudad",
  "origen",
  "etapa",
  "valor_estimado",
  "proximo_seguimiento",
  "notas",
  "secuencia_pausada",
] as const;
