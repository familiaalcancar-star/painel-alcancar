// Controle do sorteio (celular do operador). Quem sorteia é o banco: rpc sortear(evento, dia, prêmio).
const C = { evs: [], ev: null, dia: null, n: null, hist: [], pend: null, premio: '', premioSalvo: null, conf: 0, ocupado: false, erro: '', link: null, linkAberto: false, trocar: 0 };
// Link da tela do telão (sem login): o código vem do banco (sorteio_link_tela); trocar invalida o anterior.
const urlTela = t => new URL('../tela/?k=' + encodeURIComponent(t), location.href).href;
function qrSvg(texto){ try { const q = qrcode(0, 'M'); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch(e){ return ''; } }
function cardLink(){
  if (!C.linkAberto) return '';
  if (!C.link) return '<div class="card"><p class="meta">Gerando o link…</p></div>';
  const u = urlTela(C.link);
  return '<div class="card link-tela"><h3 style="margin:0 0 6px;font-size:16px">📺 Link da tela do telão</h3>'
    + '<p class="meta" style="margin:0 0 10px">Abra no computador do telão. <b>Não precisa de login</b> e só mostra o sorteio.</p>'
    + '<input class="inp" id="linkTela" readonly value="'+esc(u)+'">'
    + '<div class="row" style="margin-top:10px"><button class="btn" data-copiar>Copiar link</button><a class="btn ghost" href="'+esc(u)+'" target="_blank" rel="noopener">Abrir</a></div>'
    + '<div class="qr">'+qrSvg(u)+'</div><p class="meta" style="text-align:center;margin:6px 0 0">Aponte a câmera do celular/computador para abrir.</p>'
    + (C.trocar === 0 ? '<button class="btn ghost" data-trocar="1" style="margin-top:12px;width:100%">Trocar link</button>'
      : '<p class="aviso erro" style="margin-top:12px">Trocar invalida o link atual: a tela aberta com ele para de funcionar. Confirmar?</p><div class="row"><button class="btn ghost" data-trocar="0">Cancelar</button><button class="btn vermelho" data-trocar="2">Sim, trocar link</button></div>')
    + '</div>';
}

function cabecalho(){
  return '<header><img class="logo" src="../../logo.webp" alt="Família Alcançar"><h1><span>SORTEIO</span>'+esc(C.ev ? C.ev.titulo : 'Sorteio')+'</h1></header>';
}
function desenhar(){
  const app = $('#app'); if (!C.ev) return;
  let h = cabecalho()
    + '<div class="card"><div class="row"><div><label class="f" for="sEv" style="margin-top:0">Evento</label><select class="inp" id="sEv">'
    + C.evs.map(e => '<option value="'+esc(e.id)+'"'+(e.id === C.ev.id ? ' selected' : '')+'>'+esc(e.titulo)+'</option>').join('') + '</select></div></div>'
    + '<label class="f" for="sDia">Dia</label><select class="inp" id="sDia">'
    + C.ev.dias.map(d => '<option value="'+d+'"'+(d === C.dia ? ' selected' : '')+'>'+dataBR(d)+' · '+esc(diaSemana(d))+(d === hojeSP() ? ' (hoje)' : '')+'</option>').join('') + '</select>'
    + '<div class="conc"><b id="nConc">'+(C.n == null ? '…' : C.n)+'</b> '+(C.n === 1 ? 'pessoa concorrendo' : 'pessoas concorrendo')+' neste dia</div>'
    + '<p class="meta" style="margin:6px 0 0">Concorre quem fez check-in no dia e ainda não ganhou.</p></div>';
  if (C.erro) h += '<p class="aviso erro" role="alert">'+esc(C.erro)+'</p>';
  if (C.pend) {
    h += '<div class="card atual"><div class="rot">SORTEADO · RODADA '+C.pend.rodada+'</div><div class="nome">'+esc(C.pend.nome)+'</div>'
      + (C.pend.premio ? '<div class="premio">🎁 '+esc(C.pend.premio)+'</div>' : '')
      + '<div class="meta">'+dataBR(C.pend.dia)+' · entre '+C.pend.elegiveis+' concorrentes</div>'
      + '<div class="acoes"><button class="btn verde" data-marcar="ganhador"'+(C.ocupado ? ' disabled' : '')+'>✅ Ganhador</button>'
      + '<button class="btn" data-marcar="retirado"'+(C.ocupado ? ' disabled' : '')+'>🎁 Retirou o prêmio</button>'
      + '<button class="btn vermelho" data-marcar="ausente"'+(C.ocupado ? ' disabled' : '')+'>🚫 Ausente (sortear outro)</button></div></div>';
  } else {
    h += '<div class="card"><label class="f" for="sPremio" style="margin-top:0">Prêmio (opcional)</label><input class="inp" id="sPremio" maxlength="120" placeholder="Ex.: Bíblia de estudo" value="'+esc(C.premio)+'">'
      + '<p class="meta" id="premioInfo" style="margin:6px 0 0">'+premioInfo()+'</p>'
      + '<button class="btn sortear" id="bSortear"'+(C.ocupado || C.n === 0 ? ' disabled' : '')+'>'+(C.ocupado ? 'SORTEANDO…' : 'SORTEAR')+'</button>'
      + (C.n === 0 ? '<p class="meta" style="margin:10px 0 0">Ninguém disponível neste dia: confira o check-in dos participantes.</p>' : '') + '</div>';
    const ult = C.hist.find(s => s.status !== 'liberado');
    if (ult) h += '<p class="meta">Último: <b>'+esc(ult.nome)+'</b> · <span class="st st-'+ult.status+'">'+esc(ROT_STATUS[ult.status])+'</span></p>';
  }
  h += '<div class="links"><button class="btn ghost" data-link-tela>📺 Link da tela</button><a class="btn ghost" href="../tela/?evento='+encodeURIComponent(C.ev.id)+'&dia='+C.dia+'" target="_blank" rel="noopener">Abrir tela do telão</a>'
    + '<a class="btn ghost" href="../../#checkin">‹ Painel</a></div>' + cardLink();
  h += '<h2 style="font-size:18px;margin:22px 0 8px">Histórico do evento</h2>';
  h += C.hist.length ? '<div class="card" style="padding:6px 10px;overflow-x:auto"><table class="hist"><thead><tr><th>#</th><th>Dia</th><th>Nome</th><th>Prêmio</th><th>Status</th></tr></thead><tbody>'
      + C.hist.map(s => '<tr><td>'+s.rodada+'</td><td>'+dataBR(s.dia)+'<br><small class="meta">'+horaSP(s.em)+'</small></td><td>'+esc(s.nome)+'</td><td>'+esc(s.premio || '—')+'</td><td><span class="st st-'+s.status+'">'+esc(ROT_STATUS[s.status] || s.status)+'</span></td></tr>').join('')
      + '</tbody></table></div>' : '<p class="meta">Nenhum sorteio ainda.</p>';
  h += '<div class="card" style="margin-top:18px"><h3 style="margin:0 0 6px;font-size:16px">Incluir todos de volta</h3>'
    + '<p class="meta" style="margin:0">Libera todos os já sorteados (ganhadores, quem retirou e ausentes) para concorrer de novo. O histórico continua.</p>'
    + (C.conf === 0 ? '<button class="btn ghost confirma" data-reincluir="1">Incluir todos de volta</button>'
      : C.conf === 1 ? '<p class="aviso confirma">Tem certeza? Quem já ganhou poderá ser sorteado de novo.</p><div class="row"><button class="btn ghost" data-reincluir="0">Cancelar</button><button class="btn vermelho" data-reincluir="2">Sim, continuar</button></div>'
      : '<p class="aviso erro confirma">Última confirmação: liberar <b>todos</b> agora?</p><div class="row"><button class="btn ghost" data-reincluir="0">Cancelar</button><button class="btn vermelho" data-reincluir="3">Confirmar: incluir todos</button></div>')
    + '</div>';
  app.innerHTML = h;
}
// Prêmio: fica guardado no banco e aparece na faixa do telão (vale também para o SORTEAR do telão).
const premioInfo = () => C.premio.trim() ? (C.premioSalvo === C.premio.trim() ? '📺 Aparece na faixa do telão.' : 'Salvando…') : 'Sem prêmio: o telão mostra só “Aguardando sorteio”.';
let tPremio;
function salvarPremio(agora){
  clearTimeout(tPremio);
  tPremio = setTimeout(async () => { const v = C.premio.trim(); const r = await SB.rpc('sorteio_definir_premio', { p_evento: C.ev.id, p_premio: v });
    if (!r.error) C.premioSalvo = v; const i = $('#premioInfo'); if (i) i.textContent = r.error ? 'Não consegui salvar o prêmio agora.' : premioInfo(); }, agora ? 0 : 600);
}
async function lerPremio(){ const r = await SB.rpc('sorteio_premio', { p_evento: C.ev.id }); if (!r.error && typeof r.data === 'string') { C.premio = r.data; C.premioSalvo = r.data; } }
async function atualizar(){
  if (!C.ev) return;
  const [e, h] = await Promise.all([SB.rpc('sorteio_elegiveis', { p_evento: C.ev.id, p_dia: C.dia }), SB.from('sorteios').select('*').eq('evento', C.ev.id).order('em', { ascending: false }).limit(300)]);
  C.n = e.error ? null : (e.data || []).length; C.hist = h.data || []; C.pend = C.hist.find(s => s.status === 'sorteado') || null;
  const foco = document.activeElement && document.activeElement.id === 'sPremio';
  desenhar(); if (foco) { const i = $('#sPremio'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
async function sortear(premio){
  C.ocupado = true; C.erro = ''; desenhar(); if ((premio || '') !== (C.premioSalvo || '')) salvarPremio(true);
  const r = await SB.rpc('sortear', { p_evento: C.ev.id, p_dia: C.dia, p_premio: premio || '' });
  C.ocupado = false; if (r.error) C.erro = msgErro(r.error);
  await atualizar();
}
document.addEventListener('input', e => { if (e.target.id === 'sPremio') { C.premio = e.target.value; const i = $('#premioInfo'); if (i) i.textContent = premioInfo(); salvarPremio(); } });
document.addEventListener('change', async e => {
  if (e.target.id === 'sEv') { C.ev = C.evs.find(x => x.id === e.target.value); C.dia = diaPadrao(C.ev); C.conf = 0; C.erro = ''; C.link = null; C.linkAberto = false; history.replaceState(null, '', '?evento='+encodeURIComponent(C.ev.id)); C.premio = ''; await lerPremio(); await atualizar(); }
  if (e.target.id === 'sDia') { C.dia = e.target.value; C.erro = ''; await atualizar(); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || C.ocupado) return;
  if (b.id === 'bSortear') sortear(C.premio.trim());
  if ('linkTela' in b.dataset) { C.linkAberto = !C.linkAberto; C.trocar = 0; desenhar();
    if (C.linkAberto && !C.link) { const r = await SB.rpc('sorteio_link_tela', { p_evento: C.ev.id, p_trocar: false }); if (r.error) { C.erro = msgErro(r.error); C.linkAberto = false; } else C.link = r.data; desenhar(); } }
  if ('copiar' in b.dataset) { const u = urlTela(C.link); try { await navigator.clipboard.writeText(u); b.textContent = 'Copiado ✓'; } catch(e){ const i = $('#linkTela'); i.select(); document.execCommand && document.execCommand('copy'); b.textContent = 'Copiado ✓'; } setTimeout(() => { b.textContent = 'Copiar link'; }, 2000); }
  if (b.dataset.trocar) { const v = Number(b.dataset.trocar);
    if (v < 2) { C.trocar = v; desenhar(); return; }
    const r = await SB.rpc('sorteio_link_tela', { p_evento: C.ev.id, p_trocar: true }); C.trocar = 0;
    if (r.error) C.erro = msgErro(r.error); else { C.link = r.data; C.erro = ''; } desenhar(); }
  if (b.dataset.marcar && C.pend) {
    const st = b.dataset.marcar, premio = C.pend.premio; C.ocupado = true; C.erro = ''; desenhar();
    const r = await SB.rpc('sorteio_marcar', { p_id: C.pend.id, p_status: st }); C.ocupado = false;
    if (r.error) { C.erro = msgErro(r.error); await atualizar(); return; }
    if (st === 'ausente') { await atualizar(); if (C.n > 0) return sortear(premio); }
    else { C.premio = ''; salvarPremio(true); await atualizar(); }
  }
  if (b.dataset.reincluir) { const v = Number(b.dataset.reincluir);
    if (v < 3) { C.conf = v; desenhar(); return; }
    C.ocupado = true; desenhar(); const r = await SB.rpc('sorteio_reincluir_todos', { p_evento: C.ev.id }); C.ocupado = false; C.conf = 0;
    C.erro = r.error ? msgErro(r.error) : ''; await atualizar(); }
});

exigirLogin($('#app'), async () => {
  if (!await podeSortear()) { $('#app').innerHTML = cabecalho() + '<div class="card"><p>Só administradores, a Gestão e a Organização conduzem o sorteio.</p><a class="btn ghost" href="../../">‹ Voltar ao painel</a></div>'; return; }
  try { C.evs = await eventosSorteio(); } catch(e){ C.evs = []; }
  if (!C.evs.length) { $('#app').innerHTML = cabecalho() + '<div class="card"><p>Nenhum evento com check-in de participantes.</p><a class="btn ghost" href="../../">‹ Voltar ao painel</a></div>'; return; }
  C.ev = C.evs.find(x => x.id === param('evento')) || C.evs.find(x => x.dias.includes(hojeSP())) || C.evs.find(x => x.dias[x.dias.length-1] >= hojeSP()) || C.evs[C.evs.length - 1];
  C.dia = (param('dia') && C.ev.dias.includes(param('dia'))) ? param('dia') : diaPadrao(C.ev);
  await lerPremio(); await atualizar();
  SB.channel('sorteio-controle').on('postgres_changes', { event: '*', schema: 'public', table: 'sorteios' }, () => atualizar())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'evento_presencas' }, () => atualizar()).subscribe();
  setInterval(() => { if (!C.ocupado && document.visibilityState === 'visible') atualizar(); }, 15000);
});
