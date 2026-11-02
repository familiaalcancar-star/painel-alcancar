-- Check-in por quem está escalado (Staff · Check-in) de hoje até daqui a 6 dias.
insert into escalas(id,d) select 'ck1', jsonb_build_object('data', to_char(now() + interval '2 days','YYYY-MM-DD'), 'culto','manha','area','staff',
  'funcoes', '[{"nome":"Check-in","pessoas":["líder"]},{"nome":"Checagem","pessoas":["Aux Shalom"]}]'::jsonb);
insert into escalas(id,d) select 'ck2', jsonb_build_object('data', to_char(now() + interval '10 days','YYYY-MM-DD'), 'culto','manha','area','staff',
  'funcoes', '[{"nome":"Check-in","pessoas":["Lider Betel"]}]'::jsonb);
select t('Escalado no check-in marca (nome parcial, sem acento)','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'ok');
select t('Escalado lê as marcas do dia','b1',
  format($q$select 1 from checkin_marcas where data=%L union all select 1$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'ok');
select t('Escalado NÃO marca outro dia','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '3 days','YYYY-MM-DD')),'bloq');
select t('Escalado NÃO marca culto daqui a 10 dias','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '10 days','YYYY-MM-DD')),'bloq');
select t('Escalado em outra função (Checagem) NÃO marca','a5',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'bloq');
select t('Não aprovado NÃO marca','99',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'bloq');
select t('Nome: todas as palavras dentro do nome completo','0a',$q$select 1/(nome_bate('silva joao','', 'João da Silva') and not nome_bate('João Pedro','', 'João da Silva') and nome_bate('Zequinha','Zequinha','Augusto X'))::int$q$,'ok');
