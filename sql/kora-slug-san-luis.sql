-- ────────────────────────────────────────────────────────────────────────────
-- Corregir el slug de Hotel San Luis: `hotel-san-liuis` → `hotel-san-luis`
--
-- El dueño escribió "LIUIS" al darse de alta el 31 ago 2026, y el slug es la
-- URL pública del hotel: kora-hotel.com/h/<slug>. Se cambia AHORA porque acaba
-- de crear la cuenta y todavía no ha repartido ningún enlace ni impreso ningún
-- código QR; más adelante, cambiarlo rompería los dos.
--
-- QUÉ NO SE ROMPE, comprobado antes de escribir esto:
--   · La sesión de WhatsApp de Camila NO se pierde. `LocalAuth` guarda por
--     `hotel.id` (uuid), no por slug — agentes/camila/index.js:167. El runtime
--     verá el slug viejo fuera del fleet, lo apagará y levantará el nuevo con la
--     MISMA sesión en disco. (Y hoy da igual: está en `qr`, sin escanear.)
--   · Ninguna tabla referencia el slug del hotel. Las otras dos columnas `slug`
--     de la base —`blog_articles.slug` y `hotel_blog_posts.slug`— son slugs de
--     ARTÍCULOS, y `hotel_blog_posts` apunta al hotel por `hotel_id`.
--   · Reservas, cotizaciones, miembros, tokens del bot: todos por `hotel_id`.
--
-- QUÉ SÍ CAMBIA: sus tres URLs públicas y, con ellas, los tres códigos QR de
-- Panel → Mi sitio → Compartir. Se regeneran solos al abrir esa pestaña.
--
-- COMPROBADO ANTES DE CORRERLO: `hotel-san-luis` está libre (0 filas).
--
-- CÓMO CORRERLO: Supabase → SQL Editor → New query → pegar → Run.
-- Es acotado por slug, así que toca UNA fila y el RETURNING la enseña.
-- ────────────────────────────────────────────────────────────────────────────

update public.hoteles
   set slug = 'hotel-san-luis'
 where slug = 'hotel-san-liuis'
returning id, slug, nombre, publicado;

-- Debe devolver 1 fila:
--   slug = hotel-san-luis | nombre = Hotel San Luis | publicado = true
--
-- Si devuelve 0 filas, el slug viejo ya no existe (o ya se corrigió).
