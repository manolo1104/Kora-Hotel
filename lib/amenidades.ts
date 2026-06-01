import type { ComponentType } from "react";
import {
  Wifi,
  SquareParking,
  Waves,
  PawPrint,
  Coffee,
  Snowflake,
  Tv,
  CookingPot,
  ShowerHead,
  Trees,
  UtensilsCrossed,
  Clock,
} from "lucide-react";

type IconProps = { size?: number; className?: string; "aria-hidden"?: boolean };

export interface Amenidad {
  key: string;
  label: string;
  Icon: ComponentType<IconProps>;
}

// Lista fija de amenidades para la mini-página gratuita.
// Fuente de verdad compartida entre el editor (/panel) y la página pública (/h/[slug]).
export const AMENIDADES: Amenidad[] = [
  { key: "wifi", label: "WiFi gratis", Icon: Wifi },
  { key: "estacionamiento", label: "Estacionamiento", Icon: SquareParking },
  { key: "alberca", label: "Alberca", Icon: Waves },
  { key: "pet_friendly", label: "Pet-friendly", Icon: PawPrint },
  { key: "desayuno", label: "Desayuno", Icon: Coffee },
  { key: "aire", label: "Aire acondicionado", Icon: Snowflake },
  { key: "tv", label: "TV", Icon: Tv },
  { key: "cocina", label: "Cocina", Icon: CookingPot },
  { key: "agua_caliente", label: "Agua caliente", Icon: ShowerHead },
  { key: "jardin", label: "Terraza / jardín", Icon: Trees },
  { key: "restaurante", label: "Restaurante", Icon: UtensilsCrossed },
  { key: "recepcion24", label: "Recepción 24h", Icon: Clock },
];

export const AMENIDADES_MAP: Record<string, Amenidad> = Object.fromEntries(
  AMENIDADES.map((a) => [a.key, a])
);
