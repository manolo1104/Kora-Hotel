// Lo que Kora dice que integra tiene que ser lo que integra.
//
// El 2 sep 2026 la portada anunciaba «Airbnb — Activo» y «Expedia — Activo»
// mientras la pestaña de canales llevaba retirada del panel desde el 26 de
// agosto (`CANALES_OTA_DISPONIBLES = false`), y Airbnb no había existido nunca
// como canal —`CanalesClient` sólo conoce 'booking_com' | 'expedia'—. Booking,
// el único de los tres que sí llegó a funcionar, era el que decía
// «Próximamente». La rejilla estaba exactamente al revés.
//
// Alrededor, quince textos de las landings de SEO prometían «sincronía con tus
// OTAs para evitar overbooking», y `/precios` cobraba $2,500 por «Migración +
// sync Booking/Expedia». Ninguno se actualizó cuando se apagó la pestaña: es el
// patrón de siempre —una promesa escrita a mano en veinte sitios— y por eso se
// arregla igual que las cifras del caso Paraíso, con una fuente única y una
// prueba que impide reescribirla a mano.
//
// La confianza del hotelero es el activo que no se recupera. Esta prueba es
// barata; recuperar a un cliente que descubrió la mentira, no.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { INTEGRACIONES, SINCRONIA_OTA_DISPONIBLE } from "@/lib/integraciones";
import { CANALES_OTA_DISPONIBLES } from "@/lib/panel/canales-ota";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

// Las superficies de marketing que hablan de canales en PROSA. Se listan a mano
// a propósito: si nace una landing nueva que promete sincronía, hay que añadirla
// aquí, y ese acto es justo el momento de leer este comentario.
const PROSA = [
  "lib/ciudades.ts",
  "lib/comparativas.ts",
  "lib/personas.ts",
  "lib/whatsapp.ts",
  "lib/faqs.ts",
  "app/llms.txt/route.ts",
  "components/landing/IntegracionesSection.tsx",
  "components/landing/PricingSection.tsx",
];

/** Quita comentarios de línea: documentar el defecto arreglado no puede reabrirlo. */
function sinComentarios(src: string): string {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

describe("la rejilla de integraciones dice la verdad", () => {
  it("ninguna OTA aparece como integración mientras la pestaña esté apagada", () => {
    if (SINCRONIA_OTA_DISPONIBLE) return; // el día que exista, esto se relaja solo
    const otas = INTEGRACIONES.filter((i) =>
      /booking|airbnb|expedia|vrbo|despegar/i.test(i.name),
    );
    expect(otas).toEqual([]);
  });

  it("`SINCRONIA_OTA_DISPONIBLE` no puede divergir del interruptor del panel", () => {
    expect(SINCRONIA_OTA_DISPONIBLE).toBe(CANALES_OTA_DISPONIBLES);
  });

  it("nadie escribe «Activo» a mano fuera de la fuente única", () => {
    // El literal "active" es el estado; si aparece en la sección es que alguien
    // volvió a meter la lista en el componente.
    const seccion = sinComentarios(leer("components/landing/IntegracionesSection.tsx"));
    expect(seccion).not.toMatch(/status:\s*["']active["']/);
    expect(seccion).toMatch(/INTEGRACIONES/);
  });

  it("cada integración tiene logo o insignia, para que la rejilla no salga rota", () => {
    for (const i of INTEGRACIONES) {
      expect(Boolean(i.logo) || Boolean(i.abbr && i.color)).toBe(true);
    }
  });
});

describe("ninguna superficie promete sincronía con OTAs que no existe", () => {
  // La forma del defecto: el verbo «sincronizar» (o «sincronía») a menos de ~90
  // caracteres del nombre de una OTA, afirmándolo como algo que Kora hace. Las
  // frases que dicen que NO existe llevan «todavía no» y quedan exentas.
  const OTA = "(booking|airbnb|expedia|vrbo|las otas|tus otas|sus otas)";
  const SINCRO = "(sincroniz\\w*|sincron[íi]a)";

  for (const archivo of PROSA) {
    it(`${archivo} no lo promete`, () => {
      if (SINCRONIA_OTA_DISPONIBLE) return;
      const src = sinComentarios(leer(archivo));
      const sospechosas: string[] = [];
      for (const linea of src.split("\n")) {
        const l = linea.toLowerCase();
        const cerca =
          new RegExp(`${SINCRO}[^"]{0,90}${OTA}`, "i").test(l) ||
          new RegExp(`${OTA}[^"]{0,90}${SINCRO}`, "i").test(l);
        if (!cerca) continue;
        // Exenciones con la razón escrita EN EL PROPIO TEXTO:
        //  · «todavía no» / «no hay sincronía» — dice justo lo contrario
        //  · «tres listas sincronizadas a mano» — describe el problema del
        //    hotelero sin Kora, no una promesa
        if (/todav[íi]a no|no hay sincron|a mano/i.test(l)) continue;
        // Una pregunta no promete nada; la respuesta de al lado sí, y esa se mira.
        if (/^\s*q:/.test(linea)) continue;
        sospechosas.push(linea.trim().slice(0, 160));
      }
      expect(sospechosas).toEqual([]);
    });
  }
});

describe("/precios no cobra por un servicio retirado", () => {
  it("el stack de arranque no vende migración ni sync de OTAs", () => {
    const src = sinComentarios(leer("components/landing/PricingSection.tsx"));
    expect(src).not.toMatch(/titulo:\s*["'][^"']*(sync|sincron)[^"']*["']/i);
  });
});
