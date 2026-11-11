/* ================= Laptop app layer: everything here only runs in the installed app, never the web version ================= */
(function(){
"use strict";
const APP_VER="1.1.0";
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
  try{const reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.showNotification(title,{body,icon:"icon-192.png",badge:"icon-192.png",tag:id});else new Notification(title,{body,icon:"icon-192.png"})}catch(e){try{new Notification(title,{body})}catch(e2){}}}
function nCheck(){const n=nset();if(!n.on||!("Notification"in window)||Notification.permission!=="granted")return;const now=new Date();
  try{(shifts||[]).filter(s=>s.who==="iza").forEach(s=>{const a=parse(s.start),m=(a-now)/60000;if(m>0&&m<=n.shift)notify("sh"+s.id,"Shift in "+Math.round(m)+" min",`${fmtT(a)}–${fmtT(parse(s.end))}${s.note?" · "+s.note:""}`)})}catch(e){}
  try{if(n.oil&&now.getHours()>=9)activeCars().forEach(k=>{const o=oilState(k);if(/over|due/i.test(o.txt))notify("oil"+k+loc(now),CAR_INFO[k].name+": oil change",o.txt)})}catch(e){}
  try{if(n.quests&&now.getHours()===10){const Q=questsNow(),left=Q.daily.filter(q=>!q.done).length;if(left)notify("q"+loc(now),"Daily quests",`${left} quest${left>1?"s":""} left today`)}}catch(e){}}
setInterval(nCheck,60e3);setTimeout(nCheck,5000);
async function nOn(){if(!("Notification"in window)){appToast("This browser can't show notifications.");return}const p=await Notification.requestPermission();const n=nset();n.on=p==="granted";LS.set(NK,n);appToast(n.on?"Notifications on.":"Notifications are blocked. Allow them in Chrome's site settings.");try{holoDraw()}catch(e){}}


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
  ui.text("Notifications show while the app is open or minimized. Press Esc for settings.",48,ui.y+24,{size:26,color:HC.dim,wrap:W-96,lh:34})};
/* ================= Laptop controls + settings (Esc) ================= */
const CFG_KEY="cc-app-settings",CFG_DEF={sens:1,invert:false,mouselook:true,walk:1,sprint:1.8,sprintMode:"hold",fov:70,res:"high",shadows:true,vol:1,fps:false};
window.APPCFG=Object.assign({},CFG_DEF,LS.get(CFG_KEY,{}));
const saveCfg=()=>LS.set(CFG_KEY,APPCFG);
const RES={low:.75,medium:1,high:Math.min(2,devicePixelRatio||1),max:Math.min(2.5,(devicePixelRatio||1)*1.25)};

/* ---- cursor: hidden while you play, back the moment a menu opens ---- */
let silentUnlock=false,sprintOn=false,pausedOpen=false;
const sheetOpen=()=>!!document.querySelector(".fs-sheet.on,#app-pause:not([hidden])");
const holoUp=()=>{try{return !!(HOLO.mesh&&HOLO.root&&HOLO.root.parent)}catch(e){return false}};
window.appWantLock=()=>APPCFG.mouselook&&!pausedOpen&&!sheetOpen()&&!holoUp();
window.appUnlock=()=>{if(document.pointerLockElement){silentUnlock=true;document.exitPointerLock()}};
window.appAfterTap=()=>{setTimeout(()=>{if(holoUp()||sheetOpen())appUnlock()},80)};
document.addEventListener("pointerlockchange",()=>{const on=!!document.pointerLockElement;document.documentElement.classList.toggle("app-locked",on);
  if(!on){if(silentUnlock){silentUnlock=false;return}if(!holoUp()&&!sheetOpen())openPause()}});
// any HTML sheet that slides up gets the cursor back
new MutationObserver(()=>{if(sheetOpen()&&document.pointerLockElement&&!pausedOpen)appUnlock()}).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class","hidden"]});

/* ---- center dot + hints ---- */
const css=document.createElement("style");css.textContent=`
#app-dot{position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.6),0 0 6px rgba(79,216,255,.8);z-index:60;pointer-events:none;display:none}
html.app-locked #app-dot{display:block}html.app-locked .fs-joy,html.app-locked .side-btns{opacity:.35}
#app-click{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:60;pointer-events:none;background:rgba(3,16,30,.82);color:#e8f6ff;border:1px solid #4fd8ff;border-radius:12px;padding:8px 14px;font:600 14px system-ui;display:none}
#app-sprint{position:fixed;left:150px;bottom:40px;z-index:40;width:64px;height:64px;border-radius:50%;border:2px solid #4fd8ff;background:rgba(3,16,30,.7);color:#e8f6ff;font:800 12px system-ui;letter-spacing:.06em;display:none;align-items:center;justify-content:center;touch-action:none;user-select:none}
#app-sprint.on{background:#ffc24a;color:#1a1206;border-color:#ffc24a}
#app-fps{position:fixed;right:10px;bottom:8px;z-index:60;font:600 12px ui-monospace,monospace;color:#9fb3c8;pointer-events:none}
#app-pause{position:fixed;inset:0;z-index:9000;background:rgba(2,6,12,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;color:#e8f6ff}
#app-pause[hidden]{display:none}
#app-pause .card{width:min(720px,100%);max-height:92vh;overflow:auto;background:#0c121c;border:2px solid #4fd8ff;border-radius:18px;box-shadow:0 0 40px rgba(79,216,255,.25);padding:22px 24px}
#app-pause h2{margin:0 0 4px;font:800 30px "Chakra Petch",system-ui;letter-spacing:.06em;color:#4fd8ff}
#app-pause .sub{color:#9fb3c8;margin:0 0 14px}
#app-pause h3{margin:18px 0 8px;font:800 13px system-ui;letter-spacing:.14em;color:#ffc24a}
#app-pause .row{display:grid;grid-template-columns:1fr 1.3fr 64px;gap:12px;align-items:center;padding:8px 0;border-top:1px solid #1d2a3a}
#app-pause .row.two{grid-template-columns:1fr auto}
#app-pause label{font:600 16px system-ui,sans-serif;color:#e8f6ff;text-transform:none;letter-spacing:0;margin:0}
#app-pause input[type=range]{width:100%;accent-color:#4fd8ff}
#app-pause .val{font:600 14px ui-monospace,monospace;text-align:right;color:#9fb3c8}
#app-pause .seg{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#app-pause .seg button,#app-pause .btn{background:#13202f;border:1px solid #2c4258;color:#e8f6ff;border-radius:10px;padding:8px 12px;font:600 14px system-ui;cursor:pointer}
#app-pause .seg button.on{background:#4fd8ff;border-color:#4fd8ff;color:#03101e}
#app-pause .btn.main{background:#4fd8ff;color:#03101e;border-color:#4fd8ff;font-size:16px;padding:12px 18px}
#app-pause .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
#app-pause kbd{display:inline-block;min-width:22px;padding:2px 7px;border:1px solid #2c4258;border-bottom-width:3px;border-radius:6px;background:#13202f;font:700 12px ui-monospace,monospace;text-align:center;color:#e8f6ff}
#app-pause .keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 18px;color:#c9d4e2;font-size:14px}`;
document.head.appendChild(css);
const dot=document.createElement("div");dot.id="app-dot";document.body.appendChild(dot);
const hint=document.createElement("div");hint.id="app-click";hint.textContent="Click to look around · Esc for settings";document.body.appendChild(hint);
const fpsEl=document.createElement("div");fpsEl.id="app-fps";document.body.appendChild(fpsEl);
const spr=document.createElement("button");spr.id="app-sprint";spr.type="button";spr.textContent="SPRINT";document.body.appendChild(spr);
spr.addEventListener("pointerdown",e=>{e.preventDefault();if(APPCFG.sprintMode==="toggle")sprintOn=!sprintOn;else sprintOn=true;spr.classList.toggle("on",sprintOn)});
["pointerup","pointercancel","pointerleave"].forEach(ev=>spr.addEventListener(ev,()=>{if(APPCFG.sprintMode!=="toggle"){sprintOn=false;spr.classList.remove("on")}}));
const in3D=()=>!!document.querySelector(".fs-view:not([hidden]),#view-base:not([hidden])")&&!document.documentElement.classList.contains("screen-mode");
setInterval(()=>{const show=in3D()&&!pausedOpen&&!holoUp()&&!sheetOpen();hint.style.display=show&&APPCFG.mouselook&&!document.pointerLockElement?"block":"none";spr.style.display=show&&!document.pointerLockElement?"flex":"none"},300);

/* ---- sprint + speed ---- */
window.appSpeed=K=>{const sh=K.shift;let run=APPCFG.sprintMode==="toggle"?sprintOn:(sh||sprintOn);return APPCFG.walk*(run?APPCFG.sprint:1)};
addEventListener("keydown",e=>{if(e.key==="Shift"&&APPCFG.sprintMode==="toggle"&&!e.repeat){sprintOn=!sprintOn;spr.classList.toggle("on",sprintOn)}});

/* ---- per-frame: field of view, sharpness, shadows, fps ---- */
let fT=0,fN=0;
window.appFrame=(r,cam,walk,o,keyL,dt)=>{if(!r)return;const pr=RES[APPCFG.res]||1;if(r._appPR!==pr){r.setPixelRatio(pr);r._appPR=pr;try{const c=r.domElement.parentElement;r.setSize(c.clientWidth,c.clientHeight,false)}catch(e){}}
  if(walk&&cam.fov!==APPCFG.fov){cam.fov=APPCFG.fov;cam.updateProjectionMatrix()}
  if(r.shadowMap.enabled!==APPCFG.shadows){r.shadowMap.enabled=APPCFG.shadows;if(keyL)keyL.castShadow=APPCFG.shadows;r._appShadowDirty=true}
  if(APPCFG.fps){fT+=dt;fN++;if(fT>=.5){fpsEl.textContent=Math.round(fN/fT)+" fps";fT=0;fN=0}}else if(fpsEl.textContent)fpsEl.textContent=""};

/* ---- Q opens / closes the watch ---- */
addEventListener("keydown",e=>{if(/input|textarea|select/i.test((document.activeElement||{}).tagName||""))return;
  if((e.key==="q"||e.key==="Q")&&!e.repeat&&!pausedOpen){e.preventDefault();if(holoUp()){try{holoClose()}catch(_){}}else if(in3D()){try{holoOpen("menu",{})}catch(_){}}}
  if(e.key==="Escape"){if(pausedOpen){closePause();return}if(holoUp()){try{holoClose()}catch(_){}return}if(sheetOpen())return;openPause()}});

/* ---- the settings menu ---- */
const pause=document.createElement("div");pause.id="app-pause";pause.hidden=true;document.body.appendChild(pause);
function slider(k,label,min,max,step,fmt){return `<div class="row"><label for="s-${k}">${label}</label><input id="s-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${APPCFG[k]}" data-k="${k}"><span class="val" id="v-${k}">${fmt(APPCFG[k])}</span></div>`}
function seg(k,label,opts){return `<div class="row two"><label>${label}</label><div class="seg">${opts.map(([v,t])=>`<button type="button" data-k="${k}" data-v="${v}" class="${String(APPCFG[k])===String(v)?"on":""}">${t}</button>`).join("")}</div></div>`}
const F={sens:v=>(+v).toFixed(2)+"×",walk:v=>(+v).toFixed(2)+"×",sprint:v=>(+v).toFixed(1)+"×",fov:v=>v+"°",vol:v=>Math.round(v*100)+"%"};
function drawPause(){pause.innerHTML=`<div class="card" role="dialog" aria-modal="true" aria-label="Settings">
  <h2>PAUSED</h2><p class="sub">Settings save on this computer.</p>
  <h3>MOUSE & MOVEMENT</h3>
  ${slider("sens","Look sensitivity",.2,3,.05,F.sens)}
  ${seg("invert","Invert up / down",[[false,"Off"],[true,"On"]])}
  ${seg("mouselook","Hide cursor to look",[[true,"On"],[false,"Off"]])}
  ${slider("walk","Walk speed",.5,1.8,.05,F.walk)}
  ${slider("sprint","Sprint speed",1.2,3,.1,F.sprint)}
  ${seg("sprintMode","Sprint with Shift",[["hold","Hold"],["toggle","Tap to toggle"]])}
  <h3>DISPLAY</h3>
  ${slider("fov","Field of view",50,100,1,F.fov)}
  ${seg("res","Sharpness",[["low","Low"],["medium","Medium"],["high","High"],["max","Max"]])}
  ${seg("shadows","Shadows",[[true,"On"],[false,"Off"]])}
  ${seg("fps","Show frame rate",[[false,"Off"],[true,"On"]])}
  <div class="row two"><label>Full screen</label><div class="seg"><button type="button" data-act="fs">${document.fullscreenElement?"Exit full screen":"Go full screen"}</button></div></div>
  <h3>SOUND</h3>
  ${slider("vol","Volume",0,1,.05,F.vol)}
  <div class="row two"><label>Sound effects</label><div class="seg"><button type="button" data-act="mute">${(typeof muted!=="undefined"&&muted)?"Turn sound on":"Mute"}</button></div></div>
  <h3>KEYS</h3>
  <div class="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span><span><kbd>Shift</kbd> sprint</span><span>Mouse: look around</span><span>Click: use what the dot is on</span><span><kbd>Q</kbd> open / close watch</span><span><kbd>Esc</kbd> this menu</span><span>Scroll: step forward / back</span><span><kbd>F11</kbd> full screen</span></div>
  <div class="actions"><button type="button" class="btn main" data-act="resume">Resume</button><button type="button" class="btn" data-act="data">Backup, restore & alerts</button><button type="button" class="btn" data-act="reset">Reset settings</button></div></div>`}
function openPause(){if(pausedOpen)return;pausedOpen=true;drawPause();pause.hidden=false;appUnlock()}
function closePause(relock){pausedOpen=false;pause.hidden=true;if(relock&&APPCFG.mouselook){const c=document.querySelector(".fs-view:not([hidden]) canvas,#view-base:not([hidden]) canvas");if(c)try{c.requestPointerLock()}catch(e){}}}
window.openPause=openPause;
pause.addEventListener("input",e=>{const k=e.target.dataset.k;if(!k)return;APPCFG[k]=+e.target.value;const v=document.getElementById("v-"+k);if(v)v.textContent=F[k](APPCFG[k]);saveCfg()});
pause.addEventListener("click",e=>{const b=e.target.closest("button");if(!b){if(e.target===pause)closePause(true);return}
  if(b.dataset.k){let v=b.dataset.v;v=v==="true"?true:v==="false"?false:v;APPCFG[b.dataset.k]=v;saveCfg();drawPause();return}
  const a=b.dataset.act;if(a==="resume")closePause(true);
  else if(a==="fs"){if(document.fullscreenElement)document.exitFullscreen().then(drawPause);else document.documentElement.requestFullscreen().then(drawPause).catch(()=>{})}
  else if(a==="mute"){const mb=document.getElementById("hb-mute");if(mb)mb.click();drawPause()}
  else if(a==="data"){closePause(false);try{holoOpen("appdata",{})}catch(_){}}
  else if(a==="reset"){window.APPCFG=Object.assign({},CFG_DEF);saveCfg();drawPause()}});
})();
