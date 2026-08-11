// Resolución de las claves de ícono (lib/mini.ts ICONOS) a componentes de
// lucide. Vive aparte de lib/mini.ts a propósito: ese archivo lo leen el
// servidor, el motor y Camila, y no tiene por qué cargar la librería de íconos.

import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Camera,
  Car,
  Coffee,
  ExternalLink,
  Gift,
  Heart,
  Mail,
  MessageCircle,
  Mountain,
  Music,
  Navigation,
  PawPrint,
  Phone,
  ShieldCheck,
  Star,
  Sun,
  UtensilsCrossed,
  Waves,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { Boton, BotonAccion } from "@/lib/mini";

export const ICONO_MAP: Record<string, LucideIcon> = {
  calendario: CalendarCheck,
  whatsapp: MessageCircle,
  telefono: Phone,
  correo: Mail,
  mapa: Navigation,
  enlace: ExternalLink,
  estrella: Star,
  corazon: Heart,
  cama: BedDouble,
  alberca: Waves,
  cafe: Coffee,
  comida: UtensilsCrossed,
  wifi: Wifi,
  auto: Car,
  mascota: PawPrint,
  montana: Mountain,
  sol: Sun,
  escudo: ShieldCheck,
  regalo: Gift,
  camara: Camera,
  musica: Music,
  flecha: ArrowRight,
};

// Ícono que le toca a un botón si el hotelero no eligió ninguno: el que
// corresponde a su acción. Así un botón recién creado nunca se ve pelón.
const POR_ACCION: Record<BotonAccion, string> = {
  reservar: "calendario",
  whatsapp: "whatsapp",
  telefono: "telefono",
  email: "correo",
  mapa: "mapa",
  enlace: "enlace",
  ancla: "flecha",
};

export function IconoDe({
  clave,
  size = 16,
  className,
}: {
  clave?: string;
  size?: number;
  className?: string;
}) {
  const Icon = clave ? ICONO_MAP[clave] : undefined;
  if (!Icon) return null;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function IconoBoton({
  boton,
  size = 16,
  motorActivo = true,
}: {
  boton: Boton;
  size?: number;
  motorActivo?: boolean;
}) {
  // Un botón "Reservar" con el motor pausado manda a WhatsApp: el ícono tiene
  // que decir la verdad de a dónde va.
  const claveAuto =
    boton.accion === "reservar" && !motorActivo ? "whatsapp" : POR_ACCION[boton.accion];
  return <IconoDe clave={boton.icono || claveAuto} size={size} />;
}
