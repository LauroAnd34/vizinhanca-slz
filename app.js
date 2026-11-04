/* Vizinhança SLZ — app.js
   Dados: data/pois.json (atualizado toda semana pelo GitHub Actions) + consulta ao vivo
   na Overpass API ao redor do ponto escolhido, para mostrar só o que existe hoje no OpenStreetMap. */
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isDesk = () => matchMedia("(min-width:900px)").matches;

/* ======================= categorias ======================= */
const GROUPS = [
  ["Educação", ["escola","universidade","tecnico"]],
  ["Saúde", ["hospital","upa","ubs","clinica","odonto","lab","farmacia"]],
  ["Compras e comida", ["mercado","shopping","galeria","padaria","cafe","feira"]],
  ["Lazer, esporte e cultura", ["academia","esporte","parque","praia","biblioteca","museu","cultura","turismo"]],
  ["Transporte e serviços", ["onibus","terminal","banco","seguranca"]],
];
const CAT = {
  escola:{l:"Escolas e creches",s:"escolas",subs:1}, universidade:{l:"Universidades e faculdades",s:"faculdades",subs:1},
  tecnico:{l:"Ensino técnico",s:"técnicos",c:"#7c3aed"},
  hospital:{l:"Hospitais e maternidades",s:"hospitais",subs:1}, upa:{l:"UPAs 24h",s:"UPAs",c:"#991b1b"},
  ubs:{l:"Postos de saúde / UBS",s:"postos",c:"#f87171"}, clinica:{l:"Clínicas médicas",s:"clínicas",c:"#fb7185"},
  odonto:{l:"Clínicas odontológicas",s:"dentistas",c:"#0ea5e9"}, lab:{l:"Laboratórios e diagnóstico",s:"laboratórios",c:"#a855f7"},
  farmacia:{l:"Farmácias",s:"farmácias",c:"#16a34a"},
  mercado:{l:"Supermercados e atacarejos",s:"mercados",subs:1}, shopping:{l:"Shoppings",s:"shoppings",c:"#ea580c"},
  galeria:{l:"Galerias e centros comerciais",s:"galerias",c:"#fdba74"}, padaria:{l:"Padarias",s:"padarias",c:"#a16207"},
  cafe:{l:"Cafeterias",s:"cafés",c:"#7c4a1e"}, feira:{l:"Feiras e mercados públicos",s:"feiras",c:"#84cc16"},
  academia:{l:"Academias",s:"academias",c:"#9333ea"}, esporte:{l:"Centros esportivos",s:"esportes",c:"#c084fc"},
  parque:{l:"Parques e praças",s:"praças",c:"#22c55e"}, praia:{l:"Praias",s:"praias",c:"#eab308"},
  biblioteca:{l:"Bibliotecas",s:"bibliotecas",c:"#0f766e"}, museu:{l:"Museus",s:"museus",c:"#6d28d9"},
  cultura:{l:"Teatros, cinema e cultura",s:"cultura",c:"#be185d"}, turismo:{l:"Pontos turísticos",s:"turismo",c:"#f472b6"},
  onibus:{l:"Pontos de ônibus (ao vivo)",s:"pontos de ônibus",c:"#0369a1"}, terminal:{l:"Terminais de ônibus",s:"terminais",c:"#64748b"},
  banco:{l:"Bancos",s:"bancos",c:"#475569"}, seguranca:{l:"Polícia e bombeiros",s:"segurança",c:"#1f2937"},
};
const SUBC = {
  "escola|Municipal":"#0e9f8e","escola|Estadual":"#2563eb","escola|Federal":"#3730a3","escola|Particular":"#d97706",
  "escola|Particular*":"#f59e0b","escola|Bilíngue":"#db2777","escola|Comunitária / filantrópica":"#65a30d",
  "escola|Pública (rede não informada)":"#60a5fa","escola|Não informado":"#94a3b8",
  "universidade|Pública":"#1e3a8a","universidade|Particular":"#b45309",
  "hospital|Público":"#dc2626","hospital|Particular":"#e11d48","hospital|Filantrópico":"#f97316","hospital|Não informado":"#f43f5e",
  "mercado|Supermercado":"#ca8a04","mercado|Atacarejo":"#92400e",
};
const SUBORDER = {escola:["Municipal","Estadual","Federal","Particular","Particular*","Bilíngue","Comunitária / filantrópica","Pública (rede não informada)","Não informado"]};
const SUBLABEL = {"Particular*":"Particular (deduzida pelo nome)"};
const colorOf = r => SUBC[r.cat+"|"+r.sub] || CAT[r.cat]?.c || "#64748b";
const keyOf = r => r.cat+"|"+r.sub;

/* ======================= classificação (tags do OSM) ======================= */
function schoolNet(n, t){
  const op = (t.operator||"")+" "+(t["operator:type"]||""), ot = t["operator:type"]||"";
  if (/bil[ií]ng|international|maple bear|escola americana|bilingual/i.test(n) || /en|english/i.test(t["school:language"]||"")) return "Bilíngue";
  if (/\bifma\b|instituto federal|colun|col[eé]gio universit|\bufma\b/i.test(n) || /federal|ifma|ufma/i.test(op)) return "Federal";
  if (ot==="private") return "Particular";
  if (/estado|seduc|estadual/i.test(op) || /^(c\.?\s?e\.?\s|c\.?e\.?m\.?\s|centro de ensino|centro educa mais|iema|escola estadual|liceu|col[eé]gio militar tiradentes)/i.test(n)) return "Estadual";
  if (/municipal|prefeitura|semed/i.test(op) || /^(u\.?\s?e\.?\s?b|unidade de educa|escola municipal|creche municipal|u\.?\s?i\.?\s|unidade integrada|ueb)/i.test(n)) return "Municipal";
  if (["community","charitable","ngo","religious"].includes(ot) || /comunit[aá]ri|^ec\s|filantr|apae|funda[cç][aã]o bradesco/i.test(n)) return "Comunitária / filantrópica";
  if (/\bsesi\b|\bsenac\b|\bsenai\b/i.test(n)) return "Particular";
  if (!["public","government"].includes(ot) && /col[eé]gio|centro educacional|instituto educacional|ltda|creche escola|escola creche|educand[aá]rio|jardim|montessori|kids|baby|^ji\s|educa/i.test(n)) return "Particular*";
  if (["public","government"].includes(ot)) return "Pública (rede não informada)";
  return "Não informado";
}
const PUBH = /carlos macieira|juv[eê]ncio|nina rodrigues|aquiles lisboa|presidente vargas|materno|hospital da mulher|hospital da crian|zona rural|servidores|benedito leite|marly sarney|gen[eé]sio|hospital da ilha|policl[ií]nica|pronto.socorro|hemomar|sarah|tarqu[ií]nio|traumatologia e ortopedia|testagem|nossa senhora da penha|universit[aá]rio|socorr|municipal|estadual/i;
const PRIVH = /s[aã]o domingos|\budi\b|portugu[eê]s|guar[aá]s|hospital s[aã]o lu[ií]s|ibirapuera|\bhci\b|cuidados intensivos|natus|jasmin|vis[aã]o|centro m[eé]dico|hapvida|unimed|imedical/i;
function classify(t){
  const n = (t.name||"").trim(), a=t.amenity, s=t.shop, l=t.leisure, tr=t.tourism, hc=t.healthcare;
  if (t.highway==="bus_stop") return ["onibus","Ponto de ônibus"];
  if (!n || t.disused==="yes") return null;
  if ((a||hc) && /^(farm[aá]cia|drogaria)/i.test(n)) return ["farmacia","Farmácia"];
  if (s==="mall") return (/shopping|\bmall\b/i.test(n) && !/autom[oó]vel/i.test(n)) ? ["shopping","Shopping"] : ["galeria","Galeria / centro comercial"];
  if (a==="school"||a==="kindergarten") return ["escola", schoolNet(n,t)];
  if (a==="university"||t.building==="university"||(a==="college"&&/faculdade|universi|centro universit/i.test(n)))
    return ["universidade", /\bufma\b|\buema\b|\bifma\b|uemasul|federal|estadual|instituto federal/i.test(n) ? "Pública" : "Particular"];
  if (a==="college") return ["tecnico", /\bifma\b|\biema\b|instituto estadual|instituto federal|centro de ensino|cemp/i.test(n) ? "Público" : "Particular / Sistema S"];
  if (["hospital","clinic","doctors","dentist"].includes(a) || hc){
    if (hc==="pharmacy") return ["farmacia","Farmácia"];
    if (/\bupa\b|pronto atendimento/i.test(n)) return ["upa","UPA 24h"];
    if (a==="dentist"||hc==="dentist"||/odont|dental|dentist|sorriso|ortodont|implant/i.test(n)) return ["odonto","Clínica odontológica"];
    if (hc==="laboratory"||/laborat|an[aá]lises cl[ií]nicas|diagn[oó]st|imagem/i.test(n)) return ["lab","Laboratório / diagnóstico"];
    if (/centro de sa[uú]de|\bubs\b|unidade b[aá]sica|posto de sa|\busf\b|unidade de sa[uú]de|sa[uú]de da fam/i.test(n)) return ["ubs","Posto de saúde / UBS"];
    if (/hospital|socorr|maternidade|policl[ií]nica/i.test(n) || ((a==="hospital"||hc==="hospital") && !/cl[ií]nica|consult/i.test(n))){
      if (/aldenora|santa casa/i.test(n)) return ["hospital","Filantrópico"];
      if (PRIVH.test(n) || t["operator:type"]==="private") return ["hospital","Particular"];
      if (PUBH.test(n) || ["public","government"].includes(t["operator:type"]) || /sus|ebserh|estado|munic/i.test(t.operator||"")) return ["hospital","Público"];
      return ["hospital","Não informado"];
    }
    return ["clinica","Clínica médica"];
  }
  if (l==="fitness_centre"||(l==="sports_centre"&&/academia|fit|gym|cross|box|muscula|pilates|studio/i.test(n))) return ["academia","Academia"];
  if (l==="sports_centre") return ["esporte","Centro esportivo"];
  if (s==="supermarket"||s==="wholesale") return ["mercado", /atacad|assa[ií]|mix mateus|atacarejo|maxxi|makro|atac/i.test(n) ? "Atacarejo" : "Supermercado"];
  if (a==="pharmacy"||s==="chemist") return ["farmacia","Farmácia"];
  if (a==="library") return ["biblioteca","Biblioteca"];
  if (tr==="museum") return ["museu","Museu"];
  if (a==="cafe") return ["cafe","Cafeteria"];
  if (s==="bakery") return ["padaria","Padaria"];
  if (a==="marketplace") return ["feira","Feira / mercado"];
  if (l==="park") return ["parque","Parque / praça"];
  if (a==="bank") return ["banco","Banco"];
  if (a==="police") return ["seguranca","Polícia"];
  if (a==="fire_station") return ["seguranca","Bombeiros"];
  if (a==="bus_station") return ["terminal","Terminal de ônibus"];
  if (a==="theatre") return ["cultura","Teatro"];
  if (a==="cinema") return ["cultura","Cinema"];
  if (a==="arts_centre") return ["cultura","Centro cultural"];
  if (t.natural==="beach") return ["praia","Praia"];
  if (tr==="attraction") return ["turismo","Ponto turístico"];
  return null;
}

/* destaques: ranking ENEM 2019 por escola (INEP, via Blog do Enem) e principais universidades */
const TOP_ESC = [
  [/crescimento/i,"1º no ENEM 2019 em São Luís (média 645)",1],[/literato/i,"2º no ENEM 2019 (622)",2],
  [/reino infantil|montessoriano/i,"3º no ENEM 2019 (619)",3],[/educallis/i,"4º no ENEM 2019 (612)",4],
  [/dom bosco/i,"5º no ENEM 2019 (606)",5],[/upaon/i,"6º no ENEM 2019 (605)",6],
  [/centro de educa[cç][aã]o internacional/i,"7º no ENEM 2019 (604)",7],[/col[eé]gio santa teresa/i,"8º no ENEM 2019 (603)",8],
  [/col[eé]gio batista daniel de la touche/i,"9º no ENEM 2019 (589)",9],[/col[eé]gio o bom pastor/i,"10º no ENEM 2019 (585)",10],
  [/invictus|educator/i,"Entre os 20 melhores no ENEM 2019",11],[/cenaza|centro educacional nossa senhora de nazar/i,"12º no ENEM 2019 (572)",12],
  [/universidade infantil rivanda|uirb/i,"13º no ENEM 2019 (567)",13],
  [/ifma.*monte castelo|monte castelo.*ifma|ifma- campus monte/i,"Melhor escola pública no ENEM 2019 (557)",16],
  [/col[eé]gio militar tiradentes/i,"Colégio Militar (PM-MA): 2º público no ENEM 2019 (549)",18],[/anna adelaide/i,"19º no ENEM 2019 (548)",19],
  [/colun|col[eé]gio universit/i,"Federal (UFMA): 3º público no ENEM 2019 (546)",21],[/col[eé]gio santa f[eé]/i,"22º no ENEM 2019 (545)",22],
  [/2 de julho|dois de julho/i,"Colégio Militar: entre os melhores públicos no ENEM 2019 (526)",29],
  [/ifma.*centro hist|ifma.*maracan/i,"IFMA: entre os melhores públicos no ENEM 2019",30],
  [/\biema\b/i,"IEMA (estadual, tempo integral): entre as melhores escolas estaduais",33],
];
const TOP_UNI = [
  [/\bufma\b|universidade federal do maranh/i,"Universidade Federal do Maranhão",1],[/\buema\b|universidade estadual do maranh/i,"Universidade Estadual do Maranhão",2],
  [/\bifma\b|instituto federal/i,"Instituto Federal do Maranhão",3],[/ceuma/i,"Maior universidade particular de São Luís",4],
  [/\bundb\b|dom bosco/i,"Centro universitário particular bem avaliado",5],[/florence/i,"Particular, conceito MEC 3",6],
];
function highlight(cat, n){
  const L = (cat==="escola"||cat==="tecnico") ? TOP_ESC : cat==="universidade" ? TOP_UNI : null;
  if (!L) return null;
  for (const [re, why, rank] of L) if (re.test(n)) return {why, rank};
  return null;
}

/* ======================= estado ======================= */
let BAIRROS = [], STATIC = [], LIVE = null; // LIVE = {lat,lon,r,items,at}
const on = new Set();
const DEFAULT_OFF = new Set(["galeria","banco","seguranca","terminal","esporte","parque","padaria","lab","clinica","onibus"]);
let home = null, circle = null, radius = 1000, onlyHl = false, quick = null;
let lastPopupClose = 0;

function nearestBairro(lat, lon){
  let best = "", bd = 1e9; const k = Math.cos(lat*Math.PI/180);
  for (const [n,a,b] of BAIRROS){ const d=(a-lat)**2+((b-lon)*k)**2; if (d<bd){bd=d;best=n;} }
  return best;
}
function makeRec(id, lat, lon, t, live){
  const c = classify(t); if (!c) return null;
  const name = (t.name||"").trim() || (c[0]==="onibus" ? "Ponto de ônibus" : "");
  return {id, lat, lon, t, cat:c[0], sub:c[1], name, hl:highlight(c[0], name), bairro:t._b || t["addr:suburb"] || "", ts:t._ts||"", live, m:null};
}
function dist(a,b,c,d){ const R=6371000,r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r; return Math.sqrt(x*x+y*y)*R; }
const fmtD = m => m<1000 ? Math.round(m/10)*10+" m" : (m/1000).toFixed(1).replace(".",",")+" km";
const walk = m => { const min = Math.max(1, Math.round(m*1.3/75)); return min<60 ? min+" min a pé" : Math.round(min/6)/10+" h a pé"; };
const yearsOld = ts => ts ? (Date.now()-new Date(ts).getTime())/3.156e10 : null;
const fmtDate = ts => ts ? ts.slice(8,10)+"/"+ts.slice(5,7)+"/"+ts.slice(0,4) : "";

/* ======================= mapa ======================= */
const map = L.map("map", {preferCanvas:true, zoomControl:true, minZoom:10, maxZoom:19, tap:true})
  .setView([-2.53,-44.25], 12);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19,
  attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
const markers = L.layerGroup().addTo(map);
const starIcon = sz => L.divIcon({className:"starIcon", iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2],
  html:`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24"><path fill="#f2a900" stroke="#5a3d00" stroke-width="1.3" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>`});
const homeIcon = L.divIcon({className:"homeIcon", iconSize:[34,42], iconAnchor:[17,40],
  html:`<svg width="34" height="42" viewBox="0 0 30 36"><path d="M15 35s12-11.6 12-21A12 12 0 0 0 3 14c0 9.4 12 21 12 21z" fill="#1d4e89" stroke="#fff" stroke-width="2"/><path d="M9 15.5l6-5 6 5V21h-4v-3.5h-4V21H9z" fill="#fff"/></svg>`});

function markerFor(r){
  if (r.m) return r.m;
  if (r.hl) r.m = L.marker([r.lat,r.lon], {icon:starIcon(r.cat==="universidade"?28:24), zIndexOffset:1000, title:r.name, bubblingMouseEvents:false});
  else {
    const big = ["universidade","hospital","upa","shopping"].includes(r.cat), bus = r.cat==="onibus";
    r.m = L.circleMarker([r.lat,r.lon], {radius: dotR(r), color:"#fff", weight:big?2.2:1.4,
      fillColor:colorOf(r), fillOpacity: (yearsOld(r.ts)>5 ? .55 : .95), bubblingMouseEvents:false});
  }
  r.m._rec = r;
  r.m.bindPopup(() => popupHtml(r), {maxWidth:320, autoPanPaddingTopLeft:[10,140], autoPanPaddingBottomRight:[10,40]});
  return r.m;
}
function dotR(r){
  const z = map.getZoom(), big = ["universidade","hospital","upa","shopping"].includes(r.cat);
  if (r.cat==="onibus") return z>=16 ? 4.5 : 3.5;
  if (z<=12) return big ? 5 : 3.2;
  if (z===13) return big ? 6.5 : 4.5;
  return big ? 8 : 6;
}
map.on("zoomend", () => markers.eachLayer(m => { if (m.setRadius && m._rec) m.setRadius(dotR(m._rec)); }));
function visible(r){ return onlyHl ? !!r.hl : on.has(keyOf(r)); }
function render(){
  markers.clearLayers();
  const live = LIVE && home;
  for (const r of STATIC){
    if (live && dist(LIVE.lat, LIVE.lon, r.lat, r.lon) <= LIVE.r) continue; // dentro do raio valem os dados ao vivo
    if (visible(r)) markers.addLayer(markerFor(r));
  }
  if (live) for (const r of LIVE.items) if (visible(r)) markers.addLayer(markerFor(r));
}

function popupHtml(r){
  const t = r.t, sub = SUBLABEL[r.sub] || r.sub;
  const rua = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const loc = [rua, r.bairro, t._c].filter(Boolean).map(esc).join(" · ");
  const phone = t.phone || t["contact:phone"]; let web = t.website || t["contact:website"];
  if (web && !/^https?:/i.test(web)) web = "https://"+web;
  const typ = {n:"node",w:"way",r:"relation"}[r.id[0]], oid = r.id.slice(1);
  const gm = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name+(r.cat==="onibus"?"":" "+(r.bairro||"")+" São Luís"))}`;
  const sv = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${r.lat},${r.lon}`;
  let route = "", far = "";
  if (home){ const h = home.getLatLng(), d = dist(h.lat,h.lng,r.lat,r.lon);
    far = `<div class="meta"><b>${fmtD(d)}</b> do imóvel · ~${walk(d)}</div>`;
    route = `<a href="https://www.google.com/maps/dir/?api=1&origin=${h.lat},${h.lng}&destination=${r.lat},${r.lon}&travelmode=walking" target="_blank" rel="noopener">Rota a pé</a>`; }
  const age = yearsOld(r.ts);
  const fresh = r.ts ? (age>4
      ? `<div class="warn">Última revisão no OpenStreetMap em ${fmtDate(r.ts)}. Pode ter fechado ou mudado: confira no Street View.</div>`
      : `<div class="meta">Revisado no OpenStreetMap em ${fmtDate(r.ts)}${r.live?" · dado ao vivo":""}</div>`) : "";
  return `<div class="pp"><span class="tg"><span class="dot" style="background:${colorOf(r)}"></span>${esc(CAT[r.cat].l.replace(/ \(.*\)| e .*/,""))} · ${esc(sub)}</span>
    <h3>${esc(r.name)}</h3>
    ${r.hl?`<div class="hl"><svg class="star" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg><span>${esc(r.hl.why)}</span></div>`:""}
    ${far}${loc?`<div class="meta">${loc}</div>`:""}
    ${phone?`<div>Tel.: <a href="tel:${esc(phone.replace(/[^\d+]/g,""))}">${esc(phone)}</a></div>`:""}
    ${t.opening_hours?`<div>Horário: ${esc(t.opening_hours)}</div>`:""}
    ${r.sub==="Particular*"?`<div class="meta">Rede deduzida pelo nome; confirme com a escola.</div>`:""}
    ${fresh}
    <div class="links">${route}<a href="${sv}" target="_blank" rel="noopener">Street View</a><a href="${gm}" target="_blank" rel="noopener">Google Maps</a>${web?`<a href="${esc(web)}" target="_blank" rel="noopener">Site</a>`:""}<a href="https://www.openstreetmap.org/edit?${typ}=${oid}" target="_blank" rel="noopener">Corrigir no OSM</a></div></div>`;
}
map.on("popupclose", () => lastPopupClose = Date.now());

/* ======================= painel (sheet) ======================= */
const sheet = $("#sheet");
const SH = () => ({peek: 172, half: Math.round(innerHeight*.5), full: innerHeight - 76});
let sheetState = "peek";
function setSheet(state){
  sheetState = state;
  sheet.dataset.state = state;
  document.body.classList.toggle("sheetfull", state==="full" && !isDesk());
  const h = isDesk() ? 0 : SH()[state];
  document.documentElement.style.setProperty("--sheet-h", isDesk() ? "0px" : h+"px");
}
(function dragSheet(){
  let y0=0, h0=0, moved=0, active=false;
  const start = e => { if (isDesk()) return; active=true; moved=0; y0=e.clientY; h0=sheet.getBoundingClientRect().height; sheet.classList.add("dragging"); e.target.setPointerCapture?.(e.pointerId); };
  const move = e => { if(!active) return; const dy=e.clientY-y0; moved=Math.max(moved,Math.abs(dy));
    const h=Math.min(innerHeight-60, Math.max(120, h0-dy)); document.documentElement.style.setProperty("--sheet-h", h+"px"); };
  const end = e => { if(!active) return; active=false; sheet.classList.remove("dragging");
    const s=SH(), h=sheet.getBoundingClientRect().height;
    if (moved<6){ setSheet(sheetState==="peek"?"half":sheetState==="half"?"full":"peek"); return; }
    const vel = (e.clientY-y0); // direção do gesto
    let best = Object.entries(s).sort((a,b)=>Math.abs(a[1]-h)-Math.abs(b[1]-h))[0][0];
    if (Math.abs(vel)>40){ const order=["peek","half","full"], i=order.indexOf(sheetState); best = vel<0 ? order[Math.min(2,i+1)] : order[Math.max(0,i-1)]; if (Math.abs(vel)>innerHeight*.35) best = vel<0?"full":"peek"; }
    setSheet(best); };
  for (const el of [$("#grab"), sheet.querySelector(".brand")]){ el.addEventListener("pointerdown", start); }
  addEventListener("pointermove", move); addEventListener("pointerup", end); addEventListener("pointercancel", end);
})();
addEventListener("resize", () => setSheet(sheetState));

/* abas */
function showTab(name){
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", b.dataset.tab===name);
  for (const p of ["near","filters","best"]) $("#p-"+p).hidden = p!==name;
  if (!isDesk() && sheetState==="peek") setSheet("half");
}
for (const b of document.querySelectorAll(".tabs button")) b.onclick = () => showTab(b.dataset.tab);

/* toast */
let toastT; function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, 2800); }

/* ======================= filtros ======================= */
let keysByCat = {};
function buildCounts(){
  keysByCat = {};
  for (const r of STATIC){ const m = keysByCat[r.cat] ||= new Map(); m.set(r.sub, (m.get(r.sub)||0)+1); }
  keysByCat.onibus ||= new Map([["Ponto de ônibus",0]]);
}
function defaults(){ on.clear(); for (const c in keysByCat) if (!DEFAULT_OFF.has(c)) for (const s of keysByCat[c].keys()) on.add(c+"|"+s); }
function setCat(c, v){ for (const s of (keysByCat[c]||new Map()).keys()) v ? on.add(c+"|"+s) : on.delete(c+"|"+s); }
function buildFilters(){
  const wrap = $("#filters"); wrap.innerHTML = "";
  GROUPS.forEach(([g, cats], gi) => {
    const d = document.createElement("details"); d.className="grp"; if (gi<2) d.open = true;
    const total = cats.reduce((a,c)=>a+[...(keysByCat[c]||new Map()).values()].reduce((x,y)=>x+y,0),0);
    d.innerHTML = `<summary><span>${g} <span style="color:var(--muted);font-weight:500">(${total})</span></span></summary><div class="cats"></div>`;
    const box = d.querySelector(".cats");
    for (const c of cats){
      if (!keysByCat[c]) continue;
      const subs = [...keysByCat[c].entries()], n = subs.reduce((a,b)=>a+b[1],0);
      const dotBg = CAT[c].subs ? `conic-gradient(${subs.map((s,i)=>`${SUBC[c+"|"+s[0]]||"#999"} ${i*100/subs.length}% ${(i+1)*100/subs.length}%`).join(",")})` : CAT[c].c;
      const row = document.createElement("label"); row.className="fc";
      row.innerHTML = `<input type="checkbox" data-c="${c}"><span class="dot" style="background:${dotBg}"></span><span>${CAT[c].l}</span><span class="n">${c==="onibus"?"ao vivo":n}</span>`;
      row.querySelector("input").onchange = e => { quick=null; setCat(c, e.target.checked); refresh(); };
      box.appendChild(row);
      if (CAT[c].subs && subs.length>1){
        const sw = document.createElement("div"); sw.className="subs";
        const ord = SUBORDER[c] || subs.map(s=>s[0]);
        subs.sort((a,b)=>ord.indexOf(a[0])-ord.indexOf(b[0])).forEach(([s,cnt]) => {
          const k=c+"|"+s, sr=document.createElement("label"); sr.className="fc";
          sr.innerHTML = `<input type="checkbox" data-k="${esc(k)}"><span class="dot" style="background:${SUBC[k]||"#999"}"></span><span>${esc(SUBLABEL[s]||s)}</span><span class="n">${cnt}</span>`;
          sr.querySelector("input").onchange = e => { quick=null; e.target.checked?on.add(k):on.delete(k); refresh(); };
          sw.appendChild(sr);
        });
        box.appendChild(sw);
      }
    }
    wrap.appendChild(d);
  });
}
function syncBoxes(){
  document.querySelectorAll("#filters input[data-k]").forEach(b => b.checked = on.has(b.dataset.k));
  document.querySelectorAll("#filters input[data-c]").forEach(b => {
    const ks=[...(keysByCat[b.dataset.c]||new Map()).keys()].map(s=>b.dataset.c+"|"+s), n=ks.filter(k=>on.has(k)).length;
    b.checked = n===ks.length && n>0; b.indeterminate = n>0 && n<ks.length; });
  $("#onlyhl").checked = onlyHl;
  document.querySelectorAll(".chip").forEach(ch => ch.setAttribute("aria-pressed", ch.dataset.q===(onlyHl&&quick==="hl"?"hl":quick)));
}
function refresh(){ syncBoxes(); render(); }
$("#onlyhl").onchange = e => { onlyHl = e.target.checked; quick = onlyHl ? "hl" : null; refresh(); };
$("#all").onclick = () => { quick=null; onlyHl=false; for (const c in keysByCat) setCat(c,true); refresh(); };
$("#none").onclick = () => { quick=null; onlyHl=false; on.clear(); refresh(); };
$("#reset").onclick = () => { quick=null; onlyHl=false; defaults(); refresh(); };

/* chips: filtro rápido (mostra só aquele grupo; toque de novo volta ao padrão) */
const QUICK = [
  ["hl","Destaques",null,"#f2a900"], ["edu","Escolas",["escola","tecnico"],"#2563eb"], ["uni","Faculdades",["universidade"],"#1e3a8a"],
  ["saude","Saúde",["hospital","upa","ubs","clinica","lab"],"#dc2626"], ["odonto","Dentistas",["odonto"],"#0ea5e9"],
  ["merc","Mercados",["mercado","feira","padaria"],"#ca8a04"], ["farm","Farmácias",["farmacia"],"#16a34a"],
  ["acad","Academias",["academia","esporte"],"#9333ea"], ["cafe","Cafés",["cafe","padaria"],"#7c4a1e"],
  ["shop","Shoppings",["shopping","galeria"],"#ea580c"], ["lazer","Lazer",["parque","praia","museu","biblioteca","cultura","turismo"],"#22c55e"],
  ["bus","Ônibus",["onibus","terminal"],"#0369a1"],
];
function buildChips(){
  const box = $("#chips");
  for (const [id, label, cats, col] of QUICK){
    const b = document.createElement("button"); b.className="chip"; b.dataset.q=id; b.setAttribute("aria-pressed","false");
    b.innerHTML = id==="hl" ? `<svg class="star" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>${label}` : `<span class="dot" style="background:${col}"></span>${label}`;
    b.onclick = () => {
      if (quick===id){ quick=null; onlyHl=false; defaults(); }
      else { quick=id; onlyHl = id==="hl"; if (!onlyHl){ on.clear(); cats.forEach(c=>setCat(c,true)); } }
      refresh();
      if (id==="bus" && !home) toast("Os pontos de ônibus aparecem ao redor do imóvel: toque no mapa para escolher um ponto.");
    };
    box.appendChild(b);
  }
}

/* ======================= foco em um lugar ======================= */
function focusRec(r){
  if (!visible(r)){ if (onlyHl && !r.hl){ onlyHl=false; quick=null; } on.add(keyOf(r)); refresh(); }
  if (!isDesk()) setSheet("peek");
  map.flyTo([r.lat, r.lon], Math.max(map.getZoom(), 16), {duration:.6});
  setTimeout(() => markerFor(r).openPopup(), 650);
}
function itemRow(r, right, extra){
  const b = document.createElement("button"); b.className="item"; b.type="button";
  const old = yearsOld(r.ts) > 4;
  b.innerHTML = `<span class="dot" style="background:${r.hl?"#f2a900":colorOf(r)}"></span>
    <span style="min-width:0"><span class="nm">${esc(r.name)}</span><small>${esc(SUBLABEL[r.sub]||r.sub)}${r.bairro?" · "+esc(r.bairro):""}</small>
    ${extra?`<small>${esc(extra)}</small>`:""}${old?`<small class="old">Sem revisão desde ${r.ts.slice(0,4)}: confira se ainda existe</small>`:""}</span>
    ${right?`<span class="d">${right}</span>`:"<span></span>"}`;
  b.onclick = () => focusRec(r);
  return b;
}

/* ======================= busca ======================= */
let IDX = [];
const q = $("#q"), res = $("#results");
function closeResults(){ res.hidden = true; res.innerHTML = ""; }
function placeHits(text){
  const parts = norm(text).split(/\s+/).filter(Boolean), hits = [];
  for (let i=0; i<STATIC.length && hits.length<60; i++) if (parts.every(p=>IDX[i].includes(p))) hits.push(STATIC[i]);
  return hits.sort((a,b)=>(b.hl?1:0)-(a.hl?1:0)).slice(0,6);
}
function bairroHits(text){
  const t = norm(text); const seen = new Set(), out = [];
  for (const b of BAIRROS){ if (norm(b[0]).includes(t) && !seen.has(norm(b[0]))){ seen.add(norm(b[0])); out.push(b); if (out.length>=4) break; } }
  return out;
}
function showResults(text, addr){
  res.innerHTML = "";
  const bs = bairroHits(text), ps = placeHits(text);
  if (bs.length){ res.insertAdjacentHTML("beforeend", `<div class="sec">Bairros</div>`);
    for (const b of bs){ const el=document.createElement("button"); el.className="item"; el.type="button";
      el.innerHTML=`<span class="dot" style="background:var(--accent)"></span><span><span class="nm">${esc(b[0])}</span><small>Ver o que tem no bairro</small></span><span></span>`;
      el.onclick=()=>{ closeResults(); q.blur(); setHome(L.latLng(b[1],b[2]), true); }; res.appendChild(el);} }
  if (ps.length){ res.insertAdjacentHTML("beforeend", `<div class="sec">Lugares</div>`);
    for (const r of ps){ const el=itemRow(r); el.onclick=()=>{ closeResults(); q.blur(); focusRec(r); }; res.appendChild(el);} }
  res.insertAdjacentHTML("beforeend", `<div class="sec">Endereço</div>`);
  if (addr === undefined){
    const el=document.createElement("button"); el.className="item"; el.type="button";
    el.innerHTML=`<span class="dot" style="background:#64748b"></span><span><span class="nm">Buscar o endereço “${esc(text)}”</span><small>Rua e número, condomínio ou ponto de referência</small></span><span></span>`;
    el.onclick=()=>geocode(text); res.appendChild(el);
  } else if (addr === "loading") res.insertAdjacentHTML("beforeend", `<div class="msg">Procurando endereço…</div>`);
  else if (!addr.length) res.insertAdjacentHTML("beforeend", `<div class="msg">Endereço não encontrado. Tente só a rua e o bairro.</div>`);
  else for (const a of addr){ const el=document.createElement("button"); el.className="item"; el.type="button";
      const nm = a.display_name.split(",").slice(0,3).join(",");
      el.innerHTML=`<span class="dot" style="background:#1d4e89"></span><span><span class="nm">${esc(nm)}</span><small>Escolher como imóvel</small></span><span></span>`;
      el.onclick=()=>{ closeResults(); q.blur(); setHome(L.latLng(+a.lat,+a.lon), true); }; res.appendChild(el); }
  res.hidden = false;
}
let qT;
q.addEventListener("focus", () => { if (!isDesk() && sheetState!=="peek") setSheet("peek"); });
q.addEventListener("input", () => { $("#qclear").hidden = !q.value; clearTimeout(qT);
  const v=q.value.trim(); if (v.length<2) return closeResults(); qT=setTimeout(()=>showResults(v),120); });
$("#qclear").onclick = () => { q.value=""; $("#qclear").hidden=true; closeResults(); q.focus(); };
$("#searchform").onsubmit = e => { e.preventDefault(); const v=q.value.trim(); if (v.length>=3) geocode(v); };
document.addEventListener("pointerdown", e => { if (!e.target.closest(".top")) closeResults(); });
async function geocode(text){
  showResults(text, "loading");
  try {
    const u = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({q:text+", São Luís, Maranhão", format:"jsonv2", limit:"6",
      viewbox:"-44.45,-2.40,-44.10,-2.80", bounded:"1", countrycodes:"br", "accept-language":"pt-BR"});
    const r = await fetch(u, {headers:{"Accept":"application/json"}});
    showResults(text, r.ok ? await r.json() : []);
  } catch { showResults(text, []); }
}

/* ======================= imóvel + dados ao vivo ======================= */
const OVERPASS = ["https://overpass-api.de/api/interpreter","https://overpass.private.coffee/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
let liveCtl = null, liveState = "idle", liveErr = "";
function liveQuery(lat, lon, r){
  const A = `(around:${r},${lat},${lon})`;
  return `[out:json][timeout:25];(
nwr${A}[amenity~"^(school|kindergarten|university|college|hospital|clinic|doctors|dentist|pharmacy|library|cafe|marketplace|bank|police|fire_station|bus_station|theatre|cinema|arts_centre)$"][name];
nwr${A}[shop~"^(mall|supermarket|wholesale|bakery|chemist)$"][name];
nwr${A}[leisure~"^(fitness_centre|sports_centre|park)$"][name];
nwr${A}[tourism~"^(museum|attraction)$"][name];
nwr${A}[healthcare][name];
nwr${A}[natural=beach][name];
node${A}[highway=bus_stop];
);out center meta;`;
}
async function fetchLive(){
  if (!home) return;
  const {lat, lng} = home.getLatLng(), r = radius;
  liveCtl?.abort(); const ctl = liveCtl = new AbortController();
  liveState = "loading"; updateNear();
  const body = new URLSearchParams({data: liveQuery(lat.toFixed(5), lng.toFixed(5), r)});
  for (const url of OVERPASS){
    try {
      const tm = setTimeout(()=>ctl.abort("timeout"), 30000);
      const resp = await fetch(url, {method:"POST", body, signal:ctl.signal});
      clearTimeout(tm);
      if (!resp.ok) throw new Error("HTTP "+resp.status);
      const j = await resp.json();
      if (ctl !== liveCtl) return;
      const items = [];
      for (const el of j.elements||[]){
        const la = el.lat ?? el.center?.lat, lo = el.lon ?? el.center?.lon; if (la==null) continue;
        const t = Object.assign({}, el.tags); if (el.timestamp) t._ts = el.timestamp.slice(0,10);
        t._b = t["addr:suburb"] || nearestBairro(la, lo);
        const rec = makeRec(el.type[0]+el.id, la, lo, t, true); if (rec) items.push(rec);
      }
      LIVE = {lat, lon:lng, r, items, at:new Date()};
      liveState = "ok"; render(); updateNear(); return;
    } catch (e){
      if (ctl !== liveCtl) return;
      if (ctl.signal.aborted && ctl.signal.reason !== "timeout") return;
      liveErr = String(e.message||e);
    }
  }
  if (ctl === liveCtl){ LIVE = null; liveState = "error"; render(); updateNear(); }
}
let liveT; const scheduleLive = () => { clearTimeout(liveT); liveT = setTimeout(fetchLive, 450); };

function setHome(latlng, fly){
  if (!home){
    home = L.marker(latlng, {icon:homeIcon, draggable:true, zIndexOffset:3000, title:"Imóvel (arraste para mover)"}).addTo(map);
    circle = L.circle(latlng, {radius, color:"#1d4e89", weight:2, dashArray:"6 6", fillColor:"#1d4e89", fillOpacity:.07, interactive:false}).addTo(map);
    home.on("drag", () => circle.setLatLng(home.getLatLng()));
    home.on("dragend", () => { writeHash(); scheduleLive(); updateNear(); });
    home.on("click", () => { showTab("near"); });
  } else { home.setLatLng(latlng); circle.setLatLng(latlng); }
  LIVE = null; liveState = "loading";
  writeHash(); updateNear(); render(); scheduleLive();
  if (fly) map.flyTo(latlng, Math.max(14, Math.min(16, map.getZoom()+2)), {duration:.6});
  map.once("moveend", () => {}); showTab("near");
  if (!isDesk()) setSheet("half");
}
function clearHome(){ home?.remove(); circle?.remove(); home=null; circle=null; LIVE=null; liveCtl?.abort(); liveState="idle"; writeHash(); render(); updateNear(); }
map.on("click", e => { if (Date.now()-lastPopupClose < 350) return; closeResults(); setHome(e.latlng, false); });

$("#locate").onclick = () => {
  if (!navigator.geolocation) return toast("Seu navegador não informa a localização.");
  toast("Procurando sua localização…");
  navigator.geolocation.getCurrentPosition(p => setHome(L.latLng(p.coords.latitude, p.coords.longitude), true),
    () => toast("Não deu para pegar sua localização. Libere o acesso ou busque o endereço."), {enableHighAccuracy:true, timeout:12000});
};

/* resumo ao redor */
const STATS = [["escola","Escolas"],["farmacia","Farmácias"],["mercado","Mercados"],["onibus","Pontos de ônibus"],
  ["academia","Academias"],["saude","Saúde"],["cafe","Cafés"],["parque","Praças"]];
const NEAREST = [
  ["Melhor escola (destaque)", r=>r.hl && (r.cat==="escola"||r.cat==="tecnico")],
  ["Escola pública", r=>r.cat==="escola" && ["Municipal","Estadual","Federal"].includes(r.sub)],
  ["Escola particular", r=>r.cat==="escola" && /Particular|Bilíngue/.test(r.sub)],
  ["Creche", r=>r.cat==="escola" && /creche|infantil|^ji\b|jardim/i.test(r.name)],
  ["Universidade / faculdade", r=>r.cat==="universidade"],
  ["Hospital", r=>r.cat==="hospital"], ["UPA 24h", r=>r.cat==="upa"], ["Posto de saúde", r=>r.cat==="ubs"],
  ["Clínica médica", r=>r.cat==="clinica"], ["Dentista", r=>r.cat==="odonto"], ["Farmácia", r=>r.cat==="farmacia"],
  ["Supermercado", r=>r.cat==="mercado" && r.sub==="Supermercado"], ["Atacarejo", r=>r.cat==="mercado" && r.sub==="Atacarejo"],
  ["Padaria", r=>r.cat==="padaria"], ["Ponto de ônibus", r=>r.cat==="onibus"], ["Shopping", r=>r.cat==="shopping"],
  ["Academia", r=>r.cat==="academia"], ["Cafeteria", r=>r.cat==="cafe"], ["Parque ou praça", r=>r.cat==="parque"],
  ["Banco", r=>r.cat==="banco"], ["Delegacia / polícia", r=>r.cat==="seguranca"],
];
function poolAround(){
  const {lat, lng} = home.getLatLng();
  let pool;
  if (LIVE && liveState==="ok"){
    pool = LIVE.items.slice();
    // fora do raio consultado, usa a base semanal (para o "mais perto" quando não há nada no raio)
    for (const r of STATIC) if (dist(LIVE.lat,LIVE.lon,r.lat,r.lon) > LIVE.r) pool.push(r);
  } else pool = STATIC.slice();
  return pool.map(r => [r, dist(lat, lng, r.lat, r.lon)]);
}
function updateNear(){
  const box = $("#p-near"); box.innerHTML = "";
  if (!home){
    box.innerHTML = `<div class="empty"><b>Escolha o imóvel no mapa</b>
      <p class="hint">Toque no mapa onde fica a casa ou apartamento, busque o endereço lá em cima ou use sua localização. Eu consulto na hora o que existe de verdade num raio ao redor: escolas, saúde, mercados, farmácias, ônibus e mais.</p>
      <div class="rowbtns"><button class="btn" id="e-search">Buscar endereço</button><button class="btn sec" id="e-loc">Usar minha localização</button></div></div>`;
    $("#e-search").onclick = () => { if (!isDesk()) setSheet("peek"); q.focus(); };
    $("#e-loc").onclick = () => $("#locate").click();
    compareTable(box);
    return;
  }
  const {lat, lng} = home.getLatLng();
  const bairro = nearestBairro(lat, lng);
  const status = liveState==="loading" ? `<span class="wait"></span>Consultando o OpenStreetMap agora…`
    : liveState==="ok" ? `<span class="live"></span>Dados ao vivo de ${LIVE.at.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · ${LIVE.items.length} lugares no raio`
    : liveState==="error" ? `<span class="off"></span>Consulta ao vivo indisponível agora; mostrando a base semanal (${esc(DATAINFO.updated)}). <button class="ghost" id="retry">Tentar de novo</button>`
    : "";
  box.insertAdjacentHTML("beforeend", `<div><div class="addr">Perto de ${esc(bairro||"este ponto")}</div>
    <div class="status">${status}</div></div>
    <div class="rad"><label for="rad">Raio</label><input type="range" id="rad" min="300" max="3000" step="100" value="${radius}"><b id="radv">${fmtD(radius)}</b></div>`);
  $("#retry")?.addEventListener("click", fetchLive);
  const rad = $("#rad");
  rad.oninput = () => { radius=+rad.value; circle.setRadius(radius); $("#radv").textContent = fmtD(radius); };
  rad.onchange = () => { writeHash(); scheduleLive(); };

  if (liveState==="loading"){ box.insertAdjacentHTML("beforeend", `<p class="hint">Buscando o que existe hoje ao redor…</p>`); actions(box); return; }
  const pool = poolAround();
  const within = pool.filter(x => x[1] <= radius);
  const cnt = {}; for (const [r] of within){ cnt[r.cat]=(cnt[r.cat]||0)+1; if (["hospital","upa","ubs","clinica","odonto","lab"].includes(r.cat)) cnt.saude=(cnt.saude||0)+1; }
  const stats = document.createElement("div"); stats.className="stats";
  for (const [c, l] of STATS){
    const n = cnt[c]||0, el = document.createElement("button"); el.type="button"; el.className="stat"+(n?"":" zero");
    el.innerHTML = `<b>${n}</b><span>${l}</span>`;
    el.onclick = () => { const det = box.querySelector(`details[data-c="${c==="saude"?"hospital":c}"]`) || box.querySelector(`details[data-g="${c}"]`); if (det){ det.open=true; det.scrollIntoView({behavior:"smooth",block:"start"}); } };
    stats.appendChild(el);
  }
  box.insertAdjacentHTML("beforeend", `<div class="lbl">No raio de ${fmtD(radius)}</div>`); box.appendChild(stats);
  if (liveState==="ok" && within.length===0) box.insertAdjacentHTML("beforeend", `<p class="note">Nada mapeado no OpenStreetMap dentro do raio. Aumente o raio ou confira no Street View: algumas áreas ainda estão pouco mapeadas.</p>`);

  box.insertAdjacentHTML("beforeend", `<div class="lbl">Mais perto do imóvel</div>`);
  const list = document.createElement("div"); list.className="list";
  for (const [label, f] of NEAREST){
    let best = null; for (const x of pool) if (f(x[0]) && (!best || x[1]<best[1])) best = x;
    if (!best) continue;
    const [r, d] = best, outside = d > radius;
    list.appendChild(itemRow(r, `${fmtD(d)}<small>${walk(d)}</small>`, label + (outside && liveState==="ok" ? " · fora do raio (base semanal)" : "")));
  }
  box.appendChild(list);

  // tudo que existe no raio, por categoria
  const byCat = {}; for (const x of within) (byCat[x[0].cat] ||= []).push(x);
  const order = GROUPS.flatMap(g=>g[1]).filter(c=>byCat[c]);
  if (order.length){
    box.insertAdjacentHTML("beforeend", `<div class="lbl">Tudo no raio (${within.length})</div>`);
    for (const c of order){
      const arr = byCat[c].sort((a,b)=>a[1]-b[1]);
      const det = document.createElement("details"); det.className="cat"; det.dataset.c=c;
      if (c==="hospital") det.dataset.g="saude";
      det.innerHTML = `<summary><span class="dot" style="background:${CAT[c].c||SUBC[c+"|"+arr[0][0].sub]||"#999"}"></span>${CAT[c].l.replace(" (ao vivo)","")}<span class="n">${arr.length}</span></summary><div class="list"></div>`;
      const l = det.querySelector(".list");
      det.addEventListener("toggle", () => { if (det.open && !l.childElementCount) for (const [r,d] of arr.slice(0,80)) l.appendChild(itemRow(r, fmtD(d))); }, {once:false});
      box.appendChild(det);
    }
  }
  actions(box);
}
function actions(box){
  const row = document.createElement("div"); row.className="rowbtns";
  row.innerHTML = `<button class="btn" id="share"><svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Compartilhar este ponto</button>
    <a class="btn sec" target="_blank" rel="noopener" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${home.getLatLng().lat},${home.getLatLng().lng}">Street View</a>
    <button class="btn sec" id="savehome">Salvar para comparar</button>
    <button class="btn sec" id="clearhome">Limpar</button>`;
  box.appendChild(row);
  $("#clearhome").onclick = clearHome;
  $("#savehome").onclick = () => {
    const {lat, lng} = home.getLatLng();
    const name = prompt("Nome deste imóvel (ex.: Apê Renascença R$ 1.800):", "Imóvel em "+(nearestBairro(lat,lng)||"São Luís"));
    if (name === null) return;
    SAVED.push({lat:+lat.toFixed(5), lon:+lng.toFixed(5), name:name.trim()||"Imóvel "+(SAVED.length+1)});
    if (SAVED.length > 6) SAVED.shift();
    storeSaved(); updateNear(); toast("Salvo. Veja a comparação no fim desta aba.");
  };
  compareTable(box);
  $("#share").onclick = async () => {
    const url = location.href; const data = {title:"Vizinhança SLZ", text:"Olha o que tem perto deste imóvel em São Luís:", url};
    try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
    try { await navigator.clipboard.writeText(url); toast("Link copiado. É só colar no WhatsApp."); } catch { prompt("Copie o link:", url); }
  };
}

/* comparar imóveis salvos (fica guardado só neste aparelho) */
let SAVED = [];
try { SAVED = JSON.parse(localStorage.getItem("vz_saved")||"[]"); } catch { SAVED = []; }
function storeSaved(){ try { localStorage.setItem("vz_saved", JSON.stringify(SAVED)); } catch {} }
function compareTable(box){
  if (!SAVED.length) return;
  const R = 1000;
  const rows = [
    ["Escolas até 1 km", s => s.cnt("escola")], ["Destaques (escolas) até 1 km", s => s.cnt(null, r=>r.hl&&r.cat!=="universidade")],
    ["Farmácias até 1 km", s => s.cnt("farmacia")], ["Mercados até 1 km", s => s.cnt("mercado")],
    ["Saúde até 1 km", s => s.cnt(null, r=>["hospital","upa","ubs","clinica","odonto","lab"].includes(r.cat))],
    ["Academias até 1 km", s => s.cnt("academia")],
    ["Melhor escola mais perto", s => s.near(r=>r.hl&&(r.cat==="escola"||r.cat==="tecnico"))],
    ["Universidade mais perto", s => s.near(r=>r.cat==="universidade")],
    ["Hospital mais perto", s => s.near(r=>r.cat==="hospital")], ["UPA mais perto", s => s.near(r=>r.cat==="upa")],
    ["Supermercado mais perto", s => s.near(r=>r.cat==="mercado")], ["Shopping mais perto", s => s.near(r=>r.cat==="shopping")],
  ];
  const cols = SAVED.map(p => { const ds = STATIC.map(r=>[r, dist(p.lat,p.lon,r.lat,r.lon)]);
    return { cnt:(c,f)=>ds.filter(([r,d])=>d<=R && (c? r.cat===c : f(r))).length,
             near:f=>{ let b=null; for (const x of ds) if (f(x[0])&&(!b||x[1]<b[1])) b=x; return b?b[1]:Infinity; } }; });
  let html = `<div class="lbl">Comparar imóveis salvos</div><div class="cmpwrap"><table class="cmp"><thead><tr><th></th>${SAVED.map((p,i)=>`<th><button class="cmpgo" data-i="${i}">${esc(p.name)}</button><button class="cmpdel" data-i="${i}" aria-label="Remover">&times;</button></th>`).join("")}</tr></thead><tbody>`;
  for (const [label, f] of rows){
    const vals = cols.map(f), isDist = label.includes("mais perto");
    const best = isDist ? Math.min(...vals) : Math.max(...vals);
    html += `<tr><th>${label}</th>${vals.map(v=>`<td class="${v===best&&SAVED.length>1&&isFinite(v)?"best":""}">${isDist?(isFinite(v)?fmtD(v):"–"):v}</td>`).join("")}</tr>`;
  }
  html += `</tbody></table></div><p class="hint" style="font-size:12.5px">Comparação com a base semanal. Em verde, o melhor de cada linha. Os imóveis ficam salvos só neste aparelho.</p>`;
  box.insertAdjacentHTML("beforeend", html);
  box.querySelectorAll(".cmpgo").forEach(b => b.onclick = () => { const p=SAVED[+b.dataset.i]; setHome(L.latLng(p.lat,p.lon), true); });
  box.querySelectorAll(".cmpdel").forEach(b => b.onclick = () => { SAVED.splice(+b.dataset.i,1); storeSaved(); updateNear(); });
}

/* link compartilhável: #p=lat,lon,raio */
function writeHash(){
  const h = home ? `#p=${home.getLatLng().lat.toFixed(5)},${home.getLatLng().lng.toFixed(5)},${radius}` : " ";
  history.replaceState(null, "", h.trim() ? h : location.pathname + location.search);
}
function readHash(){
  const m = location.hash.match(/p=(-?[\d.]+),(-?[\d.]+)(?:,(\d+))?/);
  if (!m) return false;
  radius = Math.min(3000, Math.max(300, +(m[3]||1000)));
  setHome(L.latLng(+m[1], +m[2]), false); map.setView([+m[1], +m[2]], 15);
  return true;
}

/* destaques */
function buildBest(){
  const box = $("#best"); box.innerHTML = "";
  const seen = new Set();
  const recs = STATIC.filter(r=>r.hl).sort((a,b)=>{ const o=["universidade","escola","tecnico"]; return o.indexOf(a.cat)-o.indexOf(b.cat) || a.hl.rank-b.hl.rank || a.name.localeCompare(b.name); });
  let last = "";
  for (const r of recs){
    const k = norm(r.name); if (seen.has(k)) continue; seen.add(k);
    const sec = r.cat==="universidade" ? "Universidades" : "Escolas";
    if (sec!==last){ box.insertAdjacentHTML("beforeend", `<div class="lbl" style="margin:12px 0 4px">${sec}</div>`); last=sec; }
    box.appendChild(itemRow(r, "", r.hl.why));
  }
}

/* ======================= início ======================= */
let DATAINFO = {updated:""};
(async function init(){
  buildChips(); setSheet(isDesk() ? "half" : "peek"); updateNear();
  try {
    const [p, b] = await Promise.all([fetch("data/pois.json",{cache:"no-cache"}).then(r=>r.json()), fetch("data/bairros.json",{cache:"no-cache"}).then(r=>r.json())]);
    BAIRROS = b;
    const d = p.updated; DATAINFO.updated = d ? d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4) : "";
    STATIC = p.items.map(([id, lat, lon, t]) => { if (!t._b) t._b = nearestBairro(lat, lon); return makeRec(id, lat, lon, t, false); }).filter(Boolean);
    IDX = STATIC.map(r => norm(r.name+" "+r.bairro+" "+r.sub+" "+CAT[r.cat].l));
    $("#datainfo").textContent = `${STATIC.length.toLocaleString("pt-BR")} lugares reais na Ilha · base de ${DATAINFO.updated} + consulta ao vivo`;
  } catch (e){
    $("#datainfo").textContent = "Não carreguei a base. Toque no mapa para consultar ao vivo.";
  }
  buildCounts(); defaults(); buildFilters(); buildBest(); syncBoxes();
  if (!readHash()) render();
  updateNear();
})();
