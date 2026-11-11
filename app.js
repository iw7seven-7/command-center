/* ================= Laptop app layer: everything here only runs in the installed app, never the web version ================= */
(function(){
"use strict";
const APP_VER="1.0.0";
window.APP=true;
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ---- offline + install ---- */
if("serviceWorker"in navigator){addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").then(reg=>{
  reg.addEventListener("updatefound",()=>{const w=reg.installing;if(w)w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)appToast("Update ready. It will load next time you open the app.")})});
  setInterval(()=>reg.update().catch(()=>{}),3600e3)}).catch(()=>{})})}
function appToast(t){let n=document.getElementById("app-toast");if(!n){n=document.createElement("div");n.id="app-toast";n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;background:#0c121c;color:#fff;border:1px solid #4fd8ff;border-radius:12px;padding:10px 16px;font:600 15px system-ui;max-width:90vw;box-shadow:0 8px 30px rgba(0,0,0,.5)";document.body.appendChild(n)}
  n.textContent=t;n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>{n.hidden=true},4500)}
window.appToast=appToast;

/* ---- weather straight from the National Weather Service for Redding (no account, no key) ---- */
const WX_KEY="cc-app-weather",LAT=40.5865,LON=-122.3917;
const loc=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
function wxApply(w){if(!w)return;weather=w;try{renderInfo()}catch(e){}try{redrawScreens()}catch(e){}try{if(!document.getElementById("view-dispatch").hidden)renderDispatch()}catch(e){}
  try{if(HOLO.mesh&&HOLO.page&&(HOLO.page.id==="weather"||HOLO.page.id==="wxday"))holoDraw()}catch(e){}try{if(!document.getElementById("view-weather").hidden)renderWeather()}catch(e){}}
async function wxFetch(){try{
  const h={headers:{"Accept":"application/geo+json"}};
  const pt=await (await fetch(`https://api.weather.gov/points/${LAT},${LON}`,h)).json();
  const [fc,hr]=await Promise.all([fetch(pt.properties.forecast,h).then(r=>r.json()),fetch(pt.properties.forecastHourly,h).then(r=>r.json()).catch(()=>null)]);
  const days={};(fc.properties.periods||[]).forEach(p=>{let d=loc(p.startTime);if(!p.isDaytime&&new Date(p.startTime).getHours()<6){const x=new Date(p.startTime);x.setDate(x.getDate()-1);d=loc(x)}
    const o=days[d]=days[d]||{date:d,precipitation_chance:0};const pc=(p.probabilityOfPrecipitation&&p.probabilityOfPrecipitation.value)||0;o.precipitation_chance=Math.max(o.precipitation_chance,pc);
    if(p.isDaytime){o.high=p.temperature;o.summary=p.shortForecast}else{o.low=p.temperature;if(!o.summary)o.summary=p.shortForecast}});
  const daily=Object.values(days).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{if(d.high==null&&d.low!=null)d.high=d.low+15;if(d.low==null&&d.high!=null)d.low=d.high-20;return d}).filter(d=>d.high!=null);
  const cur=hr&&hr.properties&&hr.properties.periods&&hr.properties.periods[0];
  const w={location:"Redding, CA",updated:new Date().toISOString(),current:cur?{temperature:cur.temperature,condition_text:cur.shortForecast,is_day:cur.isDaytime}:{temperature:daily[0]?daily[0].high:null},daily};
  LS.set(WX_KEY,w);wxApply(w)}catch(e){console.warn("weather",e)}}
setTimeout(()=>{wxApply(LS.get(WX_KEY,null));wxFetch()},600);setInterval(wxFetch,30*60e3);addEventListener("online",wxFetch);

/* ---- backup: one file with everything, to keep on a USB drive or move to another computer ---- */
const KEYS={shifts:"command-center-shifts-v1",cars:"command-center-cars-v1",skills:"command-center-tower-v1"};
function backupObj(){const o={app:"command-center",kind:"backup",version:1,made:new Date().toISOString(),shifts:LS.get(KEYS.shifts,[]),cars:LS.get(KEYS.cars,null),skills:LS.get(KEYS.skills,null),guides:{},extra:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith("cc-fg-"))o.guides[k.slice(6)]=LS.get(k,{});else if(/^cc-(gear-placed|mute|app-notify)/.test(k))o.extra[k]=LS.get(k,null)}return o}
function saveBackup(){const b=new Blob([JSON.stringify(backupObj(),null,1)],{type:"application/json"}),a=document.createElement("a");const d=new Date();
  a.href=URL.createObjectURL(b);a.download=`command-center-backup-${loc(d)}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);LS.set("cc-app-lastbackup",d.toISOString())}
function restoreFrom(file,done){const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(!o||o.app!=="command-center"||!o.cars||!o.shifts)throw Error("not a backup");
    LS.set(KEYS.shifts,o.shifts);LS.set(KEYS.cars,o.cars);if(o.skills)LS.set(KEYS.skills,o.skills);Object.entries(o.guides||{}).forEach(([id,g])=>LS.set("cc-fg-"+id,g));Object.entries(o.extra||{}).forEach(([k,v])=>LS.set(k,v));
    LS.set("cc-app-restored",o.made||new Date().toISOString());done(true)}catch(e){done(false)}};r.onerror=()=>done(false);r.readAsText(file)}
const pick=document.createElement("input");pick.type="file";pick.accept=".json,application/json";pick.hidden=true;document.body.appendChild(pick);
pick.addEventListener("change",()=>{const f=pick.files&&pick.files[0];pick.value="";if(!f)return;restoreFrom(f,ok=>{if(ok){appToast("Restored. Reloading…");setTimeout(()=>location.reload(),900)}else appToast("That file isn't a Command Center backup.")})});
// first run with no data: offer the restore right away
if(!LS.get("cc-app-welcomed",false)&&!LS.get("cc-app-restored",null))setTimeout(()=>{try{holoOpen("appdata",{welcome:1})}catch(e){}},2500);

/* ---- notifications: your shifts, oil changes, quests ---- */
const NK="cc-app-notify";const nset=()=>LS.get(NK,{on:false,shift:60,oil:true,quests:true}),sent=()=>LS.get("cc-app-sent",{});
async function notify(id,title,body){const s=sent();if(s[id])return;s[id]=Date.now();const keep={};Object.entries(s).forEach(([k,v])=>{if(Date.now()-v<10*864e5)keep[k]=v});LS.set("cc-app-sent",keep);
  try{const reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.showNotification(title,{body,icon:"icons/icon-192.png",badge:"icons/icon-192.png",tag:id});else new Notification(title,{body,icon:"icons/icon-192.png"})}catch(e){try{new Notification(title,{body})}catch(e2){}}}
function nCheck(){const n=nset();if(!n.on||!("Notification"in window)||Notification.permission!=="granted")return;const now=new Date();
  try{(shifts||[]).filter(s=>s.who==="iza").forEach(s=>{const a=parse(s.start),m=(a-now)/60000;if(m>0&&m<=n.shift)notify("sh"+s.id,"Shift in "+Math.round(m)+" min",`${fmtT(a)}–${fmtT(parse(s.end))}${s.note?" · "+s.note:""}`)})}catch(e){}
  try{if(n.oil&&now.getHours()>=9)activeCars().forEach(k=>{const o=oilState(k);if(/over|due/i.test(o.txt))notify("oil"+k+loc(now),CAR_INFO[k].name+": oil change",o.txt)})}catch(e){}
  try{if(n.quests&&now.getHours()===10){const Q=questsNow(),left=Q.daily.filter(q=>!q.done).length;if(left)notify("q"+loc(now),"Daily quests",`${left} quest${left>1?"s":""} left today`)}}catch(e){}}
setInterval(nCheck,60e3);setTimeout(nCheck,5000);
async function nOn(){if(!("Notification"in window)){appToast("This browser can't show notifications.");return}const p=await Notification.requestPermission();const n=nset();n.on=p==="granted";LS.set(NK,n);appToast(n.on?"Notifications on.":"Notifications are blocked. Allow them in Chrome's site settings.");try{holoDraw()}catch(e){}}

/* ---- full screen (F11 also works) ---- */
addEventListener("keydown",e=>{if(e.key==="F"&&e.shiftKey&&!/input|textarea/i.test(document.activeElement.tagName)){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{})}});

/* ---- the watch page for all of it ---- */
window.APP_TILES=[["Laptop app","Backup, restore, alerts",()=>holoOpen("appdata",{}),"#7fe3a8"]];
HPAGES.appdata=function(ui,p){const {x,W,H}=ui;holoSetCar(null);ui.title(p.welcome?"Welcome to the app":"Laptop app",`Version ${APP_VER} · saved on this computer`,HC.green);
  if(p.welcome){LS.set("cc-app-welcomed",true);const n=ui.text("Bring in your data from the web app: tap Restore and pick the backup file Claude gave you.",48,ui.y+40,{size:34,wrap:W-96,lh:44});ui.y+=n*44+40}
  const lb=LS.get("cc-app-lastbackup",null);
  ui.text("YOUR DATA",48,ui.y+20,{size:30,weight:800,color:HC.line});ui.y+=40;
  ui.btn(48,ui.y,W-96,104,"💾 Save a backup file",()=>{saveBackup();HOLO.msg="Saved to your Downloads folder. Copy it to a USB drive to keep it safe."},{on:true});ui.y+=118;
  ui.text(lb?"Last backup "+new Date(lb).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"No backup yet",48,ui.y+20,{size:28,color:lb?HC.dim:HC.amber});ui.y+=50;
  ui.btn(48,ui.y,W-96,104,"📂 Restore from a backup file",()=>pick.click(),{ghost:true});ui.y+=118;
  ui.text("Restoring replaces what's in the app with the file.",48,ui.y+20,{size:26,color:HC.dim});ui.y+=60;
  const n=nset(),perm="Notification"in window?Notification.permission:"denied";
  ui.text("NOTIFICATIONS",48,ui.y+20,{size:30,weight:800,color:HC.line});ui.y+=40;
  if(!(n.on&&perm==="granted")){ui.btn(48,ui.y,W-96,100,"🔔 Turn on notifications",()=>{nOn()},{ghost:true});ui.y+=116}
  else{[["shift",`Shift reminder: ${n.shift} min before`,()=>{n.shift=n.shift===60?30:n.shift===30?120:60;LS.set(NK,n)}],["oil",`Oil change due: ${n.oil?"on":"off"}`,()=>{n.oil=!n.oil;LS.set(NK,n)}],["quests",`Daily quests at 10am: ${n.quests?"on":"off"}`,()=>{n.quests=!n.quests;LS.set(NK,n)}],["off","Turn all notifications off",()=>{n.on=false;LS.set(NK,n)}]]
      .forEach(([k,lab,fn])=>{ui.btn(48,ui.y,W-96,84,lab,fn,{ghost:k==="off",on:k!=="off",size:32});ui.y+=96})}
  ui.text("Notifications show while the app is open or minimized. Shift + F toggles full screen.",48,ui.y+24,{size:26,color:HC.dim,wrap:W-96,lh:34})};
})();
