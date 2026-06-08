// Tipos y metadatos del CRM (compartidos cliente/servidor).

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

// Campos editables de un lead (para validar en el servidor).
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
] as const;
