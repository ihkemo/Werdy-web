
const CACHE='werdy-web-v21';
const appAsset=path=>new URL(path,self.registration.scope).href;
const CORE=['./?release=20','./index.html','./styles-v20.css','./app-v20.js','./manifest.json?v=20','./assets/adhkar-data.js?v=2','./assets/quran/quran-data.js','./icons/icon-192.png','./icons/icon-512.png'].map(appAsset);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const url=new URL(event.request.url),mutable=event.request.mode==='navigate'||/\/(?:index\.html|styles(?:-v\d+)?\.css|app(?:-v\d+)?\.js|manifest\.json|adhkar-data\.js)$/.test(url.pathname);
  if(mutable){event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match(appAsset('./index.html')):undefined))));return}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
