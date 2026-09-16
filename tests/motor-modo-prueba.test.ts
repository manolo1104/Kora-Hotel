// El motor en MODO PRUEBA, visto desde el motor: lo que ve la persona y lo que
// hace el servidor. La DECISIÓN (quién está en modo prueba) se prueba aparte en
// `modo-prueba.test.ts`; aquí se vigila que el motor la respete.
//
// Las dos formas de hacer daño:
//   1. Que el pago simulado se cuele al checkout y aparte un cuarto o abra una
//      sesión de Stripe (el cobro caería en la cuenta de Kora, que es justo lo
//      que el modo prueba vino a cortar).
//   2. Que un huésped DE VERDAD —llegó por el WhatsApp del hotel, no es el
//      hotelero probando— se vaya creyendo que tiene cuarto.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { t, type MsgKey } from "@/lib/booking/i18n";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Quita comentarios: documentar el defecto no puede contar como el código. */
function sinComentarios(src: string): string {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
    .join("\n");
}

/** Posición de `aguja` en `src`; falla la prueba si no está (un -1 pasaría un «antes que»). */
function pos(src: string, aguja: string): number {
  const i = src.indexOf(aguja);
  expect(i, `no encontré ${aguja}`).toBeGreaterThanOrEqual(0);
  return i;
}

describe("lo que lee quien está mirando (puede ser un huésped real)", () => {
  it("el aviso de arriba dice exactamente lo que acordó Manolo", () => {
    expect(t("es", "pruebaBanner")).toBe(
      "Reserva de prueba: este hotel todavía no activa cobros en línea. No se cobra nada y no se aparta ningún cuarto.",
    );
  });

  const TEXTOS_PRUEBA: MsgKey[] = [
    "pruebaBanner",
    "pruebaBannerWa",
    "pruebaDatosSub",
    "pruebaPagoTitulo",
    "pruebaPagasAhora",
    "pruebaPagar",
    "pruebaNotaPago",
    "pruebaConfTitulo",
    "pruebaFolio",
    "pruebaConfTexto",
    "pruebaConfWa",
    "pruebaConfSinWa",
    "pruebaConfDueno",
    "pruebaConfOtra",
    "errModoPrueba",
  ];

  // «Confirmada», «número de confirmación», «pagado»: cualquiera de esas
  // palabras en la pantalla final es un huésped que llega al hotel sin reserva.
  it("ningún texto del modo prueba suena a reserva hecha o a pago hecho, en ningún idioma", () => {
    for (const lang of ["es", "en"] as const) {
      for (const k of TEXTOS_PRUEBA) {
        const s = t(lang, k);
        expect(s, `${lang}.${k}`).not.toMatch(/confirmad|confirmaci[oó]n|confirmed|confirmation|pagad[oa]|\bpaid\b/i);
      }
    }
  });

  it("están traducidos de verdad (el inglés no es el español copiado)", () => {
    for (const k of TEXTOS_PRUEBA) {
      expect(t("en", k), k).not.toBe(t("es", k));
      expect(t("en", k).trim(), k).not.toBe("");
    }
  });

  it("el botón final no dice «Pagar» y avisa que no se cobra", () => {
    expect(t("es", "pruebaPagar")).not.toMatch(/^pagar/i);
    expect(t("es", "pruebaPagar")).toMatch(/no se cobra/i);
    expect(t("en", "pruebaPagar")).not.toMatch(/^pay/i);
    expect(t("en", "pruebaPagar")).toMatch(/no charge/i);
  });

  it("la pantalla final le dice cómo reservar de verdad", () => {
    expect(t("es", "pruebaConfWa")).toMatch(/reservar de verdad/i);
    expect(t("es", "pruebaConfSinWa")).toMatch(/reservar de verdad/i);
    expect(t("es", "pruebaConfTexto")).toMatch(/no se cobr[oó] nada/i);
  });
});

describe("el checkout del motor cierra la puerta ANTES de mover nada", () => {
  const src = sinComentarios(leer("app/api/h/[slug]/checkout/route.ts"));

  it("el 403 «modo-prueba» va después de saber el acceso y antes de apartar o hablar con Stripe", () => {
    const guard = pos(src, 'error: "modo-prueba"');
    expect(guard).toBeGreaterThan(pos(src, "accesoDelHotel(hotel)"));
    for (const peligro of [
      "apartarUnidades(",
      "apartarExperienciaVentas(",
      "stripe.customers.create(",
      "stripe.checkout.sessions.create(",
    ]) {
      expect(guard, peligro).toBeLessThan(pos(src, peligro));
    }
  });

  it("decide con la regla compartida, no con una copia", () => {
    expect(src).toContain("decidirModoPrueba({ acceso, cobrosListos");
  });

  // Connect se lee UNA vez: si el guard y el destino del dinero leyeran por
  // separado, podrían discrepar (el guard dice «cobra» y el dinero va a Kora).
  it("reusa la lectura de Connect del guard para decidir en qué cuenta entra el dinero", () => {
    expect(src).toContain("connectLeido ?? (await getConnectState(");
    expect(src.match(/getConnectState\(/g) ?? []).toHaveLength(2);
  });

  // Quien paga o tiene cortesía sin Connect sigue cobrando (degradado a Kora,
  // con su alerta). Apagarle el motor a un cliente de pago sería peor.
  it("el camino de los hoteles con plan queda intacto, cobro degradado incluido", () => {
    expect(src).toContain('cobroEn: direct ? "hotel" : "plataforma"');
    expect(src).toContain("cobro a la cuenta de Kora, no a la del hotel");
  });
});

describe("la captura de correos no guarda a quien está probando", () => {
  it("/intento pregunta por el modo prueba antes de escribir en booking_intents", () => {
    const src = sinComentarios(leer("app/api/h/[slug]/intento/route.ts"));
    expect(pos(src, "motorEnModoPrueba(hotel)")).toBeLessThan(pos(src, '"booking_intents"'));
  });
});

describe("la página y el cliente del motor", () => {
  it("la página calcula el modo prueba con el acceso que ya tiene y lo pasa como prop propia", () => {
    const src = sinComentarios(leer("app/h/[slug]/reservar/page.tsx"));
    expect(src).toContain("motorEnModoPrueba(hotel, acceso)");
    expect(src).toContain("modoPrueba={modoPrueba}");
    // No es `demo`: los textos del demo le venden Kora a un hotelero.
    expect(src).toContain("demo={extras.demo === true}");
  });

  const cliente = sinComentarios(leer("app/h/[slug]/reservar/ReservarClient.tsx"));

  it("el pago simulado se decide antes de llamar al checkout", () => {
    const handlePay = cliente.slice(pos(cliente, "async function handlePay()"));
    expect(pos(handlePay, "if (simulado) {")).toBeLessThan(pos(handlePay, "/checkout`"));
    expect(cliente).toContain("const simulado = demo || prueba;");
  });

  it("no manda el correo a /intento cuando simula", () => {
    const captura = cliente.slice(pos(cliente, "function captureIntent("));
    expect(pos(captura, "if (simulado) return;")).toBeLessThan(pos(captura, "/intento`"));
  });

  // El paso de datos decía «Con tu correo te enviamos la confirmación y tu folio
  // de reserva» también en modo prueba: un huésped real se queda esperando un
  // correo que nunca llega, convencido de que reservó.
  it("el paso de datos no promete un correo de confirmación ni lleva «al pago»", () => {
    expect(cliente).toContain('t(lang, prueba ? "pruebaDatosSub" : "datosSub")');
    expect(cliente).not.toMatch(/t\(lang, "datosSub"\)/);
    expect(cliente).not.toMatch(/t\(lang, "continuarPago"\)/);
    expect(t("es", "pruebaDatosSub")).toMatch(/ningún correo/i);
  });

  it("la pantalla final del modo prueba no reusa la del demo ni el «número de confirmación»", () => {
    const inicio = pos(cliente, "simuladoOk && prueba && (");
    const fin = pos(cliente, "simuladoOk && !prueba && (");
    const pantalla = cliente.slice(inicio, fin);
    expect(pantalla).toContain('"pruebaConfTitulo"');
    expect(pantalla).toContain("waHotel");
    expect(pantalla).not.toContain('"confFolio"');
    expect(pantalla).not.toContain('"demoConf');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Añadido al INTEGRAR (15 sep 2026). Dos huecos que sólo se ven al juntar las
// partes: cada agente dejó su lado listo y nadie enchufó el cable.
// ─────────────────────────────────────────────────────────────────────────────

describe("el panel le dice al hotelero que su motor simula", () => {
  // `PruebaBanner` ya aceptaba `modoPrueba`, pero el layout no se lo pasaba y la
  // prop es `false` por defecto: el aviso NO salía en ninguna pantalla del panel.
  // Justo el hotelero al que se invita a «probar tu motor» era el único que no
  // sabía si se cobraba de verdad.
  const src = sinComentarios(leer("app/panel/[slug]/(operativo)/layout.tsx"));

  it("el layout calcula el modo prueba y se lo pasa al banner", () => {
    expect(src).toContain("motorEnModoPrueba(ctx.hotel, acceso)");
    expect(src).toMatch(/modoPrueba=\{modoPrueba\}/);
  });

  it("sólo lo calcula mientras corre la prueba (no le pregunta a Stripe por cada pantalla)", () => {
    expect(src).toContain("enPrueba ? await motorEnModoPrueba(");
  });

  it("a quien no puede abrir Pagos no se le da el enlace", () => {
    expect(src).toContain('puedeCtx(ctx, "pagos:ver")');
  });
});

describe("«cobros listos» se define en un solo sitio", () => {
  // La expresión `connect.chargesEnabled && connect.accountId` vivía escrita dos
  // veces: en modo-prueba.ts y en el checkout. Si un día dejaran de coincidir,
  // el guard creería que el hotel cobra y el dinero seguiría cayendo en la
  // cuenta de Kora (o al revés: se simularía un cobro que el hotelero espera).
  it("el checkout y el guard usan la misma función, no una copia de la expresión", () => {
    const checkout = sinComentarios(leer("app/api/h/[slug]/checkout/route.ts"));
    const guard = sinComentarios(leer("lib/motor/modo-prueba.ts"));
    expect(checkout).toContain("cobrosListosDe(connectLeido)");
    expect(checkout).toContain("const direct = cobrosListosDe(connect)");
    expect(checkout).not.toMatch(/Boolean\(connect\w*\.chargesEnabled/);
    expect(guard.match(/chargesEnabled && connect\.accountId/g) ?? []).toHaveLength(1);
  });
});
