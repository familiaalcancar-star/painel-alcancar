-- Checklist do Apoio: "Anotar os avisos" (10/11/2026; aplicado).
insert into public.checklist_itens (funcao, bloco, ordem, texto, tipo)
select 'Apoio', 'Bloco 4 – Avisos', 60, 'Anotar os avisos', 'check'
where not exists (select 1 from public.checklist_itens where funcao = 'Apoio' and texto = 'Anotar os avisos');
