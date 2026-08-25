-- ═══════════════════════════════════════════════════════════════════════════
--  K-06 · PASO 2 de 3 — Se corre DESPUÉS de desplegar, no antes.
--
--  A estas alturas el código ya lee y escribe el token en `hotel_bot_tokens`.
--  Esto borra la copia que queda en `hoteles.config`, que es la que se podía
--  leer desde internet. Aquí es donde se cierra la fuga.
--
--  Si se corriera ANTES del despliegue, el código viejo dejaría de encontrar el
--  token y Camila se caería en todos los hoteles.
-- ═══════════════════════════════════════════════════════════════════════════

update public.hoteles
set config = config - 'agent_token'
where config ? 'agent_token';

-- Debe devolver 0.
select count(*) as tokens_que_siguen_expuestos
from public.hoteles
where config ? 'agent_token';
