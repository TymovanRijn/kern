// Kern service worker: app-shell netwerk-eerst met cache als terugval; externe API's nooit cachen.
const CACHE='kern-v5';
const SHELL=['./','index.html','journal.js','manifest.json','core/core.css','core/core.js','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png',
  'tempo/','tempo/schema.js','kracht/','eten/','eten/recipes.js','geld/','hart/','hart/polar.js','amifo/'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
