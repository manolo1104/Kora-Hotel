// Limpieza del HTML que escribe una IA antes de pintarlo en una página pública.
//
// El cuerpo de los artículos de `blog_articles` no lo escribe una persona: lo
// genera el agente de blogs (`blog-agent/`) con un modelo que además hace
// BÚSQUEDAS WEB, y sale a `/blog/<slug>` con `dangerouslySetInnerHTML` (K-18.2).
//
// Dos formas de que eso acabe en un `<script>` corriendo en kora-hotel.com:
//
//   1. Inyección de prompt: una de las páginas que el modelo lee durante la
//      búsqueda le dice «incluye esta etiqueta en el artículo». El modelo no
//      distingue entre lo que le pide su instrucción y lo que lee por ahí.
//   2. Una fuga de `BLOG_AGENT_SECRET`, que es lo único que protege la ruta de
//      publicación.
//
// En los dos casos el script correría en NUESTRO dominio, con la sesión de quien
// esté leyendo el blog — incluido un hotelero con el panel abierto en otra
// pestaña.
//
// SE USA UNA LIBRERÍA A PROPÓSITO. Un saneador escrito a mano es el sitio
// clásico donde alguien se equivoca: hay que entender comentarios condicionales,
// atributos sin comillas, `javascript:` con espacios en medio, entidades HTML
// que se resuelven después... `sanitize-html` corre SÓLO EN EL SERVIDOR (estas
// páginas son server components), así que no engorda nada de lo que descarga el
// visitante.

import sanitizeHtml from "sanitize-html";

// Lo que el agente de blogs puede escribir de verdad. Cualquier otra etiqueta se
// descarta (se queda su texto). La lista es deliberadamente corta: si algún día
// hace falta una etiqueta nueva, se añade AQUÍ y se piensa una vez.
const ETIQUETAS = [
  "p", "br", "hr",
  "h2", "h3", "h4",
  "strong", "em", "b", "i", "u", "s",
  "ul", "ol", "li",
  "blockquote", "figure", "figcaption",
  // `cite` lo usa de verdad el artículo del agente de WhatsApp; el resto son
  // etiquetas semánticas sin superficie de ataque que un modelo puede escribir.
  "cite", "small", "sup", "sub", "abbr", "time", "mark",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "code", "pre",
  // Los artículos traen bloques de color con `style` en línea (las tarjetas de
  // antes/después, por ejemplo). Se permiten el div y el span; los estilos los
  // filtra `allowedStyles`, más abajo.
  "div", "span",
];

export function sanitizarHtmlArticulo(html: string): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: ETIQUETAS,
    allowedAttributes: {
      // `href` sólo con los protocolos de abajo; `target` y `rel` para los
      // enlaces externos que ya escribe el agente.
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading", "width", "height"],
      // `style` sólo con las propiedades de `allowedStyles`: nada de
      // `behavior:` ni `expression()`, que son vías viejas pero vivas.
      div: ["style", "class"],
      span: ["style", "class"],
      p: ["style"],
      li: ["style"],
      td: ["style"],
      th: ["style"],
      table: ["style"],
      blockquote: ["style"],
      figure: ["style"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
    },
    // Sin esto, `javascript:alert(1)` en un href pasa. `data:` también se queda
    // fuera: un `data:text/html` es un XSS completo.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    // Un enlace a otro sitio que abra en pestaña nueva sin `rel` deja al destino
    // manipular la nuestra por `window.opener`.
    transformTags: {
      a: (nombre, attribs) => ({
        tagName: nombre,
        attribs:
          attribs.target === "_blank"
            ? { ...attribs, rel: "noopener noreferrer" }
            : attribs,
      }),
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z-]+$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z-]+$/i],
        "text-align": [/^(left|right|center|justify)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "border-radius": [/^[\d.]+(px|rem|em|%)$/],
        padding: [/^[\d.\s]+(px|rem|em)?$/],
        margin: [/^[\d.\s]+(px|rem|em)?$/],
        border: [/^[\w\s#.()%,-]+$/],
        "border-left": [/^[\w\s#.()%,-]+$/],
        "list-style": [/^[\w\s-]+$/],
      },
    },
    // Los comentarios pueden esconder trucos viejos de Internet Explorer y no
    // aportan nada a un artículo.
    allowedIframeHostnames: [],
    disallowedTagsMode: "discard",
  });
}
