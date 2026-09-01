// Las cabeceras de seguridad tienen DOS formas de romperse, y las dos son
// silenciosas:
//
//   1. Alguien pone `X-Frame-Options: DENY` para todo el sitio y el motor de
//      reservas —que vive DENTRO de un iframe en la página de cada hotel— deja
//      de pintarse. Nadie se entera hasta que un hotelero avisa de que su página
//      de reservas salió en blanco.
//   2. Alguien quita la regla y el panel del hotelero y el CRM del fundador
//      vuelven a poder enmarcarse desde cualquier sitio: un clic donde no se ve.
//
// Antes vivían repartidas entre `vercel.json` y `next.config.mjs`, con un
// comentario en el segundo que decía justo lo contrario de lo que hacía el
// primero. Ahora están en un solo sitio y esta prueba lo vigila.
import { describe, it, expect } from "vitest";
import config from "../next.config.mjs";

interface Cabecera {
  key: string;
  value: string;
}
interface Regla {
  source: string;
  headers: Cabecera[];
}

const reglas = (await (config as { headers: () => Promise<Regla[]> }).headers()) as Regla[];

/** Todas las cabeceras que le tocan a una ruta, según las reglas declaradas. */
function cabecerasDe(ruta: string): Map<string, string> {
  const salida = new Map<string, string>();
  for (const r of reglas) {
    if (aplica(r.source, ruta)) {
      for (const h of r.headers) salida.set(h.key, h.value);
    }
  }
  return salida;
}

/** Traduce el `source` de Next a algo que se pueda probar contra una ruta. */
function aplica(source: string, ruta: string): boolean {
  if (source === "/:path*") return true;
  if (source === "/h/:path*") return ruta.startsWith("/h/");
  if (source === "/((?!h/).*)") return !ruta.startsWith("/h/");
  // Caché del sitemap. No es de seguridad, pero vive aquí desde que salió de
  // `vercel.json`, que era el último bloque de cabeceras fuera de este archivo.
  if (source === "/sitemap.xml") return ruta === "/sitemap.xml";
  throw new Error(`source no contemplado en la prueba: ${source}`);
}

describe("lo que NO se puede meter en un iframe", () => {
  // Detrás de estas puertas hay dinero, identidad o los datos de los huéspedes.
  const PROTEGIDAS = ["/", "/precios", "/panel", "/panel/hotel-magico/pagos", "/crm", "/entrar", "/pago/iniciar"];

  for (const ruta of PROTEGIDAS) {
    it(`${ruta} lo prohíbe por las dos vías`, () => {
      const c = cabecerasDe(ruta);
      // `frame-ancestors` es lo que miran los navegadores de hoy;
      // `X-Frame-Options`, los viejos. Hacen falta las dos.
      expect(c.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
      expect(c.get("X-Frame-Options")).toBe("DENY");
    });
  }
});

describe("lo que SÍ se puede meter en un iframe, a propósito", () => {
  // El motor de reservas vive incrustado en la página del hotel. Si esto se
  // rompe, el hotel deja de poder vender directo — que es el producto entero.
  const EMBEBIBLES = ["/h/hotel-magico", "/h/hotel-magico/reservar", "/h/hotel-san-luis/reservar"];

  for (const ruta of EMBEBIBLES) {
    it(`${ruta} se deja enmarcar`, () => {
      const c = cabecerasDe(ruta);
      expect(c.get("Content-Security-Policy")).toBe("frame-ancestors *");
      // Si aparece, gana sobre `frame-ancestors` en varios navegadores y el
      // motor se queda en blanco dentro de la página del hotel.
      expect(c.has("X-Frame-Options")).toBe(false);
    });
  }
});

describe("las cabeceras que van en todas partes", () => {
  for (const ruta of ["/", "/h/hotel-magico/reservar", "/panel", "/api/leads"]) {
    it(`${ruta} las lleva`, () => {
      const c = cabecerasDe(ruta);
      expect(c.get("X-Content-Type-Options")).toBe("nosniff");
      expect(c.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(c.get("Permissions-Policy")).toContain("camera=()");
      expect(c.get("Permissions-Policy")).toContain("microphone=()");
      expect(c.get("Permissions-Policy")).toContain("geolocation=()");
    });
  }

  it("NO apaga `payment`: hoy el cobro redirige a Stripe, pero si algún día se incrusta, apagarlo lo rompe", () => {
    expect(cabecerasDe("/").get("Permissions-Policy")).not.toContain("payment=()");
  });
});
