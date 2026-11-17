// Parámetros del modelo de Camila según el modelo que se use. FUENTE ÚNICA para
// la vista previa del panel; `agentes/camila/modelo.js` es su copia para el
// runtime (otro despliegue, JS puro) y `tests/camila-modelo.test.ts` comprueba
// que las dos digan lo mismo.
//
// Por qué una tabla explícita: antes se decidía con una expresión regular de
// EXCLUSIÓN («todo lo que no sea opus-5/fable/mythos acepta pensar apagado»).
// `claude-sonnet-5-5` no estaba en la lista y RECHAZA `thinking: disabled` con
// un 400: poner CAMILA_MODEL=claude-sonnet-5-5 habría dejado muda a Camila en
// todos los hoteles a la vez.
//
// Chat de WhatsApp = latencia baja: esfuerzo "low" donde existe, y el
// pensamiento apagado sólo donde el modelo lo admite SIN el defecto de escribir
// la llamada a la herramienta como texto (Opus 5 lo tiene: ahí se deja pensar).

export const MODELO_CAMILA_DEFAULT = "claude-sonnet-5";

export function opcionesModelo(model: string): Record<string, unknown> {
  const m = (model || "").toLowerCase();
  // Modelos viejos: no conocen `effort` ni el pensamiento adaptativo.
  if (/claude-(2|3)|haiku-4|claude-instant/.test(m)) return {};
  // Sonnet 5.5 no acepta `disabled`; su forma de no pensar es `between_tools`
  // (sólo con esfuerzo high o menor).
  if (/sonnet-5-5/.test(m)) return { output_config: { effort: "low" }, thinking: { type: "between_tools" } };
  // Siempre piensan (o no conviene apagarlo): sólo se baja el esfuerzo.
  if (/opus-5|fable|mythos|haiku-5/.test(m)) return { output_config: { effort: "low" } };
  // Sonnet 5, Sonnet 4.6, Opus 4.x: pensamiento apagado + esfuerzo bajo.
  return { output_config: { effort: "low" }, thinking: { type: "disabled" } };
}

/** Tope de tokens de salida. Con pensamiento encendido, el pensamiento también cuenta. */
export function maxTokensModelo(model: string): number {
  const piensa = !("thinking" in opcionesModelo(model)) || /sonnet-5-5/.test((model || "").toLowerCase());
  return piensa ? 4096 : 2048;
}
