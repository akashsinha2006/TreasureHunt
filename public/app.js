const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MED=["🥇","🥈","🥉"],SH=["▲","◆","●","■"];
const ADMIN=location.hash==="#admin";
let T=null,PID=null,V=null,off=0,err="",jerr="",aerr="",view=null,D=[],RS=[],sig="",fetchedFor="";
try{T=sessionStorage.getItem("adm");PID=localStorage.getItem("pid")}catch(e){}
window.onhashchange=()=>location.reload();

async function api(a,x={}){
 const r=await fetch("/api/game",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({a,t:T,pid:PID,...x})});
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok)throw Object.assign(new Error(j.e||"Server error ("+r.status+")"),{status:r.status});
 return j}
async function poll(){
 if(ADMIN&&!T)return;
 try{V=await api("state");off=V.now-Date.now();err="";
  if(V.gone){PID=null;try{localStorage.removeItem("pid")}catch(e){}}}
 catch(e){if(e.status===401&&ADMIN){T=null;try{sessionStorage.removeItem("adm")}catch(x){}aerr=e.message;return render()}err=e.message}
 const {now,...rest}=V||{};const s=JSON.stringify([rest,err]);
 if(s!==sig){sig=s;render()}}
async function act(a,x){try{await api(a,x);err=""}catch(e){err=e.message}sig="";await poll();render()}

/* ---------- shared pieces ---------- */
const left=()=>V?Math.max(0,V.t0+V.dur*1000-(Date.now()+off)):0;
const ringH=()=>`<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="rb"/><circle cx="50" cy="50" r="44" class="rf" id="rf" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><div class="tm" id="tm">${Math.ceil(left()/1000)}</div></div>`;
const errH=()=>err?`<div class="card c" style="color:#c00">${esc(err)}</div>`:"";
const bd=(l,me)=>{const mx=Math.max(1,(l[0]||{}).s||0);return l.map((p,i)=>`<div class="row" style="--w:${Math.round(100*p.s/mx)}%"><b>${MED[i]||i+1}</b><span>${esc(p.n)}${me&&p.n===me?" (you)":""}</span><em>${p.s}</em></div>`).join("")||'<p class="mut c">No players yet</p>'};
const podium=l=>l.length?`<div class="pod">`+[1,0,2].filter(i=>l[i]).map(i=>`<div class="pc p${i}"><div class="pn">${esc(l[i].n)}</div><div class="ps">${l[i].s}</div><div class="pb">${MED[i]}</div></div>`).join("")+`</div>`:"";
function opts(o,click,cor,mine){return `<div class="opts">`+o.map((t,i)=>{let c="opt o"+i;if(cor!==undefined)c+=i===cor?" ok":" dim";if(mine===i)c+=" mine";return `<button class="${c}" ${click?`onclick="pick(${i})"`:"disabled"}>${SH[i]} ${esc(t)}</button>`}).join("")+`</div>`}
function reviewH(list){return `<div class="card"><h2>✅ Correct answers</h2>`+list.map((r,i)=>{
 let you="";if(r.m!==undefined)you=r.m===-1?`<small class="mut">You did not answer</small>`:r.m===r.c?`<small style="color:#1a7f37">Your answer was correct · +${r.p}</small>`:`<small style="color:#c0392b">Your answer: ${esc(r.o[r.m])}</small>`;
 return `<div class="qa"><div><b>${i+1}.</b> ${esc(r.t)}</div><div>✔ <b>${esc(r.o[r.c])}</b></div>${you}</div>`}).join("")+`</div>`}

/* ---------- player ---------- */
function playerH(){
 if(!PID)return `<div class="card"><h2>Join the quiz</h2><input id="jc" placeholder="Game code (required)" autocapitalize="characters" value="${esc($("#jc")?$("#jc").value:"")}"><input id="jn" placeholder="Your name (required)" maxlength="20" value="${esc($("#jn")?$("#jn").value:"")}"><p style="color:#c00;margin:4px 0">${esc(jerr)}</p><button onclick="join()">Join</button> <a class="lnk" href="#admin">Admin sign in</a></div>`;
 if(!V)return `<div class="card c"><h2>Connecting…</h2></div>`;
 const v=V,me=v.name;
 if(v.phase==="lobby")return `<div class="card c"><h2>You’re in, ${esc(me)}! 🎉</h2><p class="mut">Waiting for the host to start… ${v.count} player(s) joined.</p></div>`;
 if(v.phase==="question"){const open=!v.myAns&&left()>0;
  return `<div class="card"><p class="mut c">Question ${v.q+1} of ${v.n}</p><div class="q">${esc(v.question.t)}</div>${ringH()}</div>${open?opts(v.question.o,true):`<div class="card c"><h2>${v.myAns?"Answer locked in ✔":"Time’s up!"}</h2><p class="mut">Waiting for the results…</p></div>`}`}
 if(v.phase==="reveal"){const m=v.myAns,ok=m&&m.p>0;
  return `<div class="card c"><h2>${ok?"Correct! 🎉":m?"Not quite":"No answer"}</h2><p class="big">+${m?m.p:0}</p><p class="mut">Correct answer: ${esc(v.question.o[v.correct])}</p><p>Rank <b>#${v.rank}</b> · ${v.score} points</p></div><div class="card"><h2>Leaderboard</h2>${bd(v.board,me)}</div>`}
 return `<div class="card c"><h2>Game over</h2><p class="big">#${v.rank}</p><p>${v.score} points</p></div>${podium(v.board)}<div class="card"><h2>🏆 Final leaderboard</h2>${bd(v.board,me)}</div>`}
async function join(){try{const r=await api("join",{code:$("#jc").value,name:$("#jn").value});PID=r.pid;try{localStorage.setItem("pid",PID)}catch(e){}jerr=""}catch(e){jerr=e.message}sig="";await poll();render()}
async function pick(i){if(V.myAns)return;V.myAns={c:i};render();try{await api("answer",{c:i})}catch(e){err=e.message}poll()}

/* ---------- admin ---------- */
function loginH(){return `<div class="card"><h2>Admin sign in</h2><input id="au" placeholder="Username" autocomplete="username" value="${esc($("#au")?$("#au").value:"")}"><input id="ap" type="password" placeholder="Password" autocomplete="current-password" onkeydown="if(event.key==='Enter')login()"><p style="color:#c00;margin:4px 0">${esc(aerr)}</p><button onclick="login()">Sign in</button> <a class="lnk" href="#">Player view</a></div>`}
async function login(){try{const r=await api("login",{u:$("#au").value.trim(),p:$("#ap").value});T=r.t;try{sessionStorage.setItem("adm",T)}catch(e){}aerr="";sig="";await poll();render()}catch(e){aerr=e.message;render()}}
function logout(){T=null;try{sessionStorage.removeItem("adm")}catch(e){}V=null;render()}
function adminH(){
 if(!V)return `<div class="card c"><h2>Connecting…</h2></div>`;
 const v=V,out=`<p class="c"><button class="ghost" onclick="logout()">Sign out admin</button></p>`;
 if(!v.code)return `<div class="card c"><h2>Welcome, admin</h2><p class="mut">Create a game to get a join code for your participants.</p><button onclick="act('newgame')">Generate game code</button></div>`+out;
 if(v.phase==="lobby")return `<div class="card"><p class="mut c">Participants open <b>${esc(location.origin)}</b> and enter this code</p><div class="code">${esc(v.code)}</div><p class="c"><button class="ghost2" onclick="if(confirm('Make a new code and remove current players?'))act('newgame')">↻ New code</button></p></div>
 <div class="card"><h2>Players (${v.count})</h2><div class="chips">${v.names.map(p=>`<span class="chip">${esc(p.n)}</span>`).join("")||'<span class="mut">Waiting for players…</span>'}</div></div>
 <div class="card c"><label class="mut">Seconds per question <input id="dur" type="number" min="5" max="300" value="${$('#dur')?$('#dur').value:(v.dur||60)}" style="width:90px;text-align:center"></label><p><button class="big" ${v.count?"":"disabled"} onclick="act('start',{dur:+$('#dur').value})">Start quiz</button></p><p><button class="ghost" onclick="openEd()">✏️ Edit questions (${v.n})</button> <button class="ghost" onclick="openRes()">📊 Past results</button></p></div>${out}`;
 const last=v.q+1>=v.n;
 if(v.phase==="question")return `<div class="card"><p class="mut c">Question ${v.q+1} of ${v.n} · ${v.answered}/${v.count} answered</p><div class="q">${esc(v.question.t)}</div>${ringH()}</div>${opts(v.question.o,false)}<p class="c"><button onclick="act('reveal')">Show results</button></p>`;
 if(v.phase==="reveal")return `<div class="card"><p class="mut c">Question ${v.q+1} of ${v.n}</p><div class="q">${esc(v.question.t)}</div></div>${opts(v.question.o,false,v.correct)}<div class="card"><h2>Leaderboard</h2>${bd(v.board)}</div><p class="c"><button onclick="act('next')">${last?"Final results":"Next question"}</button></p>`;
 return `${podium(v.board)}<div class="card"><h2>🏆 Final leaderboard</h2>${bd(v.board)}</div>${reviewH(v.review)}<p class="c"><button onclick="openRes()">📊 Saved results & CSV</button> <button class="ghost" onclick="if(confirm('Start a fresh game?'))act('newgame')">New game</button></p>`}

/* admin: question editor */
async function openEd(){try{D=(await api("getq")).list.map(q=>({t:q.t,o:q.o.slice(),c:q.c}));view="edit";render()}catch(e){err=e.message;render()}}
function drawEd(){$("#app").innerHTML=`<div id="ed"><div class="card"><h2>Edit questions (${D.length})</h2><p class="mut">Tick the correct answer. Press Save to update the quiz for everyone.</p><p id="em" style="color:#c00;margin:0"></p></div>`+D.map((q,i)=>`<div class="card qe"><div class="qh"><b>Question ${i+1}</b><button class="ghost2" onclick="delQ(${i})">Delete</button></div><textarea rows="2" placeholder="Question text" oninput="D[${i}].t=this.value">${esc(q.t)}</textarea>`+q.o.map((o,j)=>`<label class="oe"><input type="radio" name="c${i}" ${q.c===j?"checked":""} onchange="D[${i}].c=${j}"><input class="ot" placeholder="Option ${"ABCD"[j]}" value="${esc(o)}" oninput="D[${i}].o[${j}]=this.value"></label>`).join("")+`</div>`).join("")+`<p class="c"><button onclick="D.push({t:'',o:['','','',''],c:0});drawEd();scrollTo(0,document.body.scrollHeight)">+ Add question</button> <button onclick="saveQ()">Save</button> <button class="ghost" onclick="view=null;render()">Cancel</button> <button class="ghost" onclick="resetQ()">Restore original 30</button></p></div>`}
function delQ(i){if(D.length>1){D.splice(i,1);drawEd()}}
async function saveQ(){try{await api("saveq",{list:D});view=null;sig="";await poll();render()}catch(e){$("#em").textContent=e.message;scrollTo(0,0)}}
async function resetQ(){if(!confirm("Restore the original 30 questions? Your edits will be replaced."))return;try{await api("resetq");await openEd()}catch(e){err=e.message}}

/* admin: saved results */
const fmt=t=>new Date(t).toLocaleString([],{dateStyle:"medium",timeStyle:"short"});
async function openRes(){try{RS=(await api("results")).list;view="list";render()}catch(e){err=e.message;render()}}
function resH(){
 if(view==="list")return `<div class="card"><h2>📊 Saved quiz results</h2><p class="mut">${RS.length?"Tap a quiz to see the leaderboard.":"Nothing yet. Results are saved when a quiz ends."}</p></div>`+RS.map(r=>`<div class="card rl" onclick="view='${r.gid}';render()"><div><b>${fmt(r.at)}</b><div class="mut">Code ${esc(r.code)} · ${r.players.length} players</div></div><div class="c">🥇 ${esc((r.players[0]||{}).n||"-")}<br><b>${(r.players[0]||{}).s||0}</b></div></div>`).join("")+`<p class="c"><button class="ghost" onclick="view=null;render()">← Back</button></p>`;
 const r=RS.find(x=>x.gid===view);if(!r){view="list";return resH()}
 const n=r.qs.length,mx=Math.max(1,(r.players[0]||{}).s||0);
 return `<div class="card"><h2>${fmt(r.at)}</h2><p class="mut">Code ${esc(r.code)} · ${r.players.length} players · ${n} questions</p><p><button onclick="csv('${r.gid}')">⬇ Download CSV</button> <button class="ghost2" onclick="delR('${r.gid}')">Delete</button></p></div><div class="card"><h2>🏆 Leaderboard</h2>`+r.players.map((p,i)=>`<div class="row" style="--w:${Math.round(100*p.s/mx)}%"><b>${MED[i]||i+1}</b><span>${esc(p.n)}</span><small class="mut">${p.p.filter(x=>x>0).length}/${n} ✔</small><em>${p.s}</em></div>`).join("")+`</div><div class="card"><h2>Question accuracy</h2>`+r.qs.map((q,i)=>{const k=r.players.filter(p=>p.c[i]===q.c).length,pc=r.players.length?Math.round(100*k/r.players.length):0;return `<div class="qa"><div>${i+1}. ${esc(q.t)}</div><div class="bar"><i style="width:${pc}%"></i></div><small class="mut">${pc}% correct (${k}/${r.players.length})</small></div>`}).join("")+`</div><p class="c"><button class="ghost" onclick="view='list';render()">← All results</button></p>`}
function csv(id){const r=RS.find(x=>x.gid===id);if(!r)return;
 const q=v=>'"'+String(v).replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';
 const rows=[["Rank","Name","Score","Correct"].concat(r.qs.map((_,i)=>"Q"+(i+1)+" points"))];
 r.players.forEach((p,i)=>rows.push([i+1,p.n,p.s,p.p.filter(x=>x>0).length].concat(p.p)));
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(x=>x.map(q).join(",")).join("\n")],{type:"text/csv"}));a.download="quiz-results-"+new Date(r.at).toISOString().slice(0,10)+".csv";a.click()}
async function delR(id){if(!confirm("Delete this saved result permanently?"))return;try{await api("delresult",{id});RS=RS.filter(x=>x.gid!==id);view="list";render()}catch(e){err=e.message;render()}}

/* ---------- render + timer ---------- */
function render(){const a=$("#app");
 if(ADMIN){
  if(!T){if(!$("#au"))a.innerHTML=loginH();else if(aerr){a.innerHTML=loginH()}return}
  if(view==="edit"){if(!$("#ed"))drawEd();return}
  a.innerHTML=view?resH():errH()+adminH();return}
 if(!PID&&$("#jc")&&!jerr)return;
 a.innerHTML=errH()+playerH()}
setInterval(()=>{if(!V||V.phase!=="question")return;
 const l=left(),tm=$("#tm");
 if(tm){tm.textContent=Math.ceil(l/1000);const rg=$(".ring");if(rg)rg.classList.toggle("low",l<=10000);const rf=$("#rf");if(rf)rf.style.strokeDashoffset=276.5*(1-l/(V.dur*1000))}
 const k=V.q+":"+V.t0;if(l<=0&&fetchedFor!==k){fetchedFor=k;poll()}},250);
render();poll();setInterval(poll,1500);
