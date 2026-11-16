/* =========================================================
   Tempo · eigen schema
   Toont een ingelezen trainingsschema per week en per training,
   met stappen, doelzones, uitleg en wat je werkelijk deed.
   Dit bestand bevat zelf geen persoonlijke gegevens: het schema
   komt uit een bestand dat je importeert en blijft op je toestel.

   Schemabestand: { kern:'tempo-plan', v:1, name, race, settings, zones, phases, rules, alerts, fuel, about,
     weeks:[{ n, start:'JJJJ-MM-DD' (maandag), phase, light, km, note, days:[ [training, …] × 7 (ma t/m zo) ] }] }
   Training: { sport:'run'|'bike'|'strength'|'rest', kind, cls, title, short, km, min,
     steps:[{ l:label, t:tekst, z:loopzone, bz:fietszone, tgt:doel }], why, notes:[…], zones:[…], ex:[[oefening, sets, waarom]] }
   ========================================================= */
(function(){
const DAY=864e5,DAYN=['maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag','zondag'],DOWS=['ma','di','wo','do','vr','za','zo'];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nl=x=>String(x).replace('.',',');
const dkey=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const pd=k=>new Date(k+'T00:00');
// intensiteit als kleur: laag = groen, drempel = oranje, hoog = rood (zelfde schaal als de rest van Tempo)
const ZC={Z1:'var(--c-peak)',Z2:'var(--c-peak)',MP:'var(--c-mid)',Z4:'var(--c-mid)',Z5:'var(--c-warn)',S:'var(--c-warn)',SST:'var(--c-mid)',Sprint:'var(--c-warn)'};
const SPORT={run:'Lopen',bike:'Fietsen',strength:'Kracht',rest:'Rust'};
const CLS_ORDER=['race','long','hard','easy','rest'];

function valid(p){return !!(p&&p.kern==='tempo-plan'&&Array.isArray(p.weeks)&&p.weeks.length&&p.weeks.every(w=>w.start&&Array.isArray(w.days)&&w.days.length===7))}
function locate(p,date){const t=pd(dkey(date));
  for(let i=0;i<p.weeks.length;i++){const w=p.weeks[i],n=Math.round((t-pd(w.start))/DAY);if(n>=0&&n<7)return{wi:i,w,dow:n,items:w.days[n]||[]}}
  return null}
function weekIndex(p,date=new Date()){const t=pd(dkey(date));if(t<pd(p.weeks[0].start))return -1;const l=locate(p,date);return l?l.wi:p.weeks.length}
function dayCls(items){const c=items.map(x=>x.cls).filter(Boolean);for(const k of CLS_ORDER)if(c.includes(k))return k;return'rest'}
function main(items){return items.find(x=>x.sport==='run')||items.find(x=>x.sport==='bike')||items[0]}
function dateOf(w,dow){const d=pd(w.start);d.setDate(d.getDate()+dow);return d}

function target(p,s){const out=[];
  if(s.z&&p.zones&&p.zones.run&&p.zones.run[s.z]){const z=p.zones.run[s.z];
    if(s.tgt)out.push(esc(s.tgt));
    if(!s.tgt||s.z==='Z1'||s.z==='Z2'||s.z==='MP'){if(z.hr&&z.hr!=='n.v.t.')out.push(esc(z.hr));if(!s.tgt&&z.pace)out.push(esc(z.pace))}}
  else if(s.bz&&p.zones&&p.zones.bike&&p.zones.bike[s.bz]){const z=p.zones.bike[s.bz];out.push(esc(s.tgt||z.w))}
  else if(s.tgt)out.push(esc(s.tgt));
  return out.join(' · ')}
function zoneChip(s){const z=s.z||s.bz;return z?`<span class="chip" style="color:${ZC[z]||'var(--text)'}">${esc(z)}</span>`:''}

/* één training als onderscherm */
function sessionHTML(p,w,dow,idx,acts){const x=w.days[dow][idx],d=dateOf(w,dow);
  const chips=[SPORT[x.sport]||'',x.km?nl(x.km)+' km':'',x.min?x.min+' min':'',x.kind==='easy'||x.kind==='long'?(x.km?'≈ '+Math.round(x.km*5.5)+' min':''):'',w.light?'lichte week':''].filter(Boolean);
  let h=`<h2>${esc(x.title)}</h2><div class="muted" style="margin-bottom:10px">${DAYN[dow]} ${d.toLocaleDateString('nl-NL',{day:'numeric',month:'long'})} · week ${w.n} · ${esc(w.phase)}</div>
    <div class="pills" style="margin-bottom:6px">${chips.map(c=>`<span class="chip">${esc(c)}</span>`).join('')}</div>`;
  if(x.steps&&x.steps.length){h+=`<h3>Wat er van je verwacht wordt</h3><div class="list" style="background:var(--card-2)">`+x.steps.map(s=>{const tg=target(p,s);
      return `<div class="item plain" style="align-items:flex-start"><div class="meta"><div class="ds" style="margin:0 0 2px;font-weight:600;color:var(--text-2)">${esc(s.l)}</div><div class="nm" style="white-space:normal;font-size:17px">${esc(s.t)}</div>${tg?`<div class="ds" style="white-space:normal">${tg}</div>`:''}</div>${zoneChip(s)}</div>`}).join('')+`</div>`}
  else if(x.short)h+=`<p>${esc(x.short)}</p>`;
  if(x.ex&&x.ex.length)h+=`<h3>Oefeningen</h3><div class="list" style="background:var(--card-2)">`+x.ex.map(e=>`<div class="item plain" style="align-items:flex-start"><div class="meta"><div class="nm" style="white-space:normal;font-size:17px">${esc(e[0])}</div><div class="ds" style="white-space:normal">${esc(e[2]||'')}</div></div><b style="text-align:right;max-width:45%">${esc(e[1])}</b></div>`).join('')+`</div>`;
  const zs=[...new Set((x.zones||[]).concat((x.steps||[]).map(s=>s.z).filter(Boolean)))].filter(z=>p.zones&&p.zones.run&&p.zones.run[z]);
  if(zs.length)h+=`<h3>Zones</h3>`+zs.map(z=>{const r=p.zones.run[z];return `<div class="row"><span><b style="color:${ZC[z]||''}">${esc(z)}</b> ${esc(r.n)}<br><span class="muted" style="font-size:14px">${esc(r.feel||'')}</span></span><b style="text-align:right">${esc(r.hr)}<br><span class="muted" style="font-weight:500;font-size:14px">${esc(r.pace)}</span></b></div>`}).join('');
  const bzs=[...new Set((x.steps||[]).map(s=>s.bz).filter(Boolean))].filter(z=>p.zones&&p.zones.bike&&p.zones.bike[z]);
  if(bzs.length)h+=`<h3>Fietszones</h3>`+bzs.map(z=>{const r=p.zones.bike[z];return `<div class="row"><span><b style="color:${ZC[z]||''}">${esc(z)}</b> ${esc(r.n)}</span><b>${esc(r.w)} <span class="muted" style="font-weight:500;font-size:14px">${esc(r.pct||'')}</span></b></div>`}).join('');
  if(x.why)h+=`<h3>Waarom</h3><p>${esc(x.why)}</p>`;
  if(x.notes&&x.notes.length)h+=`<h3>Let op</h3><ul>${x.notes.filter(Boolean).map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
  if(w.note&&dow===0)h+=`<div class="hint">${esc(w.note)}</div>`;
  if(acts)h+=doneHTML(x,acts);
  return h}

/* wat je die dag werkelijk deed, naast wat er gepland stond */
function doneHTML(x,acts){if(x.sport!=='run'&&x.sport!=='bike')return'';
  const mine=acts.filter(a=>x.sport==='run'?/Run/.test(a.sport):/Ride/.test(a.sport));
  if(!mine.length)return'';
  const easyOnly=(x.steps||[]).length&&(x.steps||[]).every(s=>!s.z||s.z==='Z1'||s.z==='Z2'||s.z==='S');
  const cap=(x.steps||[]).every(s=>!s.z||s.z==='Z1'||s.z==='S')?135:152;
  return `<h3>Gedaan</h3>`+mine.map(a=>{const km=a.dist/1000,checks=[];
    if(x.km&&km){const r=km/x.km;checks.push(r>=.85&&r<=1.15?['var(--c-peak)',`${nl(km.toFixed(1))} van ${nl(x.km)} km`]:['var(--c-mid)',`${nl(km.toFixed(1))} km, gepland ${nl(x.km)}`])}
    if(x.sport==='run'&&easyOnly&&a.hr)checks.push(a.hr<=cap?['var(--c-peak)',`gem. ${Math.round(a.hr)} bpm, binnen de zone`]:['var(--c-mid)',`gem. ${Math.round(a.hr)} bpm, boven ${cap}`]);
    if(x.sport==='bike'&&a.watts)checks.push(['var(--text-2)',`gem. ${Math.round(a.watts)} W`]);
    const pace=x.sport==='run'&&a.dist?`${Math.floor(a.time/km/60)}:${String(Math.round(a.time/km%60)).padStart(2,'0')}/km`:'';
    return `<div class="row"><span>${esc(a.name)}<br><span class="muted" style="font-size:14px">${[pace,a.hr?Math.round(a.hr)+' bpm':''].filter(Boolean).join(' · ')}</span></span><b style="text-align:right">${checks.map(c=>`<span style="color:${c[0]}">${esc(c[1])}</span>`).join('<br>')||'✓'}</b></div>`}).join('')}

/* algemene schermen: doelen, zones, spelregels, racedag */
function goalsHTML(p){const r=p.race||{};let h=`<h2>${esc(p.name||'Schema')}</h2><p>${esc(r.name||'')}${r.date?' · '+pd(r.date).toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'}):''}</p>`;
  if(r.goals)h+=`<h3>Doelen</h3>`+r.goals.map(g=>`<div class="row"><span><b>${esc(g[0])}</b> ${esc(g[1])}<br><span class="muted" style="font-size:14px">${esc(g[3])}</span></span><b>${esc(g[2])}</b></div>`).join('');
  if(p.phases)h+=`<h3>Fasen</h3>`+p.phases.map(f=>`<div class="row"><span><b>${esc(f[0])}</b><br><span class="muted" style="font-size:14px">${esc(f[3])}</span></span><b>week ${f[1]}${f[2]!==f[1]?'–'+f[2]:''}</b></div>`).join('');
  if(p.about)h+=`<h3>Opbouw van de week</h3>`+p.about.map(a=>`<p>${esc(a)}</p>`).join('');
  return h}
function zonesHTML(p){const z=p.zones||{};let h=`<h2>Zones</h2>${z.note?`<p>${esc(z.note)}</p>`:''}`;
  if(z.run)h+=`<h3>Lopen</h3>`+Object.entries(z.run).map(([k,r])=>`<div class="row"><span><b style="color:${ZC[k]||''}">${esc(k)}</b> ${esc(r.n)}<br><span class="muted" style="font-size:14px">${esc(r.feel||'')}</span></span><b style="text-align:right">${esc(r.hr)}<br><span class="muted" style="font-weight:500;font-size:14px">${esc(r.pace)}</span></b></div>`).join('');
  if(z.bike)h+=`<h3>Fietsen</h3>`+Object.entries(z.bike).map(([k,r])=>`<div class="row"><span><b style="color:${ZC[k]||''}">${esc(k)}</b> ${esc(r.n)}</span><b>${esc(r.w)} <span class="muted" style="font-weight:500;font-size:14px">${esc(r.pct||'')}</span></b></div>`).join('');
  return h}
function rulesHTML(p){return `<h2>Spelregels</h2>`+(p.rules||[]).map(r=>`<h3>${esc(r[0])}</h3><p>${esc(r[1])}</p>`).join('')}
function raceHTML(p){const r=p.race||{};let h=`<h2>Racedag en voeding</h2>${r.plan?`<p>${esc(r.plan)}</p>`:''}`;
  if(r.splits)h+=`<h3>Doorkomsttijden</h3>`+r.splits.map(s=>`<div class="row"><span>${esc(s[0])}</span><b class="num">${esc(s[1])}</b></div>`).join('');
  if(p.fuel)h+=`<h3>Voeding</h3><ul>${p.fuel.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`;
  return h}

/* signaal uit de ochtendcheck: rusthartslag een paar dagen achter elkaar te hoog */
function rhrAlert(p,date=new Date()){const a=p.alerts;if(!a||!a.rhrAbove)return null;
  let days={};try{days=(JSON.parse(localStorage.getItem('kern.check.v1'))||{}).days||{}}catch(e){}
  const n=a.days||2,vals=[];for(let i=0;i<n;i++){const d=new Date(date);d.setDate(d.getDate()-i);const v=days[dkey(d)];vals.push(v&&!v.demo?v.rhr:0)}
  return vals.every(v=>v>=a.rhrAbove)?{n,lim:a.rhrAbove,vals}:null}

window.TP={valid,locate,weekIndex,dayCls,main,dateOf,sessionHTML,goalsHTML,zonesHTML,rulesHTML,raceHTML,rhrAlert,DOWS,ZC,SPORT};
})();
