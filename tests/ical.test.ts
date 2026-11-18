// El enlace por iCal con Airbnb, Booking y Expedia (Vrbo): lib/canales/ical.ts.
//
// Lo que se protege aquí es lo que, si falla, vende dos veces el mismo cuarto:
//  · el parser no puede perder eventos (líneas plegadas, DTSTART con
//    parámetros) ni contar los cancelados;
//  · el feed es por UNIDAD física (K-22);
//  · si la OTA no responde —o responde algo que no es un calendario—, los
//    bloqueos que ya había se quedan donde estaban.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase falso: sólo lo que usa sincronizarCanal ────────────────────────
const borrados: string[] = [];
const insertados: unknown[] = [];
let blocks: Array<{ id: string; habitacion: string; status: string; fuente_ota?: string; checkin: string; checkout: string }> = [];
const resultadoSync = vi.fn(async () => {});
const correos = vi.fn(async () => ({ ok: true }));

function consulta(tabla: string) {
  const filtros: Array<[string, unknown]> = [];
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push([c, v]), q),
    gt: () => q,
    in: (_c: string, ids: string[]) => {
      if (modo === "delete") {
        borrados.push(...ids);
        blocks = blocks.filter((b) => !ids.includes(b.id));
      }
      return q;
    },
    delete: () => ((modo = "delete"), q),
    insert: async (rows: unknown[]) => {
      insertados.push(...rows);
      return { error: null };
    },
    then: (res: (v: unknown) => void) => {
      const data =
        tabla === "blocks"
          ? blocks.filter((b) =>
              filtros.every(([c, v]) => c === "hotel_id" || (b as Record<string, unknown>)[c] === v),
            )
          : [];
      modo = "select";
      res({ data, error: null });
    },
  };
  let modo: "select" | "delete" = "select";
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => consulta(t) }),
  adminEnvReady: true,
}));
vi.mock("@/lib/db/admin", () => ({ updateOTASyncResult: (...a: unknown[]) => resultadoSync(...(a as [])) }));
vi.mock("@/lib/email/resend", () => ({ enviarEmail: (...a: unknown[]) => correos(...(a as [])) }));
vi.mock("@/lib/email/reserva", () => ({ resolveHotelAvisoEmail: async () => "hotel@ejemplo.mx" }));

import {
  parseIcal,
  generarFeed,
  choquesNuevos,
  fuenteDe,
  sincronizarCanal,
} from "@/lib/canales/ical";

const HOY = "2026-11-18";

describe("parseIcal", () => {
  it("lee DTSTART/DTEND con VALUE=DATE y con hora", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261201",
      "DTEND;VALUE=DATE:20261204",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20261210T150000Z",
      "DTEND:20261212T110000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcal(ics, HOY)).toEqual([
      { checkin: "2026-12-01", checkout: "2026-12-04" },
      { checkin: "2026-12-10", checkout: "2026-12-12" },
    ]);
  });

  it("desdobla líneas plegadas (RFC 5545)", () => {
    const ics = "BEGIN:VEVENT\r\nDTSTART;VALUE=DA\r\n TE:20261201\r\nDTEND;VALUE=DATE:2026\r\n 1203\r\nEND:VEVENT";
    expect(parseIcal(ics, HOY)).toEqual([{ checkin: "2026-12-01", checkout: "2026-12-03" }]);
  });

  it("ignora los cancelados, los pasados y los incoherentes", () => {
    const ics = [
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261201", "DTEND;VALUE=DATE:20261203", "STATUS:CANCELLED", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261101", "DTEND;VALUE=DATE:20261105", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261205", "DTEND;VALUE=DATE:20261204", "END:VEVENT",
    ].join("\n");
    expect(parseIcal(ics, HOY)).toEqual([]);
  });

  it("sin DTEND, un evento de día completo dura una noche", () => {
    const ics = "BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261231\nEND:VEVENT";
    expect(parseIcal(ics, HOY)).toEqual([{ checkin: "2026-12-31", checkout: "2027-01-01" }]);
  });
});

describe("generarFeed", () => {
  it("es por unidad: dos cabañas iguales tienen feeds independientes", () => {
    const uno = generarFeed({
      slug: "demo", hotelNombre: "Hotel", unidad: "Cabaña",
      bloques: [{ id: "a", checkin: "2026-12-01", checkout: "2026-12-03" }],
    });
    const dos = generarFeed({ slug: "demo", hotelNombre: "Hotel", unidad: "Cabaña 2", bloques: [] });
    expect(uno).toContain("DTSTART;VALUE=DATE:20261201");
    expect(uno).toContain("X-WR-CALNAME:Cabaña - Hotel");
    expect(dos).not.toContain("BEGIN:VEVENT");
    // Lo que Kora publica, Kora lo sabe leer.
    expect(parseIcal(uno, HOY)).toEqual([{ checkin: "2026-12-01", checkout: "2026-12-03" }]);
  });

  it("escapa comas y punto y coma en el nombre", () => {
    expect(generarFeed({ slug: "s", hotelNombre: "A, B; C", unidad: "X", bloques: [] })).toContain(
      "X-WR-CALNAME:X - A\\, B\\; C",
    );
  });
});

describe("choquesNuevos", () => {
  const reserva = [{ checkin: "2026-12-02", checkout: "2026-12-04" }];
  it("avisa de un rango NUEVO que pisa una reserva de Kora", () => {
    const r = { checkin: "2026-12-03", checkout: "2026-12-05" };
    expect(choquesNuevos([r], [], reserva)).toEqual([r]);
  });
  it("no repite el aviso en cada corrida de 15 min", () => {
    const r = { checkin: "2026-12-03", checkout: "2026-12-05" };
    expect(choquesNuevos([r], [r], reserva)).toEqual([]);
  });
  it("salida el mismo día que la entrada no es choque", () => {
    expect(choquesNuevos([{ checkin: "2026-12-04", checkout: "2026-12-06" }], [], reserva)).toEqual([]);
  });
});

describe("fuenteDe", () => {
  it("las OTAs conservan su clave; «otro» lleva el id del canal", () => {
    expect(fuenteDe({ id: "x", tipo: "airbnb" })).toBe("airbnb");
    expect(fuenteDe({ id: "x", tipo: null })).toBe("booking_com");
    expect(fuenteDe({ id: "x", tipo: "otro" })).toBe("otro:x");
  });
});

describe("sincronizarCanal", () => {
  const canal = {
    id: "c1", hotel_id: "h1", room_name: "Cabaña 2", tipo: "airbnb",
    ical_url: "https://airbnb.example/cal.ics",
  };
  const futuro = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20991201\nDTEND;VALUE=DATE:20991203\nEND:VEVENT\nEND:VCALENDAR";

  beforeEach(() => {
    borrados.length = 0;
    insertados.length = 0;
    resultadoSync.mockClear();
    correos.mockClear();
    blocks = [
      { id: "viejo", habitacion: "Cabaña 2", status: "OTA", fuente_ota: "airbnb", checkin: "2099-11-01", checkout: "2099-11-03" },
    ];
  });

  it("si la OTA no responde, NO borra los bloqueos que ya había", async () => {
    const r = await sincronizarCanal(canal, {
      descargar: async () => { throw new Error("HTTP 503"); },
    });
    expect(r.error).toMatch(/503/);
    expect(borrados).toEqual([]);
    expect(blocks.map((b) => b.id)).toEqual(["viejo"]);
    expect(resultadoSync).toHaveBeenCalledWith("h1", "c1", "error", 0);
  });

  it("reemplaza los bloqueos del canal: inserta los nuevos y después borra los viejos", async () => {
    const r = await sincronizarCanal(canal, { descargar: async () => futuro });
    expect(r.error).toBeUndefined();
    expect(r.bloqueos).toBe(1);
    expect(insertados).toEqual([
      expect.objectContaining({ habitacion: "Cabaña 2", status: "OTA", fuente_ota: "airbnb", checkin: "2099-12-01" }),
    ]);
    expect(borrados).toEqual(["viejo"]);
    expect(resultadoSync).toHaveBeenCalledWith("h1", "c1", "ok", 1);
  });

  it("avisa por correo si lo nuevo choca con una reserva de Kora", async () => {
    blocks.push({ id: "k", habitacion: "Cabaña 2", status: "RESERVADO", checkin: "2099-12-02", checkout: "2099-12-04" });
    const r = await sincronizarCanal(canal, {
      descargar: async () => futuro,
      avisoEmail: async () => "hotel@ejemplo.mx",
    });
    expect(r.choques).toBe(1);
    expect(correos).toHaveBeenCalledTimes(1);
  });
});
