-- Apoio 1 fixo: "Pedro Moraes" (com e), igual ao cadastro "Pedro Henrique Moraes do Nascimento" (08/11/2026; aplicado).
-- Antes estava "Pedro Morais" e o Checklist não reconhecia o Pedro.
update public.config set d = jsonb_set(d, '{midiaFixos,Apoio 1}', '"Pedro Moraes"') where id = 'geral';
update public.escalas e set d = jsonb_set(e.d, '{funcoes}', (
  select jsonb_agg(jsonb_set(f, '{pessoas}', coalesce((select jsonb_agg(case when norm_nome(p) = 'pedro morais' then 'Pedro Moraes' else p end)
    from jsonb_array_elements_text(f->'pessoas') p), '[]'::jsonb)) order by ord)
  from jsonb_array_elements(e.d->'funcoes') with ordinality x(f, ord)))
 where e.area = 'midia';
