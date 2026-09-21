# Imagen para correr Camila (multi-tenant) en Railway.
# whatsapp-web.js usa Chromium headless vía Puppeteer, uno por hotel.
FROM node:20-slim

# Chromium del sistema + fuentes/CA (apt resuelve las libs que Chromium necesita).
#
# La versión de `chromium` va SIN FIJAR a propósito, apartándose del plan. Fijarla
# haría el build reproducible hoy y lo rompería dentro de unos meses: Debian
# retira las versiones viejas de su mirror, y el día que eso pase el build falla
# sin que nadie haya tocado nada. Un runtime que hay que poder redesplegar
# deprisa —para rotar un token o parar un hotel— no puede depender de que un
# paquete siga publicado. La reproducibilidad de verdad sería fijar la imagen
# base por digest o usar un snapshot de Debian; hasta entonces, esto es honesto.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-color-emoji \
    tini \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer usa el Chromium del sistema (no descarga el suyo).
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Dependencias primero (mejor caché de build).
#
# `npm ci` y no `npm install`: instala EXACTAMENTE lo que dice el lockfile. Con
# `install`, el rango `^` puede traerse a producción una versión que nadie ha
# probado — y en un runtime que custodia las sesiones de WhatsApp de todos los
# hoteles, eso se descubre tarde. Si `ci` falla es porque el lockfile está
# desincronizado, que es justo lo que interesa que rompa el build y no la flota.
# (Comprobado sincronizado el 28 ago 2026.)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Resto del código.
COPY . .

# 🔴 PENDIENTE (paso 6.16 del plan de arreglo): este contenedor corre como ROOT
# y custodia las sesiones de WhatsApp y los tokens de todos los hoteles. El
# arreglo es:
#
#   RUN useradd -m -u 1001 camila && mkdir -p /data/wwebjs && chown -R camila:camila /app /data/wwebjs
#   USER camila
#
# y quitar `--disable-setuid-sandbox` de index.js (con usuario no-root el
# sandbox de Chromium ya arranca).
#
# NO se hizo todavía porque es el cambio que más fácil rompe la flota entera: el
# volumen persistente de Railway ya existe y sus archivos son de root, así que
# con uid 1001 el proceso puede quedarse sin poder escribir las sesiones — y eso
# significa que los cinco hoteles piden un QR nuevo a la vez. La mitigación que
# manda el plan es construir y correr la imagen en local ANTES de desplegar, y
# desplegar fuera del horario de huéspedes. En esta máquina no hay Docker (ni
# disco para instalarlo), así que se deja escrito aquí en vez de desplegarlo a
# ciegas. Ver [project_kora_etapa6_camila] en la memoria.

# Puerto de la página de estado/QR + health (Railway inyecta PORT).
EXPOSE 3001

# 🔴 `tini` COMO PROCESO NÚMERO 1, Y NO ES UN ADORNO.
#
# EL INCIDENTE DEL 21 SEP 2026: el contenedor llegó a 1.001 procesos con un tope
# de 1.000 (`/sys/fs/cgroup/pids.max`), no pudo abrir el navegador del cuarto
# hotel y dejó sin Camila al hotel que paga. No fue memoria: había 8 GB y se
# usaban 1,6.
#
# El porqué, en una frase: Chromium abre y cierra procesos hijos todo el tiempo
# (pestañas, renderers, el reportero de fallos), y cuando uno muere alguien
# tiene que recogerlo. Ese trabajo le toca al proceso número 1 del contenedor.
# Aquí el número 1 era `node`, y Node NO recoge a los huérfanos ajenos: cada uno
# se quedaba de «zombi» ocupando una de las 1.000 plazas PARA SIEMPRE. No gastan
# memoria, sólo plaza — por eso el síntoma era "no puedo crear un proceso" con
# 6 GB de RAM libres, y por eso empeoraba con los días: el contenedor llevaba
# 5 días y 18 horas sin reiniciarse, con 138 aperturas de QR en medio.
#
# `tini` existe justo para esto: pesa nada, se pone de número 1 y recoge todo lo
# que quede huérfano. Es el arreglo estándar de este problema (mismo caso y misma
# cura en ibeam#286 y en mobius#1165, éste último también en Railway).
#
# Cómo se comprueba que funciona, en producción y en un comando:
#   npx --yes @railway/cli ssh "grep -l ' Z ' /proc/*/stat | wc -l"   → 0 zombis
#   npx --yes @railway/cli ssh "cat /sys/fs/cgroup/pids.current"      → no sube solo
# ⚠️ Y ADEMÁS EN railway.json. Railway arranca con su `startCommand`, que pisa
# a este ENTRYPOINT: al desplegar esto por primera vez (21 sep 2026) el proceso
# número 1 seguía siendo `node index.js` y tini no recogía nada. Comprobado en
# caliente con `ssh "head -c 30 /proc/1/cmdline"`. Por eso el comando de arranque
# de railway.json también dice `/usr/bin/tini -- node index.js`: si alguien lo
# cambia ahí y lo deja en `node index.js`, los zombis vuelven en silencio.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "index.js"]
