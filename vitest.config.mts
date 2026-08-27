import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Varios módulos leen `process.env` AL IMPORTARSE (lib/stripe/server.ts:6,
    // por ejemplo), así que ponerlas en un beforeEach llega tarde. Son valores
    // de mentira: ningún test toca la red ni la base de datos.
    env: {
      STRIPE_SECRET_KEY: "sk_test_dummy",
      NEXT_PUBLIC_SITE_URL: "https://kora-hotel.test",
    },
  },
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
});
