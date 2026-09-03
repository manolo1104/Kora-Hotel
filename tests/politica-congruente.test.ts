// Una política, una sola, en todas las superficies.
//
// El 2 sep 2026 el mismo huésped podía leer TRES políticas distintas —la del
// motor, la de la página pública y la que le decía Camila— porque debajo había
// CUATRO modelos de datos y ninguno mandaba sobre los otros. Un huésped que
// cancela a 5 días y ve negado su reembolso tiene la política del propio hotel
// por escrito a su favor: eso es un contracargo, y lo paga el hotel.
//
// La forma del defecto era siempre la misma: alguien escribía el plazo A MANO
// en una superficie nueva. Por eso se vigila igual que las cifras del caso
// Paraíso (`tests/caso-paraiso-congruente.test.ts`): leyendo los archivos y
// prohibiendo que aparezca un plazo escrito a mano donde debería derivarse.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { politicaDe, textoPolitica, reembolsoPorCancelar } from "@/lib/politica";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Quita comentarios: documentar el defecto arreglado no puede reabrirlo. */
function sinComentarios(src: string): string {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
    .join("\n");
}

// Las superficies que ENSEÑAN la política al huésped. Si nace una nueva, hay
// que añadirla aquí — y ese acto es justo el momento de leer este comentario.
const SUPERFICIES = [
  "components/mini/MiniRender.tsx",
  "app/h/[slug]/reservar/page.tsx",
  "app/h/[slug]/llms.txt/route.ts",
  "lib/docs/templates.ts",
  "lib/bot/prompt.ts",
  "lib/bot/knowledge.ts",
];

describe("nadie escribe un plazo de cancelación a mano", () => {
  for (const archivo of SUPERFICIES) {
    it(`${archivo} deriva la política, no la escribe`, () => {
      const src = sinComentarios(leer(archivo));
      // «cancelación gratuita hasta 7 días», «reembolsable hasta 7 días», etc.
      // El número escrito junto al plazo es la firma exacta del defecto: era
      // así como el PDF prometía 7 días a un hotel que cancelaba a 2.
      const aMano = src.match(
        /(cancelaci[oó]n|reembolsable|refund)[^\n]{0,40}\b\d+\s*(d[ií]as?|days?)\b/gi,
      );
      expect(aMano ?? []).toEqual([]);
    });
  }

  it("las plantillas de documento usan la variable, no un número", () => {
    // Llevaban «7 días» QUEMADO, igual para los 11 hoteles, y el hotelero no
    // podía corregirlo ni desde el editor «modificar antes de descargar»,
    // porque no era un campo.
    const src = leer("lib/docs/templates.ts");
    expect(src).toContain("{{ politica_cancelacion }}");
    expect(sinComentarios(src)).not.toMatch(/hasta 7 d[ií]as/i);
  });
});

describe("el texto y el dinero salen de la MISMA política", () => {
  it("lo que dice el texto es lo que hace el cálculo", () => {
    // Es la invariante que se rompió: la página decía «7 días 100 %, 3 días
    // 50 %» y el enforcement aplicaba «gratis hasta 2 días».
    const politica = politicaDe({
      escalones: [
        { diasAntes: 7, reembolsoPct: 100 },
        { diasAntes: 3, reembolsoPct: 50 },
      ],
    });
    const texto = textoPolitica(politica);
    for (const [hoy, esperado] of [
      ["2026-10-10", 100],
      ["2026-10-16", 50],
      ["2026-10-19", 0],
    ] as const) {
      const r = reembolsoPorCancelar({ politica, checkin: "2026-10-20", hoy });
      expect(r.pct).toBe(esperado);
    }
    expect(texto).toContain("7 días");
    expect(texto).toContain("50%");
  });

  it("Camila recibe UNA sola línea de cancelación, no dos", () => {
    // El prompt llevaba el bloque REGLAS con `cancelacionDias` Y el bloque
    // POLÍTICAS con el volcado crudo del texto libre, sin jerarquía declarada:
    // el modelo elegía. De ahí salía el «Camila me dijo otra cosa».
    const prompt = sinComentarios(leer("lib/bot/prompt.ts"));
    expect(prompt).toContain("politicaCancelacion");
    // El volcado crudo del campo libre ya no puede llevar la cancelación: el
    // cerebro la saca del objeto antes de mandarla.
    const knowledge = sinComentarios(leer("lib/bot/knowledge.ts"));
    expect(knowledge).toMatch(/delete p\.cancelacion/);
  });

  it("el portal del huésped decide con la política, no con un número suelto", () => {
    const portal = sinComentarios(leer("lib/db/portal.ts"));
    expect(portal).toContain("reembolsoPorCancelar");
    expect(portal).toContain("politica_snapshot");
  });
});

describe("la copia por reserva", () => {
  it("se escribe al crear la reserva y se lee al cancelar", () => {
    // Sin copia, cambiar la política del hotel altera retroactivamente las
    // condiciones de reservas ya pagadas y aceptadas — y el huésped que
    // reclama tiene razón.
    expect(sinComentarios(leer("lib/db/bookings.ts"))).toContain("politica_snapshot");
    expect(sinComentarios(leer("lib/db/portal.ts"))).toContain("politica_snapshot");
  });

  it("existe su SQL, y es idempotente", () => {
    const sql = leer("sql/kora-politica-cancelacion.sql");
    expect(sql).toMatch(/add column if not exists politica_snapshot/i);
  });
});
