-- Mídia: funções Projeção/Transmissão/Câmera/Apoio 1/Apoio 2; Apoio 1 = Pedro Morais e Apoio 2 = Augusto Cantuaria por padrão.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into escalas(id,d) values ('mf1','{"data":"2099-01-04","culto":"manha","area":"midia","funcoes":[{"nome":"Mídia","pessoas":["Ana","augusto","Bia","Pedro Morais","Caio","Davi"]}]}');
insert into escalas(id,d) values ('mf2','{"data":"2099-01-04","culto":"noite","area":"midia"}');
insert into escalas(id,d) values ('mf3','{"data":"2099-01-11","culto":"manha","area":"midia","funcoes":[{"nome":"Projeção","pessoas":["Ana"]},{"nome":"Apoio 2","pessoas":["Fulano Substituto"]}]}');
select ok('Escala antiga vira funções sem perder nomes', (select d->'funcoes' from escalas where id='mf1') =
  '[{"nome":"Projeção","pessoas":["Ana"]},{"nome":"Transmissão","pessoas":["Bia"]},{"nome":"Câmera","pessoas":["Caio","Davi"]},{"nome":"Apoio 1","pessoas":["Pedro Morais"]},{"nome":"Apoio 2","pessoas":["Augusto Cantuaria"]}]');
select ok('Escala nova já vem com Apoio 1 e Apoio 2', (select d->'funcoes'->3->'pessoas' = '["Pedro Morais"]' and d->'funcoes'->4->'pessoas' = '["Augusto Cantuaria"]' and d->'funcoes'->0->'pessoas' = '[]' from escalas where id='mf2'));
select ok('Admin troca o Apoio 2 num culto (mantém a troca)', (select d->'funcoes'->4->'pessoas' = '["Fulano Substituto"]' and d->'funcoes'->3->'pessoas' = '["Pedro Morais"]' from escalas where id='mf3'));
select ok('Outras áreas não mudam', (select not (d::text like '%Pedro Morais%') from escalas where id='2026-11-01_manha_louvor'));

-- Checklist: cargo Mídia, escalado na função, no dia (hoje em São Paulo).
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1','proj@x'),('00000000-0000-0000-0000-0000000000a2','trans@x'),('00000000-0000-0000-0000-0000000000a3','semcargo@x') on conflict do nothing;
insert into pessoas(id,nome,apelido,papel,status,midia) values
 ('00000000-0000-0000-0000-0000000000a1','Ana Projecao Silva','Ana','leitura','aprovado',true),
 ('00000000-0000-0000-0000-0000000000a2','Bia Transmissao','','leitura','aprovado',true),
 ('00000000-0000-0000-0000-0000000000a3','Caio Sem Cargo','Caio','leitura','aprovado',false);
insert into escalas(id,d) select 'mhoje', jsonb_build_object('data', hoje_sp(), 'culto','manha','area','midia','funcoes',
  '[{"nome":"Projeção","pessoas":["Ana"]},{"nome":"Transmissão","pessoas":["Bia Transmissao"]},{"nome":"Câmera","pessoas":["Caio"]}]'::jsonb);
insert into escalas(id,d) select 'mamanha', jsonb_build_object('data', to_char(now() + interval '7 days','YYYY-MM-DD'), 'culto','manha','area','midia','funcoes','[{"nome":"Projeção","pessoas":["Ana"]}]'::jsonb);
select set_config('request.jwt.claim.sub','',false);
select t('Sem check-in NÃO marca o checklist','a1',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'manha',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'bloq');
insert into checkin_marcas(data,culto,chave,ci,nome,escalado) values (hoje_sp(),'manha','t1',true,'','Ana'),(hoje_sp(),'manha','t2',true,'','Bia Transmissao'),(hoje_sp(),'noite','t3',true,'','Ana'),(hoje_sp(),'noite','t4',true,'','Bruno');
select t('Projeção marca item da Projeção hoje','a1',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'manha',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'ok');
select t('Projeção NÃO marca em outro dia','a1',$q$insert into checklist_marcas(data,culto,item) select to_char(now() + interval '7 days','YYYY-MM-DD'),'manha',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'bloq');
select t('Projeção NÃO marca no culto da noite (não escalada)','a1',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'bloq');
select t('Transmissão NÃO marca item da Projeção','a2',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'manha',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'bloq');
select t('Escalado sem o cargo Mídia NÃO marca','a3',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'manha',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'bloq');
select t('Cargo Mídia lê as marcas','a2','select 1 from checklist_marcas union all select 1','ok');
select t('Sem cargo NÃO lê as marcas','a3','select * from checklist_marcas','bloq');
select t('Visitante NÃO lê os itens','anon','select * from checklist_itens','bloq');
select t('Só admin edita itens','a1',$q$update checklist_itens set texto='x' where funcao='Projeção'$q$,'bloq');
select t('Admin edita itens','0a',$q$update checklist_itens set texto=texto where funcao='Projeção'$q$,'ok');
-- marca real (fora do t) para testar o desmarcar
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into checklist_marcas(data,culto,item) select hoje_sp(),'manha',id from checklist_itens where funcao='Projeção' order by ordem limit 1;
select set_config('request.jwt.claim.sub','',false);
select ok('Marca guarda quem marcou e a função', (select por_nome='Ana' and funcao='Projeção' from checklist_marcas limit 1));
select ok('Marcar entra no Histórico', exists (select 1 from historico where tipo='checklist' and resumo like '%Projeção: marcou "%'));
select t('Outra pessoa NÃO desmarca','a2',$q$delete from checklist_marcas where culto='manha'$q$,'bloq');
select t('Quem marcou NÃO desmarca (só admin)','a1',$q$delete from checklist_marcas where culto='manha'$q$,'bloq');
select t('Admin desmarca qualquer','0a',$q$delete from checklist_marcas where culto='manha'$q$,'ok');
-- Checklist "Apoio": Apoio 1 e Apoio 2 marcam os mesmos itens.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a4','apoio2@x') on conflict do nothing;
insert into pessoas(id,nome,apelido,papel,status,midia) values ('00000000-0000-0000-0000-0000000000a4','Bruno Apoio','Bruno','leitura','aprovado',true) on conflict do nothing;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into escalas(id,d) select 'mapoio', jsonb_build_object('data', hoje_sp(), 'culto','noite','area','midia','funcoes',
  '[{"nome":"Apoio 1","pessoas":["Ana"]},{"nome":"Apoio 2","pessoas":["Bruno"]}]'::jsonb);
select set_config('request.jwt.claim.sub','',false);
select t('Apoio 1 marca item do Apoio','a1',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where funcao='Apoio' order by ordem limit 1$q$,'ok');
select t('Apoio 2 marca item do Apoio','a4',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where funcao='Apoio' order by ordem limit 1$q$,'ok');
select t('Apoio NÃO marca item da Projeção','a4',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where funcao='Projeção' order by ordem limit 1$q$,'bloq');
-- Orações inicial e final em destaque nos 4 checklists.
select ok('Orações inicial e final em destaque nas 4 funções', (select count(*) from checklist_itens where destaque and texto in ('Oração inicial','Oração final')) = 8);
select t('Admin liga/desliga destaque','0a',$q$update checklist_itens set destaque = not destaque where texto='Oração final' and funcao='Apoio'$q$,'ok');
select t('Não-admin NÃO muda destaque','a1',$q$update checklist_itens set destaque = false where texto='Oração final'$q$,'bloq');
-- 10/11: itens de porcentagem (bateria).
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into checklist_marcas(data,culto,item,valor) select '2099-03-01','manha',id,85 from checklist_itens where texto='Bateria ao retirar (%)';
select ok('Porcentagem salva e no histórico', (select valor from checklist_marcas where data='2099-03-01') = 85 and exists (select 1 from historico where resumo like '%Bateria ao retirar (%)" = 85%%'));
select set_config('request.jwt.claim.sub','',false);
select t('Porcentagem sem valor NÃO grava','0a',$q$insert into checklist_marcas(data,culto,item) select '2099-03-02','manha',id from checklist_itens where texto='Bateria ao devolver (%)'$q$,'bloq');
select t('Porcentagem acima de 100 NÃO grava','0a',$q$insert into checklist_marcas(data,culto,item,valor) select '2099-03-02','manha',id,101 from checklist_itens where texto='Bateria ao devolver (%)'$q$,'bloq');
