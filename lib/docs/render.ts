// Renderer minimalista tipo Mustache para los documentos branded: soporta
// {{ var }} y un nivel de sección repetible {{#lista}}...{{/lista}} (arrays de
// objetos), justo como describen las plantillas. Sin dependencias. Escapa HTML
// en todos los valores (los datos incluyen nombres de cliente → nunca confiar).

// El MISMO `esc` que los correos. Eran dos copias y las dos se quedaron sin
// escapar comillas; tener una sola evita que la próxima corrección arregle la
// mitad de los sitios.
import { esc } from "@/lib/email/design";

export type TemplateData = Record<string, unknown>;

/** Reemplaza {{#seccion}}…{{/seccion}} (repetible) y luego {{ var }}. */
export function renderMustacheLite(tpl: string, data: TemplateData): string {
  // 1) Secciones repetibles (arrays de objetos).
  let out = tpl.replace(
    /\{\{#\s*(\w+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
    (_m, key: string, inner: string) => {
      const arr = data[key];
      if (!Array.isArray(arr)) return "";
      return arr
        .map((item) => {
          const obj = (item ?? {}) as Record<string, unknown>;
          return inner.replace(/\{\{\s*(\w+)\s*\}\}/g, (_mm: string, k: string) => esc(obj[k]));
        })
        .join("");
    },
  );
  // 2) Variables simples de primer nivel.
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key];
    return Array.isArray(v) ? "" : esc(v);
  });
  return out;
}
