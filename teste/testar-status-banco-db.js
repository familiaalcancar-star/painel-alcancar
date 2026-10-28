// Banco descartável com dados inventados. Requer @electric-sql/pglite.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
(async()=>{
 const db=new PGlite();
 const schema=read('supabase/schema.sql'), marker='-- Status explícito e extra Banco';
 const [antes,depois]=schema.split(marker);
 await db.exec(read('supabase/testes/01-simula-supabase.sql'));
 await db.exec(antes);
 await db.exec(read('supabase/testes/02-permissoes-padrao.sql'));
 await db.exec(read('supabase/testes/03-dados-de-teste.sql'));
 await db.exec(`insert into config(id,d) values ('geral','{"areas":[{"id":"direcao","porConexao":true},{"id":"superkids","porConexao":true}]}');`);
 await db.exec(marker+depois);
 assert.equal((await db.query("select count(*)::int n from pessoas where status <> 'aprovado' or banco")).rows[0].n,0);
 let n=1;
 // Regressões de permissão já existentes.
 const orig=await db.exec(read('supabase/testes/04-testes.sql'));
 for(const r of orig)for(const row of r.rows||[]){const v=Object.values(row)[0];if(typeof v==='string'){assert.ok(!v.includes('FALHOU'),v);n++;}}
 // Cada função, com todos os extras ligados, deve perder escrita ao marcar Banco.
 const todos=(await db.query('select id from pessoas')).rows;
 for(const {id} of todos){
  await db.exec('begin');
  await db.query("update pessoas set banco=true,gestao=true,ministro=true,avisos=true,escala=true where id=$1",[id]);
  const quem=id.slice(-2);
  const commands=[
   ["select * from escalas",'ok'],["select * from chat",'ok'],
   ["update escalas set d=d",'bloq'],["delete from escalas",'bloq'],
   ["insert into escalas(id,d) values ('teste-banco','{\"area\":\"louvor\"}')",'bloq'],
   ["insert into avisos(id,d) values ('teste-banco','{}')",'bloq'],
   ["insert into eventos(id,d) values ('teste-banco','{}')",'bloq'],
   ["insert into checkin_marcas(data,culto,chave) values ('2026-11-01','manha','teste')",'bloq'],
   ["insert into chat(texto) values ('teste')",'bloq'],["delete from chat",'bloq'],
   ["update pessoas set banco=false,status='aprovado' where id=auth.uid()",'bloq'],
   ["insert into storage.objects(bucket_id,name,owner_id) values ('imagens','teste',auth.uid()::text)",'bloq'],
   ["update config set d=d",'bloq'],["insert into historico(acao,tipo) values ('teste','teste')",'bloq']
  ];
  for(const [cmd,want] of commands){const v=(await db.query('select t($1,$2,$3,$4) result',[`Banco ${quem}: ${cmd}`,quem,cmd,want])).rows[0].result;assert.ok(v.startsWith('PASSOU'),v);n++;}
  await db.exec('rollback');
 }
 for(const status of ['pendente','removido']){
  await db.exec('begin');await db.query('update pessoas set status=$1',[status]);
  for(const [cmd,want] of [["select * from escalas",'ok'],["select * from chat",'bloq'],["insert into chat(texto) values ('teste')",'bloq'],["update pessoas set status='aprovado'",'bloq'],["update escalas set d=d",'bloq']]){
   const v=(await db.query('select t($1,$2,$3,$4) result',[status,'0a',cmd,want])).rows[0].result;assert.ok(v.startsWith('PASSOU'),v);n++;
  }await db.exec('rollback');
 }
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgname='cadastro_auto'")).rows[0].n,0);n++;
 console.log(n+' verificações de banco passaram.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
