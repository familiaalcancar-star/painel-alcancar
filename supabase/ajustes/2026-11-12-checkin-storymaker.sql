-- ---------- Check-in do Storymaker: iPhone e Microfone de lapela (12/11/2026) ----------
-- Itens novos no estoque do check-in (sem limite de estoque; ajuste em Ajustes se quiser).
insert into public.checkin_itens (nome, estoque, ativo, ordem) values
  ('iPhone', null, true, 60), ('Microfone de lapela', null, true, 70)
on conflict (nome) do update set ativo = true;
-- Regra padrão: quem está escalado no Storymaker retira Crachá, iPhone e Microfone de lapela.
update public.config c set d = jsonb_set(c.d, '{checkinPadrao}',
    coalesce((select jsonb_agg(r) from jsonb_array_elements(c.d->'checkinPadrao') r
               where not (r->>'area' = 'midia' and r->>'funcao' = 'Storymaker')), '[]'::jsonb)
    || '[{"area":"midia","funcao":"Storymaker","itens":["Crachá","iPhone","Microfone de lapela"]}]'::jsonb)
 where c.id = 'geral';
