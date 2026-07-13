# Imagen para correr Camila (multi-tenant) en Railway.
# whatsapp-web.js usa Chromium headless vía Puppeteer, uno por hotel.
FROM node:20-slim

# Chromium del sistema + fuentes/CA (apt resuelve las libs que Chromium necesita).
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
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Resto del código.
COPY . .

# Puerto de la página de estado/QR + health (Railway inyecta PORT).
EXPOSE 3001

CMD ["node", "index.js"]
