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
  Bath,
  Mountain,
  Lock,
  Wind,
  Refrigerator,
  Flame,
  Sofa,
  BedDouble,
  BedSingle,
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

// Características POR HABITACIÓN (distintas de las del hotel). Se guardan como
// etiquetas (label) dentro de habitacion.features y el motor las pinta como chips.
// El `key` = label para que el toggle guarde directo el texto que se muestra.
export const AMENIDADES_HAB: Amenidad[] = [
  { key: "Aire acondicionado", label: "Aire acondicionado", Icon: Snowflake },
  { key: "Ventilador", label: "Ventilador", Icon: Wind },
  { key: "TV", label: "TV", Icon: Tv },
  { key: "WiFi", label: "WiFi", Icon: Wifi },
  { key: "Tina de hidromasaje", label: "Tina de hidromasaje", Icon: Bath },
  { key: "Agua caliente", label: "Agua caliente", Icon: ShowerHead },
  { key: "Vista panorámica", label: "Vista panorámica", Icon: Mountain },
  { key: "Balcón / Terraza", label: "Balcón / Terraza", Icon: Trees },
  { key: "Minibar", label: "Minibar", Icon: Refrigerator },
  { key: "Cafetera", label: "Cafetera", Icon: Coffee },
  { key: "Caja fuerte", label: "Caja fuerte", Icon: Lock },
  { key: "Chimenea", label: "Chimenea", Icon: Flame },
  { key: "Sala de estar", label: "Sala de estar", Icon: Sofa },
  { key: "Cama King", label: "Cama King", Icon: BedDouble },
];

// Tipos de cama de una habitación. El hotelero elige tipos y cuántas de cada uno
// (habitacion.camas = [{tipo, cantidad}]). El `key` = label que se guarda; el
// hotelero también puede agregar un tipo propio que no esté aquí.
export const TIPOS_CAMA: Amenidad[] = [
  { key: "King", label: "King", Icon: BedDouble },
  { key: "Queen", label: "Queen", Icon: BedDouble },
  { key: "Matrimonial", label: "Matrimonial", Icon: BedDouble },
  { key: "Individual", label: "Individual", Icon: BedSingle },
  { key: "Litera", label: "Litera", Icon: BedSingle },
  { key: "Sofá cama", label: "Sofá cama", Icon: Sofa },
];
