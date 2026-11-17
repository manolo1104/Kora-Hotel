// modelo.js — parámetros del modelo según el modelo que se use.
//
// COPIA de `lib/bot/modelo.ts` (la usa la vista previa del panel). El runtime es
// otro despliegue y no puede importar TypeScript del sitio, así que vive aquí
// duplicada a propósito; `tests/camila-modelo.test.ts` comprueba que las dos
// digan exactamente lo mismo para cada modelo. Si cambias una, cambia la otra.
//
// Por qué una tabla explícita: antes era una regex de EXCLUSIÓN y
// `claude-sonnet-5-5` (que rechaza `thinking: disabled` con un 400) no estaba:
// cambiar CAMILA_MODEL habría callado a Camila en todos los hoteles.

export const MODELO_CAMILA_DEFAULT = "claude-sonnet-5";

export function opcionesModelo(model) {
  const m = String(model || "").toLowerCase();
  if (/claude-(2|3)|haiku-4|claude-instant/.test(m)) return {};
  if (/sonnet-5-5/.test(m)) return { output_config: { effort: "low" }, thinking: { type: "between_tools" } };
  if (/opus-5|fable|mythos|haiku-5/.test(m)) return { output_config: { effort: "low" } };
  return { output_config: { effort: "low" }, thinking: { type: "disabled" } };
}

export function maxTokensModelo(model) {
  const piensa = !("thinking" in opcionesModelo(model)) || /sonnet-5-5/.test(String(model || "").toLowerCase());
  return piensa ? 4096 : 2048;
}
