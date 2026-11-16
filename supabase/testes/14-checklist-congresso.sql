-- Culto especial (Congresso): checklist libera só com a presença da entrada (lista de presença).
select set_config('request.jwt.claim.sub','',false);
insert into escalas(id,d) values ('2099-02-01_noite_staff','{"data":"2099-02-01","culto":"noite","area":"staff","cultoNome":"Congresso","funcoes":[]}');
insert into checkin_marcas(data,culto,chave,ci,nome,escalado) values ('2099-02-01','noite','cg1',true,'','Ana');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select ok('Congresso: check-in dos voluntários NÃO libera o checklist', not fez_checkin('2099-02-01','noite'));
select set_config('request.jwt.claim.sub','',false);
insert into presencas(lista,id,nome,dias) values ('congresso-2099-02-01','cg-ana','Ana','{"2099-02-01":{"em":"2099-02-01T22:00:00Z","por":"Lima"}}');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select ok('Congresso: presença na entrada libera o checklist', fez_checkin('2099-02-01','noite'));
select ok('Congresso: presença de outro dia não vale', not fez_checkin('2099-02-02','noite') or not exists (select 1 from escalas where data='2099-02-02'));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select ok('Congresso: outra pessoa sem presença continua travada', not fez_checkin('2099-02-01','noite'));
select set_config('request.jwt.claim.sub','',false);
