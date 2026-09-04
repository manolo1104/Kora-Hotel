import type { Metadata } from "next";

// `/pago/iniciar` y `/pago/exito` son pantallas de FLUJO: no tienen contenido
// propio que buscar y sólo se llega a ellas desde /precios. Google indexó
// `/pago/iniciar` igualmente (medido el 4 sep 2026) y la mostraba como si fuera
// una página del producto. Las dos son "use client", así que no pueden exportar
// metadata por su cuenta: el layout es el único sitio donde ponerlo.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
