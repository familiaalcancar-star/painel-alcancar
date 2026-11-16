// Tela do telão: só mostra. A rolagem de nomes é só efeito visual: o nome final é sempre o que o banco sorteou.
// Dois modos: com ?k=<código> funciona SEM login (consulta sorteio_tela a cada 1,5 s);
// sem ?k, usa o login do painel (tempo real + conferência a cada 4 s).
const T = { ev: null, dia: null, atual: null, visto: new Set(), animando: false, n: null, timerEspera: null, link: param('k'), nomesLink: [], ultLink: null };
const marca = ev => { const m = String(ev.titulo || '').match(/[“"]([^”"]+)[”"]/); return (m ? m[1] : (ev.titulo || 'Evento')).toUpperCase(); };
const topo = () => '<div class="topo"><img class="logo" src="../../logo.webp" alt="Família Alcançar"><span class="evento">'+esc(T.ev ? T.ev.titulo : '')+'</span></div>';

function espera(){
  T.atual = null; brilho(false);
  $('#app').innerHTML = '<div class="palco espera">'+topo()+'<h1 class="marca">SORTEIO<small>· '+esc(marca(T.ev))+' ·</small></h1>'
    + '<div class="conc"><b id="nConc">'+(T.n == null ? '…' : T.n)+'</b>'+(T.n === 1 ? 'pessoa concorrendo' : 'pessoas concorrendo')+'</div></div>';
}
function palcoSorteado(s, rolando){
  $('#app').innerHTML = '<div class="palco sorteado">'+topo()+'<div class="rot">'+(rolando ? 'SORTEANDO…' : 'SORTEADO')+'</div>'
    + '<div class="rolo'+(rolando ? ' rodando' : ' parou')+'" id="rolo">'+esc(rolando ? '' : s.nome)+'</div>'
    + '<div class="premio" id="premio">'+(!rolando && s.premio ? '🎁 '+esc(s.premio) : '')+'</div><div id="selo"></div></div>';
}
function selo(s){
  const el = $('#selo'); if (!el) return;
  if (s.status === 'ganhador' || s.status === 'retirado') { el.innerHTML = '<span class="selo">Ganhador!'+(s.status === 'retirado' ? ' 🎁' : ' 🏆')+'</span>'; confete(4000); }
  else if (s.status === 'ausente') el.innerHTML = '<span class="selo ausente">Ausente · vamos sortear outro</span>';
  else el.innerHTML = '';
}
async function contar(){
  if (T.link) { const b = $('#nConc'); if (b) b.textContent = T.n; return T.nomesLink.map(nome => ({ nome })); }
  const r = await SB.rpc('sorteio_elegiveis', { p_evento: T.ev.id, p_dia: T.dia });
  if (!r.error) { T.n = (r.data || []).length; const b = $('#nConc'); if (b) b.textContent = T.n; }
  return r.error ? [] : (r.data || []);
}
async function animar(s){
  T.animando = true; T.atual = s; T.visto.add(s.id);
  const lista = (await contar()).map(x => x.nome); if (!lista.includes(s.nome)) lista.push(s.nome);
  const nomes = lista.length > 1 ? lista : [s.nome, '…'];
  palcoSorteado(s, true); brilho(false);
  const rolo = $('#rolo'), dur = 7000, ini = performance.now(); let i = Math.floor(Math.random() * nomes.length), ult = 0;
  await new Promise(fim => {
    const passo = agora => { const t = Math.min(1, (agora - ini) / dur), intervalo = 45 + 420 * t * t * t; // desacelera
      if (agora - ult >= intervalo) { ult = agora; i = (i + 1) % nomes.length; if (nomes[i] === s.nome && t < .97 && nomes.length > 2) i = (i + 1) % nomes.length; rolo.textContent = nomes[i]; }
      if (t < 1) requestAnimationFrame(passo); else fim(); };
    requestAnimationFrame(passo); });
  rolo.textContent = s.nome; rolo.classList.remove('rodando'); rolo.classList.add('parou');
  document.querySelector('.sorteado .rot').textContent = 'SORTEADO';
  $('#premio').innerHTML = s.premio ? '🎁 '+esc(s.premio) : '';
  brilho(true); confete(6000); T.animando = false;
  // Se o controle já marcou o resultado durante a animação, mostra agora.
  if (T.link) { if (T.ultLink && T.ultLink.id === s.id) aplicar(T.ultLink); return; }
  const r = await SB.from('sorteios').select('*').eq('id', s.id).limit(1); const atual = (r.data || [])[0]; if (atual) aplicar(atual);
}
function aplicar(s){
  if (T.animando) { if (T.atual && s.id === T.atual.id) T.atual = s; return; }
  if (s.status === 'sorteado' && !T.visto.has(s.id)) return animar(s);
  if (!T.atual || s.id !== T.atual.id) return;
  T.atual = s; clearTimeout(T.timerEspera);
  if (s.status === 'liberado') return espera();
  selo(s);
  if (s.status === 'ausente') T.timerEspera = setTimeout(() => { if (T.atual && T.atual.status === 'ausente') { espera(); contar(); } }, 5000);
}
async function conferir(){
  const r = await SB.from('sorteios').select('*').eq('evento', T.ev.id).order('em', { ascending: false }).limit(1);
  const s = (r.data || [])[0]; if (s) { if (T.atual && s.id === T.atual.id && s.status !== T.atual.status) aplicar(s); else if (!T.visto.has(s.id) && s.status === 'sorteado') aplicar(s); }
  if (!T.atual && !T.animando) contar();
}

// Brilho e confete (só visual).
function brilho(on){ $('#brilho').classList.toggle('on', !!on); }
let confeteAte = 0, pecas = [];
function confete(ms){
  const cv = $('#confete'), cx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cores = ['#ffc14d', '#ffe08a', '#ff7a1a', '#ff9d3c', '#ffffff'];
  for (let k = 0; k < 180; k++) pecas.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 6, a: Math.random() * 6.28, va: (Math.random() - .5) * .3, c: cores[k % cores.length] });
  const jaRodando = confeteAte > performance.now(); confeteAte = performance.now() + ms; if (jaRodando) return;
  const quadro = () => { cx.clearRect(0, 0, cv.width, cv.height); const vivo = performance.now() < confeteAte;
    pecas.forEach(p => { p.x += p.vx; p.y += p.vy; p.a += p.va; if (p.y > cv.height + 20 && vivo) { p.y = -20; p.x = Math.random() * cv.width; }
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); });
    pecas = pecas.filter(p => p.y < cv.height + 30); if (pecas.length) requestAnimationFrame(quadro); else cx.clearRect(0, 0, cv.width, cv.height); };
  requestAnimationFrame(quadro);
}

// Tela cheia e tela sempre acesa.
let trava = null;
async function manterAcesa(){ try { if ('wakeLock' in navigator && document.visibilityState === 'visible') trava = await navigator.wakeLock.request('screen'); } catch(e){} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') manterAcesa(); });
$('#bTela').onclick = () => { manterAcesa(); if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || function(){}).call(document.documentElement); };
document.addEventListener('dblclick', () => $('#bTela').click());

// ---------- Modo link (sem login) ----------
function linkInvalido(){
  $('#app').innerHTML = '<div class="palco espera"><div class="topo"><img class="logo" src="../../logo.webp" alt="Família Alcançar"></div><h1 class="marca">SORTEIO</h1>'
    + '<p class="conc" style="font-size:3.4vh">Link inválido ou trocado.<br><span class="meta" style="font-size:2.4vh">Peça o link novo a quem está conduzindo o sorteio.</span></p></div>';
}
async function lerLink(){
  const r = await SB.rpc('sorteio_tela', { p_token: T.link });
  if (r.error) return null; return r.data || { ok: false };
}
async function pollLink(){
  const j = await lerLink(); if (!j) return; // falha de rede: tenta de novo no próximo ciclo
  if (!j.ok) { T.ev = null; T.atual = null; linkInvalido(); return; }
  const novoEv = !T.ev || T.ev.id !== j.evento;
  T.ev = { id: j.evento, titulo: j.titulo }; T.dia = j.dia; T.n = j.concorrendo; T.nomesLink = Array.isArray(j.nomes) ? j.nomes : []; T.ultLink = j.ultimo || null;
  if (novoEv && !T.animando) { // primeira leitura: não anima o que já tinha acontecido
    const u = T.ultLink; if (u) T.visto.add(u.id);
    if (u && ['sorteado', 'ganhador', 'retirado'].includes(u.status) && Date.now() - new Date(u.em).getTime() < 10 * 60000) { T.atual = u; palcoSorteado(u, false); brilho(true); selo(u); }
    else espera();
    return;
  }
  const u = T.ultLink;
  if (u && (!T.atual || u.id !== T.atual.id || u.status !== T.atual.status)) aplicar(u);
  if (!T.atual && !T.animando) { const b = $('#nConc'); if (b) b.textContent = T.n; else espera(); }
}
async function iniciarLink(){
  manterAcesa();
  await pollLink();
  setInterval(() => { if (document.visibilityState === 'visible') pollLink(); }, 1500);
}

if (T.link) iniciarLink();
else exigirLogin($('#app'), async () => {
  let evs = []; try { evs = await eventosSorteio(); } catch(e){}
  T.ev = evs.find(x => x.id === param('evento')) || evs.find(x => x.dias.includes(hojeSP())) || evs.find(x => x.dias[x.dias.length-1] >= hojeSP()) || evs[evs.length - 1];
  if (!T.ev) { $('#app').innerHTML = '<div class="palco"><h1 class="marca">SORTEIO</h1><p class="meta">Nenhum evento com sorteio.</p></div>'; return; }
  T.dia = param('dia') || diaPadrao(T.ev);
  const r = await SB.from('sorteios').select('*').eq('evento', T.ev.id).order('em', { ascending: false }).limit(1), ult = (r.data || [])[0];
  if (r.error) { $('#app').innerHTML = '<div class="palco"><h1 class="marca">SORTEIO</h1><p class="meta">Esta conta não tem acesso ao sorteio. Entre com a conta da Gestão, da Organização ou de um administrador.</p></div>'; return; }
  await contar();
  if (ult) T.visto.add(ult.id);
  if (ult && ['sorteado', 'ganhador', 'retirado'].includes(ult.status) && Date.now() - new Date(ult.atualizado_em || ult.em).getTime() < 10 * 60000) { T.atual = ult; palcoSorteado(ult, false); brilho(true); selo(ult); }
  else espera();
  manterAcesa();
  SB.channel('sorteio-tela').on('postgres_changes', { event: '*', schema: 'public', table: 'sorteios' }, p => { const s = p.new; if (s && s.evento === T.ev.id) aplicar(s); }).subscribe();
  setInterval(conferir, 4000);
  setInterval(() => { if (!T.atual && !T.animando) contar(); }, 15000);
});
