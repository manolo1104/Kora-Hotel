// Configuración del banco de pruebas con modelo real (tests-eval/). Va aparte de
// `vitest.config.mts` a propósito: estas pruebas LLAMAN A LA API DE ANTHROPIC y
// cuestan dinero, así que `npm test` nunca las corre.
//
// EVAL_ROOT permite medir OTRA copia del código (p. ej. la versión anterior en
// un `git worktree`): el alias `@` y el runtime de Camila se leen de ahí, y el
// banco de pruebas de esta copia se queda igual. Así "antes" y "después" se
// miden con exactamente las mismas conversaciones.
import { defineConfig } from "vitest/config";
import path from "node:path";

const ROOT = process.env.EVAL_ROOT ? path.resolve(process.env.EVAL_ROOT) : process.cwd();

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests-eval/**/*.eval.ts"],
    testTimeout: 240_000,
    hookTimeout: 60_000,
    // Conversaciones en paralelo: cada una lleva su propio inventario.
    maxConcurrency: Number(process.env.EVAL_CONCURRENCIA || 4),
    env: {
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_SITE_URL: "https://kora-hotel.com",
    },
    server: { deps: { inline: [/agentes\/camila/] } },
  },
  resolve: { alias: { "@": ROOT } },
  server: { fs: { allow: [process.cwd(), ROOT] } },
});
