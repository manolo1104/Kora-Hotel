import { serializarJsonLd } from "@/lib/json-ld";

/**
 * El bloque `<script type="application/ld+json">` de una página.
 *
 * Existe para que NADIE vuelva a escribirlo a mano. Estaba copiado en 38
 * páginas y sólo 4 escapaban el `<`: las otras 34 metían texto del hotelero
 * —nombres de habitación, reseñas, FAQ, artículos— dentro de un `<script>` sin
 * tocar, y un `</script>` en cualquiera de esos campos cerraba el bloque y
 * convertía el resto en HTML de la página (K-18.1).
 *
 * Con un componente, la próxima página que añada datos estructurados lo hace
 * bien sin tener que acordarse de nada.
 *
 *     <JsonLd data={jsonLd} />
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializarJsonLd(data) }}
    />
  );
}
