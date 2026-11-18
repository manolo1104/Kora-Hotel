// Guardar las preguntas frecuentes de Camila SIN pisar lo que otro guardó.
//
// EL DEFECTO: la pantalla de Camila cargaba la lista una vez y, con cada
// autoguardado, mandaba la lista ENTERA, que reemplazaba a la guardada. Una
// respuesta enseñada desde «Corregir» (bandeja de conversaciones) se guardaba en
// el servidor… y el siguiente autoguardado de la pantalla, con su copia vieja,
// la borraba. El aviso de «Corregir» decía "puedes verla en Configurar", y no
// estaba.
//
// LA SOLUCIÓN: el cliente manda lo que tenía al cargar (`base`) y lo que tiene
// ahora (`nuevo`). Sólo se aplica LA DIFERENCIA entre esos dos sobre lo que hay
// guardado de verdad: lo que el hotelero borró se borra, lo que cambió o agregó
// se escribe, y lo que apareció mientras tanto en el servidor se queda.

export interface Faq {
  q: string;
  a: string;
}

/** La misma clave con que `normalizeFaqs` decide que dos preguntas son la misma. */
export function claveFaq(q: string): string {
  return String(q ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function aMapa(lista: Faq[]): Map<string, Faq> {
  const m = new Map<string, Faq>();
  for (const f of lista) {
    const k = claveFaq(f.q);
    if (k) m.set(k, { q: f.q.trim(), a: (f.a ?? "").trim() });
  }
  return m;
}

export function mergeFaqs(actual: Faq[], base: Faq[], nuevo: Faq[]): Faq[] {
  const act = aMapa(actual);
  const b = aMapa(base);
  const n = aMapa(nuevo);
  // Lo que el hotelero quitó en ESTA pantalla.
  for (const k of b.keys()) if (!n.has(k)) act.delete(k);
  // Lo que agregó o cambió en ESTA pantalla.
  for (const [k, f] of n) {
    const antes = b.get(k);
    if (!antes || antes.a !== f.a || antes.q !== f.q) act.set(k, f);
  }
  return [...act.values()].filter((f) => f.q);
}
