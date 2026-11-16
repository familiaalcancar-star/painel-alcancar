-- Culto especial (Congresso): checklist libera só com a presença da entrada (Participantes do evento).
select set_config('request.jwt.claim.sub','',false);
insert into eventos(id,d) values ('ev-cong-2099','{"titulo":"Congresso","data":"2099-02-01","checkinParticipantes":true,"dias":["2099-02-01","2099-02-02"]}');
insert into escalas(id,d) values ('2099-02-01_noite_staff','{"data":"2099-02-01","culto":"noite","area":"staff","cultoNome":"Congresso","funcoes":[]}');
insert into checkin_marcas(data,culto,chave,ci,nome,escalado) values ('2099-02-01','noite','cg1',true,'','Ana');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select ok('Congresso: check-in dos voluntários NÃO libera o checklist', not fez_checkin('2099-02-01','noite'));
select set_config('request.jwt.claim.sub','',false);
insert into evento_participantes(id,evento,nome) values ('00000000-0000-0000-0000-00000000c0a1','ev-cong-2099','Ana');
insert into evento_presencas(participante,dia) values ('00000000-0000-0000-0000-00000000c0a1','2099-02-01');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select ok('Congresso: presença na entrada libera o checklist', fez_checkin('2099-02-01','noite'));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select ok('Congresso: outra pessoa sem presença continua travada', not fez_checkin('2099-02-01','noite'));
select set_config('request.jwt.claim.sub','',false);

-- Participantes: Desperta usa; presença com nome de quem marcou; só admin desmarca.
select t('Desperta adiciona participante','e0',$q$insert into evento_participantes(evento,nome) values ('ev-cong-2099','Visitante Teste')$q$,'ok');
select t('Sem permissão NÃO adiciona','d0',$q$insert into evento_participantes(evento,nome) values ('ev-cong-2099','Outro')$q$,'bloq');
select t('Gestão NÃO desmarca presença','c0',$q$delete from evento_presencas where participante='00000000-0000-0000-0000-00000000c0a1'$q$,'bloq');
select t('Admin desmarca presença','0a',$q$delete from evento_presencas where participante='00000000-0000-0000-0000-00000000c0a1'$q$,'ok');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into evento_participantes(id,evento,nome) values ('00000000-0000-0000-0000-00000000c0a2','ev-cong-2099','Bruno Teste'),('00000000-0000-0000-0000-00000000c0a3','ev-cong-2099','Carla Teste');
insert into evento_presencas(participante,dia) values ('00000000-0000-0000-0000-00000000c0a2','2099-02-01'),('00000000-0000-0000-0000-00000000c0a3','2099-02-01');
select ok('Presença guarda o nome de quem marcou', (select por_nome = 'Adm' from evento_presencas where participante='00000000-0000-0000-0000-00000000c0a2'));

-- Sorteio: só quem tem presença no dia; ganhador sai dos próximos; ausente volta em outro dia.
select ok('Elegíveis do dia: 3 com presença (Ana, Bruno, Carla)', (select count(*) from sorteio_elegiveis('ev-cong-2099','2099-02-01')) = 3);
select (sortear('ev-cong-2099','2099-02-01','Bíblia')).nome is not null;
select ok('Sorteado fica pendente e sai da lista', (select count(*) from sorteio_elegiveis('ev-cong-2099','2099-02-01')) = 2);
select ok('Não sorteia de novo com sorteado pendente', (select count(*) from sorteios where status='sorteado') = 1);
select sorteio_marcar((select id from sorteios where status='sorteado'), 'ganhador');
select ok('Ganhador continua fora', (select count(*) from sorteio_elegiveis('ev-cong-2099','2099-02-01')) = 2);
select sorteio_reincluir_todos('ev-cong-2099');
select ok('Incluir todos de volta', (select count(*) from sorteio_elegiveis('ev-cong-2099','2099-02-01')) = 3);
select set_config('request.jwt.claim.sub','',false);
select t('Desperta NÃO sorteia','e0',$q$select sortear('ev-cong-2099','2099-02-01','')$q$,'bloq');
select t('Visitante NÃO lê sorteios','anon','select * from sorteios','bloq');
