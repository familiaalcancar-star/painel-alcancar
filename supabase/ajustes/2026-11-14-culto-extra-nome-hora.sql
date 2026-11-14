-- ---------- Culto extra com nome e horário próprios (14/11/2026) ----------
-- Campos opcionais na escala (d.cultoNome, d.hora): o painel mostra "Congresso de Homens "Desperta" · 20h"
-- no lugar de "Culto da noite · 18h30" em todas as telas. Sem os campos, vale o culto padrão.
-- Não precisa de mudança de tabela (ficam dentro de d). Dados do Congresso de Homens (18 a 21/11/2026):
update public.escalas set d = d || jsonb_build_object('cultoNome', 'Congresso de Homens "Desperta"', 'hora', '20h')
 where data between '2026-11-18' and '2026-11-21' and culto = 'noite' and d->>'obs' ilike 'Congresso de Homens%';
