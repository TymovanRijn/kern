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

/* ---------- sheet / toast ---------- */
function openSheet(h){$('#sheet-body').innerHTML=h;$('#sheet').scrollTop=0;$('#sheet').classList.add('on');$('#scrim').classList.add('on')}
function closeSheet(){$('#sheet').classList.remove('on');$('#scrim').classList.remove('on')}
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

window.K={ROOT,DAY,$,$$,esc,dkey,today0,addDays,pd,DOW,nl,eur,fmtDate,relDay,uid,mean,sd,rng,load,save,feed,profile,saveProfile,
  openSheet,closeSheet,toast,ringSVG,info,tabs,segmented,chrome,exportAll,importAll,wipeAll};
})();
