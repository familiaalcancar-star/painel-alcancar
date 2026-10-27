(() => {
/* Painel da Igreja Família Alcançar — versão 2.0 (Supabase).
   Mesma estrutura do painel feito no Claude (referencia/referencia-painel-atual.html);
   a camada de dados agora é o Supabase, e as permissões valem no banco (RLS). */
// Esconde o selo "Powered by Netlify" que o Netlify coloca por cima da página (cobria as abas).
// Qualquer elemento flutuante que não seja do painel, colocado direto no <body>, fica oculto.
(function(){
  const nosso = el => el.matches('.wrap, #tabs, #dlg, #chat, .toast, [role="dialog"], script, style, link, noscript');
  const esconder = () => [...document.body.children].forEach(el => {
    if (nosso(el)) return;
    const pos = getComputedStyle(el).position;
    if (/netlify/i.test(el.tagName + ' ' + el.id + ' ' + (typeof el.className === 'string' ? el.className : '')) || pos === 'fixed' || pos === 'sticky' || el.tagName === 'IFRAME')
      el.style.setProperty('display', 'none', 'important');
  });
  esconder(); new MutationObserver(esconder).observe(document.body, {childList:true});
})();
const sb = window.supabase.createClient(window.PAINEL.url, window.PAINEL.chave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
});
const S = { pronto:false, sessao:undefined, uid:null, email:'', cfg:null, cfgLoaded:false, pessoas:{}, cadastros:{}, meuCad:null, membros:[], emails:{}, whatsAdm:'',
  prox:[], mesEsc:[], avisos:[], eventos:[], names:{}, tab:'inicio', filtro:'todas',
  mes: new Date().toISOString().slice(0,7) };
const TABS = [
  {id:'inicio', label:'Início', ic:'🏠'}, {id:'escala', label:'Escala', ic:'📋'}, {id:'avisos', label:'Avisos', ic:'📣'},
  {id:'agenda', label:'Agenda', ic:'📅'}, {id:'checkin', label:'Check-in', ic:'✅', gestao:true}, {id:'historico', label:'Histórico', ic:'🕘', owner:true},
  {id:'ajustes', label:'Ajustes', ic:'⚙️', owner:true}, {id:'ajuda', label:'Ajuda', ic:'❓', hidden:true}];
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'x';
const fmtDia = d => new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
const fmtCurto = d => new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
const fmtQuando = iso => new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const isoLocal = d => { const x=new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); };
const hoje = () => isoLocal(new Date());
const somaDias = (iso, n) => { const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return isoLocal(d); };
const primeiro = s => String(s||'').trim().split(/\s+/)[0] || '';
const nome = id => { const p = S.pessoas[id] || {}, c = (S.cadastros || {})[id] || {}, n = S.names[id] || {}; return p.apelido || n.apelido || c.apelido || primeiro(p.nome || n.nome || c.nome) || S.emails[id] || 'Alguém'; };
const nomeComp = id => { const p = S.pessoas[id] || {}, c = (S.cadastros || {})[id] || {}, x = S.names[id] || {}; const n = p.nome || c.nome || x.nome || S.emails[id] || 'Alguém', a = p.apelido || c.apelido || x.apelido; return a && a !== n ? n+' ('+a+')' : n; };
function confirmar(msg){ return new Promise(ok => {
  const o = document.createElement('div'); o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true');
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px';
  o.innerHTML = '<div style="background:#161616;color:#f2f2f2;border:1px solid #333;border-radius:14px;max-width:420px;width:100%;padding:20px;font:15px/1.45 inherit"><p style="margin:0 0 18px;white-space:pre-line">'+esc(msg)+'</p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-r="0">Cancelar</button><button class="btn danger" data-r="1">Confirmar</button></div></div>';
  o.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b && e.target !== o) return; e.stopPropagation(); o.remove(); ok(!!b && b.dataset.r === '1'); });
  document.body.appendChild(o); o.querySelector('[data-r="1"]').focus();
}); }
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3200); }

/* ---------- configuração ---------- */
const byNome = (a,b) => a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'});
const conexoes = () => ((S.cfg && S.cfg.conexoes) || []).slice().sort(byNome);
const cultos = () => (S.cfg && S.cfg.cultos) || [];
const ehLouvor = n => /^louvor$/i.test(String(n||'').trim());
const areas = () => { const l = (S.cfg && S.cfg.areas) || []; return [...l.filter(a => !ehLouvor(a.nome)), ...l.filter(a => ehLouvor(a.nome))]; };
const semLouvor = rows => rows.filter(r => !ehLouvor(r.area));
const diasCulto = () => (S.cfg && S.cfg.diasCulto) || [0];
const conexaoNome = id => (conexoes().find(c=>c.id===id)||{}).nome || '';
const conexoesDe = x => !x ? [] : (x.conexoes && x.conexoes.length ? x.conexoes : (x.conexao ? [x.conexao] : []));
const conexoesTxt = x => conexoesDe(x).map(conexaoNome).filter(Boolean).join(' e ');
const cultoInfo = id => cultos().find(c=>c.id===id) || {id, nome:id, hora:''};
const areaInfo = id => areas().find(a=>a.id===id) || {id, nome:id, porConexao:false, funcoes:[{nome:'Equipe',vagas:0}]};
const PAPEIS = {admin:'Administrador', lider:'Líder', auxiliar:'Auxiliar', organizacao:'Organização', leitura:'Só consulta'};
const pendentes = () => Object.keys(S.cadastros||{}).filter(id => !S.pessoas[id]);
const ADM_WPP = () => (S.whatsAdm || '5511958800779').replace(/\D/g,'');
const ehEquipe = p => !!p && ['lider','auxiliar','organizacao'].includes(p.papel);
const pessoaDe = id => (id && S.pessoas[id]) || null;
const isAdm = () => (pessoaDe(S.uid)||{}).papel === 'admin';
const minhas = () => { const p = pessoaDe(S.uid); return p && ehEquipe(p) && p.conexao ? [p.conexao] : []; };
const podeConexao = cid => isAdm() || minhas().includes(cid);
const LOUVOR_CON = ['flechas','forasteiros','herois'];
const semAcento = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toLowerCase();
const podeLouvor = () => { const p = pessoaDe(S.uid); return ehEquipe(p) && LOUVOR_CON.includes(semAcento(conexaoNome(p.conexao))); };
const temGestao = () => isAdm() || !!(pessoaDe(S.uid)||{}).gestao;
const temMinistro = () => !!(pessoaDe(S.uid)||{}).ministro;
const temEscala = () => !!(pessoaDe(S.uid)||{}).escala;
const podeArea = (a, x) => isAdm() || (ehLouvor(a.nome) && (podeLouvor() || temMinistro())) || (a.porConexao && !!x && (temEscala() || conexoesDe(x).some(c => minhas().includes(c))));
const temAvisos = () => isAdm() || !!(pessoaDe(S.uid)||{}).avisos;
const papelTexto = () => { if (!S.uid) return 'Somente visualização'; if (isAdm()) return 'Administrador'; const p = pessoaDe(S.uid);
  if (ehEquipe(p)) return PAPEIS[p.papel]+' · Conexão '+conexaoNome(p.conexao);
  if (!p && S.meuCad) return 'Cadastro aguardando aprovação'; return 'Modo leitura'; };

/* ---------- banco (Supabase) ---------- */
const doRow = r => ({...(r.d||{}), id:r.id, ...(r.autor !== undefined ? {autor:r.autor} : {})});
const tirarMeta = o => { if (!o) return o; const {id, autor, ...r} = o; return r; };
const novoId = p => p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
// "ref" imita o jeito antigo (db.doc('tabela/id')) para o resto do código continuar igual.
const ref = (tabela, id) => ({ tabela, id,
  async set(d){
    if (tabela === 'config') { const {pessoas, ...resto} = d; d = resto; }
    const corpo = tirarMeta(d);
    const up = await sb.from(tabela).update({d:corpo}).eq('id', id).select('id');
    if (up.error) throw up.error;
    if (up.data && up.data.length) return;
    const ins = await sb.from(tabela).insert({id, d:corpo});
    if (ins.error) throw ins.error;
  },
  async delete(){
    const r = await sb.from(tabela).delete().eq('id', id).select('id');
    if (r.error) throw r.error;
    if (!r.data || !r.data.length) throw {code:'42501'};
  }});
async function logar(acao, tipo, resumo, antes, depois){
  const limpa = o => { if (!o) return null; const {img, ...r} = o; return r; };
  try { const r = await sb.from('historico').insert({acao, tipo, resumo, antes:limpa(antes), depois:limpa(depois)}); if (r.error) console.warn('log', r.error); }
  catch(e){ console.warn('log', e); }
}
async function salvar(r, data, ctx){
  try { await r.set(data); await logar(ctx.acao, ctx.tipo, ctx.resumo, ctx.antes, data); return true; }
  catch(e){ falhaEscrita(e); return false; }
}
async function excluir(r, antes, tipo, resumo){
  try { await r.delete(); await logar('excluiu', tipo, resumo, antes, null); return true; }
  catch(e){ falhaEscrita(e); return false; }
}
function falhaEscrita(e){
  console.warn(e);
  const msg = String((e && (e.message || e.code)) || '');
  if (!S.uid) toast('Toque em Entrar para poder salvar.');
  else if (/42501|row-level security|permission|travados/i.test(msg)) toast(/travados/.test(msg) ? 'Data, culto, área e conexão só podem ser trocados por um administrador.' : 'Sem permissão para salvar isso. Fale com um administrador.');
  else if (/Failed to fetch|NetworkError|network/i.test(msg)) toast('Sem internet no momento. Tente de novo em instantes.');
  else toast('Não foi possível salvar agora. Tente de novo em instantes.');
}
const semId = o => { const {id, ...r} = o; return r; };

/* ---------- carregamento ---------- */
async function carregarConfig(){
  const [c, p] = await Promise.all([sb.from('config').select('d').eq('id','geral').maybeSingle(),
    S.uid ? sb.from('config_privada').select('d').eq('id','geral').maybeSingle() : Promise.resolve({data:null})]);
  if (c.error) console.warn(c.error);
  S.cfg = c.data ? c.data.d : null; S.cfgLoaded = true;
  S.whatsAdm = (p.data && p.data.d && p.data.d.whatsAdm) || '';
  $('#churchName').textContent = (S.cfg && S.cfg.igreja) || 'Painel da Igreja';
}
async function carregarPessoas(){
  if (!S.uid) { S.pessoas = {}; S.cadastros = {}; S.meuCad = null; S.names = {}; S.membros = []; S.emails = {}; return; }
  const [p, c, n] = await Promise.all([sb.from('pessoas').select('*'), sb.from('cadastros').select('*'), sb.rpc('pessoas_nomes')]);
  S.pessoas = {}; (p.data||[]).forEach(x => S.pessoas[x.id] = x);
  S.cadastros = {}; (c.data||[]).forEach(x => S.cadastros[x.id] = x); S.meuCad = S.cadastros[S.uid] || null;
  S.names = {}; (n.data||[]).forEach(x => S.names[x.id] = x);
  if (isAdm()) { const a = await sb.from('acessos').select('id,email'); S.membros = (a.data||[]).map(x => x.id); S.emails = {}; (a.data||[]).forEach(x => S.emails[x.id] = x.email); }
  else { S.membros = []; S.emails = {}; }
  if (S.email) S.emails[S.uid] = S.email;
}
const linhas = r => { if (r.error) console.warn(r.error); return (r.data||[]).map(doRow); };
async function carregarProx(){ S.prox = linhas(await sb.from('escalas').select('id,d').gte('data', hoje()).order('data').limit(400)); }
async function carregarMes(){ const m = S.mes; const l = linhas(await sb.from('escalas').select('id,d').gte('data', m+'-01').lte('data', m+'-31').order('data')); if (m === S.mes) S.mesEsc = l; }
async function carregarAvisos(){ S.avisos = linhas(await sb.from('avisos').select('id,d,autor').order('criado_em', {ascending:false}).limit(60)); }
async function carregarEventos(){ S.eventos = linhas(await sb.from('eventos').select('id,d,autor').order('data').limit(300)); }
function assinarMes(){ carregarMes().then(render); }
async function carregarPrivado(){ await Promise.all([carregarPessoas(), carregarConfig()]); await carregarChat(); if (!podeChat()) fecharChat(); renderWho(); renderTabs(); render(); }

// Tempo real: quando algo muda no banco, recarrega só aquela parte.
const RECARGA = {
  config: () => carregarConfig(), pessoas: () => carregarPessoas(), cadastros: () => carregarPessoas(),
  escalas: () => Promise.all([carregarProx(), carregarMes(), S.ckD ? ckCarregarDocs() : null]),
  avisos: () => carregarAvisos(), eventos: () => carregarEventos(), checkin_marcas: () => S.ckD ? ckCarregarMarcas() : null,
  chat: () => carregarChat().then(chatAtualizado) };
const pendRecarga = {};
function agendarRecarga(tabela){
  if (!RECARGA[tabela]) return; clearTimeout(pendRecarga[tabela]);
  pendRecarga[tabela] = setTimeout(async () => { try { await RECARGA[tabela](); } catch(e){ console.warn(e); } renderTabs(); render(); }, 300);
}
let canal = null;
function assinarTempoReal(){
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('painel').on('postgres_changes', {event:'*', schema:'public'}, p => agendarRecarga(p.table)).subscribe();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.pronto) Object.keys(RECARGA).forEach(agendarRecarga); });

/* ---------- login ---------- */
function renderWho(){
  const w = $('#who'); if (!w) return;
  const n = podeChat() ? naoLidas() : 0;
  w.innerHTML = S.uid ? (podeChat() ? '<button class="chat-btn" data-chat>💬 Bate-papo'+(n ? '<span class="badge">'+(n > 99 ? '99+' : n)+'</span>' : '')+'</button>' : '')
      + '<span class="eu"><span>'+esc(nome(S.uid) === 'Alguém' ? S.email : nome(S.uid))+'</span><button class="sair" data-sair>Sair</button></span>'
    : '<button class="entrar" data-entrar>Entrar</button>';
}
const urlVolta = () => location.origin + location.pathname;
const IC_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.7 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
// Mensagens do Supabase em português.
function erroLogin(e){
  const m = String((e && (e.code || '')) + ' ' + (e && e.message || '')).toLowerCase();
  if (/invalid_credentials|invalid login/.test(m)) return 'E-mail ou senha incorretos.';
  if (/email_not_confirmed|not confirmed/.test(m)) return 'Falta confirmar o e-mail: toque no link que enviamos (veja também o spam).';
  if (/user_already_exists|already registered/.test(m)) return 'Já existe uma conta com esse e-mail. Use Entrar ou Esqueci minha senha.';
  if (/weak_password|password should|at least/.test(m)) return 'A senha precisa ter pelo menos 8 caracteres, misturando letras e números.';
  if (/same_password|different from the old/.test(m)) return 'A nova senha precisa ser diferente da anterior.';
  if (/rate|limit|seconds|too many/.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/provider is not enabled|unsupported provider/.test(m)) return 'O login com Google ainda não foi ativado. Use e-mail e senha.';
  if (/signup.*disabled|signups not allowed/.test(m)) return 'A criação de contas está desligada no momento.';
  if (/fetch|network/.test(m)) return 'Sem internet no momento. Tente de novo em instantes.';
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}
function aviso(titulo, html){
  abrir('<form><h2>'+titulo+'</h2><div class="notice" style="margin:0">'+html+'</div><div class="end"><button type="button" class="btn ghost" data-cancel>Fechar</button><button type="submit" class="btn">Entendi</button></div></form>', async () => true);
}
function formLogin(email){
  abrir('<form id="loginForm"><h2>Entrar</h2><p class="meta" style="margin:0">Só quem vai preencher escalas, publicar avisos, fazer check-in ou usar o bate-papo precisa entrar. Para só consultar, não precisa.</p>'
    + '<button type="button" class="btn-google" data-google>'+IC_G+'<span>Continuar com Google</span></button>'
    + '<div class="ou">ou entre com e-mail e senha</div>'
    + '<label class="f" for="lE">E-mail</label><input class="inp" id="lE" name="email" type="email" required autocomplete="username" inputmode="email" placeholder="voce@exemplo.com" value="'+esc(email||'')+'">'
    + '<label class="f" for="lS">Senha</label><input class="inp" id="lS" name="senha" type="password" required autocomplete="current-password">'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Entrar</button></div>'
    + '<div class="login-links"><button type="button" class="link" data-criar-conta>Criar conta</button><button type="button" class="link" data-esqueci>Esqueci minha senha</button></div></form>',
  async fd => {
    const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email')||'').trim().toLowerCase(), password: String(fd.get('senha')||'') });
    if (error) { console.warn(error); toast(erroLogin(error)); return false; }
    return true;
  });
}
function formCriarConta(email){
  abrir('<form><h2>Criar conta</h2><p class="meta" style="margin:0">Se você tem Gmail, é mais fácil usar <b>Continuar com Google</b>, sem criar senha.</p>'
    + '<label class="f" for="cE">E-mail</label><input class="inp" id="cE" name="email" type="email" required autocomplete="username" inputmode="email" value="'+esc(email||'')+'">'
    + '<label class="f" for="cS">Crie uma senha</label><input class="inp" id="cS" name="senha" type="password" required minlength="8" autocomplete="new-password">'
    + '<label class="f" for="cS2">Repita a senha</label><input class="inp" id="cS2" name="senha2" type="password" required minlength="8" autocomplete="new-password"><p class="hint">Pelo menos 8 caracteres, misturando letras e números.</p>'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Criar conta</button></div>'
    + '<div class="login-links"><button type="button" class="link" data-voltar-login>Já tenho conta</button></div></form>',
  async fd => {
    const em = String(fd.get('email')||'').trim().toLowerCase(), s = String(fd.get('senha')||'');
    if (s !== String(fd.get('senha2')||'')) { toast('As duas senhas não estão iguais.'); return false; }
    if (s.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.'); return false; }
    const { data, error } = await sb.auth.signUp({ email: em, password: s, options: { emailRedirectTo: urlVolta() } });
    if (error) { console.warn(error); toast(erroLogin(error)); return false; }
    if (data && data.session) return true;
    if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) { toast(erroLogin({code:'user_already_exists'})); return false; }
    setTimeout(() => aviso('Confirme seu e-mail', 'Enviamos um e-mail para <b>'+esc(em)+'</b>. Toque no link dele para ativar a conta e depois entre com seu e-mail e senha.<br><br>Pode levar alguns minutos; confira também a caixa de spam.'), 0);
    return true;
  });
}
function formEsqueci(email){
  abrir('<form><h2>Esqueci minha senha</h2><p class="meta" style="margin:0">Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</p>'
    + '<label class="f" for="rE">E-mail</label><input class="inp" id="rE" name="email" type="email" required autocomplete="username" inputmode="email" value="'+esc(email||'')+'">'
    + '<p class="hint">Se você entra com o Google, não precisa de senha: use <b>Continuar com Google</b>.</p>'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Enviar link</button></div></form>',
  async fd => {
    const em = String(fd.get('email')||'').trim().toLowerCase();
    const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: urlVolta() });
    if (error) { console.warn(error); toast(erroLogin(error)); return false; }
    setTimeout(() => aviso('Confira seu e-mail', 'Se existir uma conta com <b>'+esc(em)+'</b>, enviamos um link para criar uma senha nova. Abra o e-mail <b>neste mesmo aparelho</b> e toque no link.<br><br>Confira também a caixa de spam.'), 0);
    return true;
  });
}
function formNovaSenha(){
  abrir('<form><h2>Criar senha nova</h2>'
    + '<label class="f" for="nS">Senha nova</label><input class="inp" id="nS" name="senha" type="password" required minlength="8" autocomplete="new-password">'
    + '<label class="f" for="nS2">Repita a senha nova</label><input class="inp" id="nS2" name="senha2" type="password" required minlength="8" autocomplete="new-password"><p class="hint">Pelo menos 8 caracteres, misturando letras e números.</p>'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Agora não</button><button type="submit" class="btn">Salvar senha</button></div></form>',
  async fd => {
    const s = String(fd.get('senha')||'');
    if (s !== String(fd.get('senha2')||'')) { toast('As duas senhas não estão iguais.'); return false; }
    if (s.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.'); return false; }
    const { error } = await sb.auth.updateUser({ password: s });
    if (error) { console.warn(error); toast(erroLogin(error)); return false; }
    toast('Senha nova salva. Você já está conectado.'); return true;
  }, body => body.querySelector('#nS').focus());
}
const emailDoForm = () => { const i = document.querySelector('#dlg input[type=email]'); return i ? i.value.trim() : ''; };
document.addEventListener('click', async e => {
  if (e.target.closest('[data-google]')) {
    const b = e.target.closest('[data-google]'); b.disabled = true;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: urlVolta(), queryParams: { prompt: 'select_account' } } });
    if (error) { console.warn(error); toast(erroLogin(error)); b.disabled = false; }
  }
  if (e.target.closest('[data-criar-conta]')) formCriarConta(emailDoForm());
  if (e.target.closest('[data-esqueci]')) formEsqueci(emailDoForm());
  if (e.target.closest('[data-voltar-login]')) formLogin(emailDoForm());
});
// Erros que voltam no endereço depois do Google ou de um link de e-mail.
function erroNaUrl(){
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  const cod = q.get('error_code') || h.get('error_code') || q.get('error') || h.get('error');
  if (!cod) return;
  history.replaceState(null, '', location.pathname + '#' + S.tab);
  toast(/expired|otp/.test(cod) ? 'Esse link venceu ou já foi usado. Peça outro.' : /access_denied/.test(cod) ? 'O login foi cancelado.' : 'Não foi possível entrar. Tente de novo.');
}
document.addEventListener('click', async e => {
  if (e.target.closest('[data-entrar]')) formLogin();
  if (e.target.closest('[data-sair]') && await confirmar('Sair da sua conta neste aparelho?')) { await sb.auth.signOut(); }
});
async function aplicarSessao(session){
  const uid = session ? session.user.id : null;
  if (uid === S.sessao) return;
  S.sessao = uid; S.uid = uid; S.email = session ? (session.user.email||'') : '';
  S.nomeConta = session ? ((session.user.user_metadata||{}).full_name || (session.user.user_metadata||{}).name || '') : '';
  if (uid) {
    try { await sb.from('acessos').upsert({id:uid, email:S.email, visto:new Date().toISOString()}); } catch(e){}
    try { if (!localStorage.getItem('tutorialVisto')) { S.tab = 'ajuda'; localStorage.setItem('tutorialVisto', '1'); } } catch(e){}
  } else if (!TABS.some(t => t.id===S.tab && !t.owner && !t.gestao)) S.tab = 'inicio';
  histCache = null;
  if (!uid) { fecharChat(); CHAT.msgs = []; }
  if (S.pronto) await carregarPrivado();
}

/* ---------- inicialização ---------- */
async function init(){
  const h = location.hash.slice(1); if (TABS.some(t=>t.id===h)) S.tab = h;
  renderTabs(); renderWho();
  const { data } = await sb.auth.getSession();
  await aplicarSessao(data.session);
  sb.auth.onAuthStateChange((ev, session) => { setTimeout(() => aplicarSessao(session), 0); if (ev === 'PASSWORD_RECOVERY') setTimeout(formNovaSenha, 600); });
  erroNaUrl();
  try { await carregarConfig(); S.mes = proxCulto().slice(0,7);
    await Promise.all([carregarPessoas(), carregarProx(), carregarMes(), carregarAvisos(), carregarEventos()]); await carregarChat(); }
  catch(e){ console.warn(e); }
  S.pronto = true;
  if (/access_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#' + S.tab);
  renderWho(); renderTabs(); render();
  assinarTempoReal();
}

/* ---------- cultos ---------- */
function horaPassou(dataIso, hora){
  if (dataIso !== hoje() || !hora) return false;
  const m = String(hora).match(/(\d{1,2})(?:\s*[:h]\s*(\d{2}))?/); if (!m) return false;
  const fim = new Date(); fim.setHours(Number(m[1])+2, Number(m[2]||0), 0, 0);
  return new Date() > fim;
}
function listaCultos(ini, fim, escalas){
  const set = new Map();
  for (let d = ini; d <= fim; d = somaDias(d,1)) {
    if (diasCulto().includes(new Date(d+'T12:00:00').getDay())) cultos().forEach(c => set.set(d+'_'+c.id, {data:d, culto:c.id}));
  }
  escalas.forEach(x => { if (x.data>=ini && x.data<=fim) set.set(x.data+'_'+x.culto, {data:x.data, culto:x.culto}); });
  const ord = id => { const i = cultos().findIndex(c=>c.id===id); return i<0?99:i; };
  return [...set.values()].sort((a,b) => a.data===b.data ? ord(a.culto)-ord(b.culto) : a.data.localeCompare(b.data));
}
const escalaDe = (lista, data, culto, area) => lista.find(x => x.data===data && x.culto===culto && x.area===area);
const docId = (data, culto, area) => data+'_'+culto+'_'+area;

function blocoArea(lista, c, a){
  const x = escalaDe(lista, c.data, c.culto, a.id);
  const pode = podeArea(a, x);
  let resumo;
  if (a.porConexao) resumo = conexoesDe(x).length ? (conexoesDe(x).length>1?'Conexões ':'Conexão ')+esc(conexoesTxt(x)) : '<span class="pend">A definir</span>';
  else { const n = x ? (x.funcoes||[]).reduce((s,f)=>s+(f.pessoas||[]).length,0) : 0; resumo = n ? (a.funcoes.length===1 && n<=2 ? esc((x.funcoes[0].pessoas||[]).join(' e ')) : 'Ver equipe ('+n+')') : (x && x.obs ? esc(x.obs) : '<span class="pend">A definir</span>'); }
  const fx = a.funcoes.map(f => {
    const salvo = x ? ((x.funcoes||[]).find(g=>g.nome===f.nome)||{}).pessoas || [] : [];
    const total = f.vagas ? Math.max(f.vagas, salvo.length) : salvo.length;
    if (!total) return '';
    const nomes = total ? Array.from({length:total}, (_,i) => salvo[i] ? esc(salvo[i]) : '<span class="pend">vaga aberta</span>').join(', ') : '<span class="pend">ninguém escalado</span>';
    return '<p class="fn"><b>'+esc(f.nome)+(f.vagas?' · '+f.vagas+(f.vagas>1?' pessoas':' pessoa'):'')+'</b>'+nomes+'</p>';
  }).join('') + (x && x.obs ? '<p class="fn"><b>Observação</b>'+esc(x.obs)+'</p>' : '')
    + (pode ? '<button class="link" data-esc="'+esc(docId(c.data,c.culto,a.id))+'" data-d="'+c.data+'" data-c="'+esc(c.culto)+'" data-a="'+esc(a.id)+'">'+(x?'Editar escala':'Preencher escala')+'</button>' : '');
  return '<details class="area"><summary><span><span class="an">'+esc(a.nome)+'</span><span class="ac">'+resumo+'</span></span><span class="chev" aria-hidden="true">›</span></summary><div class="fx">'+fx+'</div></details>';
}
const blocosCulto = (lista, c) => '<div class="areas">'+areas().map(a => blocoArea(lista, c, a)).join('')+'</div>';
const cultoTitulo = c => { const i = cultoInfo(c.culto); return 'Culto da '+i.nome.toLowerCase()+(i.hora?' · '+i.hora:''); };

/* ---------- navegação ---------- */
function renderTabs(){
  $('#tabs').innerHTML = TABS.filter(t=>!t.hidden && (!t.owner || isAdm()) && (!t.gestao || temGestao())).map(t =>
    '<button data-tab="'+t.id+'"'+(S.tab===t.id?' aria-current="page"':'')+'><span class="ic" aria-hidden="true">'+t.ic+'</span>'+t.label+(t.id==='ajustes' && isAdm() && pendentes().length ? '<span class="badge">'+pendentes().length+'</span>' : '')+'</button>').join('');
}
$('#tabs').addEventListener('click', e => { const b=e.target.closest('button[data-tab]'); if(!b) return; S.tab=b.dataset.tab; S.det=null; history.replaceState(null,'','#'+S.tab); renderTabs(); render(); window.scrollTo(0,0); });

function render(){
  if (!S.pronto) return;
  if (document.querySelector('#dlg[open]')) return;
  const abertos = [...document.querySelectorAll('details.area[open]')].map(d => d.dataset.k);
  $('#subtitle').textContent = papelTexto() + (!isAdm() && pessoaDe(S.uid) ? [pessoaDe(S.uid).gestao?' · Gestão':'', pessoaDe(S.uid).ministro?' · Ministro':'', pessoaDe(S.uid).avisos?' · Avisos/Eventos':'', pessoaDe(S.uid).escala?' · Escala':''].join('') : '');
  renderWho();
  const v = $('#view');
  if (!S.cfgLoaded) { v.innerHTML='<div class="empty">Carregando o painel…</div>'; return; }
  const t = TABS.find(x => x.id === S.tab);
  if (!t || (t.owner && !isAdm()) || (t.gestao && !temGestao())) S.tab = 'inicio';
  if (!S.cfg && S.tab!=='ajustes') { v.innerHTML = isAdm() ? '<div class="empty">O painel ainda não está configurado.<br><br><button class="btn" data-go="ajustes">Configurar agora</button></div>' : '<div class="empty">Não foi possível carregar o painel agora. Confira a internet e tente de novo.</div>'; return; }
  const fns = {inicio:viewInicio, escala:viewEscala, checkin:viewCheckin, avisos:viewAvisos, agenda:viewAgenda, historico:viewHistorico, ajustes:viewAjustes, ajuda:viewAjuda};
  v.innerHTML = bannerCadastro() + fns[S.tab]();
  let k = 0; document.querySelectorAll('details.area').forEach(d => { d.dataset.k = S.tab+(k++); if (abertos.includes(d.dataset.k)) d.open = true; });
  if (S.tab==='historico' && isAdm()) carregarHistorico();
}
document.addEventListener('click', e => { const g = e.target.closest('[data-ir]'); if (!g) return; const [tab, alvo] = g.dataset.ir.split('|');
  S.tab = tab; history.replaceState(null,'','#'+tab); renderTabs(); render();
  requestAnimationFrame(() => { const el = document.getElementById(alvo); if (el) { el.scrollIntoView({behavior:'smooth', block:'start'}); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } }); });
document.addEventListener('click', e => { const g=e.target.closest('[data-go]'); if(g){ S.tab=g.dataset.go; history.replaceState(null,'','#'+S.tab); renderTabs(); render(); window.scrollTo(0,0); }});

/* ---------- INÍCIO ---------- */
const imgTag = (src, cls) => src && /^(data:image\/|https:\/\/|imagens\/)/.test(src) ? '<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy">' : '';
async function arquivoParaImg(file){
  const bmp = await createImageBitmap(file); const w = Math.min(1080, bmp.width), h = Math.round(bmp.height*w/bmp.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const tipo = c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  let q = 0.78, b = await new Promise(ok => c.toBlob(ok, tipo, q));
  while (b.size > 250000 && q > 0.4) { q -= 0.1; b = await new Promise(ok => c.toBlob(ok, tipo, q)); }
  return b;
}
const campoImg = x => '<label class="f" for="fImg">Imagem (opcional)</label><input class="inp" id="fImg" name="img" type="file" accept="image/*">'+(x&&x.img?'<label class="hint" style="display:block"><input type="checkbox" name="semimg"> Remover a imagem atual</label>':'');
async function lerImg(fd, x){
  const f = fd.get('img'); if (fd.get('semimg')) return '';
  if (f && f.size) {
    try {
      const b = await arquivoParaImg(f); const caminho = S.uid+'/'+Date.now()+(b.type==='image/webp'?'.webp':'.jpg');
      const up = await sb.storage.from('imagens').upload(caminho, b, {contentType:b.type, upsert:false});
      if (up.error) throw up.error;
      return sb.storage.from('imagens').getPublicUrl(caminho).data.publicUrl;
    } catch(e){ console.warn(e); toast('Não consegui enviar essa imagem.'); }
  }
  return (x && x.img) || '';
}
const txtLongo = t => '<p class="clamp">'+linkify(t)+'</p>'+(String(t||'').length > 160 || String(t||'').split('\n').length > 4 ? '<button class="link lermais" data-lermais>Ler mais</button>' : '');
document.addEventListener('click', e => { const b = e.target.closest('[data-lermais]'); if (!b) return; const p = b.previousElementSibling; p.classList.toggle('aberto'); b.textContent = p.classList.contains('aberto') ? 'Ler menos' : 'Ler mais'; });
const urlOk = u => /^https?:\/\/\S+$/i.test(String(u||'').trim());
const btnLink = u => urlOk(u) ? '<a class="btn small insc" href="'+esc(u)+'" target="_blank" rel="noopener">Fazer inscrição ›</a>' : '';
const btnLinks = bs => { const l = (bs||[]).filter(b => b && urlOk(b.link)); return l.length ? '<div class="zaps">'+l.map(b => '<a class="btn small insc" href="'+esc(b.link)+'" target="_blank" rel="noopener">'+esc(b.rotulo||'Abrir')+' ›</a>').join('')+'</div>' : ''; };
const btnZap = cs => { const l = (cs||[]).filter(c => c && String(c.tel||'').replace(/\D/g,'').length >= 10); return l.length ? '<div class="zaps"><span class="meta">Fale com:</span>'+l.map(c => '<a class="btn small zap" href="https://wa.me/'+String(c.tel).replace(/\D/g,'')+'" target="_blank" rel="noopener">WhatsApp · '+esc(c.nome)+'</a>').join('')+'</div>' : ''; };
const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+/g, m => '<a href="'+m+'" target="_blank" rel="noopener">'+m+'</a>');
const dataBR = d => d.split('-').reverse().join('/');
function celula(lista, c, a){
  const x = escalaDe(lista, c.data, c.culto, a.id);
  let txt;
  if (a.porConexao) txt = conexoesTxt(x);
  else { const ps = x ? (x.funcoes||[]).flatMap(f => f.pessoas||[]) : []; txt = ps.length ? (a.funcoes.length===1 && ps.length<=2 ? ps.join(' e ') : 'Equipe ('+ps.length+')') : ''; }
  if (!txt && x && x.obs) txt = x.obs;
  return '<td><button class="cell'+(txt?'':' vazio')+'" data-det="'+c.data+'|'+esc(c.culto)+'|'+esc(a.id)+'">'+(txt?esc(txt):'A definir')+'</button></td>';
}
function tabelaEscala(lista){
  return '<div class="tbl-wrap"><table class="esc"><thead><tr><th>Data</th>'+areas().map(a=>'<th>'+esc(a.nome)+'</th>').join('')+(temGestao()?'<th>Check-in PDF</th><th>Check-in Excel</th>':'')+'</tr></thead><tbody>'
    + lista.map(c => { const ci = cultoInfo(c.culto); return '<tr class="'+(/noite/i.test(ci.nome)?'noite':'manha')+'"><th scope="row"><span class="dt">'+dataBR(c.data)+'</span><span class="ct">'+esc(ci.nome)+(ci.hora?' · '+esc(ci.hora):'')+'</span></th>'+areas().map(a => celula(S.mesEsc, c, a)).join('')+(temGestao()?'<td><button class="cell dl" data-ck-pdf="'+c.data+'|'+esc(c.culto)+'">Baixar PDF</button></td><td><button class="cell dl" data-ck-xls="'+c.data+'|'+esc(c.culto)+'">Baixar Excel</button></td>':'')+'</tr>'; }).join('')
    + '</tbody></table></div><p class="hint">Toque no nome para ver quem está escalado em cada função.</p>';
}
function viewDetalhe(){
  const {data, culto, area} = S.det; const a = areaInfo(area); const ci = cultoInfo(culto);
  const x = escalaDe(todasEscalas(), data, culto, area);
  const pode = podeArea(a, x);
  let h = '<button class="btn ghost small" data-voltar>‹ Voltar para a escala</button>'
    + '<h2 class="section-title" style="margin-top:16px">'+esc(a.nome)+'</h2><div class="meta" style="font-size:15px">'+esc(fmtDia(data))+' · Culto da '+esc(ci.nome.toLowerCase())+(ci.hora?' · '+esc(ci.hora):'')+'</div>';
  if (a.porConexao) h += '<p style="margin:10px 0 0"><span class="tag" style="margin:0;font-size:14px;padding:3px 12px">'+esc(conexoesTxt(x) || 'Conexão a definir')+'</span></p>';
  h += '<div style="margin-top:14px">' + a.funcoes.map(f => {
    const salvo = x ? ((x.funcoes||[]).find(g => g.nome===f.nome)||{}).pessoas || [] : [];
    const total = f.vagas ? Math.max(f.vagas, salvo.length) : salvo.length;
    const itens = total ? Array.from({length:total}, (_,i) => '<li>'+(salvo[i] ? esc(salvo[i]) : '<span class="pend">vaga aberta</span>')+'</li>').join('') : '<li><span class="pend">ninguém escalado</span></li>';
    return '<section class="card fcard"><h3>'+esc(f.nome)+(f.vagas?' <span class="meta">· '+f.vagas+(f.vagas>1?' vagas':' vaga')+'</span>':'')+'</h3><ul>'+itens+'</ul></section>';
  }).join('') + '</div>' + (x && x.obs ? '<div class="notice">'+esc(x.obs)+'</div>' : '')
    + (pode ? '<button class="btn" data-esc="1" data-d="'+data+'" data-c="'+esc(culto)+'" data-a="'+esc(area)+'">'+(x?'Editar escala':'Preencher escala')+'</button>' : '');
  return h;
}
const botoesDia = d => S.uid ? '<div class="bar" style="margin:6px 0 12px">'+(temGestao()?'<button class="btn ghost small" data-dia-ficha="'+d+'">Check-in do dia</button>':'')+'<button class="btn ghost small" data-dia-csv="'+d+'">Planilha do dia</button></div>' : '';
const bannerCadastro = () => (!S.uid || S.tab==='inicio' || S.tab==='ajuda' || isAdm() || !S.cfg || pessoaDe(S.uid) || S.meuCad) ? '' : '<div class="notice"><b>É líder, auxiliar ou da organização da conexão?</b> Faça seu cadastro para poder preencher a escala da sua conexão.<div style="margin-top:8px"><button class="btn small" data-go="inicio">Fazer meu cadastro</button></div></div>';
const msgAprovacao = () => 'Olá! Acabei de fazer meu cadastro no painel da Família Alcançar: '+((S.meuCad||{}).nome||'')+' · '+(PAPEIS[(S.meuCad||{}).papel]||'')+' da conexão '+conexaoNome((S.meuCad||{}).conexao)+'. Pode aprovar, por favor?';
// Logo depois do cadastro: janela com o botão verde para avisar o administrador.
function avisarAdmin(){
  abrir('<form><h2>Falta só avisar o administrador</h2><p style="margin:0">Seu cadastro foi enviado. Para ser aprovado, toque no botão verde e envie a mensagem pronta pelo WhatsApp.</p>'
    + '<p class="hint">Até a aprovação, você só consegue ver o painel, como quem não entrou.</p>'
    + '<a class="btn big" style="background:#25D366;color:#fff" href="https://wa.me/'+ADM_WPP()+'?text='+encodeURIComponent(msgAprovacao())+'" target="_blank" rel="noopener" data-avisou>Avisar o administrador pelo WhatsApp</a>'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Fechar</button></div></form>', async () => true);
}
document.addEventListener('click', e => { if (e.target.closest('[data-avisou]')) setTimeout(() => { const d = $('#dlg'); if (d.open) d.close(); }, 300); });
function cardCadastro(){
  if (!S.uid || isAdm() || pessoaDe(S.uid) || !S.cfg) return '';
  if (S.meuCad) { const msg = msgAprovacao();
    return '<div class="notice">Cadastro enviado: '+esc(S.meuCad.nome||'')+' · '+esc(PAPEIS[S.meuCad.papel]||'')+' da conexão '+esc(conexaoNome(S.meuCad.conexao))+'. Agora é só aguardar a aprovação de um administrador. Para agilizar, avise pelo WhatsApp:<a class="btn" style="display:block;text-align:center;margin-top:12px;text-decoration:none;background:#25D366;color:#fff" href="https://wa.me/'+ADM_WPP()+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener">Avisar o administrador pelo WhatsApp</a></div>'; }
  return '<section class="card"><h3>É líder, auxiliar ou da organização da conexão?</h3><p class="meta" style="margin:4px 0 0">Faça seu cadastro para poder preencher a escala da sua conexão. Quem só vai consultar não precisa se cadastrar.</p><form id="cadForm">'
    + '<label class="f" for="kN">Nome completo</label><input class="inp" id="kN" name="nome" required autocomplete="name" value="'+esc(S.nomeConta||'')+'">'
    + '<label class="f" for="kA">Me chamar: (apelido)</label><input class="inp" id="kA" name="apelido" placeholder="Como você prefere ser chamado">'
    + '<label class="f" for="kW">WhatsApp (com DDD)</label><input class="inp" id="kW" name="whatsapp" type="tel" required inputmode="tel" placeholder="(11) 99999-9999">'
    + '<label class="f" for="kC">Conexão</label><select class="inp" id="kC" name="conexao" required><option value="">Escolha…</option>'+opts(conexoes(), '')+'</select>'
    + '<label class="f" for="kP">Função</label><select class="inp" id="kP" name="papel" required>'+opts([{id:'lider',nome:'Líder'},{id:'auxiliar',nome:'Auxiliar'},{id:'organizacao',nome:'Organização'}], 'lider')+'</select>'
    + '<p class="hint">Depois de enviado, a conexão só pode ser alterada por um administrador.</p>'
    + '<div class="end"><button type="submit" class="btn">Enviar cadastro</button></div></form></section>';
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'cadForm') return; e.preventDefault();
  if (S.meuCad) { toast('Seu cadastro já foi enviado.'); return; }
  const fd = new FormData(e.target); const data = {nome:String(fd.get('nome')||'').trim(), apelido:String(fd.get('apelido')||'').trim(), whatsapp:String(fd.get('whatsapp')||'').trim(), conexao:fd.get('conexao'), papel:fd.get('papel')};
  if (String(data.whatsapp).replace(/\D/g,'').length < 10) { toast('Coloque o WhatsApp com DDD.'); return; }
  const b = e.target.querySelector('[type=submit]'); b.disabled = true;
  try {
    const r = await sb.from('cadastros').insert({id:S.uid, email:S.email, ...data}); if (r.error) throw r.error;
    await logar('criou','config','Pedido de cadastro: '+(PAPEIS[data.papel]||'')+' · '+conexaoNome(data.conexao), null, {nome:data.nome, papel:data.papel, conexao:data.conexao});
    await carregarPessoas(); renderTabs(); render();
    if (pessoaDe(S.uid)) toast('Cadastro aprovado: você já tem o mesmo acesso do painel antigo.'); else avisarAdmin();
  } catch(err){ falhaEscrita(err); b.disabled = false; }
});
function viewInicio(){
  const lista = listaCultos(hoje(), somaDias(hoje(), 120), S.prox).filter(c => !horaPassou(c.data, cultoInfo(c.culto).hora));
  const datas = [...new Set(lista.map(c=>c.data))].slice(0, 2);
  const blocoDia = d => lista.filter(c=>c.data===d).map((c,i) => (i?'<hr class="div-culto">':'')+'<div class="culto-sec"><h3 class="culto-t'+(/noite/i.test(cultoInfo(c.culto).nome)?' noite':'')+'">'+esc(cultoTitulo(c))+'</h3>'+blocosCulto(S.prox, c)+'</div>').join('');
  let html = cardCadastro();
  if (isAdm() && pendentes().length) { const n = pendentes().length; html = '<button class="card pend" data-go="ajustes"><span>🔔 <b>'+n+' cadastro'+(n>1?'s':'')+' aguardando aprovação</b></span><span class="meta">Revisar ›</span></button>' + html; }
  if (!datas.length) html += '<div class="empty">Nenhum culto programado. Confira os dias de culto em Ajustes.</div>';
  else {
    const [p, ...resto] = datas;
    html += '<section class="hero" aria-label="Próximo culto"><div class="when">'+(p===hoje()?'Hoje':'Próximo culto')+'</div><h2>'+esc(fmtDia(p))+'</h2>'+blocoDia(p)+botoesDia(p)+'</section>';
    if (resto.length) html += '<h2 class="section-title">Em seguida</h2><div class="mini-grid">' + resto.map(d =>
      '<section class="mini"><h3>'+esc(fmtDia(d))+'</h3>'+blocoDia(d)+botoesDia(d)+'</section>').join('') + '</div>';
  }
  const evs = S.eventos.filter(e => (e.dataFim || e.data) >= hoje());
  const avs = S.avisos.filter(a => !a.fixoFim);
  const fixos = [...S.avisos].filter(a => a.fixoFim).sort((x, y) => x.fixoFim - y.fixoFim);
  const dLin = d => { const x = new Date(d+'T12:00:00'); return '<span class="ld"><b>'+String(x.getDate()).padStart(2,'0')+'/'+String(x.getMonth()+1).padStart(2,'0')+'</b>'+esc(x.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''))+'</span>'; };
  html += '<h2 class="section-title">Agenda</h2>';
  html += evs.length ? '<div class="card lst">' + evs.map(ev => '<button class="li" data-ir="agenda|ev-'+esc(ev.id)+'">'+dLin(ev.data)+'<span class="lt">'+esc(ev.titulo)+'</span><span class="lh">'+esc(ev.hora||'')+'</span><span class="la" aria-hidden="true">›</span></button>').join('') + '</div>'
    : '<div class="empty">Nenhum evento marcado daqui para frente.</div>';
  if (avs.length) html += '<h2 class="section-title">Avisos</h2><div class="card lst">' + avs.map(a => '<button class="li" data-ir="avisos|av-'+esc(a.id)+'">'+dLin(String(a.criadoEm||'').slice(0,10))+'<span class="lt">'+esc(a.titulo)+'</span><span class="lh"></span><span class="la" aria-hidden="true">›</span></button>').join('') + '</div>';
  if (fixos.length) html += '<h2 class="section-title">Para você</h2>' + fixos.map(a => { const b = (a.botoes||[]).find(x => x && urlOk(x.link)) || (urlOk(a.link) ? {rotulo:'Abrir', link:a.link} : null);
    return '<article class="card">'+imgTag(a.img,'banner')+'<h3>'+esc(a.titulo)+'</h3>'+(b?'<a class="btn big" href="'+esc(b.link)+'" target="_blank" rel="noopener">'+esc(b.rotulo||'Abrir')+'</a>':'')+'</article>'; }).join('');
  html += blocoRedes();
  html += blocoSobre();
  html += blocoIgreja();
  return html;
}
const IC_IG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>';
const IC_YT = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 9v6l5-3z" fill="#000"/></svg>';
const handle = u => { const m = String(u||'').match(/(?:instagram\.com\/|youtube\.com\/)(@?[A-Za-z0-9._-]+)/); return m ? (m[1].startsWith('@') ? m[1] : '@'+m[1]) : ''; };
function blocoIgreja(){
  const i = S.cfg && S.cfg.info; if (!i || !i.endereco) return '';
  const mapa = 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(i.endereco);
  const ic = c => /noite/i.test(c.nome) ? '🌙' : '☀️';
  return '<h2 class="section-title">Onde estamos</h2><section class="card igreja"><h3>❤️ '+esc(i.nome||'Igreja')+'</h3>'
    + '<p class="meta" style="font-size:15px;margin:8px 0 0">📍 '+esc(i.endereco)+(i.complemento?'<br>'+esc(i.complemento):'')+'</p>'
    + '<a class="btn small insc" href="'+esc(mapa)+'" target="_blank" rel="noopener">Como chegar ›</a>'
    + '<div class="meta" style="margin-top:16px">⛪ Nossos cultos, todos os domingos</div><div class="horarios">'+cultos().map(c => '<div><span>'+ic(c)+' '+esc(c.nome)+'</span><b>'+esc(c.hora||'—')+'</b></div>').join('')+'</div>'
    + (i.convite?'<p>'+esc(i.convite)+'</p>':'') + (i.chamada?'<p class="vemeve">'+esc(i.chamada)+'</p>':'') + '</section>';
}
function blocoRedes(){
  const r = (S.cfg && S.cfg.redes) || {}; const ds = (S.cfg && S.cfg.destaques) || [];
  if (!r.instagram && !r.youtube && !ds.length) return '';
  const card = (cls, url, ic, rede, prev, cta) => '<a class="rede-card '+cls+'" href="'+esc(url)+'" target="_blank" rel="noopener"><div class="prev'+(prev?'':' vazio')+'"'+(prev?' style="background-image:url(\''+esc(prev)+'\')"':'')+'>'+(prev?'':'<span class="marca">'+ic+'</span>')+'</div><div class="rede-info"><span class="ic">'+ic+'</span><span><b>'+rede+'</b><small>'+esc(handle(url))+'</small></span><span class="cta">'+cta+' ›</span></div></a>';
  let h = '<h2 class="section-title">Redes sociais</h2><div class="redes">';
  if (urlOk(r.instagram)) h += card('ig', r.instagram, IC_IG, 'Instagram', r.igPrev, 'Ver perfil');
  if (urlOk(r.youtube)) h += card('yt', r.youtube, IC_YT, 'YouTube', r.ytPrev, 'Ver vídeos');
  h += '</div>';
  const site = r.site || SITE_IGREJA;
  if (urlOk(site)) h += '<div class="card" style="margin-top:10px;padding:6px 16px"><a class="dest" href="'+esc(site)+'" target="_blank" rel="noopener"><span class="ig" aria-hidden="true">🌐</span><span><b>Site da igreja</b><br><small class="meta">comunidadealcancar.com.br</small></span><span aria-hidden="true">›</span></a></div>';
  if (ds.length) h += '<div class="card" style="margin-top:10px"><div class="meta" style="margin-bottom:4px">Postagens em destaque</div>' + ds.filter(d => urlOk(d.link)).map(d => { const yt = /youtu/.test(d.link);
    return '<a class="dest" href="'+esc(d.link)+'" target="_blank" rel="noopener"><span class="'+(yt?'yt':'ig')+'">'+(yt?IC_YT:IC_IG)+'</span><span>'+esc(d.titulo)+'</span><span aria-hidden="true">›</span></a>'; }).join('') + '</div>';
  return h;
}
const SITE_IGREJA = 'https://www.comunidadealcancar.com.br/#programacao';
const SOBRE = { missao: 'Fazer com excelência as coisas concernentes ao reino de Deus, lutando pela unidade e buscando o seu crescimento. Trazendo a todas as pessoas que quiserem, a solução para as suas necessidades mediante o conhecimento da Palavra de Deus.', visao: 'Ser uma igreja que alcança, ama, discipula, treina e envia. Que leva o Evangelho para o homem todo. Que luta contra o pecado e a cultura anticristã. Uma igreja que ensina a amar e conhecer o Deus da Bíblia.' };
function blocoSobre(){
  const s = {...SOBRE, ...((S.cfg && S.cfg.sobre) || {})};
  return '<h2 class="section-title">Sobre nós</h2><div class="card sobre"><h3>Missão</h3><p>'+esc(s.missao)+'</p><h3 style="margin-top:16px">Visão</h3><p>'+esc(s.visao)+'</p></div>';
}

/* ---------- ESCALA (mês) ---------- */
function mesLabel(){ return new Date(S.mes+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); }
function viewEscala(){
  if (S.det) return viewDetalhe();
  const bar = '<div class="bar"><div class="month"><button class="icon-btn" data-mes="-1" aria-label="Mês anterior">‹</button><strong>'+esc(mesLabel())+'</strong><button class="icon-btn" data-mes="1" aria-label="Próximo mês">›</button></div>'
    + '<span style="flex:1"></span>' + (isAdm() ? '<button class="btn ghost" data-importar>Importar escala</button><button class="btn" data-esc-novo>+ Culto extra</button>' : '') + '</div>';
  const chips = '<div class="chips" role="group" aria-label="Filtrar por conexão">' + [{id:'todas',nome:'Todas'}, ...conexoes()].map(c =>
    '<button class="chip" data-filtro="'+esc(c.id)+'" aria-pressed="'+(S.filtro===c.id)+'">'+esc(c.nome)+'</button>').join('') + '</div>';
  if (!S.perDe) { const [yy,mm] = S.mes.split('-').map(Number); S.perDe = S.mes+'-01'; S.perAte = isoLocal(new Date(yy, mm+2, 0)); }
  const exp = !S.uid ? '' : '<h2 class="section-title">Exportar</h2><div class="card"><div class="meta">Deste mês</div><div class="bar" style="margin:8px 0 0"><button class="btn ghost small" data-exp="csv">Planilha do mês</button>'+(temGestao()?'<button class="btn ghost small" data-exp="ficha">Check-in do mês</button>':'')+'</div>'
    + '<div class="meta" style="margin-top:18px">Planilha personalizada</div><div class="row"><div><label class="f" for="xDe">De</label><input class="inp" id="xDe" type="date" value="'+esc(S.perDe)+'"></div><div><label class="f" for="xAte">Até</label><input class="inp" id="xAte" type="date" value="'+esc(S.perAte)+'"></div></div>'
    + '<label class="f" for="xTipo">O que exportar</label><select class="inp" id="xTipo">'+opts(temGestao() ? [{id:'escala',nome:'Planilha da escala'},{id:'checkin',nome:'Check-in (com assinaturas)'}] : [{id:'escala',nome:'Planilha da escala'}], temGestao() ? (S.perTipo||'escala') : 'escala')+'</select>'
    + '<div class="bar" style="margin:12px 0 0"><button class="btn small" data-per="xlsx">Baixar Excel</button><button class="btn ghost small" data-per="pdf">Baixar PDF</button></div><p class="hint">Escolha qualquer período, por exemplo de novembro a março. O filtro de conexão lá de cima também vale aqui.</p></div>';
  const lista = listaCultos(S.mes+'-01', S.mes+'-31', S.mesEsc).filter(c => c.data.slice(0,7)===S.mes);
  const visiveis = S.filtro==='todas' ? lista : lista.filter(c => S.mesEsc.some(x => x.data===c.data && x.culto===c.culto && conexoesDe(x).includes(S.filtro)));
  if (!visiveis.length) return bar + chips + '<div class="empty">Nenhum culto em '+esc(mesLabel())+(S.filtro!=='todas'?' com a conexão '+esc(conexaoNome(S.filtro)):'')+'.</div>' + exp;
  return bar + chips + tabelaEscala(visiveis) + exp;
}
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.filtro) { S.filtro = t.dataset.filtro; render(); }
  if (t.dataset.det) { const [d,c,a] = t.dataset.det.split('|'); S.det = {data:d, culto:c, area:a}; render(); window.scrollTo(0,0); }
  if ('voltar' in t.dataset) { S.det = null; render(); }
  if (t.dataset.ckPdf) { const [d,c] = t.dataset.ckPdf.split('|'); checkinPDF(d, c, t); }
  if (t.dataset.ckXls) { const [d,c] = t.dataset.ckXls.split('|'); checkinXLSX(d, c, t); }
  if (t.dataset.mes) { const [y,m] = S.mes.split('-').map(Number); const d = new Date(y, m-1+Number(t.dataset.mes), 1); S.mes = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); S.mesEsc = []; render(); assinarMes(); }
  if ('escNovo' in t.dataset) formEscala({data:hoje(), culto:(cultos()[0]||{}).id, area:(areas()[0]||{}).id, livre:true});
  if (t.dataset.esc) formEscala({data:t.dataset.d, culto:t.dataset.c, area:t.dataset.a});
  if (t.dataset.exp === 'csv') exportarCSV();
  if (t.dataset.exp === 'ficha') exportarFicha();
  if (t.dataset.diaCsv || t.dataset.diaFicha) { const d = t.dataset.diaCsv || t.dataset.diaFicha; const rows = linhasDe(todasEscalas().filter(x => x.data === d));
    if (t.dataset.diaCsv) exportarCSV(rows, 'escala-'+d+'.csv'); else checkinDiaPDF(d, t); }
});
const todasEscalas = () => { const m = new Map(); [...S.prox, ...S.mesEsc, ...(S.ckDocs||[])].forEach(x => m.set(x.id, x)); return [...m.values()]; };
const resumoEscala = x => fmtCurto(x.data)+' · '+cultoInfo(x.culto).nome+' · '+areaInfo(x.area).nome+(conexoesDe(x).length?' ('+conexoesTxt(x)+')':'');
function opts(list, sel){ return list.map(o => '<option value="'+esc(o.id)+'"'+(o.id===sel?' selected':'')+'>'+esc(o.nome)+'</option>').join(''); }
function abrir(html, onSubmit, onReady){
  $('#dlgBody').innerHTML = html; const d = $('#dlg'); if (!d.open) d.showModal();
  d.onclose = () => render();
  $('#dlgBody').querySelector('[data-cancel]').onclick = () => d.close();
  $('#dlgBody').querySelector('form').onsubmit = async ev => { ev.preventDefault(); const b = ev.target.querySelector('[type=submit]:not([data-limpar])') || ev.target.querySelector('[type=submit]'); b.disabled = true; const ok = await onSubmit(new FormData(ev.target), ev.submitter); b.disabled = false; if (ok && $('#dlgBody').firstChild === ev.target) d.close(); };
  if (onReady) onReady($('#dlgBody'));
}
function camposArea(a, x){
  const minhasCon = conexoes();
  let h = '';
  if (a.porConexao && !isAdm()) h += '<p class="notice" style="margin-top:12px">Conexão: '+esc(conexoesTxt(x) || '—')+'</p>';
  else if (a.porConexao) h += '<label class="f">Conexões responsáveis</label><div class="chips" style="flex-wrap:wrap">'+minhasCon.map(c => '<label class="chip"><input type="checkbox" name="conexoes" value="'+esc(c.id)+'"'+(conexoesDe(x).includes(c.id)?' checked':'')+'> '+esc(c.nome)+'</label>').join('')+'</div><div class="hint">Marque mais de uma quando servirem juntas.</div>';
  a.funcoes.forEach((f, i) => {
    const salvo = x ? ((x.funcoes||[]).find(g=>g.nome===f.nome)||{}).pessoas || [] : [];
    h += '<fieldset class="fs"><legend>'+esc(f.nome)+(f.vagas?' · '+f.vagas+(f.vagas>1?' pessoas':' pessoa'):'')+'</legend>';
    if (f.vagas) h += '<div class="slotgrid">'+Array.from({length:Math.max(f.vagas, salvo.length)}, (_,j) => '<input class="inp" name="f'+i+'_'+j+'" aria-label="'+esc(f.nome)+' '+(j+1)+'" placeholder="Nome '+(j+1)+'" value="'+esc(salvo[j]||'')+'">').join('')+'</div>';
    else h += '<textarea class="inp" name="f'+i+'" aria-label="'+esc(f.nome)+'" placeholder="Um nome por linha">'+esc(salvo.join('\n'))+'</textarea>';
    h += '</fieldset>';
  });
  h += '<label class="f" for="fObs">Observação (opcional)</label><input class="inp" id="fObs" name="obs" value="'+esc(x?x.obs||'':'')+'">';
  return h;
}
function formEscala(ctx){
  const editaveis = isAdm() ? areas() : areas().filter(a => podeArea(a, todasEscalas().find(x => x.id === docId(ctx.data, ctx.culto, a.id))));
  const atual = () => { const f = $('#dlgBody form'); return {data:f.data.value, culto:f.culto.value, area:f.area.value}; };
  const existente = c => todasEscalas().find(x => x.id === docId(c.data, c.culto, c.area));
  const x0 = existente(ctx);
  const fixo = !isAdm();
  abrir('<form><h2>Escala</h2>'
    + (fixo
      ? '<div class="notice" style="margin:0"><b>'+esc(areaInfo(ctx.area).nome)+'</b><br>'+esc(fmtDia(ctx.data))+' · Culto da '+esc(cultoInfo(ctx.culto).nome.toLowerCase())+(cultoInfo(ctx.culto).hora?' · '+esc(cultoInfo(ctx.culto).hora):'')+'</div>'
        + '<input type="hidden" id="fData" name="data" value="'+esc(ctx.data)+'"><input type="hidden" id="fCulto" name="culto" value="'+esc(ctx.culto)+'"><input type="hidden" id="fArea" name="area" value="'+esc(ctx.area)+'">'
      : '<div class="row"><div><label class="f" for="fData">Data</label><input class="inp" id="fData" name="data" type="date" required value="'+esc(ctx.data)+'"'+(ctx.livre?'':' readonly')+'></div>'
    + '<div><label class="f" for="fCulto">Culto</label><select class="inp" id="fCulto" name="culto" required>'+opts(cultos(), ctx.culto)+'</select></div></div>'
    + '<label class="f" for="fArea">Área</label><select class="inp" id="fArea" name="area" required>'+opts(editaveis, ctx.area)+'</select>')
    + '<div id="campos">'+camposArea(areaInfo(ctx.area), x0)+'</div>'
    + '<div class="end">'+(x0 && isAdm()?'<button type="submit" class="btn danger" data-limpar style="margin-right:auto">Limpar</button>':'')+'<button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Salvar escala</button></div></form>',
  async (fd, sub) => {
    const c = atual(); const a = areaInfo(c.area); const x = existente(c);
    const r = ref('escalas', docId(c.data, c.culto, c.area));
    if (sub && 'limpar' in sub.dataset) { if (!x || !await confirmar('Apagar a escala de '+a.nome+' deste culto?')) return false; const ok = await excluir(r, semId(x), 'escala', resumoEscala(x)); if (ok) { toast('Escala apagada'); await RECARGA.escalas(); } return ok; }
    const cs = a.porConexao ? (isAdm() ? fd.getAll('conexoes') : conexoesDe(x)) : [];
    const data = { data:c.data, culto:c.culto, area:c.area, conexoes: cs, conexao: cs[0]||null,
      funcoes: a.funcoes.map((f,i) => ({nome:f.nome, pessoas: f.vagas
        ? [...$('#dlgBody form').querySelectorAll('[name^="f'+i+'_"]')].map(el=>el.value.trim()).filter(Boolean)
        : String(fd.get('f'+i)||'').split('\n').map(s=>s.trim()).filter(Boolean)})),
      obs: String(fd.get('obs')||'').trim(), atualizadoEm:new Date().toISOString() };
    if (a.porConexao && !cs.length) { toast('Marque pelo menos uma conexão.'); return false; }
    if (!podeArea(a, x)) { toast('Você só pode preencher a escala dos dias da sua conexão.'); return false; }
    const ok = await salvar(r, data, {acao:x?'editou':'criou', tipo:'escala', resumo:resumoEscala(data), antes:x?semId(x):null});
    if (ok) { toast(x?'Escala atualizada':'Escala salva'); await RECARGA.escalas(); }
    return ok;
  },
  body => {
    const refazer = () => { const c = atual(); body.querySelector('#campos').innerHTML = camposArea(areaInfo(c.area), existente(c)); };
    if (!fixo) ['fData','fCulto','fArea'].forEach(id => body.querySelector('#'+id).addEventListener('change', refazer));
  });
}

/* ---------- exportação ---------- */
function linhasMes(){ return linhasDe(S.mesEsc.filter(x => S.filtro==='todas' || conexoesDe(x).includes(S.filtro))); }
function linhasDe(lista){
  const rows = [];
  lista.slice()
    .sort((a,b)=>(a.data+cultos().findIndex(c=>c.id===a.culto)+areas().findIndex(r=>r.id===a.area)).localeCompare(b.data+cultos().findIndex(c=>c.id===b.culto)+areas().findIndex(r=>r.id===b.area)))
    .forEach(x => { const c = cultoInfo(x.culto);
      (x.funcoes||[]).forEach(f => (f.pessoas||[]).forEach(p => rows.push({data:x.data, dia:new Date(x.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'}), culto:c.nome, hora:c.hora||'', area:areaInfo(x.area).nome, conexao:conexoesTxt(x), funcao:f.nome, pessoa:p, obs:x.obs||''})));
    });
  return rows;
}
const TIPOS = {csv:'text/csv;charset=utf-8', html:'text/html;charset=utf-8', pdf:'application/pdf', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
async function baixar(filename, data){
  try {
    const ext = filename.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(new Blob([data], {type: TIPOS[ext] || 'application/octet-stream'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch(e){ console.warn(e); toast('Não foi possível baixar o arquivo agora.'); }
}
function exportarCSV(rows = linhasMes(), arquivo){
  if (!rows.length) { toast('Não há escala preenchida para exportar.'); return; }
  const q = v => '"'+String(v).replace(/"/g,'""')+'"';
  const head = ['Área','Função','Nome','Check-in','Assinatura retirada (equipamento / crachá)','Assinatura devolução (equipamento / crachá)'];
  const body = []; let grupo = '';
  rows.forEach(r => { const g = fmtDia(r.data)+' · Culto da '+r.culto.toLowerCase()+(r.hora?' · '+r.hora:'');
    if (g !== grupo) { if (grupo) body.push(''); body.push(q(g.charAt(0).toUpperCase()+g.slice(1))); body.push(head.map(q).join(';')); grupo = g; }
    body.push([r.area, r.funcao, r.pessoa, '', '', ''].map(q).join(';')); });
  baixar(arquivo || ('escala-'+S.mes+(S.filtro!=='todas'?'-'+S.filtro:'')+'.csv'), '﻿'+body.join('\r\n'));
}
function exportarFicha(rows = linhasMes(), arquivo, tituloX){
  if (!temGestao()) { toast('Só administradores e a Gestão podem imprimir o check-in.'); return; }
  rows = semLouvor(rows);
  if (!rows.length) { toast('Não há escala preenchida para exportar.'); return; }
  const grupos = {}; rows.forEach(r => { const k = r.data+'|'+r.culto+'|'+r.hora; (grupos[k] ||= []).push(r); });
  const titulo = ((S.cfg&&S.cfg.igreja)||'Igreja')+' · Check-in '+(tituloX || mesLabel()+(S.filtro!=='todas'?' · '+conexaoNome(S.filtro):''));
  const paginas = Object.keys(grupos).map(k => { const [d,c,h] = k.split('|');
    return '<section><h2>'+esc(fmtDia(d))+' · '+esc(c)+(h?' · '+esc(h):'')+'</h2><table><thead><tr><th>Nome</th><th>Área</th><th>Função</th><th>Conexão</th><th>Chegada</th><th>✓</th><th>Assinatura</th></tr></thead><tbody>'
      + grupos[k].map(r => '<tr><td>'+esc(r.pessoa)+'</td><td>'+esc(r.area)+'</td><td>'+esc(r.funcao)+'</td><td>'+esc(r.conexao)+'</td><td></td><td class="ck">☐</td><td class="sig"></td></tr>').join('')
      + '</tbody></table></section>'; }).join('');
  const doc = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+esc(titulo)+'</title><style>body{font:13px/1.4 Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}p.i{color:#555;margin:0 0 18px}section{page-break-inside:avoid;margin-bottom:26px}h2{font-size:16px;margin:0 0 6px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:7px 5px;text-align:left}th{background:#eee}td.ck{text-align:center;width:28px;font-size:18px}td.sig{width:24%}button{padding:10px 18px;font-size:15px;margin-bottom:16px}@media print{button{display:none}section{page-break-after:always}}</style></head><body><button onclick="window.print()">Imprimir</button><h1>'+esc(titulo)+'</h1><p class="i">Gerado em '+esc(fmtQuando(new Date().toISOString()))+'</p>'+paginas+'</body></html>';
  baixar(arquivo || ('ficha-checkin-'+S.mes+(S.filtro!=='todas'?'-'+S.filtro:'')+'.html'), doc);
}

/* ---------- check-in em PDF e Excel ---------- */
const LIBS = {};
function carregar(src){ return LIBS[src] ||= new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete LIBS[src]; err(new Error('lib')); }; document.head.appendChild(s); }); }
const JSPDF = 'vendor/jspdf-2.5.1.min.js';
const AUTOTABLE = 'vendor/jspdf-autotable-3.8.2.min.js';
const EXCELJS = 'vendor/exceljs-4.4.0.min.js';
const CK_HEAD = ['Área','Função','Nome','Check-in','Assinatura retirada (equipamento / crachá)','Assinatura devolução (equipamento / crachá)'];
function blocosCheckin(d, c){
  const ci = cultoInfo(c), docs = todasEscalas().filter(x => x.data===d && x.culto===c);
  const grupos = areas().filter(a => !ehLouvor(a.nome)).map(a => {
    const x = docs.find(y => y.area===a.id); const rows = [];
    (a.funcoes||[]).forEach((f, fi) => {
      const nomes = x ? (((x.funcoes||[]).find(g => g.nome===f.nome)||{}).pessoas||[]).map(n => String(n).trim()).filter(Boolean) : [];
      const n = nomes.length;
      for (let k = 0; k < n; k++) rows.push({funcao: k===0 ? f.nome : '', fn: f.nome, nome: nomes[k]||'', k: a.id+'_'+fi+'_'+k});
    });
    const con = x ? conexoesTxt(x) : '';
    return {id:a.id, area:a.nome, conexao:con, obs:(x&&x.obs)||'', rows};
  }).filter(g => g.rows.length);
  const nm = ci.nome || c; const cap = nm.charAt(0).toUpperCase()+nm.slice(1);
  return { culto:c, rotulo:'Culto da '+nm.toLowerCase()+(ci.hora?' · '+ci.hora:''), noite:/noite/i.test(nm), grupos, temDados:grupos.length > 0, cap };
}
const CK_COLS = ['Função','Nome','Check-in','Assinatura — retirada\n(equipamento / crachá)','Assinatura — devolução\n(equipamento / crachá)'];
const tituloDia = d => { const t = fmtDia(d); return t.charAt(0).toUpperCase()+t.slice(1); };
async function garantirDia(d){ if (!todasEscalas().some(x => x.data === d)) { const extra = linhas(await sb.from('escalas').select('id,d').eq('data', d)); S.ckDocs = [...(S.ckDocs||[]).filter(x => x.data !== d), ...extra]; } }
async function gerarCheckinPDF(d, cs, btn, arq){
  if (!temGestao()) { toast('Só administradores e a Gestão podem imprimir o check-in.'); return; }
  await garantirDia(d);
  const bs = cs.map(c => blocosCheckin(d, c)).filter(b => b.temDados);
  if (!bs.length) { toast('Não há escala preenchida '+(cs.length>1?'neste dia.':'neste culto.')); return; }
  const txt = btn.textContent; btn.textContent = 'Gerando…'; btn.disabled = true;
  try {
    await carregar(JSPDF); await carregar(AUTOTABLE);
    const doc = new window.jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
    const W = doc.internal.pageSize.getWidth(), M = 12, igreja = (S.cfg&&S.cfg.igreja)||'Família Alcançar';
    const cab = () => { doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(20); doc.text(igreja+' · Check-in', M, 14);
      doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(70); doc.text(tituloDia(d), W-M, 14, {align:'right'}); doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(M, 17.5, W-M, 17.5); };
    cab(); let y = 23;
    bs.forEach((b, bi) => {
      if (bi && y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); cab(); y = 23; }
      const cor = b.noite ? [30,136,229] : [255,198,26];
      doc.setFillColor(...cor); doc.roundedRect(M, y, W-2*M, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(b.noite?255:20); doc.text(b.rotulo, M+4, y+6.2); doc.setTextColor(20);
      const body = [];
      b.grupos.forEach(g => {
        body.push([{content: g.area.toUpperCase() + (g.conexao ? '   ·   '+(g.conexao.includes(' e ')?'Conexões ':'Conexão ')+g.conexao : '') + (g.obs ? '   ·   '+g.obs : ''), colSpan:5, styles:{fillColor:[236,236,236], fontStyle:'bold', fontSize:9.5, textColor:[30,30,30], minCellHeight:7, cellPadding:{top:1.8,bottom:1.8,left:3,right:3}}}]);
        g.rows.forEach(r => body.push([r.funcao, r.nome, '', '', '']));
      });
      doc.autoTable({ startY: y+11, margin:{left:M, right:M, top:23, bottom:14}, theme:'grid', head:[CK_COLS], body, showHead:'everyPage', rowPageBreak:'avoid',
        styles:{font:'helvetica', fontSize:10, cellPadding:{top:2.2,bottom:2.2,left:3,right:3}, minCellHeight:10, valign:'middle', lineColor:[150,150,150], lineWidth:0.2, textColor:[20,20,20], overflow:'linebreak'},
        headStyles:{fillColor:[25,25,25], textColor:255, fontStyle:'bold', fontSize:9, halign:'center', minCellHeight:11},
        columnStyles:{0:{cellWidth:58, fontSize:9, textColor:[70,70,70]}, 1:{cellWidth:64, fontStyle:'bold'}, 2:{cellWidth:24}, 3:{cellWidth:'auto'}, 4:{cellWidth:'auto'}},
        didDrawPage: () => cab() });
      y = doc.lastAutoTable.finalY + 10;
    });
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120); doc.text('Página '+i+' de '+n, W-M, doc.internal.pageSize.getHeight()-6, {align:'right'}); }
    await baixar(arq, doc.output('arraybuffer'));
  } catch(e) { console.warn(e); toast('Não foi possível gerar o PDF agora.'); }
  finally { btn.textContent = txt; btn.disabled = false; }
}
function checkinDiaPDF(d, btn){ return gerarCheckinPDF(d, cultos().map(c => c.id), btn, 'checkin-'+d+'.pdf'); }
function checkinPDF(d, c, btn){ return gerarCheckinPDF(d, [c], btn, 'checkin-'+d+'-'+c+'.pdf'); }
async function checkinXLSX(d, c, btn){
  if (!temGestao()) { toast('Só administradores e a Gestão podem imprimir o check-in.'); return; }
  await garantirDia(d);
  const b = blocosCheckin(d, c); if (!b.temDados) { toast('Não há escala preenchida neste culto.'); return; }
  const txt = btn.textContent; btn.textContent = 'Gerando…'; btn.disabled = true;
  try {
    await carregar(EXCELJS);
    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet('Check-in', {pageSetup:{orientation:'landscape', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0, margins:{left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.2,footer:0.2}}, views:[{state:'frozen', ySplit:4}]});
    ws.columns = [{width:30},{width:32},{width:12},{width:38},{width:38}];
    ws.mergeCells('A1:E1'); ws.getCell('A1').value = ((S.cfg&&S.cfg.igreja)||'Família Alcançar')+' · Check-in'; ws.getCell('A1').font = {bold:true, size:14};
    ws.mergeCells('A2:E2'); ws.getCell('A2').value = tituloDia(d)+' · '+b.rotulo; ws.getCell('A2').font = {bold:true, size:12};
    ws.getCell('A2').fill = {type:'pattern', pattern:'solid', fgColor:{argb: b.noite?'FF1E88E5':'FFFFC61A'}}; if (b.noite) ws.getCell('A2').font = {bold:true, size:12, color:{argb:'FFFFFFFF'}};
    const borda = {style:'thin', color:{argb:'FF999999'}}; const bordas = {top:borda, left:borda, bottom:borda, right:borda};
    const h = ws.getRow(4); h.values = CK_COLS.map(t => t.replace('\n',' ')); h.height = 34;
    h.eachCell(cell => { cell.font = {bold:true, color:{argb:'FFFFFFFF'}}; cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF191919'}}; cell.border = bordas; cell.alignment = {vertical:'middle', horizontal:'center', wrapText:true}; });
    let r = 5;
    b.grupos.forEach(g => {
      ws.mergeCells('A'+r+':E'+r); const gc = ws.getCell('A'+r);
      gc.value = g.area.toUpperCase() + (g.conexao ? '  ·  '+(g.conexao.includes(' e ')?'Conexões ':'Conexão ')+g.conexao : '') + (g.obs ? '  ·  '+g.obs : '');
      gc.font = {bold:true}; gc.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFECECEC'}}; gc.border = bordas; ws.getRow(r).height = 20; r++;
      g.rows.forEach(x => { const row = ws.getRow(r++); row.values = [x.funcao, x.nome, '', '', '']; row.height = 26;
        for (let col = 1; col <= 5; col++) { const cell = row.getCell(col); cell.border = bordas; cell.alignment = {vertical:'middle', wrapText:true}; }
        row.getCell(2).font = {bold:true}; row.getCell(1).font = {color:{argb:'FF555555'}}; });
    });
    ws.pageSetup.printTitlesRow = '4:4';
    await baixar('checkin-'+d+'-'+c+'.xlsx', await wb.xlsx.writeBuffer());
  } catch(e) { console.warn(e); toast('Não foi possível gerar o Excel agora.'); }
  finally { btn.textContent = txt; btn.disabled = false; }
}

/* ---------- CHECK-IN (marcação ao vivo) ---------- */
function proxCulto(){ let d = hoje(); for (let i = 0; i < 14; i++) { if (diasCulto().includes(new Date(d+'T12:00:00').getDay())) return d; d = somaDias(d, 1); } return hoje(); }
async function ckCarregarDocs(){ const d = S.ckD; const l = linhas(await sb.from('escalas').select('id,d').eq('data', d)); if (d === S.ckD) { S.ckDocs = l; S.ckOk = true; } }
async function ckCarregarMarcas(){ const d = S.ckD, c = S.ckC; const r = await sb.from('checkin_marcas').select('*').eq('data', d).eq('culto', c);
  if (r.error) { console.warn(r.error); return; } if (d !== S.ckD || c !== S.ckC) return;
  const m = {}; (r.data||[]).forEach(x => m[x.chave] = {...x, _v:1}); S.ckMarks = m; }
function ckAbrir(){
  if (!S.ckD) S.ckD = proxCulto();
  if (!S.ckC || !cultos().some(c => c.id===S.ckC)) S.ckC = (cultos()[0]||{}).id;
  const chave = S.ckD+'_'+S.ckC; if (S.ckChave === chave) return; S.ckChave = chave;
  S.ckMarks = {}; S.ckOk = false;
  Promise.all([ckCarregarDocs(), ckCarregarMarcas()]).catch(e => console.warn(e)).finally(() => { S.ckOk = true; if (S.tab==='checkin') render(); });
}
function viewCheckin(){
  if (!temGestao()) return '<div class="empty">Só administradores e a Gestão acessam o check-in.</div>';
  ckAbrir();
  let h = '<div class="bar"><h2 style="font-size:22px">Check-in</h2></div>'
    + '<div class="card"><label class="f" for="ckD" style="margin-top:0">Data do culto</label><input class="inp" type="date" id="ckD" value="'+esc(S.ckD)+'">'
    + '<div class="chips" style="margin-top:10px">'+cultos().map(c => '<button class="chip" aria-pressed="'+(c.id===S.ckC)+'" data-ck-culto="'+esc(c.id)+'">'+esc(c.nome)+(c.hora?' · '+esc(c.hora):'')+'</button>').join('')+'</div></div>';
  if (!S.ckOk) return h + '<div class="empty">Carregando…</div>';
  const b = blocosCheckin(S.ckD, S.ckC);
  if (!b.temDados) return h + '<div class="empty">Não há escala preenchida para este culto.</div>';
  const M = S.ckMarks || {}; let tot = 0, ci = 0, ret = 0, dev = 0;
  b.grupos.forEach(g => g.rows.forEach(r => { const m = M[r.k]||{}; if (r.nome || m.nome) tot++; if (m.ci) ci++; if (m.ret) ret++; if (m.dev) dev++; }));
  h += '<div class="ckres"><span><b>'+ci+'</b>/'+tot+' check-in</span><span><b>'+ret+'</b> retiraram</span><span><b>'+dev+'</b> devolveram</span></div>';
  b.grupos.forEach(g => {
    h += '<div class="card ckg"><h3>'+esc(g.area)+(g.conexao?' <small class="meta">· '+esc(g.conexao)+'</small>':'')+'</h3>'
      + '<div class="ckrow ckhead"><span></span><span>Check-in</span><span>Retirou</span><span>Devolveu</span></div>';
    g.rows.forEach(r => { const m = M[r.k]||{}; const nm = r.nome || m.nome || '';
      const box = (campo, rot) => '<label class="ckbox" title="'+rot+'"><input type="checkbox" data-ckk="'+esc(r.k)+'" data-campo="'+campo+'"'+(m[campo]?' checked':'')+' aria-label="'+esc(rot+' · '+(nm||r.fn))+'"><span></span></label>';
      h += '<div class="ckrow'+(m.ci?' feito':'')+'"><span class="ckn">'+(r.nome ? '<b>'+esc(r.nome)+'</b>' : '<input class="inp ckin" data-cknome="'+esc(r.k)+'" placeholder="Digite o nome" value="'+esc(m.nome||'')+'">')+'<small>'+esc(r.fn)+'</small></span>'
        + box('ci','Check-in') + box('ret','Retirou equipamento/crachá') + box('dev','Devolveu equipamento/crachá') + '</div>'; });
    h += '</div>';
  });
  h += '<div class="bar" style="margin-top:6px"><button class="btn ghost small" data-ck-pdf="'+esc(S.ckD)+'|'+esc(S.ckC)+'">Baixar ficha em PDF</button></div>';
  return h;
}
async function ckSalvar(k, campo, valor){
  if (!temGestao()) return;
  const b = blocosCheckin(S.ckD, S.ckC);
  let row = null, g0 = null; b.grupos.forEach(g => g.rows.forEach(r => { if (r.k===k) { row = r; g0 = g; } }));
  const ant = (S.ckMarks||{})[k] || {};
  const dado = {data:S.ckD, culto:S.ckC, chave:k, ci:!!ant.ci, ret:!!ant.ret, dev:!!ant.dev, nome: ant.nome||'', escalado: row ? row.nome : '', area: g0 ? g0.area : '', funcao: row ? row.fn : '', [campo]: valor};
  S.ckMarks = {...(S.ckMarks||{}), [k]: dado}; if (campo !== 'nome') render();
  try { const r = await sb.from('checkin_marcas').upsert(dado, {onConflict:'data,culto,chave'}); if (r.error) throw r.error; } catch(e){ falhaEscrita(e); }
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ckD' && t.value) { S.ckD = t.value; render(); return; }
  if (t.dataset && t.dataset.ckk) { ckSalvar(t.dataset.ckk, t.dataset.campo, t.checked); t.closest('.ckrow') && t.dataset.campo==='ci' && t.closest('.ckrow').classList.toggle('feito', t.checked); return; }
  if (t.dataset && t.dataset.cknome) ckSalvar(t.dataset.cknome, 'nome', t.value.trim());
});
document.addEventListener('click', e => { const c = e.target.closest('[data-ck-culto]'); if (c) { S.ckC = c.dataset.ckCulto; render(); } });

/* ---------- planilha personalizada ---------- */
document.addEventListener('input', e => { if (e.target.id==='xDe') S.perDe = e.target.value; if (e.target.id==='xAte') S.perAte = e.target.value; if (e.target.id==='xTipo') S.perTipo = e.target.value; });
document.addEventListener('change', e => { if (e.target.id==='xTipo') S.perTipo = e.target.value; });
async function exportarPeriodo(tipo, btn){
  const de = S.perDe, ate = S.perAte;
  if (!de || !ate || de > ate) { toast('Confira as datas: “De” precisa vir antes de “Até”.'); return; }
  const txt = btn.textContent; btn.textContent = 'Gerando…'; btn.disabled = true;
  try {
    const s = await sb.from('escalas').select('id,d').gte('data', de).lte('data', ate).order('data').limit(2000);
    if (s.error) throw s.error;
    const lista = linhas(s).filter(x => S.filtro==='todas' || conexoesDe(x).includes(S.filtro));
    if (S.perTipo === 'checkin' && !temGestao()) S.perTipo = 'escala';
    const rows = S.perTipo === 'checkin' ? semLouvor(linhasDe(lista)) : linhasDe(lista);
    if (!rows.length) { toast('Não há escala preenchida nesse período.'); return; }
    const grupos = []; rows.forEach(r => { const g = fmtDia(r.data)+' · Culto da '+r.culto.toLowerCase()+(r.hora?' · '+r.hora:''); const t = g.charAt(0).toUpperCase()+g.slice(1);
      if (!grupos.length || grupos[grupos.length-1].t !== t) grupos.push({t, rows:[]}); grupos[grupos.length-1].rows.push(r); });
    const ck = S.perTipo === 'checkin';
    const titulo = ((S.cfg&&S.cfg.igreja)||'Igreja')+(ck?' · Check-in de ':' · Escala de ')+dataBR(de)+' a '+dataBR(ate)+(S.filtro!=='todas'?' · '+conexaoNome(S.filtro):'');
    const arq = (ck?'checkin-':'escala-')+de+'-a-'+ate;
    const HEAD = ck ? CK_HEAD : ['Área','Conexão','Função','Nome'];
    const vals = r => ck ? [r.area, r.funcao, r.pessoa, '', '', ''] : [r.area, r.conexao, r.funcao, r.pessoa];
    const nc = HEAD.length; const ult = String.fromCharCode(64+nc);
    if (tipo === 'pdf') {
      await carregar(JSPDF); await carregar(AUTOTABLE);
      const doc = new window.jspdf.jsPDF({orientation: ck?'landscape':'portrait', unit:'mm', format:'a4'});
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(titulo, 14, 16);
      const body = []; grupos.forEach(g => { body.push([{content:g.t, colSpan:nc, styles:{fillColor:[235,235,235], fontStyle:'bold'}}]); g.rows.forEach(r => body.push(vals(r))); });
      doc.autoTable({ startY:22, theme:'grid', head:[ck ? HEAD.map(h => h.replace(' (', '\n(')) : HEAD], body, showHead:'everyPage', styles:{fontSize:9.5, cellPadding:2.4, minCellHeight: ck?10:0, valign:'middle', lineColor:[150,150,150], lineWidth:0.2, textColor:[20,20,20]}, headStyles:{fillColor:[25,25,25], textColor:255, fontStyle:'bold'},
        columnStyles: ck ? {0:{cellWidth:34}, 1:{cellWidth:50}, 2:{cellWidth:46}, 3:{cellWidth:20}} : {} });
      await baixar(arq+'.pdf', doc.output('arraybuffer'));
    } else {
      await carregar(EXCELJS);
      const wb = new window.ExcelJS.Workbook();
      const ws = wb.addWorksheet(ck?'Check-in':'Escala', {pageSetup:{orientation: ck?'landscape':'portrait', paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0}, views:[{state:'frozen', ySplit:3}]});
      ws.columns = ck ? [{width:20},{width:30},{width:26},{width:11},{width:32},{width:32}] : [{width:22},{width:22},{width:30},{width:30}];
      ws.mergeCells('A1:'+ult+'1'); ws.getCell('A1').value = titulo; ws.getCell('A1').font = {bold:true, size:13};
      const borda = {style:'thin', color:{argb:'FF888888'}}; const bordas = {top:borda, left:borda, bottom:borda, right:borda};
      let n = 3; const hr = ws.getRow(n); hr.values = HEAD; hr.height = ck?32:18; hr.eachCell(c => { c.font = {bold:true, color:{argb:'FFFFFFFF'}}; c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF191919'}}; c.border = bordas; c.alignment = {vertical:'middle', wrapText:true}; }); ws.pageSetup.printTitlesRow = '3:3';
      grupos.forEach(g => { n++; ws.mergeCells('A'+n+':'+ult+n); const c = ws.getCell('A'+n); c.value = g.t; c.font = {bold:true}; c.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFEDEDED'}}; c.border = bordas;
        g.rows.forEach(r => { n++; const row = ws.getRow(n); row.values = vals(r); if (ck) row.height = 26; for (let k = 1; k <= nc; k++) { row.getCell(k).border = bordas; row.getCell(k).alignment = {vertical:'middle', wrapText:true}; } }); });
      await baixar(arq+'.xlsx', await wb.xlsx.writeBuffer());
    }
  } catch(e) { console.warn(e); toast('Não foi possível gerar o arquivo agora.'); }
  finally { btn.textContent = txt; btn.disabled = false; }
}
document.addEventListener('click', e => { const t = e.target.closest('button[data-per]'); if (t) exportarPeriodo(t.dataset.per, t); });

/* ---------- IMPORTAR ESCALA (só administrador) ---------- */
// Lê um Excel, CSV ou PDF com a escala e preenche Direção do culto e Super Kids (nomes das
// conexões), Louvor e Mídia (nomes das pessoas). Mostra uma prévia antes de gravar.
const PDFJS = 'vendor/pdfjs-3.11.174.min.js', PDFJS_WORKER = 'vendor/pdfjs-3.11.174.worker.min.js';
const AREAS_IMPORT = ['direcao','superkids','louvor','midia'];
const nrm = s => semAcento(s).replace(/[^a-z0-9]+/g,' ').trim();
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const iso = (y,m,d) => y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
function anoProvavel(m, d){ const h = new Date(hoje()+'T12:00:00'); for (const y of [h.getFullYear(), h.getFullYear()+1, h.getFullYear()-1]) { const x = new Date(y, m-1, d, 12); const dias = (x - h) / 864e5; if (dias >= -90 && dias <= 300) return y; } return h.getFullYear(); }
function lerData(s){
  s = String(s||'').trim(); if (!s) return null;
  let m = s.match(/^D:(\d{4})-(\d{2})-(\d{2})$/); if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/(?:^|[^\d])(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2,4}))?(?!\d)/);
  if (m) { const d = +m[1], mm = +m[2]; let y = m[3] ? +m[3] : 0; if (y && y < 100) y += 2000; if (d >= 1 && d <= 31 && mm >= 1 && mm <= 12) return iso(y || anoProvavel(mm, d), mm, d); }
  const n = nrm(s); m = n.match(/(?:^| )(\d{1,2})(?: de)? (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*(?: (?:de )?(\d{4}))?/);
  if (m) { const mm = MESES.indexOf(m[2]) + 1, d = +m[1]; return iso(m[3] ? +m[3] : anoProvavel(mm, d), mm, d); }
  return null;
}
function lerCulto(s){
  const n = nrm(s); if (!n) return null;
  for (const c of cultos()) { const cn = nrm(c.nome), ch = nrm(c.hora).replace(/ /g,''); if ((cn && new RegExp('(^| )'+cn+'( |$)').test(n)) || (ch && n.replace(/ /g,'').includes(ch))) return c.id; }
  if (/(^| )(manha|matutino)( |$)/.test(n)) return (cultos().find(c => /manh/i.test(c.nome))||{}).id || null;
  if (/(^| )(noite|noturno)( |$)/.test(n)) return (cultos().find(c => /noite/i.test(c.nome))||{}).id || null;
  return null;
}
// Rótulo de coluna/linha: {area, funcao?}
function lerRotulo(s){
  const n = nrm(s); if (!n || n.length > 40) return null;
  const lv = areaInfo('louvor');
  for (const f of (lv.funcoes||[])) if (n === nrm(f.nome)) return {area:'louvor', funcao:f.nome};
  // A célula inteira precisa ser o nome da função (assim "Ministra Ana" não vira a função "Ministros").
  const alias = [[/^ministr(o|os|a|as)$/, 'Ministros'], [/^(contra ?baixo|baixo)$/, 'Contrabaixo'], [/^viol(ao|oes)$/, 'Violão'], [/^guitarr(a|as)$/, 'Guitarra'], [/^(teclado|teclados|teclas)$/, 'Teclado'], [/^bateri(a|as)$/, 'Bateria'],
    [/^(soprano|soprano 1|primeiro soprano|1 o soprano)$/, '1º Soprano'], [/^(soprano 2|segundo soprano|2 o soprano)$/, '2º Soprano'], [/^contraltos?$/, 'Contralto'], [/^tenor(es)?$/, 'Tenor'], [/^(baixo voz|voz baixo|baixo vocal|baixos)$/, 'Baixo (voz)']];
  for (const [re, f] of alias) if (re.test(n) && lv.funcoes.some(x => x.nome === f)) return {area:'louvor', funcao:f};
  if (/^(super ?kids|kids|ministerio infantil|infantil)$/.test(n)) return {area:'superkids'};
  if (/^(direcao|direcao do culto|direcao de culto|recepcao)$/.test(n)) return {area:'direcao'};
  if (/^(louvor|equipe de louvor|ministerio de louvor)$/.test(n)) return {area:'louvor'};
  if (/^(midia|midias|equipe de midia)$/.test(n)) return {area:'midia'};
  return null;
}
function lerConexoes(v){
  const ok = [], fora = [];
  String(v||'').split(/\s*(?:\/|,|;|\+|&|\n| e )\s*/i).map(x => x.trim()).filter(x => x && !/^[-–—x]$/i.test(x)).forEach(tk => {
    const n = nrm(tk).replace(/^conex(ao|oes) /,'');
    const c = conexoes().find(c => { const cn = nrm(c.nome); return n === cn || n === nrm(c.id) || (n.length >= 4 && (cn.includes(n) || n.includes(cn))) || (cn.replace(/s$/,'') === n.replace(/s$/,'')); });
    if (c) { if (!ok.includes(c.id)) ok.push(c.id); } else fora.push(tk);
  });
  return {ok, fora};
}
const lerNomes = v => String(v||'').split(/\s*(?:,|;|\/|\n|&| e (?=[A-ZÀ-Ú]))\s*/).map(x => x.trim()).filter(x => x && !/^[-–—x?]+$/i.test(x) && !/^a definir$/i.test(x));
// Arquivo → tabelas; cada linha = lista de células {t, x}
async function lerArquivo(file){
  const ext = (file.name.split('.').pop()||'').toLowerCase();
  if (ext === 'xlsx') {
    await carregar(EXCELJS); const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
    const txt = v => { if (v == null) return ''; if (v instanceof Date) return 'D:'+v.toISOString().slice(0,10); if (typeof v === 'object') { if (v.richText) return v.richText.map(x => x.text).join(''); if (v.result !== undefined) return txt(v.result); if (v.text) return String(v.text); } return String(v).trim(); };
    return wb.worksheets.map(ws => { const rows = []; ws.eachRow({includeEmpty:true}, (row, i) => { const cs = []; row.eachCell({includeEmpty:true}, (c, j) => cs.push({t:txt(c.value), x:j})); rows[i-1] = cs; }); return {nome:ws.name, rows:rows.map(r => r || [])}; });
  }
  if (ext === 'csv' || ext === 'txt') {
    const linhas = (await file.text()).replace(/^﻿/,'').split(/\r?\n/); const sep = [';','\t',','].find(s => linhas.some(l => l.includes(s))) || ';';
    return [{nome:file.name, rows:linhas.map(l => l.split(sep).map((t, j) => ({t:t.replace(/^"|"$/g,'').trim(), x:j+1})))}];
  }
  if (ext === 'pdf') {
    await carregar(PDFJS); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise; const tabs = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const itens = (await (await pdf.getPage(p)).getTextContent()).items.filter(i => i.str.trim()).map(i => ({t:i.str, x0:i.transform[4], x1:i.transform[4]+i.width, y:i.transform[5], h:Math.abs(i.transform[3])||8}));
      itens.sort((a,b) => b.y - a.y || a.x0 - b.x0);
      const linhas = []; itens.forEach(i => { const l = linhas.find(l => Math.abs(l.y - i.y) <= Math.max(2, i.h*0.4)); if (l) l.its.push(i); else linhas.push({y:i.y, its:[i]}); });
      linhas.sort((a,b) => b.y - a.y);
      tabs.push({nome:'Página '+p, pdf:true, rows:linhas.map(l => { l.its.sort((a,b) => a.x0 - b.x0); const cs = []; l.its.forEach(i => { const u = cs[cs.length-1]; if (u && i.x0 - u.x1 < Math.max(4, i.h*0.6)) { u.t += (i.x0 - u.x1 > 1 ? ' ' : '') + i.t; u.x1 = i.x1; } else cs.push({t:i.t, x0:i.x0, x1:i.x1}); }); return cs.map(c => ({t:c.t.trim(), x:(c.x0+c.x1)/2, x0:c.x0, x1:c.x1})); })});
    }
    return tabs;
  }
  throw new Error('formato');
}
// Tabelas → itens {data, culto|null, area, funcao|null, valor}
function interpretar(tabs){
  const itens = [], ignorados = new Set();
  // No PDF, a célula é da coluna se encosta nela e está alinhada pelo centro, pela esquerda ou pela direita.
  const naColuna = (row, col, pdf) => pdf ? row.find(c => c.x0 <= col.x1 + 8 && c.x1 >= col.x0 - 8 && (Math.abs(c.x - col.x) <= Math.max(40, (col.x1-col.x0)) || Math.abs(c.x0 - col.x0) <= 12 || Math.abs(c.x1 - col.x1) <= 12)) : row.find(c => c.x === col.x);
  tabs.forEach(tab => {
    let cab = null, colsData = null, areaSecao = null, ultData = null, ultCulto = null;
    tab.rows.forEach(row => {
      const cheias = row.filter(c => c.t);
      if (!cheias.length) return;
      const datas = cheias.filter(c => lerData(c.t)), rotulos = cheias.map(c => ({c, r:lerRotulo(c.t)})).filter(x => x.r);
      // cabeçalho com datas nas colunas (ex.: louvor: funções × domingos)
      if (datas.length >= 2 && datas.length >= cheias.length - 1) { colsData = datas.map(c => ({x:c.x, x0:c.x0, x1:c.x1, data:lerData(c.t), culto:lerCulto(c.t)})); cab = null; return; }
      if (colsData && cheias.every(c => lerCulto(c.t) || !c.t) && cheias.length >= 2) { cheias.forEach(c => { const col = colsData.find(k => naColuna([c], k, tab.pdf)); if (col) col.culto = lerCulto(c.t); }); return; }
      // cabeçalho com áreas nas colunas
      if (rotulos.length >= 1 && !datas.length && (rotulos.length >= 2 || cheias.some(c => /^data|^dia|^domingo/.test(nrm(c.t))))) { cab = rotulos.map(x => ({x:x.c.x, x0:x.c.x0, x1:x.c.x1, ...x.r})); colsData = null; return; }
      // título de seção ("LOUVOR", "MÍDIA")
      if (cheias.length === 1 && rotulos.length === 1 && !rotulos[0].r.funcao) { areaSecao = rotulos[0].r.area; return; }
      if (colsData) {
        const rot = rotulos.find(x => x.c.x === cheias[0].x) || (rotulos.length && rotulos[0].c === cheias[0] ? rotulos[0] : null);
        let alvo = rot ? rot.r : (areaSecao ? {area:areaSecao} : null);
        if (rot && !rot.r.funcao && areaSecao === 'louvor' && rot.r.area !== 'louvor') alvo = rot.r;
        if (!alvo) { ignorados.add(cheias[0].t); return; }
        colsData.forEach(col => { const c = naColuna(row.filter(x => x !== (rot && rot.c)), col, tab.pdf); if (c && c.t) itens.push({data:col.data, culto:col.culto, area:alvo.area, funcao:alvo.funcao||null, valor:c.t}); });
        return;
      }
      if (cab) {
        const d = datas.length ? lerData(datas[0].t) : null, cu = cheias.map(c => lerCulto(c.t)).find(Boolean) || null;
        if (d) { ultData = d; ultCulto = cu; } else if (cu && ultData) ultCulto = cu; else return;
        cab.forEach(col => { const c = naColuna(row, col, tab.pdf); if (c && c.t && !lerData(c.t) && !(lerCulto(c.t) && c.t.length < 12)) itens.push({data:ultData, culto:ultCulto, area:col.area, funcao:col.funcao||null, valor:c.t}); });
      }
    });
  });
  return {itens, ignorados:[...ignorados]};
}
// Itens → mudanças por escala, comparando com o que já está no banco
async function planejar(itens){
  const datas = [...new Set(itens.map(i => i.data))].sort(); const fora = [];
  if (!datas.length) return {mudancas:[], fora};
  const atuais = linhas(await sb.from('escalas').select('id,d').gte('data', datas[0]).lte('data', datas[datas.length-1]));
  const plano = new Map();
  itens.forEach(i => {
    if (!AREAS_IMPORT.includes(i.area)) return;
    const cs = i.culto ? [i.culto] : cultos().map(c => c.id);
    cs.forEach(cu => {
      const id = docId(i.data, cu, i.area), a = areaInfo(i.area);
      if (!plano.has(id)) { const x = atuais.find(e => e.id === id); plano.set(id, {id, x, d: x ? JSON.parse(JSON.stringify(semId(x))) : {data:i.data, culto:cu, area:i.area, conexoes:[], conexao:null, funcoes:a.funcoes.map(f => ({nome:f.nome, pessoas:[]})), obs:''}}); }
      const p = plano.get(id); p.d.funcoes = p.d.funcoes || [];
      if (a.porConexao) { const {ok, fora:f} = lerConexoes(i.valor); f.forEach(t => fora.push(fmtCurto(i.data)+' · '+a.nome+': "'+t+'"'));
        if (ok.length) { const mudou = JSON.stringify(conexoesDe(p.d)) !== JSON.stringify(ok); p.d.conexoes = ok; p.d.conexao = ok[0]; if (mudou && p.x && conexoesDe(p.x).length) p.d.funcoes = a.funcoes.map(f => ({nome:f.nome, pessoas:[]})); } }
      else { const fn = i.funcao || (a.funcoes[0]||{}).nome; let g = p.d.funcoes.find(f => f.nome === fn); if (!g) { g = {nome:fn, pessoas:[]}; p.d.funcoes.push(g); } const ns = lerNomes(i.valor); if (ns.length) g.pessoas = ns; }
    });
  });
  const resumo = (a, d) => !d ? '' : a.porConexao ? (conexoesTxt(d) || '—') : (d.funcoes||[]).filter(f => (f.pessoas||[]).length).map(f => (a.funcoes.length > 1 ? f.nome+': ' : '')+f.pessoas.join(', ')).join(' · ') || '—';
  const mudancas = [...plano.values()].map(p => { const a = areaInfo(p.d.area); const antes = resumo(a, p.x), depois = resumo(a, p.d);
    return {...p, a, antes, depois, status: !p.x || antes === '—' ? 'preencher' : antes === depois ? 'igual' : 'substituir'}; })
    .sort((u, v) => (u.d.data+cultos().findIndex(c => c.id===u.d.culto)+AREAS_IMPORT.indexOf(u.d.area)).localeCompare(v.d.data+cultos().findIndex(c => c.id===v.d.culto)+AREAS_IMPORT.indexOf(v.d.area)));
  return {mudancas, fora};
}
function formImportar(){
  abrir('<form><h2>Importar escala</h2><p class="meta" style="margin:0">Escolha um arquivo <b>Excel (.xlsx)</b>, <b>CSV</b> ou <b>PDF</b> com a escala. O painel reconhece as datas, o culto (manhã ou noite) e as áreas <b>Direção do culto</b> e <b>Super Kids</b> (nomes das conexões), <b>Louvor</b> e <b>Mídia</b> (nomes das pessoas).</p>'
    + '<label class="f" for="iArq">Arquivo</label><input class="inp" id="iArq" name="arq" type="file" required accept=".xlsx,.csv,.pdf">'
    + '<p class="hint">Se a linha não disser manhã ou noite, a escala vale para os dois cultos do dia. Nada é gravado antes da prévia.</p>'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Ler arquivo</button></div></form>',
  async fd => {
    const f = fd.get('arq'); if (!f || !f.size) { toast('Escolha um arquivo.'); return false; }
    let tabs; try { tabs = await lerArquivo(f); } catch(e){ console.warn(e); toast(e && e.message === 'formato' ? 'Use um arquivo .xlsx, .csv ou .pdf (no Excel antigo, salve como .xlsx).' : 'Não consegui ler esse arquivo.'); return false; }
    const {itens, ignorados} = interpretar(tabs);
    const {mudancas, fora} = await planejar(itens);
    setTimeout(() => previaImportar(f.name, mudancas, [...fora, ...ignorados.slice(0, 20).map(t => 'Linha não reconhecida: "'+t+'"')]), 0);
    return true;
  });
}
function previaImportar(arquivo, mudancas, avisos){
  const uteis = mudancas.filter(m => m.status !== 'igual'), iguais = mudancas.length - uteis.length;
  const ROT = {preencher:'preencher', substituir:'substituir'};
  const linhaM = (m, i) => '<label class="imp-l"><input type="checkbox" name="m" value="'+i+'" checked><span><b>'+esc(fmtCurto(m.d.data))+' · '+esc(cultoInfo(m.d.culto).nome)+' · '+esc(m.a.nome)+'</b> <span class="tag'+(m.status==='substituir'?' tag-sub':'')+'">'+ROT[m.status]+'</span><br>'+esc(m.depois)+(m.status==='substituir'?'<br><small class="meta">antes: '+esc(m.antes)+'</small>':'')+'</span></label>';
  abrir('<form><h2>Prévia da importação</h2><p class="meta" style="margin:0">Arquivo: '+esc(arquivo)+'</p>'
    + (uteis.length ? '<p style="margin:10px 0 6px">'+uteis.length+' escala'+(uteis.length>1?'s':'')+' para gravar'+(iguais?' · '+iguais+' já iguais (ficam como estão)':'')+'. Desmarque o que não quiser.</p><div class="imp-lista">'+uteis.map(linhaM).join('')+'</div>'
       : '<div class="notice" style="margin-top:12px">Nada novo para gravar'+(iguais?': as '+iguais+' escalas do arquivo já estão iguais no painel':'. Não encontrei datas e áreas que eu reconheça nesse arquivo')+'.</div>')
    + (avisos.length ? '<p style="margin:14px 0 4px"><b>Não reconhecido</b> (não será gravado):</p><ul class="imp-avisos">'+avisos.map(a => '<li>'+esc(a)+'</li>').join('')+'</ul>' : '')
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button>'+(uteis.length?'<button type="submit" class="btn">Confirmar importação</button>':'')+'</div></form>',
  async fd => {
    if (!uteis.length) return true;
    const escolhidas = fd.getAll('m').map(Number).map(i => uteis[i]); if (!escolhidas.length) { toast('Marque pelo menos uma escala.'); return false; }
    let ok = 0;
    for (const m of escolhidas) { try { await ref('escalas', m.id).set({...m.d, atualizadoEm:new Date().toISOString()}); ok++; } catch(e){ console.warn(e); } }
    await logar('editou', 'escala', 'Importou escala do arquivo '+arquivo+': '+ok+' escala'+(ok>1?'s':''), null, null);
    await RECARGA.escalas();
    toast(ok === escolhidas.length ? 'Importação concluída: '+ok+' escala'+(ok>1?'s':'')+' gravada'+(ok>1?'s':'')+'.' : 'Gravei '+ok+' de '+escolhidas.length+'. Tente de novo as que faltaram.');
    return true;
  });
}
document.addEventListener('click', e => { if (e.target.closest('[data-importar]') && isAdm()) formImportar(); });
if (window.__TABELAS) window.__importar = {lerArquivo, interpretar, planejar, lerData, lerRotulo, lerCulto}; // só no teste (banco simulado)

/* ---------- AVISOS ---------- */
function viewAvisos(){
  const top = '<div class="bar"><h2 style="font-size:22px">Avisos</h2><span style="flex:1"></span>'+(temAvisos()?'<button class="btn" data-novo-aviso>+ Novo aviso</button>':'')+'</div>';
  if (!S.avisos.length) return top + '<div class="empty">Nenhum aviso publicado ainda.</div>';
  return top + [...S.avisos].sort((x, y) => (x.fixoFim||0) - (y.fixoFim||0)).map(a => { const pode = isAdm() || (temAvisos() && !!S.uid && a.autor===S.uid);
    const quem = a.autor && (S.pessoas[a.autor] || S.names[a.autor]) ? nome(a.autor)+' · ' : '';
    return '<article class="card" id="av-'+esc(a.id)+'">'+imgTag(a.img,'banner')+'<h3>'+esc(a.titulo)+'<span class="tag">'+esc(a.fixoFim?'Fixo':(a.conexao?conexaoNome(a.conexao):'Geral'))+'</span></h3>'
      + '<div class="meta">'+esc(quem)+esc(fmtQuando(a.criadoEm))+'</div>'+txtLongo(a.texto)+btnLink(a.link)+btnLinks(a.botoes)
      + (pode?'<div class="bar" style="margin:10px 0 0"><button class="link" data-edit-aviso="'+esc(a.id)+'">Editar</button><button class="link" data-del-aviso="'+esc(a.id)+'">Excluir</button></div>':'')+'</article>'; }).join('');
}
function formAviso(a){
  const alvo = [{id:'',nome:'Geral (todas)'}, ...conexoes().filter(c=>podeConexao(c.id))];
  abrir('<form><h2>'+(a?'Editar aviso':'Novo aviso')+'</h2><label class="f" for="aT">Título</label><input class="inp" id="aT" name="titulo" required maxlength="120" value="'+esc(a?a.titulo:'')+'">'
    + '<label class="f" for="aC">Para quem</label><select class="inp" id="aC" name="conexao">'+opts(alvo, a?a.conexao||'':'')+'</select>'
    + '<label class="f" for="aX">Mensagem</label><textarea class="inp" id="aX" name="texto" required>'+esc(a?a.texto:'')+'</textarea>'
    + '<label class="f" for="aL">Link de inscrição (opcional)</label><input class="inp" id="aL" name="link" type="url" placeholder="https://" value="'+esc(a?a.link||'':'')+'">' + campoImg(a)
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Publicar aviso</button></div></form>',
  async fd => {
    const data = {titulo:String(fd.get('titulo')).trim(), texto:String(fd.get('texto')).trim(), link:String(fd.get('link')||'').trim(), conexao:fd.get('conexao')||null, img: await lerImg(fd, a),
      botoes: (a&&a.botoes)||undefined, fixoFim: (a&&a.fixoFim)||0, criadoEm: a?a.criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString()};
    const ok = await salvar(ref('avisos', a ? a.id : novoId('av')), data, {acao:a?'editou':'criou', tipo:'aviso', resumo:data.titulo, antes:a?semId(a):null});
    if (ok) { toast(a?'Aviso atualizado':'Aviso publicado'); await carregarAvisos(); } return ok;
  });
}

/* ---------- AGENDA ---------- */
function viewAgenda(){
  const top = '<div class="bar"><h2 style="font-size:22px">Agenda</h2><span style="flex:1"></span>'+(temAvisos()?'<button class="btn" data-novo-evento>+ Novo evento</button>':'')+'</div>';
  const prox = S.eventos.filter(e => e.data >= hoje());
  if (!prox.length) return top + '<div class="empty">Nenhum evento marcado daqui para frente.</div>';
  return top + prox.map(ev => { const d = new Date(ev.data+'T12:00:00'); const pode = isAdm() || (temAvisos() && !!S.uid && ev.autor===S.uid);
    return '<article class="card" id="ev-'+esc(ev.id)+'">'+imgTag(ev.img,'banner')+'<div class="ev"><div class="date"><b>'+d.getDate()+'</b>'+esc(d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''))+'</div><div>'
      + '<h3>'+esc(ev.titulo)+'</h3><div class="meta">'+esc(d.toLocaleDateString('pt-BR',{weekday:'long'}))+(ev.hora?' · '+esc(ev.hora):'')+(ev.local?' · '+esc(ev.local):'')+'</div>'
      + (ev.descricao?txtLongo(ev.descricao):'')+btnLink(ev.link)+btnZap(ev.contatos)
      + (pode?'<div class="bar" style="margin:8px 0 0"><button class="link" data-edit-evento="'+esc(ev.id)+'">Editar</button><button class="link" data-del-evento="'+esc(ev.id)+'">Excluir</button></div>':'')+'</div></div></article>'; }).join('');
}
function formEvento(ev){
  abrir('<form><h2>'+(ev?'Editar evento':'Novo evento')+'</h2><label class="f" for="eT">Nome do evento</label><input class="inp" id="eT" name="titulo" required maxlength="120" value="'+esc(ev?ev.titulo:'')+'">'
    + '<div class="row"><div><label class="f" for="eD">Data</label><input class="inp" id="eD" type="date" name="data" required value="'+esc(ev?ev.data:hoje())+'"></div><div><label class="f" for="eH">Horário</label><input class="inp" id="eH" type="time" name="hora" value="'+esc(ev?ev.hora||'':'')+'"></div></div>'
    + '<label class="f" for="eL">Local</label><input class="inp" id="eL" name="local" value="'+esc(ev?ev.local||'':'')+'">'
    + '<label class="f" for="eX">Detalhes (opcional)</label><textarea class="inp" id="eX" name="descricao">'+esc(ev?ev.descricao||'':'')+'</textarea>'
    + '<label class="f" for="eLk">Link de inscrição (opcional)</label><input class="inp" id="eLk" name="link" type="url" placeholder="https://" value="'+esc(ev?ev.link||'':'')+'">' + campoImg(ev)
    + '<label class="f" for="eZ">Contatos no WhatsApp (opcional)</label><textarea class="inp" id="eZ" name="contatos" style="min-height:70px" placeholder="Nome | +55 11 99999-9999">'+esc(ev&&ev.contatos?ev.contatos.map(c=>c.nome+' | '+c.tel).join('\n'):'')+'</textarea><div class="hint">Um por linha, no formato Nome | número com DDD.</div>'
    + '<div class="end"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn">Salvar evento</button></div></form>',
  async fd => {
    const data = {titulo:String(fd.get('titulo')).trim(), data:fd.get('data'), hora:fd.get('hora')||'', local:String(fd.get('local')||'').trim(), descricao:String(fd.get('descricao')||'').trim(), link:String(fd.get('link')||'').trim(),
      contatos: String(fd.get('contatos')||'').split('\n').map(l => { const [n,t] = l.split('|').map(s=>s.trim()); return n && t ? {nome:n, tel:t} : null; }).filter(Boolean),
      img: await lerImg(fd, ev), atualizadoEm:new Date().toISOString()};
    const ok = await salvar(ref('eventos', ev ? ev.id : novoId('ev')), data, {acao:ev?'editou':'criou', tipo:'evento', resumo:data.titulo+' · '+fmtCurto(data.data), antes:ev?semId(ev):null});
    if (ok) { toast(ev?'Evento atualizado':'Evento salvo'); await carregarEventos(); } return ok;
  });
}
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if ('novoAviso' in t.dataset && temAvisos()) formAviso();
  if (t.dataset.editAviso) formAviso(S.avisos.find(a=>a.id===t.dataset.editAviso));
  if (t.dataset.delAviso) { const a=S.avisos.find(x=>x.id===t.dataset.delAviso); if (a && await confirmar('Excluir o aviso “'+a.titulo+'”?')) { if (await excluir(ref('avisos', a.id), semId(a), 'aviso', a.titulo)) { toast('Aviso excluído'); await carregarAvisos(); render(); } } }
  if ('novoEvento' in t.dataset && temAvisos()) formEvento();
  if (t.dataset.editEvento) formEvento(S.eventos.find(a=>a.id===t.dataset.editEvento));
  if (t.dataset.delEvento) { const ev=S.eventos.find(x=>x.id===t.dataset.delEvento); if (ev && await confirmar('Excluir o evento “'+ev.titulo+'”?')) { if (await excluir(ref('eventos', ev.id), semId(ev), 'evento', ev.titulo)) { toast('Evento excluído'); await carregarEventos(); render(); } } }
});

/* ---------- HISTÓRICO ---------- */
let histCache = null, histCarregando = false, histTipo = 'todos';
function viewHistorico(){
  if (!isAdm()) return '<div class="empty">Só administradores acessam o histórico.</div>';
  const tipos = [{id:'todos',nome:'Tudo'},{id:'escala',nome:'Escalas'},{id:'aviso',nome:'Avisos'},{id:'evento',nome:'Agenda'},{id:'config',nome:'Ajustes e pessoas'}];
  const top = '<div class="bar"><h2 style="font-size:22px">Histórico de alterações</h2><span style="flex:1"></span><button class="btn ghost small" data-hist-reload>Atualizar</button><button class="btn ghost small" data-hist-csv>Baixar</button></div>'
    + '<div class="chips">'+tipos.map(t=>'<button class="chip" data-hist-tipo="'+t.id+'" aria-pressed="'+(histTipo===t.id)+'">'+t.nome+'</button>').join('')+'</div>';
  if (!histCache) return top + '<div class="empty">Carregando histórico…</div>';
  const itens = histCache.filter(l => histTipo==='todos' || l.tipo===histTipo);
  if (!itens.length) return top + '<div class="empty">Nenhuma alteração registrada ainda.</div>';
  return top + '<div class="card">' + itens.slice(0,300).map(l => '<div class="log"><b>'+esc(quemFez(l))+'</b> <span class="act-'+esc(l.acao)+'">'+esc(l.acao)+'</span> '+esc(l.tipo)+': '+esc(l.resumo)
    + '<div class="diff">'+esc(fmtQuando(l.em))+(l.acao==='editou'?' · '+esc(diff(l.antes,l.depois)):'')+'</div></div>').join('') + '</div>';
}
const quemFez = l => l.por && (S.pessoas[l.por] || S.names[l.por]) ? nome(l.por) : (l.por_nome || (l.por ? 'Alguém' : 'Sistema'));
const fmtFuncoes = fs => (fs||[]).map(f => f.nome+': '+((f.pessoas||[]).join(', ')||'—')).join('; ');
function diff(a,b){
  if (!a||!b) return '';
  const nomes = {data:'data',culto:'culto',conexao:'conexão',conexoes:'conexões',funcoes:'equipe',pessoas:'pessoas',obs:'obs',titulo:'título',texto:'mensagem',hora:'horário',local:'local',descricao:'detalhes'};
  const out = [];
  for (const k of Object.keys(nomes)) { const x = JSON.stringify(a[k]??''), y = JSON.stringify(b[k]??''); if (x!==y) out.push(nomes[k]+': '+fmtV(k,a[k])+' → '+fmtV(k,b[k])); }
  return out.join(' | ') || 'sem mudança visível';
}
const fmtV = (k,v) => k==='funcoes' ? fmtFuncoes(v) : k==='conexao' ? (conexaoNome(v)||'—') : k==='conexoes' ? ((v||[]).map(conexaoNome).join(', ')||'—') : Array.isArray(v) ? v.join(', ') : (v==null||v==='' ? '—' : String(v));
async function carregarHistorico(force){
  if ((histCache && !force) || histCarregando) return; histCarregando = true;
  try {
    const r = await sb.from('historico').select('*').order('em', {ascending:false}).limit(600);
    if (r.error) throw r.error;
    histCache = r.data || [];
  } catch(e){ console.warn(e); histCache = histCache || []; }
  finally { histCarregando = false; }
  if (S.tab==='historico') $('#view').innerHTML = viewHistorico();
}
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.histTipo) { histTipo = t.dataset.histTipo; render(); }
  if ('histReload' in t.dataset) { histCache = null; render(); carregarHistorico(true); }
  if ('histCsv' in t.dataset && histCache) {
    const q = v => '"'+String(v??'').replace(/"/g,'""')+'"';
    const lines = [['Quando','Quem','Ação','Tipo','Item','Mudanças'].map(q).join(';'), ...histCache.map(l => [fmtQuando(l.em), quemFez(l), l.acao, l.tipo, l.resumo, l.acao==='editou'?diff(l.antes,l.depois):''].map(q).join(';'))];
    baixar('historico-painel.csv', '﻿'+lines.join('\r\n'));
  }
});

/* ---------- AJUDA / TUTORIAL ---------- */
const passo = (titulo, itens, aberto) => '<details class="card tut"'+(aberto?' open':'')+'><summary><span>'+titulo+'</span><span class="chev" aria-hidden="true">›</span></summary><ol>'+itens.map(i => '<li>'+i+'</li>').join('')+'</ol></details>';
function viewAjuda(){
  const p = pessoaDe(S.uid); const lid = minhas().length > 0;
  const voce = !S.uid ? 'Visitante: você pode ver tudo sem entrar. Para preencher a escala da sua conexão, toque em <b>Entrar</b> e depois faça seu cadastro (passo 3).'
    : isAdm() ? 'Administrador: você pode fazer tudo no painel.' : lid ? PAPEIS[p.papel]+' da conexão '+esc(conexaoNome(p.conexao))+': você preenche a Direção do culto e o Super Kids nos dias da sua conexão.' : 'Consulta: você pode ver tudo. Se for líder, auxiliar ou da organização de uma conexão, faça seu cadastro (passo 3).';
  let h = cardCadastro() + '<h2 class="section-title" style="margin-top:0">Como usar o painel</h2><div class="notice"><b>Seu acesso hoje</b><br>'+voce+'</div>';
  h += passo('1. Primeiros passos', ['Para só consultar a escala, os avisos e a agenda, <b>não precisa entrar</b>: é só abrir o link.', 'Para preencher a escala, publicar avisos, fazer check-in ou usar o bate-papo, toque em <b>Entrar</b>, no topo da tela.', 'O jeito mais fácil é <b>Continuar com Google</b> (quem tem Gmail). Ou entre com e-mail e senha: na primeira vez, toque em <b>Criar conta</b> e confirme pelo link que chega no e-mail.', 'Esqueceu a senha? Toque em <b>Esqueci minha senha</b> e siga o link que chega no e-mail.', 'Neste aparelho, você continua conectado. Para sair, toque em <b>Sair</b>, embaixo do seu nome.', 'Para ter um atalho no celular: no iPhone, toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>. No Android, toque no menu ⋮ e depois em <b>Adicionar à tela inicial</b>.', 'Este tutorial fica sempre no botão <b>❓ Como usar</b>, no topo da tela.'], true);
  h += passo('2. Tela inicial', ['No cartão grande fica o <b>próximo domingo</b>, com o culto da manhã (amarelo) e o da noite (azul).', 'Toque numa área, como Direção do culto ou Louvor, para ver quem está escalado em cada função.', 'Logo abaixo vem o domingo seguinte, em <b>Em seguida</b>.', 'Depois vêm a <b>Agenda</b> e os <b>Avisos</b>. Toque em um item para ver os detalhes. Os botões amarelos levam para a inscrição e os verdes abrem o WhatsApp de quem organiza.', 'No final ficam o Instagram, o YouTube e o endereço da igreja.']);
  h += passo('3. Fazer seu cadastro (líder, auxiliar ou organização)', ['Toque em <b>Entrar</b> e entre com o seu e-mail.', 'Na tela inicial, preencha o cartão <b>É líder, auxiliar ou da organização da conexão?</b>', 'Coloque seu nome completo, o WhatsApp com DDD, a sua conexão e a sua função.', 'Toque em <b>Enviar cadastro</b> e depois em <b>Avisar o administrador pelo WhatsApp</b>.', 'Depois de enviado, a conexão só pode ser trocada por um administrador.', 'Quem só vai consultar não precisa se cadastrar.']);
  h += passo('4. Ver a escala', ['Toque na aba <b>Escala</b>, embaixo.', 'Cada linha é um culto: a data fica à esquerda, com manhã ou noite logo abaixo.', 'As colunas são as áreas: Direção do culto, Super Kids, Mídia, Staff, Ministração e Louvor. No celular, deslize a tabela para o lado.', 'Toque em qualquer nome para abrir a página com cada função e quem está nela.', 'Use as setas ‹ › ao lado do mês para ver outros meses.']);
  h += passo('5. Preencher a escala da sua conexão', ['Na aba <b>Escala</b>, encontre o domingo em que a sua conexão está na Direção do culto ou no Super Kids.', 'Toque no nome da sua conexão e depois em <b>Preencher escala</b> (ou <b>Editar escala</b>).', 'Digite os nomes em cada função. Vaga vazia aparece como “vaga aberta”.', 'Toque em <b>Salvar escala</b>. Pronto, todo mundo já vê.', 'Você só consegue editar os dias da sua conexão. As conexões Flechas, Forasteiros e Heróis também preenchem o Louvor. Quem tem a permissão <b>Escala</b> preenche a Direção do culto e o Super Kids de qualquer conexão.']);
  h += passo('6. Imprimir o check-in (Gestão)', ['Na aba <b>Escala</b>, no final de cada linha, toque em <b>Baixar PDF</b> ou <b>Baixar Excel</b>.', 'Na tela inicial também há o botão <b>Check-in do dia</b>.', 'A folha sai com Função, Nome, Check-in e as assinaturas de retirada e de devolução do equipamento e do crachá.', 'No dia, use a aba <b>Check-in</b> para marcar quem chegou, quem retirou e quem devolveu. As marcações aparecem na hora em todos os celulares.']);
  h += passo('7. Avisos e agenda', ['Na aba <b>Avisos</b> ficam os comunicados, e na <b>Agenda</b> ficam os eventos com data.', 'Quando houver, toque em <b>Fazer inscrição</b> ou no botão do WhatsApp.', 'Quem tem a permissão <b>Avisos/Eventos</b> publica pelo botão <b>+</b>.']);
  if (isAdm()) {
    h += passo('8. Histórico', ['A aba <b>Histórico</b> mostra tudo o que foi criado, editado ou excluído: quem fez, o quê, e a data e a hora.']);
    h += passo('9. Para administradores', ['Em <b>Ajustes</b>, aprove os cadastros em <b>Pessoas e permissões</b>: escolha a função e a conexão e toque em <b>Salvar pessoas</b>.', 'Para convidar alguém, use <b>Convidar pelo WhatsApp</b> em Ajustes: a mensagem já vai com o link e o passo a passo.', 'Administradores preenchem todas as áreas e também podem criar <b>+ Culto extra</b>.', 'Para preencher várias escalas de uma vez, use <b>Importar escala</b> na aba Escala: escolha um Excel, CSV ou PDF, confira a prévia e toque em <b>Confirmar importação</b>. Ele preenche a Direção do culto e o Super Kids (conexões), o Louvor e a Mídia (nomes).', 'Em Ajustes também ficam os cultos, as conexões, as redes sociais e as postagens em destaque.']);
  }
  h += '<div class="end" style="justify-content:center;margin:18px 0"><button class="btn" data-go="inicio">Começar a usar</button></div>';
  return h;
}

/* ---------- convite pelo WhatsApp ---------- */
const LINK_PAINEL = () => location.origin + location.pathname;
const msgConvite = n => 'Olá'+(n.trim()?', '+n.trim().split(' ')[0]:'')+'! Graça e paz! 🙌\n\nVocê foi convidado(a) para o Painel da '+((S.cfg&&S.cfg.igreja)||'igreja')+', onde ficam as escalas, os avisos e a agenda.\n\n*Como entrar:*\n1. Abra o painel por este link: '+LINK_PAINEL()+'#ajuda\n2. Toque em *Entrar*, no topo, e depois em *Continuar com Google* (se tiver Gmail). Sem Gmail: toque em *Criar conta*, cadastre e-mail e senha e confirme pelo link que chega no e-mail.\n3. Entre no painel.\n4. Na tela inicial, preencha o cadastro: nome completo, WhatsApp, sua conexão e se você é líder, auxiliar ou da organização.\n5. Aguarde a aprovação de um administrador. Depois disso, você já consegue preencher a escala da sua conexão.\n\nNa primeira vez, aparece um tutorial com o passo a passo de tudo. Ele fica sempre no botão ❓ Como usar, no topo.\n\nQualquer dúvida, é só me chamar!';
const waUrl = (tel, txt) => { let d = String(tel||'').replace(/\D/g,''); if (d && d.length <= 11) d = '55'+d; return 'https://wa.me/'+d+'?text='+encodeURIComponent(txt); };
document.addEventListener('input', e => { if (e.target.id==='cvN' || e.target.id==='cvW') { const a = $('#cvLink'); if (a) a.href = waUrl($('#cvW').value, msgConvite($('#cvN').value)); } });

/* ---------- AJUSTES (administrador) ---------- */
const DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
function viewAjustes(){
  if (!isAdm()) return '<div class="empty">Só administradores acessam os ajustes.</div>';
  const c = S.cfg || {};
  let html = '<h2 class="section-title">Ajustes do painel</h2><div class="card"><form id="cfgForm">'
    + '<label class="f" for="cI">Nome da igreja</label><input class="inp" id="cI" name="igreja" value="'+esc(c.igreja||'')+'">'
    + '<label class="f" for="cC">Conexões</label><textarea class="inp" id="cC" name="conexoes">'+esc(conexoes().map(x=>x.nome).join('\n'))+'</textarea><div class="hint">Uma por linha. A ordem alfabética é automática.</div>'
    + '<label class="f" for="cU">Cultos</label><textarea class="inp" id="cU" name="cultos">'+esc(cultos().map(x=>x.nome+(x.hora?' | '+x.hora:'')).join('\n'))+'</textarea><div class="hint">Um por linha, no formato Nome | horário. Ex.: Manhã | 10h</div>'
    + '<label class="f" for="cIg">Link do Instagram</label><input class="inp" id="cIg" name="instagram" type="url" value="'+esc(((c.redes||{}).instagram)||'')+'">'
    + '<label class="f" for="cYt">Link do YouTube</label><input class="inp" id="cYt" name="youtube" type="url" value="'+esc(((c.redes||{}).youtube)||'')+'">'
    + '<label class="f" for="cDs">Postagens em destaque (opcional)</label><textarea class="inp" id="cDs" name="destaques" placeholder="Título | link do post ou vídeo">'+esc(((c.destaques)||[]).map(d=>d.titulo+' | '+d.link).join('\n'))+'</textarea><div class="hint">Uma por linha, no formato Título | link. Aparecem na tela inicial, em “Redes sociais”.</div>'
    + '<label class="f">Dias de culto</label><div class="chips">'+DIAS.map((d,i)=>'<label class="chip"><input type="checkbox" name="dia" value="'+i+'"'+(diasCulto().includes(i)?' checked':'')+'> '+d+'</label>').join('')+'</div>'
    + '<label class="f" for="cW">WhatsApp do administrador (recebe os avisos de cadastro)</label><input class="inp" id="cW" name="whatsAdm" type="tel" inputmode="tel" value="'+esc(S.whatsAdm||'5511958800779')+'"><div class="hint">Com DDI e DDD, só números. Ex.: 5511999999999</div>'
    + '<div class="end"><button type="submit" class="btn">Salvar ajustes</button></div></form></div>';
  html += '<h2 class="section-title">Áreas da escala</h2><div class="card">' + areas().map(a => '<p class="fn" style="margin:0 0 10px"><strong>'+esc(a.nome)+'</strong>'+(a.porConexao?'<span class="tag">por conexão</span>':'')+'<br><span class="meta">'+a.funcoes.map(f=>esc(f.nome)+(f.vagas?' ('+f.vagas+')':' (livre)')).join(', ')+'</span></p>').join('') + '<p class="hint">Para mudar áreas, funções ou quantidade de vagas, é só pedir ao Claude.</p></div>';
  html += '<h2 class="section-title">Convidar pelo WhatsApp</h2><div class="card"><p class="meta" style="margin:0">Mande para a pessoa o link do painel e o passo a passo para entrar e se cadastrar.</p>'
    + '<div class="row"><div><label class="f" for="cvN">Nome</label><input class="inp" id="cvN" autocomplete="off"></div><div><label class="f" for="cvW">WhatsApp com DDD</label><input class="inp" id="cvW" type="tel" inputmode="tel" placeholder="(11) 99999-9999"></div></div>'
    + '<div class="end"><a class="btn zap" id="cvLink" target="_blank" rel="noopener" href="'+esc(waUrl('', msgConvite('')))+'">Enviar passo a passo no WhatsApp</a></div>'
    + '<p class="hint">Sem número, o WhatsApp abre para você escolher o contato ou um grupo.</p></div>';
  html += '<h2 class="section-title">Pessoas e permissões</h2>';
  const ids = [...new Set([...S.membros, ...Object.keys(S.cadastros||{}), ...Object.keys(S.pessoas||{})])].filter(id => id && id!==S.uid);
  const nAdm = Object.values(S.pessoas||{}).filter(p=>p.papel==='admin' && p.id!==S.uid).length;
  if (!ids.length) html += '<div class="empty">Ninguém além de você entrou no painel ainda. Quando cada pessoa entrar e enviar o cadastro, ela aparece aqui para você aprovar.</div>';
  else html += '<div class="card tbl-wrap"><table class="lead"><thead><tr><th>Pessoa</th><th>Pediu</th><th>Função</th><th>Conexão</th><th>Extras</th><th></th></tr></thead><tbody>'
    + ids.map(id => { const atual = S.pessoas[id]; const ped = (S.cadastros||{})[id]; const base = atual || ped || {papel:'leitura', conexao:''};
      const wpp = base.whatsapp || (ped && ped.whatsapp) || '';
      return '<tr><td>'+esc(nomeComp(id))+(atual?'':' <span class="tag">novo</span>')+(S.emails[id] && nomeComp(id)!==S.emails[id]?'<br><span class="meta">'+esc(S.emails[id])+'</span>':'')+(wpp?'<br><a class="meta" style="color:var(--green)" href="https://wa.me/'+(String(wpp).replace(/\D/g,'').length<=11?'55':'')+String(wpp).replace(/\D/g,'')+'" target="_blank" rel="noopener">WhatsApp '+esc(wpp)+'</a>':'')+'</td><td class="meta">'+(ped?esc((PAPEIS[ped.papel]||'')+(ped.conexao?' · '+conexaoNome(ped.conexao):'')):'—')+'</td>'
        + '<td><select class="inp" data-p-papel="'+esc(id)+'">'+opts(Object.entries(PAPEIS).map(([k,v])=>({id:k,nome:v})), base.papel)+'</select></td>'
        + '<td><select class="inp" data-p-con="'+esc(id)+'"><option value="">—</option>'+opts(conexoes(), base.conexao||'')+'</select></td><td style="white-space:nowrap"><label class="chip" style="margin:0 0 6px"><input type="checkbox" data-p-gestao="'+esc(id)+'"'+(atual&&atual.gestao?' checked':'')+'> Gestão</label><br><label class="chip" style="margin:0"><input type="checkbox" data-p-min="'+esc(id)+'"'+(atual&&atual.ministro?' checked':'')+'> Ministro</label><br><label class="chip" style="margin:6px 0 0"><input type="checkbox" data-p-av="'+esc(id)+'"'+(atual&&atual.avisos?' checked':'')+'> Avisos/Eventos</label><br><label class="chip" style="margin:6px 0 0"><input type="checkbox" data-p-esc="'+esc(id)+'"'+(atual&&atual.escala?' checked':'')+'> Escala</label></td><td><button class="btn small danger" data-rm-pessoa="'+esc(id)+'">Remover</button></td></tr>'; }).join('')
    + '</tbody></table><div class="end"><button class="btn" data-salvar-pessoas>Salvar pessoas</button></div></div>';
  html += '<p class="hint">Administradores podem tudo (hoje: '+(nAdm+1)+' contando você; o ideal é até 5). Líder, Auxiliar e Organização preenchem a Direção do culto e o Super Kids nos dias em que a conexão deles está escalada; se a conexão for Flechas, Forasteiros ou Heróis, também o Louvor. <b>Extras:</b> Gestão vê a aba Check-in e imprime o check-in (PDF e Excel); Ministro pode editar a escala de Louvor; Avisos/Eventos pode publicar avisos e eventos (e editar ou excluir os que publicou); Escala pode preencher os nomes da Direção do culto e do Super Kids de qualquer conexão. Os extras valem junto com qualquer função.</p>';
  return html;
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'cfgForm') return; e.preventDefault();
  const fd = new FormData(e.target); const old = S.cfg || {};
  const lines = k => String(fd.get(k)||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const data = { ...old, igreja:String(fd.get('igreja')||'').trim(),
    conexoes: lines('conexoes').map(n=>({id:slug(n), nome:n})),
    cultos: lines('cultos').map(l => { const [n,h] = l.split('|').map(s=>s.trim()); return {id:slug(n), nome:n, hora:h||''}; }),
    diasCulto: fd.getAll('dia').map(Number),
    redes: {...(old.redes||{}), instagram:String(fd.get('instagram')||'').trim(), youtube:String(fd.get('youtube')||'').trim()},
    destaques: lines('destaques').map(l => { const k = l.lastIndexOf('|'); return k > 0 ? {titulo:l.slice(0,k).trim(), link:l.slice(k+1).trim()} : null; }).filter(Boolean) };
  const wpp = String(fd.get('whatsAdm')||'').replace(/\D/g,'');
  const b = e.target.querySelector('[type=submit]'); b.disabled = true;
  if (await salvar(ref('config','geral'), data, {acao:'editou', tipo:'config', resumo:'Ajustes do painel', antes:old})) {
    if (wpp && wpp !== S.whatsAdm) { const r = await sb.from('config_privada').upsert({id:'geral', d:{whatsAdm:wpp}}); if (r.error) falhaEscrita(r.error); }
    await carregarConfig(); toast('Ajustes salvos'); render();
  }
  b.disabled = false;
});
document.addEventListener('click', async e => {
  const t = e.target.closest('button[data-rm-pessoa]'); if (!t || !isAdm()) return;
  const id = t.dataset.rmPessoa; const quem = nomeComp(id), quemCurto = nome(id);
  if (!await confirmar('Remover o cadastro de '+quem+'?\n\nA função, a permissão, a conexão, o nome, o apelido, o WhatsApp e o pedido de cadastro serão apagados. Se a pessoa entrar de novo, ela volta para o modo consulta e precisa fazer o cadastro outra vez.')) return;
  t.disabled = true;
  try {
    for (const tab of ['pessoas','cadastros','acessos']) { const r = await sb.from(tab).delete().eq('id', id); if (r.error) throw r.error; }
    await logar('excluiu', 'config', 'Cadastro removido: '+quemCurto, null, null);
    toast('Cadastro de '+quem+' removido');
    await carregarPessoas(); renderTabs(); render();
  } catch(err){ falhaEscrita(err); }
  finally { t.disabled = false; }
});
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t || !('salvarPessoas' in t.dataset) || !isAdm()) return;
  const pessoas = {};
  document.querySelectorAll('[data-p-papel]').forEach(sel => { const id = sel.dataset.pPapel; const con = document.querySelector('[data-p-con="'+id+'"]').value;
    const ant = S.pessoas[id] || {}; const ped = (S.cadastros||{})[id] || {};
    pessoas[id] = {id, email: ant.email || ped.email || S.emails[id] || null, papel: sel.value, conexao: con || null, nome: ant.nome || ped.nome || (S.names[id]||{}).nome || '', apelido: ant.apelido || ped.apelido || '', whatsapp: ant.whatsapp || ped.whatsapp || '', gestao: !!(document.querySelector('[data-p-gestao="'+id+'"]')||{}).checked, ministro: !!(document.querySelector('[data-p-min="'+id+'"]')||{}).checked, avisos: !!(document.querySelector('[data-p-av="'+id+'"]')||{}).checked, escala: !!(document.querySelector('[data-p-esc="'+id+'"]')||{}).checked}; });
  const falta = Object.entries(pessoas).filter(([id,p]) => ehEquipe(p) && !p.conexao);
  if (falta.length) { toast('Escolha a conexão de '+falta.map(([id])=>nome(id)).join(', ')+'.'); return; }
  const nAdm = Object.values(pessoas).filter(p=>p.papel==='admin').length;
  if (nAdm > 4 && !await confirmar('Serão '+(nAdm+1)+' administradores contando você. O ideal é até 5. Confirmar?')) return;
  const resumo = 'Pessoas: ' + (Object.entries(pessoas).filter(([,p])=>p.papel!=='leitura').map(([id,p]) => (p.apelido || primeiro(p.nome) || nome(id))+' ('+PAPEIS[p.papel]+(p.conexao&&p.papel!=='admin'?' · '+conexaoNome(p.conexao):'')+')').join('; ') || 'só consulta');
  t.disabled = true;
  try {
    const lista = Object.values(pessoas); if (!lista.length) return;
    const r = await sb.from('pessoas').upsert(lista); if (r.error) throw r.error;
    await logar('editou', 'config', resumo, null, null);
    toast('Pessoas salvas'); await carregarPessoas(); renderTabs(); render();
  } catch(err){ falhaEscrita(err); }
  finally { t.disabled = false; }
});

/* ---------- BATE-PAPO ---------- */
// Só para pessoas aprovadas (com linha em "pessoas"). O banco também garante isso (RLS).
const CHAT = { msgs:[], aberto:false };
const podeChat = () => !!S.uid && !!pessoaDe(S.uid);
const chaveVisto = () => 'chatVisto:'+S.uid;
const chatVisto = () => { try { return localStorage.getItem(chaveVisto()) || ''; } catch(e){ return ''; } };
const marcarVisto = () => { const u = CHAT.msgs[CHAT.msgs.length-1]; if (u) try { localStorage.setItem(chaveVisto(), u.em); } catch(e){} };
const naoLidas = () => { const v = chatVisto(); return CHAT.msgs.filter(m => m.por !== S.uid && m.em > v).length; };
async function carregarChat(){
  if (!podeChat()) { CHAT.msgs = []; return; }
  const r = await sb.from('chat').select('id,texto,por,em').order('em', {ascending:false}).limit(300);
  if (r.error) { console.warn(r.error); return; }
  CHAT.msgs = (r.data||[]).reverse();
}
function chatAtualizado(){ if (CHAT.aberto) { desenharMensagens(); marcarVisto(); } renderWho(); }
const horaDe = iso => new Date(iso).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
function rotuloDia(d){ if (d === hoje()) return 'Hoje'; if (d === somaDias(hoje(), -1)) return 'Ontem'; const t = fmtDia(d); return t.charAt(0).toUpperCase()+t.slice(1); }
function desenharMensagens(){
  const l = $('#chatLista'); if (!l) return;
  if (!CHAT.msgs.length) { l.innerHTML = '<div class="empty" style="margin:auto 0">Nenhuma mensagem ainda. Escreva a primeira!</div>'; return; }
  let dia = '', h = '';
  CHAT.msgs.forEach(m => {
    const d = isoLocal(new Date(m.em)); if (d !== dia) { dia = d; h += '<div class="dia-sep">'+esc(rotuloDia(d))+'</div>'; }
    const minha = m.por === S.uid, apaga = minha || isAdm();
    h += '<div class="msg'+(minha?' minha':'')+'">'+(minha ? '' : '<div class="de">'+esc(m.por ? nome(m.por) : 'Alguém')+'</div>')
      + '<div class="tx">'+linkify(m.texto)+'</div><div class="h">'+(apaga ? '<button class="apagar" data-apagar-msg="'+esc(m.id)+'">apagar</button>' : '')+'<span>'+esc(horaDe(m.em))+'</span></div></div>';
  });
  const fim = l.scrollHeight - l.scrollTop - l.clientHeight < 80;
  l.innerHTML = h;
  if (fim || !l.dataset.rolou) { l.scrollTop = l.scrollHeight; l.dataset.rolou = '1'; }
}
function abrirChat(){
  if (!podeChat() || CHAT.aberto) return;
  CHAT.aberto = true;
  const o = document.createElement('div'); o.id = 'chat'; o.className = 'chatbox'; o.setAttribute('role','dialog'); o.setAttribute('aria-label','Bate-papo');
  o.innerHTML = '<div class="chat-top"><button class="btn ghost small" data-fechar-chat>‹ Voltar</button><h2>💬 Bate-papo</h2></div>'
    + '<div class="chat-lista" id="chatLista"></div>'
    + '<form class="chat-form" id="chatForm"><textarea class="inp" id="chatTx" name="texto" rows="1" maxlength="1000" placeholder="Mensagem" aria-label="Mensagem"></textarea><button type="submit" class="btn" aria-label="Enviar">➤</button></form>';
  document.body.appendChild(o); document.body.style.overflow = 'hidden';
  try { history.pushState({chat:1}, '', location.hash || '#'+S.tab); } catch(e){}
  desenharMensagens(); marcarVisto(); renderWho();
  carregarChat().then(chatAtualizado);
}
function fecharChat(){
  if (!CHAT.aberto) return;
  CHAT.aberto = false; const o = $('#chat'); if (o) o.remove(); document.body.style.overflow = ''; renderWho();
}
window.addEventListener('popstate', () => fecharChat());
async function enviarChat(){
  const tx = $('#chatTx'); const texto = tx.value.trim();
  if (!texto) return;
  if (texto.length > 1000) { toast('A mensagem pode ter até 1000 caracteres.'); return; }
  tx.disabled = true;
  try { const r = await sb.from('chat').insert({texto}); if (r.error) throw r.error; tx.value = ''; tx.style.height = ''; await carregarChat(); const l = $('#chatLista'); if (l) l.dataset.rolou = ''; chatAtualizado(); }
  catch(e){ falhaEscrita(e); }
  finally { tx.disabled = false; tx.focus(); }
}
document.addEventListener('click', async e => {
  if (e.target.closest('[data-chat]')) abrirChat();
  if (e.target.closest('[data-fechar-chat]')) { if (history.state && history.state.chat) history.back(); else fecharChat(); }
  const b = e.target.closest('[data-apagar-msg]');
  if (b && await confirmar('Apagar esta mensagem?')) {
    try { const r = await sb.from('chat').delete().eq('id', b.dataset.apagarMsg).select('id'); if (r.error) throw r.error; if (!r.data || !r.data.length) throw {code:'42501'}; await carregarChat(); chatAtualizado(); }
    catch(err){ falhaEscrita(err); }
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'chatForm') { e.preventDefault(); enviarChat(); } });
document.addEventListener('keydown', e => { if (e.target.id === 'chatTx' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviarChat(); } });
document.addEventListener('input', e => { if (e.target.id === 'chatTx') { const t = e.target; t.style.height = ''; t.style.height = Math.min(t.scrollHeight, 120)+'px'; } });

init();
})();
