-- ---------- Mídia: função Storymaker (12/11/2026) ----------
-- Mídia passa a ter 6 funções: Projeção, Transmissão, Câmera, Storymaker, Apoio 1, Apoio 2.
-- (Aplicado no banco pelo Claude do chat; migração "midia_fixos_storymaker". Pode rodar de novo sem problema.)

-- 1) Config: Storymaker (1 vaga) logo depois de Câmera.
update public.config c set d = jsonb_set(c.d, '{areas}', (
    select jsonb_agg(case when x->>'id' = 'midia' and not (x->'funcoes' @> '[{"nome":"Storymaker"}]') then
      x || jsonb_build_object('funcoes', (
        select jsonb_agg(f order by o) from (
          select f, o::numeric as o from jsonb_array_elements(x->'funcoes') with ordinality t(f, o)
          union all
          select '{"nome":"Storymaker","vagas":1}'::jsonb,
                 coalesce((select o from jsonb_array_elements(x->'funcoes') with ordinality t(f, o) where f->>'nome' = 'Câmera'), 0) + 0.5
        ) u))
      else x end order by ord)
    from jsonb_array_elements(c.d->'areas') with ordinality t(x, ord)))
 where c.id = 'geral';

-- 2) Gatilho da Mídia: a lista "nomes" inclui Storymaker depois de Câmera
--    (ver escalas_midia_fixos() no schema.sql — array['Projeção','Transmissão','Câmera','Storymaker','Apoio 1','Apoio 2']).

-- 3) Escalas de Mídia já gravadas: função Storymaker vazia logo depois de Câmera.
update public.escalas e set d = jsonb_set(e.d, '{funcoes}', (
    select jsonb_agg(f order by o) from (
      select f, o::numeric as o from jsonb_array_elements(e.d->'funcoes') with ordinality t(f, o)
      union all
      select '{"nome":"Storymaker","pessoas":[]}'::jsonb,
             coalesce((select o from jsonb_array_elements(e.d->'funcoes') with ordinality t(f, o) where f->>'nome' = 'Câmera'), 0) + 0.5
    ) u))
 where e.area = 'midia' and jsonb_typeof(e.d->'funcoes') = 'array'
   and not (e.d->'funcoes' @> '[{"nome":"Storymaker"}]');

-- 4) Checklist: itens do iPhone/celular/microfone copiados da Câmera para o Storymaker;
--    na Câmera ficam ativos só "Oração inicial" e "Oração final" até definirmos o checklist da câmera.
insert into public.checklist_itens (funcao, bloco, ordem, texto, ativo, destaque, tipo)
select 'Storymaker', bloco, ordem, texto, true, destaque, tipo
  from public.checklist_itens c
 where c.funcao = 'Câmera'
   and not exists (select 1 from public.checklist_itens s where s.funcao = 'Storymaker' and s.texto = c.texto);
update public.checklist_itens set ativo = false
 where funcao = 'Câmera' and texto not in ('Oração inicial', 'Oração final') and ativo;
