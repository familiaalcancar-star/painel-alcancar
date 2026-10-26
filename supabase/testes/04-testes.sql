select t('anon lê escalas','anon','select * from escalas','ok');
select t('anon lê config','anon','select * from config','ok');
select t('anon NÃO lê pessoas','anon','select * from pessoas','bloq');
select t('anon NÃO lê nomes','anon','select * from pessoas_nomes','bloq');
select t('anon NÃO lê config_privada','anon','select * from config_privada','bloq');
select t('anon NÃO edita escala','anon',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_midia'$q$,'bloq');
select t('anon NÃO lê check-in','anon','select * from checkin_marcas','bloq');
-- líder Betel
select t('Betel edita Direção do culto (Betel+Shalom)','b1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_direcao'$q$,'ok');
select t('Betel NÃO troca a data','b1',$q$update escalas set d=d||'{"data":"2026-11-08"}' where id='2026-11-01_manha_direcao'$q$,'bloq');
select t('Betel NÃO tira conexão','b1',$q$update escalas set d=d||'{"conexoes":["betel"]}' where id='2026-11-01_manha_direcao'$q$,'bloq');
select t('Betel NÃO edita Super Kids de Flechas','b1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_noite_superkids'$q$,'bloq');
select t('Betel NÃO edita Mídia','b1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_midia'$q$,'bloq');
select t('Betel NÃO edita Louvor','b1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_louvor'$q$,'bloq');
select t('Betel NÃO cria escala','b1',$q$insert into escalas(id,d) values ('n','{"data":"2026-11-08","culto":"manha","area":"direcao","conexao":"betel"}')$q$,'bloq');
select t('Betel NÃO exclui escala','b1',$q$delete from escalas where id='2026-11-01_manha_direcao'$q$,'bloq');
select t('Betel NÃO se promove','b1',$q$update pessoas set papel='admin' where id=auth.uid()$q$,'bloq');
select t('Betel NÃO troca a conexão','b1',$q$update pessoas set conexao='flechas' where id=auth.uid()$q$,'bloq');
select t('Betel lê a própria linha','b1','select * from pessoas where id=auth.uid()','ok');
select t('Betel NÃO vê WhatsApp dos outros','b1',$q$select * from pessoas where id<>auth.uid()$q$,'bloq');
select t('Betel vê nomes','b1','select * from pessoas_nomes','ok');
select t('Betel NÃO vê check-in','b1','select * from checkin_marcas','bloq');
select t('Betel NÃO cria aviso','b1',$q$insert into avisos(id,d) values ('z','{}')$q$,'bloq');
select t('Betel NÃO lê histórico','b1','select * from historico','bloq');
select t('Betel registra histórico','b1',$q$insert into historico(acao,tipo) values ('editou','escala')$q$,'ok');
select t('Betel NÃO altera config','b1',$q$update config set d=d where id='geral'$q$,'bloq');
-- auxiliar Shalom (2ª conexão do mesmo culto)
select t('Aux Shalom edita Direção (Betel+Shalom)','a5',$q$update escalas set d=d||'{"obs":"y"}' where id='2026-11-01_manha_direcao'$q$,'ok');
-- organização Flechas
select t('Flechas edita Super Kids (conexao antiga)','f1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_noite_superkids'$q$,'ok');
select t('Flechas edita Louvor','f1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_louvor'$q$,'ok');
select t('Flechas cria Louvor novo','f1',$q$insert into escalas(id,d) values ('2026-11-08_manha_louvor','{"data":"2026-11-08","culto":"manha","area":"louvor"}')$q$,'ok');
select t('Flechas NÃO edita Direção de Betel','f1',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_direcao'$q$,'bloq');
-- ministro
select t('Ministro edita Louvor','e0',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_louvor'$q$,'ok');
select t('Ministro NÃO edita Mídia','e0',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_midia'$q$,'bloq');
-- gestão
select t('Gestão marca check-in','c0',$q$insert into checkin_marcas(data,culto,chave,ci) values ('2026-11-01','manha','k',true)$q$,'ok');
select t('Gestão lê check-in','c0','select 1 from checkin_marcas union all select 1','ok');
select t('Gestão NÃO edita escala','c0',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_midia'$q$,'bloq');
-- avisos
select t('Avisador cria aviso','d0',$q$insert into avisos(id,d) values ('z','{}')$q$,'ok');
select t('Avisador edita o próprio','d0',$q$update avisos set d='{"titulo":"y"}' where id='a1'$q$,'ok');
select t('Avisador2 NÃO edita o dos outros','d1',$q$update avisos set d='{"titulo":"y"}' where id='a1'$q$,'bloq');
select t('Avisador2 NÃO exclui o dos outros','d1',$q$delete from avisos where id='a1'$q$,'bloq');
select t('Avisador NÃO toma autoria de outro (troca autor)','d1',$q$insert into avisos(id,d,autor) values ('w','{}','00000000-0000-0000-0000-0000000000d0') returning (autor='00000000-0000-0000-0000-0000000000d1')::int/(autor='00000000-0000-0000-0000-0000000000d1')::int$q$,'ok');
select t('Avisador envia imagem','d0',$q$insert into storage.objects(bucket_id,name,owner_id) values ('imagens','a.webp',auth.uid()::text)$q$,'ok');
select t('Betel NÃO envia imagem','b1',$q$insert into storage.objects(bucket_id,name,owner_id) values ('imagens','a.webp',auth.uid()::text)$q$,'bloq');
-- cadastro
select t('Novo envia cadastro','99',$q$insert into cadastros(id,nome,whatsapp,conexao,papel) values (auth.uid(),'Novo','11','betel','lider')$q$,'ok');
select t('Novo NÃO pede admin','99',$q$insert into cadastros(id,nome,whatsapp,conexao,papel) values (auth.uid(),'Novo','11','betel','admin')$q$,'bloq');
select t('Novo NÃO cadastra outro','99',$q$insert into cadastros(id,nome,whatsapp,conexao,papel) values ('00000000-0000-0000-0000-0000000000b1','X','11','betel','lider')$q$,'bloq');
select t('Novo NÃO se aprova','99',$q$insert into pessoas(id,nome,papel) values (auth.uid(),'Novo','lider')$q$,'bloq');
select t('Novo NÃO edita escala','99',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_direcao'$q$,'bloq');
-- admin
select t('Admin edita qualquer escala','0a',$q$update escalas set d=d||'{"data":"2026-11-08"}' where id='2026-11-01_manha_midia'$q$,'ok');
select t('Admin cria culto extra','0a',$q$insert into escalas(id,d) values ('n','{"data":"2026-11-04","culto":"extra","area":"midia"}')$q$,'ok');
select t('Admin aprova pessoa','0a',$q$update pessoas set gestao=true where nome='Lider Betel'$q$,'ok');
select t('Admin lê histórico','0a','select 1 from historico union all select 1','ok');
select t('Admin altera config','0a',$q$update config set d=d where id='geral'$q$,'ok');
select t('Admin edita aviso de outro','0a',$q$update avisos set d='{}' where id='a1'$q$,'ok');
select t('Admin faz check-in','0a',$q$insert into checkin_marcas(data,culto,chave) values ('2026-11-01','manha','k2')$q$,'ok');
