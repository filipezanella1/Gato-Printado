/* Gato Printado 2.0 — aplicativo
 * Vendas · Painel · Clientes · Estoque · Ajustes
 * Os dados vivem em 4 coleções: vendas, insumos, compras, config (documento "geral").
 */
(function () {
"use strict";

/* =====================================================================
   Utilidades
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const BRL = new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"});
const brl = v => BRL.format(+v || 0);
const n = v => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
const r2 = v => Math.round((+v || 0) * 100) / 100;
const r3 = v => Math.round((+v || 0) * 1000) / 1000;
const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const STATUS = {orcamento:"Orçamento", producao:"Em produção", pronto:"Pronto", enviado:"Enviado", entregue:"Entregue", cancelado:"Cancelado"};
const FORMAS = ["Pix","Dinheiro","Cartão de crédito","Cartão de débito","Transferência","Outro"];
const COLS = ["vendas","insumos","compras","config"];
const PAGE = 30;

function iso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function todayISO(){ return iso(new Date()); }
function parseISO(s){ const [y,m,d] = String(s||"").split("-").map(Number); return new Date(y||1970,(m||1)-1,d||1); }
function addDays(s,k){ const d = parseISO(s); d.setDate(d.getDate()+k); return iso(d); }
function diffDays(a,b){ return Math.round((parseISO(b)-parseISO(a))/86400000); }
function fmtDate(s){ if(!s) return "—"; const d = parseISO(s); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }
function fmtShort(s){ if(!s) return "—"; const d = parseISO(s); return String(d.getDate()).padStart(2,"0")+" "+MES[d.getMonth()]; }
function fmtQty(v){ return (+v||0).toLocaleString("pt-BR",{maximumFractionDigits:3}); }
function pct(v){ return (isFinite(v) ? Math.round(v) : 0) + "%"; }
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const digits = s => String(s||"").replace(/\D/g,"");
function phoneBR(s){
  let d = digits(s);
  if(d.length===10 || d.length===11) d = "55"+d;
  return (d.length===12 || d.length===13) && d.startsWith("55") ? d : "";
}
function shortId(id){ return String(id||"").slice(-6).toUpperCase(); }
function csvCell(v){ const s = String(v ?? ""); return /[;"\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function download(name, content, type){
  const blob = content instanceof Blob ? content : new Blob([content], {type});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v==null ? d : v; }catch(e){ return d; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };

/* =====================================================================
   Estado e configuração
   ===================================================================== */
const S = { vendas:[], insumos:[], compras:[], config:[] };
let backend = null;
let loaded = false;

const DEFAULT_TIPOS = [
  {id:"3d", nome:"Impressão 3D", prazo:15, cor:0},
  {id:"quadro", nome:"Quadro", prazo:5, cor:1}
];
/* Tabela de preços (miniaturas) e parâmetros de custo — valores iniciais, editáveis em Ajustes */
const DEFAULT_CATALOGO = [
  {id:"p1",     nome:"1 pessoa",            preco:190, resinaG:35, horasImp:4, horasPint:3,   tipo:"3d"},
  {id:"casal",  nome:"Casal",               preco:260, resinaG:65, horasImp:5, horasPint:5,   tipo:"3d"},
  {id:"pet",    nome:"Pet",                 preco:210, resinaG:30, horasImp:4, horasPint:3.5, tipo:"3d"},
  {id:"pperso", nome:"Pessoa + Personagem", preco:310, resinaG:75, horasImp:6, horasPint:6,   tipo:"3d"},
  {id:"pmpet",  nome:"Pessoa + Mini Pet",   preco:260, resinaG:50, horasImp:5, horasPint:4.5, tipo:"3d"},
  {id:"adic",   nome:"Cada adicional",      preco:60,  resinaG:25, horasImp:0, horasPint:2,   tipo:"3d"}
];
const DEFAULT_CUSTOS = {
  resinaKg:160, perda:15, resinaInsumoId:"",          // resina: R$/kg e % perdida em suportes/lavagem
  watts:80, tarifa:0.95,                               // energia: potência média (W) e tarifa (R$/kWh)
  impressoraValor:2500, vidaUtilH:3000, manutHora:0.4, // desgaste do equipamento
  valorHora:25, embalagem:8,                           // sua hora de pintura e embalagem padrão
  impostoModo:"das", das:82.05, impostoPct:6,          // MEI: DAS mensal rateado, ou % sobre a venda
  pedidosMes:15, fixosMes:0, margemAlvo:40
};
function cfg(){
  const g = S.config.find(d => d.id === "geral") || {};
  return {
    catalogo: Array.isArray(g.catalogo) ? g.catalogo : DEFAULT_CATALOGO,
    custos: Object.assign({}, DEFAULT_CUSTOS, g.custos || {}),
    loja: Object.assign({nome:"Gato Printado", whats:"", pix:"", insta:"", rodape:"Obrigado pela preferência! 🐱"}, g.loja || {}),
    tipos: Array.isArray(g.tipos) && g.tipos.length ? g.tipos : DEFAULT_TIPOS,
    freteNoSaldo: g.freteNoSaldo !== false
  };
}
function tipo(id){
  const t = cfg().tipos.find(x => x.id === id);
  if(t) return t;
  const d = DEFAULT_TIPOS.find(x => x.id === id);
  return d || {id, nome: id || "Outro", prazo: 7, cor: 5};
}
const tvars = t => "--tc:var(--t"+((+t.cor||0)%6)+");--tcs:var(--t"+((+t.cor||0)%6)+"s)";

/* ---------- regras de negócio de uma venda ---------- */
function pagos(v){
  if(Array.isArray(v.pagamentos)) return v.pagamentos;
  // vendas da versão 1: só "entrada" + "quitado"
  const out = [];
  if(n(v.entrada) > 0) out.push({valor:n(v.entrada), data:v.data, forma:"—"});
  if(v.quitado && devido(v) > n(v.entrada)) out.push({valor:r2(devido(v)-n(v.entrada)), data:v.quitadoEm || v.data, forma:"—"});
  return out;
}
const devido = v => r2(n(v.total) + (cfg().freteNoSaldo ? n(v.frete) : 0));   // o que o cliente paga
const recebido = v => r2(pagos(v).reduce((a,p) => a + n(p.valor), 0));
const saldo = v => (v.status === "cancelado" || v.status === "orcamento") ? 0 : Math.max(0, r2(devido(v) - recebido(v)));
const custo = v => r2(n(v.custoMateriais) + n(v.custoExtra));
const lucro = v => r2(n(v.total) - custo(v));
const ativa = v => v.status !== "cancelado" && v.status !== "orcamento";
// o estoque já foi descontado para esta venda? (vendas antigas: sim, exceto orçamentos)
const baixado = v => v.estoqueBaixado !== undefined ? !!v.estoqueBaixado : v.status !== "orcamento";
function custoUnit(it){ return it && n(it.qtdCompra) > 0 ? n(it.preco) / n(it.qtdCompra) : 0; }
function deliveryState(v){
  if(v.status === "cancelado") return {cls:"mute", txt:"Cancelada"};
  if(v.status === "orcamento") return {cls:"mute", txt:"Orçamento"};
  if(v.status === "entregue") return {cls:"ok", txt:"Entregue"};
  const d = diffDays(todayISO(), v.prazo);
  if(d < 0) return {cls:"bad", txt:"Atrasada "+(-d)+"d"};
  if(d === 0) return {cls:"warn", txt:"Vence hoje"};
  if(d <= 2) return {cls:"warn", txt:"Faltam "+d+"d"};
  return {cls:"mute", txt:"Faltam "+d+"d"};
}
const atrasada = v => ativa(v) && v.status !== "entregue" && v.prazo < todayISO();

/* ---------- calculadora de custos da encomenda ---------- */
const G_PER = {g:1, kg:1000, ml:1.1, L:1100};   // gramas por unidade (resina ≈ 1,1 g/ml)
function resinaInfo(C0){
  const C = C0 || cfg().custos;
  const it = C.resinaInsumoId ? S.insumos.find(x => x.id === C.resinaInsumoId && G_PER[x.unidade]) : null;
  const precoG = it && custoUnit(it) > 0 ? custoUnit(it) / G_PER[it.unidade] : n(C.resinaKg) / 1000;
  return {precoG, it: it || null};
}
const LINHAS = [
  ["resina","Resina"], ["energia","Energia elétrica"], ["equipamento","Impressora (desgaste)"],
  ["pintura","Pintura (sua mão de obra)"], ["embalagem","Embalagem"], ["imposto","Imposto MEI"],
  ["fixos","Custos fixos (rateio)"], ["taxa","Taxa do cartão"], ["materiais","Materiais do estoque"], ["outros","Outros custos"]
];
function calcular(inp, total, C0){
  const C = C0 || cfg().custos, R = resinaInfo(C), pm = Math.max(1, n(C.pedidosMes));
  const gUsados = n(inp.resinaG) * (1 + n(C.perda)/100);
  const pctImp = C.impostoModo === "pct" ? n(C.impostoPct)/100 : 0, pctTaxa = n(inp.taxaPct)/100;
  const L = {
    resina: gUsados * R.precoG,
    energia: n(inp.horasImp) * n(C.watts)/1000 * n(C.tarifa),
    equipamento: n(inp.horasImp) * ((n(C.vidaUtilH) > 0 ? n(C.impressoraValor)/n(C.vidaUtilH) : 0) + n(C.manutHora)),
    pintura: n(inp.horasPint) * n(C.valorHora),
    embalagem: n(inp.embalagem),
    imposto: C.impostoModo === "pct" ? total * pctImp : n(C.das)/pm,
    fixos: n(C.fixosMes)/pm,
    taxa: total * pctTaxa,
    materiais: n(inp.matsCusto),
    outros: (inp.outros||[]).reduce((a,o) => a + n(o.valor), 0)
  };
  Object.keys(L).forEach(k => L[k] = r2(L[k]));
  const custoTotal = r2(Object.values(L).reduce((a,b) => a+b, 0));
  const fixo = custoTotal - L.taxa - (C.impostoModo === "pct" ? L.imposto : 0);   // custos que não dependem do preço
  const m = n(C.margemAlvo)/100, pv = pctImp + pctTaxa;
  return {
    L, custoTotal, lucro: r2(total - custoTotal), ganho: r2(total - custoTotal + L.pintura),
    gUsados: r3(gUsados), resina: R,
    precoMin: pv < 1 ? r2(fixo/(1-pv)) : 0,
    precoAlvo: (1-pv-m) > 0 ? r2(fixo/(1-pv-m)) : 0, margemAlvo: n(C.margemAlvo)
  };
}
function itensTexto(itens){ return (itens||[]).map(i => (n(i.qtd) > 1 ? n(i.qtd)+"× " : "")+i.nome).join(" + "); }

/* =====================================================================
   Backends (local, banco do Claude, nuvem Firebase via cloud.js)
   ===================================================================== */
function localBackend(){
  const KEY = "balcao-local-v1";
  let data = {vendas:[], insumos:[], compras:[], config:[]};
  try{ const raw = localStorage.getItem(KEY); if(raw) data = Object.assign(data, JSON.parse(raw)); }catch(e){}
  COLS.forEach(c => { if(!Array.isArray(data[c])) data[c] = []; });
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){} };
  const sync = () => { COLS.forEach(c => S[c] = data[c].slice()); renderAll(); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  return {
    local:true,
    start(){ loaded = true; sync(); },
    newId(){ return uid(); },
    async add(c,doc){ const id = uid(); data[c].push(Object.assign({}, doc, {id})); save(); sync(); return id; },
    async set(c,id,doc){ const v = Object.assign({}, doc, {id}); const i = data[c].findIndex(x => x.id === id); if(i<0) data[c].push(v); else data[c][i] = v; save(); sync(); },
    async update(c,id,patch){ const i = data[c].findIndex(x => x.id === id); if(i>=0){ data[c][i] = Object.assign({}, data[c][i], patch); save(); sync(); } },
    async del(c,id){ data[c] = data[c].filter(x => x.id !== id); save(); sync(); },
    async bulkPut(d, opt){ if(opt && opt.replace) COLS.forEach(c => data[c] = []); COLS.forEach(c => (d[c]||[]).forEach(x => { const id = x.id || uid(); data[c] = data[c].filter(y => y.id !== id); data[c].push(Object.assign({}, x, {id})); })); save(); sync(); }
  };
}
function claudeBackend(db){
  const strip = d => { const o = Object.assign({}, d); delete o.id; return o; };
  return {
    local:false,
    start(){
      let pending = COLS.length;
      COLS.forEach(c => {
        let first = true;
        db.collection(c).onSnapshot(snap => {
          S[c] = snap.docs.map(d => Object.assign({id:d.id}, d.data()));
          if(first){ first = false; if(--pending === 0) loaded = true; }
          renderAll();
        }, err => toast("Não foi possível sincronizar ("+err.code+"). Recarregue a página."));
      });
    },
    newId(){ return db.collection("vendas").doc().id; },
    async add(c,doc){ const ref = await db.collection(c).add(strip(doc)); return ref.id; },
    async set(c,id,doc){ await db.doc(c+"/"+id).set(strip(doc)); },
    async update(c,id,patch){ await db.doc(c+"/"+id).update(strip(patch)); },
    async del(c,id){ await db.doc(c+"/"+id).delete(); },
    async bulkPut(d){ for(const c of COLS) for(const x of (d[c]||[])) await db.doc(c+"/"+(x.id || db.collection(c).doc().id)).set(strip(x)); }
  };
}
async function run(p, okMsg, action){
  try{ await p; if(okMsg) toast(okMsg, action); return true; }
  catch(e){
    const code = e && e.code;
    if(code === "quota_exceeded") toast("Limite de registros atingido. Apague registros antigos para continuar.");
    else if(code === "invalid_argument" || code === "permission-denied") toast("Sem permissão para alterar estes dados.");
    else toast("Não foi possível salvar agora. Tente de novo em instantes.");
    return false;
  }
}

/* =====================================================================
   Navegação e toast
   ===================================================================== */
const VIEWS = ["vendas","painel","clientes","estoque","ajustes"];
let view = lsGet("balcao-tab", "vendas");
if(!VIEWS.includes(view)) view = "vendas";
if(VIEWS.includes(location.hash.slice(1))) view = location.hash.slice(1);
function showView(v){
  view = v;
  $$("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.view === v ? "true" : "false"));
  VIEWS.forEach(k => $("#view-"+k).hidden = k !== v);
  lsSet("balcao-tab", v);
  if(v === "ajustes") renderSettings(true);
  window.scrollTo({top:0});
}
$$("nav.tabs button").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));

let toastTimer;
function toast(msg, action){
  const t = $("#toast"), a = $("#toast-act");
  $("#toast-msg").textContent = msg;
  if(action && action.label){ a.textContent = action.label; a.hidden = false; a.onclick = () => { t.hidden = true; action.fn(); }; }
  else { a.hidden = true; a.onclick = null; }
  t.hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, action ? 7000 : 3400);
}

/* =====================================================================
   Estoque: aplicar consumo (positivo = sai do estoque)
   ===================================================================== */
async function aplicarConsumo(delta){
  const avisos = [];
  for(const id of Object.keys(delta)){
    const d = delta[id]; if(!d) continue;
    const it = S.insumos.find(x => x.id === id); if(!it) continue;
    const nq = r3(n(it.qtd) - d);
    if(nq < 0) avisos.push(it.nome);
    await backend.update("insumos", id, {qtd: Math.max(0, nq)});
  }
  if(avisos.length) setTimeout(() => toast("Atenção: estoque insuficiente de "+avisos.join(", ")+". Ficou em zero."), 3500);
}
function matsDelta(oldM, newM){
  const d = {};
  (oldM||[]).forEach(m => d[m.insumoId] = (d[m.insumoId]||0) - n(m.qtd));
  (newM||[]).forEach(m => d[m.insumoId] = (d[m.insumoId]||0) + n(m.qtd));
  Object.keys(d).forEach(k => { d[k] = r3(d[k]); if(!d[k]) delete d[k]; });
  return d;
}

/* =====================================================================
   Formulário de venda
   ===================================================================== */
let editingId = null;
let prazoManual = false;
let formMats = [];      // [{insumoId, qtd}]
let formAddr = null;    // {logradouro,bairro,cidade,uf}
let formItens = [];     // [{catId, nome, qtd, preco}]
let formOutros = [];    // [{desc, valor}]
let totalManual = false;
let touched = new Set();
const F = {
  cliente:$("#f-cliente"), contato:$("#f-contato"), desc:$("#f-desc"), total:$("#f-total"), entrada:$("#f-entrada"),
  forma:$("#f-forma"), cep:$("#f-cep"), entrega:$("#f-entrega"), frete:$("#f-frete"), data:$("#f-data"),
  prazo:$("#f-prazo"), obs:$("#f-obs"),
  resina:$("#f-resina"), himp:$("#f-himp"), hpint:$("#f-hpint"), emb:$("#f-emb"), taxa:$("#f-taxa")
};
F.forma.innerHTML = FORMAS.map(f => '<option>'+f+'</option>').join("");
F.data.value = todayISO();
const isMobile = () => matchMedia("(max-width:980px)").matches;
function openForm(show){ $("#form-panel").hidden = !show; $("#btn-new-sale").hidden = show && isMobile() ? true : false; }
if(isMobile()) openForm(false);
matchMedia("(max-width:980px)").addEventListener("change", ev => { if(ev.matches){ if(!editingId) openForm(false); } else openForm(true); });
$("#btn-new-sale").addEventListener("click", () => { resetForm(); openForm(true); $("#form-panel").scrollIntoView({behavior:"smooth"}); F.cliente.focus({preventScroll:true}); });
$("#btn-close-form").addEventListener("click", () => { resetForm(); if(isMobile()) openForm(false); });

let tiposSig = "";
function renderTipoSeg(){
  const tipos = cfg().tipos, sig = JSON.stringify(tipos);
  if(sig === tiposSig) return;
  tiposSig = sig;
  const cur = tipoVal();
  $("#seg-tipos").innerHTML = tipos.map((t,i) =>
    '<input type="radio" name="produto" id="tp-'+esc(t.id)+'" value="'+esc(t.id)+'"'+((cur ? cur===t.id : i===0)?" checked":"")+'>'+
    '<label for="tp-'+esc(t.id)+'" style="'+tvars(t)+'">'+esc(t.nome)+'<small>prazo '+(+t.prazo||0)+' dias</small></label>').join("");
  if(!tipoVal()){ const f = $("#seg-tipos input"); if(f) f.checked = true; }
  $$("#seg-tipos input").forEach(r => r.addEventListener("change", () => { autoPrazo(); updateSum(); }));
  const fp = $("#flt-prod"), keep = fp.value;
  fp.innerHTML = '<option value="">Todos os produtos</option>' + tipos.map(t => '<option value="'+esc(t.id)+'">'+esc(t.nome)+'</option>').join("");
  fp.value = keep;
  autoPrazo();
}
function tipoVal(){ const r = document.querySelector('input[name=produto]:checked'); return r ? r.value : ""; }
function autoPrazo(){ if(prazoManual) return; const t = tipo(tipoVal()); F.prazo.value = addDays(F.data.value || todayISO(), +t.prazo || 0); }
F.data.addEventListener("input", () => { autoPrazo(); updateSum(); });
F.prazo.addEventListener("input", () => { prazoManual = true; updateSum(); });
[F.total, F.entrada, F.frete].forEach(i => i.addEventListener("input", updateSum));
F.entrega.addEventListener("change", () => { if(F.entrega.value === "Retirada no local"){ F.frete.value = "0"; updateSum(); } });

/* clientes conhecidos: autocompletar */
function clientIndex(){
  const m = new Map();
  S.vendas.slice().sort((a,b) => String(a.data).localeCompare(String(b.data))).forEach(v => {
    const k = norm(v.cliente); if(!k) return;
    const c = m.get(k) || {nome:v.cliente, contato:"", cep:"", endereco:null};
    c.nome = v.cliente; if(v.contato) c.contato = v.contato; if(v.cep){ c.cep = v.cep; c.endereco = v.endereco || c.endereco; }
    m.set(k, c);
  });
  return m;
}
function renderDatalist(){
  const names = Array.from(clientIndex().values()).map(c => c.nome).sort((a,b) => a.localeCompare(b,"pt-BR"));
  $("#dl-clientes").innerHTML = names.map(x => '<option value="'+esc(x)+'"></option>').join("");
}
F.cliente.addEventListener("change", () => {
  if(editingId) return;
  const c = clientIndex().get(norm(F.cliente.value)); if(!c) return;
  if(!F.contato.value && c.contato) F.contato.value = c.contato;
  if(!F.cep.value && c.cep){ F.cep.value = c.cep; formAddr = c.endereco; showAddr(); }
});

/* CEP → endereço (ViaCEP) */
let cepSeq = 0;
function showAddr(msg, err){
  const el = $("#f-addr"); el.classList.toggle("err", !!err);
  if(msg){ el.textContent = msg; return; }
  el.textContent = formAddr ? [formAddr.logradouro, formAddr.bairro, formAddr.cidade && (formAddr.cidade+"/"+formAddr.uf)].filter(Boolean).join(" · ") : "";
}
F.cep.addEventListener("input", async () => {
  const d = digits(F.cep.value).slice(0,8);
  F.cep.value = d.length > 5 ? d.slice(0,5)+"-"+d.slice(5) : d;
  if(d.length !== 8){ formAddr = null; showAddr(); return; }
  const seq = ++cepSeq; showAddr("Buscando endereço…");
  try{
    const r = await fetch("https://viacep.com.br/ws/"+d+"/json/");
    const j = await r.json(); if(seq !== cepSeq) return;
    if(j.erro){ formAddr = null; showAddr("CEP não encontrado. Confira os números.", true); return; }
    formAddr = {logradouro:j.logradouro||"", bairro:j.bairro||"", cidade:j.localidade||"", uf:j.uf||""};
    showAddr();
  }catch(e){ if(seq === cepSeq){ formAddr = null; showAddr("Sem internet para buscar o endereço — o CEP fica salvo mesmo assim."); } }
});

/* materiais usados */
function matOptions(sel){
  const its = S.insumos.slice().sort((a,b) => String(a.nome).localeCompare(String(b.nome),"pt-BR"));
  return '<option value="">Escolha o insumo…</option>' + its.map(it => '<option value="'+esc(it.id)+'"'+(it.id===sel?" selected":"")+'>'+esc(it.nome)+' ('+fmtQty(it.qtd)+' '+esc(it.unidade)+')</option>').join("");
}
function renderMats(){
  const box = $("#mat-rows");
  if(!S.insumos.length){ box.innerHTML = '<span class="hint">Cadastre insumos na aba Estoque para usar aqui.</span>'; $("#btn-add-mat").disabled = true; return; }
  $("#btn-add-mat").disabled = false;
  box.innerHTML = formMats.map((m,i) => {
    const it = S.insumos.find(x => x.id === m.insumoId), cu = custoUnit(it);
    return '<div class="mat-row" data-i="'+i+'"><select class="inp" data-k="insumoId" aria-label="Insumo">'+matOptions(m.insumoId)+'</select>'+
      '<input class="inp mono" data-k="qtd" type="number" step="0.001" min="0" value="'+(m.qtd||"")+'" placeholder="qtd" aria-label="Quantidade usada">'+
      '<button type="button" class="btn sm ghost danger" data-rm="'+i+'" aria-label="Remover material">✕</button>'+
      (it ? '<span class="c">'+esc(it.unidade)+' · '+(cu ? brl(cu)+' por '+esc(it.unidade)+' = '+brl(cu*n(m.qtd)) : 'sem preço de compra cadastrado')+'</span>' : '')+'</div>';
  }).join("");
}
$("#btn-add-mat").addEventListener("click", () => { formMats.push({insumoId:"", qtd:""}); renderMats(); updateSum(); const s = $$("#mat-rows select").pop(); s && s.focus(); });
$("#mat-rows").addEventListener("change", e => {
  const row = e.target.closest(".mat-row"); if(!row) return;
  formMats[+row.dataset.i][e.target.dataset.k] = e.target.value; renderMats(); updateSum();
});
$("#mat-rows").addEventListener("input", e => {
  if(e.target.dataset.k !== "qtd") return;
  const row = e.target.closest(".mat-row"); formMats[+row.dataset.i].qtd = e.target.value; updateSum();
  const it = S.insumos.find(x => x.id === formMats[+row.dataset.i].insumoId), c = row.querySelector(".c");
  if(it && c){ const cu = custoUnit(it); c.textContent = it.unidade+" · "+(cu ? brl(cu)+" por "+it.unidade+" = "+brl(cu*n(e.target.value)) : "sem preço de compra cadastrado"); }
});
$("#mat-rows").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if(!b) return; formMats.splice(+b.dataset.rm, 1); renderMats(); updateSum(); });
function builtMats(base){
  const old = {}; ((base && base.materiais) || []).filter(m => !m.auto).forEach(m => old[m.insumoId] = m);
  return formMats.filter(m => m.insumoId && n(m.qtd) > 0).map(m => {
    const it = S.insumos.find(x => x.id === m.insumoId) || old[m.insumoId] || {};
    const cu = old[m.insumoId] && n(old[m.insumoId].qtd) === n(m.qtd) ? n(old[m.insumoId].custoUnit) : custoUnit(it);
    return {insumoId:m.insumoId, nome:it.nome || "Insumo", unidade:it.unidade || "", qtd:r3(m.qtd), custoUnit:Math.round(cu*10000)/10000};
  });
}

/* ---------- itens da encomenda (tabela de preços) ---------- */
function catOptions(sel){
  return cfg().catalogo.map(c => '<option value="'+esc(c.id)+'"'+(c.id===sel?" selected":"")+'>'+esc(c.nome)+' — '+brl(c.preco)+'</option>').join("") +
    '<option value="__custom"'+(sel==="__custom"?" selected":"")+'>Item personalizado…</option>';
}
function renderItens(){
  const box = $("#item-rows");
  if(!formItens.length){ box.innerHTML = '<span class="hint">Escolha os itens da sua tabela de preços: o valor e os custos são preenchidos sozinhos. Ex.: 1× Casal + 2× Cada adicional.</span>'; return; }
  box.innerHTML = formItens.map((it,i) =>
    '<div class="item-row" data-i="'+i+'">'+
    '<select class="inp sel" data-k="catId" aria-label="Item da tabela">'+catOptions(it.catId)+'</select>'+
    (it.catId === "__custom" ? '<input class="inp nm" data-k="nome" value="'+esc(it.nome)+'" placeholder="Descreva o item (ex.: família com 5 pessoas)" aria-label="Descrição do item">' : '')+
    '<label class="q"><span>Qtd.</span><input class="inp mono" data-k="qtd" type="number" min="1" step="1" value="'+esc(it.qtd)+'" aria-label="Quantidade"></label>'+
    '<label class="q"><span>Preço un.</span><div class="money"><span>R$</span><input class="inp" data-k="preco" type="number" min="0" step="0.01" value="'+esc(it.preco)+'" aria-label="Preço unitário"></div></label>'+
    '<span class="c" data-sub="'+i+'">= '+brl(n(it.qtd)*n(it.preco))+'</span>'+
    '<button type="button" class="btn sm ghost danger" data-rmi="'+i+'" aria-label="Remover item">✕</button></div>').join("");
}
function itensSugestao(){
  const cat = cfg().catalogo; let g = 0, hi = 0, hp = 0, preco = 0;
  formItens.forEach(i => { const c = cat.find(x => x.id === i.catId), q = n(i.qtd); preco += q*n(i.preco); if(c){ g += q*n(c.resinaG); hi += q*n(c.horasImp); hp += q*n(c.horasPint); } });
  return {g:r2(g), hi:r2(hi), hp:r2(hp), preco:r2(preco)};
}
function applySugestao(){
  const s = itensSugestao();
  if(formItens.length){
    if(!touched.has("resina")) F.resina.value = s.g || "";
    if(!touched.has("himp")) F.himp.value = s.hi || "";
    if(!touched.has("hpint")) F.hpint.value = s.hp || "";
    if(!totalManual) F.total.value = s.preco ? s.preco.toFixed(2) : "";
  }
  const th = $("#total-hint");
  if(formItens.length && totalManual && Math.abs(n(F.total.value) - s.preco) > 0.009) th.innerHTML = 'Tabela: '+brl(s.preco)+' · <button type="button" class="linkish" id="btn-use-tab">usar valor da tabela</button>';
  else th.textContent = formItens.length ? "Pela tabela de preços" : "";
}
$("#btn-add-item").addEventListener("click", () => {
  const c = cfg().catalogo[0];
  formItens.push(c ? {catId:c.id, nome:c.nome, qtd:1, preco:c.preco} : {catId:"__custom", nome:"", qtd:1, preco:0});
  if(formItens.length === 1 && c && c.tipo){ const r = document.getElementById("tp-"+c.tipo); if(r && !r.checked){ r.checked = true; autoPrazo(); } }
  renderItens(); applySugestao(); updateSum();
  const sels = $$("#item-rows select"); sels.length && sels[sels.length-1].focus();
});
$("#item-rows").addEventListener("change", e => {
  const row = e.target.closest(".item-row"); if(!row || e.target.dataset.k !== "catId") return;
  const it = formItens[+row.dataset.i], c = cfg().catalogo.find(x => x.id === e.target.value);
  it.catId = e.target.value;
  if(c){ it.nome = c.nome; it.preco = c.preco; } else { it.nome = ""; }
  renderItens(); applySugestao(); updateSum();
});
$("#item-rows").addEventListener("input", e => {
  const row = e.target.closest(".item-row"); if(!row) return;
  const i = +row.dataset.i, it = formItens[i], k = e.target.dataset.k; if(!k || k === "catId") return;
  it[k] = k === "nome" ? e.target.value : e.target.value;
  const sub = row.querySelector("[data-sub]"); if(sub) sub.textContent = "= "+brl(n(it.qtd)*n(it.preco));
  applySugestao(); updateSum();
});
$("#item-rows").addEventListener("click", e => { const b = e.target.closest("[data-rmi]"); if(!b) return; formItens.splice(+b.dataset.rmi, 1); renderItens(); applySugestao(); updateSum(); });
$("#total-hint").addEventListener("click", e => { if(e.target.id === "btn-use-tab"){ totalManual = false; applySugestao(); updateSum(); } });
F.total.addEventListener("input", () => { totalManual = true; applySugestao(); });
[["resina",F.resina],["himp",F.himp],["hpint",F.hpint],["emb",F.emb],["taxa",F.taxa]].forEach(([k,el]) => el.addEventListener("input", () => { touched.add(k); updateSum(); }));

/* ---------- outros custos (livres) ---------- */
function renderOutros(){
  $("#outro-rows").innerHTML = formOutros.map((o,i) =>
    '<div class="outro-row" data-i="'+i+'"><input class="inp" data-k="desc" value="'+esc(o.desc)+'" placeholder="Ex.: tinta dourada, base de acrílico" aria-label="Descrição do custo">'+
    '<div class="money"><span>R$</span><input class="inp" data-k="valor" type="number" min="0" step="0.01" value="'+esc(o.valor)+'" aria-label="Valor"></div>'+
    '<button type="button" class="btn sm ghost danger" data-rmo="'+i+'" aria-label="Remover custo">✕</button></div>').join("");
}
$("#btn-add-outro").addEventListener("click", () => { formOutros.push({desc:"", valor:""}); renderOutros(); const ins = $$("#outro-rows input[data-k=desc]"); ins[ins.length-1].focus(); });
$("#outro-rows").addEventListener("input", e => { const r = e.target.closest(".outro-row"); if(!r) return; formOutros[+r.dataset.i][e.target.dataset.k] = e.target.value; updateSum(); });
$("#outro-rows").addEventListener("click", e => { const b = e.target.closest("[data-rmo]"); if(!b) return; formOutros.splice(+b.dataset.rmo, 1); renderOutros(); updateSum(); });

/* ---------- cálculo ao vivo ---------- */
function formCalc(){
  const base = editingId ? S.vendas.find(v => v.id === editingId) : null;
  const mats = builtMats(base);
  const inp = {resinaG:n(F.resina.value), horasImp:n(F.himp.value), horasPint:n(F.hpint.value), embalagem:n(F.emb.value), taxaPct:n(F.taxa.value),
    outros: formOutros.filter(o => n(o.valor) > 0).map(o => ({desc:String(o.desc||"").trim() || "Outro custo", valor:r2(o.valor)})),
    matsCusto: r2(mats.reduce((a,m) => a + m.qtd*m.custoUnit, 0))};
  return {base, mats, inp, c: calcular(inp, n(F.total.value))};
}
function updateSum(){
  const tot = n(F.total.value), fr = n(F.frete.value);
  const {base, c} = formCalc();
  const rec = base ? recebido(base) : n(F.entrada.value), pz = F.prazo.value;
  $("#sumbox").innerHTML =
    '<span>Entrega prevista</span><b>'+fmtDate(pz)+(pz && F.data.value ? ' <span class="muted">('+diffDays(F.data.value, pz)+' dias'+(prazoManual?', manual':'')+')</span>' : '')+'</b>'+
    '<span>Recebido</span><b>'+brl(rec)+'</b>'+
    (fr ? '<span>Frete'+(cfg().freteNoSaldo ? ' (entra no valor a receber)' : ' (pago à parte)')+'</span><b>'+brl(fr)+'</b>' : '')+
    '<span class="hl">Falta receber</span><b class="hl">'+brl(Math.max(0, tot + (cfg().freteNoSaldo ? fr : 0) - rec))+'</b>';
  // detalhamento de custos
  const mx = Math.max(...Object.values(c.L), 0.01);
  const rows = LINHAS.filter(([k]) => c.L[k] > 0).map(([k,lb]) =>
    '<div class="bd-row"><span>'+lb+(k==="resina" ? ' <small class="muted">'+fmtQty(c.gUsados)+' g'+(c.resina.it ? ' · estoque' : '')+'</small>' : '')+'</span>'+
    '<span class="bd-bar"><i style="width:'+(c.L[k]/mx*100)+'%"></i></span><b>'+brl(c.L[k])+'</b></div>').join("");
  const mg = tot ? c.lucro/tot*100 : 0;
  $("#breakdown").innerHTML =
    (rows || '<span class="hint">Preencha resina, horas e embalagem para ver o custo.</span>')+
    '<div class="bd-tot"><span>Custo total</span><b>'+brl(c.custoTotal)+'</b></div>'+
    (tot ? '<div class="bd-tot big"><span>Lucro da empresa</span><b style="color:var('+(c.lucro<0?'--bad':'--ok')+')">'+brl(c.lucro)+' <small>('+pct(mg)+')</small></b></div>'+
      (c.L.pintura ? '<div class="bd-tot"><span>Seu ganho total <small class="muted">lucro + mão de obra</small></span><b>'+brl(c.ganho)+'</b></div>' : '') : '')+
    '<div class="bd-price"><span>Preço mínimo (sem lucro): <b>'+brl(c.precoMin)+'</b></span>'+
      (c.precoAlvo ? '<span>Preço para '+pct(c.margemAlvo)+' de margem: <b>'+brl(c.precoAlvo)+'</b> <button type="button" class="linkish" id="btn-use-alvo">usar</button></span>' : '')+'</div>'+
    (tot && tot < c.precoMin ? '<div class="bd-warn">⚠ O valor cobrado não cobre os custos desta encomenda.</div>' : '');
}
$("#breakdown").addEventListener("click", e => { if(e.target.id === "btn-use-alvo"){ const {c} = formCalc(); F.total.value = c.precoAlvo.toFixed(2); totalManual = true; applySugestao(); updateSum(); } });

function resetForm(){
  $("#sale-form").reset(); editingId = null; prazoManual = false; totalManual = false; touched = new Set();
  formMats = []; formItens = []; formOutros = []; formAddr = null;
  F.data.value = todayISO(); F.emb.value = cfg().custos.embalagem || ""; showAddr();
  $("#form-title").textContent = "Nova venda"; $("#btn-save").textContent = "Registrar venda"; $("#btn-orc").textContent = "Salvar como orçamento"; $("#btn-orc").hidden = false;
  $("#btn-cancel-edit").hidden = true;
  $("#wrap-entrada").hidden = false; $("#wrap-forma").hidden = false; $("#wrap-pagos").hidden = true;
  const f = $("#seg-tipos input"); if(f) f.checked = true;
  autoPrazo(); renderItens(); renderOutros(); renderMats(); applySugestao(); updateSum();
}
$("#btn-cancel-edit").addEventListener("click", () => { resetForm(); if(isMobile()) openForm(false); });

function editSale(id, duplicate){
  const v = S.vendas.find(x => x.id === id); if(!v) return;
  resetForm();
  editingId = duplicate ? null : id;
  F.cliente.value = v.cliente||""; F.contato.value = v.contato||""; F.desc.value = v.descricao||"";
  F.total.value = v.total||""; F.cep.value = v.cep||""; F.entrega.value = v.entrega||"Correios PAC";
  F.frete.value = v.frete||""; F.obs.value = v.obs||"";
  formAddr = v.endereco || null; showAddr();
  const r = document.getElementById("tp-"+v.produto) || $("#seg-tipos input"); if(r) r.checked = true;
  formMats = (v.materiais||[]).filter(m => !m.auto).map(m => ({insumoId:m.insumoId, qtd:m.qtd}));
  formItens = (v.itens||[]).map(i => ({catId:i.catId || "__custom", nome:i.nome, qtd:i.qtd, preco:i.preco}));
  totalManual = true; touched = new Set(["resina","himp","hpint","emb","taxa"]);
  if(v.calc){
    F.resina.value = v.calc.resinaG || ""; F.himp.value = v.calc.horasImp || ""; F.hpint.value = v.calc.horasPint || "";
    F.emb.value = v.calc.embalagem || ""; F.taxa.value = v.calc.taxaPct || "";
    formOutros = (v.calc.outros||[]).map(o => ({desc:o.desc, valor:o.valor}));
  } else {
    F.emb.value = ""; formOutros = n(v.custoExtra) > 0 ? [{desc:"Outros custos", valor:v.custoExtra}] : [];
  }
  const orc = v.status === "orcamento";
  if(duplicate){
    F.data.value = todayISO(); autoPrazo();
    $("#form-title").textContent = "Nova venda (cópia)";
  } else {
    F.data.value = v.data || todayISO(); F.prazo.value = v.prazo || ""; prazoManual = true;
    $("#form-title").textContent = (orc ? "Editar orçamento #" : "Editar venda #")+shortId(v.id);
    $("#btn-save").textContent = orc ? "Aprovar e registrar venda" : "Salvar alterações";
    $("#btn-orc").hidden = !orc; $("#btn-orc").textContent = "Salvar orçamento";
    $("#btn-cancel-edit").hidden = false;
    $("#wrap-entrada").hidden = true; $("#wrap-forma").hidden = true; $("#wrap-pagos").hidden = false;
    $("#f-pagos").textContent = brl(recebido(v)) + " (pagamentos são editados em Detalhes)";
  }
  renderItens(); renderOutros(); renderMats(); applySugestao(); updateSum(); openForm(true);
  $("#form-panel").scrollIntoView({behavior:"smooth", block:"start"}); F.cliente.focus({preventScroll:true});
}

async function salvarVenda(modo){   // modo: "venda" | "orc"
  if(!backend) return;
  if(!$("#sale-form").reportValidity()) return;
  const tot = r2(F.total.value), ent = r2(F.entrada.value);
  const cepD = digits(F.cep.value);
  if(cepD && cepD.length !== 8){ toast("O CEP precisa ter 8 dígitos."); F.cep.focus(); return; }
  if(!editingId && ent > tot + n(F.frete.value)){ toast("A entrada não pode ser maior que o total do pedido."); F.entrada.focus(); return; }
  if(formMats.some(m => m.insumoId && !(n(m.qtd) > 0))){ toast("Informe a quantidade de cada material usado."); return; }
  if(formItens.some(i => i.catId === "__custom" && !String(i.nome||"").trim())){ toast("Descreva o item personalizado."); return; }
  const data = F.data.value || todayISO();
  const {base: b0, mats, inp, c} = formCalc();
  const base = b0 || {};
  // resina vinculada ao estoque vira um material automático
  const all = mats.slice();
  if(c.resina.it && c.gUsados > 0){
    const it = c.resina.it, f = G_PER[it.unidade];
    all.push({insumoId:it.id, nome:it.nome, unidade:it.unidade, qtd:r3(c.gUsados/f), custoUnit:Math.round(c.resina.precoG*f*10000)/10000, auto:true});
  }
  const status = editingId ? (base.status === "orcamento" && modo === "venda" ? "producao" : base.status || "producao") : (modo === "orc" ? "orcamento" : "producao");
  const newBaixado = status === "orcamento" ? false : (editingId ? (baixado(base) || status !== "cancelado") : true);
  const itens = formItens.filter(i => n(i.qtd) > 0).map(i => ({catId: i.catId === "__custom" ? "" : i.catId, nome: String(i.nome||"").trim(), qtd: n(i.qtd), preco: r2(i.preco)}));
  const pag = editingId ? pagos(base) : (ent > 0 ? [{valor:ent, data, forma:F.forma.value}] : []);
  const custoMat = r2(inp.matsCusto + (c.resina.it ? c.L.resina : 0));
  const doc = Object.assign({}, base, {
    cliente:F.cliente.value.trim(), contato:F.contato.value.trim(), produto:tipoVal() || cfg().tipos[0].id,
    descricao:F.desc.value.trim() || itensTexto(itens), itens, total:tot, precoTabela: itensSugestao().preco,
    pagamentos:pag, entrada: pag[0] ? n(pag[0].valor) : 0,
    cep:F.cep.value, endereco: formAddr || null, entrega:F.entrega.value, frete:r2(F.frete.value),
    data, prazo: F.prazo.value || addDays(data, +tipo(tipoVal()).prazo || 0),
    materiais:all, calc:{resinaG:inp.resinaG, horasImp:inp.horasImp, horasPint:inp.horasPint, embalagem:inp.embalagem, taxaPct:inp.taxaPct, outros:inp.outros},
    custos:c.L, custoTotal:c.custoTotal, custoMateriais:custoMat, custoExtra:r2(c.custoTotal - custoMat), maoDeObra:c.L.pintura,
    obs:F.obs.value.trim(), status, estoqueBaixado:newBaixado,
    criadoEm: base.criadoEm || new Date().toISOString(), atualizadoEm: new Date().toISOString()
  });
  delete doc.id; delete doc.quitado; delete doc.quitadoEm;
  const delta = matsDelta(editingId && baixado(base) ? base.materiais : [], newBaixado ? all : []);
  const wasEditing = editingId, virouVenda = base.status === "orcamento" && status !== "orcamento";
  resetForm(); if(isMobile()) openForm(false);
  if(wasEditing){
    if(await run(backend.set("vendas", wasEditing, doc), virouVenda ? "Orçamento aprovado · entrega até "+fmtDate(doc.prazo) : status === "orcamento" ? "Orçamento atualizado" : "Venda atualizada")) await aplicarConsumo(delta);
  } else {
    let id = null;
    const msg = status === "orcamento" ? "Orçamento salvo · lucro previsto "+brl(c.lucro) : "Venda registrada · entrega até "+fmtDate(doc.prazo);
    if(await run((async () => { id = await backend.add("vendas", doc); })(), msg, {label: status === "orcamento" ? "Enviar no WhatsApp" : "Ver", fn:() => { openRow = {id, kind: status === "orcamento" ? "wa" : "det"}; $("#flt-status").value = status === "orcamento" ? "orcamento" : "abertas"; renderSales(); }})) await aplicarConsumo(delta);
  }
}
$("#sale-form").addEventListener("submit", e => { e.preventDefault(); salvarVenda("venda"); });
$("#btn-orc").addEventListener("click", () => salvarVenda("orc"));

/* =====================================================================
   Lista de vendas
   ===================================================================== */
let openRow = null;      // {id, kind:'pag'|'wa'|'det'}
let confirmDel = null;
let clientFilter = null; // chave normalizada
let shown = PAGE;

function waLink(num, text){ return "https://wa.me/"+(num||"")+"?text="+encodeURIComponent(text); }
function saleSummary(v){
  const t = tipo(v.produto), L = cfg().loja;
  const its = (v.itens||[]).length ? v.itens.map(i => "  – "+(n(i.qtd)>1 ? n(i.qtd)+"× " : "")+i.nome+": "+brl(n(i.qtd)*n(i.preco))).join("\n")+"\n" : "";
  return "Pedido #"+shortId(v.id)+" — "+(v.descricao || t.nome)+"\n"+its+
    "• Valor: "+brl(v.total)+(n(v.frete) ? " + frete "+brl(v.frete)+(cfg().freteNoSaldo ? " = "+brl(devido(v)) : " (pago à parte)") : "")+"\n"+
    "• Pago: "+brl(recebido(v))+"\n"+
    (saldo(v) > 0 ? "• Falta: "+brl(saldo(v))+"\n" : "")+
    "• Previsão de entrega: "+fmtDate(v.prazo)+" ("+v.entrega+")"+
    (saldo(v) > 0 && L.pix ? "\n\nPix para pagamento: "+L.pix : "");
}
function waMsgs(v){
  const nome = String(v.cliente||"").replace(/^Exemplo · /,"").split(" ")[0] || "";
  const L = cfg().loja, loja = L.nome || "Gato Printado";
  if(v.status === "orcamento"){
    const its = (v.itens||[]).length ? v.itens.map(i => "• "+(n(i.qtd)>1 ? n(i.qtd)+"× " : "")+i.nome+" — "+brl(n(i.qtd)*n(i.preco))).join("\n") : "• "+(v.descricao || tipo(v.produto).nome)+" — "+brl(v.total);
    return [{k:"orc", t:"Enviar orçamento", m:"Olá "+nome+"! Aqui é da "+loja+" 🐱\nSegue o orçamento da sua encomenda:\n\n"+its+
      (n(v.frete) ? "\n• Frete ("+v.entrega+") — "+brl(v.frete) : "")+"\n\n*Total: "+brl(devido(v))+"*"+
      "\nPrazo: "+diffDays(v.data, v.prazo)+" dias após a confirmação."+(L.pix ? "\n\nPara confirmar, é só fazer o Pix para "+L.pix+" e me mandar o comprovante." : "\n\nPara confirmar, é só me responder por aqui!")+"\n\n"+(L.rodape||"")}];
  }
  const out = [
    {k:"conf", t:"Confirmar pedido", m:"Olá "+nome+"! Aqui é da "+loja+" 🐱\nSeu pedido foi confirmado:\n\n"+saleSummary(v)+"\n\nQualquer dúvida é só chamar!"},
    {k:"pronto", t:"Pedido pronto", m:"Olá "+nome+"! Seu pedido #"+shortId(v.id)+" da "+loja+" está pronto 🎉"+(v.entrega==="Retirada no local" ? "\nJá pode passar para retirar!" : "\nVamos enviar em breve.")+(saldo(v)>0 ? "\n\nFalta pagar "+brl(saldo(v))+(L.pix ? " — Pix: "+L.pix : "")+"." : "")},
    {k:"enviado", t:"Pedido enviado", m:"Olá "+nome+"! Seu pedido #"+shortId(v.id)+" foi enviado por "+v.entrega+" 📦\nAssim que tiver o código de rastreio eu te passo."}
  ];
  if(saldo(v) > 0) out.push({k:"cobrar", t:"Cobrar saldo", m:"Olá "+nome+"! Tudo bem? Passando para lembrar do saldo de "+brl(saldo(v))+" do pedido #"+shortId(v.id)+" ("+(v.descricao||tipo(v.produto).nome)+")."+(L.pix ? "\n\nPix: "+L.pix : "")+"\n\nObrigado! 🐱"});
  if(v.status === "entregue") out.push({k:"aval", t:"Pedir avaliação", m:"Olá "+nome+"! Seu pedido da "+loja+" chegou direitinho? 😊\nSe puder, manda uma foto ou uma avaliação"+(L.insta ? " marcando "+L.insta : "")+" — ajuda muito!"});
  return out;
}

function renderSales(){
  const q = norm($("#q").value), fp = $("#flt-prod").value, fs = $("#flt-status").value, t = todayISO();
  let list = S.vendas.slice();
  const byPrazo = (a,b) => (a.status==="entregue")-(b.status==="entregue") || String(a.prazo).localeCompare(String(b.prazo));
  const byData = (a,b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm));
  list.sort(["abertas","atrasadas"].includes(fs) ? byPrazo : byData);
  list = list.filter(v => {
    if(clientFilter && norm(v.cliente) !== clientFilter) return false;
    if(fp && v.produto !== fp) return false;
    if(fs === "abertas" && (v.status === "entregue" || v.status === "cancelado" || v.status === "orcamento")) return false;
    if(fs === "orcamento" && v.status !== "orcamento") return false;
    if(fs === "atrasadas" && !atrasada(v)) return false;
    if(fs === "receber" && saldo(v) <= 0) return false;
    if(fs === "entregue" && v.status !== "entregue") return false;
    if(fs === "cancelado" && v.status !== "cancelado") return false;
    if(fs !== "cancelado" && fs !== "" && v.status === "cancelado") return false;
    if(fs !== "orcamento" && fs !== "" && v.status === "orcamento") return false;
    if(q){
      const e = v.endereco || {};
      const hay = norm([v.cliente, v.contato, v.descricao, itensTexto(v.itens), v.cep, v.entrega, e.cidade, e.bairro, shortId(v.id), v.obs].join(" "));
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  const cf = $("#client-filter");
  if(clientFilter){
    const c = S.vendas.find(v => norm(v.cliente) === clientFilter);
    cf.hidden = false;
    cf.innerHTML = '<span>Mostrando pedidos de <b>'+esc(c ? c.cliente : "")+'</b></span><span class="sp"><button class="btn sm" id="btn-clear-cf">Ver todos</button></span>';
    $("#btn-clear-cf").onclick = () => { clientFilter = null; renderSales(); };
  } else cf.hidden = true;

  const el = $("#sales-list");
  if(!loaded){ el.innerHTML = '<div class="empty">Carregando vendas…</div>'; $("#sales-more").hidden = true; return; }
  if(!list.length){
    el.innerHTML = '<div class="empty">'+(S.vendas.length ? "Nenhuma venda com esses filtros." : "Nenhuma venda ainda. Toque em “+ Nova venda” para registrar a primeira.")+'</div>';
    $("#sales-more").hidden = true; return;
  }
  const page = list.slice(0, shown);
  el.innerHTML = page.map(v => rowHTML(v, t)).join("");
  $("#sales-more").hidden = list.length <= shown;
  $("#btn-more").textContent = "Mostrar mais ("+(list.length - shown)+")";
}

function rowHTML(v){
  const ds = deliveryState(v), s = saldo(v), t = tipo(v.produto), e = v.endereco || {};
  const open = openRow && openRow.id === v.id ? openRow.kind : null;
  const lu = lucro(v), hasCost = custo(v) > 0;
  let ctl = '<select data-act="status" data-id="'+v.id+'" aria-label="Situação do pedido">'+Object.keys(STATUS).map(k => '<option value="'+k+'"'+(v.status===k?" selected":"")+'>'+STATUS[k]+'</option>').join("")+'</select>';
  if(v.status === "orcamento") ctl += '<button class="btn sm primary" data-act="aprovar" data-id="'+v.id+'">Aprovar</button>';
  if(s > 0) ctl += '<button class="btn sm'+(open==="pag"?" on":"")+'" data-act="pag" data-id="'+v.id+'">+ Pagamento</button>';
  ctl += '<button class="btn sm wa'+(open==="wa"?" on":"")+'" data-act="wa" data-id="'+v.id+'">WhatsApp</button>';
  ctl += '<button class="btn sm ghost'+(open==="det"?" on":"")+'" data-act="det" data-id="'+v.id+'">Detalhes</button>';

  let drawer = "";
  if(open === "pag"){
    drawer = '<form class="inline-form" data-form="pag" data-id="'+v.id+'">'+
      '<div class="field"><label for="pv-'+v.id+'">Valor recebido</label><input id="pv-'+v.id+'" class="mono" type="number" step="0.01" min="0.01" value="'+s.toFixed(2)+'" required></div>'+
      '<div class="field"><label for="pd-'+v.id+'">Data</label><input id="pd-'+v.id+'" type="date" value="'+todayISO()+'" required></div>'+
      '<div class="field"><label for="pf-'+v.id+'">Forma</label><select id="pf-'+v.id+'">'+FORMAS.map(f => '<option>'+f+'</option>').join("")+'</select></div>'+
      '<button class="btn sm primary">Registrar</button><button type="button" class="btn sm ghost" data-act="close">Cancelar</button></form>';
  } else if(open === "wa"){
    const num = phoneBR(v.contato);
    drawer = '<div class="wa-menu">'+waMsgs(v).map(m => '<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waLink(num, m.m))+'">'+m.t+'</a>').join("")+'</div>'+
      (num ? '' : '<span class="hint">Sem número de WhatsApp nesta venda: o WhatsApp vai pedir para você escolher o contato.</span>');
  } else if(open === "det"){
    const ps = pagos(v), legacy = !Array.isArray(v.pagamentos);
    const pList = ps.length ? ps.map((p,i) => '<div class="it"><span>'+fmtDate(p.data)+' · '+esc(p.forma||"—")+'</span><span class="mono">'+brl(p.valor)+(legacy ? '' : ' <button class="btn sm ghost danger" data-act="rmpag" data-id="'+v.id+'" data-i="'+i+'" aria-label="Remover pagamento">✕</button>')+'</span></div>').join("") : '<span class="muted">Nenhum pagamento ainda.</span>';
    const mList = (v.materiais||[]).length ? v.materiais.map(m => '<div class="it"><span>'+esc(m.nome)+'</span><span class="mono">'+fmtQty(m.qtd)+' '+esc(m.unidade)+' · '+brl(m.qtd*m.custoUnit)+'</span></div>').join("") : '<span class="muted">Nenhum material vinculado.</span>';
    const del = confirmDel === v.id
      ? '<span class="confirm">Apagar '+(v.status==="orcamento"?"este orçamento":"esta venda")+'?'+((v.materiais||[]).length && baixado(v) ? ' Os materiais voltam para o estoque.' : '')+' <button class="btn sm danger" data-act="del-yes" data-id="'+v.id+'">Apagar</button><button class="btn sm ghost" data-act="del-no">Não</button></span>'
      : '<button class="btn sm ghost danger" data-act="del" data-id="'+v.id+'">Apagar</button>';
    drawer = '<div class="cols">'+
      '<div><h5>Pagamentos</h5><div class="plist">'+pList+'</div></div>'+
      '<div><h5>Custos e lucro</h5><dl class="kv"><dt>Valor do pedido</dt><dd>'+brl(v.total)+'</dd>'+
        (v.custos ? LINHAS.filter(([k]) => n(v.custos[k]) > 0).map(([k,lb]) => '<dt>'+lb+'</dt><dd>'+brl(v.custos[k])+'</dd>').join("")
                  : '<dt>Materiais</dt><dd>'+brl(v.custoMateriais)+'</dd><dt>Outros custos</dt><dd>'+brl(v.custoExtra)+'</dd>')+
        '<dt><b>Lucro</b></dt><dd><b>'+brl(lu)+'</b>'+(n(v.total)?' ('+pct(lu/n(v.total)*100)+')':'')+'</dd>'+
        (n(v.maoDeObra) ? '<dt>Seu ganho (lucro + pintura)</dt><dd>'+brl(lu + n(v.maoDeObra))+'</dd>' : '')+'</dl></div>'+
      ((v.itens||[]).length ? '<div><h5>Itens</h5><div class="plist">'+v.itens.map(i => '<div class="it"><span>'+(n(i.qtd)>1?n(i.qtd)+'× ':'')+esc(i.nome)+'</span><span class="mono">'+brl(n(i.qtd)*n(i.preco))+'</span></div>').join("")+'</div></div>' : '')+
      '<div><h5>Entrega</h5><dl class="kv"><dt>Tipo</dt><dd>'+esc(v.entrega||"—")+'</dd><dt>Frete</dt><dd>'+brl(v.frete)+'</dd><dt>CEP</dt><dd>'+esc(v.cep||"—")+'</dd><dt>Prazo</dt><dd>'+fmtDate(v.prazo)+'</dd>'+(v.entregueEm?'<dt>Entregue em</dt><dd>'+fmtDate(v.entregueEm)+'</dd>':'')+'</dl>'+
        (e.cidade ? '<div class="hint" style="margin-top:4px">'+esc([e.logradouro, e.bairro, e.cidade+"/"+e.uf].filter(Boolean).join(" · "))+'</div>' : '')+'</div>'+
      '<div><h5>Materiais usados</h5><div class="plist">'+mList+'</div></div>'+
      '</div>'+
      (v.obs ? '<div><h5>Observações</h5><div>'+esc(v.obs)+'</div></div>' : '')+
      '<div class="form-actions" style="justify-content:flex-start"><button class="btn sm" data-act="recibo" data-id="'+v.id+'">Recibo</button><button class="btn sm" data-act="edit" data-id="'+v.id+'">Editar</button><button class="btn sm" data-act="dup" data-id="'+v.id+'">Duplicar</button>'+del+'</div>';
  }
  return '<div class="row'+(v.status==="cancelado"?" cancel":"")+(v.status==="orcamento"?" orc":"")+'" style="'+tvars(t)+'">'+
    '<span class="stripe" style="background:var(--tc)"></span>'+
    '<div class="who"><b>'+esc(v.cliente||"Sem nome")+(v.exemplo?' <span class="pill mute">exemplo</span>':'')+'</b><span>'+esc(v.descricao||t.nome)+(v.contato?' · '+esc(v.contato):'')+'</span></div>'+
    '<div class="meta"><span class="pill type">'+esc(t.nome)+'</span><span>'+esc(v.entrega||"")+(e.cidade?' · '+esc(e.cidade)+'/'+esc(e.uf):(v.cep?' · <span class="mono">'+esc(v.cep)+'</span>':''))+'</span></div>'+
    '<div class="meta"><span class="pill '+ds.cls+'">'+ds.txt+'</span><span>Venda '+fmtShort(v.data)+' · entrega '+fmtShort(v.prazo)+'</span></div>'+
    '<div class="val"><div class="big">'+brl(v.total)+'</div><div class="sub">'+(v.status==="cancelado" ? 'cancelada' : v.status==="orcamento" ? 'orçamento' : s > 0 ? 'falta '+brl(s) : '<span style="color:var(--ok)">pago</span>')+(hasCost && v.status!=="cancelado" ? ' · lucro '+brl(lu)+(n(v.total) ? ' ('+pct(lu/n(v.total)*100)+')' : '') : '')+'</div></div>'+
    '<div class="ctl">'+ctl+'</div>'+
    (drawer ? '<div class="drawer">'+drawer+'</div>' : '')+
  '</div>';
}

$("#sales-list").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if(!b || b.tagName === "SELECT") return;
  const id = b.dataset.id, act = b.dataset.act, v = S.vendas.find(x => x.id === id);
  if(["pag","wa","det"].includes(act)){ openRow = openRow && openRow.id === id && openRow.kind === act ? null : {id, kind:act}; confirmDel = null; renderSales(); if(act==="pag"){ const i = document.getElementById("pv-"+id); i && i.select(); } return; }
  if(act === "close"){ openRow = null; renderSales(); return; }
  if(act === "edit") return editSale(id);
  if(act === "dup") return editSale(id, true);
  if(act === "recibo") return openRecibo(id);
  if(act === "aprovar" && v){
    const hoje = todayISO(), prazo = addDays(hoje, +tipo(v.produto).prazo || 0);
    if(await run(backend.update("vendas", id, {status:"producao", data:hoje, prazo, estoqueBaixado:true}), "Orçamento aprovado · entrega até "+fmtDate(prazo),
      {label:"Confirmar no WhatsApp", fn:() => { $("#flt-status").value = "abertas"; openRow = {id, kind:"wa"}; renderSales(); }})) await aplicarConsumo(baixado(v) ? {} : matsDelta([], v.materiais));
    return;
  }
  if(act === "del"){ confirmDel = id; renderSales(); return; }
  if(act === "del-no"){ confirmDel = null; renderSales(); return; }
  if(act === "del-yes" && v){
    confirmDel = null; openRow = null; if(editingId === id) resetForm();
    const copy = Object.assign({}, v), bx = baixado(v), back = bx ? matsDelta(v.materiais, []) : {};
    delete copy.id;
    if(await run(backend.del("vendas", id), v.status === "orcamento" ? "Orçamento apagado" : "Venda apagada", {label:"Desfazer", fn: async () => {
      if(await run(backend.set("vendas", id, copy), "Restaurado")) await aplicarConsumo(bx ? matsDelta([], copy.materiais) : {});
    }})) await aplicarConsumo(back);
    return;
  }
  if(act === "rmpag" && v){
    const ps = pagos(v).slice(), rm = ps.splice(+b.dataset.i, 1)[0];
    const before = pagos(v);
    await run(backend.update("vendas", id, {pagamentos:ps, entrada: ps[0] ? n(ps[0].valor) : 0}), "Pagamento de "+brl(rm.valor)+" removido",
      {label:"Desfazer", fn:() => run(backend.update("vendas", id, {pagamentos:before, entrada: before[0] ? n(before[0].valor) : 0}), "Pagamento restaurado")});
  }
});
$("#sales-list").addEventListener("change", e => {
  const s = e.target.closest("select[data-act=status]"); if(!s) return;
  const patch = {status:s.value};
  if(s.value === "entregue") patch.entregueEm = todayISO();
  const v = S.vendas.find(x => x.id === s.dataset.id);
  let delta = {};
  if(v && s.value === "orcamento" && baixado(v)){ delta = matsDelta(v.materiais, []); patch.estoqueBaixado = false; }
  else if(v && v.status === "orcamento" && s.value !== "cancelado" && !baixado(v)){ delta = matsDelta([], v.materiais); patch.estoqueBaixado = true; }
  if(Object.keys(delta).length) aplicarConsumo(delta);
  run(backend.update("vendas", s.dataset.id, patch), "Situação: "+STATUS[s.value], v && ["pronto","enviado","entregue"].includes(s.value) ? {label:"Avisar no WhatsApp", fn:() => { openRow = {id:v.id, kind:"wa"}; renderSales(); }} : null);
});
$("#sales-list").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target; if(f.dataset.form !== "pag") return;
  const id = f.dataset.id, v = S.vendas.find(x => x.id === id); if(!v) return;
  const val = r2(f.querySelector("#pv-"+id).value); if(!(val > 0)) return;
  const p = {valor:val, data:f.querySelector("#pd-"+id).value || todayISO(), forma:f.querySelector("#pf-"+id).value};
  const ps = pagos(v).concat([p]);
  openRow = null;
  await run(backend.update("vendas", id, {pagamentos:ps, entrada: n(ps[0].valor), quitado: null}), "Pagamento de "+brl(val)+" registrado"+(r2(devido(v) - recebido({pagamentos:ps})) <= 0 ? " · pedido quitado ✓" : ""));
});
["#q","#flt-prod","#flt-status"].forEach(s => $(s).addEventListener("input", () => { shown = PAGE; renderSales(); }));
$("#btn-more").addEventListener("click", () => { shown += PAGE; renderSales(); });

/* =====================================================================
   Recibo
   ===================================================================== */
function openRecibo(id){
  const v = S.vendas.find(x => x.id === id); if(!v) return;
  const L = cfg().loja, t = tipo(v.produto), e = v.endereco || {};
  const ps = pagos(v);
  $("#recibo").innerHTML =
    '<div class="rh"><img src="icons/logo.png" alt=""><div><h2>'+esc(L.nome||"Gato Printado")+'</h2><small>'+esc([L.whats, L.insta].filter(Boolean).join(" · "))+'</small></div>'+
    '<div style="margin-left:auto;text-align:right"><b>Pedido #'+shortId(v.id)+'</b><small style="display:block;color:#5a4b6a">'+fmtDate(v.data)+'</small></div></div>'+
    '<h3>Cliente</h3><div><b>'+esc(v.cliente)+'</b>'+(v.contato?' · '+esc(v.contato):'')+'</div>'+
    '<h3>'+(v.status === "orcamento" ? "Orçamento" : "Pedido")+'</h3><table>'+
    ((v.itens||[]).length
      ? v.itens.map(i => '<tr><td>'+(n(i.qtd)>1 ? n(i.qtd)+'× ' : '')+esc(i.nome)+(n(i.qtd)>1 ? ' <small style="color:#5a4b6a">('+brl(i.preco)+' cada)</small>' : '')+'</td><td class="r">'+brl(n(i.qtd)*n(i.preco))+'</td></tr>').join("")+
        (Math.abs(sum(v.itens, i => n(i.qtd)*n(i.preco)) - n(v.total)) > 0.009 ? '<tr><td>'+(n(v.total) < sum(v.itens, i => n(i.qtd)*n(i.preco)) ? 'Desconto' : 'Ajuste')+'</td><td class="r">'+brl(n(v.total) - sum(v.itens, i => n(i.qtd)*n(i.preco)))+'</td></tr>' : '')+
        (v.descricao && v.descricao !== itensTexto(v.itens) ? '<tr><td colspan="2"><small style="color:#5a4b6a">'+esc(v.descricao)+'</small></td></tr>' : '')
      : '<tr><td>'+esc(v.descricao || t.nome)+'<br><small style="color:#5a4b6a">'+esc(t.nome)+'</small></td><td class="r">'+brl(v.total)+'</td></tr>')+
    (n(v.frete) ? '<tr><td>Frete ('+esc(v.entrega)+')'+(cfg().freteNoSaldo ? '' : ' — pago à parte')+'</td><td class="r">'+brl(v.frete)+'</td></tr>' : '')+
    '<tr class="tot"><td>Total</td><td class="r">'+brl(devido(v))+'</td></tr></table>'+
    '<h3>Pagamentos</h3><table>'+(ps.length ? ps.map(p => '<tr><td>'+fmtDate(p.data)+' · '+esc(p.forma||"—")+'</td><td class="r">'+brl(p.valor)+'</td></tr>').join("") : '<tr><td>Nenhum pagamento registrado</td><td></td></tr>')+
    '<tr class="tot"><td>'+(saldo(v) > 0 ? 'Falta pagar' : 'Situação')+'</td><td class="r">'+(saldo(v) > 0 ? brl(saldo(v)) : 'Quitado ✓')+'</td></tr></table>'+
    (saldo(v) > 0 && L.pix ? '<div style="margin-top:8px">Pix: <b>'+esc(L.pix)+'</b></div>' : '')+
    '<h3>Entrega</h3><div>'+esc(v.entrega)+' · previsão <b>'+fmtDate(v.prazo)+'</b>'+(v.cep ? '<br>CEP '+esc(v.cep)+(e.cidade ? ' — '+esc([e.logradouro, e.bairro, e.cidade+"/"+e.uf].filter(Boolean).join(", ")) : '') : '')+'</div>'+
    (v.obs ? '<h3>Observações</h3><div>'+esc(v.obs)+'</div>' : '')+
    '<div class="foot">'+esc(L.rodape || "")+'</div>';
  $("#btn-recibo-wa").href = waLink(phoneBR(v.contato), (L.nome||"Gato Printado")+" 🐱\n"+saleSummary(v));
  $("#recibo-wrap").hidden = false;
}
$("#btn-print").addEventListener("click", () => window.print());
$("#btn-recibo-close").addEventListener("click", () => $("#recibo-wrap").hidden = true);

/* =====================================================================
   Painel
   ===================================================================== */
let chartMonths = +lsGet("gp-months", "6") || 6;
function periodRange(p){
  const t = parseISO(todayISO()), Y = t.getFullYear(), M = t.getMonth();
  if(p === "mes") return {a:iso(new Date(Y,M,1)), b:iso(new Date(Y,M+1,0)), label:"Este mês · "+MES[M]+"/"+Y, pa:iso(new Date(Y,M-1,1)), pb:iso(new Date(Y,M,0)), plabel:"mês passado"};
  if(p === "mespassado") return {a:iso(new Date(Y,M-1,1)), b:iso(new Date(Y,M,0)), label:"Mês passado · "+MES[(M+11)%12]+"/"+(M?Y:Y-1), pa:iso(new Date(Y,M-2,1)), pb:iso(new Date(Y,M-1,0)), plabel:"mês anterior"};
  if(p === "90"){ const a = new Date(t); a.setDate(a.getDate()-89); const pb = new Date(a); pb.setDate(pb.getDate()-1); const pa = new Date(pb); pa.setDate(pa.getDate()-89);
    return {a:iso(a), b:iso(t), label:"Últimos 90 dias · "+fmtDate(iso(a))+" a "+fmtDate(iso(t)), pa:iso(pa), pb:iso(pb), plabel:"90 dias anteriores"}; }
  if(p === "ano") return {a:Y+"-01-01", b:Y+"-12-31", label:"Ano de "+Y, pa:(Y-1)+"-01-01", pb:(Y-1)+"-12-31", plabel:String(Y-1)};
  return {a:"0000-01-01", b:"9999-12-31", label:"Todo o período", pa:null, pb:null};
}
const sum = (arr, f) => arr.reduce((a,x) => a + f(x), 0);
function deltaHTML(cur, prev, label){
  if(prev == null || !label) return "";
  if(!prev) return cur ? '<span class="delta up">novo vs '+label+'</span>' : '';
  const d = (cur - prev) / Math.abs(prev) * 100;
  return '<span class="delta '+(d >= 0 ? "up" : "down")+'">'+(d >= 0 ? "▲ " : "▼ ")+Math.abs(Math.round(d))+'% vs '+label+'</span>';
}
function renderDash(){
  const P = periodRange($("#period").value);
  $("#period-label").textContent = P.label;
  const A = S.vendas.filter(ativa);
  const vs = A.filter(v => v.data >= P.a && v.data <= P.b);
  const pv = P.pa ? A.filter(v => v.data >= P.pa && v.data <= P.pb) : null;
  const fat = sum(vs, v => n(v.total)), luc = sum(vs, lucro), cst = sum(vs, custo);
  const pays = []; A.forEach(v => pagos(v).forEach(p => pays.push(Object.assign({venda:v}, p))));
  const recP = pays.filter(p => p.data >= P.a && p.data <= P.b);
  const rec = sum(recP, p => n(p.valor));
  const aRec = sum(A, saldo), nAberto = A.filter(v => saldo(v) > 0).length;
  const late = A.filter(atrasada).length;
  $("#kpis").innerHTML = [
    ["lead","Faturamento", brl(fat), vs.length+" pedido"+(vs.length===1?"":"s")+" · ticket "+brl(vs.length?fat/vs.length:0), deltaHTML(fat, pv && sum(pv, v => n(v.total)), P.plabel)],
    ["","Lucro da empresa", brl(luc), fat ? "margem "+pct(luc/fat*100)+" · custos "+brl(cst)+(sum(vs, v => n(v.maoDeObra)) ? "<br>+ "+brl(sum(vs, v => n(v.maoDeObra)))+" da sua mão de obra" : "") : "cadastre custos nas vendas", deltaHTML(luc, pv && sum(pv, lucro), P.plabel)],
    ["","Recebido no período", brl(rec), recP.length+" pagamento"+(recP.length===1?"":"s")+" (por data do pagamento)", ""],
    ["","A receber", brl(aRec), nAberto+" pedido"+(nAberto===1?"":"s")+" com saldo em aberto", ""],
    ["","Pedidos em aberto", String(A.filter(v => v.status !== "entregue").length), late ? '<span style="color:var(--bad)">'+late+' atrasado'+(late===1?"":"s")+'</span>' : "nenhum atrasado", ""]
  ].map(k => '<div class="kpi '+k[0]+'"><span class="lbl">'+k[1]+'</span><span class="v">'+k[2]+'</span><span class="s">'+k[3]+'</span>'+k[4]+'</div>').join("");

  // por tipo
  const tipos = cfg().tipos.slice();
  S.vendas.forEach(v => { if(!tipos.find(t => t.id === v.produto)) tipos.push(tipo(v.produto)); });
  const T = tipos.filter(t => cfg().tipos.some(x => x.id === t.id) || vs.some(v => v.produto === t.id)).map(t => { const x = vs.filter(v => v.produto === t.id); return {t, n:x.length, fat:sum(x, v => n(v.total)), luc:sum(x, lucro), rec:sum(x, recebido), aRec:sum(x, saldo)}; });
  $("#types").innerHTML = T.map(o => '<div class="type-card" style="'+tvars(o.t)+'"><h4><span>'+esc(o.t.nome)+'</span><span class="muted mono" style="font-weight:400;font-size:13px">'+o.n+' pedido'+(o.n===1?"":"s")+'</span></h4>'+
    '<div class="tv">'+brl(o.fat)+'</div><dl class="kv"><dt>Ticket médio</dt><dd>'+brl(o.n?o.fat/o.n:0)+'</dd><dt>Lucro</dt><dd>'+brl(o.luc)+(o.fat?' ('+pct(o.luc/o.fat*100)+')':'')+'</dd><dt>Recebido</dt><dd>'+brl(o.rec)+'</dd><dt>A receber</dt><dd>'+brl(o.aRec)+'</dd></dl></div>').join("");
  $("#share").innerHTML = fat ? T.filter(o => o.fat).map(o => '<i style="width:'+(o.fat/fat*100)+'%;background:var(--t'+(o.t.cor%6)+')"></i>').join("") : "";
  $("#share-leg").innerHTML = T.map(o => '<span>'+esc(o.t.nome)+' '+pct(fat ? o.fat/fat*100 : 0)+'</span>').join("");

  renderChart(tipos);

  // melhores clientes
  const cm = new Map(); vs.forEach(v => { const k = norm(v.cliente); const c = cm.get(k) || {nome:v.cliente, v:0, n:0}; c.v += n(v.total); c.n++; cm.set(k, c); });
  const top = Array.from(cm.values()).sort((a,b) => b.v - a.v).slice(0,6), mx = top.length ? top[0].v : 1;
  $("#top-clients").innerHTML = top.length ? top.map(c => '<div class="bar-row"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(c.nome)+'">'+esc(c.nome)+'</span><span class="tr"><i style="width:'+(c.v/mx*100)+'%"></i></span><span class="v">'+brl(c.v)+' · '+c.n+'</span></div>').join("") : '<span class="muted">Sem vendas no período.</span>';

  // para onde vai o dinheiro
  const cat = {}; LINHAS.forEach(([k]) => cat[k] = 0);
  vs.forEach(v => { if(v.custos) LINHAS.forEach(([k]) => cat[k] += n(v.custos[k])); else { cat.materiais += n(v.custoMateriais); cat.outros += n(v.custoExtra); } });
  const catL = LINHAS.map(([k,lb]) => [lb, cat[k]]).filter(x => x[1] > 0).sort((a,b) => b[1]-a[1]);
  const cmx = Math.max(luc, ...catL.map(x => x[1]), 0.01);
  $("#cost-cats").innerHTML = fat ? catL.map(([lb,val]) => '<div class="bar-row"><span>'+lb+'</span><span class="tr"><i style="width:'+(val/cmx*100)+'%"></i></span><span class="v">'+brl(val)+' · '+pct(val/fat*100)+'</span></div>').join("")+
    '<div class="bar-row"><span><b>Lucro</b></span><span class="tr"><i style="width:'+(Math.max(0,luc)/cmx*100)+'%;background:var(--ok)"></i></span><span class="v"><b>'+brl(luc)+' · '+pct(luc/fat*100)+'</b></span></div>' : '<span class="muted">Sem vendas no período.</span>';

  // status
  const cnt = k => A.filter(v => v.status === k).length;
  const ent = A.filter(v => v.status === "entregue" && v.entregueEm && v.entregueEm >= P.a && v.entregueEm <= P.b);
  const noPrazo = ent.filter(v => v.entregueEm <= v.prazo).length;
  const orcs = S.vendas.filter(v => v.status === "orcamento");
  $("#status-strip").innerHTML =
    (orcs.length ? '<span class="pill warn">Orçamentos · '+orcs.length+' ('+brl(sum(orcs, v => n(v.total)))+')</span>' : '')+
    '<span class="pill mute">Em produção · '+cnt("producao")+'</span><span class="pill mute">Prontos · '+cnt("pronto")+'</span><span class="pill mute">Enviados · '+cnt("enviado")+'</span>'+
    (late ? '<span class="pill bad">Atrasados · '+late+'</span>' : '<span class="pill ok">Nenhum atraso</span>')+
    (ent.length ? '<span class="pill '+(noPrazo/ent.length >= .9 ? "ok" : "warn")+'">Entregues no prazo · '+pct(noPrazo/ent.length*100)+'</span>' : '');

  const next = A.filter(v => v.status !== "entregue").sort((x,y) => String(x.prazo).localeCompare(String(y.prazo))).slice(0,6);
  $("#next-deliveries").innerHTML = next.length ? next.map(v => { const ds = deliveryState(v); return '<div class="it"><div><b>'+esc(v.cliente)+'</b><span class="s">'+esc(tipo(v.produto).nome)+' · '+esc(STATUS[v.status]||"")+' · '+fmtDate(v.prazo)+'</span></div><span class="pill '+ds.cls+'">'+ds.txt+'</span></div>'; }).join("") : '<div class="muted" style="padding:8px 0">Nenhuma entrega pendente.</div>';
  const recv = A.filter(v => saldo(v) > 0).sort((x,y) => saldo(y) - saldo(x)).slice(0,6);
  $("#receivables").innerHTML = recv.length ? recv.map(v => '<div class="it"><div><b>'+esc(v.cliente)+'</b><span class="s">'+esc(tipo(v.produto).nome)+' · venda '+fmtDate(v.data)+'</span></div><span class="mono">'+brl(saldo(v))+'</span></div>').join("") : '<div class="muted" style="padding:8px 0">Nenhum saldo em aberto.</div>';

  const fm = {}; recP.forEach(p => { const k = p.forma && p.forma !== "—" ? p.forma : "Não informado"; fm[k] = (fm[k]||0) + n(p.valor); });
  const fl = Object.entries(fm).sort((a,b) => b[1]-a[1]), fx = fl.length ? fl[0][1] : 1;
  $("#pay-forms").innerHTML = fl.length ? fl.map(([k,val]) => '<div class="bar-row"><span>'+esc(k)+'</span><span class="tr"><i style="width:'+(val/fx*100)+'%"></i></span><span class="v">'+brl(val)+'</span></div>').join("") : '<span class="muted">Nenhum pagamento no período.</span>';
}
function niceMax(v){ if(v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v/p; return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p; }
const kfmt = v => Math.abs(v) >= 1000 ? (v/1000).toLocaleString("pt-BR",{maximumFractionDigits:1})+"k" : String(Math.round(v));
function renderChart(tipos){
  $$("[data-months]").forEach(b => b.classList.toggle("on", +b.dataset.months === chartMonths));
  const t = parseISO(todayISO()), months = [];
  for(let i = chartMonths-1; i >= 0; i--){ const d = new Date(t.getFullYear(), t.getMonth()-i, 1); months.push({y:d.getFullYear(), m:d.getMonth(), k:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"), by:{}, tot:0, luc:0}); }
  S.vendas.filter(ativa).forEach(v => { const mo = months.find(x => String(v.data).startsWith(x.k)); if(mo){ mo.by[v.produto] = (mo.by[v.produto]||0) + n(v.total); mo.tot += n(v.total); mo.luc += lucro(v); } });
  const anyCost = S.vendas.some(v => custo(v) > 0);
  const W = 640, H = 270, L = 58, R = 12, Tp = 18, B = 34, max = niceMax(Math.max(...months.map(x => x.tot), ...months.map(x => x.luc)));
  const ih = H-Tp-B, iw = W-L-R, bw = iw/months.length, barW = Math.min(46, bw*.58), y = v => Tp + ih - Math.max(0, v)/max*ih;
  let g = "";
  for(let i = 0; i <= 4; i++){ const v = max*i/4, yy = y(v);
    g += '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--line)"'+(i?' stroke-dasharray="3 4"':'')+'/>';
    g += '<text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="var(--ink-3)" font-family="IBM Plex Mono,monospace">'+kfmt(v)+'</text>'; }
  const pts = [];
  months.forEach((mo,i) => {
    const cx = L + bw*i + bw/2, x = cx - barW/2; let acc = 0;
    tipos.forEach(tp => { const val = mo.by[tp.id]||0; if(!val) return; const y0 = y(acc), y1 = y(acc+val);
      g += '<rect x="'+x+'" y="'+y1+'" width="'+barW+'" height="'+Math.max(0, y0-y1-1)+'" fill="var(--t'+(tp.cor%6)+')" rx="2"><title>'+esc(tp.nome)+' '+brl(val)+'</title></rect>'; acc += val; });
    if(mo.tot > 0) g += '<text x="'+cx+'" y="'+(y(mo.tot)-6)+'" text-anchor="middle" font-size="10.5" fill="var(--ink-2)" font-family="IBM Plex Mono,monospace">'+kfmt(mo.tot)+'</text>';
    g += '<text x="'+cx+'" y="'+(H-12)+'" text-anchor="middle" font-size="'+(chartMonths>6?11:12)+'" fill="'+(i===months.length-1?"var(--ink)":"var(--ink-3)")+'" font-weight="'+(i===months.length-1?600:400)+'">'+MES[mo.m]+(chartMonths>6?'':'/'+String(mo.y).slice(2))+'</text>';
    pts.push([cx, y(mo.luc), mo]);
  });
  if(anyCost){
    g += '<polyline fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" points="'+pts.map(p => p[0]+","+p[1]).join(" ")+'"/>';
    pts.forEach(p => g += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3.5" fill="var(--surface)" stroke="'+(p[2].luc<0?"var(--bad)":"var(--ink)")+'" stroke-width="2"><title>Lucro '+brl(p[2].luc)+'</title></circle>');
  }
  $("#chart").innerHTML = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Faturamento mensal por tipo de produto">'+g+'</svg>';
  $("#chart-legend").innerHTML = tipos.map(tp => '<span><i style="background:var(--t'+(tp.cor%6)+')"></i>'+esc(tp.nome)+'</span>').join("") + (anyCost ? '<span><i class="line" style="background:var(--ink)"></i>Lucro</span>' : '');
}
$("#period").addEventListener("change", renderDash);
$$("[data-months]").forEach(b => b.addEventListener("click", () => { chartMonths = +b.dataset.months; lsSet("gp-months", String(chartMonths)); renderDash(); }));

/* =====================================================================
   Clientes
   ===================================================================== */
function renderClients(){
  const m = new Map();
  S.vendas.slice().sort((a,b) => String(a.data).localeCompare(String(b.data))).forEach(v => {
    const k = norm(v.cliente); if(!k) return;
    const c = m.get(k) || {k, nome:v.cliente, contato:"", pedidos:0, total:0, saldo:0, ultima:"", cidade:"", tipos:new Set(), exemplo:false};
    c.nome = v.cliente; if(v.contato) c.contato = v.contato; if(v.endereco && v.endereco.cidade) c.cidade = v.endereco.cidade+"/"+v.endereco.uf;
    if(ativa(v)){ c.pedidos++; c.total += n(v.total); c.saldo += saldo(v); c.tipos.add(tipo(v.produto).nome); }
    if(v.data > c.ultima) c.ultima = v.data; if(v.exemplo) c.exemplo = true;
    m.set(k, c);
  });
  const q = norm($("#cl-q").value), so = $("#cl-sort").value;
  let list = Array.from(m.values()).filter(c => !q || norm(c.nome+" "+c.contato+" "+c.cidade).includes(q));
  if(so === "valor") list.sort((a,b) => b.total - a.total);
  if(so === "recente") list.sort((a,b) => b.ultima.localeCompare(a.ultima));
  if(so === "saldo") list = list.filter(c => c.saldo > 0).sort((a,b) => b.saldo - a.saldo);
  if(so === "nome") list.sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const el = $("#clients");
  if(!list.length){ el.innerHTML = '<div class="empty" style="grid-column:1/-1">'+(m.size ? "Nenhum cliente com esse filtro." : "Os clientes aparecem aqui assim que você registrar vendas.")+'</div>'; return; }
  el.innerHTML = list.map(c => {
    const num = phoneBR(c.contato), dias = c.ultima ? diffDays(c.ultima, todayISO()) : 0;
    return '<div class="client"><div class="ch"><div><b>'+esc(c.nome)+(c.exemplo?' <span class="pill mute">exemplo</span>':'')+'</b><span class="s">'+esc([c.contato, c.cidade].filter(Boolean).join(" · ") || "sem contato")+'</span></div>'+
      (c.saldo > 0 ? '<span class="pill warn">deve '+brl(c.saldo)+'</span>' : '')+'</div>'+
      '<dl class="kv"><dt>Pedidos</dt><dd>'+c.pedidos+'</dd><dt>Total comprado</dt><dd>'+brl(c.total)+'</dd><dt>Ticket médio</dt><dd>'+brl(c.pedidos ? c.total/c.pedidos : 0)+'</dd><dt>Última compra</dt><dd>'+fmtDate(c.ultima)+(dias > 0 ? ' ('+dias+'d)' : '')+'</dd></dl>'+
      '<span class="hint">'+esc(Array.from(c.tipos).join(", "))+'</span>'+
      '<div class="ctl"><button class="btn sm" data-cl="ver" data-k="'+esc(c.k)+'">Ver pedidos</button><button class="btn sm" data-cl="nova" data-k="'+esc(c.k)+'">Nova venda</button>'+
      (num ? '<a class="btn sm wa" target="_blank" rel="noopener" href="'+esc(waLink(num, "Olá "+c.nome.replace(/^Exemplo · /,"").split(" ")[0]+"! Aqui é da "+(cfg().loja.nome||"Gato Printado")+" 🐱"))+'">WhatsApp</a>' : '')+'</div></div>';
  }).join("");
}
$("#clients").addEventListener("click", e => {
  const b = e.target.closest("[data-cl]"); if(!b) return;
  const k = b.dataset.k;
  if(b.dataset.cl === "ver"){ clientFilter = k; $("#flt-status").value = ""; shown = PAGE; showView("vendas"); renderSales(); }
  if(b.dataset.cl === "nova"){
    const c = clientIndex().get(k); showView("vendas"); resetForm(); openForm(true);
    if(c){ F.cliente.value = c.nome; F.contato.value = c.contato; if(c.cep){ F.cep.value = c.cep; formAddr = c.endereco; showAddr(); } }
    F.desc.focus();
  }
});
["#cl-q","#cl-sort"].forEach(s => $(s).addEventListener("input", renderClients));

/* =====================================================================
   Estoque
   ===================================================================== */
let openForm2 = null, confirmItemDel = null;
function itemAlerts(it){
  const t = todayISO(), out = [];
  if(it.minimo !== "" && it.minimo != null && n(it.qtd) <= n(it.minimo)) out.push({cls:"bad", txt: n(it.qtd) <= 0 ? "Sem estoque" : "Estoque baixo"});
  if(it.lembrete){ const d = diffDays(t, it.lembrete); if(d <= 0) out.push({cls:"bad", txt:"Lembrete: comprar"}); else if(d <= 3) out.push({cls:"warn", txt:"Comprar em "+d+"d"}); }
  return out;
}
function renderStock(){
  const items = S.insumos.slice().sort((a,b) => itemAlerts(b).length - itemAlerts(a).length || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const toBuy = items.filter(it => itemAlerts(it).some(a => a.cls === "bad"));
  const valor = sum(items, it => n(it.qtd) * custoUnit(it));
  const t = parseISO(todayISO()), mk = t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0");
  const gastoMes = sum(S.compras.filter(c => String(c.data).startsWith(mk)), c => n(c.valor));
  $("#stock-kpis").innerHTML =
    '<div class="kpi"><span class="lbl">Valor em estoque</span><span class="v">'+brl(valor)+'</span><span class="s">pelo preço da última compra</span></div>'+
    '<div class="kpi"><span class="lbl">Para comprar</span><span class="v">'+toBuy.length+'</span><span class="s">'+(toBuy.length ? esc(toBuy.slice(0,3).map(i => i.nome).join(", "))+(toBuy.length>3?"…":"") : "tudo em dia")+'</span></div>'+
    '<div class="kpi"><span class="lbl">Compras este mês</span><span class="v">'+brl(gastoMes)+'</span><span class="s">'+S.compras.filter(c => String(c.data).startsWith(mk)).length+' compra(s)</span></div>';
  const al = []; items.forEach(it => itemAlerts(it).forEach(a => al.push({it, a})));
  $("#alerts").innerHTML = al.map(({it,a}) => '<div class="alert '+a.cls+'"><span class="pill '+a.cls+'">'+a.txt+'</span><span><b>'+esc(it.nome)+'</b> — '+fmtQty(it.qtd)+' '+esc(it.unidade)+' em estoque'+(it.minimo!==""&&it.minimo!=null?' (mínimo '+fmtQty(it.minimo)+')':'')+(it.lembrete?' · lembrete '+fmtDate(it.lembrete):'')+'</span><button class="btn sm sp" data-act="comprar" data-id="'+it.id+'">Registrar compra</button></div>').join("");
  const sl = $("#btn-shoplist");
  if(toBuy.length){ sl.hidden = false; sl.href = waLink("", "🛒 Lista de compras — "+(cfg().loja.nome||"Gato Printado")+"\n\n"+toBuy.map(it => "• "+it.nome+" (tenho "+fmtQty(it.qtd)+" "+it.unidade+(it.fornecedor?" · "+it.fornecedor:"")+")").join("\n")); }
  else sl.hidden = true;

  const el = $("#stock");
  if(!loaded){ el.innerHTML = '<div class="empty">Carregando estoque…</div>'; return; }
  if(!items.length){ el.innerHTML = '<div class="empty" style="grid-column:1/-1">Nenhum insumo cadastrado. Use “+ Novo insumo”.</div>'; }
  else el.innerHTML = items.map(it => {
    const alerts = itemAlerts(it), low = alerts.some(a => a.cls === "bad");
    const min = n(it.minimo), q = n(it.qtd), scale = Math.max(q, min*2.5, 1), cu = custoUnit(it);
    const used = S.vendas.filter(v => ativa(v) && diffDays(v.data, todayISO()) <= 30).reduce((a,v) => a + sum((v.materiais||[]).filter(m => m.insumoId === it.id), m => n(m.qtd)), 0);
    let form = "";
    if(openForm2 && openForm2.id === it.id && openForm2.kind === "usar"){
      form = '<form class="inline-form" data-form="usar" data-id="'+it.id+'"><div class="field"><label for="u-'+it.id+'">Quantidade usada ('+esc(it.unidade)+')</label><input id="u-'+it.id+'" type="number" step="0.001" min="0.001" required></div><button class="btn sm primary">Dar baixa</button><button type="button" class="btn sm ghost" data-act="close">Cancelar</button></form>';
    } else if(openForm2 && openForm2.id === it.id && openForm2.kind === "comprar"){
      form = '<form class="inline-form" data-form="comprar" data-id="'+it.id+'">'+
        '<div class="field"><label for="cq-'+it.id+'">Qtd. ('+esc(it.unidade)+')</label><input id="cq-'+it.id+'" type="number" step="0.001" min="0.001" required></div>'+
        '<div class="field"><label for="cv-'+it.id+'">Valor pago R$</label><input id="cv-'+it.id+'" type="number" step="0.01" min="0" required></div>'+
        '<div class="field"><label for="cd-'+it.id+'">Data</label><input id="cd-'+it.id+'" type="date" value="'+todayISO()+'" required></div>'+
        '<div class="field"><label for="cl-'+it.id+'">Próximo lembrete</label><input id="cl-'+it.id+'" type="date"></div>'+
        '<button class="btn sm primary">Registrar</button><button type="button" class="btn sm ghost" data-act="close">Cancelar</button></form>';
    }
    const ctl = confirmItemDel === it.id
      ? '<span class="confirm">Apagar insumo? <button class="btn sm danger" data-act="idel-yes" data-id="'+it.id+'">Apagar</button><button class="btn sm ghost" data-act="idel-no">Não</button></span>'
      : '<button class="btn sm" data-act="usar" data-id="'+it.id+'">− Usar</button><button class="btn sm" data-act="comprar" data-id="'+it.id+'">+ Compra</button><button class="btn sm ghost" data-act="iedit" data-id="'+it.id+'">Editar</button><button class="btn sm ghost danger" data-act="idel" data-id="'+it.id+'" aria-label="Apagar insumo">✕</button>';
    return '<div class="item'+(low?" low":"")+'">'+
      '<div class="ih"><div><b>'+esc(it.nome)+(it.exemplo?' <span class="pill mute">exemplo</span>':'')+'</b><span class="s">'+esc(it.categoria||"")+(it.fornecedor?' · '+esc(it.fornecedor):'')+'</span></div>'+(alerts[0]?'<span class="pill '+alerts[0].cls+'">'+alerts[0].txt+'</span>':'<span class="pill ok">OK</span>')+'</div>'+
      '<div class="qty"><span class="q">'+fmtQty(q)+' <small class="muted" style="font-size:13px">'+esc(it.unidade)+'</small></span><span class="m">'+(it.minimo!==""&&it.minimo!=null?'mín. '+fmtQty(min):'sem mínimo')+'</span></div>'+
      '<div class="gauge"><i style="width:'+Math.min(100, q/scale*100)+'%;background:var('+(low?"--bad":q<=min*1.5?"--warn":"--ok")+')"></i>'+(min?'<span class="min" style="left:'+Math.min(100, min/scale*100)+'%"></span>':'')+'</div>'+
      '<dl class="kv"><dt>Última compra</dt><dd>'+(it.preco?brl(it.preco)+(it.qtdCompra?' / '+fmtQty(it.qtdCompra)+' '+esc(it.unidade):''):'—')+'</dd>'+
      '<dt>Custo por '+esc(it.unidade)+'</dt><dd>'+(cu?brl(cu):'—')+'</dd>'+
      '<dt>Usado em vendas (30d)</dt><dd>'+(used ? fmtQty(used)+' '+esc(it.unidade) : '—')+'</dd>'+
      '<dt>Lembrete</dt><dd>'+(it.lembrete?fmtDate(it.lembrete):'—')+'</dd></dl>'+
      form+'<div class="ctl">'+ctl+'</div></div>';
  }).join("");
  const ps = S.compras.slice().sort((a,b) => String(b.data).localeCompare(String(a.data))).slice(0,10);
  $("#purchases").innerHTML = ps.length ? ps.map(c => '<div class="it"><div><b>'+esc(c.nome)+'</b><span class="s">'+fmtDate(c.data)+' · '+fmtQty(c.qtd)+' '+esc(c.unidade||"")+(n(c.qtd)?' · '+brl(n(c.valor)/n(c.qtd))+'/'+esc(c.unidade||"un"):'')+'</span></div><span class="mono">'+brl(c.valor)+'</span></div>').join("") : '<div class="muted" style="padding:8px 0">Nenhuma compra registrada.</div>';
}
function stockClick(e){
  const b = e.target.closest("button[data-act]"); if(!b) return;
  const id = b.dataset.id, act = b.dataset.act;
  if(act === "usar" || act === "comprar"){ openForm2 = {id, kind:act}; showView("estoque"); renderStock(); const f = document.querySelector('form[data-id="'+id+'"]'); if(f){ f.scrollIntoView({behavior:"smooth", block:"center"}); const i = f.querySelector("input"); i && i.focus({preventScroll:true}); } }
  else if(act === "close"){ openForm2 = null; renderStock(); }
  else if(act === "iedit") openItemModal(id);
  else if(act === "idel"){ confirmItemDel = id; renderStock(); }
  else if(act === "idel-no"){ confirmItemDel = null; renderStock(); }
  else if(act === "idel-yes"){ confirmItemDel = null; const it = S.insumos.find(x => x.id === id); const copy = Object.assign({}, it);
    run(backend.del("insumos", id), "Insumo apagado", {label:"Desfazer", fn:() => run(backend.set("insumos", id, copy), "Insumo restaurado")}); }
}
$("#stock").addEventListener("click", stockClick);
$("#alerts").addEventListener("click", stockClick);
$("#stock").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, id = f.dataset.id, it = S.insumos.find(x => x.id === id); if(!it) return;
  if(f.dataset.form === "usar"){
    const u = n(f.querySelector("input").value); if(u <= 0) return;
    const nq = Math.max(0, r3(n(it.qtd) - u)); openForm2 = null;
    await run(backend.update("insumos", id, {qtd:nq}), "Baixa de "+fmtQty(u)+" "+it.unidade+" · restam "+fmtQty(nq));
  } else {
    const q = n(f.querySelector("#cq-"+id).value), v = n(f.querySelector("#cv-"+id).value), d = f.querySelector("#cd-"+id).value || todayISO(), l = f.querySelector("#cl-"+id).value;
    if(q <= 0) return; openForm2 = null;
    const patch = {qtd:r3(n(it.qtd)+q), preco:v, qtdCompra:q, ultimaCompra:d, lembrete:l || ""};
    await run(backend.update("insumos", id, patch));
    await run(backend.add("compras", {insumoId:id, nome:it.nome, unidade:it.unidade, qtd:q, valor:v, data:d}), "Compra registrada · estoque "+fmtQty(patch.qtd)+" "+it.unidade);
  }
});

let editingItem = null;
const I = {nome:$("#i-nome"), cat:$("#i-cat"), un:$("#i-un"), qtd:$("#i-qtd"), min:$("#i-min"), preco:$("#i-preco"), qc:$("#i-qc"), forn:$("#i-forn"), lemb:$("#i-lemb")};
function openItemModal(id){
  editingItem = id || null;
  const it = id ? S.insumos.find(x => x.id === id) : null;
  $("#item-form").reset();
  $("#item-modal-title").textContent = it ? "Editar insumo" : "Novo insumo";
  if(it){ I.nome.value = it.nome||""; I.cat.value = it.categoria||"Outro"; I.un.value = it.unidade||"un"; I.qtd.value = it.qtd ?? ""; I.min.value = it.minimo ?? ""; I.preco.value = it.preco||""; I.qc.value = it.qtdCompra||""; I.forn.value = it.fornecedor||""; I.lemb.value = it.lembrete||""; }
  $("#item-modal").hidden = false; I.nome.focus();
}
function closeItemModal(){ $("#item-modal").hidden = true; editingItem = null; }
$("#btn-new-item").addEventListener("click", () => openItemModal());
$("#item-modal").addEventListener("click", e => { if(e.target.id === "item-modal" || e.target.closest("[data-close]")) closeItemModal(); });
document.addEventListener("keydown", e => { if(e.key === "Escape"){ if(!$("#item-modal").hidden) closeItemModal(); if(!$("#recibo-wrap").hidden) $("#recibo-wrap").hidden = true; } });
$("#item-form").addEventListener("submit", async e => {
  e.preventDefault();
  const prev = editingItem ? (S.insumos.find(x => x.id === editingItem) || {}) : {};
  const doc = Object.assign({}, prev, {
    nome:I.nome.value.trim(), categoria:I.cat.value, unidade:I.un.value, qtd:r3(I.qtd.value),
    minimo: I.min.value === "" ? "" : r3(I.min.value), preco:r2(I.preco.value), qtdCompra:r3(I.qc.value),
    fornecedor:I.forn.value.trim(), lembrete:I.lemb.value || "", ultimaCompra: prev.ultimaCompra || (n(I.preco.value) ? todayISO() : "")
  });
  delete doc.id;
  const id = editingItem; closeItemModal();
  if(id) await run(backend.set("insumos", id, doc), "Insumo atualizado");
  else await run(backend.add("insumos", doc), "Insumo cadastrado");
});

/* =====================================================================
   Ajustes
   ===================================================================== */
let typesDraft = null, cfgSeen = "";
function renderSettings(force){
  const c = cfg(), sig = JSON.stringify(c);
  if(force || sig !== cfgSeen){
    cfgSeen = sig;
    $("#s-nome").value = c.loja.nome || ""; $("#s-whats").value = c.loja.whats || ""; $("#s-pix").value = c.loja.pix || "";
    $("#s-insta").value = c.loja.insta || ""; $("#s-rodape").value = c.loja.rodape || "";
    $("#s-frete").checked = c.freteNoSaldo;
    typesDraft = JSON.parse(JSON.stringify(c.tipos));
    renderTypesEdit();
    catDraft = JSON.parse(JSON.stringify(c.catalogo));
    fillCustos(c.custos);
    renderCatEdit();
  }
  const rs = $("#s-resina-ins");
  if(document.activeElement !== rs){ const keep = rs.value || cfg().custos.resinaInsumoId; rs.innerHTML = resinaOptions(keep); rs.value = keep; }
  const u = backend && backend.user;
  $("#acc-info").innerHTML = backend && backend.cloud ? 'Conectado como <b>'+esc(u.email || u.nome || "")+'</b>. Seus dados sincronizam em todos os aparelhos em que você entrar com esta conta.'
    : backend && backend.local ? 'Os dados estão salvos só neste aparelho.' : 'Dados salvos no Claude.';
  $("#btn-logout").hidden = !(backend && backend.cloud);
}
function renderTypesEdit(){
  const used = new Set(S.vendas.map(v => v.produto));
  $("#types-edit").innerHTML = typesDraft.map((t,i) =>
    '<div class="type-edit" data-i="'+i+'" style="'+tvars(t)+'">'+
    '<button type="button" class="swatch" data-sw="'+i+'" aria-label="Trocar cor de '+esc(t.nome)+'"></button>'+
    '<input class="inp" data-k="nome" value="'+esc(t.nome)+'" aria-label="Nome do tipo" placeholder="Nome">'+
    '<input class="inp mono" data-k="prazo" type="number" min="0" step="1" value="'+(+t.prazo||0)+'" aria-label="Prazo em dias" title="Prazo em dias">'+
    (used.has(t.id) || typesDraft.length === 1 ? '<span class="hint" title="Tipo usado em vendas">em uso</span>' : '<button type="button" class="btn sm ghost danger" data-rmt="'+i+'" aria-label="Remover tipo">✕</button>')+
    '</div>').join("") + '<span class="hint">Nome · prazo em dias. Toque na bolinha para trocar a cor.</span>';
}
$("#types-edit").addEventListener("input", e => { const r = e.target.closest(".type-edit"); if(!r) return; const t = typesDraft[+r.dataset.i]; if(e.target.dataset.k === "nome") t.nome = e.target.value; if(e.target.dataset.k === "prazo") t.prazo = Math.max(0, Math.round(n(e.target.value))); });
$("#types-edit").addEventListener("click", e => {
  const sw = e.target.closest("[data-sw]"); if(sw){ const t = typesDraft[+sw.dataset.sw]; t.cor = ((+t.cor||0) + 1) % 6; renderTypesEdit(); return; }
  const rm = e.target.closest("[data-rmt]"); if(rm){ typesDraft.splice(+rm.dataset.rmt, 1); renderTypesEdit(); }
});
$("#btn-add-type").addEventListener("click", () => {
  const usedC = new Set(typesDraft.map(t => t.cor)); let cor = 0; while(usedC.has(cor) && cor < 5) cor++;
  typesDraft.push({id:"t"+Date.now().toString(36), nome:"", prazo:7, cor});
  renderTypesEdit(); const ins = $$("#types-edit input[data-k=nome]"); ins[ins.length-1].focus();
});
async function saveConfig(patch, msg){
  const cur = S.config.find(d => d.id === "geral") || {};
  const doc = Object.assign({}, cur, patch); delete doc.id;
  return run(backend.set("config", "geral", doc), msg);
}
$("#btn-save-types").addEventListener("click", async () => {
  const clean = typesDraft.map(t => ({id:t.id, nome:String(t.nome||"").trim(), prazo:Math.max(0, Math.round(n(t.prazo))), cor:(+t.cor||0)%6}));
  if(clean.some(t => !t.nome)){ toast("Dê um nome para cada tipo de produto."); return; }
  await saveConfig({tipos:clean}, "Tipos de produto salvos");
});
$("#form-loja").addEventListener("submit", async e => {
  e.preventDefault();
  await saveConfig({freteNoSaldo:$("#s-frete").checked, loja:{nome:$("#s-nome").value.trim(), whats:$("#s-whats").value.trim(), pix:$("#s-pix").value.trim(), insta:$("#s-insta").value.trim(), rodape:$("#s-rodape").value.trim()}}, "Dados da loja salvos");
});

/* ---------- tabela de preços ---------- */
let catDraft = null;
const CK = {resinaKg:"s-resina-kg", perda:"s-perda", watts:"s-watts", tarifa:"s-tarifa", impressoraValor:"s-imp-valor", vidaUtilH:"s-vida", manutHora:"s-manut",
  valorHora:"s-hora", embalagem:"s-emb", das:"s-das", impostoPct:"s-imp-pct", pedidosMes:"s-pedidos", fixosMes:"s-fixos", margemAlvo:"s-margem"};
function resinaOptions(sel){
  const ok = S.insumos.filter(it => G_PER[it.unidade]).sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return '<option value="">Não vincular: usar o preço por kg abaixo</option>' + ok.map(it => '<option value="'+esc(it.id)+'"'+(it.id===sel?" selected":"")+'>'+esc(it.nome)+' ('+esc(it.unidade)+(custoUnit(it) ? ' · '+brl(custoUnit(it))+'/'+esc(it.unidade) : ' · sem preço')+')</option>').join("");
}
function fillCustos(C){
  Object.keys(CK).forEach(k => { $("#"+CK[k]).value = C[k] ?? ""; });
  $("#s-imp-modo").value = C.impostoModo === "pct" ? "pct" : "das";
  $("#s-resina-ins").innerHTML = resinaOptions(C.resinaInsumoId);
  custosModoUI(); custosInfo();
}
function readCustos(){
  const C = {}; Object.keys(CK).forEach(k => C[k] = r2($("#"+CK[k]).value));
  C.impostoModo = $("#s-imp-modo").value; C.resinaInsumoId = $("#s-resina-ins").value;
  C.pedidosMes = Math.max(1, Math.round(C.pedidosMes || 1));
  return C;
}
function custosModoUI(){ const pctM = $("#s-imp-modo").value === "pct"; $("#w-das").hidden = pctM; $("#w-imp-pct").hidden = !pctM; }
function custosInfo(){
  const C = readCustos(), R = resinaInfo(C), pm = Math.max(1, n(C.pedidosMes));
  const hEn = n(C.watts)/1000*n(C.tarifa), hEq = (n(C.vidaUtilH) > 0 ? n(C.impressoraValor)/n(C.vidaUtilH) : 0) + n(C.manutHora);
  $("#custos-info").innerHTML =
    '<span>Resina por grama'+(R.it ? ' (estoque)' : '')+'</span><b>'+brl(R.precoG)+'</b>'+
    '<span>Hora de impressão (energia '+brl(hEn)+' + desgaste '+brl(hEq)+')</span><b>'+brl(hEn+hEq)+'</b>'+
    '<span>Hora de pintura</span><b>'+brl(C.valorHora)+'</b>'+
    (C.impostoModo === "pct" ? '<span>Imposto</span><b>'+pct(C.impostoPct)+' da venda</b>' : '<span>Imposto por encomenda (DAS ÷ '+pm+')</span><b>'+brl(n(C.das)/pm)+'</b>')+
    (n(C.fixosMes) ? '<span>Fixos por encomenda</span><b>'+brl(n(C.fixosMes)/pm)+'</b>' : '');
  renderCatResults();
}
$("#form-custos").addEventListener("input", () => { custosModoUI(); custosInfo(); });
$("#form-custos").addEventListener("change", () => { custosModoUI(); custosInfo(); });
$("#form-custos").addEventListener("submit", async e => { e.preventDefault(); await saveConfig({custos:readCustos()}, "Custos de produção salvos"); });

// custo de produção do item (sem embalagem, imposto e fixos, que são cobrados uma vez por encomenda)
function catResult(c, C){
  const Ci = Object.assign({}, C, {das:0, fixosMes:0, impostoPct:C.impostoModo === "pct" ? C.impostoPct : 0});
  return calcular({resinaG:c.resinaG, horasImp:c.horasImp, horasPint:c.horasPint, embalagem:0, taxaPct:0, outros:[], matsCusto:0}, n(c.preco), Ci);
}
function renderCatEdit(){
  $("#cat-edit").innerHTML = catDraft.map((c,i) =>
    '<div class="cat-row" data-i="'+i+'">'+
    '<label class="cell nmc"><span>Item</span><input class="inp" data-k="nome" value="'+esc(c.nome)+'" placeholder="Nome do item" aria-label="Nome do item"></label>'+
    '<label class="cell"><span>Preço</span><div class="money"><span>R$</span><input class="inp" data-k="preco" type="number" min="0" step="1" value="'+esc(c.preco)+'" aria-label="Preço"></div></label>'+
    '<label class="cell"><span>Resina (g)</span><input class="inp mono" data-k="resinaG" type="number" min="0" step="1" value="'+esc(c.resinaG)+'" aria-label="Resina em gramas"></label>'+
    '<label class="cell"><span>Impressão (h)</span><input class="inp mono" data-k="horasImp" type="number" min="0" step="0.25" value="'+esc(c.horasImp)+'" aria-label="Horas de impressão"></label>'+
    '<label class="cell"><span>Pintura (h)</span><input class="inp mono" data-k="horasPint" type="number" min="0" step="0.25" value="'+esc(c.horasPint)+'" aria-label="Horas de pintura"></label>'+
    '<span class="res" data-res="'+i+'"></span>'+
    '<button type="button" class="btn sm ghost danger" data-rmc="'+i+'" aria-label="Remover item">✕</button></div>').join("") ||
    '<span class="hint">Nenhum item. Use “+ Item”.</span>';
  renderCatResults();
}
function renderCatResults(){
  if(!catDraft) return;
  const C = readCustos();
  catDraft.forEach((c,i) => {
    const el = document.querySelector('[data-res="'+i+'"]'); if(!el) return;
    const r = catResult(c, C), mg = n(c.preco) ? r.lucro/n(c.preco)*100 : 0;
    el.innerHTML = 'custo '+brl(r.custoTotal)+'<br><b style="color:var('+(r.lucro<0?'--bad':mg<20?'--warn':'--ok')+')">'+brl(r.lucro)+' ('+pct(mg)+')</b>';
  });
}
$("#cat-edit").addEventListener("input", e => {
  const r = e.target.closest(".cat-row"); if(!r) return;
  const c = catDraft[+r.dataset.i], k = e.target.dataset.k;
  c[k] = k === "nome" ? e.target.value : n(e.target.value);
  renderCatResults();
});
$("#cat-edit").addEventListener("click", e => { const b = e.target.closest("[data-rmc]"); if(!b) return; catDraft.splice(+b.dataset.rmc, 1); renderCatEdit(); });
$("#btn-add-cat").addEventListener("click", () => {
  catDraft.push({id:"c"+Date.now().toString(36), nome:"", preco:0, resinaG:0, horasImp:0, horasPint:0, tipo:"3d"});
  renderCatEdit(); const ins = $$("#cat-edit input[data-k=nome]"); ins[ins.length-1].focus();
});
$("#btn-save-cat").addEventListener("click", async () => {
  const clean = catDraft.map(c => ({id:c.id, nome:String(c.nome||"").trim(), preco:r2(c.preco), resinaG:r2(c.resinaG), horasImp:r2(c.horasImp), horasPint:r2(c.horasPint), tipo:c.tipo || "3d"}));
  if(clean.some(c => !c.nome)){ toast("Dê um nome para cada item da tabela."); return; }
  await saveConfig({catalogo:clean}, "Tabela de preços salva");
});

/* exportações */
$("#btn-csv-vendas").addEventListener("click", () => {
  const H = ["Pedido","Data","Cliente","Contato","Tipo","Itens","Descrição","Situação","Valor","Recebido","Saldo","Frete","Custo total","Resina","Energia","Impressora","Pintura (mão de obra)","Embalagem","Imposto MEI","Custos fixos","Taxa cartão","Materiais","Outros","Lucro","Entrega","CEP","Cidade/UF","Prazo","Entregue em"];
  const num = v => String(r2(v)).replace(".", ",");
  const rows = S.vendas.slice().sort((a,b) => String(a.data).localeCompare(String(b.data))).map(v => [shortId(v.id), fmtDate(v.data), v.cliente, v.contato, tipo(v.produto).nome, itensTexto(v.itens), v.descricao, STATUS[v.status]||v.status, num(v.total), num(recebido(v)), num(saldo(v)), num(v.frete), num(custo(v))].concat(LINHAS.map(([k]) => num(v.custos ? v.custos[k] : (k === "materiais" ? v.custoMateriais : k === "outros" ? v.custoExtra : 0)))).concat([num(lucro(v)), v.entrega, v.cep, v.endereco && v.endereco.cidade ? v.endereco.cidade+"/"+v.endereco.uf : "", fmtDate(v.prazo), v.entregueEm ? fmtDate(v.entregueEm) : ""]));
  download("gato-printado-vendas-"+todayISO()+".csv", "﻿"+[H].concat(rows).map(r => r.map(csvCell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
});
$("#btn-csv-estoque").addEventListener("click", () => {
  const H = ["Insumo","Categoria","Unidade","Quantidade","Mínimo","Custo unitário","Valor em estoque","Última compra","Fornecedor","Lembrete"];
  const num = v => String(r2(v)).replace(".", ",");
  const rows = S.insumos.map(it => [it.nome, it.categoria, it.unidade, String(it.qtd).replace(".",","), String(it.minimo ?? "").replace(".",","), num(custoUnit(it)), num(n(it.qtd)*custoUnit(it)), fmtDate(it.ultimaCompra), it.fornecedor, it.lembrete ? fmtDate(it.lembrete) : ""]);
  download("gato-printado-estoque-"+todayISO()+".csv", "﻿"+[H].concat(rows).map(r => r.map(csvCell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
});
$("#btn-export").addEventListener("click", () => {
  const d = {app:"gato-printado", versao:2, exportadoEm:new Date().toISOString()};
  COLS.forEach(c => d[c] = S[c]);
  download("gato-printado-backup-"+todayISO()+".json", JSON.stringify(d, null, 2), "application/json");
  toast("Backup exportado");
});
$("#file-import").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const d = JSON.parse(rd.result);
      if(!d || !Array.isArray(d.vendas) || !Array.isArray(d.insumos)) throw 0;
      const box = $("#import-confirm");
      box.innerHTML = '<span>Importar <b>'+d.vendas.length+' vendas</b> e <b>'+d.insumos.length+' insumos</b>? Os dados atuais '+(backend && backend.cloud ? "da sua conta" : "deste aparelho")+' serão substituídos.</span><span class="sp"><button class="btn sm primary" id="imp-yes">Substituir dados</button><button class="btn sm ghost" id="imp-no">Cancelar</button></span>';
      box.hidden = false;
      $("#imp-yes").onclick = async () => {
        box.hidden = true;
        const cur = {}; COLS.forEach(c => cur[c] = S[c].slice());
        try{ await backend.bulkPut(d, {replace:true, current:cur}); toast("Backup importado"); }
        catch(err){ toast("Não foi possível importar agora. Verifique a internet e tente de novo."); }
      };
      $("#imp-no").onclick = () => { box.hidden = true; };
    }catch(err){ toast("Arquivo inválido: escolha um backup exportado pelo Gato Printado."); }
  };
  rd.readAsText(f);
});

/* =====================================================================
   Avisos, selos e render geral
   ===================================================================== */
let cloudNote = "";
function localLeftover(){
  try{
    const d = JSON.parse(localStorage.getItem("balcao-local-v1") || "null");
    if(d && ((d.vendas||[]).length || (d.insumos||[]).length || (d.compras||[]).length)) return {vendas:d.vendas||[], insumos:d.insumos||[], compras:d.compras||[]};
  }catch(e){}
  return null;
}
const migrateDismissed = () => lsGet("gp-migrado", "") === "1";
const setMigrated = () => lsSet("gp-migrado", "1");
function renderBanner(){
  const ex = ["vendas","insumos","compras"].reduce((a,c) => a + S[c].filter(x => x.exemplo).length, 0);
  let h = "";
  if(backend && backend.local && cloudNote) h += '<div class="banner"><span>'+cloudNote+'</span></div>';
  if(backend && backend.cloud && localLeftover() && !migrateDismissed()){
    const L = localLeftover();
    h += '<div class="banner"><span>Encontramos <b>'+L.vendas.length+' vendas</b> e <b>'+L.insumos.length+' insumos</b> salvos só neste aparelho (versão antiga do app).</span><span class="sp"><button class="btn sm primary" id="btn-migrate">Enviar para minha conta</button><button class="btn sm ghost" id="btn-migrate-no">Ignorar</button></span></div>';
  }
  if(ex) h += '<div class="banner"><span><b>Dados de exemplo</b> — '+ex+' registros marcados como “exemplo”.</span><span class="sp"><button class="btn sm" id="btn-clear-ex">Apagar exemplos</button></span></div>';
  if(h !== $("#banner-slot").dataset.h){
    $("#banner-slot").dataset.h = h; $("#banner-slot").innerHTML = h;
    const bm = $("#btn-migrate");
    if(bm) bm.onclick = async () => {
      bm.disabled = true; bm.textContent = "Enviando…";
      try{ await backend.bulkPut(localLeftover()); setMigrated(); toast("Dados enviados para a sua conta"); }
      catch(e){ bm.disabled = false; bm.textContent = "Enviar para minha conta"; toast("Não foi possível enviar agora. Verifique a internet."); }
      renderBanner();
    };
    const bmn = $("#btn-migrate-no"); if(bmn) bmn.onclick = () => { setMigrated(); renderBanner(); };
    const bx = $("#btn-clear-ex");
    if(bx) bx.onclick = async () => {
      bx.disabled = true; bx.textContent = "Apagando…";
      for(const c of ["vendas","insumos","compras"]) for(const d of S[c].filter(x => x.exemplo)) { try{ await backend.del(c, d.id); }catch(e){} }
      toast("Exemplos apagados.");
    };
  }
}
function renderBadges(){
  const late = S.vendas.filter(atrasada).length;
  const st = S.insumos.filter(it => itemAlerts(it).some(a => a.cls === "bad")).length;
  const b1 = $("#badge-vendas"), b2 = $("#badge-estoque");
  b1.hidden = !late; b1.textContent = late; b1.title = late+" entrega(s) atrasada(s)";
  b2.hidden = !st; b2.textContent = st; b2.title = st+" insumo(s) para comprar";
}
let rafPending = false;
function renderAll(){
  if(rafPending) return; rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    renderTipoSeg(); renderBanner(); renderBadges(); renderDatalist();
    renderSales(); renderDash(); renderClients(); renderStock(); renderSettings(false);
    if(!document.activeElement || !$("#mat-rows").contains(document.activeElement)) renderMats();
    updateSum();
  });
}

/* =====================================================================
   Login e nuvem
   ===================================================================== */
let cloud = null, signupMode = false;
const AUTH_ERR = {
  "auth/invalid-credential":"E-mail ou senha incorretos.",
  "auth/wrong-password":"E-mail ou senha incorretos.",
  "auth/user-not-found":"Não existe conta com esse e-mail. Use “Criar conta com e-mail”.",
  "auth/email-already-in-use":"Já existe uma conta com esse e-mail. Use “Entrar”.",
  "auth/weak-password":"A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email":"Esse e-mail não parece válido.",
  "auth/popup-closed-by-user":"A janela do Google foi fechada antes de terminar.",
  "auth/cancelled-popup-request":"A janela do Google foi fechada antes de terminar.",
  "auth/unauthorized-domain":"Este endereço ainda não foi autorizado no Firebase (Authentication → Configurações → Domínios autorizados).",
  "auth/configuration-not-found":"O login ainda não foi ativado no Firebase (Segurança → Authentication → Vamos começar).",
  "auth/operation-not-allowed":"Esse tipo de login não está ativado no Firebase (Authentication → Método de login).",
  "auth/admin-restricted-operation":"Novos cadastros estão bloqueados neste app. Entre com a conta já existente.",
  "auth/network-request-failed":"Sem conexão com a internet. Conecte-se para entrar.",
  "auth/too-many-requests":"Muitas tentativas. Aguarde alguns minutos e tente de novo."
};
function loginError(e){ const el = $("#login-err"); el.textContent = AUTH_ERR[e && e.code] || ("Não foi possível entrar ("+((e && e.code) || "erro")+")."); el.hidden = false; }
function showLogin(){ $("#login").hidden = false; $("#login-loading").hidden = true; $("#login-forms").hidden = false; $("#login-forms").style.display = "flex"; $("#user-chip").hidden = true; }
function setSignup(on){ signupMode = on; $("#btn-email").textContent = on ? "Criar conta" : "Entrar"; $("#btn-toggle-signup").textContent = on ? "Já tenho conta: entrar" : "Criar conta com e-mail"; $("#l-senha").autocomplete = on ? "new-password" : "current-password"; $("#login-err").hidden = true; }
$("#btn-toggle-signup").addEventListener("click", () => setSignup(!signupMode));
$("#btn-google").addEventListener("click", async () => { $("#login-err").hidden = true; try{ await cloud.google(); }catch(e){ loginError(e); } });
$("#email-form").addEventListener("submit", async e => {
  e.preventDefault(); $("#login-err").hidden = true;
  const em = $("#l-email").value.trim(), pw = $("#l-senha").value, btn = $("#btn-email"); btn.disabled = true;
  try{ if(signupMode) await cloud.emailSignup(em, pw); else await cloud.emailLogin(em, pw); }catch(err){ loginError(err); }
  btn.disabled = false;
});
$("#btn-reset").addEventListener("click", async () => {
  const em = $("#l-email").value.trim(), el = $("#login-err");
  if(!em){ el.hidden = false; el.textContent = "Digite seu e-mail no campo acima e clique de novo em “Esqueci a senha”."; return; }
  try{ await cloud.resetPassword(em); el.hidden = false; el.textContent = "Enviamos um link para "+em+" para criar uma nova senha."; }catch(e){ loginError(e); }
});
$("#btn-logout").addEventListener("click", () => cloud && cloud.logout());

function setSync(state){
  const el = $("#sync-state"); if(!el) return;
  el.className = "sync " + (state === "pending" ? "pending" : state === "offline" ? "offline" : "");
  el.querySelector("span").textContent = state === "pending" ? "Salvando…" : state === "offline" ? "Offline" : "Sincronizado";
}
function clearState(){ COLS.forEach(c => S[c] = []); loaded = false; openRow = null; clientFilter = null; typesDraft = null; tiposSig = ""; cfgSeen = ""; }
function startCloud(user){
  if(backend && backend.stop) backend.stop();
  clearState();
  backend = cloud.backendFor(user, {
    onData(c, docs){ S[c] = docs; renderAll(); },
    onSync(st){ if(st === "loaded"){ loaded = true; renderAll(); } else setSync(st); },
    onError(e){
      if(e && e.code === "permission-denied") toast("Sem permissão no banco de dados. Confira as regras do Firestore (README).");
      else toast("Não foi possível salvar na nuvem agora. A alteração será enviada quando a conexão voltar.");
    }
  });
  backend.start();
  $("#login").hidden = true; $("#user-chip").hidden = false;
  $("#user-email").textContent = user.email || user.displayName || "";
  renderAll(); renderSettings(true);
}
function startLocal(note){ cloudNote = note || ""; backend = localBackend(); backend.start(); $("#login").hidden = true; renderAll(); renderSettings(true); }
function waitCloud(){
  return new Promise(res => { const t0 = Date.now(); (function chk(){
    if(window.gpCloud) res(window.gpCloud);
    else if(Date.now()-t0 > 8000) res({configured:true, loadError:new Error("timeout")});
    else setTimeout(chk, 50);
  })(); });
}

/* offline (service worker) */
if("serviceWorker" in navigator && location.protocol !== "file:"){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* =====================================================================
   Início
   ===================================================================== */
showView(view);
resetForm();
renderAll();
(async () => {
  // 1) Dentro do Claude: banco do próprio artifact.
  let db = null;
  try{ if(window.claude && typeof window.claude.use === "function") db = await window.claude.use("db"); }catch(e){ db = null; }
  if(db){ backend = claudeBackend(db); backend.start(); renderAll(); return; }

  // 2) Site publicado: Firebase (login + sincronização).
  $("#login").hidden = false;
  const c = await waitCloud();
  if(!c.configured){ startLocal("<b>Sincronização desligada:</b> preencha o arquivo <span class=\"mono\">firebase-config.js</span> para usar o mesmo login no computador e no celular. Por enquanto, os dados ficam só neste aparelho."); return; }
  if(c.loadError){ $("#login-loading").hidden = true; const el = $("#login-err"); el.hidden = false; el.textContent = "Não foi possível conectar. Verifique a internet e abra o app de novo."; return; }
  cloud = c;
  let first = true;
  cloud.onAuth(user => {
    if(user) startCloud(user);
    else { if(backend && backend.stop) backend.stop(); backend = null; clearState(); if(!first) toast("Você saiu da conta"); showLogin(); renderAll(); }
    first = false;
  });
})();
})();
