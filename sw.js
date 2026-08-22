
const CACHE='werdy-web-v17';
const appAsset=path=>new URL(path,self.registration.scope).href;
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./assets/adhkar-data.js','./assets/quran/quran-data.js','./icons/icon-192.png','./icons/icon-512.png'].map(appAsset);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
    return response;
  }).catch(()=>event.request.mode==='navigate'?caches.match(appAsset('./index.html')):undefined)));
});
