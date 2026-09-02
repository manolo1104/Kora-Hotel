/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    // 🔴 Con Tailwind 3, autoprefixer NO viene incluido: hay que ponerlo. Y al
    // existir este archivo, Next deja de aplicar su pipeline por defecto —que sí
    // lo traía—, así que el proyecto se quedó SIN prefijos automáticos sin que
    // nadie lo decidiera.
    //
    // Los prefijos más visibles ya estaban a mano (`-webkit-mask-image`,
    // `-webkit-backdrop-filter`, `-webkit-background-clip`, `-webkit-line-clamp`),
    // pero comparando el CSS compilado antes y después NO salió igual: añade 331
    // bytes de prefijos que faltaban —`-moz-column-gap` (6), `-o-object-fit` (2),
    // `-o-object-position`, `-webkit-mask-composite`— y no quita nada. O sea que
    // ya había huecos, y de los que no se ven desde este Mac.
    autoprefixer: {},
  },
};

export default config;
