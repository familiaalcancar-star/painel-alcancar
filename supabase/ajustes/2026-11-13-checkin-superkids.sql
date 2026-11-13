-- ---------- Check-in: itens padrão do Super Kids (13/11/2026) ----------
-- Regra da área Super Kids valendo para todas as funções (funcao "*"): Crachá, Avental, Pulseiras, Canetas.
-- Prioridade no painel: área + função > área + "*" > "*" + função > "*" + "*". As outras regras continuam.
update public.config set d = jsonb_set(d, '{checkinPadrao}', (
  select jsonb_agg(r) from (
    select r from jsonb_array_elements(coalesce(d->'checkinPadrao','[]'::jsonb)) r
     where not (r->>'funcao' = '*' and r->>'area' = (select x->>'id' from jsonb_array_elements(d->'areas') x where x->>'nome' ilike '%kids%' limit 1))
    union all
    select jsonb_build_object('area', (select x->>'id' from jsonb_array_elements(d->'areas') x where x->>'nome' ilike '%kids%' limit 1),
                              'funcao', '*', 'itens', '["Crachá","Avental","Pulseiras","Canetas"]'::jsonb)
  ) s)) where id = 'geral';
