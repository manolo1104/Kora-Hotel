// El juez: lee una conversación contra la ficha del hotel y califica cada
// criterio de la rúbrica con sí/no y una razón corta. Usa salida estructurada
// para que la respuesta siempre se pueda leer.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Turno } from "./escenarios";
import { F, fechaHumana } from "./hotel";

export const MODELO_JUEZ = process.env.EVAL_JUEZ_MODEL || "claude-opus-5-5";

const Veredicto = z.object({
  criterios: z.array(
    z.object({
      n: z.number().describe("Número del criterio, empezando en 1"),
      cumple: z.boolean(),
      razon: z.string().describe("Una frase corta en español"),
    }),
  ),
});

/** Lo que el juez necesita saber del hotel para no tener que adivinar. */
const FICHA = `FICHA DEL HOTEL "Casa Ceiba" (hoy es ${fechaHumana(F.hoy)}, ${F.hoy})
- Dirección: Calle Río Tampaón 12, Barrio El Mirador, Ciudad Valles, San Luis Potosí. Link de mapa del hotel: https://maps.google.com/?q=Casa+Ceiba+Ciudad+Valles
- Cuartos y tarifas por noche:
  · Cabaña Río (2 unidades, hasta 4 personas, acepta niños y perros): 1 persona $1,800 · 2 $2,200 · 3 $2,600 · 4 $3,000
  · Suite Jardín (1 unidad, hasta 2 personas, SOLO ADULTOS, con jacuzzi): $2,800
  · Habitación Doble (3 unidades, hasta 2 personas): 1 persona $1,200 · 2 $1,500
- Los niños NO pagan tarifa salvo que el escenario diga lo contrario; sí ocupan lugar.
- Check-in 15:00, check-out 12:00. Clave del wifi: confidencial (se da al llegar).
- Estacionamiento gratuito (1 auto por cuarto). Desayuno NO incluido: $250 por persona.
- Mascotas: perros de hasta 10 kg, $300 por noche, solo en la Cabaña Río.
- Amenidades: alberca, wifi, estacionamiento, acepta mascotas. NO hay gimnasio ni spa.
- Pagos: tarjeta en línea y transferencia (BBVA). OXXO NO está disponible.
- Anticipo 50% (estancias de menos de 2 noches pagan completo). Cancelación gratis hasta 3 días antes.
- Temporada alta del ${F.temporadaDesde} al ${F.temporadaHasta}: +30% y mínimo 2 noches.
- Código de descuento vigente: VUELVE10 (10%). No hay otros.
- La Suite Jardín está vendida del ${F.suiteLlenaIn} al ${F.suiteLlenaOut}.
- Camila escribe por WhatsApp: ya conoce el teléfono del huésped. No puede ver imágenes.
- Si Camila dice que avisó al equipo, eso solo es cierto si en la conversación aparece la herramienta de escalar.`;

function transcripcion(turnos: Turno[]): string {
  return turnos
    .map((t) => {
      const herr = t.llamadas
        .filter((l) => l.accion !== "knowledge")
        .map((l) => {
          const args = Object.fromEntries(
            Object.entries(l.body).filter(([k]) => !["token", "conv", "action"].includes(k)),
          );
          const res = l.respuesta
            ? JSON.stringify(l.respuesta).slice(0, 400)
            : `HTTP ${l.status}`;
          return `   [herramienta ${l.accion} ${JSON.stringify(args)} → ${res}]`;
        })
        .join("\n");
      return `HUÉSPED: ${t.huesped}\n${herr ? herr + "\n" : ""}CAMILA: ${t.camila || "(sin respuesta)"}`;
    })
    .join("\n\n");
}

export interface CriterioJuzgado {
  criterio: string;
  cumple: boolean;
  razon: string;
}

export async function juzgar(
  client: Anthropic,
  turnos: Turno[],
  rubrica: string[],
  notaEscenario = "",
): Promise<{ criterios: CriterioJuzgado[]; usage?: Anthropic.Usage }> {
  if (!rubrica.length) return { criterios: [] };
  const prompt = `${FICHA}${notaEscenario ? `\n- ${notaEscenario}` : ""}

Eres un evaluador estricto de un asistente de WhatsApp para hoteles. Lee la conversación y decide, criterio por criterio, si la respuesta de Camila lo cumple. Juzga solo con la ficha de arriba y lo que se ve en la conversación (incluidas las llamadas a herramientas). Si un criterio no aplica porque Camila hizo algo mejor y equivalente, cuenta como cumplido.

CONVERSACIÓN
${transcripcion(turnos)}

CRITERIOS
${rubrica.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;

  const res = await client.messages.parse({
    model: MODELO_JUEZ,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(Veredicto) },
  });
  const v = res.parsed_output;
  const criterios = rubrica.map((r, i) => {
    const c = v?.criterios.find((x) => x.n === i + 1);
    return { criterio: r, cumple: c?.cumple ?? false, razon: c?.razon ?? "el juez no respondió este criterio" };
  });
  return { criterios, usage: res.usage };
}
