-- Lista de presença: quem acessa o check-in marca; os outros não veem.
select t('Gestão adiciona pessoa na lista','c0',$q$insert into presencas(lista,id,nome) values ('congresso-2099','p1','João da Silva')$q$,'ok');
select t('Admin marca presença','0a',$q$insert into presencas(lista,id,nome,dias) values ('congresso-2099','p2','Pedro','{"2099-11-18":true}')$q$,'ok');
select t('Ministro (sem check-in) NÃO mexe','e0',$q$insert into presencas(lista,id,nome) values ('congresso-2099','p3','X')$q$,'bloq');
select t('Visitante NÃO lê','anon','select * from presencas','bloq');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c0',false);
insert into presencas(lista,id,nome,dias) values ('congresso-2099','p9','Maria','{"2099-11-18":true}');
select set_config('request.jwt.claim.sub','',false);
select ok('Grava quem marcou', (select por_nome = 'Gestor' and dias->'2099-11-18'->>'por' = 'Gestor' from presencas where id='p9'));
select t('Ministro NÃO lê a lista','e0','select * from presencas','bloq');
