/* =========================================================
   Kern · Hart — Polar H10 via Web Bluetooth, proefsignaal en HRV-analyse.
   Werkt in Chrome en Edge (laptop, Android) en in Bluefy (iPhone).
   Safari en Firefox ondersteunen geen Web Bluetooth.

   Twee datastromen van de band:
   1. Heart Rate Service (standaard): hartslag + RR-intervallen (tijd tussen slagen, 1/1024 s)
   2. Polar Measurement Data (PMD): ruw ECG, 130 samples per seconde, in microvolt
   Er gaat niets naar een server; alles wordt in de browser berekend.
   ========================================================= */
(function(root){
'use strict';
const PMD_S='fb005c80-02e7-f387-1cad-8acd2d8df0c8';
const PMD_CP='fb005c81-02e7-f387-1cad-8acd2d8df0c8';
const PMD_DATA='fb005c82-02e7-f387-1cad-8acd2d8df0c8';
const ECG_FS=130;
const ECG_START=[0x02,0x00,0x00,0x01,0x82,0x00,0x01,0x01,0x0E,0x00]; // start ECG, 130 Hz (0x82), 14 bit (0x0E)
const ECG_STOP=[0x03,0x00];

/* ---------- parsers ---------- */
function parseHR(dv){const f=dv.getUint8(0);let i=1;const wide=f&1;
  const hr=wide?dv.getUint16(i,true):dv.getUint8(i);i+=wide?2:1;if(f&8)i+=2;
  const rr=[];if(f&16)while(i+1<dv.byteLength){rr.push(dv.getUint16(i,true)/1024*1000);i+=2}
  return{hr,rr,contact:((f>>1)&3)!==2}}
// ECG-frame: [0]=meettype (0 = ECG) · [1..8]=tijdstempel (ns, little endian) · [9]=frametype · daarna samples van 3 bytes (µV, signed)
function parseECG(dv){if(dv.byteLength<10||dv.getUint8(0)!==0x00)return null;
  const ts=dv.getUint32(1,true)+dv.getUint32(5,true)*4294967296,ft=dv.getUint8(9);
  if(ft!==0x00)return{ts,unknown:ft,samples:[]};
  const s=[];for(let i=10;i+2<dv.byteLength;i+=3){let v=dv.getUint8(i)|(dv.getUint8(i+1)<<8)|(dv.getUint8(i+2)<<16);if(v&0x800000)v-=0x1000000;s.push(v)}
  return{ts,samples:s}}
// antwoord van het control point: [0]=0xF0 · [1]=opdracht · [2]=meettype · [3]=foutcode (0 = gelukt)
function parseCP(dv){if(dv.byteLength<4||dv.getUint8(0)!==0xF0)return null;return{op:dv.getUint8(1),type:dv.getUint8(2),err:dv.getUint8(3)}}
const cpErr=e=>e===6?'ECG stond al aan':`foutcode ${e}`;

/* ---------- echte band ---------- */
async function connectPolar(h){
  if(!(root.navigator&&navigator.bluetooth))throw new Error('Deze browser ondersteunt geen Bluetooth');
  const dev=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}],optionalServices:['battery_service',PMD_S]});
  let alive=true,gatt;
  dev.addEventListener('gattserverdisconnected',()=>{if(alive){alive=false;h.onDisconnect&&h.onDisconnect()}});
  h.onStatus&&h.onStatus(`Verbinden met ${dev.name||'band'}…`);
  gatt=await dev.gatt.connect();
  const hrc=await(await gatt.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
  hrc.addEventListener('characteristicvaluechanged',e=>h.onHR(parseHR(e.target.value)));
  await hrc.startNotifications();
  try{const b=await(await gatt.getPrimaryService('battery_service')).getCharacteristic('battery_level');h.onBattery&&h.onBattery((await b.readValue()).getUint8(0))}catch(e){}
  let cp=null,pending=null,ecgOn=false;
  const cmd=async bytes=>{
    const resp=new Promise(res=>{pending=res;setTimeout(()=>{if(pending===res){pending=null;res(null)}},4000)});
    const buf=new Uint8Array(bytes);await(cp.writeValueWithResponse?cp.writeValueWithResponse(buf):cp.writeValue(buf));return resp};
  const src={name:dev.name||'Polar-band',kind:'polar',ecg:false,
    async startECG(){
      const svc=await gatt.getPrimaryService(PMD_S);
      cp=await svc.getCharacteristic(PMD_CP);const data=await svc.getCharacteristic(PMD_DATA);
      cp.addEventListener('characteristicvaluechanged',e=>{const r=parseCP(e.target.value);if(r&&pending){const p=pending;pending=null;p(r)}});
      await cp.startNotifications();
      data.addEventListener('characteristicvaluechanged',e=>{const f=parseECG(e.target.value);if(f&&f.samples.length)h.onECG(f.samples,f.ts);else if(f&&f.unknown!=null)h.onStatus&&h.onStatus(`Onbekend ECG-frametype ${f.unknown}`)});
      await data.startNotifications();
      let r=await cmd(ECG_START);
      if(r&&r.err===6){await cmd(ECG_STOP);r=await cmd(ECG_START)}   // stond nog aan van een vorige sessie
      if(r&&r.err!==0)throw new Error(cpErr(r.err));
      ecgOn=true;src.ecg=true},
    async close(){alive=false;try{if(ecgOn&&gatt.connected)await cmd(ECG_STOP)}catch(e){}try{gatt.connected&&gatt.disconnect()}catch(e){}}};
  if(h.ecg!==false){try{await src.startECG()}catch(e){h.onStatus&&h.onStatus('ECG niet gestart: '+e.message+'. Hartslag en HRV werken wel.')}}
  return src}

/* ---------- proefsignaal: synthetisch ECG en RR, zonder band ---------- */
// Hartslag rond 60/min met ademhalingsritme (0,25 Hz) en een tragere golf (0,1 Hz), af en toe een gemiste slag.
function demoSource(h,opt={}){
  let seed=opt.seed||12345;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  const gauss=()=>(rnd()+rnd()+rnd()+rnd()-2)*1.22;
  const base=opt.rr||1000;let ar=0,tBeat=.5,beats=[{t:.5,rr:base}],pend=[],rrOut=[],ecgN=0,lastHR=0,simT=0,timer=null,last=null;
  const W=[[-.20,120,.025],[-.035,-90,.008],[0,1150,.010],[.032,-260,.011],[.26,280,.045]]; // P, Q, R, S, T: [tijd s, µV, breedte s]
  const ecgAt=t=>{let v=0;for(let i=beats.length-1;i>=0&&i>=beats.length-4;i--){const d=t-beats[i].t;if(d<-.4||d>.6)continue;for(const[c,a,w]of W){const x=(d-c)/w;v+=a*Math.exp(-.5*x*x)}}
    return v+60*Math.sin(2*Math.PI*.3*t)+gauss()*18};
  const step=()=>{const now=performance.now();if(last==null)last=now;simT+=Math.min(.5,(now-last)/1000);last=now;
    while(tBeat<simT+.8){ar=ar*.95+gauss()*12;const rr=base+20*Math.sin(2*Math.PI*.25*tBeat)+20*Math.sin(2*Math.PI*.095*tBeat)+ar+gauss()*4+(opt.drift?-opt.drift*tBeat:0);  // ar = trage, gecorreleerde schommeling zoals bij een echt hart
      tBeat+=rr/1000;beats.push({t:tBeat,rr});if(beats.length>12)beats.shift();pend.push({t:tBeat,rr})}
    while(pend.length&&pend[0].t<=simT){const p=pend.shift();if(rnd()<.004&&rrOut.length)rrOut[rrOut.length-1]+=p.rr;else rrOut.push(p.rr)}  // af en toe een gemiste slag
    const target=Math.floor(simT*ECG_FS);
    while(target-ecgN>=73){const s=[];for(let i=0;i<73;i++,ecgN++)s.push(Math.round(ecgAt(ecgN/ECG_FS)));h.onECG(s,ecgN)}
    if(simT-lastHR>=1){lastHR=simT;const rr=rrOut.splice(0);const m=rr.length?rr.reduce((a,b)=>a+b,0)/rr.length:base;h.onHR({hr:Math.round(60000/m),rr,contact:true})}};
  timer=setInterval(step,100);h.onBattery&&h.onBattery(100);
  return{name:'Proefsignaal',kind:'demo',ecg:true,async close(){clearInterval(timer)}}}

/* ---------- artefacten ---------- */
// Onmogelijke slagen (sneller dan 200 of trager dan 30/min) en sprongen van meer dan 20% tellen niet mee.
// Na drie afwijkers op rij wordt het nieuwe niveau geaccepteerd (bijvoorbeeld als je opstaat).
class RRFilter{constructor(){this.last=null;this.run=0}
  push(rr){const pl=rr>=300&&rr<=2000;let ok=pl&&(this.last==null||Math.abs(rr-this.last)/this.last<=.2);
    if(!ok){this.run++;if(this.run>=3&&pl)ok=true}if(ok){this.last=rr;this.run=0}return ok}}

/* ---------- maten ---------- */
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sd=a=>{if(a.length<2)return 0;const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/(a.length-1))};
// beats: [{rr, ok}]. rMSSD alleen over opeenvolgende geldige slagen.
function stats(beats){let ss=0,n=0,n50=0;const ok=[];let bad=0;
  beats.forEach((b,i)=>{if(b.ok)ok.push(b.rr);else bad++;
    if(i&&b.ok&&beats[i-1].ok){const d=b.rr-beats[i-1].rr;ss+=d*d;n++;if(Math.abs(d)>50)n50++}});
  const m=mean(ok);
  return{rmssd:n?Math.sqrt(ss/n):0,sdnn:sd(ok),pnn50:n?n50/n*100:0,hr:m?60000/m:0,meanRR:m,cnt:ok.length,pairs:n,bad,art:ok.length+bad?bad/(ok.length+bad):1}}
// Afgekeurde slagen vervangen door de mediaan van de vijf dichtstbijzijnde goede slagen (voor DFA en spectrum).
function corrected(beats){const ok=beats.map(b=>!!b.ok),v=beats.map(b=>b.rr),out=[];
  const first=ok.indexOf(true),lastI=ok.lastIndexOf(true);if(first<0)return out;
  for(let i=first;i<=lastI;i++){if(ok[i]){out.push(v[i]);continue}
    const nb=[];for(let d=1;nb.length<5&&(i-d>=first||i+d<=lastI);d++){if(i-d>=first&&ok[i-d])nb.push(v[i-d]);if(nb.length<5&&i+d<=lastI&&ok[i+d])nb.push(v[i+d])}
    nb.sort((a,b)=>a-b);out.push(nb[nb.length>>1])}
  return out}
// DFA α1: korte-termijn-fractaalcorrelatie, vensters van 4 tot 16 slagen.
function dfa1(x){const n=x.length;if(n<64)return null;const m=mean(x);const y=new Float64Array(n);let c=0;for(let i=0;i<n;i++){c+=x[i]-m;y[i]=c}
  const L=[],F=[];
  for(let s=4;s<=16;s++){const segs=Math.floor(n/s);if(segs<4)continue;let tot=0;
    const sx=(s-1)*s/2,sxx=(s-1)*s*(2*s-1)/6,den=s*sxx-sx*sx;
    for(let g=0;g<segs;g++){let sy=0,sxy=0;const o=g*s;for(let k=0;k<s;k++){sy+=y[o+k];sxy+=k*y[o+k]}
      const b=(s*sxy-sx*sy)/den,a=(sy-b*sx)/s;for(let k=0;k<s;k++){const r=y[o+k]-(a+b*k);tot+=r*r}}
    const f=Math.sqrt(tot/(segs*s));if(f>0){L.push(Math.log10(s));F.push(Math.log10(f))}}
  if(L.length<4)return null;const lm=mean(L),fm=mean(F);let num=0,dd=0;for(let i=0;i<L.length;i++){num+=(L[i]-lm)*(F[i]-fm);dd+=(L[i]-lm)**2}
  return num/dd}
// Poincaré: SD1 = korte-termijnvariatie (≈ rMSSD/√2), SD2 = lange-termijnvariatie.
function poincare(x){if(x.length<10)return null;const d=[];for(let i=1;i<x.length;i++)d.push(x[i]-x[i-1]);
  const sd1=Math.sqrt(sd(d)**2/2),sdnn=sd(x),sd2=Math.sqrt(Math.max(0,2*sdnn*sdnn-sd1*sd1));return{sd1,sd2}}
// Spectrum: RR-reeks gelijkmatig herbemonsterd op 4 Hz, trend eraf, Hann-venster, DFT.
// LF 0,04–0,15 Hz, HF 0,15–0,40 Hz. De piek tussen 0,1 en 0,5 Hz is meestal je ademhaling.
function spectrum(x){if(x.length<60)return null;const t=[];let c=0;for(const r of x){c+=r/1000;t.push(c)}
  const dur=t[t.length-1]-t[0];if(dur<100)return null;const fs=4,N=Math.floor(dur*fs),s=new Float64Array(N);let j=0;
  for(let i=0;i<N;i++){const tt=t[0]+i/fs;while(j<t.length-2&&t[j+1]<tt)j++;const f=(tt-t[j])/(t[j+1]-t[j]);s[i]=x[j]+(x[j+1]-x[j])*Math.max(0,Math.min(1,f))}
  let mx=0,my=0,sxy=0,sxx=0;for(let i=0;i<N;i++){mx+=i;my+=s[i]}mx/=N;my/=N;for(let i=0;i<N;i++){sxy+=(i-mx)*(s[i]-my);sxx+=(i-mx)**2}
  const b=sxy/sxx;for(let i=0;i<N;i++)s[i]=(s[i]-my-b*(i-mx))*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));
  const df=fs/N;let lf=0,hf=0,pk=0,pf=0;const P=[];
  for(let k=Math.ceil(.03/df);k*df<=.5;k++){let re=0,im=0;const w=2*Math.PI*k/N;for(let i=0;i<N;i++){re+=s[i]*Math.cos(w*i);im-=s[i]*Math.sin(w*i)}
    const p=(re*re+im*im)/N,f=k*df;P.push([f,p]);if(f>=.04&&f<.15)lf+=p;if(f>=.15&&f<.4)hf+=p;if(f>=.1&&f<=.5&&p>pk){pk=p;pf=f}}
  return{lf,hf,ratio:hf?lf/hf:null,resp:pf*60,P}}

const H={PMD_S,PMD_CP,PMD_DATA,ECG_FS,ECG_START,ECG_STOP,parseHR,parseECG,parseCP,connectPolar,demoSource,RRFilter,stats,corrected,dfa1,poincare,spectrum,mean,sd};
if(typeof module!=='undefined'&&module.exports)module.exports=H;else root.H=H;
})(typeof window!=='undefined'?window:globalThis);
