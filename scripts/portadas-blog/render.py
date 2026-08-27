#!/usr/bin/env python3
"""
Genera las portadas del blog de Kora: foto de banco + el dato del artículo encima.

    python3 scripts/portadas-blog/render.py                 # las 55
    python3 scripts/portadas-blog/render.py <archivo|tema>… # sólo esas

Escribe HTML en .build/, dispara Chrome headless a PNG y deja el JPG final en
public/blog/portadas/<slug>.jpg.

Lienzo 1200×675 (16:9). La tarjeta del índice y la tarjeta social usan el 16:9
completo; el hero del artículo recorta a 3:1, así que TODO el texto vive en la
banda central segura (y de 138 a 537). Arriba y abajo sólo hay foto.
"""
import json, os, subprocess, sys, urllib.request
from urllib.parse import quote

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AQUI = os.path.join(RAIZ, "scripts", "portadas-blog")
BUILD = os.path.join(AQUI, ".build")
SALIDA = os.path.join(RAIZ, "public", "blog", "portadas")
MAPA = os.path.join(RAIZ, "lib", "blog-portadas.json")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
UA = "KoraBlogCovers/1.0 (contacto: hola@kora-hotel.com)"

W, H = 1200, 675
SEGURO = 138         # el hero recorta a 3:1 (ver components/blog/CoverImage.tsx)
VERDE = "#1B4332"    # kora-primary
MENTA = "#52B788"    # kora-accent


def tam_dato(txt):
    """El dato manda: número corto = enorme; frase larga = más chico."""
    n = len(txt)
    if n <= 8:   return 128, 0.90
    if n <= 14:  return 104, 0.94
    if n <= 22:  return 82, 1.00
    if n <= 32:  return 66, 1.06
    return 54, 1.12


def html_portada(p, ruta_foto):
    tam, alto_linea = tam_dato(p["dato"])
    src = "file://" + quote(ruta_foto)
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ width:{W}px; height:{H}px; overflow:hidden; }}
  body {{ font-family:'Plus Jakarta Sans', system-ui, sans-serif;
          font-variant-numeric: lining-nums tabular-nums;
          font-feature-settings:"lnum" 1; background:{VERDE}; }}

  .lienzo {{ position:relative; width:{W}px; height:{H}px; overflow:hidden; }}

  /* 1 — la foto, desaturada y bajada de luz para que nunca pelee con el texto */
  .foto {{ position:absolute; inset:0; width:100%; height:100%;
           object-fit:cover; object-position:{p['foco']};
           filter:saturate(.70) contrast(1.06) brightness(.76); }}

  /* 2 — velo verde de marca: sólido donde va el texto, se abre a la derecha */
  .velo {{ position:absolute; inset:0;
           background:linear-gradient(102deg,
             rgba(16,38,28,.90) 0%, rgba(16,38,28,.82) 32%,
             rgba(16,38,28,.50) 60%, rgba(16,38,28,.12) 100%); }}

  /* 3 — asiento inferior: sostiene el dato y el pie contra cualquier foto */
  .base {{ position:absolute; inset:0;
           background:linear-gradient(to top,
             rgba(11,28,20,.72) 0%, rgba(11,28,20,.34) 34%, rgba(11,28,20,0) 62%); }}

  /* 4 — viñeta suave para asentar las esquinas */
  .vineta {{ position:absolute; inset:0;
             background:radial-gradient(128% 104% at 80% 40%,
               rgba(0,0,0,0) 36%, rgba(0,0,0,.40) 100%); }}

  /* 5 — banda segura: aquí vive TODO el texto (el hero recorta a 3:1) */
  .banda {{ position:absolute; left:0; right:0; top:{SEGURO}px; height:{H - SEGURO*2}px;
            padding:20px 72px 18px 76px; display:flex; flex-direction:column;
            justify-content:space-between; }}

  .cabecera {{ display:flex; align-items:center; gap:14px; }}
  .regla {{ width:34px; height:2px; background:{MENTA}; border-radius:2px; }}
  .categoria {{ font-size:14px; font-weight:700; letter-spacing:.20em;
                text-transform:uppercase; color:#8BE0AF; }}

  .bloque {{ padding-bottom:2px; }}
  .dato {{ font-size:{tam}px; font-weight:800; line-height:{alto_linea};
           letter-spacing:-.035em; color:#fff; max-width:900px;
           text-wrap:balance; text-shadow:0 2px 30px rgba(0,0,0,.5); }}
  .pie {{ margin-top:16px; font-size:22px; font-weight:500; line-height:1.42;
          color:rgba(255,255,255,.88); max-width:640px; text-wrap:balance;
          text-shadow:0 1px 18px rgba(0,0,0,.62); }}

  .marca {{ position:absolute; right:72px; bottom:{SEGURO + 18}px;
            display:flex; align-items:center; gap:9px; }}
  .punto {{ width:9px; height:9px; border-radius:50%; background:{MENTA}; }}
  .kora {{ font-size:22px; font-weight:700; letter-spacing:-.02em; color:#fff; }}
</style></head>
<body>
  <div class="lienzo">
    <img class="foto" src="{src}" alt="">
    <div class="velo"></div>
    <div class="base"></div>
    <div class="vineta"></div>
    <div class="banda">
      <div class="cabecera"><span class="regla"></span><span class="categoria">{p['categoria']}</span></div>
      <div class="bloque">
        <div class="dato">{p['dato']}</div>
        <div class="pie">{p['pie']}</div>
      </div>
    </div>
    <div class="marca"><span class="punto"></span><span class="kora">Kora</span></div>
  </div>
</body></html>"""


def escribe_mapa(datos):
    """Un solo mapa portada→artículo para los tres caminos que lo necesitan:
    lib/blog-db.ts (los 12 del agente ya publicados, por slug),
    blog-agent/content-strategy.js (los 50 temas del banco, por id) y el
    README. Se regenera SIEMPRE, aunque sólo se pida una portada, para que no
    pueda quedar desfasado del JSON de datos."""
    por_slug = {
        x["slug"]: {"image": f"/blog/portadas/{x['slug']}.jpg", "imageAlt": x["alt"]}
        for x in datos["portadas"]
    }
    por_tema = {
        str(x["tema"]): {"image": f"/blog/portadas/{x['archivo']}.jpg", "imageAlt": x["alt"]}
        for x in datos["temas"]
    }
    for x in datos["portadas"]:
        if "tema" in x:
            por_tema[str(x["tema"])] = por_slug[x["slug"]]
    mapa = {
        "_generado": "scripts/portadas-blog/render.py — NO editar a mano",
        "porSlug": por_slug,
        "porTema": por_tema,
    }
    with open(MAPA, "w", encoding="utf-8") as f:
        json.dump(mapa, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"  ↻ lib/blog-portadas.json ({len(por_slug)} por slug, {len(por_tema)} por tema)")


def asegura_foto(ruta, url):
    """Baja la foto de banco si no está en la caché local. Las fotos NO viven en
    el repo (pesan y no hacen falta en producción): sólo el JPG final. La URL de
    origen y la licencia quedan guardadas en portadas.json."""
    if os.path.isfile(ruta) and os.path.getsize(ruta) > 20000:
        return True
    if not url:
        return False
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            datos = r.read()
        if len(datos) < 20000:
            return False
        open(ruta, "wb").write(datos)
        print(f"  ↓ bajada {os.path.basename(ruta)}")
        return True
    except Exception as e:
        print(f"  ✗ no se pudo bajar {os.path.basename(ruta)}: {e}")
        return False


def entradas(datos, pedidos):
    """Portadas a generar: las 17 publicadas (por slug) + las 38 del banco (por tema)."""
    filas = []
    for p in datos["portadas"]:
        filas.append({**p, "archivo": p["slug"]})
    for t in datos["temas"]:
        filas.append(t)
    if pedidos:
        filas = [f for f in filas
                 if f["archivo"] in pedidos or str(f.get("tema", "")) in pedidos]
    return filas


def main():
    datos = json.load(open(os.path.join(AQUI, "portadas.json"), encoding="utf-8"))
    bases = datos["_fotos_base"]
    filas = entradas(datos, set(sys.argv[1:]))
    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(SALIDA, exist_ok=True)
    escribe_mapa(datos)

    faltan = []
    for p in filas:
        clave, rel = p["foto"].split("/", 1)
        ruta = os.path.join(bases[clave], rel)
        if not asegura_foto(ruta, p.get("foto_url")):
            faltan.append((p["archivo"], ruta))
            continue

        html = os.path.join(BUILD, p["archivo"] + ".html")
        png = os.path.join(BUILD, p["archivo"] + ".png")
        jpg = os.path.join(SALIDA, p["archivo"] + ".jpg")
        open(html, "w", encoding="utf-8").write(html_portada(p, ruta))

        subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                        "--allow-file-access-from-files", "--force-device-scale-factor=1",
                        "--virtual-time-budget=9000", f"--window-size={W},{H}",
                        f"--screenshot={png}", html],
                       check=True, capture_output=True)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "84",
                        png, "--out", jpg], check=True, capture_output=True)
        print(f"  ✓ {p['archivo']}  ({os.path.getsize(jpg)//1024} KB)")

    if faltan:
        print("\n⚠️  Fotos que no se pudieron obtener — la portada NO se generó:")
        for s_, r in faltan:
            print(f"   {s_}\n     {r}")
        sys.exit(1)


if __name__ == "__main__":
    if not os.path.isfile(CHROME):
        sys.exit("No encuentro Google Chrome en " + CHROME)
    main()
