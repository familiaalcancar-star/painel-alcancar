// Telão do sorteio sobre a arte "DESPERTA". Só mostra; quem sorteia é o banco (rpc sortear).
// A rolagem de nomes é só efeito visual: o nome final é sempre o que veio do banco.
// Modos: ?k=<código> → SEM login (consulta sorteio_tela a cada 1,5 s; a faixa é só informativa).
//        sem ?k      → login do painel (tempo real + conferência a cada 4 s); quem pode sortear usa a faixa como botão
//                      (clique, barra de espaço, Enter ou passador de slides / setas).
const T = { ev: null, dia: null, atual: null, visto: new Set(), animando: false, n: null, timer: null,
  link: param('k'), nomesLink: [], ultLink: null, sorteia: false, ocupado: false };
const Q = $('#quadro'), NOME = $('#nome'), SUB = $('#sub'), FAIXA = $('#faixa');

// ---------- Desenho ----------
function estado(e){ Q.dataset.estado = e; }
function faixa(txt, botao){
  FAIXA.textContent = txt; caberFaixa();
  const pode = !!botao && T.sorteia && !T.ocupado; FAIXA.disabled = !pode; FAIXA.classList.toggle('pode', pode);
}
// Nome em 1 linha (no máximo 2), o maior possível dentro da caixa: escolhe 2 linhas só se ficar bem maior.
function maior(el, larg, alt, linhas){
  el.style.whiteSpace = linhas === 1 ? 'nowrap' : 'normal';
  let lo = 8, hi = linhas === 1 ? alt : alt / 2;
  for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; el.style.fontSize = m + 'px';
    const cabe = el.scrollWidth <= larg && el.scrollHeight <= alt * 1.02 && (linhas === 1 || el.getClientRects().length <= 1 && el.offsetHeight <= m * 1.02 * 2.1);
    if (cabe) lo = m; else hi = m; }
  return lo;
}
function caber(txt){
  NOME.classList.remove('espera'); NOME.textContent = txt; SUB.textContent = '';
  const cx = NOME.parentElement.getBoundingClientRect(), larg = cx.width * .9, alt = cx.height * .62;
  const um = maior(NOME, larg, alt * .8, 1);
  const dois = /\s/.test(txt.trim()) ? maior(NOME, larg, alt, 2) : 0;
  if (dois > um * 1.25) { NOME.style.whiteSpace = 'normal'; NOME.style.fontSize = dois + 'px'; }
  else { NOME.style.whiteSpace = 'nowrap'; NOME.style.fontSize = um + 'px'; }
}
// Texto da faixa sempre inteiro (diminui a letra se precisar).
function caberFaixa(){
  const h = FAIXA.offsetHeight; if (!h) return; // offsetHeight: tamanho real, sem o efeito de entrada (scale)
  let t = h * .42; FAIXA.style.fontSize = t + 'px';
  while (t > 8 && FAIXA.scrollWidth > FAIXA.clientWidth) { t *= .94; FAIXA.style.fontSize = t + 'px'; }
}
function textoCaixa(txt, sub){ NOME.style.fontSize = ''; NOME.style.whiteSpace = ''; NOME.classList.add('espera'); NOME.textContent = txt; SUB.textContent = sub || ''; }
const concTxt = () => T.n == null ? '' : T.n + (T.n === 1 ? ' pessoa concorrendo' : ' pessoas concorrendo');

function espera(){
  T.atual = null; clearTimeout(T.timer); estado('espera');
  textoCaixa('Prepare-se!', concTxt());
  faixa(T.sorteia ? 'SORTEAR' : 'AGUARDANDO SORTEIO…', true);
}
function sorteado(s){
  estado('sorteado'); caber(s.nome); SUB.textContent = '';
  faixa(s.premio ? '🎁 ' + s.premio : 'SORTEADO!', false);
}
function resultado(s){
  clearTimeout(T.timer);
  if (s.status === 'ganhador' || s.status === 'retirado') {
    estado('ganhador'); caber(s.nome); SUB.textContent = ''; faixa('🎉 GANHADOR!', false); confete(6000);
    if (T.sorteia) T.timer = setTimeout(() => { if (T.atual && T.atual.id === s.id) faixa('SORTEAR', true); }, 6000);
  } else if (s.status === 'ausente') {
    estado('sorteado'); faixa('AUSENTE · SORTEANDO OUTRO', false);
    T.timer = setTimeout(() => { if (T.atual && T.atual.id === s.id && T.atual.status === 'ausente') { espera(); contar(); } }, 5000);
  } else if (s.status === 'liberado') espera();
  else sorteado(s);
}
function linkInvalido(){ T.atual = null; estado('invalido'); textoCaixa('Link inválido ou trocado', 'Peça o link novo a quem conduz o sorteio.'); faixa('SORTEIO', false); }

// ---------- Dados ----------
async function contar(){
  if (T.link) { if (Q.dataset.estado === 'espera') SUB.textContent = concTxt(); return T.nomesLink.map(nome => ({ nome })); }
  const r = await SB.rpc('sorteio_elegiveis', { p_evento: T.ev.id, p_dia: T.dia });
  if (!r.error) { T.n = (r.data || []).length; if (Q.dataset.estado === 'espera') SUB.textContent = concTxt(); }
  return r.error ? [] : (r.data || []);
}
async function animar(s){
  T.animando = true; T.atual = s; T.visto.add(s.id); clearTimeout(T.timer);
  const lista = (await contar()).map(x => x.nome); if (!lista.includes(s.nome)) lista.push(s.nome);
  const nomes = lista.length > 1 ? lista : [s.nome, '…'];
  estado('sorteando'); SUB.textContent = ''; faixa('SORTEANDO…', false);
  const dur = 7000, ini = performance.now(); let i = Math.floor(Math.random() * nomes.length), ult = 0;
  await new Promise(fim => {
    const passo = agora => { const t = Math.min(1, (agora - ini) / dur), intervalo = 50 + 430 * t * t * t; // desacelera
      if (agora - ult >= intervalo) { ult = agora; i = (i + 1) % nomes.length; if (nomes[i] === s.nome && t < .97 && nomes.length > 2) i = (i + 1) % nomes.length; caber(nomes[i]); }
      if (t < 1) requestAnimationFrame(passo); else fim(); };
    requestAnimationFrame(passo); });
  T.animando = false; sorteado(s); confete(2500);
  const atual = (T.atual && T.atual.id === s.id && T.atual.status !== 'sorteado') ? T.atual : await buscar(s.id);
  if (atual && atual.status !== 'sorteado') { T.atual = atual; resultado(atual); }
}
async function buscar(id){
  if (T.link) return T.ultLink && T.ultLink.id === id ? T.ultLink : null;
  const r = await SB.from('sorteios').select('*').eq('id', id).limit(1); return (r.data || [])[0] || null;
}
function aplicar(s){
  if (T.animando) { if (T.atual && s.id === T.atual.id) T.atual = s; return; }
  if (s.status === 'sorteado' && !T.visto.has(s.id)) return animar(s);
  if (!T.atual || s.id !== T.atual.id) return;
  T.atual = s; resultado(s);
}
const recente = s => Date.now() - new Date(s.atualizado_em || s.em).getTime() < 10 * 60000;
function primeiro(u){ // ao abrir: não anima o que já tinha acontecido
  if (u) T.visto.add(u.id);
  if (u && ['sorteado', 'ganhador', 'retirado'].includes(u.status) && recente(u)) { T.atual = u; resultado(u); }
  else espera();
}

// Modo link (sem login)
async function pollLink(){
  const r = await SB.rpc('sorteio_tela', { p_token: T.link }); if (r.error) return; // falha de rede: tenta de novo
  const j = r.data || { ok: false };
  if (!j.ok) { T.ev = null; linkInvalido(); return; }
  const novo = !T.ev || T.ev.id !== j.evento;
  T.ev = { id: j.evento, titulo: j.titulo }; T.dia = j.dia; T.n = j.concorrendo; T.nomesLink = Array.isArray(j.nomes) ? j.nomes : []; T.ultLink = j.ultimo || null;
  if (novo && !T.animando) return primeiro(T.ultLink);
  const u = T.ultLink;
  if (u && (!T.atual || u.id !== T.atual.id || u.status !== T.atual.status)) aplicar(u);
  if (!T.atual && !T.animando && Q.dataset.estado === 'espera') SUB.textContent = concTxt();
}
// Modo logado
async function conferir(){
  const r = await SB.from('sorteios').select('*').eq('evento', T.ev.id).order('em', { ascending: false }).limit(1);
  const s = (r.data || [])[0]; if (s && (!T.atual || s.id !== T.atual.id || s.status !== T.atual.status)) aplicar(s);
  if (!T.atual && !T.animando) contar();
}
async function sortearAqui(){
  if (!T.sorteia || T.ocupado || T.animando || FAIXA.disabled) return;
  T.ocupado = true; faixa('SORTEANDO…', false);
  const r = await SB.rpc('sortear', { p_evento: T.ev.id, p_dia: T.dia, p_premio: '' }); T.ocupado = false;
  if (r.error) { faixa(/Confirme/.test(r.error.message || '') ? 'CONFIRME O SORTEADO NO CONTROLE' : /Ninguém/.test(r.error.message || '') ? 'NINGUÉM PARA SORTEAR' : 'TENTE DE NOVO', false);
    setTimeout(() => { if (!T.animando && (!T.atual || T.atual.status !== 'sorteado')) faixa('SORTEAR', true); }, 3000); return; }
  if (r.data && !T.visto.has(r.data.id)) animar(r.data);
}
FAIXA.addEventListener('click', sortearAqui);
document.addEventListener('keydown', e => {
  if (['Space', 'Enter', 'NumpadEnter', 'PageDown', 'ArrowRight', 'ArrowDown'].includes(e.code)) { e.preventDefault(); sortearAqui(); }
  if (e.key === 'f' || e.key === 'F') telaCheia();
});

// ---------- Confete (só visual) ----------
let confeteAte = 0, pecas = [];
function confete(ms){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#confete'), cx = cv.getContext('2d'), r = Q.getBoundingClientRect(); cv.width = r.width; cv.height = r.height;
  const cores = ['#FFC23D', '#FFE08A', '#F29A1A', '#FF7A1A', '#FFF6E5'];
  for (let k = 0; k < 200; k++) pecas.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .7, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, s: 5 + Math.random() * 7, a: Math.random() * 6.28, va: (Math.random() - .5) * .3, c: cores[k % cores.length] });
  const rodando = confeteAte > performance.now(); confeteAte = performance.now() + ms; if (rodando) return;
  const quadro = () => { cx.clearRect(0, 0, cv.width, cv.height); const vivo = performance.now() < confeteAte;
    pecas.forEach(p => { p.x += p.vx; p.y += p.vy; p.a += p.va; if (p.y > cv.height + 20 && vivo) { p.y = -20; p.x = Math.random() * cv.width; }
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); });
    pecas = pecas.filter(p => p.y < cv.height + 30); if (pecas.length) requestAnimationFrame(quadro); else cx.clearRect(0, 0, cv.width, cv.height); };
  requestAnimationFrame(quadro);
}

// ---------- Tela cheia, tela acesa, cursor escondido ----------
async function manterAcesa(){ try { if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch(e){} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') manterAcesa(); });
function telaCheia(){ manterAcesa(); if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || function(){}).call(document.documentElement); }
document.addEventListener('dblclick', telaCheia);
let tCursor; const mexeu = () => { document.body.classList.remove('sem-cursor'); clearTimeout(tCursor); tCursor = setTimeout(() => document.body.classList.add('sem-cursor'), 3000); };
['mousemove', 'mousedown', 'touchstart'].forEach(ev => document.addEventListener(ev, mexeu, { passive: true })); mexeu();
setTimeout(() => $('#dica').classList.add('some'), 6000);
addEventListener('resize', () => { caberFaixa(); if (T.atual && !T.animando && Q.dataset.estado !== 'espera' && Q.dataset.estado !== 'invalido') caber(T.atual.nome); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { caberFaixa(); if (T.atual && !T.animando && Q.dataset.estado !== 'espera') caber(T.atual.nome); });

// ---------- Início ----------
async function iniciarLink(){ manterAcesa(); await pollLink(); setInterval(() => { if (document.visibilityState === 'visible') pollLink(); }, 1500); }
async function iniciarLogado(){
  const app = $('#app');
  const { data } = await SB.auth.getSession();
  if (!(data && data.session)) { Q.hidden = true; app.hidden = false; }
  exigirLogin(app, async () => {
    Q.hidden = false; app.hidden = true;
    let evs = []; try { evs = await eventosSorteio(); } catch(e){}
    T.ev = evs.find(x => x.id === param('evento')) || evs.find(x => x.dias.includes(hojeSP())) || evs.find(x => x.dias[x.dias.length - 1] >= hojeSP()) || evs[evs.length - 1];
    if (!T.ev) { estado('invalido'); textoCaixa('Nenhum evento com sorteio', ''); faixa('SORTEIO', false); return; }
    T.dia = param('dia') || diaPadrao(T.ev);
    const r = await SB.from('sorteios').select('*').eq('evento', T.ev.id).order('em', { ascending: false }).limit(1);
    if (r.error) { estado('invalido'); textoCaixa('Sem acesso ao sorteio', 'Entre com a conta da Gestão, da Organização ou de quem sorteia.'); faixa('SORTEIO', false); return; }
    T.sorteia = await podeSortear();
    await contar(); primeiro((r.data || [])[0]); manterAcesa();
    SB.channel('sorteio-tela').on('postgres_changes', { event: '*', schema: 'public', table: 'sorteios' }, p => { const s = p.new; if (s && s.evento === T.ev.id) aplicar(s); }).subscribe();
    setInterval(conferir, 4000);
    setInterval(() => { if (!T.atual && !T.animando) contar(); }, 15000);
  });
}
if (T.link) iniciarLink(); else iniciarLogado();
