import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      colors: {
        // Los 3 tokens que cambian con el tema (bg/text/muted) más `primary`
        // viven como variables CSS para que el modo oscuro del panel los pueda
        // voltear SIN tocar las ~550 clases que ya los usan. Sus valores claros
        // en :root son exactamente los hex de antes, así que el sitio público
        // se ve igual. Ver app/globals.css.
        kora: {
          primary: "rgb(var(--kora-primary) / <alpha-value>)",
          "primary-dark": "#163527",
          accent: "#52B788",
          "accent-dark": "#3FA070",
          bg: "rgb(var(--kora-bg) / <alpha-value>)",
          text: "rgb(var(--kora-text) / <alpha-value>)",
          muted: "rgb(var(--kora-muted) / <alpha-value>)",
        },
        // Tokens propios del panel: sustituyen a los grises literales
        // (bg-white, border-gray-200, bg-black/10…) que no podían cambiar de
        // tema porque son colores fijos de Tailwind.
        panel: {
          surface: "rgb(var(--panel-surface) / <alpha-value>)",
          "surface-2": "rgb(var(--panel-surface-2) / <alpha-value>)",
          border: "rgb(var(--panel-border) / <alpha-value>)",
          "border-soft": "rgb(var(--panel-border-soft) / <alpha-value>)",
          faint: "rgb(var(--panel-faint) / <alpha-value>)",
          contrast: "rgb(var(--panel-contrast) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
