// El expansor de links de mapas hacía `fetch(..., { redirect: "follow" })` sobre
// un host de una lista blanca. El problema: `goo.gl` es un ACORTADOR — quien
// crea el link decide a dónde apunta. Bastaba pegar en el panel un goo.gl que
// redirigiera a `http://169.254.169.254/` (los metadatos de la nube) o a
// `http://localhost:…` para que fuera NUESTRO servidor quien lo pidiera, desde
// dentro de la red (K-18.7).
//
// Ahora la redirección se sigue a mano y cada salto pasa por aquí.
import { describe, it, expect } from "vitest";
import { saltoPermitido, MAX_SALTOS } from "@/lib/maps-redirecciones";

describe("a dónde NO se sigue una redirección", () => {
  const PROHIBIDOS = [
    ["los metadatos de la nube", "http://169.254.169.254/latest/meta-data/"],
    ["la propia máquina", "http://localhost:3000/api/panel/eliminar-hotel"],
    ["la propia máquina por IP", "http://127.0.0.1:5432/"],
    ["la red interna", "http://10.0.0.5/"],
    ["otra red interna", "http://192.168.1.1/"],
    ["un sitio cualquiera", "https://sitio-del-atacante.com/"],
    ["un dominio que sólo TERMINA parecido", "https://google.com.sitio-del-atacante.com/"],
    ["un dominio que sólo EMPIEZA parecido", "https://google.com.mx.malo.net/"],
    ["file://", "file:///etc/passwd"],
    ["un esquema raro", "gopher://interno:70/"],
    ["basura", "no-es-una-url"],
  ];

  for (const [que, url] of PROHIBIDOS) {
    it(`no sigue a ${que}`, () => {
      expect(saltoPermitido(url)).toBe(false);
    });
  }
});

describe("a dónde SÍ, para que el expansor siga sirviendo", () => {
  const PERMITIDOS = [
    "https://www.google.com/maps/place/Hotel+Para%C3%ADso/@21.39,-98.99,17z",
    "https://maps.google.com/maps?q=xilitla",
    "https://www.google.com.mx/maps/place/Xilitla",
    "https://maps.app.goo.gl/abc123",
    "https://goo.gl/maps/abc123",
    "https://g.co/kgs/abc",
  ];

  for (const url of PERMITIDOS) {
    it(`sigue a ${new URL(url).hostname}`, () => {
      expect(saltoPermitido(url)).toBe(true);
    });
  }
});

describe("el tope de saltos", () => {
  it("existe y es pequeño (una cadena infinita de redirecciones cuelga la ruta)", () => {
    expect(MAX_SALTOS).toBeGreaterThan(0);
    expect(MAX_SALTOS).toBeLessThanOrEqual(10);
  });
});
