import type { Metadata } from "next";

// El motor de reservas y su confirmación son pantallas de FLUJO: un selector de
// fechas, sin contenido propio que buscar, y su texto ya vive en la ficha del
// hotel (`/h/[slug]`), que es la que debe rankear. Google las indexó igual —el 4
// sep 2026 salían varias, algunas como "Sin título"— compitiendo con la ficha
// por la misma búsqueda. El `noindex` cuelga del layout para cubrir de paso
// `/reservar/confirmacion`.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReservarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
