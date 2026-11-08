-- Checklist da Mídia: itens em destaque e orações inicial/final (08/11/2026; aplicado no Supabase pelo Claude do chat).
-- "Oração inicial" (bloco Início, ordem 0) e "Oração final" (bloco Encerramento, ordem 1000) em cada checklist,
-- com destaque = true. A tela sempre mostra a oração inicial primeiro e a final por último.
alter table public.checklist_itens add column if not exists destaque boolean not null default false;

insert into public.checklist_itens (funcao, bloco, ordem, texto, destaque)
select f, b, o, t, true
  from (values ('Projeção'), ('Transmissão'), ('Câmera'), ('Apoio')) fs(f)
  cross join (values ('Início', 0, 'Oração inicial'), ('Encerramento', 1000, 'Oração final')) it(b, o, t)
 where not exists (select 1 from public.checklist_itens x where x.funcao = fs.f and x.texto = it.t);
