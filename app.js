const KEY="schultracker-v1";
const weekdays=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"];
const defaultState={
  referenceDate:"",
  blocks:[
    {name:"1. Block",start:"08:00",end:"09:30"},
    {name:"2. Block",start:"09:45",end:"11:15"},
    {name:"3. Block",start:"11:35",end:"13:05"},
    {name:"4. Block",start:"13:35",end:"15:05"},
    {name:"5. Block",start:"15:20",end:"16:50"}
  ],
  schedule:{
    A:{Montag:["Mathe","",""],Dienstag:["Deutsch","",""],Mittwoch:["Englisch","",""],Donnerstag:["Geschichte","",""],Freitag:["Bio","",""]},
    B:{Montag:["","",""],Dienstag:["","",""],Mittwoch:["","",""],Donnerstag:["","",""],Freitag:["","",""]}
  },
  entries:{}
};
let state=load();
let deferredPrompt=null;

function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return structuredClone(defaultState)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function isoDate(d){return d.toISOString().slice(0,10)}
function parseDate(s){let d=new Date(s+"T12:00:00");return isNaN(d)?new Date():d}
function monday(d){d=new Date(d);let day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d}
function weekType(date){
  if(!state.referenceDate)return "A";
  const ref=monday(parseDate(state.referenceDate));
  const diff=Math.round((monday(date)-ref)/86400000/7);
  return ((diff%2)+2)%2===0?"A":"B";
}
function cycleStart(date){
  const ref=state.referenceDate?monday(parseDate(state.referenceDate)):monday(date);
  let weeks=Math.floor((monday(date)-ref)/86400000/7);
  if(weeks<0) weeks-=1;
  let cycles=Math.floor(weeks/2);
  const d=new Date(ref);d.setDate(d.getDate()+cycles*14);return d;
}
function key(date,blockIndex){return `${isoDate(date)}_${blockIndex}`}
function showToast(s){const t=document.querySelector("#toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function renderToday(){
  const input=document.querySelector("#datePicker");
  if(!input.value) input.value=isoDate(new Date());
  const date=parseDate(input.value), type=weekType(date);
  document.querySelector("#todayTitle").textContent=date.toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  document.querySelector("#weekInfo").innerHTML=`<span class="badge">${type}-Woche</span> · ${date.toLocaleDateString("de-DE",{weekday:"long"})}`;
  const day=weekdays[(date.getDay()+6)%7];
  const list=document.querySelector("#lessonList");
  if(date.getDay()===0||date.getDay()===6){list.innerHTML='<div class="card"><h3>Wochenende 🌤️</h3><p class="muted">Für diesen Tag gibt es keinen Stundenplan.</p></div>';return}
  const subjects=state.schedule[type]?.[day]||[];
  list.innerHTML=state.blocks.map((b,i)=>{
    const e=state.entries[key(date,i)]||{};
    const subject=subjects[i]||"";
    return `<div class="lesson ${e.cancelled?"cancelled":""}">
      <div class="time">${escapeHtml(b.name)}<br><span class="muted">${b.start}–${b.end}</span></div>
      <div><div class="subject">${escapeHtml(subject||"Keine Stunde eingetragen")}</div>
        ${e.cancelled?'<span class="badge cancel">Ausgefallen</span>':''}
      </div>
      <div class="lesson-actions">
        <label class="small">Meldungen <input class="number" type="number" min="0" value="${e.spoken??""}" data-i="${i}" data-field="spoken" placeholder="0"></label>
        <label class="satisfaction small">Zufriedenheit
          <input class="range" type="range" min="1" max="10" value="${e.satisfaction||5}" data-i="${i}" data-field="satisfaction">
          <b id="sat-${i}">${e.satisfaction||5}</b>/10
        </label>
        <button class="${e.cancelled?'secondary':''}" data-cancel="${i}">${e.cancelled?'Nicht ausgefallen':'Ausgefallen'}</button>
      </div>
    </div>`
  }).join("");
  list.querySelectorAll("input[data-field]").forEach(el=>el.addEventListener("input",()=>{
    const i=+el.dataset.i,e=state.entries[key(date,i)]||{};
    e[el.dataset.field]=el.dataset.field==="spoken"?Math.max(0,+el.value||0):+el.value;
    state.entries[key(date,i)]=e; save();
    if(el.dataset.field==="satisfaction")document.querySelector("#sat-"+i).textContent=el.value;
  }));
  list.querySelectorAll("[data-cancel]").forEach(btn=>btn.onclick=()=>{
    const i=+btn.dataset.cancel,e=state.entries[key(date,i)]||{};
    e.cancelled=!e.cancelled;state.entries[key(date,i)]=e;save();renderToday();
  });
}

function renderBlocks(){
  document.querySelector("#blocksEditor").innerHTML=state.blocks.map((b,i)=>`
    <div class="block-row">
      <label class="small">Block<input value="${escapeHtml(b.name)}" data-block="${i}" data-f="name"></label>
      <label class="small">Von<input type="time" value="${b.start}" data-block="${i}" data-f="start"></label>
      <label class="small">Bis<input type="time" value="${b.end}" data-block="${i}" data-f="end"></label>
      <button class="danger" data-remove-block="${i}">×</button>
    </div>`).join("");
  document.querySelectorAll("[data-block]").forEach(el=>el.oninput=()=>{state.blocks[+el.dataset.block][el.dataset.f]=el.value;save();renderSchedule()});
  document.querySelectorAll("[data-remove-block]").forEach(btn=>btn.onclick=()=>{
    if(state.blocks.length<=1)return showToast("Mindestens ein Block bleibt erhalten.");
    state.blocks.splice(+btn.dataset.removeBlock,1);
    Object.values(state.schedule).forEach(w=>Object.values(w).forEach(a=>a.splice(+btn.dataset.removeBlock,1)));
    save();renderBlocks();renderSchedule();renderToday();
  });
}
function renderSchedule(){
  const wrap=document.querySelector("#scheduleEditor");
  wrap.innerHTML=["A","B"].map(type=>`
    <div class="card">
      <h3>${type}-Woche</h3>
      <div class="schedule-grid">
        <div class="head">Block</div>${weekdays.map(d=>`<div class="head">${d}</div>`).join("")}
        ${state.blocks.map((b,i)=>`<div><b>${escapeHtml(b.name)}</b><br><span class="muted">${b.start}–${b.end}</span></div>
          ${weekdays.map(day=>`<div><input class="subjectInput" value="${escapeHtml(state.schedule[type]?.[day]?.[i]||"")}" data-type="${type}" data-day="${day}" data-i="${i}" placeholder="Fach"></div>`).join("")}`).join("")}
      </div>
    </div>`).join("");
  wrap.querySelectorAll(".subjectInput").forEach(el=>el.oninput=()=>{
    const t=el.dataset.type,d=el.dataset.day,i=+el.dataset.i;
    state.schedule[t][d][i]=el.value;save();renderToday();
  });
}
function renderCycles(){
  const groups={};
  Object.entries(state.entries).forEach(([k,e])=>{
    const [ds,bi]=k.split("_"),date=parseDate(ds);
    const cs=isoDate(cycleStart(date)),type=weekType(date);
    const id=cs;
    (groups[id]??={start:cycleStart(date),items:[]}).items.push({date,bi:+bi,e,type});
  });
  const sorted=Object.values(groups).sort((a,b)=>b.start-a.start);
  document.querySelector("#cycleList").innerHTML=sorted.length?sorted.map(g=>{
    const end=new Date(g.start);end.setDate(end.getDate()+13);
    let total=0,count=0,spoken=0,cancel=0;
    g.items.forEach(x=>{if(x.e.satisfaction){total+=+x.e.satisfaction;count++} spoken+=+(x.e.spoken||0);if(x.e.cancelled)cancel++});
    return `<div class="card cycle"><h3>${g.start.toLocaleDateString("de-DE")} – ${end.toLocaleDateString("de-DE")}</h3>
      <div class="stat"><div><b>${spoken}</b><span class="muted">Meldungen</span></div><div><b>${count? (total/count).toFixed(1):"–"}</b><span class="muted">Ø Zufriedenheit</span></div><div><b>${cancel}</b><span class="muted">Ausfälle</span></div></div>
      <details><summary>${g.items.length} gespeicherte Stunden</summary>${g.items.sort((a,b)=>a.date-b.date).map(x=>{
        const subj=state.schedule[x.type]?.[weekdays[(x.date.getDay()+6)%7]]?.[x.bi]||"";
        return `<p><b>${x.date.toLocaleDateString("de-DE")}</b> · ${escapeHtml(subj||"—")} · ${x.e.cancelled?"ausgefallen":`${x.e.spoken??0} Meldungen, ${x.e.satisfaction||"–"}/10`}</p>`
      }).join("")}</details>
    </div>`
  }).join(""):'<div class="card"><p class="muted">Noch keine gespeicherten Stunden.</p></div>';
}

function setup(){
  const ref=document.querySelector("#referenceDate");
  ref.value=state.referenceDate;
  ref.onchange=()=>{let d=parseDate(ref.value);if(d.getDay()!==1){showToast("Bitte einen Montag auswählen.");ref.value=state.referenceDate;return}state.referenceDate=ref.value;save();renderToday();renderCycles()};
  document.querySelector("#datePicker").onchange=renderToday;
  document.querySelector("#addBlockBtn").onclick=()=>{
    state.blocks.push({name:`${state.blocks.length+1}. Block`,start:"08:00",end:"09:00"});
    ["A","B"].forEach(t=>weekdays.forEach(d=>state.schedule[t][d].push("")));
    save();renderBlocks();renderSchedule();renderToday();
  };
  document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
    document.querySelector("#"+btn.dataset.tab).classList.add("active");
    if(btn.dataset.tab==="cycles")renderCycles();
  });
  document.querySelector("#exportBtn").onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="schultracker-backup.json";a.click();URL.revokeObjectURL(a.href);
  };
  document.querySelector("#importInput").onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    try{state=JSON.parse(await f.text());save();location.reload()}catch{showToast("Ungültige Datei.")}};
  document.querySelector("#resetBtn").onclick=()=>{
    if(confirm("Wirklich alle Stundenplan- und Feedbackdaten löschen?")){state=structuredClone(defaultState);save();location.reload()}
  };
  renderBlocks();renderSchedule();renderToday();renderCycles();
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.querySelector("#installBtn").classList.remove("hidden")});
document.querySelector("#installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();deferredPrompt=null};
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
setup();
