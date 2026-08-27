# Portadas del blog

Cada artículo del blog tiene su **propia** portada: una foto de banco con el
dato del artículo encima, en verde Kora y tipografía del sitio.

Las 55 fotos son **CC0 / dominio público** (StockSnap y rawpixel, localizadas
vía `api.openverse.org`): uso comercial libre, se pueden modificar y **no
exigen crédito**. La licencia y la URL de origen de cada una quedan guardadas
en los campos `foto_*` de `portadas.json` — si dentro de dos años alguien
pregunta de dónde salió una foto, la respuesta está ahí.

Las fotos originales **no viven en el repo** (pesan y en producción no hacen
falta: sólo viaja el JPG final). Se guardan en `~/Desktop/Kora-portadas-stock/`
y el script las vuelve a bajar solo si faltan.

## Correr

```bash
python3 scripts/portadas-blog/render.py                  # las 55
python3 scripts/portadas-blog/render.py revpar-que-es    # sólo una
python3 scripts/portadas-blog/render.py 23               # sólo el tema 23
```

Necesita Google Chrome instalado (renderiza el HTML) y `sips` (macOS).
El resultado queda en `public/blog/portadas/<archivo>.jpg`. Si una foto de
banco no está en la caché local, el script la baja de su `foto_url`.

## Los datos

Todo vive en `portadas.json`:

- `portadas[]` — los 17 artículos ya publicados. Su `dato` está **verificado
  contra el texto publicado**: son cifras que el artículo realmente dice, con
  su fuente. Nunca inventar una cifra aquí.
- `temas[]` — los 38 temas del banco editorial que faltan por publicar (ids
  13–50). Como el artículo aún no existe, su `dato` es una **frase**, no un
  número: así no se promete una cifra que el texto no vaya a sostener.

## Cómo se conecta

`render.py` genera **`lib/blog-portadas.json`**, un solo mapa que consumen los
tres caminos. Nada se edita a mano, así que la imagen y su ruta no se pueden
desincronizar:

- **Los 5 artículos estáticos** — `lib/articles.ts` (su portada va escrita ahí).
- **Los 12 del agente ya publicados** — `lib/blog-db.ts` usa `porSlug` para
  pisar el `image` viejo que quedó en la tabla `blog_articles`. **No hace falta
  tocar la base de datos**: la portada manda desde el repo, y así las imágenes y
  el mapa viajan juntos en el mismo deploy (no hay ventana con imágenes rotas).
- **Los 38 que faltan** — `blog-agent/content-strategy.js` usa `porTema`. Si un
  tema del banco no tiene portada, **el agente se detiene en vez de publicar**
  con una foto ajena al tema. Y `POST /api/blog/create` rechaza un artículo sin
  portada.

## Al añadir temas nuevos al banco

1. Agrega el tema a `blog-agent/topics.json`.
2. Busca una foto CC0: `api.openverse.org/v1/images/?q=<tema>&license=cc0,pdm`
   (necesita cabecera `User-Agent`; sin ella contesta 403). **Sólo `cc0` o
   `pdm`** — `by-sa` y `by-nd` no se pueden usar en un sitio comercial.
3. Agrega su entrada a `temas[]` en `portadas.json`, con sus campos `foto_*`.
4. `python3 scripts/portadas-blog/render.py <archivo>` — genera el JPG **y**
   regenera `lib/blog-portadas.json`. No hay que tocar nada más.

## El recorte (importante)

El lienzo es 1200×675 (16:9), pero **el hero del artículo recorta a 3:1**.
Por eso todo el texto vive entre y=138 y y=537 (`SEGURO` en `render.py`).
Si alguien cambia la proporción en `components/blog/CoverImage.tsx`, hay que
cambiar `SEGURO` y volver a generar las 55.
