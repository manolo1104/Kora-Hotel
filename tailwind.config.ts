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
        kora: {
          primary: "#1B4332",
          "primary-dark": "#163527",
          accent: "#52B788",
          "accent-dark": "#3FA070",
          bg: "#FAFAF8",
          text: "#1A1A1A",
          muted: "#6B7280",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
