// Que Camila sepa QUIÉN le escribe, y lo que sigue sin saber a propósito.
//
// Dos cosas se prueban aquí, y las dos son de honestidad:
//
//  1. Que el bloque del huésped diga lo que de verdad hay en el CRM de ESE
//     hotel — la pestaña Clientes lleva meses prometiendo que «el bot lee estas
//     notas» y no las leía.
//  2. Que la clave del WiFi NO llegue al cerebro. La guía se volcaba entera y el
//     editor guarda ahí `wifiClave`: Camila podía dictarle la contraseña de la
//     red a cualquiera que se la pidiera antes siquiera de llegar.
import { describe, it, expect } from "vitest";
import { bloqueHuesped, ultimos10 } from "@/lib/bot/huesped";
import { linkReserva } from "@/lib/bot/links";
import { buildBotSystemPrompt, type BotKnowledge } from "@/lib/bot/prompt";
import type { AdminBooking } from "@/lib/db/admin";

const HOY = "2026-09-06";

function reserva(p: Partial<AdminBooking>): AdminBooking {
  return {
    id: "b",
    fecha: "2026-08-01",
    confirmacion: "KORA-1",
    cliente: "María Ejemplo",
    telefono: "5214811234567",
    email: "maria@ejemplo.test",
    total: 9000,
    checkin: "2026-09-20",
    checkout: "2026-09-23",
    noches: 3,
    huespedes: 2,
    habitaciones: "Suite Jungla",
    notas: "",
    paymentId: "",
    estado: "CONFIRMADA",
    comoNosConocio: "",
    anticipo: 4500,
    origen: "web",
    doc: {},
    lang: "es",
    checkoutReal: "",
    checkinReal: "",
    ...p,
  } as AdminBooking;
}

const base = { notas: {}, telefono: "5214811234567", hoy: HOY };

describe("a quién reconoce", () => {
  it("cruza el teléfono por los últimos 10 dígitos, con lada o sin ella", () => {
    expect(ultimos10("+52 1 481 123 4567")).toBe("4811234567");
    expect(ultimos10("4811234567")).toBe("4811234567");
    const txt = bloqueHuesped({ ...base, bookings: [reserva({ telefono: "481 123 4567" })] });
    expect(txt).toContain("María Ejemplo");
  });

  it("a un desconocido no le inventa historia", () => {
    expect(bloqueHuesped({ ...base, bookings: [reserva({ telefono: "5215599998888" })] })).toBe("");
  });

  it("un teléfono corto o vacío no arrastra a nadie", () => {
    expect(bloqueHuesped({ ...base, telefono: "123", bookings: [reserva({})] })).toBe("");
    expect(bloqueHuesped({ ...base, telefono: "", bookings: [reserva({})] })).toBe("");
  });

  it("una reserva cancelada no cuenta como huésped", () => {
    expect(bloqueHuesped({ ...base, bookings: [reserva({ estado: "CANCELADA" })] })).toBe("");
  });
});

describe("qué le cuenta de él", () => {
  it("la reserva que viene, con fechas, cuarto y folio", () => {
    const txt = bloqueHuesped({ ...base, bookings: [reserva({ confirmacion: "KORA-88" })] });
    expect(txt).toContain("reserva CONFIRMADA");
    expect(txt).toContain("Suite Jungla");
    expect(txt).toContain("KORA-88");
  });

  // Alguien que ya está en el cuarto no viene a reservar: viene a pedir toallas.
  // Tratarlo como un lead es el error que más molesta a un huésped.
  it("distingue a quien YA está hospedado", () => {
    const txt = bloqueHuesped({
      ...base,
      bookings: [reserva({ checkin: "2026-09-04", checkout: "2026-09-09" })],
    });
    expect(txt).toContain("ESTÁ HOSPEDADO AHORA MISMO");
    expect(txt).not.toContain("reserva CONFIRMADA");
  });

  it("cuenta las veces que ya vino", () => {
    const txt = bloqueHuesped({
      ...base,
      bookings: [
        reserva({ confirmacion: "V1", checkin: "2026-03-01", checkout: "2026-03-03" }),
        reserva({ confirmacion: "V2", checkin: "2026-06-01", checkout: "2026-06-03" }),
      ],
    });
    expect(txt).toContain("2 veces");
  });

  it("dice lo que falta por pagar, y no lo dice si ya está pagado", () => {
    const debe = bloqueHuesped({ ...base, bookings: [reserva({ total: 9000, anticipo: 4500 })] });
    expect(debe).toContain("por liquidar");
    const pagado = bloqueHuesped({ ...base, bookings: [reserva({ total: 9000, anticipo: 9000 })] });
    expect(pagado).toContain("pagada por completo");
  });

  // La frase de la pestaña Clientes —«el bot lee estas notas»— era falsa hasta
  // esta línea.
  it("las notas del CRM llegan al bloque", () => {
    const txt = bloqueHuesped({
      ...base,
      notas: { "maria@ejemplo.test": "Viaja con perro pequeño" },
      bookings: [reserva({})],
    });
    expect(txt).toContain("Viaja con perro pequeño");
  });

  it("una nota kilométrica se recorta", () => {
    const txt = bloqueHuesped({
      ...base,
      notas: { "maria@ejemplo.test": "x".repeat(2000) },
      bookings: [reserva({})],
    });
    expect(txt.length).toBeLessThan(1500);
  });

  it("le dice que crea al huésped si niega ser esa persona", () => {
    const txt = bloqueHuesped({ ...base, bookings: [reserva({})] });
    expect(txt).toContain("el teléfono puede haber cambiado de manos");
  });
});

// ─── El cerebro del hotel ────────────────────────────────────────────────────

const CONOCIMIENTO: BotKnowledge = {
  nombre: "Hotel de Ejemplo",
  habitaciones: [{ nombre: "Suite", descripcion: "", desde: 2000, desdeTexto: "$2,000 MXN", maxHuespedes: 2 }],
};

describe("la clave del WiFi no sale por WhatsApp", () => {
  it("la guía se manda, pero sin la contraseña de la red", () => {
    const p = buildBotSystemPrompt({
      ...CONOCIMIENTO,
      guia: {
        wifi: "Kora-Huespedes",
        wifiClave: "SuperSecreta123",
        checkin: "3:00 PM",
        recomendaciones: ["Cascada de Tamul"],
      },
    });
    expect(p).toContain("Kora-Huespedes");
    expect(p).toContain("Cascada de Tamul");
    expect(p).not.toContain("SuperSecreta123");
  });

  it("da igual cómo se escriba la clave", () => {
    for (const clave of ["wifiClave", "wifiPassword", "claveWifi", "contraseña"]) {
      const p = buildBotSystemPrompt({ ...CONOCIMIENTO, guia: { [clave]: "SuperSecreta123", wifi: "Kora" } });
      expect(p, clave).not.toContain("SuperSecreta123");
    }
  });

  it("una clave de guía vacía no deja un renglón huérfano", () => {
    const p = buildBotSystemPrompt({ ...CONOCIMIENTO, guia: { wifi: "Kora", checkout: "   " } });
    expect(p).not.toContain("- checkout:");
  });
});

describe("los códigos de descuento existen para Camila", () => {
  it("los enumera con su descripción y prohíbe inventarse otros", () => {
    const p = buildBotSystemPrompt({
      ...CONOCIMIENTO,
      reglas: { promos: [{ code: "VUELVE10", descripcion: "10% de descuento", minNoches: 2 }] },
    });
    expect(p).toContain("VUELVE10");
    expect(p).toContain("10% de descuento");
    expect(p).toContain("mínimo 2 noches");
    expect(p).toContain("No existe ningún otro código");
  });

  it("sin promos configuradas no hay línea de códigos", () => {
    expect(buildBotSystemPrompt({ ...CONOCIMIENTO, reglas: {} })).not.toContain("Códigos de descuento");
  });
});

describe("por qué cambia el precio", () => {
  it("explica el recargo de fin de semana y el descuento entre semana", () => {
    const p = buildBotSystemPrompt({
      ...CONOCIMIENTO,
      ajustesDia: {
        finDeSemana: { dias: "viernes y sábado", texto: "la tarifa sube 20%" },
        entreSemana: { texto: "15% de descuento de lunes a jueves", hasta: "2026-12-01" },
      },
    });
    expect(p).toContain("CUÁNDO CAMBIA EL PRECIO");
    expect(p).toContain("viernes y sábado");
    expect(p).toContain("15% de descuento de lunes a jueves");
    expect(p).toContain("2026-12-01");
  });

  it("sin ajustes ni temporadas, no hay bloque que confunda", () => {
    expect(buildBotSystemPrompt(CONOCIMIENTO)).not.toContain("CUÁNDO CAMBIA EL PRECIO");
  });
});

// ─── Cómo cierra Camila una reserva ──────────────────────────────────────────
//
// Historia: el 8 sep 2026 un huésped recibió el link de pago de Stripe partido a
// la mitad, porque el modelo tenía que copiar 700 caracteres. Se respondió con
// dos cosas: (1) el runtime dejó de confiar en el modelo para transportar ese
// link (`agentes/camila/enlace.js` lo quita del texto y pega el bueno), y (2) el
// prompt empezó a preferir el link del motor, pidiéndole al MODELO que le pegara
// "&checkin=…&checkout=…&adults=N". Esa segunda parte salía mal: links sin `?`,
// sin niños, sin el código de descuento y sin atribución.
//
// Ahora los links al motor los arma el SERVIDOR (lib/bot/links.ts) y llegan ya
// hechos en el resultado de checar_disponibilidad; y como el link de pago ya no
// lo transporta el modelo, el cierre normal vuelve a ser `reservar`, que sí
// aparta el cuarto.
describe("el link de reserva lo arma el servidor, nunca el modelo", () => {
  const MOTOR = "https://kora-hotel.com/h/hotel-san-luis/reservar";

  it("codifica el nombre del cuarto (espacios, ñ, acentos)", () => {
    const l = linkReserva(MOTOR, { habitacion: "Cabaña Ceiba" });
    expect(l).toContain("habitacion=caba%C3%B1a+ceiba");
    expect(l).not.toContain(" ");
  });

  it("lleva fechas, adultos, niños, código y la marca de Camila", () => {
    const u = new URL(
      linkReserva(MOTOR, { habitacion: "Estandar Doble", checkin: "2026-12-08", checkout: "2026-12-10", adultos: 2, ninos: 1, promo: "vuelve10" }),
    );
    expect(u.pathname).toBe("/h/hotel-san-luis/reservar");
    expect(u.searchParams.get("habitacion")).toBe("estandar doble");
    expect(u.searchParams.get("checkin")).toBe("2026-12-08");
    expect(u.searchParams.get("checkout")).toBe("2026-12-10");
    expect(u.searchParams.get("adults")).toBe("2");
    expect(u.searchParams.get("children")).toBe("1");
    expect(u.searchParams.get("promo")).toBe("VUELVE10");
    expect(u.searchParams.get("origen")).toBe("camila");
  });

  it("sin niños no manda children=0", () => {
    expect(new URL(linkReserva(MOTOR, { adultos: 2 })).searchParams.has("children")).toBe(false);
  });

  it("el prompt ya no le pide al modelo que arme URLs", () => {
    const p = buildBotSystemPrompt({ nombre: "H", reservaUrl: MOTOR });
    expect(p).not.toContain("&checkin=AAAA-MM-DD");
    expect(p).toContain("Nunca armes ni modifiques un link tú");
  });
});

describe("cómo se cierra una reserva", () => {
  const p = buildBotSystemPrompt({ nombre: "H", reservaUrl: "https://kora-hotel.com/h/h/reservar" });

  it("el cierre normal es reservar, pidiendo sólo nombre y correo", () => {
    expect(p).toContain("CÓMO SE CIERRA UNA RESERVA");
    expect(p).toContain("pídele SOLO lo que te falte: su nombre completo y su correo");
  });

  it("nunca le pide el teléfono: ya escribe por WhatsApp", () => {
    expect(p).toContain("nunca se lo pidas");
    expect(p).not.toMatch(/datos del huésped \(nombre completo, email y teléfono\)/);
  });

  it("ya no hay dos instrucciones de cierre que se contradigan", () => {
    expect(p).not.toContain("LO NORMAL ES MANDARLE SU LINK DE RESERVA");
    expect(p).not.toContain('es la EXCEPCIÓN');
  });

  it("la demo pública, que no tiene herramientas, no recibe instrucciones de herramientas", () => {
    const demo = buildBotSystemPrompt({ nombre: "H", reservaUrl: "https://x/reservar" }, { sinHerramientas: true });
    expect(demo).not.toContain("checar_disponibilidad con");
    expect(demo).not.toContain("pasar_a_persona");
    expect(demo).toContain("DEMOSTRACIÓN");
  });
});

describe("no promete lo que no existe", () => {
  it("OXXO sólo si la cuenta del hotel lo tiene", () => {
    const sin = buildBotSystemPrompt({ nombre: "H", reservaUrl: "https://x/reservar", pagos: { enLinea: true, oxxo: false } });
    expect(sin).toContain("OXXO NO está disponible");
    const con = buildBotSystemPrompt({ nombre: "H", reservaUrl: "https://x/reservar", pagos: { enLinea: true, oxxo: true } });
    expect(con).toContain("tarjeta u OXXO");
  });

  it("decir que avisó al equipo exige haber usado la herramienta", () => {
    const p = buildBotSystemPrompt({ nombre: "H" });
    expect(p).toContain("NUNCA digas que avisaste a alguien si no usaste pasar_a_persona");
  });

  it("el comprobante lo confirma una persona: Camila no ve imágenes", () => {
    const p = buildBotSystemPrompt({ nombre: "H", bot: { pago: { banco: "BBVA", clabe: "012180001234567891" } } });
    expect(p).toContain("una PERSONA del hotel lo confirma (tú no puedes ver imágenes)");
  });

  it("la fecha NO va en el prompt cacheado (se quedaba vieja); va en cada turno", () => {
    expect(buildBotSystemPrompt({ nombre: "H" })).not.toMatch(/Hoy es/);
  });
});
