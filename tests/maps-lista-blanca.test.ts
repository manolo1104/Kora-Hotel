// La URL que pega el hotelero acaba en el `src` de un <iframe> de una página
// pública alojada en kora-hotel.com. Antes se usaba TAL CUAL: bastaba pegar
// `https://sitio-malo.com/maps/embed` para meter contenido ajeno dentro del
// dominio de Kora. Esta prueba fija la lista blanca.
import { describe, it, expect } from "vitest";
import { construirMapa, esUrlDeMapas } from "@/lib/maps";

describe("el mapa del hotel sólo puede embeber Google Maps", () => {
  const MALAS = [
    "https://sitio-malo.com/maps/embed",
    "https://sitio-malo.com/x?output=embed",
    "https://google.com.evil.net/maps/embed",
    "https://notgoogle.com/maps/embed",
    "http://169.254.169.254/latest/meta-data/",
    "javascript:alert(1)//maps/embed",
  ];

  for (const mala of MALAS) {
    it(`no embebe ${mala}`, () => {
      const r = construirMapa(mala);
      expect(esUrlDeMapas(mala)).toBe(false);
      // Si acaba en el iframe, tiene que ser una búsqueda de Google, no la URL.
      expect(r.embedUrl.startsWith("https://www.google.com/maps?q=")).toBe(true);
      expect(r.embedUrl).not.toContain("sitio-malo.com/maps");
      expect(r.mapsUrl.startsWith("https://www.google.com/maps/search/")).toBe(true);
    });
  }

  const BUENAS = [
    "https://www.google.com/maps/place/Hotel+Para%C3%ADso/@21.5510,-98.9910,17z",
    "https://maps.google.com/?q=21.5510,-98.9910",
    "https://www.google.com/maps/embed?pb=abc",
  ];

  for (const buena of BUENAS) {
    it(`sí acepta ${buena.slice(0, 45)}…`, () => {
      expect(esUrlDeMapas(buena)).toBe(true);
      const r = construirMapa(buena);
      expect(r.embedUrl).toContain("google.com");
    });
  }

  it("una dirección de texto sigue funcionando igual", () => {
    const r = construirMapa("Xilitla, San Luis Potosí");
    expect(r.embedUrl).toContain("output=embed");
    expect(r.mapsUrl).toContain("/maps/search/");
    expect(r.needsResolve).toBe(false);
  });

  it("un link corto de Google sigue pidiendo que el servidor lo expanda", () => {
    const r = construirMapa("https://maps.app.goo.gl/abc123");
    expect(r.needsResolve).toBe(true);
  });
});
