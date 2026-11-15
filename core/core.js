/* =========================================================
   Kern — gedeelde laag voor alle onderdelen.
   - Opslag: elk onderdeel bewaart zijn eigen staat onder kern.<naam>.v1
   - Feeds: elk onderdeel publiceert een korte samenvatting onder
     kern.feed.<naam>, die de andere onderdelen mogen lezen.
     Zo zijn de onderdelen verbonden zonder elkaars code te kennen.
   - UI: sheet, toast, ring, Kern-knop, back-up.
   ========================================================= */
(()=>{
const ROOT=new URL('..',document.currentScript.src).href;
const DAY=864e5;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dkey=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const today0=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const pd=k=>new Date(k+'T00:00');
const DOW=['zo','ma','di','wo','do','vr','za'];
const nl=(x,dec)=>(dec==null?String(x):Number(x).toFixed(dec)).replace('.',',');
const eur=(x,dec=0)=>'€ '+Number(x).toLocaleString('nl-NL',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const fmtDate=(d,o={day:'numeric',month:'short'})=>new Date(d).toLocaleDateString('nl-NL',o);
const relDay=d=>{const n=Math.round((today0()-pd(dkey(d)))/DAY);return n===0?'vandaag':n===1?'gisteren':n===-1?'morgen':n>0&&n<7?`${n} dgn geleden`:fmtDate(d)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1))};
// reproduceerbare willekeur voor demodata
const rng=seed=>()=>(seed=(seed*16807)%2147483647)/2147483647;

/* ---------- opslag ---------- */
function load(key,def){
  try{const s=JSON.parse(localStorage.getItem(key));if(s&&typeof s==='object')return{...structuredClone(def),...s}}catch(e){}
  return structuredClone(def)}
function save(key,val){try{localStorage.setItem(key,JSON.stringify(val));return true}catch(e){return false}}
const feed={
  get(n){try{return JSON.parse(localStorage.getItem('kern.feed.'+n))}catch(e){return null}},
  set(n,o){save('kern.feed.'+n,{...o,updated:Date.now()})}
};
const PROFILE_KEY='kern.profile.v1';
const profile=()=>load(PROFILE_KEY,{weight:70});
const saveProfile=p=>save(PROFILE_KEY,p);
/* ---------- ochtendmeting: vast ademtempo en overzetcode (gedeeld door Vandaag en Hart) ---------- */
const PACES=[0,6,8,10];                                   // 0 = eigen tempo, anders ademhalingen per minuut
const pace=()=>{const v=profile().pace;return PACES.includes(v)?v:0};
const setPace=v=>{const p=profile();p.pace=v;saveProfile(p)};
const paceLabel=v=>v?`${v} per minuut`:'eigen tempo';
const hrvCode=(k,hrv,rhr,pc)=>`KERN-HRV;${k};${hrv};${rhr};${pc}`;
function parseHrvCode(t){const m=String(t).trim().match(/^KERN-HRV;(\d{4}-\d{2}-\d{2});(\d{1,3});(\d{2,3})(?:;(\d{1,2}))?$/);
  if(!m||isNaN(new Date(m[1]+'T00:00')))return null;const hrv=+m[2],rhr=+m[3],pc=m[4]==null?null:+m[4];
  return hrv>=5&&hrv<=300&&rhr>=25&&rhr<=130&&(pc==null||PACES.includes(pc))?{k:m[1],hrv,rhr,pace:pc}:null}

/* ---------- sheet / toast ---------- */
function openSheet(h){$('#sheet-body').innerHTML=h;$('#sheet').scrollTop=0;$('#sheet').classList.add('on');$('#scrim').classList.add('on');document.documentElement.classList.add('sheet-open')}
function closeSheet(){const sh=$('#sheet');sh.classList.remove('on','dragging');$('#scrim').classList.remove('on','dragging');sh.style.transform='';$('#scrim').style.opacity='';document.documentElement.classList.remove('sheet-open')}

/* Scherm vegen: een open scherm beweegt mee met je vinger en sluit als je naar beneden veegt.
   De pagina erachter scrolt nooit mee. Scrollen binnen het scherm blijft gewoon werken. */
function sheetGestures(){
  const sh=$('#sheet'),sc=$('#scrim');
  let y0=0,lastY=0,lastT=0,v=0,drag=false,dragY0=0;
  const isOpen=()=>sh.classList.contains('on');
  document.addEventListener('touchstart',e=>{if(!isOpen())return;const t=e.touches[0];y0=lastY=t.clientY;lastT=e.timeStamp;v=0;drag=false},{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!isOpen())return;
    const y=e.touches[0].clientY,d=y-lastY,dt=e.timeStamp-lastT;lastY=y;lastT=e.timeStamp;if(dt>0)v=d/dt;
    if(!sh.contains(e.target)){e.preventDefault();if(y-y0>40)closeSheet();return}     // buiten het scherm: pagina blijft staan
    if(drag){e.preventDefault();const off=Math.max(0,y-dragY0);sh.style.transform=`translateY(${off}px)`;sc.style.opacity=String(Math.max(0,1-off/sh.offsetHeight));return}
    const atTop=sh.scrollTop<=0,atBottom=sh.scrollTop+sh.clientHeight>=sh.scrollHeight-1;
    if(d>0&&atTop){drag=true;dragY0=y-d;sh.classList.add('dragging');sc.classList.add('dragging');e.preventDefault();return}  // naar beneden vegen bovenaan: sleep mee
    if(d>0)return;                      // omhoog scrollen in het scherm
    if(d<0&&!atBottom)return;           // omlaag scrollen in het scherm
    e.preventDefault();                 // einde van de inhoud: niet doorgeven aan de pagina
  },{passive:false});
  const end=()=>{if(!drag)return;drag=false;
    const off=parseFloat((sh.style.transform.match(/-?[\d.]+/)||[0])[0])||0;
    sh.classList.remove('dragging');sc.classList.remove('dragging');sh.style.transform='';sc.style.opacity='';
    if(off>110||v>.6)closeSheet()};
  document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}

function ringSVG(pct,color,size=76){const r=size/2-3,c=2*Math.PI*r;
  return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#2c2c2e" stroke-width="5" fill="none"/><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${c*Math.max(.04,Math.min(1,pct||0))} ${c}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`}

// Uitleg-sheets: INFO = {sleutel:{t:titel,s:ondertitel,b:html}}; elk element met data-info opent de sheet.
function info(INFO){document.addEventListener('click',e=>{const b=e.target.closest('[data-info]');if(!b)return;const v=INFO[b.dataset.info];if(v){e.preventDefault();e.stopPropagation();openSheet(`<h2>${v.t}</h2>${v.b}`)}},true)}

// Tabbar: knoppen met data-tab wisselen tussen <section class="view" id="v-…">
function tabs(onShow){$$('.tabbar button').forEach(b=>b.onclick=()=>{$$('.tabbar button').forEach(x=>x.classList.toggle('on',x===b));$$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+b.dataset.tab));scrollTo(0,0);onShow&&onShow(b.dataset.tab)})}
function segmented(el,cb){$$('button',el).forEach(b=>b.onclick=()=>{$$('button',el).forEach(x=>x.classList.toggle('on',x===b));cb(b.dataset.v??b.dataset.f)})}

const GRID='<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2"/></svg>';
function chrome(app){
  if(!$('#sheet'))document.body.insertAdjacentHTML('beforeend','<div class="scrim" id="scrim"></div><div class="sheet" id="sheet"><div class="grab"></div><div id="sheet-body"></div></div><div class="toast" id="toast"></div>');
  $('#scrim').onclick=closeSheet;
  if(!window.__sheetG){window.__sheetG=1;sheetGestures()}
  addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
  if(app!=='hub')$$('.top').forEach(t=>t.insertAdjacentHTML('afterbegin',`<a class="hub" href="${ROOT}" aria-label="Terug naar Kern">${GRID}<span>Kern</span></a>`));
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register(ROOT+'sw.js',{scope:ROOT}).catch(()=>{});
}

/* ---------- back-up van alle onderdelen ---------- */
const isOurs=k=>k.startsWith('kern.')&&!k.startsWith('kern.feed.');
function collect(){
  const out={kern:1,made:new Date().toISOString(),data:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!isOurs(k))continue;
    try{let v=JSON.parse(localStorage.getItem(k));
      // inloggegevens van koppelingen gaan nooit mee in een back-up
      if(v&&v.strava)v={...v,strava:{clientId:v.strava.clientId}};
      out.data[k]=v}catch(e){}}
  return out}
async function exportAll(){
  const name=`kern-backup-${dkey(new Date())}.json`,text=JSON.stringify(collect());
  const file=new File([text],name,{type:'application/json'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return}}catch(e){if(e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;a.click();toast('Back-up opgeslagen')}
function importAll(text){
  const j=JSON.parse(text);if(!j||!j.kern||!j.data)throw new Error('geen Kern-back-up');
  let n=0;for(const[k,v]of Object.entries(j.data)){if(!isOurs(k))continue;
    let val=v;if(v&&v.strava){let cur={};try{cur=JSON.parse(localStorage.getItem(k))?.strava||{}}catch(e){}val={...v,strava:{...v.strava,...cur}}}
    save(k,val);n++}
  return n}
function wipeAll(){const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('kern.'))ks.push(k)}ks.forEach(k=>localStorage.removeItem(k))}

window.K={PACES,pace,setPace,paceLabel,hrvCode,parseHrvCode,ROOT,DAY,$,$$,esc,dkey,today0,addDays,pd,DOW,nl,eur,fmtDate,relDay,uid,mean,sd,rng,load,save,feed,profile,saveProfile,
  openSheet,closeSheet,toast,ringSVG,info,tabs,segmented,chrome,exportAll,importAll,wipeAll};
})();
