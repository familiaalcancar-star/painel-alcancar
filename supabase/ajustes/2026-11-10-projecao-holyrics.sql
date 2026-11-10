-- Checklist da Projeção: Holyrics — verificar os avisos pós-culto (10/11/2026; aplicado).
insert into public.checklist_itens (funcao, bloco, ordem, texto, tipo)
select 'Projeção', 'Bloco 8 – Holyrics', 160, 'Verificar os avisos pós-culto', 'check'
where not exists (select 1 from public.checklist_itens where funcao = 'Projeção' and texto = 'Verificar os avisos pós-culto');
