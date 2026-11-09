-- Check-in por quem está escalado (Staff · Check-in) de hoje até daqui a 6 dias.
insert into auth.users values ('00000000-0000-0000-0000-0000000000c5','leitor@x') on conflict do nothing;
insert into pessoas(id,nome,papel,status) values ('00000000-0000-0000-0000-0000000000c5','Leitor Consulta','leitura','aprovado') on conflict do nothing;
insert into escalas(id,d) select 'ck1', jsonb_build_object('data', to_char(now() + interval '2 days','YYYY-MM-DD'), 'culto','manha','area','staff',
  'funcoes', '[{"nome":"Check-in","pessoas":["betel LÍDER","Lider","Leitor Consulta"]},{"nome":"Checagem","pessoas":["Aux Shalom"]}]'::jsonb);
insert into escalas(id,d) select 'ck1m', jsonb_build_object('data', to_char(now() + interval '2 days','YYYY-MM-DD'), 'culto','manha','area','midia','funcoes','[]'::jsonb);
insert into escalas(id,d) select 'ck1d', jsonb_build_object('data', to_char(now() + interval '2 days','YYYY-MM-DD'), 'culto','manha','area','direcao','conexoes','["flechas"]'::jsonb,'funcoes','[]'::jsonb);
insert into escalas(id,d) select 'ck2', jsonb_build_object('data', to_char(now() + interval '10 days','YYYY-MM-DD'), 'culto','manha','area','staff',
  'funcoes', '[{"nome":"Check-in","pessoas":["Lider Betel"]}]'::jsonb);
select t('Escalado (nome e sobrenome, sem acento/ordem) marca check-in','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'ok');
select t('Escalado NÃO marca outro dia','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '3 days','YYYY-MM-DD')),'bloq');
select t('Escalado NÃO marca culto daqui a 10 dias','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '10 days','YYYY-MM-DD')),'bloq');
select t('Escalado em outra função (Checagem) NÃO marca','a5',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'bloq');
select t('Só consulta escalado com nome completo NÃO ganha','c5',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','k',true)$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'bloq');
select t('Nome: precisa nome e sobrenome','0a',$q$select 1/(nome_bate('silva joao','', 'João da Silva') and not nome_bate('João','João','João da Silva') and not nome_bate('Zequinha','Zequinha','Zequinha') and not nome_bate('João Pedro','', 'João da Silva'))::int$q$,'ok');
select t('Escalado edita nomes da Mídia do dia','b1',$q$update escalas set d=d||'{"obs":"x","funcoes":[{"nome":"Mídia","pessoas":["Ana"]}]}' where id='ck1m'$q$,'ok');
select t('Escalado edita nomes da Direção de outra conexão no dia','b1',$q$update escalas set d=d||'{"obs":"x"}' where id='ck1d'$q$,'ok');
select t('Escalado NÃO troca a conexão','b1',$q$update escalas set d=d||'{"conexoes":["betel"]}' where id='ck1d'$q$,'bloq');
select t('Escalado NÃO troca a data','b1',format($q$update escalas set d=d||jsonb_build_object('data',%L) where id='ck1m'$q$, to_char(now() + interval '3 days','YYYY-MM-DD')),'bloq');
select t('Escalado cria Ministração do dia','b1',format($q$insert into escalas(id,d) values ('ck1x', jsonb_build_object('data',%L,'culto','manha','area','ministracao'))$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'ok');
select t('Escalado NÃO cria Direção (área por conexão)','b1',format($q$insert into escalas(id,d) values ('ck1y', jsonb_build_object('data',%L,'culto','noite','area','direcao','conexoes','["betel"]'::jsonb))$q$, to_char(now() + interval '2 days','YYYY-MM-DD')),'bloq');
select t('Escalado NÃO edita escala de outro dia','b1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_midia'$q$,'bloq');
-- 09/11: Gestão de culto também faz check-in; papel Organização acessa o check-in.
insert into escalas(id,d) select 'ck3', jsonb_build_object('data', to_char(now() + interval '3 days','YYYY-MM-DD'), 'culto','manha','area','staff',
  'funcoes', '[{"nome":"Gestão de culto","pessoas":["Betel Lider"]}]'::jsonb);
select t('Escalado em Gestão de culto marca check-in','b1',
  format($q$insert into checkin_marcas(data,culto,chave,ci) values (%L,'manha','g',true)$q$, to_char(now() + interval '3 days','YYYY-MM-DD')),'ok');
select t('Organização acessa o check-in (qualquer data)','f1',$q$insert into checkin_marcas(data,culto,chave,ci) values ('2099-01-01','manha','o',true)$q$,'ok');
select t('Líder sem escala NÃO acessa o check-in','a5',$q$insert into checkin_marcas(data,culto,chave,ci) values ('2099-01-01','manha','o2',true)$q$,'bloq');
