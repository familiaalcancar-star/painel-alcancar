// Auto check-in por QR Code (página pública, sem login). Só usa as funções do banco autocheckin_*:
// nunca mostra a lista de participantes, só até 3 nomes que batem com o que a pessoa digitou.
const SB = window.supabase.createClient(window.PAINEL.url, window.PAINEL.chave, { auth: { persistSession: false, autoRefreshToken: false } });
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EVENTO = new URLSearchParams(location.search).get('e') || 'ev-2026-11-18-desperta';
const APP = $('#app');
const msgBanco = e => String((e && e.message) || 'Não foi possível concluir agora. Tente de novo.').replace(/^.*?:\s*(?=[A-ZÁÉÍÓÚ])/, '');
let ultimo = '';

// ID deste celular (criado uma vez e reaproveitado): o banco permite 1 check-in por celular por dia.
function aparelho(){
  let id = null;
  try { id = localStorage.getItem('aparelho_checkin'); } catch(e){}
  if (!id || id.length < 16) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
    try { localStorage.setItem('aparelho_checkin', id); } catch(e){}
  }
  return id;
}
const cab = () => '<div class="rotulo">CHECK-IN</div>';

function telaBusca(erro){
  APP.innerHTML = cab() + '<h1>Bem-vindo!</h1>'
    + '<form id="fBusca" novalidate><label for="nome">Digite seu nome e sobrenome</label>'
    + '<input class="inp" id="nome" name="nome" autocomplete="name" autocapitalize="words" enterkeyhint="search" placeholder="Ex.: João da Silva" value="' + esc(ultimo) + '">'
    + (erro ? '<p class="erro" role="alert" style="margin-top:12px">' + esc(erro) + '</p>' : '')
    + '<button class="btn" type="submit">Buscar</button></form>';
  $('#fBusca').onsubmit = buscar;
}
async function buscar(e){
  e.preventDefault();
  const nome = $('#nome').value.trim().replace(/\s+/g, ' '); ultimo = nome;
  if (nome.split(' ').filter(p => p.length >= 2).length < 2) return telaBusca('Digite seu nome e sobrenome (pelo menos 2 palavras).');
  const b = e.submitter || $('#fBusca .btn'); b.disabled = true; b.textContent = 'Buscando…';
  const r = await SB.rpc('autocheckin_buscar', { p_evento: EVENTO, p_nome: nome });
  if (r.error) return telaBusca(msgBanco(r.error));
  const l = (r.data || []).slice(0, 3);
  if (!l.length) {
    APP.innerHTML = cab() + '<h1>Nome não encontrado</h1><p>Não encontramos seu nome na lista de inscritos. Procure a equipe de Check-in na entrada.</p>'
      + '<button class="btn" id="bDeNovo">Tentar de novo</button>';
    $('#bDeNovo').onclick = () => telaBusca();
    return;
  }
  APP.innerHTML = cab() + '<h1>' + (l.length === 1 ? 'Encontramos você!' : 'Qual é você?') + '</h1>'
    + l.map(p => '<div class="cartao"><p class="p">Você é</p><div class="grande">' + esc(p.nome) + '?</div>'
      + (p.ja_presente ? '<div class="ja">Check-in já feito hoje ✔</div>' : '')
      + '<button class="btn" data-sou="' + esc(p.id) + '" data-nome="' + esc(p.nome) + '">Sim, sou eu</button></div>').join('')
    + '<button class="btn ghost" id="bNao">Não sou nenhum destes</button>';
  APP.querySelectorAll('[data-sou]').forEach(btn => btn.onclick = () => confirmar(btn));
  $('#bNao').onclick = () => telaBusca();
}
async function confirmar(btn){
  APP.querySelectorAll('button').forEach(b => b.disabled = true); btn.textContent = 'Confirmando…';
  const r = await SB.rpc('autocheckin_confirmar', { p_evento: EVENTO, p_participante: btn.dataset.sou, p_aparelho: aparelho() });
  if (r.error || !r.data || !r.data.ok) {
    APP.innerHTML = cab() + '<h1>Não deu certo</h1><p class="erro" role="alert">' + esc(r.error ? msgBanco(r.error) : 'Não foi possível confirmar agora.') + '</p>'
      + '<button class="btn" id="bDeNovo">Voltar</button>';
    $('#bDeNovo').onclick = () => telaBusca();
    return;
  }
  const d = r.data;
  APP.innerHTML = '<div class="ok">' + cab() + '<div class="sinal" aria-hidden="true">✔</div>'
    + '<div class="grande">' + (d.ja ? 'Check-in já feito' : 'Check-in confirmado!') + '</div>'
    + '<p style="margin:0">Bem-vindo,</p><div class="nome">' + esc(d.nome || btn.dataset.nome) + '</div>'
    + '<p>' + (d.ja ? 'Seu check-in de hoje já estava feito. Você já está participando do sorteio de hoje.' : 'Você já está participando do sorteio de hoje.') + '</p></div>';
}

(async () => {
  const r = await SB.rpc('autocheckin_info', { p_evento: EVENTO });
  const info = r.data || null;
  if (r.error || !info) { APP.innerHTML = cab() + '<h1>Check-in</h1><p class="erro">Não foi possível abrir o check-in agora. Verifique a internet e tente de novo.</p>'; return; }
  if (info.titulo) document.title = 'Check-in · ' + info.titulo;
  if (!info.aberto) {
    const h = t => String(t || '').slice(0, 5).replace(/^(\d{1,2}):(\d{2})$/, (m, a, b) => Number(a) + 'h' + (b === '00' ? '' : b)); // "19:30" → "19h30"
    APP.innerHTML = cab() + '<h1>Check-in</h1><p>' + (info.abre && info.fecha
      ? 'O check-in pelo QR Code fica aberto de 18 a 21/11, das ' + esc(h(info.abre)) + ' às ' + esc(h(info.fecha)) + '.'
      : 'O check-in pelo QR Code abre nos dias do Congresso (18 a 21/11).') + '</p>';
    return; }
  telaBusca();
})();
