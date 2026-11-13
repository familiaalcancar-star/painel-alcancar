-- Quem marcou: confirmação do escalado no checklist; check-in e itens com nome e hora.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
delete from checklist_marcas where data = hoje_sp() and culto = 'manha';
insert into checklist_marcas(data,culto,item) select hoje_sp(),'manha',id from checklist_itens where funcao='Projeção' and ativo and coalesce(tipo,'check')='check' order by ordem limit 1;
select set_config('request.jwt.claim.sub','',false);
select t('Transmissão NÃO confirma item da Projeção','a2',$q$select checklist_confirmar(hoje_sp(),'manha',(select item from checklist_marcas where data=hoje_sp() and culto='manha' limit 1))$q$,'bloq');
select t('Visitante NÃO confirma','anon',$q$select checklist_confirmar(hoje_sp(),'manha',(select item from checklist_marcas where data=hoje_sp() and culto='manha' limit 1))$q$,'bloq');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select checklist_confirmar(hoje_sp(),'manha',(select item from checklist_marcas where data=hoje_sp() and culto='manha' limit 1));
select set_config('request.jwt.claim.sub','',false);
select ok('Escalado confirma item marcado pelo admin: os dois nomes ficam', (select por = '00000000-0000-0000-0000-00000000000a' and confirmado_por = '00000000-0000-0000-0000-0000000000a1' and confirmado_nome = 'Ana' and confirmado_em is not null from checklist_marcas where data=hoje_sp() and culto='manha' limit 1));
select ok('Confirmação vai para o histórico', exists (select 1 from historico where resumo like '%confirmou%(marcado por %'));

-- Check-in: Gestão faz o check-in e entrega 2 itens; Admin marca a devolução de um.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c0',false);
insert into checkin_marcas(data,culto,chave,ci,itens) values ('2099-05-01','manha','q1',true,'[{"nome":"Crachá","qtd":1,"ret":1,"dev":0,"ret_nome":"Falso"},{"nome":"Rádio","qtd":1,"ret":1,"dev":0}]');
select ok('Check-in grava quem marcou (e ignora nome falso)', (select ci_nome = 'Gestor' and ci_em is not null and itens->0->>'ret_nome' = 'Gestor' and itens->1->>'ret_nome' = 'Gestor' and not (itens->0 ? 'dev_nome') from checkin_marcas where chave='q1'));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
update checkin_marcas set itens = '[{"nome":"Crachá","qtd":1,"ret":1,"dev":0},{"nome":"Rádio","qtd":1,"ret":1,"dev":1}]' where chave='q1';
select ok('Devolução grava quem marcou; o resto continua com o nome de antes', (select ci_nome = 'Gestor' and itens->0->>'ret_nome' = 'Gestor' and itens->1->>'ret_nome' = 'Gestor' and itens->1->>'dev_nome' = 'Adm' from checkin_marcas where chave='q1'));
update checkin_marcas set ci = false where chave='q1';
select ok('Desmarcar o check-in limpa quem marcou', (select ci_nome is null and ci_em is null from checkin_marcas where chave='q1'));
select set_config('request.jwt.claim.sub','',false);
