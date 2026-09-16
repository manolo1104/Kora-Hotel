// `alertar()` ahora hace DOS cosas: el correo de siempre y guardar la alerta en
// `alertas_fundador` para la bandeja del CRM.
//
// Lo que no se puede romper al añadir lo segundo:
//   · el correo sale aunque la base esté lenta, caída o sin la tabla;
//   · `alertar()` nunca lanza (se llama con `await` en medio de un webhook de
//     Stripe: si lanzara, Stripe reintentaría un pago que ya se procesó);
//   · la espera a la base está acotada: un Supabase colgado no puede tener
//     congelado al webhook hasta que Vercel lo mate.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type ErrorDb = { code?: string; message: string } | null;

// El tipo se escribe a mano: `ReturnType<typeof vi.fn>` devuelve un mock que
// también podría ser un constructor, y entonces `tsc` no lo deja llamar.
let enviarEmail: ((...a: unknown[]) => Promise<{ ok: boolean }>) & {
  mock: { calls: unknown[][] };
};
let insertar: (fila: Record<string, unknown>) => Promise<{ error: ErrorDb }>;
let filas: { tabla: string; fila: Record<string, unknown> }[];

async function cargar(opts: { notify?: string; adminListo?: boolean } = {}) {
  vi.resetModules();
  vi.doMock("@/lib/email/resend", () => ({
    enviarEmail: (...a: unknown[]) => enviarEmail(...a),
    NOTIFY_EMAIL: opts.notify ?? "fundador@kora.test",
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    adminEnvReady: opts.adminListo ?? true,
    createAdminClient: () => ({
      from: (tabla: string) => ({
        insert: (fila: Record<string, unknown>) => {
          filas.push({ tabla, fila });
          return insertar(fila);
        },
      }),
    }),
  }));
  return import("@/lib/alertas");
}

beforeEach(() => {
  enviarEmail = vi.fn(async (_correo: unknown) => ({ ok: true }));
  insertar = async () => ({ error: null });
  filas = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("correo y bandeja", () => {
  it("manda el correo Y guarda la alerta", async () => {
    const { alertar } = await cargar();
    await alertar("cobro a la cuenta de Kora", "El hotel casa-luna no puede cobrar.");

    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0]).toMatchObject({ to: "fundador@kora.test" });
    expect(filas).toEqual([
      {
        tabla: "alertas_fundador",
        fila: { asunto: "cobro a la cuenta de Kora", detalle: "El hotel casa-luna no puede cobrar." },
      },
    ]);
  });

  it("sin NOTIFY_EMAIL la alerta se guarda igual (antes sólo quedaba en el log)", async () => {
    const { alertar } = await cargar({ notify: "" });
    await alertar("webhook de reservas falló", "detalle");
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(filas).toHaveLength(1);
  });

  it("sin base configurada sólo sale el correo", async () => {
    const { alertar } = await cargar({ adminListo: false });
    await alertar("x", "y");
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(filas).toHaveLength(0);
  });

  it("la misma alerta idéntica dos veces seguidas: un correo y una fila", async () => {
    const { alertar } = await cargar();
    await alertar("repetida", "Hotel A");
    await alertar("repetida", "Hotel A");
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(filas).toHaveLength(1);
  });

  // El Set de antes era por asunto: «no se pudo crear una reserva ya pagada» del
  // hotel B, justo después de la del hotel A, no dejaba rastro en ningún lado.
  it("mismo asunto de OTRO hotel: no repite el correo, pero sí queda en la bandeja", async () => {
    const { alertar } = await cargar();
    await alertar("no se pudo crear una reserva ya pagada", "Hotel A");
    await alertar("no se pudo crear una reserva ya pagada", "Hotel B");
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(filas.map((f) => f.fila.detalle)).toEqual(["Hotel A", "Hotel B"]);
  });

  it("un bucle con detalles distintos no llena la tabla: tope de filas por asunto", async () => {
    const { alertar, FILAS_POR_ASUNTO } = await cargar();
    for (let i = 0; i < FILAS_POR_ASUNTO + 5; i++) await alertar("Stripe no contestó", `hotel ${i}`);
    expect(filas).toHaveLength(FILAS_POR_ASUNTO);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
  });

  // Una instancia caliente de Vercel vive horas: sin caducidad, una alerta que
  // el fundador marcó atendida y VUELVE no aparecía nunca más en la bandeja.
  it("pasada la ventana, la misma alerta vuelve a avisar y a guardarse", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-15T10:00:00.000Z"));
    const { alertar, VENTANA_REPETIDA_MS } = await cargar();
    await alertar("firma de webhook inválida", "d");
    vi.setSystemTime(Date.now() + VENTANA_REPETIDA_MS - 1);
    await alertar("firma de webhook inválida", "d");
    expect(filas).toHaveLength(1);
    vi.setSystemTime(Date.now() + 1);
    await alertar("firma de webhook inválida", "d");
    expect(enviarEmail).toHaveBeenCalledTimes(2);
    expect(filas).toHaveLength(2);
  });

  it("recorta un detalle gigante (un stack con un cuerpo de respuesta enorme)", async () => {
    const { alertar } = await cargar();
    await alertar("a".repeat(1_000), "b".repeat(100_000));
    const fila = filas[0].fila as { asunto: string; detalle: string };
    expect(fila.asunto.length).toBe(300);
    expect(fila.detalle.length).toBe(20_000);
  });
});

describe("la base no puede tumbar ni retrasar el correo", () => {
  it("sin la tabla: el correo sale, no lanza, y avisa en el log UNA vez", async () => {
    insertar = async () => ({ error: { code: "PGRST205", message: "Could not find the table 'public.alertas_fundador'" } });
    const { alertar } = await cargar();
    await expect(alertar("uno", "d")).resolves.toBeUndefined();
    await expect(alertar("dos", "d")).resolves.toBeUndefined();
    expect(enviarEmail).toHaveBeenCalledTimes(2);
    const avisos = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("alertas_fundador"),
    );
    expect(avisos).toHaveLength(1);
  });

  // Los tipos dicen `string`, pero el detalle se arma con `e.message` de errores
  // ajenos y con metadata de Stripe: ahí llega `undefined` de verdad. Si
  // `alertar()` lanzara por eso dentro del webhook, Stripe reintentaría un pago
  // ya cobrado — justo lo que esta función existe para evitar.
  it("un detalle que no es texto no la hace lanzar: avisa igual", async () => {
    const { alertar } = await cargar();
    const sinTexto = undefined as unknown as string;
    await expect(alertar("cobro a la cuenta de Kora", sinTexto)).resolves.toBeUndefined();
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(filas[0].fila).toEqual({ asunto: "cobro a la cuenta de Kora", detalle: "" });

    await expect(alertar(null as unknown as string, { hotel: "casa-luna" } as unknown as string)).resolves.toBeUndefined();
    expect(filas).toHaveLength(2);
  });

  it("si el cliente de la base lanza, el correo sale igual", async () => {
    insertar = () => {
      throw new Error("se cayó la red");
    };
    const { alertar } = await cargar();
    await expect(alertar("x", "y")).resolves.toBeUndefined();
    expect(enviarEmail).toHaveBeenCalledTimes(1);
  });

  it("si el correo lanza, la alerta queda guardada y no lanza", async () => {
    enviarEmail = vi.fn(async (_correo: unknown) => {
      throw new Error("Resend caído");
    });
    const { alertar } = await cargar();
    await expect(alertar("x", "y")).resolves.toBeUndefined();
    expect(filas).toHaveLength(1);
  });

  it("base colgada: el correo sale ya, y alertar() vuelve al cumplirse el tope", async () => {
    vi.useFakeTimers();
    insertar = () => new Promise(() => {}); // nunca contesta
    const { alertar, ESPERA_GUARDADO_MS } = await cargar();

    let volvio = false;
    const p = alertar("base lenta", "d").then(() => {
      volvio = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(volvio).toBe(false);

    await vi.advanceTimersByTimeAsync(ESPERA_GUARDADO_MS);
    await p;
    expect(volvio).toBe(true);
  });
});
