-- Cadastro: campos obrigatórios e funções novas.
insert into auth.users values ('00000000-0000-0000-0000-0000000000f7','novo2@x') on conflict do nothing;
select t('Cadastro de Mídia','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano Mídia','fulano@x.com','(11) 98888-7777','betel','midia')$q$,'ok');
select t('Cadastro de Louvor','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','f@x.com','11988887777','betel','louvor')$q$,'ok');
select t('Cadastro de Coro','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','f@x.com','11988887777','betel','coro')$q$,'ok');
select t('Cadastro de Membro (leitura)','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','f@x.com','11988887777','betel','leitura')$q$,'ok');
select t('Sem nome NÃO envia','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'  ','f@x.com','11988887777','betel','coro')$q$,'bloq');
select t('E-mail inválido NÃO envia','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','fulano.com','11988887777','betel','coro')$q$,'bloq');
select t('WhatsApp sem DDD NÃO envia','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','f@x.com','98888777','betel','coro')$q$,'bloq');
select t('Conexão fora da lista NÃO envia','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','f@x.com','11988887777','xyz','coro')$q$,'bloq');
select t('Função inexistente NÃO envia','f7',$q$insert into cadastros(id,nome,email,whatsapp,conexao,papel) values (auth.uid(),'Fulano','f@x.com','11988887777','betel','pastor')$q$,'bloq');
select t('Admin aprova como Mídia e o extra Mídia liga sozinho','0a',$q$insert into pessoas(id,nome,papel,status) values ('00000000-0000-0000-0000-0000000000f7','Fulano Mídia','midia','aprovado') returning 1/(midia)::int$q$,'ok');
insert into auth.users values ('00000000-0000-0000-0000-0000000000f8','louvor@x') on conflict do nothing;
insert into pessoas(id,nome,papel,status,conexao) values ('00000000-0000-0000-0000-0000000000f8','Cantor Louvor','louvor','aprovado','flechas');
select t('Louvor lê as escalas com nomes','f8','select * from escalas','ok');
select t('Louvor NÃO edita o Louvor (só consulta)','f8',$q$update escalas set d=d||'{"obs":"x"}' where id='2026-11-01_manha_louvor'$q$,'bloq');
select t('Louvor NÃO edita a Direção da própria conexão','f8',$q$update escalas set d=d||'{"obs":"x"}' where area='superkids'$q$,'bloq');
