# Kora

Sistema hotelero todo-en-uno para hoteles boutique de México: motor de reservas
directas, PMS, agente de WhatsApp con IA (Camila), panel del hotelero y sitio
público. **Un solo repo sirve a todos los hoteles** (multi-tenant por `slug`).

Producción: **[kora-hotel.com](https://kora-hotel.com)** (Vercel).
El runtime de Camila vive aparte, en Railway.

---

## Arrancar en local

```bash
npm install
cp .env.example .env.local     # y llenar lo que haga falta
npm run dev                    # http://localhost:3000
```

Sin variables de entorno **casi todo degrada con gracia** en vez de tronar: sin
`RESEND_API_KEY` no se manda correo, sin `ANTHROPIC_API_KEY` la IA contesta un
mensaje amable, sin las de Stripe el checkout se apaga. `.env.example` lista
todas con un comentario de qué pasa si falta.

> 🔴 **Ojo con `.env.local`.** Si lleva una llave `sk_live` de Stripe, terminar
> un checkout desde `npm run dev` **cobra de verdad** a una tarjeta de verdad, y
> la reserva de prueba entra como reserva buena. Nada en la pantalla lo
> distingue. Al arrancar sale un aviso por consola, pero no impide nada.

## Antes de subir nada

```bash
npm run verificar
```

Corre, en este orden: `eslint` · `tsc --noEmit` · las pruebas (vitest) ·
`check:inventario` · `check:permisos`. **Tiene que salir en verde.**

⚠️ `tsc` NO basta por sí solo: un `route.ts` sólo puede exportar sus verbos HTTP
y eso únicamente lo caza `npm run build`. Si tocaste una ruta de API, corre
también el build.

Y el hábito de la casa: **comprobar en el navegador, no en el diff.** Levantar
`npm run dev` y mirar la pantalla que cambiaste.

## El chivato de la auditoría

```bash
bash scripts/verificar-arreglos.sh      # OK / ROJO por invariante
```

90 comprobaciones sacadas de la auditoría de agosto de 2026. Un rojo que vuelve
después de haber estado verde es una regresión.

⚠️ **Antes de arreglar un rojo, comprobar que el defecto existe.** Varios rojos
son del chivato y no del código: greps que cuentan `node_modules`, y
comprobaciones que se marcan a sí mismas al leer el comentario que documenta el
bug ya arreglado.

## Cómo está armado

| | |
|---|---|
| `app/` | Next.js 16 (App Router). Sitio público, `/panel` del hotelero, `/crm` interno, `/h/<slug>` de cada hotel y las rutas de API |
| `lib/` | La lógica. Reservas, inventario, Stripe, correos, IA, y las **fuentes únicas**: `oferta.ts` (precios y promesas), `caso-paraiso.ts` (las cifras del caso), `contacto.ts` (correo y WhatsApp) |
| `components/` | La interfaz |
| `agentes/camila/` | El runtime de WhatsApp. Se despliega solo, a Railway |
| `sql/` | Migraciones. **Idempotentes** (`if not exists`): correrlas ES la comprobación |
| `scripts/` | Los chivatos y utilidades |
| `tests/` | Vitest. Varias pruebas vigilan que las cifras y promesas públicas no se desincronicen |

### Las reglas que más duele romper

- **Ninguna cifra ni promesa comercial se escribe a mano.** Precios, plazos,
  garantía y días de forecast salen de `lib/oferta.ts`; las del caso de estudio,
  de `lib/caso-paraiso.ts`; el correo y el WhatsApp, de `lib/contacto.ts`. Hay
  pruebas que fallan si alguien vuelve a escribirlas en prosa.
- **El inventario se cuenta por UNIDAD, no por tipo de habitación.** Usar
  `unitNamesOf()` / `totalUnits()` / `freeUnitsByType()`, nunca `roomNamesOf()`.
  Confundirlos rompió a la vez el calendario público, el feed de las OTAs y a
  Camila.
- **Toda ruta de escritura del panel valida con zod y comprueba el rol.**
  `npm run check:permisos` lo vigila; las excepciones van con la razón escrita.
- **Nada de errores tragados.** Ni `.catch(() => {})`, ni `void (async …)`: en
  Vercel la función se congela al responder y el trabajo lanzado sin `await` se
  pierde.

## Desplegar

`main` → Vercel despliega solo a kora-hotel.com. El despliegue tarda ~4 min: si
al comprobar da 404, es que aún no termina. Los pasos y las trampas están en
[`DEPLOY-PRODUCCION.md`](DEPLOY-PRODUCCION.md); la operación del día a día, en
[`docs/OPERACION.md`](docs/OPERACION.md).

**Plan Hobby de Vercel:** ninguna función puede pasar de **60 s** (`maxDuration`
mayor no sirve: el borde corta igual con un 504 pelado) y los crons tienen que
ser **como mucho uno al día** — hoy son 8, todos diarios.
