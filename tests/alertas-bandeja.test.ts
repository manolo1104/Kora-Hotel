// Las reglas puras de la bandeja del fundador (/crm/bandeja): agrupar alertas
// repetidas, enlazar el hotel que mencionan, sacar el contacto que dejó un
// visitante en el chat y convertir ese chat en un lead sin duplicarlo.
import { describe, it, expect, vi } from "vitest";

// El módulo también trae los lectores de la base; aquí no se usan.
vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: false,
  createAdminClient: () => {
    throw new Error("sin base en pruebas");
  },
}));

const {
  agruparAlertas,
  ALERTAS_MAX,
  avisoDeChats,
  avisoDeTope,
  chatDeFila,
  CHATS_MAX,
  contactoDeMensajes,
  cuerpoLeadDeChat,
  estadoDelChat,
  faltaColumna,
  faltaTabla,
  hotelesMencionados,
  leadDeChat,
  marcaDeChat,
  normalizarMensajes,
  notasDeLead,
  ordenarChats,
  ORIGEN_CHAT,
} = await import("@/lib/crm/bandeja");
const { sanitizeLead } = await import("@/lib/crm/server");

const ID_LUNA = "11111111-1111-4111-8111-111111111111";
const ID_LUNA_2 = "22222222-2222-4222-8222-222222222222";
const ID_HOTEL = "33333333-3333-4333-8333-333333333333";
const HOTELES = [
  { id: ID_LUNA, slug: "casa-luna", nombre: "Casa Luna" },
  { id: ID_LUNA_2, slug: "casa-luna-ab12", nombre: "Casa Luna Centro" },
  { id: ID_HOTEL, slug: "hotel", nombre: "Hotel" },
];

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("errores de la base", () => {
  it("falta ESA columna, no cualquiera: faltar `email` no es faltar `secuencia_pausada`", () => {
    const sinSecuencia = { code: "PGRST204", message: "Could not find the 'secuencia_pausada' column of 'crm_leads' in the schema cache" };
    const sinEmail = { code: "PGRST204", message: "Could not find the 'email' column of 'crm_leads' in the schema cache" };
    expect(faltaColumna(sinSecuencia, "secuencia_pausada")).toBe(true);
    expect(faltaColumna(sinEmail, "secuencia_pausada")).toBe(false);
    expect(
      faltaColumna({ code: "42703", message: "column soporte_conversaciones.atendido_at does not exist" }, "atendido_at"),
    ).toBe(true);
    expect(faltaColumna({ code: "42703" }, "atendido_at")).toBe(true);
    expect(faltaColumna({ code: "57014", message: "canceling statement due to statement timeout" }, "atendido_at")).toBe(false);
    expect(faltaColumna(null, "atendido_at")).toBe(false);
  });

  it("tabla ausente por código o por mensaje", () => {
    expect(faltaTabla({ code: "PGRST205", message: "Could not find the table 'public.alertas_fundador'" })).toBe(true);
    expect(faltaTabla({ code: "42P01" })).toBe(true);
    expect(faltaTabla({ code: "08006", message: "connection failure" })).toBe(false);
  });
});

describe("hotelesMencionados", () => {
  it("enlaza por id (así nombran al hotel casi todas las alertas)", () => {
    expect(hotelesMencionados(`Hotel ${ID_LUNA}. Error: x`, HOTELES)).toEqual([{ slug: "casa-luna", nombre: "Casa Luna" }]);
  });

  it("enlaza por slug como palabra entera, sin confundirlo con uno más largo", () => {
    expect(hotelesMencionados("El hotel casa-luna-ab12 no puede cobrar", HOTELES).map((h) => h.slug)).toEqual([
      "casa-luna-ab12",
    ]);
    expect(hotelesMencionados("saldo: casa-luna llegó a 59 mensajes", HOTELES).map((h) => h.slug)).toEqual(["casa-luna"]);
  });

  it("un slug que es una palabra corriente («hotel») no se enlaza: saldría en todas", () => {
    expect(hotelesMencionados("una sesión de pago que no cuadra con su hotel", HOTELES)).toEqual([]);
  });

  it("un slug largo de una palabra sí se enlaza, uno genérico de la lista no", () => {
    const hoteles = [
      { id: uuid(1), slug: "tlaxcalteca", nombre: null },
      { id: uuid(2), slug: "reservas", nombre: "Reservas" },
    ];
    expect(hotelesMencionados("tope en tlaxcalteca; reservas perdidas", hoteles)).toEqual([
      { slug: "tlaxcalteca", nombre: "tlaxcalteca" },
    ]);
  });

  it("sin repetir y con tope", () => {
    const hoteles = [1, 2, 3, 4].map((n) => ({ id: uuid(n), slug: `hotel-${n}`, nombre: null }));
    const texto = `${uuid(1)} hotel-1 hotel-2 hotel-3 hotel-4`;
    expect(hotelesMencionados(texto, hoteles).map((h) => h.slug)).toEqual(["hotel-1", "hotel-2", "hotel-3"]);
  });
});

describe("agruparAlertas", () => {
  const fila = (n: number, asunto: string, created: string, atendida: string | null = null, detalle = "d") => ({
    id: uuid(n),
    created_at: created,
    asunto,
    detalle,
    atendida_at: atendida,
  });

  it("junta las pendientes con el mismo asunto y pone las pendientes primero", () => {
    const grupos = agruparAlertas(
      [
        fila(1, "Stripe no contestó", "2026-09-15T10:00:00+00:00"),
        fila(2, "Stripe no contestó", "2026-09-15T12:00:00+00:00"),
        fila(3, "firma inválida", "2026-09-15T11:00:00+00:00"),
        fila(4, "vieja atendida", "2026-09-15T13:00:00+00:00", "2026-09-15T14:00:00+00:00"),
      ],
      [],
    );
    expect(grupos.map((g) => g.asunto)).toEqual(["Stripe no contestó", "firma inválida", "vieja atendida"]);
    const stripe = grupos[0];
    expect(stripe.veces).toBe(2);
    expect(stripe.ids).toEqual([uuid(2), uuid(1)]);
    expect(stripe.ultima).toBe("2026-09-15T12:00:00+00:00");
    expect(stripe.primera).toBe("2026-09-15T10:00:00+00:00");
    expect(stripe.atendida_at).toBeNull();
  });

  it("las atendidas se agrupan por el clic que las atendió, no por asunto solo", () => {
    const grupos = agruparAlertas([
      fila(1, "igual", "2026-09-14T10:00:00+00:00", "2026-09-14T12:00:00+00:00"),
      fila(2, "igual", "2026-09-14T11:00:00+00:00", "2026-09-14T12:00:00+00:00"),
      fila(3, "igual", "2026-09-15T10:00:00+00:00", "2026-09-15T12:00:00+00:00"),
    ]);
    expect(grupos.map((g) => g.veces)).toEqual([1, 2]);
  });

  // El hotel va delante del detalle; buscarlo en 400 KB por grupo y POR HOTEL
  // es lo que congela la bandeja cuando haya 500 hoteles en vez de 12.
  it("busca el hotel al principio del detalle, no en un stack de 20.000 caracteres", () => {
    const lejos = `${"x".repeat(2_500)} casa-luna`;
    const cerca = `casa-luna ${"x".repeat(2_500)}`;
    const grupos = agruparAlertas(
      [fila(1, "a", "2026-09-15T10:00:00+00:00", null, lejos), fila(2, "b", "2026-09-15T10:00:00+00:00", null, cerca)],
      HOTELES,
    );
    expect(grupos.find((g) => g.asunto === "a")?.hoteles).toEqual([]);
    expect(grupos.find((g) => g.asunto === "b")?.hoteles).toEqual([{ slug: "casa-luna", nombre: "Casa Luna" }]);
  });

  it("enlaza el hotel que menciona el detalle y descarta filas rotas", () => {
    const grupos = agruparAlertas(
      [
        fila(1, "cobro a la cuenta de Kora", "2026-09-15T10:00:00+00:00", null, `El hotel casa-luna (${ID_LUNA})`),
        { id: "no-es-uuid", created_at: "2026-09-15T10:00:00+00:00", asunto: "x", detalle: null, atendida_at: null },
      ],
      HOTELES,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].hoteles).toEqual([{ slug: "casa-luna", nombre: "Casa Luna" }]);
  });
});

// Una bandeja recortada en silencio se lee como una bandeja al día: el número de
// la pestaña sale de los grupos que caben, no de los que hay.
describe("avisoDeTope", () => {
  it("calla cuando se ve todo", () => {
    expect(avisoDeTope(3, 3)).toBeUndefined();
    expect(avisoDeTope(ALERTAS_MAX, ALERTAS_MAX)).toBeUndefined();
  });

  it("avisa cuando hay más asuntos distintos de los que caben, y dice que el número tampoco", () => {
    const t = String(avisoDeTope(200, ALERTAS_MAX + 30));
    expect(t).toContain(String(ALERTAS_MAX + 30));
    expect(t).toContain("El número de la pestaña tampoco las cuenta todas.");
  });

  it("avisa cuando se leyeron menos filas de las que hay", () => {
    expect(String(avisoDeTope(500, 4))).toContain("500");
  });
});

// Los chats tenían el mismo agujero que las alertas y sin arreglar: se leen los
// CHATS_MAX más recientes por `updated_at`, sin ventana de tiempo, y marcar uno
// como atendido le mueve el `updated_at` (trigger `soporte_touch`), así que los
// atendidos se ponen delante y empujan fuera a los pendientes viejos.
describe("avisoDeChats", () => {
  it("calla mientras caben todos", () => {
    expect(avisoDeChats(0)).toBeUndefined();
    expect(avisoDeChats(CHATS_MAX)).toBeUndefined();
  });

  it("avisa en cuanto llega una de más, y dice que el número de la pestaña tampoco los cuenta", () => {
    const t = String(avisoDeChats(CHATS_MAX + 1));
    expect(t).toContain(String(CHATS_MAX));
    expect(t).toContain("El número de la pestaña tampoco los cuenta todos.");
  });
});

describe("chats: mensajes y contacto", () => {
  it("normaliza el jsonb a la defensiva", () => {
    expect(
      normalizarMensajes([
        { rol: "user", texto: "hola" },
        { rol: "system", texto: "x" },
        { rol: "assistant", texto: "   " },
        null,
        "texto suelto",
        { rol: "assistant", texto: "¿en qué te ayudo?", ts: "2026-09-15T10:00:00.000Z" },
      ]),
    ).toEqual([
      { rol: "user", texto: "hola", ts: null },
      { rol: "assistant", texto: "¿en qué te ayudo?", ts: "2026-09-15T10:00:00.000Z" },
    ]);
    expect(normalizarMensajes({ no: "es lista" })).toEqual([]);
  });

  it("saca el correo y el teléfono del VISITANTE, no el WhatsApp de Kora que da el asistente", () => {
    const c = contactoDeMensajes([
      { rol: "assistant", texto: "Escríbenos al 55 1234 5678 o a hola@kora-hotel.com", ts: null },
      { rol: "user", texto: "Soy Ana, mi cel es 481 123 4567 y mi correo Ana.Lopez@Hotel.mx.", ts: null },
      { rol: "user", texto: "otra vez: 4811234567, o +52 1 481 765 4321", ts: null },
    ]);
    expect(c.emails).toEqual(["ana.lopez@hotel.mx"]);
    expect(c.telefonos).toEqual(["4811234567", "5214817654321"]);
  });

  it("fechas, precios y número de cuartos no son teléfonos", () => {
    const c = contactoDeMensajes([
      { rol: "user", texto: "Del 15-09-2026 al 20, tengo 12 cuartos y cobro $1,200.00 la noche", ts: null },
    ]);
    expect(c.telefonos).toEqual([]);
  });
});

describe("chats: estado", () => {
  const msgs = (ts: string | null) => [
    { rol: "user" as const, texto: "hola", ts: null },
    { rol: "assistant" as const, texto: "hola", ts },
  ];

  it("sin marca = pendiente", () => {
    expect(estadoDelChat(null, msgs("2026-09-15T10:00:00.000Z"))).toBe("pendiente");
  });

  it("atendido y sin mensajes nuevos = atendido", () => {
    expect(estadoDelChat("2026-09-15T11:00:00.000Z", msgs("2026-09-15T10:00:00.000Z"))).toBe("atendido");
  });

  it("escribió después de atenderlo = volvió", () => {
    expect(estadoDelChat("2026-09-15T11:00:00.000Z", msgs("2026-09-15T12:00:00.000Z"))).toBe("volvio");
  });

  it("sin fecha en los mensajes no se inventa que volvió", () => {
    expect(estadoDelChat("2026-09-15T11:00:00.000Z", msgs(null))).toBe("atendido");
  });

  it("ordena lo que pide atención arriba y, dentro, lo último que escribió", () => {
    const base = { pagina: null, created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-15T23:00:00Z" };
    const chats = [
      chatDeFila({ ...base, id: uuid(1), atendido_at: "2026-09-15T11:00:00.000Z", mensajes: msgs("2026-09-15T10:00:00.000Z") }),
      chatDeFila({ ...base, id: uuid(2), atendido_at: null, mensajes: msgs("2026-09-14T10:00:00.000Z") }),
      chatDeFila({ ...base, id: uuid(3), atendido_at: "2026-09-15T11:00:00.000Z", mensajes: msgs("2026-09-15T12:00:00.000Z") }),
    ];
    expect(ordenarChats(chats).map((c) => c.id)).toEqual([uuid(3), uuid(2), uuid(1)]);
    // `updated_at` lo mueve también el CRM al marcar: no es «cuándo escribió».
    expect(chats[1].ultimoMensaje).toBe("2026-09-14T10:00:00.000Z");
  });
});

describe("pasar un chat a lead", () => {
  const CHAT_ID = "44444444-4444-4444-8444-444444444444";
  const chat = {
    id: CHAT_ID,
    created_at: "2026-09-15T16:00:00.000Z",
    pagina: "/precios",
    mensajes: [
      { rol: "user" as const, texto: "Quiero que alguien me ayude a dejar mi hotel listo", ts: null },
      { rol: "assistant" as const, texto: "Claro, te paso con el fundador.", ts: "2026-09-15T16:00:05.000Z" },
    ],
  };

  it("las notas llevan lo que escribió el visitante, no lo que contestó el asistente, y la marca del chat", () => {
    const notas = notasDeLead(chat, "Llamarle el lunes");
    expect(notas.startsWith("Llamarle el lunes")).toBe(true);
    expect(notas).toContain("Llegó por el chat de la web");
    expect(notas).toContain("(página /precios)");
    expect(notas).toContain("— Quiero que alguien me ayude a dejar mi hotel listo");
    expect(notas).not.toContain("te paso con el fundador");
    expect(notas.endsWith(`(${marcaDeChat(CHAT_ID)})`)).toBe(true);
  });

  it("la marca sobrevive aunque la conversación sea larguísima", () => {
    const largo = { ...chat, mensajes: Array.from({ length: 50 }, () => ({ rol: "user" as const, texto: "x".repeat(400), ts: null })) };
    const notas = notasDeLead(largo);
    expect(notas).toContain("(…recortado)");
    expect(notas.endsWith(`(${marcaDeChat(CHAT_ID)})`)).toBe(true);
    expect(notas.length).toBeLessThan(4_000);
  });

  it("encuentra el lead que ya salió de ese chat (no se crea otro)", () => {
    const leads = [
      { id: "lead-a", notas: "otra cosa" },
      { id: "lead-b", notas: notasDeLead(chat) },
      { id: "lead-c", notas: null },
    ];
    expect(leadDeChat(leads, CHAT_ID)).toBe("lead-b");
    expect(leadDeChat(leads, uuid(9))).toBeNull();
  });

  it("el cuerpo pasa sanitizeLead: origen chat-web, etapa nuevo, secuencia pausada por defecto", () => {
    const cuerpo = cuerpoLeadDeChat(chat, { hotel_nombre: "Posada del Río", email: "", secuencia: false });
    const { data, error } = sanitizeLead(cuerpo, "create");
    expect(error).toBeUndefined();
    expect(data).toMatchObject({
      hotel_nombre: "Posada del Río",
      origen: ORIGEN_CHAT,
      etapa: "nuevo",
      email: null,
      secuencia_pausada: true,
    });
    expect(String(data?.notas)).toContain(marcaDeChat(CHAT_ID));
  });

  it("si se pide la secuencia, no va pausada", () => {
    const { data } = sanitizeLead(cuerpoLeadDeChat(chat, { hotel_nombre: "X", secuencia: true }), "create");
    expect(data?.secuencia_pausada).toBe(false);
  });
});
