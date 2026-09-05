// Que un fleet ILEGIBLE no se confunda con un fleet VACÍO.
//
// El runtime de Camila decide con esa diferencia si apaga bots o los conserva, y
// la decide SÓLO por el código HTTP: `agentes/camila/fleet.js:49-51` mira
// `res.ok` y nunca el `ok:false` del cuerpo. Un 200 con `hotels: []` significa
// para él "vacío legítimo" → `sincronizarFleet` destruye la sesión de WhatsApp
// de TODOS los hoteles, uno por uno.
//
// Sin envs de service-role esta ruta devolvía exactamente eso: 200 con lista
// vacía. Un fallo de configuración de Vercel apagaba a todas las Camilas a la
// vez, sin una sola alerta y con el log diciendo "apagado (fuera del fleet)"
// como si fuera lo correcto.
import { describe, it, expect, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cadena: any = new Proxy({}, { get: () => () => cadena });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena, adminEnvReady: false }));
vi.mock("@/lib/suscripcion", () => ({ accesoDelHotel: async () => ({ activo: true }) }));
vi.mock("@/lib/db/bot-token", () => ({ asegurarBotToken: async () => "tok" }));
vi.mock("@/lib/bot/elegibilidad", () => ({ motivosSinBot: () => [] }));
vi.mock("@/lib/alertas", () => ({ alertar: async () => {} }));

const { GET } = await import("@/app/api/bots/fleet/route");

const SECRETO = "secreto-de-flota";
process.env.BOT_FLEET_SECRET = SECRETO;

function pedir(conSecreto = true) {
  return GET(
    new Request("http://localhost/api/bots/fleet", {
      headers: conSecreto ? { authorization: `Bearer ${SECRETO}` } : {},
    }),
  );
}

describe("sin envs de service-role, el fleet es ILEGIBLE, no está vacío", () => {
  // Lo que importa de esta prueba es el CÓDIGO, no el cuerpo: es lo único que el
  // runtime mira para decidir entre conservar y apagar.
  it("responde 503, no 200 — que es lo que hace al runtime CONSERVAR los bots", async () => {
    const res = await pedir();
    expect(res.status).toBe(503);
  });

  it("no se cuela como lista vacía legítima", async () => {
    const res = await pedir();
    const body = await res.json();
    expect(body.ok).toBe(false);
    // Aunque `hotels` venga vacío, el 503 de arriba impide que se interprete.
    expect(res.status).not.toBe(200);
  });

  it("sigue exigiendo el secreto de plataforma antes que nada", async () => {
    const res = await pedir(false);
    expect(res.status).toBe(401);
  });
});
