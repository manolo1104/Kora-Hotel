-- ═══════════════════════════════════════════════════════════════════════════
--  K-06 · PASO 3 de 3 — ROTACIÓN. Se corre después del paso 2.
--
--  Los tokens de hasta hoy han sido públicos: cualquiera pudo haberlos copiado
--  mientras la fuga estuvo abierta. Cerrar la puerta no sirve si alguien ya se
--  llevó la llave, así que hay que cambiarlas todas.
--
--  ⚠️ DESPUÉS DE CORRER ESTO: reiniciar el servicio de Camila en Railway. El
--  runtime recibe el token en cada consulta al fleet, pero no vuelve a comparar
--  el que ya tenía en memoria, así que hasta que se reinicie seguirá usando el
--  viejo — y /api/agent lo rechazará.
-- ═══════════════════════════════════════════════════════════════════════════

update public.hotel_bot_tokens
set token      = 'kora_' || replace(gen_random_uuid()::text, '-', ''),
    updated_at = now();

select hotel_id, left(token, 12) || '…' as token_nuevo, updated_at
from public.hotel_bot_tokens
order by updated_at desc;
