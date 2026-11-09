-- Checklist do Apoio: mochila depois da Oração final (09/11/2026; aplicado).
-- O bloco "Após a oração final" aparece depois da Oração final (a tela fixa essa ordem).
insert into public.checklist_itens (funcao, bloco, ordem, texto)
select 'Apoio', 'Após a oração final', o, t from (values (1010, 'Conferir mochila: iPhone, carregador, microfones e notebook'), (1020, 'Entregar mochila')) v(o, t)
where not exists (select 1 from public.checklist_itens where funcao = 'Apoio' and texto = v.t);
