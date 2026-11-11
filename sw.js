/* Command Center laptop app: works offline after the first open. */
const VER="cc-app-1.0.0";
const SHELL=["./","index.html","app.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
const CDN=["https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VER).then(async c=>{await c.addAll(SHELL);for(const u of CDN){try{await c.add(new Request(u,{mode:"no-cors"}))}catch(err){}}}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET")return;
  if(u.hostname==="api.weather.gov")return;                       // weather always live
  if(u.origin===location.origin){                                  // the app itself: use the newest copy, fall back to the saved one offline
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(VER).then(ca=>ca.put(e.request,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));return}
  if(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.hostname)){ // 3D engine and fonts: saved copy first
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const c=r.clone();caches.open(VER).then(ca=>ca.put(e.request,c));return r})))}});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:"window"}).then(cs=>{if(cs[0])return cs[0].focus();return self.clients.openWindow("./")}))});
