
const CACHE='werdy-web-v26';
const appAsset=path=>new URL(path,self.registration.scope).href;
const CORE=['./?release=26','./index.html','./app-v20.js?v=26','./release-fixes.js?v=26','./manifest.json?v=26','./privacy.html','./support.html','./legal.css','./assets/adhkar-data.js?v=26','./assets/quran/quran-data.js','./icons/icon-192.png','./icons/icon-512.png'].map(appAsset);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const url=new URL(event.request.url),mutable=event.request.mode==='navigate'||/\/(?:index\.html|styles(?:-v\d+)?\.css|app(?:-v\d+)?\.js|release-fixes\.js|manifest\.json|adhkar-data\.js)$/.test(url.pathname);
  if(mutable){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match(appAsset('./index.html')):undefined))));return}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
