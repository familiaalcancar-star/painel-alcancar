/* Simulador do Supabase para testar a tela no navegador sem internet.
   Não vai para o site: só é usado pelo teste/testar-site.js. Não aplica as regras de
   permissão do banco (essas são testadas em supabase/testes/). */
(() => {
const D = window.__DADOS;
const U = { admin:'00000000-0000-0000-0000-00000000000a', betel:'00000000-0000-0000-0000-0000000000b1', flechas:'00000000-0000-0000-0000-0000000000f1',
  gestao:'00000000-0000-0000-0000-0000000000c0', escala:'00000000-0000-0000-0000-0000000000e5', novo:'00000000-0000-0000-0000-000000000099' };
const T = {
  config:[{id:'geral', d:D.config}], config_privada:[{id:'geral', d:{whatsAdm:'5511958800779'}}],
  pessoas:[
    {id:U.admin, email:'augusto@x', nome:'Augusto Teste', apelido:'Augusto', whatsapp:'11958800779', conexao:null, papel:'admin', gestao:false, ministro:false, avisos:false},
    {id:U.betel, aprovado_em:new Date(Date.now()-2700e3).toISOString(), email:'betel@x', nome:'Líder Betel', apelido:'', whatsapp:'11911111111', conexao:'betel', papel:'lider', gestao:false, ministro:false, avisos:true},
    {id:U.flechas, email:'flechas@x', nome:'Org Flechas', apelido:'', whatsapp:'11922222222', conexao:'flechas', papel:'organizacao', gestao:false, ministro:false, avisos:false},
    {id:U.gestao, email:'gestao@x', nome:'Gestora Silva', apelido:'', whatsapp:'11933333333', conexao:null, papel:'leitura', gestao:true, ministro:false, avisos:false},
    {id:U.escala, email:'escala@x', nome:'Paula Escala', apelido:'Paulinha', whatsapp:'11944444444', conexao:null, papel:'leitura', gestao:false, ministro:false, avisos:false, escala:true}],
  cadastros:[{id:'00000000-0000-0000-0000-0000000000d7', email:'pendente@x', nome:'Maria Pendente', apelido:'Mari', whatsapp:'11977777777', conexao:'shalom', papel:'auxiliar', em:'2026-10-26T10:00:00Z'}],
  acessos:[{id:'00000000-0000-0000-0000-0000000000d7', email:'pendente@x'}],
  escalas: D.escalas.map(x => { const {id, ...d} = x; return {id, d}; }),
  avisos: D.avisos.map(x => { const {id, ...d} = x; return {id, d, autor:null, criado_em:d.criadoEm}; }),
  eventos: D.eventos.map(x => { const {id, ...d} = x; return {id, d, autor:null}; }),
  checkin_marcas:[], historico:[], convites:[],
  chat:[{id:'m1', texto:'Bom dia, pessoal! Escala de domingo fechada?', por:U.betel, em:'2026-10-25T12:00:00.000Z'},
        {id:'m2', texto:'Falta só a recepção da noite.', por:U.gestao, em:new Date(Date.now()-3600e3).toISOString()},
        {id:'m3', texto:'Combinado, eu vejo isso.', por:U.admin, em:new Date(Date.now()-1800e3).toISOString()}] };
window.__TABELAS = T;
const derivados = (t, r) => { if (t==='escalas' || t==='eventos') r.data = r.d && r.d.data; if (t==='escalas') { r.culto = r.d.culto; r.area = r.d.area; } return r; };
Object.keys(T).forEach(t => T[t].forEach(r => derivados(t, r)));
const chaves = {checkin_marcas:['data','culto','chave'], convites:['email']};
const mesma = (t, a, b) => (chaves[t]||['id']).every(k => a[k] === b[k]);
let sessao = null; const ouvintes = [];
try { const p = localStorage.getItem('mockPapel'); if (p && U[p]) sessao = {user:{id:U[p], email:p+'@x'}}; } catch(e){}
const emitir = ev => ouvintes.forEach(cb => setTimeout(() => cb(ev, sessao), 0));
window.__mockRecuperar = () => { sessao = {user:{id:U.novo, email:'nova.pessoa@gmail.com', user_metadata:{}}}; emitir('PASSWORD_RECOVERY'); };
class Q {
  constructor(t){ this.t = t; this.f = []; this.op = 'select'; this.ord = null; this.lim = 1e9; this.um = false; this.ret = false; }
  select(){ if (this.op !== 'select') this.ret = true; return this; }
  eq(k,v){ this.f.push(r => r[k] === v); return this; }
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
        if (this.t === 'checkin_marcas') { n.por = sessao && sessao.user.id; n.em = agora; }
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
  rpc: async n => n === 'pessoas_nomes' ? {data: sessao ? T.pessoas.map(p => ({id:p.id, nome:p.nome, apelido:p.apelido})) : [], error:null} : {data:null, error:null},
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
