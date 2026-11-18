import type { MetadataRoute } from "next";

// Manifest mínimo: nombre, colores e íconos de Kora. Ayuda a que el sitio se
// reconozca como una entidad/app y es lo que usa el «Agregar a inicio» del
// celular (el panel lo abren muchos hoteleros desde el teléfono).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kora — Sistema hotelero con IA",
    short_name: "Kora",
    description: "Agente de WhatsApp con IA, motor de reservas sin comisión y PMS para hoteles en México.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F0",
    theme_color: "#1B4332",
    lang: "es-MX",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
