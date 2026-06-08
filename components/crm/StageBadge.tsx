import { ETAPAS, type Etapa } from "@/lib/crm/types";

const MAP = Object.fromEntries(ETAPAS.map((e) => [e.id, e]));

// Clases Tailwind LITERALES por etapa (aquí, en un componente que Tailwind
// escanea, para que no se purguen en producción).
const CHIP: Record<Etapa, string> = {
  nuevo: "bg-gray-100 text-gray-700",
  contactado: "bg-blue-50 text-blue-700",
  propuesta: "bg-violet-50 text-violet-700",
  negociacion: "bg-amber-50 text-amber-700",
  ganado: "bg-emerald-50 text-emerald-700",
  perdido: "bg-red-50 text-red-700",
};

export function StageBadge({ etapa }: { etapa: Etapa }) {
  const e = MAP[etapa];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[etapa]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
      {e.label}
    </span>
  );
}
