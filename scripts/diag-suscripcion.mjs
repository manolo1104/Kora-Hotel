// Diagnóstico SOLO LECTURA de la alerta "no se pudo leer una suscripción".
// Reproduce exactamente la consulta de lib/suscripcion.ts contra la base real.
// No escribe nada. Uso: node --env-file=.env.local scripts/diag-suscripcion.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const UID = process.argv[2] || '22adbc98-da65-46e6-a77c-606b759d4501'

console.log('=== 1) maybeSingle() EXACTO como en lib/suscripcion.ts ===')
const r1 = await sb.from('suscripciones').select('*').eq('user_id', UID).maybeSingle()
console.log('error:', JSON.stringify(r1.error))
console.log('data:', JSON.stringify(r1.data))

console.log('\n=== 2) sin maybeSingle: cuantas filas tiene ese dueno ===')
const r2 = await sb.from('suscripciones').select('*').eq('user_id', UID)
console.log('error:', JSON.stringify(r2.error))
console.log('filas:', r2.data?.length)
console.log(JSON.stringify(r2.data, null, 2))

console.log('\n=== 3) TODAS las suscripciones (buscar user_id duplicados) ===')
const r3 = await sb.from('suscripciones').select('id,user_id,plan,estado,periodo_fin,stripe_subscription_id,created_at,updated_at')
console.log('error:', JSON.stringify(r3.error))
if (r3.data) {
  console.log('total filas:', r3.data.length)
  const porUser = {}
  for (const s of r3.data) porUser[s.user_id] = (porUser[s.user_id] || 0) + 1
  console.log('user_id con MAS DE UNA fila:', JSON.stringify(Object.entries(porUser).filter(([, n]) => n > 1)))
  console.log(JSON.stringify(r3.data, null, 2))
}

console.log('\n=== 4) hoteles de ese dueno ===')
const r4 = await sb.from('hoteles').select('id,slug,nombre,owner_id,publicado,created_at').eq('owner_id', UID)
console.log('error:', JSON.stringify(r4.error))
console.log(JSON.stringify(r4.data, null, 2))
