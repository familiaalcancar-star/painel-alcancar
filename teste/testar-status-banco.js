// Dados inventados. Executar: node teste/testar-status-banco.js
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path'), http=require('http'), assert=require('assert/strict');
const pub=path.join(__dirname,'../public');
const config={igreja:'Igreja Teste',conexoes:[{id:'betel',nome:'Betel'},{id:'shalom',nome:'Shalom'},{id:'flechas',nome:'Flechas'}],cultos:[{id:'manha',nome:'Manhã',hora:'09:30'}],diasCulto:[0],areas:[{id:'direcao',nome:'Direção',porConexao:true,funcoes:[{nome:'Recepção',vagas:1}]},{id:'louvor',nome:'Louvor',funcoes:[{nome:'Ministros',vagas:1}]}]};
const dados={config,escalas:[{id:'teste',data:'2026-11-01',culto:'manha',area:'direcao',conexao:'betel',funcoes:[{nome:'Recepção',pessoas:['Pessoa Teste']}]}],avisos:[],eventos:[]};
const mock='window.__DADOS='+JSON.stringify(dados)+';\n'+fs.readFileSync(path.join(__dirname,'mock-supabase.js'),'utf8')+`\n{
const caso=JSON.parse(localStorage.getItem('caso')||'{}');
for (const p of window.__TABELAS.pessoas) { p.status='aprovado'; p.banco=false; if(p.email===caso.email || (caso.email==='admin@x' && p.papel==='admin')){Object.assign(p,caso);p.gestao=true;p.ministro=true;p.avisos=true;p.escala=true;} }
}`;
const server=http.createServer((req,res)=>{
 const url=req.url.split('?')[0];
 if(url.endsWith('supabase-2.117.3.js')){res.setHeader('content-type','text/javascript');return res.end(mock);}
 const f=path.join(pub,url==='/'?'index.html':url);
 if(!f.startsWith(pub)||!fs.existsSync(f)){res.statusCode=404;return res.end();}
 res.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const localChrome=process.env.CHROMIUM_MODULE ? require(process.env.CHROMIUM_MODULE) : null;
 const browser=await chromium.launch(localChrome ? {headless:true,executablePath:await localChrome.executablePath(),args:localChrome.args.filter(a=>a!=='--single-process')} : {headless:true});const errors=[];let checks=0;
 const open=async(role,caso={},hash='inicio')=>{const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(({role,caso})=>{localStorage.setItem('mockPapel',role);localStorage.setItem('tutorialVisto','1');localStorage.setItem('caso',JSON.stringify(caso));},{role,caso});await p.goto(`http://127.0.0.1:${server.address().port}/#${hash}`);await p.waitForSelector('#tabs button');await p.waitForTimeout(250);return p;};
 const check=(v,msg)=>{assert.ok(v,msg);checks++;console.log('ok',msg);};
 try{
 let p=await open('admin',{},'ajustes');const id='00000000-0000-0000-0000-0000000000d7';
 check(await p.locator('th').allTextContents().then(a=>a.includes('Status')),'coluna Status');
 check(await p.inputValue(`[data-p-status="${id}"]`)==='pendente','cadastro novo pendente');
 await p.click('[data-salvar-pessoas]');await p.waitForTimeout(250);
 check(await p.evaluate(id=>window.__TABELAS.pessoas.find(x=>x.id===id).status,id)==='pendente','Salvar não aprova os pendentes automaticamente');
 await p.selectOption(`[data-p-status="${id}"]`,'aprovado');await p.click('[data-salvar-pessoas]');await p.waitForTimeout(250);
 check(await p.inputValue(`[data-p-status="${id}"]`)==='aprovado','aprovação explícita salva e exibida');
 await p.check(`[data-p-banco="${id}"]`);await p.click('[data-salvar-pessoas]');await p.waitForTimeout(250);
 check(await p.evaluate(id=>window.__TABELAS.pessoas.find(x=>x.id===id).banco,id),'Banco salvo');
 await p.click(`[data-rm-pessoa="${id}"]`);await p.click('[data-r="1"]');await p.waitForTimeout(250);
 check(await p.inputValue(`[data-p-status="${id}"]`)==='removido','Removido continua na lista');
 check(await p.evaluate(id=>!!window.__TABELAS.cadastros.find(x=>x.id===id)&&window.__TABELAS.pessoas.find(x=>x.id===id).nome==='Maria Pendente',id),'remoção preserva cadastro e nome');
 await p.selectOption(`[data-p-status="${id}"]`,'aprovado');await p.click('[data-salvar-pessoas]');await p.waitForTimeout(250);
 check(await p.inputValue(`[data-p-status="${id}"]`)==='aprovado','reativação explícita');
 await p.screenshot({path:'/tmp/painel-status-mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1000});await p.locator('table.lead').screenshot({path:'/tmp/painel-status-tabela.png'});await p.context().close();
 for(const role of ['admin','betel','flechas','gestao','escala']){
 p=await open(role,{email:role+'@x',banco:true},'escala');await p.setViewportSize({width:1440,height:1000});
 check(await p.locator('[data-importar],[data-esc-novo],[data-exp],[data-per],[data-ck-pdf],[data-ck-xls]').count()===0,role+': Banco sem importar/exportar');
 check(await p.locator('#tabs [data-tab="ajustes"],#tabs [data-tab="historico"]').count()===0,role+': Banco sem administração');
 await p.locator('button.cell:not(.vazio)').first().click();
 check(await p.locator('[data-esc]').count()===0,role+': Banco sem editar escala');
 await p.click('#tabs [data-tab="avisos"]');check(await p.locator('[data-novo-aviso],[data-edit-aviso]').count()===0,role+': Banco sem publicar');
 await p.click('[data-chat]');check(await p.locator('#chatForm,[data-apagar-msg]').count()===0,role+': Banco lê chat sem escrever/excluir');
 await p.context().close();
 }
 for(const status of ['pendente','removido']){
 p=await open('admin',{email:'admin@x',status},'ajustes');
 check(await p.locator('#tabs [data-tab="ajustes"],[data-chat],[data-dia-csv],[data-dia-ficha]').count()===0,status+': privilégios revogados mesmo com papel admin');await p.context().close();
 }
 p=await open('betel',{},'escala');await p.setViewportSize({width:1440,height:1000});await p.locator('button.cell:not(.vazio)').first().click();check(await p.locator('[data-esc]').count()===1,'líder aprovado mantém edição da própria conexão');await p.context().close();
 check(errors.length===0,'sem erros JavaScript: '+errors.join(';'));
 console.log(checks+' verificações passaram.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
