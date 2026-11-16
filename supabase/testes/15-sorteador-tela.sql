-- Extra Sorteador e link da tela sem login.
select set_config('request.jwt.claim.sub','',false);
update pessoas set sorteador = true where id = '00000000-0000-0000-0000-0000000000e0';
select t('Sorteador gera o link da tela','e0',$q$select sorteio_link_tela('ev-cong-2099')$q$,'ok');
select t('Sem o extra NÃO gera link','d0',$q$select sorteio_link_tela('ev-cong-2099')$q$,'bloq');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e0',false);
create temp table tk as select sorteio_link_tela('ev-cong-2099') as t;
select set_config('request.jwt.claim.sub','',false);
select ok('Tela pelo link: ok e título', (select (sorteio_tela(t)->>'ok')::boolean and sorteio_tela(t)->>'titulo' = 'Congresso' from tk));
select t('Visitante (sem login) chama a tela pelo link','anon',$q$select sorteio_tela('qualquer-codigo')$q$,'ok');
select ok('Link errado: ok = false', not (sorteio_tela('codigo-errado')->>'ok')::boolean);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e0',false);
select sorteio_link_tela('ev-cong-2099', true) <> (select t from tk);
select set_config('request.jwt.claim.sub','',false);
select ok('Trocar o link invalida o anterior', (select not (sorteio_tela(t)->>'ok')::boolean from tk));
select t('Visitante NÃO lê os tokens','anon','select * from sorteio_telas','bloq');
-- Convite com o extra Sorteador: aprovado já com ele.
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000005a1','sorteador.convite@exemplo.com');
insert into convites(email, papel, sorteador) values ('sorteador.convite@exemplo.com', 'leitura', true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000005a1',false);
insert into cadastros(id, email, nome, whatsapp, conexao, papel) values ('00000000-0000-0000-0000-0000000005a1','sorteador.convite@exemplo.com','Sorteador Convidado','11977776655','betel','auxiliar');
select set_config('request.jwt.claim.sub','',false);
select ok('Convite leva o extra Sorteador', (select sorteador and status = 'aprovado' from pessoas where id = '00000000-0000-0000-0000-0000000005a1'));
-- Prêmio atual: o controle define; o telão (pelo link) mostra.
select t('Sorteador define o prêmio','e0',$q$select sorteio_definir_premio('ev-cong-2099','Bíblia de Estudo')$q$,'ok');
select t('Sem permissão NÃO define o prêmio','d0',$q$select sorteio_definir_premio('ev-cong-2099','X')$q$,'bloq');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e0',false);
select sorteio_definir_premio('ev-cong-2099','Bíblia de Estudo');
select ok('Prêmio atual para quem conduz', sorteio_premio('ev-cong-2099') = 'Bíblia de Estudo');
create temp table tk2 as select sorteio_link_tela('ev-cong-2099') as t;
select set_config('request.jwt.claim.sub','',false);
select ok('Telão pelo link recebe o prêmio atual', (select sorteio_tela(t)->>'premio' = 'Bíblia de Estudo' from tk2));
select t('Visitante NÃO lê o estado','anon','select * from sorteio_estado','bloq');
