# Banco de pruebas de Camila

25 conversaciones de huéspedes contra la cadena **real** de producción:

`agentes/camila/brain.js` → `kora.js` → la ruta `/api/agent` → prompt, disponibilidad y cobro.

Solo se simula lo externo: la base de datos (un inventario en memoria por escenario), Stripe y Supabase. El hotel es ficticio ([`hotel.ts`](hotel.ts)), con tarifas por persona, una temporada con mínimo de noches, un cuarto de una sola unidad y una clave de wifi que no se debe revelar.

Cada escenario se califica de dos formas:
- **Revisiones automáticas:** qué herramienta usó y con qué argumentos, qué precio dio, qué links mandó, si prometió un aviso que no hizo.
- **Un juez (Claude Opus 5.5):** una rúbrica en lenguaje natural que lee la conversación contra la ficha del hotel.

> **Cuesta dinero:** llama a la API de Anthropic, unos **$0.50 USD por corrida** (juez incluido). Por eso no entra en `npm test`.

## Cómo correrlo

```bash
ANTHROPIC_API_KEY=… npm run eval:camila                       # modelo de producción (CAMILA_MODEL o su default)
ANTHROPIC_API_KEY=… CAMILA_MODEL=claude-sonnet-5-5 npm run eval:camila
ANTHROPIC_API_KEY=… EVAL_SOLO=cotiza-4-adultos,finde npm run eval:camila
ANTHROPIC_API_KEY=… EVAL_ROOT=/ruta/a/otra/copia npm run eval:camila   # medir otra versión del código
EVAL_DRY=1 npm run eval:camila                                # sin modelo: sólo revisa que todo esté conectado
```

El reporte (Markdown con las transcripciones, y JSON) queda en `tests-eval/camila/resultados/`, o en la carpeta que indique `EVAL_OUT`.

## Resultados (nov 2026)

| Versión | Modelo | Escenarios aprobados |
|---|---|---|
| Antes de la revisión | Sonnet 5 | **12 / 25** |
| Después (3 rondas de ajuste) | Sonnet 5 | **24–25 / 25** (5 corridas) |
| Después (3 rondas de ajuste) | Sonnet 5.5 | **23–25 / 25** (5 corridas) |

**Lo que fallaba antes y quedó corregido:**
- Cotizaba siempre para 2 personas.
- Prometía OXXO aunque el hotel no lo tuviera.
- Contestaba en español a huéspedes que escribían en inglés.
- No notaba un día de la semana que no coincidía con la fecha.
- Cotizaba una noche en temporada con mínimo de 2.
- Armaba links sin niños.
- Decía "ya avisé al equipo" sin avisar a nadie.
- Decía que revisaría ella el comprobante.

**Lo que todavía falla a veces:** el tono, no el dinero. Por ejemplo, prometer "en un momento" al pasar con una persona, o escalar sin una frase de empatía.

**Entre los dos modelos no hay una diferencia medible en este banco.**
