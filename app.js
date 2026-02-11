
function sfxXp(){
  // tiny sparkle
  playTone(880, 70, "sine", 0.03);
  playTone(1320, 55, "triangle", 0.02, 0.02);
}
function sfxCash(){
  // Bright "CHA-CHING!!" jingle (arcade reward style)
  if(!state.settings.sfxOn) return;

  const notes = [
    { f: 880,  d: 120, type: "square",   g: 0.09 },
    { f: 1175, d: 140, type: "square",   g: 0.085 },
    { f: 1568, d: 220, type: "triangle", g: 0.08 }
  ];

  let delay = 0;
  notes.forEach(n => {
    setTimeout(() => {
      playTone(n.f, n.d, n.type, n.g);
      // sparkle octave layer
      playTone(n.f * 2, Math.max(80, n.d - 40), "triangle", 0.05);
    }, delay);
    delay += 90;
  });
}
/* Questify v6
   - App rename Questify
   - No preloaded quests/rewards/achievements
   - Settings: Test button that seeds Achievements with 1 of each trophy tier
   - Level-up: louder/longer trumpet + full-screen confetti burst
*/

const LS_KEY = "questify.v6";
function wipeAllUserData(){
  // Remove all Questify-related localStorage keys (covers older versions too).
  try{
    const keysToRemove = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k) continue;
      if(/^questify/i.test(k)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => {
      try{ localStorage.removeItem(k); }catch{ /* ignore */ }
    });
  }catch{
    // last resort: remove the main key only
    try{ localStorage.removeItem(LS_KEY); }catch{ /* ignore */ }
  }
}


const BADGE_TIERS = [
  { name: "Iron",     color: "#94a3b8" },
  { name: "Bronze",   color: "#c08457" },
  { name: "Silver",   color: "#cbd5e1" },
  { name: "Gold",     color: "#fbbf24" },
  { name: "Diamond",  color: "#7dd3fc" },
  { name: "Ruby",     color: "#fb7185" },
  { name: "Sapphire", color: "#60a5fa" },
  { name: "Emerald",  color: "#34d399" },
  { name: "Obsidian", color: "#111827" },
  { name: "Platinum", color: "#e5e7eb" }
];
const PLATINUM = BADGE_TIERS[BADGE_TIERS.length - 1];

const DEFAULT_STATE = {
  settings: {
    xpPerLevel: 100,
    goldPerLevel: 20,
    spPerLevel: 1,
    sfxOn: true,
    musicOn: true},
  player: { level: 1, xp: 0, lifetimeXP: 0, lifetimeGold: 0, lifetimeSp: 0, gold: 0, skill: 0 },
  quests: { side: [], main: [] },
  rewards: [],
  completionLog: []
};

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return structuredClone(DEFAULT_STATE);
  try { return JSON.parse(raw); } catch { return structuredClone(DEFAULT_STATE); }
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function normalizeState(s){
  s = s || structuredClone(DEFAULT_STATE);
  s.settings = s.settings || structuredClone(DEFAULT_STATE.settings);
  if(typeof s.settings.sfxOn !== "boolean") s.settings.sfxOn = true;
  if(typeof s.settings.musicOn !== "boolean") s.settings.musicOn = true;
  if(!Number.isFinite(s.settings.goldPerLevel)) s.settings.goldPerLevel = 20;
  if(!Number.isFinite(s.settings.spPerLevel)) s.settings.spPerLevel = 1;
  s.player = s.player || structuredClone(DEFAULT_STATE.player);
  if(!Number.isFinite(s.player.lifetimeGold)) s.player.lifetimeGold = 0;
  if(!Number.isFinite(s.player.lifetimeSp)) s.player.lifetimeSp = 0;
  if(!Number.isFinite(s.player.lifetimeXP)) s.player.lifetimeXP = 0;
  s.quests = s.quests || {side:[], main:[]};
  s.quests.side = s.quests.side || [];
  s.quests.main = s.quests.main || [];
  s.rewards = s.rewards || [];
  s.completionLog = s.completionLog || [];
  return s;
}
let state = normalizeState(loadState());

/* ---------- Audio (procedural WebAudio) ---------- */
let audioCtx = null;
function ensureAudio(){
  if(audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Small "pop" for any button click
function sfxClick(){
  // short, bright pop (gaming UI-style)
  playTone(520, 28, "square", 0.03);
  playTone(1040, 22, "triangle", 0.018);
}

/* ---------- Background music (procedural, looped) ---------- */
let bgm = {
  started: false,
  master: null,
  filter: null,
  oscs: [],
  lfo: null,
  lfoGain: null,
  timer: null,
  arpTimer: null,
  step: 0
};

function startBgmIfNeeded(){
  if(!state?.settings?.musicOn) return;
  const ctx = ensureAudio();
  // iOS/Safari: resume context on user gesture
  if(ctx.state === "suspended") ctx.resume?.();
  if(bgm.started) return;
  bgm.started = true;

  // -------- Space-exploration ambient BGM (procedural) --------
  // Design goals:
  // - Slow, wide pad with gentle movement
  // - Soft arpeggio "scanner" that feels like traveling through space
  // - Very light delay for depth (still subtle so it won't annoy)

  const master = ctx.createGain();
  master.gain.value = 0.0001;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  filter.Q.value = 0.75;

  // Delay (wet) + dry mix
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = 0.90;
  wet.gain.value = 0.22;

  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.34;
  const fb = ctx.createGain();
  fb.gain.value = 0.24;
  delay.connect(fb).connect(delay);

  master.connect(filter);
  filter.connect(dry).connect(ctx.destination);
  filter.connect(delay);
  delay.connect(wet).connect(ctx.destination);

  bgm.master = master;
  bgm.filter = filter;

  // 4-voice pad (low drone + 3 chord voices)
  const makePadOsc = (type, detuneCents=0, gain=0.07) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detuneCents;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(master);
    o.start();
    return {o, g};
  };

  const drone = makePadOsc("sine", -12, 0.06);
  const p1 = makePadOsc("triangle", -6, 0.065);
  const p2 = makePadOsc("sine", 6, 0.065);
  const p3 = makePadOsc("triangle", 0, 0.06);
  bgm.oscs = [drone.o, p1.o, p2.o, p3.o];

  // gentle detune drift / vibrato
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 10; // cents
  lfo.connect(lfoGain);
  bgm.oscs.forEach(o => lfoGain.connect(o.detune));
  lfo.start();
  bgm.lfo = lfo;
  bgm.lfoGain = lfoGain;

  // Fade in (slow)
  const t0 = ctx.currentTime;
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.060, t0 + 2.2);

  // Spacey progression: sus/add9 chords (in D)
  const chords = [
    // [root, third, fifth, ninth] (Hz)
    [146.83, 220.00, 293.66, 329.63], // Dsus2 (D A D F#-ish)
    [130.81, 196.00, 261.63, 293.66], // Csus2
    [164.81, 246.94, 329.63, 369.99], // Esus2
    [110.00, 164.81, 220.00, 246.94]  // Asus2
  ];

  const applyChord = (freqs) => {
    const t = ctx.currentTime;
    const glide = 0.35;
    // drone sits at the root (octave down)
    bgm.oscs[0].frequency.exponentialRampToValueAtTime(Math.max(35, freqs[0] / 2), t + glide);
    bgm.oscs[1].frequency.exponentialRampToValueAtTime(Math.max(40, freqs[1]), t + glide);
    bgm.oscs[2].frequency.exponentialRampToValueAtTime(Math.max(40, freqs[2]), t + glide);
    bgm.oscs[3].frequency.exponentialRampToValueAtTime(Math.max(40, freqs[3]), t + glide);
  };

  // Arp "scanner" note (independent of SFX toggle)
  const playBgmNote = (freq, durationMs=180) => {
    if(!state?.settings?.musicOn) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.020, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationMs/1000);
    // a slightly brighter branch for the arp only
    const arpFilter = ctx.createBiquadFilter();
    arpFilter.type = "bandpass";
    arpFilter.frequency.value = 1400;
    arpFilter.Q.value = 0.9;
    o.frequency.setValueAtTime(freq, t);
    o.connect(g).connect(arpFilter).connect(master);
    o.start(t);
    o.stop(t + durationMs/1000 + 0.03);
  };

  // initialize
  applyChord(chords[0]);
  bgm.step = 0;

  // chord changes (slow)
  bgm.timer = setInterval(() => {
    if(!state?.settings?.musicOn) return;
    bgm.step = (bgm.step + 1) % chords.length;
    applyChord(chords[bgm.step]);
  }, 6000);

  // arp pattern synced to the current chord (simple, calm)
  const arpOrder = [0, 2, 1, 3, 2, 3, 1, 2];
  let arpIdx = 0;
  bgm.arpTimer = setInterval(() => {
    if(!state?.settings?.musicOn) return;
    const c = chords[bgm.step];
    const n = c[arpOrder[arpIdx % arpOrder.length]];
    // nudge up an octave sometimes for motion
    const octave = (arpIdx % 8 === 6) ? 2 : 1;
    playBgmNote(n * octave, 160);
    arpIdx++;
  }, 520);
}

function syncAudioToggles(){
  // If user turns SFX off, keep music obeying musicOn only.
  // If musicOn off, fade out.
  if(!bgm.master || !audioCtx) return;
  const ctx = audioCtx;
  const on = !!state?.settings?.musicOn;
  const t = ctx.currentTime;
  const target = on ? 0.060 : 0.0001;
  bgm.master.gain.cancelScheduledValues(t);
  bgm.master.gain.setValueAtTime(Math.max(0.0001, bgm.master.gain.value), t);
  bgm.master.gain.exponentialRampToValueAtTime(target, t + 0.35);
}

function stopBgm(){
  // Fully stop oscillators/timers (used for reset)
  try{
    if(bgm.timer){ clearInterval(bgm.timer); bgm.timer = null; }
    if(bgm.arpTimer){ clearInterval(bgm.arpTimer); bgm.arpTimer = null; }
    const ctx = audioCtx;
    if(ctx){
      if(bgm.master){
        const t = ctx.currentTime;
        bgm.master.gain.cancelScheduledValues(t);
        bgm.master.gain.setValueAtTime(Math.max(0.0001, bgm.master.gain.value), t);
        bgm.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      }
      if(bgm.oscs && bgm.oscs.length){
        bgm.oscs.forEach(o => { try{ o.stop(); }catch{} });
      }
      if(bgm.lfo){ try{ bgm.lfo.stop(); }catch{} }
    }
  }catch{ /* ignore */ }
  bgm.started = false;
  bgm.master = null;
  bgm.filter = null;
  bgm.oscs = [];
  bgm.lfo = null;
  bgm.lfoGain = null;
}

function bindFirstInteractionAudio(){
  // Autoplay restrictions (iOS/Safari): must start audio after a user gesture.
  const kick = () => {
    try{
      ensureAudio();
      startBgmIfNeeded();
      syncAudioToggles();
    }catch{ /* ignore */ }
    window.removeEventListener("pointerdown", kick);
    window.removeEventListener("touchstart", kick);
    window.removeEventListener("keydown", kick);
  };
  window.addEventListener("pointerdown", kick, {passive:true});
  window.addEventListener("touchstart", kick, {passive:true});
  window.addEventListener("keydown", kick);
}

function bindGlobalClickSfx(){
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest?.("button, .btn, .iconBtn, .tab, .themeBtn");
    if(!el) return;
    // don't play if disabled
    if(el.disabled) return;
    if(state?.settings?.sfxOn !== true) return;
    ensureAudio();
    sfxClick();
  }, {passive:true});
}
function playTone(freq, durationMs, type="sine", gain=0.08){
  if(!state.settings.sfxOn) return;
  const ctx = ensureAudio();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs/1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs/1000 + 0.02);
}
function sfxComplete(){ playTone(420, 110, "sine", 0.08); setTimeout(() => playTone(680, 100, "triangle", 0.07), 50); }
function sfxPurchase(){ playTone(880, 140, "triangle", 0.08); setTimeout(() => playTone(660, 120, "sine", 0.06), 70); }
function sfxLevelUp(){
  // louder + longer trumpet-ish fanfare
  if(!state.settings.sfxOn) return;
  const seq = [
    {f:392, d:260, t:"sawtooth"},
    {f:494, d:260, t:"sawtooth"},
    {f:587, d:300, t:"sawtooth"},
    {f:784, d:320, t:"sawtooth"},
    {f:988, d:520, t:"sawtooth"},
  ];
  let at = 0;
  seq.forEach(n => {
    setTimeout(() => {
      playTone(n.f, n.d, n.t, 0.085);
      // add a soft octave layer for "brass body"
      playTone(n.f * 2, Math.max(120, n.d-80), "triangle", 0.03);
    }, at);
    at += 210;
  });
}

/* ---------- Celebration overlay (5s) ---------- */
function startCelebration(){
  const el = document.getElementById("celebration");
  const wrap = document.getElementById("celebrateParticles");
  if(!el || !wrap) return;

  // build particles (recreate each time for fresh randomness)
  wrap.innerHTML = "";
  const count = 48;
  for(let i=0;i<count;i++){
    const s = document.createElement("span");
    const x0 = `${Math.random()*100}vw`;
    const y0 = `${60 + Math.random()*35}vh`;
    const x1 = `${Math.random()*100}vw`;
    const y1 = `${-20 - Math.random()*30}vh`;
    s.style.setProperty("--x0", x0);
    s.style.setProperty("--y0", y0);
    s.style.setProperty("--x1", x1);
    s.style.setProperty("--y1", y1);
    s.style.animationDelay = `${Math.random()*0.35}s`;
    s.style.transform = "translate(var(--x0), var(--y0))";
    wrap.appendChild(s);
  }

  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
  }, 5000);
}
/* ---------- Leveling ---------- */
function xpPerLevel(){
  const base = 100;
  const scale = 1.1;
  return Math.floor(base * Math.pow(scale, Math.max(0, state.player.level - 1)));
}
function addXP(amount){
  const gained = Number(amount || 0);
  if(gained <= 0) return;
  state.player.lifetimeXP += gained;

  let total = state.player.xp + gained;
  let leveled = false;
  while(total >= xpPerLevel()){
    total -= xpPerLevel();
    state.player.level += 1;
    state.player.gold += state.settings.goldPerLevel;
    state.player.skill += state.settings.spPerLevel;
    state.player.lifetimeGold += state.settings.goldPerLevel;
    state.player.lifetimeSp += state.settings.spPerLevel;
    leveled = true;
    toast(`LEVEL UP! +${state.settings.goldPerLevel} GOLD • +${state.settings.spPerLevel} SP`);
  }
  state.player.xp = total;

  if(leveled){
    sfxLevelUp();
    startCelebration();
  }
}
function progressPct(){ return Math.min(state.player.xp / xpPerLevel(), 1); }

/* ---------- Time helpers ---------- */
function nowISO(){ return new Date().toISOString(); }
function isSameDay(aISO, bISO){
  const a = new Date(aISO), b = new Date(bISO);
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function startOfWeekISO(d){
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date.toISOString();
}
function isSameWeek(aISO, bISO){ return startOfWeekISO(aISO) === startOfWeekISO(bISO); }
function msUntilMidnight(){
  const d = new Date();
  const next = new Date(d);
  next.setHours(24,0,0,0);
  return Math.max(0, next.getTime() - d.getTime());
}
function formatCountdown(ms){
  const s = Math.floor(ms/1000);
  const hh = String(Math.floor(s/3600)).padStart(2,"0");
  const mm = String(Math.floor((s%3600)/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}
function formatShortDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {year:"numeric", month:"short", day:"2-digit"});
  }catch{ return ""; }
}

/* ---------- Completion rules ---------- */
function completionsForQuestToday(questId){
  const n = nowISO();
  return state.completionLog.filter(x => x.questId===questId && isSameDay(x.dateISO, n)).length;
}
function completedThisWeek(questId){
  const n = nowISO();
  return state.completionLog.some(x => x.questId===questId && isSameWeek(x.dateISO, n));
}
function completedOnce(questId){ return state.completionLog.some(x => x.questId===questId); }
function mainCompletionDate(questId){
  const entry = state.completionLog.find(x => x.type==="main" && x.questId===questId);
  return entry ? entry.dateISO : null;
}
function canComplete(quest){
  if(!quest.active) return false;
  if(quest.freq === "once") return !completedOnce(quest.id);
  if(quest.freq === "weekly") return !completedThisWeek(quest.id);
  const doneToday = completionsForQuestToday(quest.id);
  const max = Number(quest.maxPerDay ?? 1);
  return doneToday < max;
}
function questCooldownLabel(quest){
  if(quest.freq === "daily"){
    const doneToday = completionsForQuestToday(quest.id);
    const max = Number(quest.maxPerDay ?? 1);
    if(doneToday >= max) return `READY IN ${formatCountdown(msUntilMidnight())}`;
  }
  if(quest.freq === "weekly" && completedThisWeek(quest.id)) return "READY NEXT WEEK";
  if(quest.freq === "once" && completedOnce(quest.id)) return "COMPLETED";
  return "";
}

/* ---------- Achievements ---------- */
function sideCompletionCount(questId){
  return state.completionLog.filter(x => x.type==="side" && x.questId===questId).length;
}
function mainCompleted(questId){
  return state.completionLog.some(x => x.type==="main" && x.questId===questId);
}
function sideBadgeTierIndex(count){ return Math.min(Math.floor(count/10), BADGE_TIERS.length-1); }
function sideBadgeProgress(count){
  const tierIdx = sideBadgeTierIndex(count);
  const nextAt = (tierIdx+1)*10;
  const into = count - (tierIdx*10);
  const pct = Math.min(into/10, 1);
  return {tierIdx, nextAt, into, pct};
}

/* ---------- Rewards ---------- */
function canBuyReward(r){ return state.player.gold >= r.goldCost && state.player.skill >= r.spCost; }

/* ---------- Actions ---------- */
function completeQuest(type, questId){
  const list = type==="side" ? state.quests.side : state.quests.main;
  const q = list.find(x => x.id===questId);
  if(!q || !canComplete(q)) return;

  const xpEarned = Number(q.xp || 0);
  state.completionLog.unshift({
    id: cryptoId(),
    questId: q.id,
    questTitle: q.title,
    type,
    xpEarned,
    dateISO: nowISO()
  });
  addXP(xpEarned);
  saveState();
  renderAll();
  sfxComplete();
  toast(`+${xpEarned} XP`);
}
function buyReward(rewardId){
  const r = state.rewards.find(x => x.id===rewardId);
  if(!r || !canBuyReward(r)) return;
  state.player.gold -= r.goldCost;
  state.player.skill -= r.spCost;
  r.purchasedCount = (r.purchasedCount||0)+1;
  saveState();
  renderAll();
  // Cha-ching + quick "Purchased" pop
  sfxCash();
  showPurchasePop("PURCHASED");
  toast(`BOUGHT: ${r.title}`);
}

/* ---------- Modal system ---------- */
const modal = { el:null, body:null, title:null, hint:null, deleteBtn:null, mode:null, kind:null, id:null };

function openModal({mode, kind, id=null}){
  modal.mode = mode; modal.kind = kind; modal.id = id;
  modal.el.classList.add("show");
  modal.el.setAttribute("aria-hidden", "false");

  const isEdit = mode==="edit";
  modal.deleteBtn.style.display = isEdit ? "" : "none";

  const fields = buildFieldsFor(kind, isEdit ? getRecord(kind,id) : null);
  modal.body.innerHTML = "";
  fields.forEach(f => modal.body.appendChild(f));

  modal.title.textContent = `${isEdit ? "Edit" : "Add"} ${kind==="reward" ? "Reward" : "Quest"}`;
  modal.hint.textContent =
    kind==="main" ? "Main quests are one-time. Completing gives PLATINUM." :
    kind==="side" ? "Side quests repeat daily/weekly. Trophies upgrade every 10 completions." :
    "Rewards can be purchased when affordable.";

  const first = modal.body.querySelector("input, select");
  if(first) setTimeout(() => first.focus(), 30);
}
function closeModal(){
  modal.el.classList.remove("show");
  modal.el.setAttribute("aria-hidden", "true");
  modal.body.innerHTML = "";
  modal.mode=null; modal.kind=null; modal.id=null;
}
function getRecord(kind,id){
  if(kind==="side") return state.quests.side.find(x=>x.id===id);
  if(kind==="main") return state.quests.main.find(x=>x.id===id);
  if(kind==="reward") return state.rewards.find(x=>x.id===id);
  return null;
}
function buildField({label,id,value="",inputmode=null,options=null,disabled=false}){
  const wrap = document.createElement("div");
  wrap.className="field";
  const lab = document.createElement("label");
  lab.htmlFor=id; lab.textContent=label;
  wrap.appendChild(lab);

  let el;
  if(options){
    el = document.createElement("select");
    options.forEach(o=>{
      const opt=document.createElement("option");
      opt.value=o.value; opt.textContent=o.text;
      if(String(o.value)===String(value)) opt.selected=true;
      el.appendChild(opt);
    });
  } else {
    el = document.createElement("input");
    el.type = (inputmode === "numeric") ? "number" : "text";
    el.value=value ?? "";
    if(inputmode) el.inputMode=inputmode;
    if(inputmode === "numeric"){ el.pattern = "[0-9]*"; }
  }
  el.id=id; el.disabled=!!disabled;
  wrap.appendChild(el);
  return wrap;
}
function buildFieldsFor(kind, rec){
  const elems=[];
  if(kind==="reward"){
    elems.push(buildField({label:"Reward name", id:"f_title", value:rec?.title ?? ""}));
    elems.push(buildField({label:"Gold cost", id:"f_gold", value:String(rec?.goldCost ?? 0), inputmode:"numeric"}));
    elems.push(buildField({label:"SP cost", id:"f_sp", value:String(rec?.spCost ?? 0), inputmode:"numeric"}));
    return elems;
  }
  elems.push(buildField({label:"Quest name", id:"f_title", value:rec?.title ?? ""}));
  elems.push(buildField({label:"XP per completion", id:"f_xp", value:String(rec?.xp ?? 1), inputmode:"numeric"}));

  if(kind==="side"){
    const freq=rec?.freq ?? "daily";
    // Segmented picker (to avoid native white select UI on mobile)
    const segWrap = document.createElement("div");
    segWrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = "Frequency";
    segWrap.appendChild(lab);

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "f_freq";
    hidden.value = (freq==="weekly") ? "weekly" : "daily";
    segWrap.appendChild(hidden);

    const seg = document.createElement("div");
    seg.className = "seg";

    const btnDaily = document.createElement("button");
    btnDaily.type = "button";
    btnDaily.textContent = "DAILY";
    const btnWeekly = document.createElement("button");
    btnWeekly.type = "button";
    btnWeekly.textContent = "WEEKLY";

    const setSel = (val) => {
      hidden.value = val;
      btnDaily.classList.toggle("selected", val === "daily");
      btnWeekly.classList.toggle("selected", val === "weekly");
      const maxEl = document.getElementById("f_max");
      if(maxEl) maxEl.disabled = (val === "weekly");
    };

    btnDaily.addEventListener("click", () => setSel("daily"));
    btnWeekly.addEventListener("click", () => setSel("weekly"));

    seg.appendChild(btnDaily);
    seg.appendChild(btnWeekly);
    segWrap.appendChild(seg);
    elems.push(segWrap);

    elems.push(buildField({label:"Max per day (daily only)", id:"f_max", value:String(rec?.maxPerDay ?? 1), inputmode:"numeric"}));
    setTimeout(()=> setSel(hidden.value), 0);
  }
  return elems;
}
function toSafeInt(v, fallback){
  const n=parseInt(String(v ?? "").replace(/[^0-9]/g,""),10);
  return Number.isFinite(n) ? n : fallback;
}
function readModalValues(){
  const title=document.getElementById("f_title")?.value?.trim();
  if(!title) return {error:"NAME REQUIRED"};
  const xp=toSafeInt(document.getElementById("f_xp")?.value, 1);

  if(modal.kind==="reward"){
    const gold=toSafeInt(document.getElementById("f_gold")?.value, 0);
    const sp=toSafeInt(document.getElementById("f_sp")?.value, 0);
    return {title, xp, gold, sp};
  }
  if(modal.kind==="side"){
    const freq=document.getElementById("f_freq")?.value==="weekly" ? "weekly" : "daily";
    let max=toSafeInt(document.getElementById("f_max")?.value, 1);
    if(freq==="weekly") max=1;
    return {title, xp, freq, max};
  }
  return {title, xp, freq:"once"};
}
function saveModal(){
  const v=readModalValues();
  if(v.error){ toast(v.error); return; }

  if(modal.kind==="reward"){
    if(modal.mode==="create"){
      state.rewards.unshift({id:cryptoId(), title:v.title, goldCost:v.gold, spCost:v.sp, purchasedCount:0});
      toast("REWARD ADDED");
    } else {
      const r=state.rewards.find(x=>x.id===modal.id);
      if(r){ r.title=v.title; r.goldCost=v.gold; r.spCost=v.sp; toast("REWARD UPDATED"); }
    }
    saveState(); renderAll(); closeModal(); return;
  }

  if(modal.kind==="side"){
    if(modal.mode==="create"){
      state.quests.side.unshift({id:cryptoId(), title:v.title, xp:v.xp, freq:v.freq, maxPerDay:v.max, active:true});
      toast("QUEST ADDED");
    } else {
      const q=state.quests.side.find(x=>x.id===modal.id);
      if(q){ q.title=v.title; q.xp=v.xp; q.freq=v.freq; q.maxPerDay=v.max; toast("QUEST UPDATED"); }
    }
    saveState(); renderAll(); closeModal(); return;
  }

  if(modal.kind==="main"){
    if(modal.mode==="create"){
      state.quests.main.unshift({id:cryptoId(), title:v.title, xp:v.xp, freq:"once", active:true});
      toast("QUEST ADDED");
    } else {
      const q=state.quests.main.find(x=>x.id===modal.id);
      if(q){ q.title=v.title; q.xp=v.xp; toast("QUEST UPDATED"); }
    }
    saveState(); renderAll(); closeModal(); return;
  }
}
function deleteModalRecord(){
  if(modal.mode!=="edit") return;
  if(modal.kind==="reward"){
    state.rewards = state.rewards.filter(x=>x.id!==modal.id);
    toast("REWARD DELETED");
  } else if(modal.kind==="side"){
    state.quests.side = state.quests.side.filter(x=>x.id!==modal.id);
    toast("QUEST DELETED");
  } else if(modal.kind==="main"){
    state.quests.main = state.quests.main.filter(x=>x.id!==modal.id);
    toast("QUEST DELETED");
  }
  saveState(); renderAll(); closeModal();
}


/* ---------- Theme (removed) ---------- */
function applyTheme(){
  // Themes removed: keep base styling only.
  document.body.removeAttribute("data-theme");
}

/* ---------- Confirm reset ---------- */
function openConfirmReset(){
  const ov = document.getElementById("confirmOverlay");
  const input = document.getElementById("confirmInput");
  const btn = document.getElementById("confirmDoReset");
  if(!ov || !input || !btn) return;
  ov.style.display = "block";
  ov.setAttribute("aria-hidden","false");
  input.value = "";
  btn.disabled = true;
  setTimeout(()=>{ input.focus(); }, 50);
}
function closeConfirmReset(){
  const ov = document.getElementById("confirmOverlay");
  if(!ov) return;
  ov.style.display = "none";
  ov.setAttribute("aria-hidden","true");
}
/* ---------- Rendering ---------- */
const $ = (sel) => document.querySelector(sel);
const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" stroke-width="2"/>
  <path d="M19.4 15a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6H9.1l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0-.1 1c0 .3 0 .7.1 1l-2 1.5 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.6h5.8l.4-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

function renderHeader(){
  $("#levelLine").textContent = `LEVEL ${state.player.level} • ${state.player.xp}/${xpPerLevel()} XP`;
  $("#gold").textContent = state.player.gold;
  $("#skill").textContent = state.player.skill;

  const pct = Math.round(progressPct()*100);
  $("#xpFill").style.width = `${pct}%`;
  $("#xpPct").textContent = `${pct}%`;

  $("#lifetimeXp").textContent = state.player.lifetimeXP;
  const lg = document.getElementById("lifetimeGold");
  const ls = document.getElementById("lifetimeSp");
  if(lg) lg.textContent = state.player.lifetimeGold;
  if(ls) ls.textContent = state.player.lifetimeSp;

  const today = nowISO();
  const todayXp = state.completionLog.filter(x => isSameDay(x.dateISO, today))
    .reduce((s,x) => s + (Number(x.xpEarned)||0), 0);
  $("#todayXp").textContent = `${todayXp} XP`;
}

function renderQuestList(type){
  const root = type==="side" ? $("#sideList") : $("#mainList");
  const list = type==="side" ? state.quests.side : state.quests.main;
  root.innerHTML = "";

  if(list.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="meta"><div class="name">NO ${type==="side" ? "SIDE" : "MAIN"} QUESTS YET</div><div class="desc">TAP + ADD TO CREATE ONE</div></div>`;
    root.appendChild(empty);
    return;
  }

  list.filter(q => q.active).forEach(q => {
    const disabled = !canComplete(q);
    const meta = [];
    meta.push(`${q.xp} XP`);
    if(q.freq === "weekly") meta.push("1/WEEK");
    if(q.freq === "daily") meta.push(`MAX/DAY: ${q.maxPerDay ?? 1}`);
    if(q.freq === "once") meta.push("ONE-TIME");

    if(type==="side" && q.freq==="daily"){
      const doneToday = completionsForQuestToday(q.id);
      meta.push(`TODAY: ${doneToday}/${q.maxPerDay ?? 1}`);
    }
    if(type==="side" && q.freq==="weekly"){
      meta.push(completedThisWeek(q.id) ? "DONE THIS WEEK" : "READY");
    }
    if(type==="main"){
      const done = mainCompleted(q.id);
      meta.push(done ? "COMPLETED" : "READY");
      const date = mainCompletionDate(q.id);
      if(done && date) meta.push(`DATE: ${formatShortDate(date)}`);
    }

    const cooldown = questCooldownLabel(q);

    let btnClass = "btn btnComplete available";
    let btnText = "COMPLETE";

    if(type==="main" && mainCompleted(q.id)){
      btnClass = "btn btnComplete done";
      btnText = "COMPLETED";
    } else if(type==="side"){
      if(q.freq==="weekly" && completedThisWeek(q.id)){
        btnClass = "btn btnComplete cooldown";
        btnText = "COMPLETED";
      } else if(q.freq==="daily"){
        const doneToday = completionsForQuestToday(q.id);
        const max = Number(q.maxPerDay ?? 1);
        if(doneToday >= max){
          btnClass = "btn btnComplete cooldown";
          btnText = cooldown || "READY IN 00:00:00";
        }
      }
    }

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="meta">
        <div class="name">${escapeHtml(q.title)}</div>
        <div class="desc">${escapeHtml(meta.join(" • "))}${cooldown ? ` • ${escapeHtml(cooldown)}` : ""}</div>
      </div>
      <div class="rowBtns">
        <button class="${btnClass}" ${disabled ? "disabled" : ""} data-action="complete" data-type="${type}" data-id="${q.id}">${btnText}</button>
        <button class="iconBtn" data-action="openEdit" data-kind="${type}" data-id="${q.id}" aria-label="Edit">${GEAR_SVG}</button>
      </div>
    `;
    root.appendChild(el);
  });
}

function renderRewards(){
  const root = $("#rewardList");
  root.innerHTML = "";

  if(state.rewards.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="meta"><div class="name">NO REWARDS YET</div><div class="desc">TAP + ADD TO CREATE ONE</div></div>`;
    root.appendChild(empty);
    return;
  }

  state.rewards.forEach(r => {
    const ok = canBuyReward(r);
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="meta">
        <div class="name">${escapeHtml(r.title)}</div>
        <div class="desc">COST: ${r.goldCost} GOLD • ${r.spCost} SP • OWNED: ${r.purchasedCount || 0}</div>
      </div>
      <div class="rowBtns">
        <button class="btn" ${ok ? "" : "disabled"} data-action="buy" data-id="${r.id}">BUY</button>
        <button class="iconBtn" data-action="openEdit" data-kind="reward" data-id="${r.id}" aria-label="Edit">${GEAR_SVG}</button>
      </div>
    `;
    root.appendChild(el);
  });
}

function renderAchievements(){
  const root = $("#badgeList");
  root.innerHTML = "";

  const side = state.quests.side.filter(q=>q.active);
  if(side.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="meta"><div class="name">NO SIDE TROPHIES YET</div><div class="desc">COMPLETE SIDE QUESTS TO UNLOCK TROPHIES</div></div>`;
    root.appendChild(empty);
  } else {
    side.forEach(q => {
      const count = sideCompletionCount(q.id);
      const p = sideBadgeProgress(count);
      const tier = BADGE_TIERS[p.tierIdx];
      const nextLabel = p.tierIdx >= BADGE_TIERS.length-1 ? "MAX TIER" : `NEXT IN ${p.nextAt - count}`;
      const pct = Math.round(p.pct * 100);

      const el = document.createElement("div");
      el.className = "trophyCard";
      el.setAttribute("data-tier", tier.name.toLowerCase());
      el.style.setProperty("--tier", tier.color);
      el.innerHTML = `
        <div class="trophyInner">
          <div class="trophyIcon">
            <div class="sparkles"><span></span><span></span><span></span><span></span></div>
            <svg class="trophySvg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="12" y1="10" x2="52" y2="54">
      <stop offset="0" stop-color="var(--tierHi)"/>
      <stop offset="0.55" stop-color="var(--tier)"/>
      <stop offset="1" stop-color="var(--tierLo)"/>
    </linearGradient>
    <linearGradient id="shine" x1="20" y1="14" x2="44" y2="50">
      <stop offset="0" stop-color="rgba(255,255,255,.80)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <path d="M20 10h24v10c0 9-6 16-12 16S20 29 20 20V10Z" fill="url(#g)" stroke="rgba(255,255,255,.28)" stroke-width="2" />
  <path d="M23 14h6c0 9-2 14-6 16" stroke="url(#shine)" stroke-width="4" stroke-linecap="round" opacity=".55"/>
  <path d="M44 12h10v6c0 8-6 14-14 14" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 12H10v6c0 8 6 14 14 14" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
  <path d="M28 36h8v6c0 3 2 6 6 6H22c4 0 6-3 6-6v-6Z" fill="url(#g)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
  <path d="M18 50h28v6H18v-6Z" fill="url(#g)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
</svg>
          </div>
          <div class="trophyMeta">
            <div class="trophyTitle">${escapeHtml(q.title)}</div>
            <div class="trophyTierLine">
              <div class="tierPill"><b>${tier.name}</b></div>
              <div>COMPLETIONS: <b>${count}</b></div>
              <div>${nextLabel}</div>
            </div>
            <div class="trophySub">UPGRADES EVERY 10 COMPLETIONS</div>
            <div class="trophyProg"><div class="trophyProgFill" style="width:${pct}%"></div></div>
          </div>
        </div>
      `;
      root.appendChild(el);
    });
  }

  const mainRoot = $("#mainBadgeList");
  mainRoot.innerHTML = "";
  const main = state.quests.main.filter(q=>q.active);
  if(main.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="meta"><div class="name">NO MAIN TROPHIES YET</div><div class="desc">COMPLETE MAIN QUESTS TO UNLOCK PLATINUM</div></div>`;
    mainRoot.appendChild(empty);
  } else {
    main.forEach(q => {
      const done = mainCompleted(q.id);
      const date = mainCompletionDate(q.id);
      const el = document.createElement("div");
      el.className = "trophyCard";
      el.setAttribute("data-tier", "platinum");
      el.style.setProperty("--tier", PLATINUM.color);
      el.innerHTML = `
        <div class="trophyInner">
          <div class="trophyIcon">
            <div class="sparkles"><span></span><span></span><span></span><span></span></div>
            <div style="opacity:${done ? "1" : ".25"}"><svg class="trophySvg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="12" y1="10" x2="52" y2="54">
      <stop offset="0" stop-color="var(--tierHi)"/>
      <stop offset="0.55" stop-color="var(--tier)"/>
      <stop offset="1" stop-color="var(--tierLo)"/>
    </linearGradient>
    <linearGradient id="shine" x1="20" y1="14" x2="44" y2="50">
      <stop offset="0" stop-color="rgba(255,255,255,.80)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <path d="M20 10h24v10c0 9-6 16-12 16S20 29 20 20V10Z" fill="url(#g)" stroke="rgba(255,255,255,.28)" stroke-width="2" />
  <path d="M23 14h6c0 9-2 14-6 16" stroke="url(#shine)" stroke-width="4" stroke-linecap="round" opacity=".55"/>
  <path d="M44 12h10v6c0 8-6 14-14 14" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
  <path d="M20 12H10v6c0 8 6 14 14 14" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
  <path d="M28 36h8v6c0 3 2 6 6 6H22c4 0 6-3 6-6v-6Z" fill="url(#g)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
  <path d="M18 50h28v6H18v-6Z" fill="url(#g)" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
</svg></div>
          </div>
          <div class="trophyMeta">
            <div class="trophyTitle">${escapeHtml(q.title)}</div>
            <div class="trophyTierLine">
              <div class="tierPill"><b>PLATINUM</b></div>
              <div>STATUS: <b>${done ? "COMPLETED" : "LOCKED"}</b></div>
              ${done && date ? `<div>DATE: <b>${formatShortDate(date)}</b></div>` : ""}
            </div>
            <div class="trophySub">${done ? "TROPHY UNLOCKED" : "COMPLETE THIS MAIN QUEST TO UNLOCK"}</div>
          </div>
        </div>
      `;
      mainRoot.appendChild(el);
    });
  }
}

/* ---------- Navigation / Events ---------- */
function wireTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`#view-${btn.dataset.view}`).classList.add("active");
    });
  });
}
function modalEl(){ return document.getElementById("modal"); }
function initModal(){
  modal.el = modalEl();
  modal.body = document.getElementById("modalBody");
  modal.title = document.getElementById("modalTitle");
  modal.hint = document.getElementById("modalHint");
  modal.deleteBtn = document.getElementById("modalDelete");
}
function wireEvents(){
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-action]");
    if(btn && state.settings.sfxOn) ensureAudio();

    if(!(btn instanceof HTMLElement)) return;
    const action = btn.dataset.action;
    if(action === "complete") completeQuest(btn.dataset.type, btn.dataset.id);
    else if(action === "buy") buyReward(btn.dataset.id);
    else if(action === "openEdit") openModal({mode:"edit", kind: btn.dataset.kind, id: btn.dataset.id});
    else if(action === "openCreate") openModal({mode:"create", kind: btn.dataset.kind});
    else if(action === "closeModal") closeModal();
  });

  document.getElementById("modalSave").addEventListener("click", saveModal);
  document.getElementById("modalDelete").addEventListener("click", deleteModalRecord);

  document.getElementById("saveSettings").addEventListener("click", () => {
    state.settings.goldPerLevel = toSafeInt(document.getElementById("goldPerLevel").value, 20);
    state.settings.spPerLevel = toSafeInt(document.getElementById("spPerLevel").value, 1);
    saveState(); renderAll(); toast("SETTINGS SAVED");
  });
  document.getElementById("toggleSfx").addEventListener("click", () => {
    state.settings.sfxOn = !state.settings.sfxOn;
    saveState(); renderSettings();
    toast(state.settings.sfxOn ? "SFX ON" : "SFX OFF");
    if(state.settings.sfxOn){ ensureAudio(); playTone(660, 80, "sine", 0.04); }

  });

  const toggleMusicBtn = document.getElementById("toggleMusic");
  if(toggleMusicBtn){
    toggleMusicBtn.addEventListener("click", () => {
      state.settings.musicOn = !state.settings.musicOn;
      saveState(); renderSettings();
      toast(state.settings.musicOn ? "MUSIC ON" : "MUSIC OFF");
      ensureAudio();
      if(state.settings.musicOn){
        startBgmIfNeeded();
      }
      syncAudioToggles();
    });
  }

  const deleteAllBtn = document.getElementById("deleteAllData");
  if(deleteAllBtn){
    deleteAllBtn.addEventListener("click", () => {
      openConfirmReset();
    });
  }
  document.getElementById("resetBadges").addEventListener("click", () => {
    state.completionLog = [];
    saveState(); renderAll(); toast("TROPHIES RESET");
  });

  window.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && modalEl().classList.contains("show")) closeModal();
  });

  // Confirm reset overlay wiring
  const cClose = document.getElementById("confirmClose");
  const cCancel = document.getElementById("confirmCancel");
  const cInput = document.getElementById("confirmInput");
  const cDo = document.getElementById("confirmDoReset");
  const cOv = document.getElementById("confirmOverlay");
  if(cClose) cClose.addEventListener("click", closeConfirmReset);
  if(cCancel) cCancel.addEventListener("click", closeConfirmReset);
  if(cOv) cOv.addEventListener("click", (e)=>{ if(e.target === cOv) closeConfirmReset(); });
  if(cInput && cDo){
    cInput.addEventListener("input", ()=>{
      cDo.disabled = (cInput.value.trim().toUpperCase() !== "CONFIRM");
    });
  }
  if(cDo){
    cDo.addEventListener("click", ()=>{
      if(cDo.disabled) return;

      // Hard wipe + fresh defaults
      wipeAllUserData();
      stopBgm(); // ensure BGM doesn't keep running after wipe

      closeConfirmReset();
      // Full reload ensures a truly clean slate (no lingering in-memory state).
      location.reload();
    });
  }

}

/* ---------- Rendering continued ---------- */
function renderSettings(){
  document.getElementById("xpPerLevel").value = xpPerLevel();
  document.getElementById("goldPerLevel").value = String(state.settings.goldPerLevel);
  document.getElementById("spPerLevel").value = String(state.settings.spPerLevel);
  document.getElementById("toggleSfx").textContent = state.settings.sfxOn ? "ON" : "OFF";
  const tm = document.getElementById("toggleMusic");
  if(tm) tm.textContent = state.settings.musicOn ? "ON" : "OFF";
  syncAudioToggles();
}
function renderAll(){
  renderHeader();
  renderQuestList("side");
  renderQuestList("main");
  renderRewards();
  renderAchievements();
  renderSettings();
}

/* ---------- Tick timers ---------- */
let tickHandle = null;
function startTick(){
  if(tickHandle) return;
  tickHandle = setInterval(() => {
    renderQuestList("side");
  }, 1000);
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
}

function showPurchasePop(text="PURCHASED"){
  const pop = document.getElementById("purchasePop");
  const t = document.getElementById("purchasePopText");
  if(!pop || !t) return;
  t.textContent = text;
  pop.classList.remove("show");
  // force reflow to restart animation
  void pop.offsetWidth;
  pop.classList.add("show");
  pop.setAttribute("aria-hidden","false");
  setTimeout(()=>{
    pop.classList.remove("show");
    pop.setAttribute("aria-hidden","true");
  }, 1150);
}

/* ---------- Helpers ---------- */
function cryptoId(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* ---------- Boot ---------- */
function boot(){
  initModal();
  saveState(); // ensure key exists
  wireTabs();
  wireEvents();
  bindFirstInteractionAudio();
  bindGlobalClickSfx();
  renderAll();
  startTick();
}
boot();
