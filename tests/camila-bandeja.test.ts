// La bandeja de WhatsApp del panel: contestar, pausar, etiquetar y retomar.
//
// Hasta hoy Kora NO tenía ningún camino para emitir un mensaje de WhatsApp: la
// conversación con el runtime era de un solo sentido. Lo que se prueba aquí es
// la puerta nueva — y sobre todo que no se abra de más ni mienta cuando no puede.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolver, MAX_TEXTO } from "../agentes/camila/servidor.js";
import { aMensajes } from "../agentes/camila/historial.js";

const SECRETO = "secreto-de-flota";

function deps(over: Record<string, unknown> = {}) {
  const estado = new Map([
    ["hotel-uno", { slug: "hotel-uno", nombre: "Hotel Uno", status: "ready", qr: null, err: null }],
    ["hotel-qr", { slug: "hotel-qr", nombre: "Hotel QR", status: "qr", qr: "data:image/png;base64,AAA", err: null }],
    ["hotel-roto", { slug: "hotel-roto", nombre: "Hotel Roto", status: "error", qr: null, err: "Code 21" }],
  ]);
  return {
    secreto: SECRETO,
    estado,
    enviar: vi.fn(async () => ({ ok: true })),
    pausar: vi.fn(),
    vincular: vi.fn(() => "2099-01-01T00:00:00.000Z"),
    ...over,
  };
}

const auth = `Bearer ${SECRETO}`;

describe("el candado del runtime", () => {
  it("/health no pide nada: es lo que mira Railway", async () => {
    const r = await resolver({ method: "GET", url: "/health" }, deps());
    expect(r.status).toBe(200);
    expect(r.texto).toBe("ok");
  });

  it("sin el secreto no se manda nada", async () => {
    const d = deps();
    const r = await resolver(
      { method: "POST", url: "/enviar", auth: "Bearer otro", cuerpo: { slug: "hotel-uno", chatId: "5219999@c.us", texto: "hola" } },
      d,
    );
    expect(r.status).toBe(401);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  // Si el proceso arranca sin secreto en el entorno, la comparación con "Bearer
  // undefined" no puede convertirse en una puerta abierta.
  it("un runtime SIN secreto configurado rechaza todo", async () => {
    const r = await resolver({ method: "GET", url: "/estado", auth: "Bearer " }, deps({ secreto: "" }));
    expect(r.status).toBe(401);
  });

  it("una ruta desconocida es 404, no la página del QR de antes", async () => {
    const r = await resolver({ method: "GET", url: "/", auth }, deps());
    expect(r.status).toBe(404);
  });
});

describe("/estado sigue diciendo lo mismo que antes", () => {
  it("el QR sólo viaja cuando de verdad hay uno que escanear", async () => {
    const conQr = await resolver({ method: "GET", url: "/estado?slug=hotel-qr", auth }, deps());
    expect(conQr.json.qr).toContain("data:image/png");
    const listo = await resolver({ method: "GET", url: "/estado?slug=hotel-uno", auth }, deps());
    expect(listo.json.qr).toBeNull();
  });

  it("un hotel que no está en el runtime es «desconocido», no un 500", async () => {
    const r = await resolver({ method: "GET", url: "/estado?slug=nadie", auth }, deps());
    expect(r.json).toEqual({ slug: "nadie", status: "desconocido", qr: null });
  });

  it("el motivo del arranque fallido sale, que para eso se puso", async () => {
    const r = await resolver({ method: "GET", url: "/estado?slug=hotel-roto", auth }, deps());
    expect(r.json.err).toBe("Code 21");
  });
});

describe("mandar un mensaje desde el panel", () => {
  it("el camino feliz llega al cliente de ESE hotel", async () => {
    const d = deps();
    const r = await resolver(
      { method: "POST", url: "/enviar", auth, cuerpo: { slug: "hotel-uno", chatId: "5214811234567@c.us", texto: "Ya te aparté el cuarto" } },
      d,
    );
    expect(r.status).toBe(200);
    expect(d.enviar).toHaveBeenCalledWith("hotel-uno", "5214811234567@c.us", "Ya te aparté el cuarto");
  });

  // El fallo que se coló en el despliegue del 6 sep: `clientes` guarda el Client
  // desde que EMPIEZA a levantarse, así que un hotel a medio conectar también
  // estaba ahí. El sendMessage se quedaba colgado los 120 s del protocolTimeout
  // de Chromium mientras una persona miraba el panel esperando.
  it("un hotel que aún no está conectado NO recibe el mensaje", async () => {
    for (const estadoRaro of ["starting", "qr", "error", "disconnected"]) {
      const d = deps();
      d.estado.set("a-medias", { slug: "a-medias", nombre: "A medias", status: estadoRaro, qr: null, err: null });
      const r = await resolver(
        { method: "POST", url: "/enviar", auth, cuerpo: { slug: "a-medias", chatId: "521481@c.us", texto: "hola" } },
        d,
      );
      expect(r.status, estadoRaro).toBe(409);
      expect(r.json.error).toBe("hotel-sin-sesion");
      expect(d.enviar, estadoRaro).not.toHaveBeenCalled();
    }
  });

  it("un hotel que el runtime ni conoce tampoco", async () => {
    const d = deps();
    const r = await resolver(
      { method: "POST", url: "/enviar", auth, cuerpo: { slug: "no-existe", chatId: "521481@c.us", texto: "hola" } },
      d,
    );
    expect(r.status).toBe(409);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  // Es la diferencia entre «no pude» y «no salió», y el panel le dice cosas
  // distintas al hotelero según cuál sea.
  it("un hotel sin sesión de WhatsApp da 409, no un error genérico", async () => {
    const d = deps({ enviar: vi.fn(async () => ({ ok: false, error: "hotel-sin-sesion" })) });
    const r = await resolver(
      { method: "POST", url: "/enviar", auth, cuerpo: { slug: "hotel-uno", chatId: "521481@c.us", texto: "hola" } },
      d,
    );
    expect(r.status).toBe(409);
  });

  it("un fallo al mandar es 502, y nunca ok:true", async () => {
    const d = deps({ enviar: vi.fn(async () => ({ ok: false, error: "no-enviado" })) });
    const r = await resolver(
      { method: "POST", url: "/enviar", auth, cuerpo: { slug: "hotel-uno", chatId: "521481@c.us", texto: "hola" } },
      d,
    );
    expect(r.status).toBe(502);
    expect(r.json.ok).toBeUndefined();
  });

  it("ni grupos ni difusión: el número del hotel no se usa para eso", async () => {
    const d = deps();
    for (const chatId of ["12345@g.us", "status@broadcast"]) {
      const r = await resolver({ method: "POST", url: "/enviar", auth, cuerpo: { slug: "hotel-uno", chatId, texto: "hola" } }, d);
      expect(r.status).toBe(400);
    }
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("un mensaje vacío o sin destinatario no se manda", async () => {
    const d = deps();
    for (const cuerpo of [{ slug: "hotel-uno", chatId: "1@c.us", texto: "   " }, { slug: "hotel-uno", texto: "hola" }, { chatId: "1@c.us", texto: "hola" }]) {
      expect((await resolver({ method: "POST", url: "/enviar", auth, cuerpo }, d)).status).toBe(400);
    }
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("hay tope de longitud", async () => {
    const d = deps();
    const r = await resolver(
      { method: "POST", url: "/enviar", auth, cuerpo: { slug: "hotel-uno", chatId: "1@c.us", texto: "x".repeat(MAX_TEXTO + 1) } },
      d,
    );
    expect(r.status).toBe(400);
    expect(d.enviar).not.toHaveBeenCalled();
  });

  it("un GET a /enviar no manda nada", async () => {
    const d = deps();
    expect((await resolver({ method: "GET", url: "/enviar", auth }, d)).status).toBe(404);
    expect(d.enviar).not.toHaveBeenCalled();
  });
});

describe("pausar un chat desde el panel", () => {
  it("una fecha futura pausa; una vacía reanuda", async () => {
    const d = deps();
    const futuro = "2099-01-01T00:00:00.000Z";
    await resolver({ method: "POST", url: "/pausa", auth, cuerpo: { slug: "h", chatId: "1@c.us", hasta: futuro } }, d);
    expect(d.pausar).toHaveBeenCalledWith("h", "1@c.us", Date.parse(futuro));
    await resolver({ method: "POST", url: "/pausa", auth, cuerpo: { slug: "h", chatId: "1@c.us", hasta: null } }, d);
    expect(d.pausar).toHaveBeenLastCalledWith("h", "1@c.us", 0);
  });

  it("una fecha basura se trata como reanudar, no como pausa eterna", async () => {
    const d = deps();
    await resolver({ method: "POST", url: "/pausa", auth, cuerpo: { slug: "h", chatId: "1@c.us", hasta: "el jueves" } }, d);
    expect(d.pausar).toHaveBeenCalledWith("h", "1@c.us", 0);
  });
});

// El historial guardado tiene que poder volver a entrar al modelo. La regla que
// no se ve leyendo el código: la API rechaza una conversación que empieza con el
// asistente hablando solo, y eso pasa en cuanto el hotelero contesta primero.
describe("retomar la conversación tras un reinicio", () => {
  it("un historial que empieza por el asistente se poda hasta el primer huésped", () => {
    const m = aMensajes([
      { rol: "assistant", texto: "Hola, soy Camila" },
      { rol: "user", texto: "¿tienen cuartos?" },
      { rol: "assistant", texto: "Sí" },
    ]);
    expect(m[0]).toEqual({ role: "user", content: "¿tienen cuartos?" });
    expect(m).toHaveLength(2);
  });

  it("lo que escribió una persona del hotel entra como assistant, marcado", () => {
    const m = aMensajes([
      { rol: "user", texto: "¿me hacen descuento?" },
      { rol: "assistant", texto: "Te dejo la noche en $1,800", por: "hotel" },
    ]);
    expect(m[1].role).toBe("assistant");
    expect(m[1].content).toContain("respondió el hotel");
    expect(m[1].content).toContain("$1,800");
  });

  it("turnos vacíos o corruptos no rompen nada", () => {
    expect(aMensajes(null as never)).toEqual([]);
    expect(aMensajes([{ rol: "user", texto: "   " }, { rol: "user" }] as never)).toEqual([]);
  });
});

// ─── El cliente de Kora hacia el runtime ─────────────────────────────────────
// Lo importante no es que funcione: es que cuando NO funciona lo diga con un
// motivo. Un panel que contesta «enviado» sobre un mensaje que nadie recibió
// hace que el hotelero deje de contestar por el panel para siempre.
describe("hablarle al runtime desde Kora", () => {
  const { CAMILA_RUNTIME_URL, BOT_FLEET_SECRET } = process.env;
  const cargar = async () => {
    vi.resetModules();
    return import("@/lib/bot/runtime");
  };

  beforeEach(() => {
    process.env.CAMILA_RUNTIME_URL = "https://runtime.test";
    process.env.BOT_FLEET_SECRET = SECRETO;
  });
  afterEach(() => {
    process.env.CAMILA_RUNTIME_URL = CAMILA_RUNTIME_URL;
    process.env.BOT_FLEET_SECRET = BOT_FLEET_SECRET;
    vi.unstubAllGlobals();
  });

  it("sin servicio configurado NO se intenta el envío", async () => {
    delete process.env.CAMILA_RUNTIME_URL;
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const { postAlRuntime, runtimeConfigurado } = await cargar();
    expect(runtimeConfigurado()).toBe(false);
    const r = await postAlRuntime("/enviar", {});
    expect(r).toEqual({ ok: false, fallo: "sin-servicio" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("manda el secreto de flota en la cabecera", async () => {
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const { postAlRuntime } = await cargar();
    const r = await postAlRuntime("/enviar", { slug: "h" });
    expect(r.ok).toBe(true);
    const opciones = (fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((opciones.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRETO}`);
  });

  it("un 409 se traduce a «este hotel no tiene WhatsApp conectado»", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "hotel-sin-sesion" }), { status: 409 })));
    const { postAlRuntime, MENSAJE_FALLO } = await cargar();
    const r = await postAlRuntime("/enviar", {});
    expect(r).toEqual({ ok: false, fallo: "hotel-sin-sesion" });
    expect(MENSAJE_FALLO["hotel-sin-sesion"]).toContain("Conecta tu WhatsApp");
  });

  // Un timeout NO es «no salió»: puede haber salido. El texto que ve el hotelero
  // tiene que decírselo, o mandará el mismo mensaje dos veces.
  it("un fallo de red se reporta como duda, no como fallo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("abort"); }));
    const { postAlRuntime, MENSAJE_FALLO } = await cargar();
    const r = await postAlRuntime("/enviar", {});
    expect(r).toEqual({ ok: false, fallo: "sin-respuesta" });
    expect(MENSAJE_FALLO["sin-respuesta"]).toContain("puede que sí haya salido");
  });

  it("una respuesta que no es JSON no revienta el panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    const { postAlRuntime } = await cargar();
    const r = await postAlRuntime("/enviar", {});
    expect(r.ok).toBe(false);
  });
});

// ─── El QR sólo cuando alguien lo pide ───────────────────────────────────────
// El runtime abría un Chromium a TODOS los hoteles elegibles. Los que nadie
// había escaneado nunca se quedaban meses con el navegador vivo regenerando un
// código para nadie — y el 6 sep 2026 le quitaron el sitio al cliente que paga.
describe("vincular bajo demanda", () => {
  it("el panel puede pedir la ventana para su hotel", async () => {
    const d = deps();
    const r = await resolver({ method: "POST", url: "/vincular", auth, cuerpo: { slug: "hotel-uno" } }, d);
    expect(r.status).toBe(200);
    expect(d.vincular).toHaveBeenCalledWith("hotel-uno");
  });

  // El panel consulta cada 15 s mientras el hotelero mira la pantalla: pedirlo
  // muchas veces sólo puede ALARGAR la ventana, nunca romper nada.
  it("pedirlo varias veces no es un problema", async () => {
    const d = deps();
    for (let i = 0; i < 5; i++) {
      const r = await resolver({ method: "POST", url: "/vincular", auth, cuerpo: { slug: "hotel-uno" } }, d);
      expect(r.status).toBe(200);
    }
    expect(d.vincular).toHaveBeenCalledTimes(5);
  });

  it("sin slug no se abre ninguna ventana", async () => {
    const d = deps();
    expect((await resolver({ method: "POST", url: "/vincular", auth, cuerpo: {} }, d)).status).toBe(400);
    expect(d.vincular).not.toHaveBeenCalled();
  });

  it("y sin el secreto de flota, tampoco", async () => {
    const d = deps();
    const r = await resolver({ method: "POST", url: "/vincular", auth: "Bearer otro", cuerpo: { slug: "x" } }, d);
    expect(r.status).toBe(401);
    expect(d.vincular).not.toHaveBeenCalled();
  });
});
