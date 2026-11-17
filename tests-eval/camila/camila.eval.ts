// BANCO DE PRUEBAS DE CAMILA — conversaciones reales con el modelo.
//
// Corre la cadena de producción completa: `agentes/camila/brain.js` (el runtime
// de WhatsApp) → `agentes/camila/kora.js` (su cliente HTTP) → la ruta real
// `/api/agent` → las funciones del servidor (prompt, disponibilidad, cobro). Lo
// único simulado es lo que vive fuera: la base de datos (un inventario en
// memoria, uno por escenario), Stripe y Supabase.
//
// CUESTA DINERO (llama a la API de Anthropic), por eso no entra en `npm test`.
//
//   npm run eval:camila                       # modelo del runtime (CAMILA_MODEL o su default)
//   CAMILA_MODEL=claude-sonnet-5-5 npm run eval:camila
//   EVAL_ROOT=/ruta/a/otra/copia npm run eval:camila   # medir otra versión del código
//   EVAL_SOLO=cotiza-pareja,finde npm run eval:camila  # solo algunos escenarios
//   EVAL_DRY=1 npm run eval:camila            # sin modelo: prueba la plomería
//
// Escribe el reporte (Markdown + JSON con transcripciones) en EVAL_OUT.

import { describe, it, vi, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ── estado compartido con los mocks (uno por escenario, vía AsyncLocalStorage) ──
const S = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  type Hold = { unidades: string[]; checkin: string; checkout: string };
  type Ctx = {
    id: string;
    hotel: Record<string, unknown>;
    holds: Map<string, Hold>;
    bloqueos: { unidad: string; checkin: string; checkout: string }[];
    stripeN: number;
    escaladas: unknown[];
  };
  const als = new AsyncLocalStorage<Ctx>();
  const ctx = () => {
    const c = als.getStore();
    if (!c) throw new Error("mock llamado fuera de un escenario");
    return c;
  };
  const cruza = (a: { checkin: string; checkout: string }, ci: string, co: string) => a.checkin < co && ci < a.checkout;
  return { als, ctx, cruza };
});

vi.mock("@/lib/db/bot-token", () => ({ hotelIdPorBotToken: async () => "h-eval" }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cadena: any = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = new Proxy({}, { get: (_d, p) => (p === "then" ? undefined : () => c) });
  return c;
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena, adminEnvReady: true }));
vi.mock("@/lib/db/result", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  leer: async () => S.ctx().hotel,
}));
vi.mock("@/lib/suscripcion", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  accesoDelHotel: async () => ({
    activo: true,
    puedeCobrar: true,
    publicado: true,
    planActivo: true,
    prueba: null,
    bloqueado: false,
    mensajeBloqueo: null,
  }),
}));
vi.mock("@/lib/db/admin", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  logAgentActivity: async () => {},
  setBotStatus: async () => true,
  logCamilaConversacion: async () => {},
  getHiloCamila: async () => null,
  pausaDeChat: async () => null,
  guardarEstadoChat: async (_h: string, _c: string, estado: unknown) => {
    S.ctx().escaladas.push(estado);
    return true;
  },
}));
vi.mock("@/lib/bot/huesped", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  contextoHuesped: async () => null,
}));
vi.mock("@/lib/api/rate-limit", () => ({ limitado: async () => false, ipDe: () => "127.0.0.1" }));
vi.mock("@/lib/alertas", () => ({ alertar: async () => {} }));
vi.mock("@/lib/stripe/connect", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getConnectState: async () => ({
    accountId: "acct_eval",
    chargesEnabled: true,
    oxxoEnabled: false,
    onboardingStatus: "complete",
  }),
}));
vi.mock("@/lib/stripe/server", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  stripeEnvReady: true,
  getStripe: () => ({
    checkout: {
      sessions: {
        create: async () => {
          const n = ++S.ctx().stripeN;
          return { id: `cs_eval_${n}`, url: `https://checkout.stripe.test/c/pay/cs_eval_${S.ctx().id}_${n}` };
        },
        expire: async (id: string) => ({ id, status: "expired" }),
      },
    },
    customers: { create: async () => ({ id: "cus_eval" }) },
  }),
}));
// Inventario en memoria: bloqueos fijos del escenario + apartados por sesión.
vi.mock("@/lib/db/availability", async (orig) => {
  const { hotelRooms } = await import("@/lib/booking");
  const ocupadas = (ci: string, co: string, excluir?: string | null) => {
    const c = S.ctx();
    const set = new Set<string>();
    for (const b of c.bloqueos) if (S.cruza(b, ci, co)) set.add(b.unidad);
    for (const [ses, h] of c.holds) if (ses !== excluir && S.cruza(h, ci, co)) h.unidades.forEach((u) => set.add(u));
    return set;
  };
  const tipos = (hotel: Parameters<typeof hotelRooms>[0], ci: string, co: string, excluir?: string | null) => {
    const occ = ocupadas(ci, co, excluir);
    return hotelRooms(hotel).map((r) => {
      const libres = r.unidades.filter((u) => !occ.has(u));
      return { id: r.id, name: r.name, cantidad: r.cantidad, freeCount: libres.length, freeUnitNames: libres };
    });
  };
  return {
    ...(await orig<Record<string, unknown>>()),
    freeUnitsByTypeResult: async (_id: string, hotel: Parameters<typeof hotelRooms>[0], ci: string, co: string, excluir?: string | null) => ({
      ok: true,
      types: tipos(hotel, ci, co, excluir),
    }),
    freeUnitsByType: async (_id: string, hotel: Parameters<typeof hotelRooms>[0], ci: string, co: string, excluir?: string | null) =>
      tipos(hotel, ci, co, excluir),
    apartarUnidades: async (
      _id: string,
      candidatas: { tipo: string; cantidad: number; unidades: string[] }[],
      ci: string,
      co: string,
      sesion: string,
      opts: { prevSession?: string | null } = {},
    ) => {
      const c = S.ctx();
      if (opts.prevSession) c.holds.delete(opts.prevSession);
      c.holds.delete(sesion);
      const occ = ocupadas(ci, co);
      const tomadas: string[] = [];
      for (const cand of candidatas) {
        const libres = cand.unidades.filter((u) => !occ.has(u)).slice(0, cand.cantidad);
        if (libres.length < cand.cantidad) return { ok: false, motivo: "no-disponible" };
        tomadas.push(...libres);
      }
      c.holds.set(sesion, { unidades: tomadas, checkin: ci, checkout: co });
      return { ok: true, unidades: tomadas };
    },
    releaseHold: async (_id: string, sesion: string) => {
      S.ctx().holds.delete(sesion);
      return true;
    },
    anotarSesionStripe: async () => true,
  };
});

// ── imports reales (después de los mocks) ───────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";
import { ESCENARIOS, chequeosGlobales, type Contexto, type Llamada, type Turno, type Chequeo } from "./escenarios";
import { juzgar, MODELO_JUEZ, type CriterioJuzgado } from "./juez";
import { hotelFicticio, F, HOTEL_ID } from "./hotel";

const ROOT = process.env.EVAL_ROOT || process.cwd();
const ETIQUETA = process.env.EVAL_ETIQUETA || path.basename(ROOT);
const DRY = process.env.EVAL_DRY === "1";
const OUT = process.env.EVAL_OUT || path.join(process.cwd(), "tests-eval", "camila", "resultados");
const SOLO = (process.env.EVAL_SOLO || "").split(",").map((s) => s.trim()).filter(Boolean);
const KORA = "http://kora.eval";

if (DRY && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "sk-dry";
process.env.KORA_BASE_URL = KORA;
process.env.BOT_FLEET_SECRET = "secreto-eval";
process.env.NEXT_PUBLIC_SITE_URL = "https://kora-hotel.com";

// ── fetch: /api/agent va a la ruta REAL; Anthropic sale a la red (o se simula) ──
type Uso = { modelo: string; input: number; output: number; cacheRead: number; cacheWrite: number };
const usos = new Map<string, Uso[]>();
const llamadasPorEscenario = new Map<string, Llamada[]>();
const fetchOriginal = globalThis.fetch;
const { POST } = await import("@/app/api/agent/route");

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(`${KORA}/api/agent`)) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const res = await POST(new Request(url, init));
    const data = await res
      .clone()
      .json()
      .catch(() => null);
    const id = S.als.getStore()?.id;
    if (id) {
      const lista = llamadasPorEscenario.get(id) ?? [];
      lista.push({ accion: body.action ?? "knowledge", body, respuesta: data, status: res.status });
      llamadasPorEscenario.set(id, lista);
    }
    return res;
  }
  if (url.includes("api.anthropic.com") && DRY) {
    return new Response(
      JSON.stringify({
        id: "msg_dry",
        type: "message",
        role: "assistant",
        model: "dry",
        content: [{ type: "text", text: "(respuesta simulada)" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  const res = await fetchOriginal(input, init);
  if (url.includes("api.anthropic.com/v1/messages")) {
    const id = S.als.getStore()?.id ?? "_juez";
    res
      .clone()
      .json()
      .then((j) => {
        const u = j?.usage;
        if (!u) return;
        const lista = usos.get(id) ?? [];
        lista.push({
          modelo: j.model,
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
        });
        usos.set(id, lista);
      })
      .catch(() => {});
  }
  return res;
}) as typeof fetch;

const { handleTurn } = await import(/* @vite-ignore */ path.join(ROOT, "agentes/camila/brain.js"));
const { KoraHotel } = await import(/* @vite-ignore */ path.join(ROOT, "agentes/camila/kora.js"));
const MODELO_CAMILA = process.env.CAMILA_MODEL || "claude-sonnet-5";
const juezCliente = new Anthropic();

// ── precios (USD por millón de tokens) para estimar el costo ─────────────────
const PRECIOS: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
};
function costo(lista: Uso[] = []): number {
  return lista.reduce((s, u) => {
    const p = PRECIOS[u.modelo] ?? PRECIOS[Object.keys(PRECIOS).find((k) => u.modelo?.startsWith(k)) ?? ""] ?? { in: 4, out: 20 };
    return s + (u.input * p.in + u.cacheWrite * p.in * 1.25 + u.cacheRead * p.in * 0.1 + u.output * p.out) / 1e6;
  }, 0);
}

// ── ejecución ────────────────────────────────────────────────────────────────
interface Resultado {
  id: string;
  categoria: string;
  titulo: string;
  turnos: Turno[];
  chequeos: Chequeo[];
  juez: CriterioJuzgado[];
  error?: string;
  costoUsd: number;
}
const resultados: Resultado[] = [];

async function conversar(esc: (typeof ESCENARIOS)[number]): Promise<Turno[]> {
  const conv = `52481${String(Math.abs(hash(esc.id))).padStart(7, "0").slice(0, 7)}`;
  const hotel = hotelFicticio({ menoresPagan: esc.menoresPagan });
  const kora = new KoraHotel({ id: HOTEL_ID, slug: hotel.slug, nombre: hotel.nombre, token: "tok-eval", whatsapp: hotel.whatsapp, lang: "es" });
  const runtimeHotel = { id: HOTEL_ID, slug: hotel.slug, nombre: hotel.nombre, whatsapp: hotel.whatsapp, lang: "es" };
  let history: unknown[] = [];
  const turnos: Turno[] = [];
  for (const msg of esc.turnos) {
    const antes = (llamadasPorEscenario.get(esc.id) ?? []).length;
    // Igual que index.js: el bloque de "quién escribe" se pide por turno.
    let huesped = "";
    try {
      const est = await kora.chatEstado?.(conv);
      huesped = est?.huesped ?? "";
    } catch {
      /* fail-open, como el runtime */
    }
    const r = await handleTurn({ hotel: runtimeHotel, kora, history, userText: msg, conv, huesped });
    history = r.history;
    const llamadas = (llamadasPorEscenario.get(esc.id) ?? []).slice(antes);
    turnos.push({ huesped: msg, camila: r.reply ?? "", llamadas });
  }
  return turnos;
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

const lista = SOLO.length ? ESCENARIOS.filter((e) => SOLO.includes(e.id)) : ESCENARIOS;

describe(`Camila · ${ETIQUETA} · ${MODELO_CAMILA}${DRY ? " (simulado)" : ""}`, () => {
  for (const esc of lista) {
    it.concurrent(`${esc.categoria} · ${esc.titulo}`, async () => {
      const ctx = {
        id: esc.id,
        hotel: hotelFicticio({ menoresPagan: esc.menoresPagan }) as unknown as Record<string, unknown>,
        holds: new Map(),
        bloqueos: [
          { unidad: "Suite Jardín", checkin: F.suiteLlenaIn, checkout: F.suiteLlenaOut },
        ],
        stripeN: 0,
        escaladas: [] as unknown[],
      };
      const res: Resultado = { id: esc.id, categoria: esc.categoria, titulo: esc.titulo, turnos: [], chequeos: [], juez: [], costoUsd: 0 };
      try {
        res.turnos = await S.als.run(ctx, () => conversar(esc));
        const todas = res.turnos.flatMap((t) => t.llamadas);
        const c: Contexto = {
          turnos: res.turnos,
          llamadas: todas,
          todo: res.turnos.map((t) => t.camila).join("\n\n"),
          ultima: res.turnos[res.turnos.length - 1]?.camila ?? "",
        };
        res.chequeos = [...chequeosGlobales(c), ...(esc.chequeos?.(c) ?? [])];
        if (!DRY && esc.rubrica?.length) {
          const nota = esc.menoresPagan ? "En ESTE escenario los niños SÍ pagan tarifa como persona (2 adultos + 2 niños = tarifa de 4)." : "";
          const j = await S.als.run({ ...ctx, id: `${esc.id}#juez` }, () => juzgar(juezCliente, res.turnos, esc.rubrica!, nota));
          res.juez = j.criterios;
        }
      } catch (e) {
        res.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      }
      res.costoUsd = costo(usos.get(esc.id)) + costo(usos.get(`${esc.id}#juez`));
      resultados.push(res);
    }, 240_000);
  }
});

afterAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(OUT, `${ETIQUETA}__${MODELO_CAMILA}__${sello}`);
  const orden = new Map(ESCENARIOS.map((e, i) => [e.id, i]));
  resultados.sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0));

  const aprobado = (r: Resultado) => !r.error && r.chequeos.every((c) => c.ok) && r.juez.every((j) => j.cumple);
  const totalChequeos = resultados.flatMap((r) => [...r.chequeos.map((c) => c.ok), ...r.juez.map((j) => j.cumple)]);
  const ok = totalChequeos.filter(Boolean).length;
  const costoTotal = resultados.reduce((s, r) => s + r.costoUsd, 0);

  const filas = resultados.map((r) => {
    const fallas = [
      ...(r.error ? [`ERROR ${r.error}`] : []),
      ...r.chequeos.filter((c) => !c.ok).map((c) => `${c.nombre}${c.detalle ? ` (${c.detalle})` : ""}`),
      ...r.juez.filter((j) => !j.cumple).map((j) => `${j.criterio} — ${j.razon}`),
    ];
    return `| ${aprobado(r) ? "✅" : "❌"} | ${r.categoria} | ${r.titulo} | ${fallas.join("<br>").replace(/\|/g, "/") || "—"} |`;
  });

  const md = `# Camila · ${ETIQUETA} · ${MODELO_CAMILA}

- Fecha: ${new Date().toISOString()} · Juez: ${MODELO_JUEZ}${DRY ? " · SIMULADO (sin modelo)" : ""}
- Escenarios aprobados: **${resultados.filter(aprobado).length} / ${resultados.length}**
- Criterios cumplidos: **${ok} / ${totalChequeos.length}**
- Costo estimado de la corrida: **$${costoTotal.toFixed(2)} USD**

| | Categoría | Escenario | Qué falló |
|---|---|---|---|
${filas.join("\n")}

## Transcripciones

${resultados
  .map(
    (r) => `### ${aprobado(r) ? "✅" : "❌"} ${r.titulo} (\`${r.id}\`)
${r.turnos
  .map(
    (t) =>
      `**Huésped:** ${t.huesped}\n\n${t.llamadas
        .filter((l) => l.accion !== "knowledge")
        .map((l) => `> 🔧 \`${l.accion}\` ${JSON.stringify(Object.fromEntries(Object.entries(l.body).filter(([k]) => !["token", "action"].includes(k))))} → ${JSON.stringify(l.respuesta).slice(0, 300)}`)
        .join("\n")}\n\n**Camila:** ${t.camila.replace(/\n/g, "\n> ") || "_(sin respuesta)_"}`,
  )
  .join("\n\n")}
${r.error ? `\n**Error:** ${r.error}\n` : ""}`,
  )
  .join("\n\n")}
`;
  fs.writeFileSync(`${base}.md`, md);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ etiqueta: ETIQUETA, modelo: MODELO_CAMILA, fecha: F.hoy, resultados }, null, 2));
  console.log(`\n${resultados.filter(aprobado).length}/${resultados.length} escenarios · ${ok}/${totalChequeos.length} criterios · $${costoTotal.toFixed(2)} USD\nReporte: ${base}.md\n`);
});
