-- Contas duplicadas: aviso no cadastro (conta_do_whatsapp) e transferência pelo admin (transferir_pessoa).
select set_config('request.jwt.claim.sub','',false);
insert into auth.users(id, email, raw_app_meta_data) values
 ('00000000-0000-0000-0000-0000000001c1','lima.velho@icloud.com','{"providers":["email"]}'),
 ('00000000-0000-0000-0000-0000000001c2','lima.novo@gmail.com','{"providers":["google"]}');
insert into pessoas(id,nome,apelido,papel,conexao,whatsapp,status,midia,gestao) values
 ('00000000-0000-0000-0000-0000000001c1','José Lima','Lima','auxiliar','proposito','(11) 98888-7777','aprovado',true,true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000001c2',false);
select ok('WhatsApp já cadastrado: mostra a outra conta mascarada', (select email = 'li•••@icloud.com' and provedor = 'email' from conta_do_whatsapp('11988887777')));
select ok('WhatsApp novo: não mostra nada', not exists (select 1 from conta_do_whatsapp('11900000000')));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000001c1',false);
select ok('A própria conta não aparece', not exists (select 1 from conta_do_whatsapp('11988887777')));
select set_config('request.jwt.claim.sub','',false);
select t('Visitante NÃO consulta WhatsApp','anon',$q$select * from conta_do_whatsapp('11988887777')$q$,'bloq');
select t('Não-admin NÃO transfere','b1',$q$select transferir_pessoa('00000000-0000-0000-0000-0000000001c1','00000000-0000-0000-0000-0000000001c2')$q$,'bloq');
select t('Admin transfere o cadastro para a conta nova','0a',$q$select transferir_pessoa('00000000-0000-0000-0000-0000000001c1','00000000-0000-0000-0000-0000000001c2')$q$,'ok');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select transferir_pessoa('00000000-0000-0000-0000-0000000001c1','00000000-0000-0000-0000-0000000001c2');
select set_config('request.jwt.claim.sub','',false);
select ok('Conta nova aprovada com função, conexão e extras; antiga removida',
  (select status = 'aprovado' and papel = 'auxiliar' and conexao = 'proposito' and midia and gestao and apelido = 'Lima' and email = 'lima.novo@gmail.com' from pessoas where id = '00000000-0000-0000-0000-0000000001c2')
  and (select status = 'removido' from pessoas where id = '00000000-0000-0000-0000-0000000001c1'));
