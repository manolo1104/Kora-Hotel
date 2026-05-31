import {
  Coins,
  TrendingUp,
  Scale,
  Receipt,
  Stethoscope,
  Tag,
  Percent,
  Search,
  CalendarDays,
  FileText,
  ScrollText,
  QrCode,
  CreditCard,
  Star,
  MessageCircle,
  PenLine,
  BellRing,
  Globe,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Ícono lucide por herramienta (misma familia de iconos que el resto del sitio).
const ICONOS: Record<string, LucideIcon> = {
  "calculadora-comisiones": Coins,
  "calculadora-tarifa": TrendingUp,
  "punto-de-equilibrio": Scale,
  "calculadora-impuestos": Receipt,
  diagnostico: Stethoscope,
  "tarifa-neta": Tag,
  "descuento-maximo": Percent,
  "auditoria-ficha": Search,
  "calendario-puentes": CalendarDays,
  cotizacion: FileText,
  documentos: ScrollText,
  "qr-reservas": QrCode,
  anticipo: CreditCard,
  "respuestas-resenas": Star,
  "mensajes-whatsapp": MessageCircle,
  "descripcion-hotel": PenLine,
  "mensajes-huesped": BellRing,
  "mini-pagina": Globe,
};

export function HerramientaIcono({
  slug,
  className,
  size = 22,
}: {
  slug: string;
  className?: string;
  size?: number;
}) {
  const Icono = ICONOS[slug] ?? Sparkles;
  return <Icono size={size} className={className} aria-hidden="true" />;
}
