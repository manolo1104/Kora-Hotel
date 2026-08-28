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

CMD ["node", "index.js"]
