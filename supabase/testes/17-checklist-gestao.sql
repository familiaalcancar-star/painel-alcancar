-- Checklist da Gestão de culto (Staff): Checagem conta como Gestão de culto; item 'texto' exige a observação.
select set_config('request.jwt.claim.sub','',false);
insert into escalas(id,d) select 'gchoje', jsonb_build_object('data', hoje_sp(), 'culto','noite','area','staff','funcoes',
  '[{"nome":"Gestão de culto","pessoas":["Bia Transmissao"]},{"nome":"Checagem","pessoas":["Ana"]},{"nome":"Check-in","pessoas":["Caio"]}]'::jsonb);
insert into checkin_marcas(data,culto,chave,ci,nome,escalado) values (hoje_sp(),'noite','gc2',true,'','Bia Transmissao'),(hoje_sp(),'noite','gc3',true,'','Caio');
select ok('Existem os 9 itens da Gestão de culto (1 de texto)', (select count(*) = 9 and count(*) filter (where tipo='texto') = 1 from checklist_itens where area='staff' and funcao='Gestão de culto' and ativo));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select ok('Checagem: checklist_meu_status devolve "Gestão de culto"', (select checklist_meu_status(hoje_sp(),'noite')->'funcoes' ? 'Gestão de culto'));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',false);
select ok('Check-in (Staff) NÃO tem checklist', not (select checklist_meu_status(hoje_sp(),'noite')->'funcoes' ? 'Gestão de culto'));
select set_config('request.jwt.claim.sub','',false);
select t('Checagem marca item da Gestão de culto','a1',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where area='staff' and tipo='check' order by ordem limit 1$q$,'ok');
select t('Gestão de culto marca item','a2',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where area='staff' and tipo='check' order by ordem limit 1$q$,'ok');
select t('Check-in (Staff) NÃO marca item da Gestão de culto','a3',$q$insert into checklist_marcas(data,culto,item) select hoje_sp(),'noite',id from checklist_itens where area='staff' and tipo='check' order by ordem limit 1$q$,'bloq');
select t('Observação salva com texto','a2',$q$insert into checklist_marcas(data,culto,item,obs) select hoje_sp(),'noite',id,'  Som falhou no 2º louvor  ' from checklist_itens where area='staff' and tipo='texto'$q$,'ok');
select t('Observação vazia NÃO salva','a2',$q$insert into checklist_marcas(data,culto,item,obs) select hoje_sp(),'noite',id,'   ' from checklist_itens where area='staff' and tipo='texto'$q$,'bloq');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
insert into checklist_marcas(data,culto,item,obs) select hoje_sp(),'noite',id,'  Som falhou  ' from checklist_itens where area='staff' and tipo='texto';
select ok('Observação guarda o texto (sem espaços) e quem escreveu', (select obs = 'Som falhou' and por_nome is not null from checklist_marcas m join checklist_itens i on i.id = m.item where i.tipo='texto'));
insert into checklist_marcas(data,culto,item,obs) select hoje_sp(),'noite',id,'x' from checklist_itens where area='staff' and tipo='check' order by ordem limit 1;
select ok('Item de caixinha não guarda texto', (select obs is null from checklist_marcas m join checklist_itens i on i.id = m.item where i.area='staff' and i.tipo='check' limit 1));
select set_config('request.jwt.claim.sub','',false);
select t('Quem escreveu NÃO apaga a observação','a2',$q$delete from checklist_marcas where item in (select id from checklist_itens where tipo='texto')$q$,'bloq');
select t('Admin apaga a observação','0a',$q$delete from checklist_marcas where item in (select id from checklist_itens where tipo='texto')$q$,'ok');
