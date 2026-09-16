// «Regístrate y pruébalo por dentro» tiene que funcionar sin tropiezos y sin
// mentir (decisión de Manolo, 15 sep 2026). Lo que se vigila aquí salió de
// revisar el alta de punta a punta:
//
//   • /entrar abría SIEMPRE en «Entrar»: quien venía a registrarse tecleaba su
//     correo nuevo y leía «Correo o contraseña incorrectos».
//   • El enlace del correo que fallaba devolvía a /entrar sin decir nada.
//   • La bienvenida decía «30 días gratis» a quien tenía 14 y le pedía subir las
//     habitaciones que acababa de subir.
//   • «Primeros pasos» marcaba «Sitio publicado» sin que nadie hiciera nada, daba
//     por conectados unos cobros a medias y no invitaba a probar nada.
//   • El hub decía «cada hotel nuevo incluye 14 días», y la prueba es por dueño.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// AuthForm lee el router y, sin llaves de Supabase, se queda en «Configuración
// pendiente». Ninguna prueba toca la red: el cliente de Supabase no se llama al
// pintar.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
}));
vi.mock("@/lib/supabase/env", () => ({
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_ANON_KEY: "anon",
  supabaseEnvReady: true,
}));

import { AuthForm, type TextosAuth } from "@/components/panel/AuthForm";
import { SuscripcionCard } from "@/components/panel/SuscripcionCard";
import {
  estadoDelMotor,
  progresoPrimerosPasos,
  tareasPrimerosPasos,
  type DatosPrimerosPasos,
} from "@/lib/panel/primeros-pasos";
import { buildBienvenidaHotelHtml, buildRecordatorioPruebaHtml } from "@/lib/email/prueba";
import { PRUEBA_DIAS, type AccesoHotel } from "@/lib/suscripcion";
import { GARANTIA, PRECIO_DESDE } from "@/lib/oferta";

// ── /entrar ─────────────────────────────────────────────────────────────────

const TEXTOS: TextosAuth = {
  registro: { titulo: "Crea tu cuenta y prueba Kora", detalle: "registro" },
  entrar: { titulo: "Empieza a cargar tu hotel", detalle: "entrar" },
};

describe("el formulario de acceso", () => {
  it("con ?registro=1 abre en «Crear mi cuenta», con su título", () => {
    const html = renderToStaticMarkup(<AuthForm registroInicial textos={TEXTOS} />);
    expect(html).toContain("Crear mi cuenta");
    expect(html).toContain("Crea tu cuenta y prueba Kora");
    expect(html).not.toContain("Empieza a cargar tu hotel");
  });

  it("sin el parámetro sigue abriendo en «Entrar»", () => {
    const html = renderToStaticMarkup(<AuthForm textos={TEXTOS} />);
    expect(html).toContain(">Entrar<");
    expect(html).not.toContain("Crear mi cuenta");
    expect(html).toContain("Empieza a cargar tu hotel");
  });

  it("con ?error=enlace explica por qué el enlace no sirvió", () => {
    const html = renderToStaticMarkup(<AuthForm avisoEnlace />);
    expect(html).toContain("Ese enlace ya no sirve");
    expect(html).toMatch(/otro navegador|navegador distinto/);
  });

  it("sin error no enseña el aviso", () => {
    expect(renderToStaticMarkup(<AuthForm />)).not.toContain("Ese enlace ya no sirve");
  });
});

// ── El motor: qué se le puede prometer al hotelero ──────────────────────────

const VIGENTE = { fin: new Date("2026-09-30T00:00:00Z"), diasRestantes: 10, vencida: false };

function acceso(p: Partial<AccesoHotel> = {}): AccesoHotel {
  return {
    activo: true,
    planActivo: false,
    prueba: VIGENTE,
    bloqueado: false,
    mensajeBloqueo: null,
    publicado: true,
    puedeCobrar: true,
    ...p,
  };
}

describe("estadoDelMotor", () => {
  it("en prueba y sin cobros listos: simula", () => {
    expect(estadoDelMotor({ acceso: acceso(), cobrosListos: false, demo: false })).toBe("prueba");
  });

  it("en prueba CON cobros listos: cobra de verdad", () => {
    expect(estadoDelMotor({ acceso: acceso(), cobrosListos: true, demo: false })).toBe("cobra");
  });

  // El caso que no se puede disfrazar de prueba: el motor NO simula y el cobro
  // cae en la cuenta de Kora.
  it("con plan y sin cobros listos: «sin-cobros», nunca «prueba»", () => {
    expect(
      estadoDelMotor({ acceso: acceso({ planActivo: true, prueba: null }), cobrosListos: false, demo: false }),
    ).toBe("sin-cobros");
  });

  it("prueba vencida: en pausa", () => {
    expect(
      estadoDelMotor({
        acceso: acceso({ activo: false, prueba: { ...VIGENTE, diasRestantes: 0, vencida: true } }),
        cobrosListos: false,
        demo: false,
      }),
    ).toBe("pausado");
  });

  // Activar el plan no quita un bloqueo: no se le puede decir «activa tu plan».
  it("bloqueado va aparte de la prueba vencida", () => {
    expect(
      estadoDelMotor({ acceso: acceso({ activo: false, bloqueado: true, prueba: null }), cobrosListos: true, demo: false }),
    ).toBe("bloqueado");
  });

  it("el hotel de demostración simula", () => {
    expect(estadoDelMotor({ acceso: acceso({ prueba: null }), cobrosListos: false, demo: true })).toBe("prueba");
  });
});

// ── Primeros pasos ──────────────────────────────────────────────────────────

const item = (ok: boolean, label: string) => ({ ok, label });

function datos(p: Partial<DatosPrimerosPasos> = {}): DatosPrimerosPasos {
  return {
    slug: "posada",
    diagnostico: {
      habitaciones: item(true, "Habitaciones"),
      precios: item(true, "Precios"),
      fotos: item(false, "Fotos"),
      amenidades: item(false, "Amenidades"),
      experiencias: item(false, "Experiencias"),
      reglas: item(false, "Reglas"),
    },
    estadoMotor: "prueba",
    cobrosListos: false,
    camilaProbada: false,
    puedeVerPagos: true,
    puedeProbarCamila: true,
    puedeVincular: true,
    ...p,
  };
}

const porId = (d: DatosPrimerosPasos, id: string) => tareasPrimerosPasos(d).find((t) => t.id === id);

describe("la lista invita a PROBAR, no sólo a configurar", () => {
  it("chat de Camila, reserva de prueba y WhatsApp, en el grupo de probar", () => {
    const probar = tareasPrimerosPasos(datos()).filter((t) => t.grupo === "probar").map((t) => t.id);
    expect(probar).toEqual(["camila-chat", "motor", "whatsapp"]);
  });

  it("el chat se palomea con lo que marca el servidor a las 3 preguntas", () => {
    expect(porId(datos(), "camila-chat")!.ok).toBe(false);
    expect(porId(datos({ camilaProbada: true }), "camila-chat")!.ok).toBe(true);
  });

  // Ni la reserva simulada ni la vinculación dejan un rastro fiable en la base:
  // se enseñan como enlace, nunca con un estado inventado.
  it("la reserva de prueba y el WhatsApp van SIN palomita", () => {
    expect(porId(datos(), "motor")!.ok).toBeNull();
    expect(porId(datos(), "whatsapp")!.ok).toBeNull();
  });

  it("la reserva de prueba abre el motor del hotel en otra pestaña", () => {
    const motor = porId(datos(), "motor")!;
    expect(motor.href).toBe("/h/posada/reservar");
    expect(motor.nuevaPestana).toBe(true);
    expect(motor.label).toMatch(/reserva de prueba/i);
  });
});

describe("sólo se invita a una reserva de prueba si de verdad se simula", () => {
  it("con cobros reales no se habla de «reserva de prueba» y se avisa que cobra", () => {
    const motor = porId(datos({ estadoMotor: "cobra", cobrosListos: true }), "motor")!;
    expect(motor.label).not.toMatch(/reserva de prueba/i);
    expect(motor.detalle).toMatch(/se cobra/);
  });

  it("con plan y sin cobros listos tampoco", () => {
    expect(porId(datos({ estadoMotor: "sin-cobros" }), "motor")!.label).not.toMatch(/reserva de prueba/i);
  });

  it("con el motor en pausa no hay nada que probar en él", () => {
    expect(porId(datos({ estadoMotor: "pausado" }), "motor")).toBeUndefined();
    expect(porId(datos({ estadoMotor: "bloqueado" }), "motor")).toBeUndefined();
  });
});

describe("las dos casillas que mentían", () => {
  it("«Sitio publicado» ya no es una tarea (el hotel nace publicado)", () => {
    const ids = tareasPrimerosPasos(datos()).map((t) => t.id);
    expect(ids).not.toContain("publicado");
    expect(tareasPrimerosPasos(datos()).some((t) => /publicado/i.test(t.label))).toBe(false);
  });

  it("«Cobros» se palomea con cobros listos de verdad, no con tener cuenta", () => {
    expect(porId(datos({ cobrosListos: false }), "cobros")!.ok).toBe(false);
    expect(porId(datos({ cobrosListos: true, estadoMotor: "cobra" }), "cobros")!.ok).toBe(true);
  });

  it("a quien no puede abrir Pagos no se le manda ahí", () => {
    const cobros = porId(datos({ puedeVerPagos: false }), "cobros")!;
    expect(cobros.href).toBeNull();
    expect(cobros.detalle).toMatch(/dueño/);
  });

  it("sin permiso de Camila no aparecen el chat ni el QR", () => {
    const ids = tareasPrimerosPasos(datos({ puedeProbarCamila: false, puedeVincular: false })).map((t) => t.id);
    expect(ids).not.toContain("camila-chat");
    expect(ids).not.toContain("whatsapp");
  });
});

describe("el avance cuenta sólo lo que se mide", () => {
  it("las tareas sin palomita no suben ni bajan el avance", () => {
    const tareas = tareasPrimerosPasos(datos());
    const { hechas, total } = progresoPrimerosPasos(tareas);
    // camila-chat, 6 del diagnóstico y cobros = 8 medibles; 2 hechas.
    expect(total).toBe(8);
    expect(hechas).toBe(2);
  });

  it("completo cuando todo lo medible está hecho, aunque queden enlaces", () => {
    const todo = datos({
      camilaProbada: true,
      cobrosListos: true,
      estadoMotor: "cobra",
      diagnostico: {
        habitaciones: item(true, "a"),
        precios: item(true, "b"),
        fotos: item(true, "c"),
        amenidades: item(true, "d"),
        experiencias: item(true, "e"),
        reglas: item(true, "f"),
      },
    });
    expect(progresoPrimerosPasos(tareasPrimerosPasos(todo)).completo).toBe(true);
  });
});

// ── Correos de la prueba ────────────────────────────────────────────────────

describe("la bienvenida dice los días que aplica el sistema", () => {
  const html = buildBienvenidaHotelHtml({ hotelNombre: "Posada", slug: "posada" });

  it(`por defecto, ${PRUEBA_DIAS} días (no el 30 de antes)`, () => {
    expect(html).toContain(`${PRUEBA_DIAS} días gratis`);
    expect(html).not.toMatch(/\b30 días/);
  });

  it("no le pide subir las habitaciones que ya subió al crear el hotel", () => {
    expect(html).not.toMatch(/sube tus habitaciones/i);
  });

  it("le invita a probarlo por dentro", () => {
    expect(html).toMatch(/chat de prueba/);
    expect(html).toMatch(/reserva de prueba/);
  });

  it("con los días que le quedan a un dueño que ya había empezado", () => {
    expect(buildBienvenidaHotelHtml({ hotelNombre: "P", slug: "p", diasPrueba: 5 })).toContain("5 días gratis");
  });

  it("si ya gastó su prueba, no le regala días: le pide activar el plan", () => {
    const gastada = buildBienvenidaHotelHtml({ hotelNombre: "P", slug: "p", diasPrueba: 0 });
    expect(gastada).not.toMatch(/días gratis/);
    expect(gastada).toContain("Activar mi plan");
  });

  // Al vencer, el chat de prueba responde «motor pausado» y el motor enseña la
  // pausa: invitarlo a probar era mandarlo a puertas cerradas.
  it("con la prueba gastada no le invita a probar lo que está en pausa", () => {
    const gastada = buildBienvenidaHotelHtml({ hotelNombre: "P", slug: "p", diasPrueba: 0 });
    expect(gastada).not.toMatch(/chat de prueba|reserva de prueba|Pruébalo por dentro/);
    expect(gastada).toContain("1. Activa tu plan");
  });

  it("con plan o cortesía (null) no habla de prueba", () => {
    const conPlan = buildBienvenidaHotelHtml({ hotelNombre: "P", slug: "p", diasPrueba: null });
    expect(conPlan).not.toMatch(/días gratis|reserva de prueba/);
  });
});

describe("el precio de los correos sale de PRECIO_DESDE", () => {
  it("el recordatorio cita la mensualidad vigente", () => {
    const html = buildRecordatorioPruebaHtml({ hotelNombre: "Posada", diasRestantes: 3 });
    expect(html).toContain(`$${PRECIO_DESDE.toLocaleString("es-MX")} MXN al mes`);
  });
});

// ── La barra de la prueba en el hub ─────────────────────────────────────────

describe("la barra del hub dice cuántos días quedan", () => {
  it("con prueba vigente, los días que le quedan", () => {
    const html = renderToStaticMarkup(
      <SuscripcionCard plan={null} estado={null} esStripe={false} prueba={{ diasRestantes: 9, vencida: false }} />,
    );
    expect(html).toContain("te quedan 9 días");
    expect(html).toContain("Prueba gratis");
  });

  it("ya no dice que cada hotel nuevo trae su propia prueba", () => {
    const html = renderToStaticMarkup(<SuscripcionCard plan={null} estado={null} esStripe={false} />);
    expect(html).not.toMatch(/cada hotel nuevo/i);
    expect(html).toMatch(/una sola prueba por cuenta/i);
  });

  it("vencida: lo dice y ofrece activar", () => {
    const html = renderToStaticMarkup(
      <SuscripcionCard plan={null} estado={null} esStripe={false} prueba={{ diasRestantes: 0, vencida: true }} />,
    );
    expect(html).toContain("Prueba gratis terminada");
    expect(html).toContain("Activar mi plan");
  });

  // Pulsó «Activar mi plan» en su prueba y no terminó de pagar: queda en
  // «incompleta» con cliente de Stripe, y el hub le escondía los días.
  it("con el pago a medias también ve los días que le quedan", () => {
    const html = renderToStaticMarkup(
      <SuscripcionCard plan="kora" estado="incompleta" esStripe prueba={{ diasRestantes: 6, vencida: false }} />,
    );
    expect(html).toContain("Te quedan 6 días de tu prueba gratis");
  });

  it("quien canceló y ya no tiene prueba no ve días", () => {
    const html = renderToStaticMarkup(
      <SuscripcionCard plan="kora" estado="cancelada" esStripe prueba={{ diasRestantes: 0, vencida: true }} />,
    );
    expect(html).not.toMatch(/prueba gratis/i);
  });

  it("sin hotel todavía: los días de la oferta, desde la constante", () => {
    const html = renderToStaticMarkup(<SuscripcionCard plan={null} estado={null} esStripe={false} sinHoteles />);
    expect(html).toContain(`Tus ${GARANTIA.diasPrueba} días empiezan`);
  });
});
