-- Formulário da Mídia: envio sem login, validações no banco, uma resposta por e-mail e leitura só de administradores.
create or replace function fm(extra jsonb default '{}') returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('nome','Maria Teste','nascimento','2000-05-10','email','maria@x.com','whatsapp','(11) 98888-7777',
    'conhecimentos',(select jsonb_object_agg(id::text,'basico') from formulario_midia_conhecimentos where ativo),
    'funcoes','["Projeção","Câmera"]'::jsonb,'disponibilidade','["manha"]'::jsonb,'iphone',true,'conexao','betel',
    'outro_ministerio',false,'ministerios','[]'::jsonb,'autorizo',true) || extra
$$;
create or replace function fm_min(n text) returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_array((select id from formulario_midia_ministerios where nome = n))
$$;
select t('Listas: 12 conhecimentos e 6 ministérios cadastrados','anon',$q$select 1/((select count(*) from formulario_midia_conhecimentos)=12 and (select count(*) from formulario_midia_ministerios)=6)::int$q$,'ok');
select t('Visitante (sem login) envia o formulário com "Não" em outros ministérios','anon',$q$select 1/(enviar_formulario_midia(fm())='criado')::int$q$,'ok');
select t('Visitante envia com "Sim" e ministérios marcados','anon',$q$select enviar_formulario_midia(fm(jsonb_build_object('email','joao@x.com','outro_ministerio',true,'ministerios',fm_min('Som')||fm_min('Coro'))))$q$,'ok');
select t('"Sim" sem marcar ministério NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"outro_ministerio":true}'))$q$,'bloq');
select t('Nome vazio NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"nome":"   "}'))$q$,'bloq');
select t('Sem data de nascimento NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"nascimento":""}'))$q$,'bloq');
select t('Menor de 14 anos NÃO envia','anon',$q$select enviar_formulario_midia(fm(jsonb_build_object('nascimento',(current_date - interval '13 years')::date)))$q$,'bloq');
select t('Com 14 anos completos envia','anon',$q$select enviar_formulario_midia(fm(jsonb_build_object('nascimento',((now() at time zone 'America/Sao_Paulo')::date - interval '14 years')::date)))$q$,'ok');
select t('E-mail inválido NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"email":"maria.com"}'))$q$,'bloq');
select t('WhatsApp sem DDD NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"whatsapp":"98888777"}'))$q$,'bloq');
select t('Conhecimento sem nível NÃO envia','anon',$q$select enviar_formulario_midia(fm(jsonb_build_object('conhecimentos',(fm()->'conhecimentos') - (select id::text from formulario_midia_conhecimentos where nome='ATEM'))))$q$,'bloq');
select t('Nível inexistente NÃO envia','anon',$q$select enviar_formulario_midia(fm(jsonb_build_object('conhecimentos',(fm()->'conhecimentos') || jsonb_build_object((select id::text from formulario_midia_conhecimentos where nome='ATEM'),'expert'))))$q$,'bloq');
select t('Sem função NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"funcoes":[]}'))$q$,'bloq');
select t('Função fora da lista NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"funcoes":["Pastor"]}'))$q$,'bloq');
select t('Sem disponibilidade NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"disponibilidade":[]}'))$q$,'bloq');
select t('Sem responder iPhone NÃO envia','anon',$q$select enviar_formulario_midia(fm() - 'iphone')$q$,'bloq');
select t('Conexão fora da lista NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"conexao":"xyz"}'))$q$,'bloq');
select t('Sem responder outro ministério NÃO envia','anon',$q$select enviar_formulario_midia(fm() - 'outro_ministerio')$q$,'bloq');
select t('Sem autorizar NÃO envia','anon',$q$select enviar_formulario_midia(fm('{"autorizo":false}'))$q$,'bloq');
select t('Visitante NÃO grava direto na tabela','anon',$q$insert into formulario_midia_respostas(email,nome,nascimento,whatsapp,conhecimentos,funcoes,disponibilidade,iphone,conexao,outro_ministerio,autorizo) values ('a@x.com','A','2000-01-01','11988887777',fm()->'conhecimentos','{Apoio}','{noite}',true,'betel',false,true)$q$,'bloq');
select t('Logado (não admin) NÃO grava direto na tabela','b1',$q$insert into formulario_midia_respostas(email,nome,nascimento,whatsapp,conhecimentos,funcoes,disponibilidade,iphone,conexao,outro_ministerio,autorizo) values ('a@x.com','A','2000-01-01','11988887777',fm()->'conhecimentos','{Apoio}','{noite}',true,'betel',false,true)$q$,'bloq');
select t('Visitante NÃO edita a lista de conhecimentos','anon',$q$insert into formulario_midia_conhecimentos(nome) values ('Premiere')$q$,'bloq');
select t('Líder NÃO edita a lista de conhecimentos','b1',$q$insert into formulario_midia_conhecimentos(nome) values ('Premiere')$q$,'bloq');
select t('Admin inclui conhecimento novo','0a',$q$insert into formulario_midia_conhecimentos(nome,ordem) values ('Premiere',130)$q$,'ok');
select t('Admin inclui ministério novo','0a',$q$insert into formulario_midia_ministerios(nome,ordem) values ('Dança',70)$q$,'ok');
select t('Admin desativa ministério','0a',$q$update formulario_midia_ministerios set ativo=false where nome='Som'$q$,'ok');
select t('Ninguém lê o registro de envios','0a','select * from formulario_midia_envios','bloq');

insert into push_inscricoes(endpoint,usuario,p256dh,auth) values ('fm-adm','00000000-0000-0000-0000-00000000000a','k','a') on conflict do nothing;
-- Gravações reais (fora do t(), que desfaz tudo) para conferir reenvio e leitura.
select set_config('role','anon',false); select set_config('request.jwt.claim.sub','',false);
select enviar_formulario_midia(fm());
select enviar_formulario_midia(fm('{"email":"  MARIA@X.com ","whatsapp":"11977776666"}'));
reset role;
select case when (select count(*) from formulario_midia_respostas where email='maria@x.com')=1
             and (select envios from formulario_midia_respostas where email='maria@x.com')=2
             and (select atualizado_em is not null and whatsapp='11977776666' from formulario_midia_respostas where email='maria@x.com')
  then 'PASSOU ' else '>>> FALHOU ' end || 'Reenvio com o mesmo e-mail atualiza a resposta e guarda a data da atualização';
select case when (select count(*) from notificacoes where tipo='formulario')>=1 then 'PASSOU ' else '>>> FALHOU ' end || 'Administradores recebem aviso do envio';
select t('Admin lê as respostas','0a','select * from formulario_midia_respostas','ok');
select t('Visitante NÃO lê as respostas','anon','select * from formulario_midia_respostas','bloq');
select t('Líder NÃO lê as respostas','b1','select * from formulario_midia_respostas','bloq');
select t('Mídia NÃO lê as respostas','f7','select * from formulario_midia_respostas','bloq');
select t('Líder NÃO apaga respostas','b1','delete from formulario_midia_respostas','bloq');
select t('Admin apaga uma resposta','0a',$q$delete from formulario_midia_respostas where email='maria@x.com'$q$,'ok');
select t('Logado (não admin) também envia pela função','b1',$q$select enviar_formulario_midia(fm('{"email":"lider@x.com"}'))$q$,'ok');
-- Limite: o mesmo e-mail no máximo 3 vezes em 10 minutos (já foram 2).
select set_config('role','anon',false);
select enviar_formulario_midia(fm());
select t('4º envio do mesmo e-mail em 10 minutos é bloqueado','anon',$q$select enviar_formulario_midia(fm())$q$,'bloq');
reset role;
