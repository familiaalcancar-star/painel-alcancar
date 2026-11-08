-- Mídia: Pedro Morais e Augusto entram sozinhos em toda escala de Mídia.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into escalas(id,d) values ('mf1','{"data":"2099-01-04","culto":"manha","area":"midia","funcoes":[{"nome":"Mídia","pessoas":["Ana","augusto"]}]}');
insert into escalas(id,d) values ('mf2','{"data":"2099-01-04","culto":"noite","area":"midia"}');
update escalas set d = d || '{"funcoes":[{"nome":"Mídia","pessoas":["Bia"]}]}' where id='2026-11-01_manha_midia';
select ok('Mídia nova ganha os fixos sem duplicar (acento/maiúscula)', (select d->'funcoes'->0->'pessoas' from escalas where id='mf1') = '["Ana","augusto","Pedro Morais"]');
select ok('Mídia sem funções ganha a função com os fixos', (select d->'funcoes'->0->'pessoas' from escalas where id='mf2') = '["Pedro Morais","Augusto"]');
select ok('Editar a Mídia mantém os fixos', (select d->'funcoes'->0->'pessoas' from escalas where id='2026-11-01_manha_midia') = '["Bia","Pedro Morais","Augusto"]');
select ok('Outras áreas não mudam', (select not (d::text like '%Pedro Morais%') from escalas where id='2026-11-01_manha_louvor'));
