-- Extra Desperta: usa a lista de presença; não desmarca; cada presença com hora e quem marcou.
select set_config('request.jwt.claim.sub','',false);
update pessoas set desperta = true where id = '00000000-0000-0000-0000-0000000000e0';
select t('Desperta adiciona pessoa','e0',$q$insert into presencas(lista,id,nome) values ('desp-2099','d1','Fulano')$q$,'ok');
select t('Sem o extra NÃO adiciona','d0',$q$insert into presencas(lista,id,nome) values ('desp-2099','d2','X')$q$,'bloq');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e0',false);
insert into presencas(lista,id,nome,dias) values ('desp-2099','d5','Beltrano','{"2099-11-18":true}');
select set_config('request.jwt.claim.sub','',false);
select ok('Presença guarda a hora e quem marcou', (select dias->'2099-11-18'->>'por' = 'Ministro' and (dias->'2099-11-18'->>'em') is not null from presencas where id='d5'));
select t('Desperta marca outro dia','e0',$q$update presencas set dias = dias || '{"2099-11-19":true}' where id='d5'$q$,'ok');
select t('Desperta NÃO desmarca presença','e0',$q$update presencas set dias = '{}' where id='d5'$q$,'bloq');
select t('Desperta renomeia','e0',$q$update presencas set nome = 'Beltrano Silva' where id='d5'$q$,'ok');
select t('Desperta remove a pessoa da lista','e0',$q$delete from presencas where id='d5'$q$,'ok');
select t('Admin desmarca presença','0a',$q$update presencas set dias = '{}' where id='d5'$q$,'ok');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
update presencas set dias = dias || '{"2099-11-19":true}' where id='d5';
select set_config('request.jwt.claim.sub','',false);
select ok('Marcação antiga mantém a hora; a nova ganha a dela', (select dias->'2099-11-18'->>'por' = 'Ministro' and dias->'2099-11-19'->>'por' = 'Adm' from presencas where id='d5'));
select t('Desperta NÃO vê outras coisas do check-in','e0','select * from checkin_marcas','bloq');
