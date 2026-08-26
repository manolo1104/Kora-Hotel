// Configuración "flat" de ESLint. Sustituye a `.eslintrc.json`, que existía y
// nadie leía: `package.json` decía `"lint": "next lint"`, y `next lint` se
// eliminó en Next 16. El comando fallaba con "Invalid project directory
// provided, no such directory: .../lint", así que el repo llevaba 463 archivos
// sin ninguna cobertura de lint desde la migración — en silencio, que es
// exactamente el tema de esta etapa.
//
// `eslint-config-next` 16 ya exporta configuración flat directamente; no hace
// falta FlatCompat (y con él no funciona: el paquete ya no trae el formato viejo).
//
// Regla al ampliar esto: arreglar los `error`, anotar los `warning` y seguir.
// Esta no es una etapa de limpieza.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "public/**",
      "agentes/**", // runtime de Camila: JS suelto que corre en Railway, no en Next
      "scripts/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // ── Deuda ANOTADA, no escondida ────────────────────────────────────────
      // La primera pasada del linter, el 25 ago 2026, sacó 73 errores y 47
      // avisos sobre 463 archivos que llevaban meses sin revisar. Ninguno es un
      // fallo en ejecución: son estilo y diagnósticos del compilador de React.
      // Se bajan a AVISO para que `npm run verificar` sirva de guardia contra lo
      // NUEVO desde hoy; si se dejaran en error, el comando nacería en rojo y
      // nadie volvería a correrlo — que es como murió el lint anterior.
      //
      // El recuento del día que se anotaron, para poder medir si baja o sube:
      //   25  @next/next/no-html-link-for-pages   ← el único con coste real:
      //        un <a href="/panel"> recarga la página entera en vez de navegar.
      //   21  react-hooks/set-state-in-effect     ← renders en cascada (perf)
      //   16  react/no-unescaped-entities         ← comillas sin escapar
      //    5  react-hooks/immutability
      //    3  react-hooks/static-components
      //    1  react-hooks/preserve-manual-memoization
      //    1  react-hooks/purity
      // Bajarlos es trabajo de una etapa de limpieza, no de esta.
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",

      // `any` explícito: quitarlos tampoco es trabajo de esta etapa.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
