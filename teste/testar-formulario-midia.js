/* Testa o Formulário da Mídia no navegador (celular) com o banco de TESTE local.
   O envio passa pela função real do banco (enviar_formulario_midia) num Postgres local:
   antes, rode  PGHOST=localhost PGUSER=postgres PGPASSWORD=... sh supabase/testes/rodar.sh  (cria o banco painel_teste).
   Uso: PGHOST=localhost PGUSER=postgres PGPASSWORD=... node teste/testar-formulario-midia.js [pasta-das-capturas] */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), PUB = path.join(RAIZ, 'public');
const SAIDA = process.argv[2] || path.join(RAIZ, 'teste', 'capturas');
fs.mkdirSync(SAIDA, { recursive: true });
const psql = (sql, vars = {}) => execFileSync('psql', ['-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-d', 'painel_teste',
  ...Object.entries(vars).flatMap(([k, v]) => ['-v', k + '=' + v])], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const json = sql => JSON.parse(psql('select coalesce(json_agg(x), \'[]\') from (' + sql + ') x'));

psql('delete from formulario_midia_respostas; delete from formulario_midia_envios;');
const CONFIG = JSON.parse(psql("select d from config where id='geral'"));
const DADOS = { config: CONFIG, escalas: [], avisos: [], eventos: [], fm: {} };
const lerFM = () => {
  DADOS.fm.formulario_midia_conhecimentos = json('select * from formulario_midia_conhecimentos order by ordem');
  DADOS.fm.formulario_midia_ministerios = json('select * from formulario_midia_ministerios order by ordem');
  DADOS.fm.formulario_midia_respostas = json('select * from formulario_midia_respostas order by enviado_em desc');
};
lerFM();
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (u === '/__rpc') { let b = ''; req.on('data', c => b += c); req.on('end', () => {
      let out;
      try { out = { data: psql("set role anon; select enviar_formulario_midia(:'p'::jsonb)", { p: b }), error: null }; }
      catch (e) { const m = String(e.stderr || '').match(/ERROR:\s+(.*)/); out = { data: null, error: { message: m ? m[1].trim() : 'erro' } }; }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out)); }); return; }
  if (u.endsWith('/vendor/supabase-2.117.3.js')) { res.writeHead(200, {'content-type':'text/javascript'});
    return res.end('window.__DADOS = ' + JSON.stringify(DADOS) + ';\n' + fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8')); }
  let f = path.join(PUB, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': TIPOS[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
});
let falhas = 0, ok = 0;
const conferir = (cond, msg) => { if (cond) { ok++; console.log('  ok  ' + msg); } else { falhas++; console.log('  FALHOU  ' + msg); } };
const hojeMenos = anos => { const d = new Date(new Date().toLocaleDateString('en-CA', {timeZone:'America/Sao_Paulo'}) + 'T12:00:00'); d.setFullYear(d.getFullYear() - anos); return d.toISOString().slice(0, 10); };

(async () => {
  await new Promise(r => srv.listen(8124, r));
  const browser = await chromium.launch();
  const nova = async (papel, url) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await ctx.newPage(); page.erros = [];
    page.on('pageerror', e => page.erros.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test((m.location()||{}).url || '')) page.erros.push(m.text() + ' ' + ((m.location()||{}).url || '')); });
    await page.addInitScript(([p]) => { try { if (p) localStorage.setItem('mockPapel', p); localStorage.setItem('tutorialVisto', '1'); } catch(e){} }, [papel]);
    await page.goto('http://localhost:8124' + url);
    return page;
  };
  const foto = (p, n) => p.screenshot({ path: path.join(SAIDA, n + '.png'), fullPage: true });
  const etapa = p => p.textContent('.fm-prog b');
  const erros = p => p.$$eval('.fm-erro', es => es.map(e => e.textContent).filter(Boolean));
  const proximo = async p => { await p.click('[data-proximo]'); await p.waitForTimeout(120); };
  const marcar = (p, nome, valor) => p.click('input[name="' + nome + '"][value="' + valor + '"] >> xpath=..');
  async function etapas123(p, d){
    await p.fill('#nome', d.nome); await p.fill('#nascimento', d.nascimento); await p.fill('#email', d.email); await p.fill('#whatsapp', d.whatsapp);
    await proximo(p);
    for (const c of DADOS.fm.formulario_midia_conhecimentos.filter(c => c.ativo)) await marcar(p, 'c_' + c.id, (d.niveis || {})[c.nome] || 'basico');
    await proximo(p);
    for (const f of d.funcoes) await marcar(p, 'funcoes', f);
    for (const x of d.disp) await marcar(p, 'disponibilidade', x);
    await marcar(p, 'iphone', d.iphone ? 'sim' : 'nao');
    await proximo(p);
  }

  console.log('Formulário — etapa 1 vazia e menor de 14 anos');
  let p = await nova(null, '/formulario-midia/');
  await p.waitForSelector('.fm-prog');
  conferir((await etapa(p)).includes('Etapa 1 de 4'), 'mostra "Etapa 1 de 4"');
  conferir(!(await p.$('[data-voltar]')), 'sem botão Voltar na etapa 1');
  await proximo(p);
  conferir((await erros(p)).length === 4 && (await etapa(p)).includes('Etapa 1'), 'campos vazios: 4 avisos vermelhos e não avança');
  conferir(await p.$eval('[data-campo="nome"]', e => getComputedStyle(e.querySelector('.fm-erro')).color === 'rgb(255, 92, 92)'), 'aviso em vermelho embaixo do campo');
  await foto(p, 'fm-01-vazio');
  await p.fill('#nome', 'Maria Teste'); await p.fill('#nascimento', hojeMenos(13)); await p.fill('#email', 'maria@'); await p.fill('#whatsapp', '119888');
  await proximo(p);
  const e1 = await erros(p);
  conferir(e1.includes('É preciso ter 14 anos ou mais para preencher este formulário.'), 'menor de 14: mensagem e bloqueio');
  conferir(e1.some(x => /e-mail válido/.test(x)) && e1.some(x => /DDD/.test(x)), 'e-mail inválido e WhatsApp sem DDD avisados');
  conferir(await p.inputValue('#whatsapp') === '(11) 9888', 'WhatsApp com máscara (11) ...');
  await foto(p, 'fm-02-menor-14');
  const r14 = await p.evaluate(async d => (await fetch('/__rpc', {method:'POST', body:JSON.stringify(d)})).json(), {nome:'X Y', nascimento:hojeMenos(13), email:'x@x.com', whatsapp:'11988887777'});
  conferir(r14.error && r14.error.message === 'É preciso ter 14 anos ou mais para preencher este formulário.', 'banco também bloqueia menor de 14 (mesmo burlando a tela)');

  console.log('Envio com "Não" em outros ministérios');
  await p.fill('#nascimento', '2000-05-10'); await p.fill('#email', 'maria@x.com'); await p.fill('#whatsapp', '11988887777');
  await proximo(p);
  conferir((await etapa(p)).includes('Etapa 2 de 4'), 'avança para a etapa 2');
  await proximo(p);
  conferir((await erros(p)).length === DADOS.fm.formulario_midia_conhecimentos.length, 'conhecimentos sem nível: aviso em cada um (' + DADOS.fm.formulario_midia_conhecimentos.length + ')');
  await foto(p, 'fm-03-conhecimentos-vazio');
  await p.click('[data-voltar]');
  conferir((await etapa(p)).includes('Etapa 1') && await p.inputValue('#nome') === 'Maria Teste', 'Voltar mantém o que foi preenchido');
  await proximo(p);
  for (const c of DADOS.fm.formulario_midia_conhecimentos) await marcar(p, 'c_' + c.id, c.nome === 'ATEM' ? 'avancado' : c.nome === 'OBS' ? 'intermediario' : 'basico');
  await foto(p, 'fm-04-conhecimentos');
  await proximo(p);
  conferir((await etapa(p)).includes('Etapa 3 de 4'), 'avança para a etapa 3');
  await proximo(p);
  conferir((await erros(p)).length === 3, 'serviço na Mídia vazio: 3 avisos');
  await marcar(p, 'funcoes', 'Projeção'); await marcar(p, 'funcoes', 'Transmissão'); await marcar(p, 'disponibilidade', 'manha'); await marcar(p, 'iphone', 'sim');
  await foto(p, 'fm-05-servico');
  await proximo(p);
  conferir((await etapa(p)).includes('Etapa 4 de 4'), 'avança para a etapa 4');
  await proximo(p);
  conferir((await erros(p)).length === 2, 'conexão e outro ministério vazios: 2 avisos');
  await marcar(p, 'conexao', 'betel'); await marcar(p, 'outro_ministerio', 'nao');
  conferir((await p.textContent('[data-proximo]')) === 'Enviar' && await p.isVisible('input[name=autorizo]'), '"Não": aparece a autorização e o botão Enviar');
  await proximo(p);
  conferir((await erros(p)).some(x => /autorização/.test(x)), 'sem marcar a autorização não envia');
  await marcar(p, 'autorizo', '1');
  await foto(p, 'fm-06-etapa4-nao');
  await proximo(p); await p.waitForSelector('.fm-fim');
  conferir((await p.textContent('.fm-fim')).includes('Recebemos suas informações!') && (await p.textContent('.fm-fim')).includes('Obrigado por querer servir na Mídia da Família Alcançar. 🙏'), 'tela de agradecimento');
  await foto(p, 'fm-07-obrigado');
  conferir(psql("select count(*) from formulario_midia_respostas where email='maria@x.com' and not outro_ministerio and ministerios = '{}' and iphone and conexao='betel'") === '1', 'banco: resposta da Maria gravada (sem outros ministérios)');
  conferir(p.erros.length === 0, 'sem erros no console' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));

  console.log('Envio com "Sim" em outros ministérios');
  p = await nova(null, '/formulario-midia/'); await p.waitForSelector('.fm-prog');
  await etapas123(p, { nome:'João Teste Souza', nascimento:'2010-01-15', email:'joao@x.com', whatsapp:'(11) 97777-6666', funcoes:['Câmera','Apoio'], disp:['manha','noite'], iphone:false });
  await marcar(p, 'conexao', 'flechas'); await marcar(p, 'outro_ministerio', 'sim');
  conferir((await p.textContent('[data-proximo]')) === 'Próximo' && !(await p.$('input[name=autorizo]')), '"Sim": botão Próximo, sem enviar ainda');
  await proximo(p);
  conferir((await etapa(p)).includes('Etapa 4 de 4 · continuação') && (await p.textContent('.fm-etapa h2')) === 'Outros ministérios', 'abre a tela Outros ministérios');
  await proximo(p);
  conferir((await erros(p)).length === 2, 'sem ministério e sem autorização: 2 avisos');
  await marcar(p, 'ministerios', DADOS.fm.formulario_midia_ministerios.find(m => m.nome === 'Som').id);
  await marcar(p, 'ministerios', DADOS.fm.formulario_midia_ministerios.find(m => m.nome === 'Coro').id);
  await marcar(p, 'autorizo', '1');
  await foto(p, 'fm-08-outros-ministerios');
  await proximo(p); await p.waitForSelector('.fm-fim');
  conferir(psql("select cardinality(ministerios) from formulario_midia_respostas where email='joao@x.com' and outro_ministerio") === '2', 'banco: resposta do João com 2 ministérios');

  console.log('Reenvio com o mesmo e-mail');
  p = await nova(null, '/formulario-midia/'); await p.waitForSelector('.fm-prog');
  await etapas123(p, { nome:'Maria Teste', nascimento:'2000-05-10', email:'MARIA@x.com ', whatsapp:'11955554444', funcoes:['Câmera'], disp:['noite'], iphone:true, niveis:{ATEM:'avancado', OBS:'intermediario'} });
  await marcar(p, 'conexao', 'shalom'); await marcar(p, 'outro_ministerio', 'nao'); await marcar(p, 'autorizo', '1');
  await proximo(p); await p.waitForSelector('.fm-fim');
  conferir(psql("select count(*) || ' ' || max(envios) || ' ' || bool_and(atualizado_em is not null) || ' ' || max(conexao) || ' ' || max(array_to_string(funcoes, ',')) from formulario_midia_respostas where email='maria@x.com'") === '1 2 true shalom Câmera',
    'banco: continua 1 resposta da Maria, atualizada (data da atualização guardada, 2 envios)');
  conferir(psql('select count(*) from formulario_midia_respostas') === '2', 'banco: 2 respostas no total');

  console.log('Administrador — tela "Formulário da Mídia"');
  lerFM();
  p = await nova('admin', '/'); await p.waitForSelector('#tabs button').catch(e => { console.log(p.erros); throw e; });
  await p.waitForSelector('.card.atalho');
  conferir(true, 'Início do admin mostra o atalho "Formulário da Mídia"');
  await p.click('.card.atalho'); await p.waitForSelector('.fm-li');
  const linhas = await p.$$eval('.fm-li', ls => ls.map(l => l.textContent));
  const idadeJoao = Math.floor((Date.now() - new Date('2010-01-15T12:00:00')) / 31557600000);
  conferir(linhas.length === 2 && linhas.some(l => l.includes('Maria Teste') && l.includes('Shalom') && l.replace(/\D/g,'').includes('11955554444')) && linhas.some(l => l.includes('João Teste Souza') && l.includes(idadeJoao + ' anos') && l.includes('Flechas')), 'lista com nome, idade, conexão, WhatsApp e data');
  conferir(linhas.every(l => /Enviado em \d\d\/\d\d\/\d{4}/.test(l)) && linhas.some(l => /atualizado em/.test(l)), 'data de envio e de atualização na lista');
  await foto(p, 'fm-09-admin-lista');
  const conta = async () => (await p.$$('.fm-li')).length;
  await p.click('.fm-filtros summary');
  await p.selectOption('[data-fm-f="ministerio"]', DADOS.fm.formulario_midia_ministerios.find(m => m.nome === 'Som').id);
  conferir(await conta() === 1 && (await p.textContent('.fm-lista')).includes('João'), 'filtro por ministério (Som) → só o João');
  await p.click('[data-fm-limpar]');
  await p.selectOption('[data-fm-f="conh"]', DADOS.fm.formulario_midia_conhecimentos.find(c => c.nome === 'ATEM').id);
  conferir(await conta() === 1 && (await p.textContent('.fm-lista')).includes('Maria'), 'ATEM Intermediário ou Avançado → só a Maria');
  await foto(p, 'fm-10-admin-filtro-atem');
  await p.click('[data-fm-nivel="basico"]');
  conferir(await conta() === 2, 'marcando também Básico → os dois');
  await p.click('[data-fm-limpar]');
  await p.selectOption('[data-fm-f="conexao"]', 'flechas'); conferir(await conta() === 1, 'filtro por conexão');
  await p.selectOption('[data-fm-f="conexao"]', ''); await p.selectOption('[data-fm-f="funcao"]', 'Câmera'); conferir(await conta() === 2, 'filtro por função (Câmera → os dois)');
  await p.selectOption('[data-fm-f="funcao"]', 'Apoio'); conferir(await conta() === 1, 'filtro por função (Apoio → só o João)');
  await p.selectOption('[data-fm-f="funcao"]', ''); await p.selectOption('[data-fm-f="disp"]', 'manha'); conferir(await conta() === 1, 'filtro por disponibilidade (manhã)');
  await p.selectOption('[data-fm-f="disp"]', ''); await p.selectOption('[data-fm-f="iphone"]', 'sim'); conferir(await conta() === 1 && (await p.textContent('.fm-lista')).includes('Maria'), 'filtro por iPhone');
  await p.click('[data-fm-limpar]');
  await p.click('.fm-li-b >> text=João Teste Souza'); await p.waitForSelector('#dlg[open]').catch(e => { console.log(p.erros); throw e; });
  const det = await p.textContent('#dlg');
  conferir(['joao@x.com', '15/01/2010', 'Holyrics', 'Câmera, Apoio', 'Domingo manhã, Domingo noite', 'Flechas', 'Coro', 'Som', 'Tem iPhone?'].every(t => det.includes(t)), 'tocar na pessoa mostra todas as respostas');
  await foto(p, 'fm-11-admin-detalhe');
  await p.click('#dlg [data-cancel]');
  await p.click('[data-fm-copiar]');
  conferir(await p.evaluate(() => navigator.clipboard.readText()) === 'http://localhost:8124/formulario-midia/', 'copiar link do formulário');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-fm-excel]')]);
  const arq = path.join(SAIDA, dl.suggestedFilename()); await dl.saveAs(arq);
  conferir(/^formulario-midia-\d{4}-\d\d-\d\d\.xlsx$/.test(dl.suggestedFilename()) && fs.statSync(arq).size > 4000, 'exporta Excel (' + dl.suggestedFilename() + ')');
  await p.click('[data-fm-listas]'); await p.waitForSelector('[data-fm-add="conh"]');
  conferir((await p.$$('[data-fm-nome^="conh|"]')).length === 12 && (await p.$$('[data-fm-nome^="mins|"]')).length === 6, 'editar listas: 12 conhecimentos e 6 ministérios');
  await p.fill('#fmNovo_conh', 'Premiere'); await p.click('[data-fm-add="conh"]'); await p.waitForTimeout(150);
  conferir((await p.$$('[data-fm-nome^="conh|"]')).length === 13, 'admin inclui conhecimento novo');
  await foto(p, 'fm-12-admin-listas');
  conferir(p.erros.length === 0, 'sem erros no console' + (p.erros.length ? ': ' + p.erros.join(' | ') : ''));

  console.log('Quem não é administrador');
  p = await nova('betel', '/#formmidia'); await p.waitForSelector('#tabs button'); await p.waitForTimeout(300);
  conferir(!(await p.$('.fm-li')) && !(await p.$('.card.atalho')) && !(await p.$('[data-fm-copiar]')), 'líder não vê o Formulário da Mídia');

  await browser.close(); srv.close();
  console.log('\n' + ok + ' conferências, ' + falhas + ' falhas');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
