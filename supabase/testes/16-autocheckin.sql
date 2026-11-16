-- Auto check-in por QR Code (sem login).
select set_config('request.jwt.claim.sub','',false);
insert into eventos(id,d) values ('ev-qr','{"titulo":"Congresso QR","autoCheckin":true}');
update eventos set d = d || jsonb_build_object('dias', jsonb_build_array(hoje_sp()), 'autoCheckinTesteAte', (now() + interval '1 hour')::text) where id = 'ev-qr';
insert into evento_participantes(id,evento,nome) values ('00000000-0000-0000-0000-00000000aa01','ev-qr','João da Silva'),('00000000-0000-0000-0000-00000000aa02','ev-qr','Maria Souza');
select ok('Info: aberto hoje', (autocheckin_info('ev-qr')->>'aberto')::boolean);
select t('Visitante busca o nome','anon',$q$select * from autocheckin_buscar('ev-qr','João Silva')$q$,'ok');
select ok('Busca exige nome e sobrenome (1 palavra não acha)', not exists (select 1 from autocheckin_buscar('ev-qr','João')));
select t('Visitante confirma o check-in','anon',$q$select autocheckin_confirmar('ev-qr','00000000-0000-0000-0000-00000000aa01','aparelho-teste-1234567')$q$,'ok');
select autocheckin_confirmar('ev-qr','00000000-0000-0000-0000-00000000aa01','aparelho-teste-1234567');
select ok('Presença gravada com "QR Code (auto check-in)"', (select por_nome = 'QR Code (auto check-in)' from evento_presencas where participante='00000000-0000-0000-0000-00000000aa01'));
select ok('Confirmar de novo: já estava feito', (autocheckin_confirmar('ev-qr','00000000-0000-0000-0000-00000000aa01','aparelho-teste-1234567')->>'ja')::boolean);
select t('Mesmo celular NÃO faz check-in de outra pessoa','anon',$q$select autocheckin_confirmar('ev-qr','00000000-0000-0000-0000-00000000aa02','aparelho-teste-1234567')$q$,'bloq');
select t('Visitante NÃO lê a lista de participantes','anon','select * from evento_participantes','bloq');
