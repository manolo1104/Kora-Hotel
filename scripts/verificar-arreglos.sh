#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Kora · verificación automática de los arreglos de AUDIT_KORA.md
#
#  Corre desde la raíz del repo:   bash scripts/verificar-arreglos.sh
#
#  LÍNEA BASE (25 ago 2026, antes de arreglar nada): 7 verdes · 75 rojos.
#  Si al correrlo hoy no da eso, algo cambió en el repo desde la auditoría.
#  A medida que se ejecuta PLAN_ARREGLO_KORA.md, los rojos deben ir bajando.
#  Un rojo que vuelve después de haber estado verde = una regresión.
#
#  Es la sección 10.1 del plan. NO sustituye a la verificación contra la base
#  de datos (10.2) ni a las pruebas manuales de extremo a extremo (10.3).
# ─────────────────────────────────────────────────────────────────────────────
#  Cómo se usa (estas líneas son documentación, NO se ejecutan: antes estaban
#  sin comentar e invocaban un scripts/verificar-kora.sh que no existe):
#     bash scripts/verificar-arreglos.sh                        # OK / ROJO por comprobación
#     echo $?                                                   # 0 = todo verde; 1 = hay rojos
#     bash scripts/verificar-arreglos.sh > /tmp/kora-$(date +%F).txt 2>&1   # evidencia
#!/usr/bin/env bash
# scripts/verificar-kora.sh — Etapa 10.1 · verificación automática de invariantes.
# No arregla nada: sólo dice qué sigue roto. Sale 0 si todo está en verde.
REPO="${KORA_REPO:-/Users/manolocovarrubias/Desktop/Kora}"
cd "$REPO" || { echo "No existe $REPO"; exit 2; }
FALLOS=0; VERDES=0
ok(){   printf '  \033[32m OK \033[0m %s\n' "$1"; VERDES=$((VERDES+1)); }
bad(){  printf '  \033[31mROJO\033[0m %s\n' "$1"; FALLOS=$((FALLOS+1)); }
sec(){  printf '\n\033[1m── %s\033[0m\n' "$1"; }
G(){ grep -rnI --exclude=verificar-arreglos.sh "$@" 2>/dev/null | sinComentarios; }
# Descarta los aciertos que caen DENTRO de un comentario (// … o * …).
# Sin esto, documentar por escrito el bug que acabas de arreglar lo vuelve a
# marcar en rojo: A1.2, A2.3 y A3.1 salían rojos por sus propios comentarios.
sinComentarios(){ grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)'; }
# cero <nombre> <comando…>  → verde si el comando no imprime ninguna línea
cero(){ local nom="$1"; shift; local s n; s="$("$@" 2>/dev/null)"; n=$(printf '%s' "$s" | grep -c .)
  if [ "$n" -eq 0 ]; then ok "$nom"; else bad "$nom — $n resultado(s), deberían ser 0"
  printf '%s\n' "$s" | head -6 | sed 's/^/           /'; fi; }
# exacto <nombre> <n esperado> <comando…>
exacto(){ local nom="$1" esp="$2"; shift 2; local s n; s="$("$@" 2>/dev/null)"; n=$(printf '%s' "$s" | grep -c .)
  if [ "$n" -eq "$esp" ]; then ok "$nom (=$esp)"; else bad "$nom — hay $n, deberían ser $esp"
  printf '%s\n' "$s" | head -6 | sed 's/^/           /'; fi; }

sec "A1 · Ninguna escritura ni lectura de Supabase ignora {error}"
cero "A1.1 sin 'const { data' sin error"           bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" "const { data" app lib | grep -v "error"'
cero "A1.2 sin 'if (error) console.error'"         G --include="*.ts" "if (error) console.error" app lib
cero "A1.3 sin await admin/supabase.from suelto"   bash -c 'grep -rnIE --include="*.ts" "^[[:space:]]*await (admin|supabase)\.from\(" app lib'
cero "A1.4 ningún error de Postgres al navegador"  bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" "error.message" app/api | grep "NextResponse.json"'

sec "A2 · Cero errores tragados y cero promesas flotantes"
cero "A2.1 sin .catch(() => {})"                   bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" -e ".catch(() => {})" -e ".catch(()=>{})" app lib components agentes'
# `void` sólo pierde trabajo en el SERVIDOR (Vercel congela la función al
# responder). En un componente de navegador es la forma idiomática de decir
# "esta promesa va sin await a propósito", así que ahí no es un hallazgo.
cero "A2.2 sin 'void ' a nivel de sentencia (servidor)" bash -c 'grep -rnIE --include="*.ts" "^[[:space:]]*void " app/api lib'
cero "A2.3 sin 'void (async'"                      G --include="*.ts" --include="*.tsx" "void (async" app lib components

sec "A3 · Tipos contra unidades"
cero "A3.1 roomNamesOf no se usa en ningún sitio"  G --include="*.ts" --include="*.tsx" "roomNamesOf" app lib components
cero "A3.2 linkReserva absoluto en el bot"         bash -c 'grep -rnI --exclude=verificar-arreglos.sh "linkReserva:" lib/bot lib/agent-booking.ts | grep -v "http"'
cero "A3.3 check-inventario en verde"              bash -c 'node scripts/check-inventario.mjs >/dev/null 2>&1 || echo "scripts/check-inventario.mjs falló"'

sec "A4 · Las cifras públicas viven sólo en lib/cifras.ts"
cero "A4.0 existe lib/cifras.ts"                   bash -c '[ -f lib/cifras.ts ] || echo "falta lib/cifras.ts"'
cero "A4.1 sin 550/6600 fuera de cifras.ts"        bash -c 'grep -rnIE --include="*.ts" --include="*.tsx" "\\$?(550|6,?600)" app lib components | grep -v "lib/cifras.ts" | grep -v "lib/oferta.ts"'
cero "A4.2 sin promesas inexistentes"              bash -c 'grep -rniIE --include="*.ts" --include="*.tsx" "offline|CSV y PDF|API REST|forecast (de|a) 30|100% del pago" app lib components'
cero "A4.3 sin las cifras del caso de estudio"     bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" "35,880\|64,920\|72 horas\|23,500\|1,900" app lib components'
cero "A4.4 verificar-cifras.mjs en verde"          bash -c 'node scripts/verificar-cifras.mjs >/dev/null 2>&1 || echo "scripts/verificar-cifras.mjs falló"'

sec "A5 · Pantallas de error de Next"
exacto "A5.1 hay 5 error.tsx / global-error.tsx" 5 bash -c 'find app -name "error.tsx" -o -name "global-error.tsx"'

sec "A6 · Ningún .sql declara el CHECK viejo del plan"
cero "A6.1 sin plan in ('boutique','hotel',…)"     bash -c "grep -rnI --exclude=verificar-arreglos.sh \"plan in ('boutique'\" sql/"
cero "A6.2 sin plan='hotel' en runbooks"           bash -c "grep -rnI --exclude=verificar-arreglos.sh \"'hotel', 'cortesia'\\|plan='hotel'\" sql/ docs/ scripts/"
cero "A6.3 sin STRIPE_PRICE_ del plan viejo"       bash -c 'grep -rnI --exclude=verificar-arreglos.sh "STRIPE_PRICE_BOUTIQUE\|STRIPE_PRICE_HOTEL\|STRIPE_PRICE_GRANDE" app lib sql docs scripts .env.example'

sec "A7 · Un solo parser del campo notas"
cero "A7.0 existe lib/notas.ts"                    bash -c '[ -f lib/notas.ts ] || echo "falta lib/notas.ts"'
cero "A7.1 ||TOURS||/||HABS|| sólo en lib/notas.ts" bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" -- "||TOURS||\|||HABS||\|||PAQUETES||" app lib components | grep -v "^lib/notas.ts" | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)"'
cero "A7.2 sin la plantilla vieja booking-html"    bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" "booking-html\|buildBookingHtml\|printBookingPDF" app lib components | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)"'

sec "A8 · Secretos, credenciales y cadena de suministro"
cero "A8.1 .env fuera de git"                      bash -c 'git ls-files | grep "^\.env$"'
cero "A8.2 sin contraseña por defecto del CRM"     bash -c 'grep -rnI --exclude=verificar-arreglos.sh "manolitO\|CRM_PASSWORD ||\|PASSWORD || \"" lib/crm app/api/crm'
cero "A8.3 sin correo personal hardcodeado"        bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" "@gmail.com\|@hotmail.com" app lib components'
cero "A8.4 sin NEXT_PUBLIC_CRON_SECRET"            bash -c 'grep -rnI --exclude=verificar-arreglos.sh "NEXT_PUBLIC_CRON_SECRET" app lib components vercel.json .env.example'
cero "A8.5 llave IndexNow en un solo sitio"        bash -c 'grep -rlI "INDEXNOW\|indexnow" app lib scripts public | tail -n +2'
cero "A8.6 workflow sin interpolación en run"      bash -c 'grep -nI "\${{ *github.event.inputs" .github/workflows/*.yml'
cero "A8.7 secreto del fleet en tiempo constante"  bash -c 'grep -nI "secret !==\|!== secret\|!== process.env.BOT_FLEET_SECRET" app/api/bots/fleet/route.ts'

sec "A9 · Limitador de peticiones compartido, no en memoria"
cero "A9.1 sin Map de rate limit en el proceso"    bash -c 'grep -rnI --exclude=verificar-arreglos.sh "const hits = new Map" app lib'
# La función se llama `limitado()`, no `limitar()`: con el nombre viejo esta
# comprobación daba rojo aunque las nueve primeras rutas ya lo tuvieran.
cero "A9.2 toda ruta pública llama a limitado()"  bash -c 'for f in app/api/leads/route.ts app/api/soporte/route.ts app/api/crm/login/route.ts app/api/agent/route.ts app/api/agent-demo/route.ts app/api/herramientas/generar/route.ts app/api/reserva/reenviar/route.ts app/api/reserva/cancelar/route.ts app/api/reserva/consultar/route.ts app/api/h/*/checkout/route.ts app/api/h/*/intento/route.ts app/api/h/*/hold/route.ts app/api/admin/bot-preview/route.ts; do [ -f "$f" ] && ! grep -q "limitado(" "$f" && echo "SIN LIMITE: $f"; done'

sec "A10 · Una sola puerta de salida de correo"
# A10.1/A10.2 contaban sus PROPIOS comentarios: explicar por escrito que antes
# había cinco `new Resend()` volvía a marcar el hallazgo ya arreglado. Es el
# mismo fallo que A11.3 y A11.8a. La puerta única existe desde la etapa 4.
exacto "A10.1 un solo new Resend()"              1 bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" "new Resend(" app lib | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)"'
cero   "A10.2 nadie llama a emails.send fuera"     bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" "emails.send(" app lib | grep -v "lib/email/resend.ts" | grep -vE "^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)"'

sec "A11 · Runtime de Camila"
cero "A11.1 sin página HTML en el runtime"         bash -c 'grep -niI "doctype html\|text/html" agentes/camila/index.js'
cero "A11.2 sin portillo KORA_FLEET"               bash -c 'grep -rnI --exclude=verificar-arreglos.sh "KORA_FLEET" agentes/'
# Ignora los comentarios: explicar POR QUÉ no se usa `npm install` no puede
# volver a marcar el hallazgo (mismo fallo de un-solo-archivo que A11.8a).
cero "A11.3 Dockerfile con npm ci"                 bash -c 'grep -nE "^[[:space:]]*[^#[:space:]].*npm install" agentes/camila/Dockerfile'
cero "A11.4 Dockerfile no corre como root"         bash -c 'grep -qI "^USER " agentes/camila/Dockerfile || echo "falta USER en el Dockerfile"'
cero "A11.5 KORA_BASE_URL valida https"            bash -c 'grep -qI "https" agentes/camila/fleet.js || echo "fleet.js no valida el esquema de KORA_BASE_URL"'
cero "A11.6 apagado no compara 10 dígitos"         bash -c 'grep -nI "slice(-10)" agentes/camila/index.js'
cero "A11.7 sesión por hotel_id, no por slug"      bash -c 'grep -nI "clientId: *slug\|clientId: *h.slug" agentes/camila/index.js'
# Buscaba la comparación del token en index.js, pero el arreglo del paso 6.4
# —el que propone el plan— vive en kora.js (`KoraHotel.actualizar`). Con la
# comprobación vieja, hacerlo bien dejaba el chivato en ROJO igual. Ahora se
# miran las DOS mitades, que es lo que de verdad hace falta para que rotar los
# tokens no apague la flota.
# `sinComentarios` NO sirve aquí: espera el prefijo "archivo:línea:" que sólo
# imprime `grep -rn` sobre varios archivos. Sobre uno solo hay que mirar que el
# primer carácter no-espacio de la línea no sea el de un comentario.
cero "A11.8a el fleet refresca a los que ya corren" bash -c 'grep -qE "^[[:space:]]*[^/*[:space:]].*kora\.actualizar\(" agentes/camila/index.js || echo "sincronizarFleet no refresca los hoteles ya arrancados"'
cero "A11.8b actualizar() compara el token"       bash -c 'grep -A 12 "  actualizar(hotel)" agentes/camila/kora.js | grep -qI "this.token !== hotel.token" || echo "actualizar() no compara el token (o no existe)"'

sec "A12 · Dependencias y versiones"
cero "A12.1 npm audit sin high ni critical"        bash -c 'npm audit --audit-level=high --json 2>/dev/null | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const v=JSON.parse(s).metadata.vulnerabilities;if((v.high||0)+(v.critical||0)>0)console.log(\"high=\"+v.high+\" critical=\"+v.critical)}catch(e){console.log(\"npm audit no devolvió JSON\")}})"'
cero "A12.2 engines.node en los 3 package.json"    bash -c 'for p in package.json agentes/camila/package.json blog-agent/package.json; do [ -f "$p" ] && ! grep -q "\"engines\"" "$p" && echo "sin engines: $p"; done'
cero "A12.3 un solo @anthropic-ai/sdk"             bash -c 'grep -hI "@anthropic-ai/sdk" package.json agentes/camila/package.json blog-agent/package.json | tr -d " \"," | sort -u | tail -n +2'
cero "A12.4 stripe con apiVersion fijada"          bash -c 'grep -qI "apiVersion" lib/stripe/server.ts || echo "lib/stripe/server.ts sin apiVersion"'

sec "A13 · Herramientas de verificación vivas"
cero "A13.1 .eslintrc.json borrado"                bash -c 'ls .eslintrc.json 2>/dev/null'
cero "A13.2 existe eslint.config.mjs"              bash -c 'ls eslint.config.mjs >/dev/null 2>&1 || echo "falta eslint.config.mjs"'
cero "A13.3 npm run lint no es 'next lint'"        bash -c 'grep -nI "\"lint\": \"next lint\"" package.json'
cero "A13.4 hay scripts test y verificar"          bash -c 'for s in test verificar; do grep -q "\"$s\":" package.json || echo "falta npm run $s"; done'
cero "A13.5 autoprefixer en postcss"               bash -c 'grep -qI "autoprefixer" postcss.config.mjs || echo "postcss.config.mjs sin autoprefixer"'
cero "A13.6 npm run verificar sale 0"              bash -c 'npm run verificar --silent >/tmp/kora-verificar.log 2>&1 || { echo "npm run verificar falló:"; tail -5 /tmp/kora-verificar.log; }'

sec "A14 · Documentación, entorno y restos del hotel piloto"
cero "A14.1 README ya no es el boilerplate"        bash -c 'grep -nI "Geist\|create-next-app\|pnpm dev" README.md'
cero "A14.2 DEPLOY sin restos del PR viejo"        bash -c 'grep -nI "PR #1\|feat/plataforma-multitenant\|STRIPE_PRICE_\*" DEPLOY-PRODUCCION.md'
cero "A14.3 OPERACION sin plan hotel ni escalada"  bash -c "grep -nI \"'hotel', 'cortesia'\\|escala a tu WhatsApp\" docs/OPERACION.md"
cero "A14.4 README de Camila sin Opus 4.8"         bash -c 'grep -nI "opus-4-8\|Opus 4.8" agentes/camila/README.md agentes/camila/.env.example'
cero "A14.5 sin Paraíso en módulos compartidos"    bash -c 'grep -rniI "paraiso\|paraíso" lib/room-slugs.ts lib/booking-html.ts lib/admin/cleaning-config.ts app/api/agent-demo/route.ts app/panel components/panel 2>/dev/null'
cero "A14.6 sin korahotel.mx"                      bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" "korahotel.mx" app lib components'
cero "A14.7 sin envs huérfanas en el código"       bash -c 'comm -23 <(grep -rhoI "process\.env\.[A-Z0-9_]*" app lib components agentes scripts | sed "s/process\.env\.//" | sort -u) <(cat .env.example agentes/camila/.env.example | grep -oI "^#\{0,2\} *[A-Z0-9_]*" | tr -d "# " | sort -u) | grep -v "^NODE_ENV$\|^VERCEL"'
cero "A14.8 sin ?nuevo=1 huérfano"                 bash -c 'grep -rnI --exclude=verificar-arreglos.sh "nuevo=1" app | grep -v "searchParams"'

sec "A15 · Cabeceras de seguridad en un solo sitio"
cero "A15.1 vercel.json sin bloque headers"        bash -c 'grep -nI "\"headers\"" vercel.json'
cero "A15.2 sin X-XSS-Protection"                  bash -c 'grep -rnI --exclude=verificar-arreglos.sh "X-XSS-Protection" next.config.mjs vercel.json'
cero "A15.3 hay CSP definida"                      bash -c 'grep -qI "Content-Security-Policy" next.config.mjs || echo "no hay CSP en next.config.mjs"'

sec "A16 · La suite de pruebas"
cero "A16.1 npm test en verde"                     bash -c 'npm test --silent >/tmp/kora-test.log 2>&1 || { echo "npm test falló:"; tail -5 /tmp/kora-test.log; }'
cero "A16.2 hay al menos 6 archivos de test"       bash -c 'n=$(ls tests/*.test.* 2>/dev/null | grep -c .); [ "$n" -ge 6 ] || echo "sólo $n archivos en tests/"'

sec "A17 · Contratos y permisos de las rutas"
# Tres rutas EXENTAS, cada una con su razón, igual que hace check-permisos.mjs:
#   · bot-train y canales/sync no reciben cuerpo (POST sin body ni params).
#   · bot-config valida campo por campo CON topes, y además decide por campo si
#     hace falta ser dueño (`bot.pago` y `adminPhone`): eso no cabe en un
#     esquema, y reescribirlo sería tocar la parte del bot que guarda la CLABE.
# Se busca `zod` o `z\.` o `zId`, porque las rutas que sólo reciben un id por la
# ruta lo validan con `zId.safeParse` y no declaran esquema.
cero "A17.1 toda ruta de escritura valida con zod" bash -c 'for f in $(grep -rlI "export async function \(POST\|PATCH\|PUT\)" app/api/admin --include=route.ts); do case "$f" in *bot-train*|*canales/sync*|*bot-config*) continue;; esac; grep -q "zod\|z\.\|zId" "$f" || echo "SIN VALIDAR: $f"; done'
cero "A17.2 ninguna ruta del panel sin permiso"    bash -c 'for f in $(grep -rlI "getActiveHotel\|hotelDeLaPeticion" app/api --include=route.ts); do grep -q "negar(\|exigirRol(" "$f" || echo "SIN PERMISO: $f"; done'
cero "A17.3 sin cookie kora_active_slug"           bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" --include="*.tsx" "kora_active_slug" app lib components proxy.ts 2>/dev/null'
cero "A17.4 updateBooking con lista blanca"        bash -c 'grep -qI "CAMPOS_EDITABLES\|allowlist" lib/db/admin.ts || echo "updateBooking sigue copiando el body entero"'
cero "A17.5 el id de canales no viene del body"   bash -c 'grep -nI "onConflict: *\"id\"\|onConflict:\x27id\x27" lib/db/admin.ts app/api/admin/canales/route.ts'

sec "A18 · Escapado, URLs y entradas peligrosas"
# Ya no se persigue nombre por nombre de variable: el bloque `<script
# type="application/ld+json">` sólo puede aparecer en el componente compartido,
# que serializa con `serializarJsonLd`. Cualquier página que lo escriba a mano
# vuelve a salir aquí.
cero "A18.1 todo JSON-LD escapa <"                 bash -c 'grep -rlI "application/ld+json" --include="*.tsx" app components | grep -v "^components/shared/JsonLd.tsx$"'
cero "A18.2 sin HTML crudo del agente de IA"       bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.tsx" "dangerouslySetInnerHTML" app components | grep -v "JSON.stringify" | grep -v "sanitiz"'
cero "A18.3 URLs de usuario con lista blanca"      bash -c 'grep -qI "HOSTS_PERMITIDOS\|hostPermitido" lib/maps.ts || echo "lib/maps.ts sin lista blanca"'
cero "A18.4 esc() escapa comillas"                 bash -c 'grep -qI "&quot;" lib/email/design.ts || echo "esc() no escapa comillas"'
# Comprueba que la ruta USE el ayudante, no que lo llame de una forma concreta:
# antes buscaba el nombre `csvSeguro` y daba rojo porque la ruta llama a
# `armarCsv`, que es quien lo aplica por dentro a cada celda.
cero "A18.5 el CSV del CRM neutraliza fórmulas"    bash -c 'grep -qI "from \"@/lib/csv\"" app/api/crm/export/route.ts && grep -qI "ARRANQUE_PELIGROSO" lib/csv.ts || echo "el CSV no neutraliza fórmulas"'
cero "A18.6 open-redirect en un solo helper"       bash -c 'grep -rlI "startsWith(\"/\")" app/auth app/entrar 2>/dev/null | tail -n +2'
cero "A18.7 el fetch de mapas no sigue redirects"  bash -c 'grep -qI "redirect: *\"manual\"" app/api/panel/resolver-mapa/route.ts || echo "resolver-mapa sigue redirecciones"'

sec "A19 · Rutas, caché y activos"
cero "A19.1 sin force-dynamic en el layout público" bash -c 'grep -nI "force-dynamic" "app/h/[slug]/layout.tsx" 2>/dev/null'
cero "A19.2 el sitemap no repite mini-pagina"      bash -c 'n=$(grep -cI "herramientas/mini-pagina" app/sitemap.ts); [ "$n" -le 1 ] || echo "aparece $n veces"'
cero "A19.3 next/image acotado al proyecto real"   bash -c 'grep -nI "\*.supabase.co" next.config.mjs'
cero "A19.4 ningún PNG del portfolio >120 KB"      bash -c 'find public -name "*.png" -size +120k 2>/dev/null'
cero "A19.5 maxDuration <= 60 (Vercel Hobby)"      bash -c 'grep -rnI --exclude=verificar-arreglos.sh "maxDuration = " app | awk -F"= " "{if (\$2+0 > 60) print}"'
# 8 desde la captación por correo (`/api/cron/suscriptores`, 27 ago). Hobby
# admite hasta 100 crons PERO todos ≤1/día; el número aquí es un chivato para
# que añadir uno sea una decisión y no un descuido. Al añadir otro: subirlo, y
# comprobar antes que su horario es diario o el despliegue ENTERO falla.
exacto "A19.6 siguen siendo 8 crons"             8 bash -c 'grep -o "\"path\": \"/api/cron/" vercel.json'

sec "A20 · Apartado atómico e inventario (etapa 3: pasos 3.10, 3.12, 3.14, 3.15)"
cero "A20.1 existe el SQL del apartado atómico"    bash -c '[ -f sql/kora-e3-apartado-atomico.sql ] || echo "falta sql/kora-e3-apartado-atomico.sql"'
cero "A20.2 nadie aparta cuartos fuera del candado" bash -c 'grep -rnI --exclude=verificar-arreglos.sh --include="*.ts" "createTemporaryHold(" app lib | grep -v "^lib/db/availability.ts:"'
cero "A20.3 extendHold no resucita apartados muertos" bash -c 'grep -A 22 "export async function extendHold" lib/db/availability.ts | grep -q "gt(\"expires_at\"" || echo "extendHold revive holds vencidos (K-236)"'
cero "A20.4 alguien llama a limpiar_holds_vencidos" bash -c 'grep -rqI "limpiarHoldsVencidos()" app || echo "los apartados vencidos no los borra nadie (K-265)"'
cero "A20.5 desbloquear una noche es transaccional" bash -c 'grep -qI "recortarBloqueo(" app/api/admin/disponibilidad/route.ts || echo "el DELETE sigue borrando y reinsertando suelto (K-80)"'
cero "A20.6 getOccupiedRoomNames con tope explícito" bash -c 'grep -A 32 "export async function getOccupiedRoomNames" lib/db/availability.ts | grep -qE "query[.]limit[(]TOPE[)]" || echo "sin tope: un truncamiento de PostgREST sería sobreventa silenciosa"'
cero "A20.7 el cupo de experiencias acumula lo propio" bash -c 'grep -qI "validarCupoExperiencias(" "app/api/h/[slug]/checkout/route.ts" || echo "el cupo se compara línea por línea (K-100)"'

printf '\n\033[1m═══ RESULTADO ═══\033[0m\n'
printf '  verdes: %s   rojos: %s\n' "$VERDES" "$FALLOS"
[ "$FALLOS" -eq 0 ] || exit 1
