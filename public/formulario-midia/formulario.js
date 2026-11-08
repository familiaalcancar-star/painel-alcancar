/* Formulário da Mídia — página pública (sem login).
   As listas (conhecimentos e outros ministérios) vêm do banco e o administrador edita no painel.
   O envio é feito pela função do banco enviar_formulario_midia, que confere tudo de novo
   (campos obrigatórios, idade mínima, limite de envios) e guarda uma resposta por e-mail. */
'use strict';
const sb = window.supabase.createClient(window.PAINEL.url, window.PAINEL.chave, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const NIVEIS = [['nenhum','Nenhum'], ['basico','Básico'], ['intermediario','Intermediário'], ['avancado','Avançado']];
const FUNCOES = ['Projeção', 'Transmissão', 'Câmera', 'Apoio'];
const DISP = [['manha','Domingo manhã'], ['noite','Domingo noite']];
const IDADE_MIN = 14;
const MSG_IDADE = 'É preciso ter 14 anos ou mais para preencher este formulário.';
const RASCUNHO = 'formMidiaRascunho';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
function idade(iso){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [a, m, d] = iso.split('-').map(Number), [ha, hm, hd] = hojeSP().split('-').map(Number);
  return ha - a - ((hm < m || (hm === m && hd < d)) ? 1 : 0);
}
const digitos = s => String(s || '').replace(/\D/g, '');
function mascaraZap(v){
  const d = digitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? '(' + d : '';
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());

const F = {
  etapa: '1', listas: { conhecimentos: [], ministerios: [], conexoes: [] }, erros: {}, falha: '', enviando: false,
  d: { nome:'', nascimento:'', email:'', whatsapp:'', conhecimentos:{}, funcoes:[], disponibilidade:[], iphone:null,
       conexao:'', outro_ministerio:null, ministerios:[], autorizo:false }
};
const salvarRascunho = () => { try { localStorage.setItem(RASCUNHO, JSON.stringify(F.d)); } catch(e){} };
function lerRascunho(){ try { const r = JSON.parse(localStorage.getItem(RASCUNHO) || 'null'); if (r && typeof r === 'object') Object.assign(F.d, r, { autorizo:false }); } catch(e){} }

// ---------- Etapas ----------
const ETAPAS = ['1', '2', '3', '4', '4b'];
const numEtapa = e => e === '4b' ? 4 : Number(e);
const temEnviar = () => F.etapa === '4b' || (F.etapa === '4' && F.d.outro_ministerio === false);

const erro = k => '<div class="fm-erro" id="erro-' + k + '" role="alert">' + esc(F.erros[k] || '') + '</div>';
const campo = (k, html) => '<div class="fm-campo' + (F.erros[k] ? ' erro' : '') + '" data-campo="' + k + '">' + html + erro(k) + '</div>';
const op = (tipo, nome, valor, marcado, rotulo) =>
  '<label class="fm-op"><input type="' + tipo + '" name="' + esc(nome) + '" value="' + esc(valor) + '"' + (marcado ? ' checked' : '') + '><span class="fm-marca" aria-hidden="true"></span><span>' + esc(rotulo) + '</span></label>';
const simNao = (nome, v) => '<div class="fm-ops dois" role="radiogroup">' + op('radio', nome, 'sim', v === true, 'Sim') + op('radio', nome, 'nao', v === false, 'Não') + '</div>';
const autoriza = () => campo('autorizo', '<div class="fm-autoriza">' + op('checkbox', 'autorizo', '1', F.d.autorizo, 'Autorizo a Família Alcançar a guardar estes dados para organização da equipe de Mídia.') + '</div>');

function etapa1(){
  return '<h2>Dados pessoais</h2><p>Todos os campos são obrigatórios.</p>'
    + campo('nome', '<label for="nome">Nome completo</label><input class="fm-in" id="nome" name="nome" autocomplete="name" autocapitalize="words" value="' + esc(F.d.nome) + '">')
    + campo('nascimento', '<label for="nascimento">Data de nascimento</label><input class="fm-in" id="nascimento" name="nascimento" type="date" max="' + hojeSP() + '" value="' + esc(F.d.nascimento) + '">')
    + campo('email', '<label for="email">E-mail</label><input class="fm-in" id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" value="' + esc(F.d.email) + '">')
    + campo('whatsapp', '<label for="whatsapp">WhatsApp com DDD</label><input class="fm-in" id="whatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(11) 99999-9999" value="' + esc(F.d.whatsapp) + '">');
}
function etapa2(){
  return '<h2>Conhecimentos</h2><p>Para cada item, escolha o seu nível. Todos são obrigatórios.</p>'
    + F.listas.conhecimentos.map(c => campo('c_' + c.id, '<div class="fm-q" id="q_' + esc(c.id) + '">' + esc(c.nome) + '</div><div class="fm-niveis" role="radiogroup" aria-labelledby="q_' + esc(c.id) + '">'
      + NIVEIS.map(([v, r]) => op('radio', 'c_' + c.id, v, F.d.conhecimentos[c.id] === v, r)).join('') + '</div>')).join('');
}
function etapa3(){
  return '<h2>Serviço na Mídia</h2><p>Todas as perguntas são obrigatórias.</p>'
    + campo('funcoes', '<div class="fm-q">Em quais funções gostaria de servir?<small>Pode marcar mais de uma.</small></div><div class="fm-ops dois">' + FUNCOES.map(f => op('checkbox', 'funcoes', f, F.d.funcoes.includes(f), f)).join('') + '</div>')
    + campo('disponibilidade', '<div class="fm-q">Disponibilidade para servir<small>Pode marcar mais de uma.</small></div><div class="fm-ops">' + DISP.map(([v, r]) => op('checkbox', 'disponibilidade', v, F.d.disponibilidade.includes(v), r)).join('') + '</div>')
    + campo('iphone', '<div class="fm-q">Tem iPhone?</div>' + simNao('iphone', F.d.iphone));
}
function etapa4(){
  return '<h2>Conexão e ministérios</h2><p>Todas as perguntas são obrigatórias.</p>'
    + campo('conexao', '<div class="fm-q">Conexão que faz parte</div><div class="fm-ops dois">' + F.listas.conexoes.map(c => op('radio', 'conexao', c.id, F.d.conexao === c.id, c.nome)).join('') + '</div>')
    + campo('outro_ministerio', '<div class="fm-q">Serve em algum outro ministério?</div>' + simNao('outro_ministerio', F.d.outro_ministerio))
    + (F.d.outro_ministerio === false ? autoriza() : '');
}
function etapa4b(){
  return '<h2>Outros ministérios</h2><p>Marque em quais você faz parte (pelo menos um).</p>'
    + campo('ministerios', '<div class="fm-q">Ministérios</div><div class="fm-ops dois">' + F.listas.ministerios.map(m => op('checkbox', 'ministerios', m.id, F.d.ministerios.includes(m.id), m.nome)).join('') + '</div>')
    + autoriza();
}

function render(){
  const v = $('#fm');
  if (F.etapa === 'fim') {
    v.innerHTML = '<div class="card fm-fim"><div class="fm-emoji" aria-hidden="true">🙏</div><h2>Recebemos suas informações!</h2><p>Obrigado por querer servir na Mídia da Família Alcançar. 🙏</p></div>';
    document.querySelector('.fm-nav')?.remove(); return;
  }
  const n = numEtapa(F.etapa);
  const corpo = { '1': etapa1, '2': etapa2, '3': etapa3, '4': etapa4, '4b': etapa4b }[F.etapa]();
  v.innerHTML = '<div class="fm-prog"><b>Etapa ' + n + ' de 4' + (F.etapa === '4b' ? ' · continuação' : '') + '</b><div class="fm-barra" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="' + n + '"><i style="width:' + (n * 25) + '%"></i></div></div>'
    + '<form class="fm-etapa" id="fmForm" novalidate>' + corpo + (F.falha ? '<div class="fm-falha" role="alert">' + esc(F.falha) + '</div>' : '') + '</form>';
  let nav = document.querySelector('.fm-nav');
  if (!nav) { nav = document.createElement('nav'); nav.className = 'fm-nav'; document.body.appendChild(nav); }
  nav.innerHTML = '<div>' + (F.etapa !== '1' ? '<button type="button" class="btn ghost" data-voltar>Voltar</button>' : '')
    + '<button type="button" class="btn" data-proximo' + (F.enviando ? ' disabled' : '') + '>' + (F.enviando ? 'Enviando…' : temEnviar() ? 'Enviar' : 'Próximo') + '</button></div>';
}

// ---------- Leitura dos campos ----------
function lerCampo(el){
  const d = F.d, n = el.name;
  if (n === 'nome' || n === 'email' || n === 'nascimento') d[n] = el.value;
  else if (n === 'whatsapp') { const m = mascaraZap(el.value); if (m !== el.value) el.value = m; d.whatsapp = m; }
  else if (n.startsWith('c_')) d.conhecimentos[n.slice(2)] = el.value;
  else if (n === 'funcoes' || n === 'disponibilidade' || n === 'ministerios') d[n] = [...document.querySelectorAll('input[name="' + n + '"]:checked')].map(x => x.value);
  else if (n === 'iphone') d.iphone = el.value === 'sim';
  else if (n === 'conexao') d.conexao = el.value;
  else if (n === 'outro_ministerio') { d.outro_ministerio = el.value === 'sim'; if (!d.outro_ministerio) d.ministerios = []; }
  else if (n === 'autorizo') d.autorizo = el.checked;
  salvarRascunho();
  // Tira o aviso vermelho do campo assim que a pessoa responde.
  const k = n.startsWith('c_') ? n : n;
  if (F.erros[k]) { delete F.erros[k]; const c = document.querySelector('[data-campo="' + k + '"]'); if (c) { c.classList.remove('erro'); c.querySelector('.fm-erro').textContent = ''; } }
  if (n === 'outro_ministerio') { F.falha = ''; render(); }
}
document.addEventListener('input', e => { if (e.target.closest('#fmForm') && e.target.name && !/radio|checkbox/.test(e.target.type)) lerCampo(e.target); });
document.addEventListener('change', e => { if (e.target.closest('#fmForm') && e.target.name) lerCampo(e.target); });

// ---------- Validação (a mesma regra é conferida de novo no banco) ----------
function validar(et){
  const d = F.d, er = {};
  if (et === '1') {
    if (!d.nome.trim()) er.nome = 'Preencha o nome completo.';
    else if (d.nome.trim().split(/\s+/).length < 2) er.nome = 'Escreva o nome e o sobrenome.';
    const i = idade(d.nascimento);
    if (!d.nascimento) er.nascimento = 'Preencha a data de nascimento.';
    else if (i === null || d.nascimento > hojeSP() || d.nascimento < '1900-01-01') er.nascimento = 'Data de nascimento inválida.';
    else if (i < IDADE_MIN) er.nascimento = MSG_IDADE;
    if (!d.email.trim()) er.email = 'Preencha o e-mail.';
    else if (!emailOk(d.email)) er.email = 'Informe um e-mail válido (ex.: nome@gmail.com).';
    const z = digitos(d.whatsapp).length;
    if (!z) er.whatsapp = 'Preencha o WhatsApp.';
    else if (z < 10) er.whatsapp = 'Informe o WhatsApp com DDD (mínimo 10 números).';
  }
  if (et === '2') F.listas.conhecimentos.forEach(c => { if (!d.conhecimentos[c.id]) er['c_' + c.id] = 'Escolha um nível.'; });
  if (et === '3') {
    if (!d.funcoes.length) er.funcoes = 'Marque pelo menos uma função.';
    if (!d.disponibilidade.length) er.disponibilidade = 'Marque pelo menos uma disponibilidade.';
    if (d.iphone === null) er.iphone = 'Responda Sim ou Não.';
  }
  if (et === '4') {
    if (!d.conexao) er.conexao = 'Escolha a sua conexão.';
    if (d.outro_ministerio === null) er.outro_ministerio = 'Responda Sim ou Não.';
    if (d.outro_ministerio === false && !d.autorizo) er.autorizo = 'Marque a autorização para poder enviar.';
  }
  if (et === '4b') {
    if (!d.ministerios.length) er.ministerios = 'Marque pelo menos um ministério.';
    if (!d.autorizo) er.autorizo = 'Marque a autorização para poder enviar.';
  }
  return er;
}
function mostrarErros(er){
  F.erros = er; render();
  const primeiro = document.querySelector('.fm-campo.erro');
  if (primeiro) { primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = primeiro.querySelector('input'); if (i && !/radio|checkbox/.test(i.type)) i.focus({ preventScroll: true }); }
}
function irPara(et){ F.etapa = et; F.erros = {}; F.falha = ''; render(); window.scrollTo(0, 0); }

async function enviar(){
  const d = F.d;
  // Confere todas as etapas antes de enviar (caso alguém tenha voltado e apagado algo).
  for (const et of ['1', '2', '3', '4'].concat(d.outro_ministerio ? ['4b'] : [])) {
    const er = validar(et); if (Object.keys(er).length) { F.etapa = et; mostrarErros(er); return; }
  }
  F.enviando = true; F.falha = ''; render();
  const p = { nome: d.nome.trim(), nascimento: d.nascimento, email: d.email.trim().toLowerCase(), whatsapp: d.whatsapp,
    conhecimentos: Object.fromEntries(F.listas.conhecimentos.map(c => [c.id, d.conhecimentos[c.id]])),
    funcoes: d.funcoes, disponibilidade: d.disponibilidade, iphone: d.iphone, conexao: d.conexao,
    outro_ministerio: d.outro_ministerio, ministerios: d.outro_ministerio ? d.ministerios : [], autorizo: d.autorizo };
  let r;
  try { r = await sb.rpc('enviar_formulario_midia', { p }); } catch(e) { r = { error: { message: '' } }; }
  F.enviando = false;
  if (r.error) {
    const m = r.error.message || '';
    if (/14 anos/.test(m)) { F.etapa = '1'; mostrarErros({ nascimento: MSG_IDADE }); return; }
    if (/nível em|Escolha o seu nível/.test(m)) { await carregarListas(); F.etapa = '2'; F.falha = m + ' (a lista pode ter sido atualizada).'; render(); return; }
    F.falha = m && !/fetch|network|Failed/i.test(m) ? m : 'Não foi possível enviar agora. Confira a internet e tente de novo.';
    render(); return;
  }
  try { localStorage.removeItem(RASCUNHO); } catch(e){}
  irPara('fim');
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-voltar]')) { const i = ETAPAS.indexOf(F.etapa); irPara(F.etapa === '4b' ? '4' : ETAPAS[Math.max(0, i - 1)]); return; }
  if (e.target.closest('[data-proximo]')) {
    if (F.enviando) return;
    const er = validar(F.etapa);
    if (Object.keys(er).length) { mostrarErros(er); return; }
    if (temEnviar()) { enviar(); return; }
    irPara(F.etapa === '4' ? '4b' : ETAPAS[ETAPAS.indexOf(F.etapa) + 1]);
  }
});

async function carregarListas(){
  const [c, m, cfg] = await Promise.all([
    sb.from('formulario_midia_conhecimentos').select('id,nome,ordem').eq('ativo', true).order('ordem').order('nome'),
    sb.from('formulario_midia_ministerios').select('id,nome,ordem').eq('ativo', true).order('ordem').order('nome'),
    sb.from('config').select('d').eq('id', 'geral').maybeSingle()
  ]);
  if (c.error || m.error || cfg.error) throw (c.error || m.error || cfg.error);
  F.listas.conhecimentos = c.data || [];
  F.listas.ministerios = m.data || [];
  F.listas.conexoes = (((cfg.data || {}).d || {}).conexoes || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  // Descarta do rascunho o que não existe mais.
  const ids = new Set(F.listas.ministerios.map(x => x.id)); F.d.ministerios = F.d.ministerios.filter(x => ids.has(x));
  if (F.d.conexao && !F.listas.conexoes.some(x => x.id === F.d.conexao)) F.d.conexao = '';
}

(async () => {
  lerRascunho();
  try { await carregarListas(); render(); }
  catch(e) { console.warn(e); $('#fm').innerHTML = '<div class="empty">Não foi possível carregar o formulário agora. Confira a internet e toque em <a href="">tentar de novo</a>.</div>'; }
})();
