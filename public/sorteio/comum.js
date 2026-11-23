// Comum às páginas do sorteio (controle e telão). Mesmo login do painel (a sessão fica guardada no navegador).
// O sorteio acontece só no banco (rpc "sortear"); aqui nada é sorteado.
const SB = window.supabase.createClient(window.PAINEL.url, window.PAINEL.chave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
});
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dataBR = d => d ? d.slice(8,10)+'/'+d.slice(5,7) : '';
const diaSemana = d => new Date(d+'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
const horaSP = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '';
const param = k => new URLSearchParams(location.search).get(k);
const ROT_STATUS = { sorteado: 'Aguardando', ganhador: 'Ganhador', retirado: 'Retirou o prêmio', ausente: 'Ausente', liberado: 'Liberado' };
const msgErro = e => String((e && e.message) || e || 'Erro').replace(/^.*?:\s*(?=[A-ZÁÉÍÓÚ])/,'');

// Eventos com check-in de participantes (ex.: Congresso "Desperta").
async function eventosSorteio(){
  const r = await SB.from('eventos').select('id,d');
  if (r.error) throw r.error;
  return (r.data || []).map(x => ({ id: x.id, ...(x.d || {}) })).filter(e => e.checkinParticipantes)
    .map(e => ({ ...e, dias: (Array.isArray(e.dias) && e.dias.length ? e.dias : [e.data]).filter(Boolean).slice().sort() }))
    .sort((a, b) => (a.dias[0] || '').localeCompare(b.dias[0] || ''));
}
// Dia padrão: hoje (se for dia do evento); senão o próximo dia do evento; senão o último.
function diaPadrao(ev){ const h = hojeSP(), ds = ev.dias || []; return ds.includes(h) ? h : (ds.find(d => d >= h) || ds[ds.length - 1] || h); }

// Pede login (e-mail e senha) quando não há sessão. Google: entra pelo painel e volta aqui.
async function exigirLogin(alvo, aoEntrar){
  const { data } = await SB.auth.getSession();
  if (data && data.session) return aoEntrar(data.session);
  const voltar = location.href;
  alvo.innerHTML = '<div class="login"><div class="card"><img class="logo" src="../../logo.webp" alt="Família Alcançar"><h2>Entrar</h2>'
    + '<p class="meta">Use a mesma conta do painel da igreja.</p><form id="fLogin"><label class="f" for="lE">E-mail</label><input class="inp" id="lE" type="email" autocomplete="username" required>'
    + '<label class="f" for="lS">Senha</label><input class="inp" id="lS" type="password" autocomplete="current-password" required>'
    + '<p id="lErro" class="aviso erro" hidden></p><div style="margin-top:14px;display:grid;gap:10px"><button class="btn" type="submit">Entrar</button>'
    + '<a class="btn ghost" href="../../" id="lPainel">Entrar com Google pelo painel</a></div></form>'
    + '<p class="meta" style="margin-top:12px">Entrou pelo painel? Depois é só voltar a esta página.</p></div></div>';
  try { sessionStorage.setItem('voltarSorteio', voltar); } catch(e){}
  $('#fLogin').onsubmit = async ev => { ev.preventDefault();
    const r = await SB.auth.signInWithPassword({ email: $('#lE').value.trim().toLowerCase(), password: $('#lS').value });
    if (r.error) { const p = $('#lErro'); p.hidden = false; p.textContent = /invalid/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar agora.'; return; }
    aoEntrar(r.data.session); };
}
// Ligado/desligado em Ajustes do painel (config geral: sorteioAtivo). A config é pública (leitura).
async function sorteioAtivo(){ const r = await SB.from('config').select('d').eq('id', 'geral').maybeSingle(); return !r.error && !!(r.data && r.data.d && r.data.d.sorteioAtivo === true); }
async function souAdmin(sessao){ if (!sessao) return false; const r = await SB.from('pessoas').select('papel').eq('id', sessao.user.id).maybeSingle(); return !r.error && !!r.data && r.data.papel === 'admin'; }
// Se alguém ligar/desligar o sorteio com a página aberta, recarrega para mostrar o estado novo.
function vigiarAtivo(atual){ setInterval(async () => { if (document.visibilityState !== 'visible') return; const r = await SB.from('config').select('d').eq('id', 'geral').maybeSingle();
  if (!r.error && r.data && !!(r.data.d && r.data.d.sorteioAtivo === true) !== atual) location.reload(); }, 20000); }
async function podeSortear(){ const r = await SB.rpc('pode_sortear'); return !r.error && r.data === true; }
