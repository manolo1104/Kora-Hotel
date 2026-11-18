// Plataformas que se enlazan por iCal. Archivo sin dependencias de servidor:
// lo importan el panel (cliente), la API y la landing.

export const PLATAFORMAS_ICAL = ["airbnb", "booking_com", "vrbo", "expedia", "otro"] as const;
export type PlataformaIcal = (typeof PLATAFORMAS_ICAL)[number];

/** Las que se ofrecen al crear un canal nuevo («expedia» queda sólo por compatibilidad). */
export const PLATAFORMAS_NUEVAS: PlataformaIcal[] = ["airbnb", "booking_com", "vrbo", "otro"];

export const NOMBRE_PLATAFORMA: Record<PlataformaIcal, string> = {
  airbnb: "Airbnb",
  booking_com: "Booking.com",
  vrbo: "Expedia (Vrbo)",
  // Filas guardadas antes de nov 2026. Expedia Group sólo ofrece iCal en el
  // panel de Vrbo; se sigue leyendo para no romper canales ya pegados.
  expedia: "Expedia",
  otro: "Otro calendario",
};

/**
 * Dónde está cada enlace en la OTA. Verificado nov 2026; si una OTA mueve el
 * menú, se corrige aquí y cambia en el panel.
 */
export const GUIA_PLATAFORMA: Record<
  PlataformaIcal,
  { importar: string; exportar: string; ojo?: string }
> = {
  airbnb: {
    importar:
      "Airbnb → Anuncios → (tu anuncio) → Disponibilidad → Conectar calendarios → Exportar calendario. Copia ese enlace y pégalo aquí.",
    exportar:
      "En la misma pantalla, «Importar calendario»: pega el enlace de Kora de esta unidad y ponle de nombre «Kora».",
    ojo: "Un anuncio = una unidad. Si tienes dos cabañas iguales en un solo anuncio con varias unidades, iCal no alcanza: crea un anuncio por cabaña.",
  },
  booking_com: {
    importar:
      "Extranet → Tarifas y disponibilidad → Sincronizar calendarios → (habitación) → Exportar calendario. Copia el enlace y pégalo aquí.",
    exportar:
      "En la misma pantalla, «Importar calendario»: pega el enlace de Kora de esta unidad.",
    ojo: "Booking sólo muestra «Sincronizar calendarios» si cada tipo de habitación tiene 1 unidad y no usas un channel manager. Si no te aparece, tu cuenta no es elegible para iCal.",
  },
  vrbo: {
    importar:
      "Vrbo (Expedia Group) → tu anuncio → Calendario → Importar y exportar → Exportar. Copia el enlace y pégalo aquí.",
    exportar: "En «Importar y exportar» → Importar: pega el enlace de Kora de esta unidad.",
    ojo: "Expedia sólo ofrece iCal en anuncios de Vrbo. Expedia Partner Central (hoteles) no tiene iCal.",
  },
  expedia: {
    importar: "Expedia Group → Calendario → Importar y exportar → Exportar.",
    exportar: "Importar y exportar → Importar: pega el enlace de Kora de esta unidad.",
    ojo: "Expedia sólo ofrece iCal en anuncios de Vrbo.",
  },
  otro: {
    importar:
      "Cualquier calendario que dé un enlace .ics (Google Calendar, Hostaway, otra OTA). Pega aquí su enlace de exportación.",
    exportar: "Si esa plataforma acepta importar calendarios, dale el enlace de Kora de esta unidad.",
  },
};
