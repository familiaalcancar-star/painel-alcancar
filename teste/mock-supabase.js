/* Simulador do Supabase para testar a tela no navegador sem internet.
   Não vai para o site: só é usado pelo teste/testar-site.js. Não aplica as regras de
   permissão do banco (essas são testadas em supabase/testes/). */
(() => {
const D = window.__DADOS;
const U = { admin:'00000000-0000-0000-0000-00000000000a', betel:'00000000-0000-0000-0000-0000000000b1', flechas:'00000000-0000-0000-0000-0000000000f1',
  gestao:'00000000-0000-0000-0000-0000000000c0', escala:'00000000-0000-0000-0000-0000000000e5', midia:'00000000-0000-0000-0000-0000000000a1', midia2:'00000000-0000-0000-0000-0000000000a2', novo:'00000000-0000-0000-0000-000000000099' };
const T = {
  config:[{id:'geral', d:D.config}], config_privada:[{id:'geral', d:{whatsAdm:'5511958800779'}}],
  pessoas:[
    {id:U.admin, email:'augusto@x', nome:'Augusto Teste', apelido:'Augusto', whatsapp:'11958800779', conexao:null, papel:'admin', gestao:false, ministro:false, avisos:false},
    {id:U.betel, aprovado_em:new Date(Date.now()-2700e3).toISOString(), email:'betel@x', nome:'Líder Betel', apelido:'', whatsapp:'11911111111', conexao:'betel', papel:'lider', gestao:false, ministro:false, avisos:true},
    {id:U.flechas, email:'flechas@x', nome:'Org Flechas', apelido:'', whatsapp:'11922222222', conexao:'flechas', papel:'organizacao', gestao:false, ministro:false, avisos:false},
    {id:U.gestao, email:'gestao@x', nome:'Gestora Silva', apelido:'', whatsapp:'11933333333', conexao:null, papel:'leitura', gestao:true, ministro:false, avisos:false},
    {id:U.midia, email:'midia@x', nome:'Ana Projeção Silva', apelido:'Ana', whatsapp:'11955555555', conexao:null, papel:'leitura', gestao:false, ministro:false, avisos:false, midia:true},
    {id:U.midia2, email:'midia2@x', nome:'Bruno Apoio Souza', apelido:'Bruno', whatsapp:'11966666666', conexao:null, papel:'leitura', gestao:false, ministro:false, avisos:false, midia:true},
    {id:U.escala, email:'escala@x', nome:'Paula Escala', apelido:'Paulinha', whatsapp:'11944444444', conexao:null, papel:'leitura', gestao:false, ministro:false, avisos:false, escala:true}],
  cadastros:[{id:'00000000-0000-0000-0000-0000000000d7', email:'pendente@x', nome:'Maria Pendente', apelido:'Mari', whatsapp:'11977777777', conexao:'shalom', papel:'auxiliar', em:'2026-10-26T10:00:00Z'}],
  acessos:[{id:'00000000-0000-0000-0000-0000000000d7', email:'pendente@x'}],
  escalas: D.escalas.map(x => { const {id, ...d} = x; return {id, d}; }),
  avisos: D.avisos.map(x => { const {id, ...d} = x; return {id, d, autor:null, criado_em:d.criadoEm}; }),
  eventos: D.eventos.map(x => { const {id, ...d} = x; return {id, d, autor:null}; }),
  checkin_marcas:[], historico:[], convites:[], checklist_marcas:[],
  checkin_itens:[['Crachá',null,10],['Colete',null,20],['Rádio',6,30],['Bastão de luz',null,40],['Guarda-chuva',null,50]].map(([nome, estoque, ordem]) => ({nome, estoque, ordem, ativo:true})),
  checklist_itens:[['Bloco 1 – Backgrounds','Wallpaper (tela de descanso)'],['Bloco 1 – Backgrounds','Fundo da letra das músicas'],['Bloco 2 – Cronômetro','Conferir se está no horário correto']].map(([bloco, texto], k) => ({id:'it'+k, funcao:'Projeção', bloco, texto, ordem:(k+1)*10, ativo:true})).concat([['Bloco 1 – Luzes da plataforma','Luz amarela direcionada à plataforma'],['Bloco 2 – Luzes da mídia','Teto – esquerda']].map(([bloco, texto], k) => ({id:'ap'+k, funcao:'Apoio', bloco, texto, ordem:(k+1)*10, ativo:true})))
    .concat(['Projeção','Câmera','Storymaker','Apoio'].flatMap(f => [{id:'or-ini-'+f, funcao:f, bloco:'Início', texto:'Oração inicial', ordem:0, ativo:true, destaque:true}, {id:'or-fim-'+f, funcao:f, bloco:'Encerramento', texto:'Oração final', ordem:1000, ativo:true, destaque:true}]))
    .concat([{id:'sm-tela', funcao:'Storymaker', bloco:'Bloco 1 – iPhone', texto:'Tela', ordem:10, ativo:true}, {id:'sm-insta', funcao:'Storymaker', bloco:'Bloco 3 – Apps', texto:'Instagram', ordem:60, ativo:true}, {id:'cam-velho', funcao:'Câmera', bloco:'Bloco 1 – iPhone', texto:'Tela', ordem:10, ativo:false}, {id:'bat-ret', funcao:'Storymaker', bloco:'Bloco 1 – iPhone', texto:'Bateria ao retirar (%)', ordem:20, ativo:true, tipo:'percentual'}, {id:'bat-dev', funcao:'Storymaker', bloco:'Bloco 1 – iPhone', texto:'Bateria ao devolver (%)', ordem:25, ativo:true, tipo:'percentual'}])
    .concat([{id:'ap-moch1', funcao:'Apoio', bloco:'Após a oração final', texto:'Conferir mochila: iPhone, carregador, microfones e notebook', ordem:1010, ativo:true}, {id:'ap-moch2', funcao:'Apoio', bloco:'Após a oração final', texto:'Entregar mochila', ordem:1020, ativo:true}]),
  chat:[{id:'m1', texto:'Bom dia, pessoal! Escala de domingo fechada?', por:U.betel, em:'2026-10-25T12:00:00.000Z'},
        {id:'m2', texto:'Falta só a recepção da noite.', por:U.gestao, em:new Date(Date.now()-3600e3).toISOString()},
        {id:'m3', texto:'Combinado, eu vejo isso.', por:U.admin, em:new Date(Date.now()-60e3).toISOString()}] };
// Teste do check-in por escalado: uma escala do Staff a mais, gravada antes de abrir a página.
try { const ex = JSON.parse(localStorage.getItem('mockEscalaExtra') || 'null'); if (ex) { T.escalas = T.escalas.filter(e => e.id !== ex.id); T.escalas.push({id:ex.id, d:ex.d}); } } catch(e){}
try { const mm = JSON.parse(localStorage.getItem('mockMarcas') || 'null'); if (mm) T.checklist_marcas = mm; } catch(e){}
window.__TABELAS = T;
const derivados = (t, r) => { if (t==='escalas' || t==='eventos') r.data = r.d && r.d.data; if (t==='escalas') { r.culto = r.d.culto; r.area = r.d.area; } return r; };
Object.keys(T).forEach(t => T[t].forEach(r => derivados(t, r)));
const chaves = {checkin_itens:['nome'], checkin_marcas:['data','culto','chave'], checklist_marcas:['data','culto','item'], convites:['email']};
const mesma = (t, a, b) => (chaves[t]||['id']).every(k => a[k] === b[k]);
let sessao = null; const ouvintes = [];
try { JSON.parse(localStorage.getItem('mockPessoasExtra') || '[]').forEach(q => T.pessoas.push(q)); } catch(e){}
try { const p = localStorage.getItem('mockPapel'); if (p && U[p]) sessao = {user:{id:U[p], email:p+'@x', app_metadata:{provider: localStorage.getItem('mockProv') || 'email'}}}; } catch(e){}
const emitir = ev => ouvintes.forEach(cb => setTimeout(() => cb(ev, sessao), 0));
window.__mockRecuperar = () => { sessao = {user:{id:U.novo, email:'nova.pessoa@gmail.com', user_metadata:{}}}; emitir('PASSWORD_RECOVERY'); };
class Q {
  constructor(t){ this.t = t; this.f = []; this.op = 'select'; this.ord = null; this.lim = 1e9; this.um = false; this.ret = false; }
  select(){ if (this.op !== 'select') this.ret = true; return this; }
  eq(k,v){ this.f.push(r => r[k] === v); return this; }
  in(k,v){ this.f.push(r => v.includes(r[k])); return this; }
  gte(k,v){ this.f.push(r => r[k] >= v); return this; }
  lte(k,v){ this.f.push(r => r[k] <= v); return this; }
  order(k, o){ this.ord = [k, !o || o.ascending !== false]; return this; }
  limit(n){ this.lim = n; return this; }
  range(a, b){ this.ini = a; this.lim = b - a + 1; return this; }
  maybeSingle(){ this.um = true; return this; }
  insert(v){ this.op = 'insert'; this.v = v; return this; }
  update(v){ this.op = 'update'; this.v = v; return this; }
  upsert(v){ this.op = 'upsert'; this.v = v; return this; }
  delete(){ this.op = 'delete'; return this; }
  exec(){
    const tab = T[this.t] = T[this.t] || [];
    const casa = r => this.f.every(f => f(r));
    const agora = new Date().toISOString();
    if (this.op === 'insert' || this.op === 'upsert') {
      const novos = (Array.isArray(this.v) ? this.v : [this.v]).map(x => JSON.parse(JSON.stringify(x)));
      for (const n of novos) {
        const i = tab.findIndex(r => mesma(this.t, r, n));
        if (i >= 0 && this.op === 'insert') return {data:null, error:{code:'23505', message:'duplicate key'}};
        if (this.t === 'historico') { const eu = T.pessoas.find(p => sessao && p.id===sessao.user.id) || {}; Object.assign(n, {id:tab.length+1, por:sessao && sessao.user.id, em:agora, por_nome: eu.apelido || String(eu.nome||'').split(' ')[0]}); }
        if (['avisos','eventos','escalas'].includes(this.t) && i < 0) { n.autor = sessao && sessao.user.id; n.criado_em = agora; }
        if (this.t === 'checkin_marcas') { n.por = sessao && sessao.user.id; n.em = agora;
          // Igual ao gatilho checkin_guarda: carimba quem marcou o check-in, o "Entregue" e o "Devolvido".
          const eu = T.pessoas.find(p => sessao && p.id===sessao.user.id) || {}, quem = eu.apelido || String(eu.nome||'').split(' ')[0], old = i >= 0 ? tab[i] : null;
          if (!n.ci) { n.ci_nome = null; n.ci_em = null; } else if (!old || !old.ci) { n.ci_nome = quem; n.ci_em = agora; } else { n.ci_nome = old.ci_nome; n.ci_em = old.ci_em; }
          n.itens = (n.itens || []).map(it => { const a = old && (old.itens||[]).find(o => o.nome === it.nome); const r = {...it}; delete r.ret_nome; delete r.ret_em; delete r.dev_nome; delete r.dev_em;
            if ((r.ret||0) > 0) Object.assign(r, a && (a.ret||0) === r.ret && a.ret_nome ? {ret_nome:a.ret_nome, ret_em:a.ret_em} : {ret_nome:quem, ret_em:agora});
            if ((r.dev||0) > 0) Object.assign(r, a && (a.dev||0) === r.dev && a.dev_nome ? {dev_nome:a.dev_nome, dev_em:a.dev_em} : {dev_nome:quem, dev_em:agora});
            return r; }); }
        if (this.t === 'checklist_marcas') { const eu = T.pessoas.find(p => sessao && p.id===sessao.user.id) || {}; Object.assign(n, {por:sessao && sessao.user.id, por_nome: eu.apelido || String(eu.nome||'').split(' ')[0], em:agora}); }
        if (this.t === 'checklist_itens' && !n.id) { n.id = 'i'+Date.now()+Math.random().toString(36).slice(2,6); n.ativo = n.ativo !== false; }
        if (this.t === 'chat') { n.id = 'm'+Date.now(); n.por = sessao && sessao.user.id; n.em = agora; }
        derivados(this.t, n);
        if (i >= 0) tab[i] = {...tab[i], ...n}; else tab.push(n);
      }
      return {data: this.ret ? novos : null, error:null};
    }
    if (this.op === 'update') { const l = tab.filter(casa); l.forEach(r => { Object.assign(r, JSON.parse(JSON.stringify(this.v))); derivados(this.t, r); }); return {data: this.ret ? l.map(r => ({id:r.id})) : null, error:null}; }
    if (this.op === 'delete') { const l = tab.filter(casa); T[this.t] = tab.filter(r => !casa(r)); return {data: this.ret ? l.map(r => ({id:r.id})) : null, error:null}; }
    let l = tab.filter(casa).map(r => JSON.parse(JSON.stringify(r)));
    if (this.ord) { const [k, asc] = this.ord; l.sort((a,b) => String(a[k]??'').localeCompare(String(b[k]??'')) * (asc?1:-1)); }
    l = l.slice(this.ini || 0, (this.ini || 0) + this.lim);
    if (['pessoas','cadastros','config_privada','checkin_marcas','historico','acessos','chat'].includes(this.t) && !sessao) l = [];
    return {data: this.um ? (l[0] || null) : l, error:null};
  }
  then(ok, err){ return new Promise(r => setTimeout(r, 15)).then(() => this.exec()).then(ok, err); }
}
window.supabase = { createClient: () => ({
  from: t => new Q(t),
  rpc: async (n, args) => (window.__rpc = window.__rpc || []).push([n, args]) && n === 'trocar_escalado' ? (() => {
      const e = T.escalas.find(x => x.id === args.p_escala_id); if (!e) return {data:null, error:{message:'Escala não encontrada.'}};
      const fs = JSON.parse(JSON.stringify(e.d.funcoes || [])), f = fs.find(x => x.nome === args.p_funcao_atual), ix = f ? (f.pessoas||[]).indexOf(args.p_nome_atual) : -1;
      if (ix < 0) return {data:null, error:{message:'Pessoa não encontrada nessa função.'}};
      f.pessoas.splice(ix, 1); const novo = args.p_nome_novo || args.p_nome_atual, fn = args.p_funcao_nova || args.p_funcao_atual;
      let g = fs.find(x => x.nome === fn); if (!g) fs.push(g = {nome:fn, pessoas:[]}); g.pessoas.push(novo); e.d.funcoes = fs; return {data:fs, error:null}; })()
    : n === 'conta_do_whatsapp' ? (() => { const w = String(args.p_whats||'').replace(/\D/g,'').slice(-11); const o = T.pessoas.find(q => sessao && q.id !== sessao.user.id && String(q.whatsapp||'').replace(/\D/g,'').slice(-11) === w && (q.status||'aprovado') !== 'removido');
        return {data: o ? [{email: String(o.email).replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2'), provedor:'email'}] : [], error:null}; })()
    : n === 'transferir_pessoa' ? (() => { const o = T.pessoas.find(q => q.id === args.p_de); if (!o) return {data:null, error:{message:'conta antiga sem cadastro'}};
        T.pessoas = T.pessoas.filter(q => q.id !== args.p_para); T.pessoas.push({...o, id:args.p_para, status:'aprovado'}); o.status = 'removido'; T.cadastros = T.cadastros.filter(c => c.id !== args.p_para); return {data:null, error:null}; })()
    : n === 'checklist_confirmar' ? (() => { const m = T.checklist_marcas.find(q => q.data === args.p_data && q.culto === args.p_culto && q.item === args.p_item); if (!m) return {data:null, error:{message:'Item ainda não marcado.'}};
        const eu = T.pessoas.find(p => sessao && p.id===sessao.user.id) || {}; if (m.por !== sessao.user.id && !m.confirmado_por) Object.assign(m, {confirmado_por:sessao.user.id, confirmado_nome: eu.apelido || String(eu.nome||'').split(' ')[0], confirmado_em:new Date().toISOString()}); return {data:null, error:null}; })()
    : n === 'fez_checkin' ? {data: !!(T.checkin_marcas||[]).some(c => c.data === args.p_data && c.culto === args.p_culto && c.ci) || localStorage.getItem('mockFezCheckin') === '1', error:null} : n === 'escalas_publicas' ? {data: T.escalas.filter(r => r.data >= args.p_de && r.data <= args.p_ate).sort((a,b) => a.data.localeCompare(b.data)).map(r => { const d = JSON.parse(JSON.stringify(r.d)); const qtd = (d.funcoes||[]).reduce((s,f) => s + (f.pessoas||[]).filter(x => String(x).trim()).length, 0); delete d.funcoes; return {id:r.id, d:{...d, qtd}}; }), error:null} : n === 'pessoas_nomes' ? {data: sessao ? T.pessoas.map(p => ({id:p.id, nome:p.nome, apelido:p.apelido})) : [], error:null} : {data:null, error:null},
  channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), removeChannel(){},
  storage: { from: () => ({ upload: async () => ({data:{}, error:null}), getPublicUrl: () => ({data:{publicUrl:'imagens/rede-igPrev.webp'}}) }) },
  auth: {
    getSession: async () => ({data:{session:sessao}}),
    onAuthStateChange: cb => { ouvintes.push(cb); setTimeout(() => cb('INITIAL_SESSION', sessao), 0); return {data:{subscription:{unsubscribe(){}}}}; },
    signInWithPassword: async ({email, password}) => { if (password !== 'senha1234') return {data:{}, error:{code:'invalid_credentials', message:'Invalid login credentials'}}; sessao = {user:{id:U.novo, email, user_metadata:{}}}; emitir('SIGNED_IN'); return {data:{session:sessao}, error:null}; },
    signUp: async ({email}) => { window.__cadastro = email; return {data:{user:{id:'x', identities:[{}]}, session:null}, error:null}; },
    resetPasswordForEmail: async email => { window.__recuperar = email; return {data:{}, error:null}; },
    updateUser: async ({password}) => { window.__novaSenha = password; return {data:{}, error:null}; },
    signInWithOAuth: async ({provider}) => { window.__oauth = provider; return {data:{}, error:null}; },
    signOut: async () => { sessao = null; emitir('SIGNED_OUT'); return {error:null}; } } }) };
})();
