/* Questify v12_Blueprint_Architecture
   - Implemented sleek blueprints matrix UI theme layer.
   - Removed all space-mode visual layers and switcher triggers.
   - Entirely dropped walkthrough spotlight tutorial nodes and tracking parameters.
*/

const LS_KEY = "questify.v12_blueprint_rpg";

const DEFAULT_STATE = {
  settings: {
    xpPerLevel: 100,
    goldPerLevel: 20,
    spPerLevel: 1
  },
  player: { 
    level: 1, xp: 0, gold: 0, skill: 0,
    healthLvl: 1, healthXp: 0,
    financialLvl: 1, financialXp: 0,
    honeydewLvl: 1, honeydewXp: 0,
    hpTokens: 0, mpTokens: 0, hcTokens: 0
  },
  quests: { side: [], main: [] },
  rewards: [],
  completionLog: []
};

let state = loadState();

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return structuredClone(DEFAULT_STATE);
  try {
    const parsed = JSON.parse(raw);
    parsed.settings = { ...DEFAULT_STATE.settings, ...parsed.settings };
    parsed.player = { ...DEFAULT_STATE.player, ...parsed.player };
    parsed.quests = parsed.quests || { side: [], main: [] };
    parsed.rewards = parsed.rewards || [];
    parsed.completionLog = parsed.completionLog || [];
    return parsed;
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initForms();
  initDangerZone();
  renderAll();
});

function renderAll() {
  renderHUD();
  renderQuestList("side");
  renderQuestList("main");
  renderRewardList();
  syncSettingsForm();
}

/* ---------- RPG System Telemetry Dashboard HUD ---------- */
function renderHUD() {
  const nextXp = xpPerLevel();
  document.getElementById("levelLine").textContent = `Level ${state.player.level} • ${state.player.xp}/${nextXp} XP`;
  document.getElementById("gold").textContent = state.player.gold;
  document.getElementById("skill").textContent = state.player.skill;
  document.getElementById("tokenHp").textContent = state.player.hpTokens || 0;
  document.getElementById("tokenMp").textContent = state.player.mpTokens || 0;
  document.getElementById("tokenHc").textContent = state.player.hcTokens || 0;

  const pct = Math.floor((state.player.xp / nextXp) * 100);
  document.getElementById("xpFill").style.width = `${Math.min(pct, 100)}%`;
  document.getElementById("xpPct").textContent = `${pct}%`;

  // Update System Sub-Attribute Progress Array Tracks
  document.getElementById("txtHealthLvl").textContent = `Rank ${state.player.healthLvl}`;
  document.getElementById("fillHealth").style.width = `${state.player.healthXp}%`;

  document.getElementById("txtFinancialLvl").textContent = `Rank ${state.player.financialLvl}`;
  document.getElementById("fillFinancial").style.width = `${state.player.financialXp}%`;

  document.getElementById("txtHoneydewLvl").textContent = `Rank ${state.player.honeydewLvl}`;
  document.getElementById("fillHoneydew").style.width = `${state.player.honeydewXp}%`;
}

/* ---------- Operational Quest Matrices ---------- */
function renderQuestList(kind) {
  const container = document.getElementById(`${kind}List`);
  if (!container) return;
  container.innerHTML = "";

  const listItems = state.quests[kind] || [];
  if (listItems.length === 0) {
    container.innerHTML = `<div class="hintLine" style="padding:10px 0; margin:0;">No mapped ${kind} operational objectives found.</div>`;
    return;
  }

  const decoratedList = listItems.map(q => {
    let isDone = false;
    let progressLabel = "";
    const categoryIcon = q.category === "Financial" ? "💵" : (q.category === "Honeydew" ? "🍯" : "🍏");
    const categoryName = q.category === "Financial" ? "Treasury Array" : (q.category === "Honeydew" ? "Honeydew Matrix" : "Health Node");

    if (kind === "side") {
      const doneInInterval = completionsForInterval(q.id, q.frequency || "Daily");
      const limit = q.maxCompletions || 1;
      isDone = doneInInterval >= limit;
      progressLabel = `${categoryIcon} ${categoryName} • ${q.frequency || "Daily"} (${doneInInterval}/${limit})`;
    } else {
      isDone = state.completionLog.some(x => x.questId === q.id);
      progressLabel = `${categoryIcon} ${categoryName} • Milestone`;
    }
    return { item: q, isDone, progressLabel };
  });

  decoratedList.sort((a, b) => a.isDone - b.isDone);

  decoratedList.forEach(pack => {
    const q = pack.item;
    const card = document.createElement("div");
    card.className = `itemCard ${pack.isDone ? "completed" : ""}`;

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    
    const title = document.createElement("div");
    title.className = "itemTitle";
    title.textContent = q.label;

    const sub = document.createElement("div");
    sub.className = "itemSubtitle";
    
    const rewardToken = `+${q.xpReward || 0}XP / ${q.goldReward || 0}G` + (q.spReward ? ` / ${q.spReward}SP` : '');
    sub.innerHTML = `<span style="color:var(--accent-light)">${pack.progressLabel}</span> <span style="color:var(--lineSoft)">|</span> <span style="color:#fbbf24">${rewardToken}</span>`;

    meta.appendChild(title);
    meta.appendChild(sub);
    card.appendChild(meta);

    const actionContainer = document.createElement("div");
    actionContainer.style.display = "flex";
    actionContainer.style.gap = "6px";

    if (state.completionLog.some(x => x.questId === q.id)) {
      const undoBtn = document.createElement("button");
      undoBtn.className = "btn btnUndo";
      undoBtn.textContent = "Undo";
      undoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        undoLastCompletion(q.id);
      });
      actionContainer.appendChild(undoBtn);
    }

    const mainBtn = document.createElement("button");
    if (pack.isDone) {
      mainBtn.className = "btn btnDoneState";
      mainBtn.textContent = "✓";
      mainBtn.disabled = true;
    } else {
      mainBtn.className = "btn btnComplete";
      mainBtn.textContent = "Sync Complete";
      mainBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        completeQuest(q.id, kind);
      });
    }

    actionContainer.appendChild(mainBtn);
    card.appendChild(actionContainer);
    card.addEventListener("click", () => openEditModal(q.id, kind));
    container.appendChild(card);
  });
}

/* ---------- Secure Provision Rewards Store Vault ---------- */
function renderRewardList() {
  const container = document.getElementById("rewardList");
  if (!container) return;
  container.innerHTML = "";

  let listItems = [...(state.rewards || [])];
  if (listItems.length === 0) {
    container.innerHTML = `<div class="hintLine" style="padding:10px 0; margin:0;">No privileges or clearables tracked in repository.</div>`;
    return;
  }

  listItems.sort((a, b) => {
    const costA = (a.spCost || 0) * 10000 + (a.hpCost || 0) * 1000 + (a.mpCost || 0) * 1000 + (a.hcCost || 0) * 1000 + (a.goldCost || 0);
    const costB = (b.spCost || 0) * 10000 + (b.hpCost || 0) * 1000 + (b.mpCost || 0) * 1000 + (b.hcCost || 0) * 1000 + (b.goldCost || 0);
    return costA - costB;
  });

  listItems.forEach(r => {
    const card = document.createElement("div");
    card.className = "itemCard";

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    
    const title = document.createElement("div");
    title.className = "itemTitle";
    title.textContent = r.label;

    const sub = document.createElement("div");
    sub.className = "itemSubtitle";

    let costStrings = [];
    if (r.spCost > 0) costStrings.push(`${r.spCost} SP`);
    if (r.goldCost > 0) costStrings.push(`${r.goldCost} Gold`);
    if (r.hpCost > 0) costStrings.push(`🍏 ${r.hpCost} HP`);
    if (r.mpCost > 0) costStrings.push(`💵 ${r.mpCost} MP`);
    if (r.hcCost > 0) costStrings.push(`🍯 ${r.hcCost} Honey`);
    if (costStrings.length === 0) costStrings.push("0 Matrix Resource");

    sub.textContent = costStrings.join(" • ");

    meta.appendChild(title);
    meta.appendChild(sub);
    card.appendChild(meta);

    const buyBtn = document.createElement("button");
    buyBtn.className = "btn btnComplete";
    buyBtn.style.background = "linear-gradient(135deg, #0055ff, #001144)";
    buyBtn.textContent = "Allocate Clear";

    const canAfford = state.player.gold >= (r.goldCost || 0) &&
                      state.player.skill >= (r.spCost || 0) &&
                      (state.player.hpTokens || 0) >= (r.hpCost || 0) &&
                      (state.player.mpTokens || 0) >= (r.mpCost || 0) &&
                      (state.player.hcTokens || 0) >= (r.hcCost || 0);

    if (!canAfford) {
      buyBtn.disabled = true;
      buyBtn.style.opacity = "0.2";
    } else {
      buyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        buyReward(r.id);
      });
    }

    card.addEventListener("click", () => openEditModal(r.id, "reward"));
    card.appendChild(buyBtn);
    container.appendChild(card);
  });
}

/* ---------- Mathematical Loop Scaling Logic ---------- */
function completeQuest(id, kind) {
  const targetList = state.quests[kind] || [];
  const q = targetList.find(x => x.id === id);
  if (!q) return;

  const xpG = Math.max(0, parseInt(q.xpReward) || 0);
  const goldG = Math.max(0, parseInt(q.goldReward) || 0);
  const spG = Math.max(0, parseInt(q.spReward) || 0);
  const selectedCat = q.category || "Health";

  state.completionLog.push({
    id: "log_" + Math.random().toString(16).slice(2) + Date.now(),
    questId: q.id,
    kind: kind,
    category: selectedCat,
    xpGained: xpG,
    goldGained: goldG,
    spGained: spG,
    dateISO: new Date().toISOString()
  });

  applyRewardBonuses(xpG, goldG, spG);
  applyCategoryXp(selectedCat, 25);
  
  toast(`Telemetry Updated: +${xpG} XP`);
  saveState();
  renderAll();
}

function applyCategoryXp(category, amount) {
  let subTitle = "";
  let rewardLine = "";

  if (category === "Health") {
    state.player.healthXp += amount;
    if (state.player.healthXp >= 100) {
      state.player.healthXp -= 100;
      state.player.healthLvl += 1;
      state.player.hpTokens = (state.player.hpTokens || 0) + 1;
      subTitle = "HEALTH ARRAY OPTIMIZED";
      rewardLine = "ALLOCATED 1 VITALS BLOCK (HP) 🍏";
    }
  } else if (category === "Financial") {
    state.player.financialXp += amount;
    if (state.player.financialXp >= 100) {
      state.player.financialXp -= 100;
      state.player.financialLvl += 1;
      state.player.mpTokens = (state.player.mpTokens || 0) + 1;
      subTitle = "TREASURY COUNTER MODIFIED";
      rewardLine = "ALLOCATED 1 CREDIT NODE (MP) 💵";
    }
  } else if (category === "Honeydew") {
    state.player.honeydewXp += amount;
    if (state.player.honeydewXp >= 100) {
      state.player.honeydewXp -= 100;
      state.player.honeydewLvl += 1;
      state.player.hcTokens = (state.player.hcTokens || 0) + 1;
      subTitle = "HONEYDEW PARAMETERS UPGRADED";
      rewardLine = "ALLOCATED 1 HONEYCOMB LINK TOKEN 🍯";
    }
  }

  if (subTitle !== "") {
    startCelebration(subTitle, rewardLine);
  }
}

function undoLastCompletion(questId) {
  const index = findLastIndex(state.completionLog, x => x.questId === questId);
  if (index === -1) return;

  const entry = state.completionLog[index];
  state.completionLog.splice(index, 1);

  state.player.xp -= entry.xpGained;
  state.player.gold -= entry.goldGained;
  state.player.skill -= entry.spGained;

  const targetCat = entry.category || "Health";
  if (targetCat === "Health") {
    state.player.healthXp -= 25;
    if (state.player.healthXp < 0 && state.player.healthLvl > 1) {
      state.player.healthLvl -= 1;
      state.player.healthXp += 100;
      state.player.hpTokens = Math.max(0, (state.player.hpTokens || 0) - 1);
    }
    if (state.player.healthXp < 0) state.player.healthXp = 0;
  } else if (targetCat === "Financial") {
    state.player.financialXp -= 25;
    if (state.player.financialXp < 0 && state.player.financialLvl > 1) {
      state.player.financialLvl -= 1;
      state.player.financialXp += 100;
      state.player.mpTokens = Math.max(0, (state.player.mpTokens || 0) - 1);
    }
    if (state.player.financialXp < 0) state.player.financialXp = 0;
  } else if (targetCat === "Honeydew") {
    state.player.honeydewXp -= 25;
    if (state.player.honeydewXp < 0 && state.player.honeydewLvl > 1) {
      state.player.honeydewLvl -= 1;
      state.player.honeydewXp += 100;
      state.player.hcTokens = Math.max(0, (state.player.hcTokens || 0) - 1);
    }
    if (state.player.honeydewXp < 0) state.player.honeydewXp = 0;
  }

  while (state.player.xp < 0 && state.player.level > 1) {
    state.player.level -= 1;
    state.player.xp += xpPerLevel();
    state.player.gold -= state.settings.goldPerLevel;
    state.player.skill -= state.settings.spPerLevel;
  }

  if (state.player.xp < 0) state.player.xp = 0;
  if (state.player.gold < 0) state.player.gold = 0;
  if (state.player.skill < 0) state.player.skill = 0;

  toast("Telemetry Inversion Complete.");
  saveState();
  renderAll();
}

function buyReward(id) {
  const r = state.rewards.find(x => x.id === id);
  if (!r) return;
  
  const goldCost = r.goldCost || 0;
  const spCost = r.spCost || 0;
  const hpCost = r.hpCost || 0;
  const mpCost = r.mpCost || 0;
  const hcCost = r.hcCost || 0;

  if (state.player.gold >= goldCost && 
      state.player.skill >= spCost && 
      (state.player.hpTokens || 0) >= hpCost && 
      (state.player.mpTokens || 0) >= mpCost && 
      (state.player.hcTokens || 0) >= hcCost) {
    
    state.player.gold -= goldCost;
    state.player.skill -= spCost;
    state.player.hpTokens = (state.player.hpTokens || 0) - hpCost;
    state.player.mpTokens = (state.player.mpTokens || 0) - mpCost;
    state.player.hcTokens = (state.player.hcTokens || 0) - hcCost;

    toast(`Security Allocation Authorized`);
    saveState();
    renderAll();
  }
}

function xpPerLevel() { return state.settings.xpPerLevel || 100; }

function applyRewardBonuses(xp, gold, sp) {
  let currentXp = state.player.xp + xp;
  state.player.gold += gold;
  state.player.skill += sp;

  let leveledUp = false;
  while (currentXp >= xpPerLevel()) {
    currentXp -= xpPerLevel();
    state.player.level += 1;
    state.player.gold += state.settings.goldPerLevel;
    state.player.skill += state.settings.spPerLevel;
    leveledUp = true;
  }
  state.player.xp = currentXp;

  if (leveledUp) startCelebration("MATRIX ARRAY EXPANDED", "INTELLIGENT TELEMETRY EVOLUTION STACK DEPLOYED");
}

/* ---------- Structural Input Parameter Mapping Modals ---------- */
let activeModalKind = null;
let activeModalId = null;

function openCreateModal(kind) {
  activeModalKind = kind;
  activeModalId = null;

  document.getElementById("modalTitle").textContent = `INITIALIZE NEW ${kind.toUpperCase()} INTERFACE`;
  document.getElementById("inputLabel").value = "";
  document.getElementById("modalDelete").style.display = "none";

  const rowSide = document.getElementById("rowSideConfig");
  const rowReward = document.getElementById("rowRewardConfig");
  const rowPayouts = document.getElementById("rowQuestPayouts");
  const fieldCategory = document.getElementById("fieldCategorySelect");

  if (kind === "reward") {
    rowSide.style.display = "none";
    rowPayouts.style.display = "none";
    fieldCategory.style.display = "none";
    rowReward.style.display = "flex";
    
    document.getElementById("inputGoldCost").value = "10";
    document.getElementById("inputSpCost").value = "0";
    document.getElementById("inputHpCost").value = "0";
    document.getElementById("inputMpCost").value = "0";
    document.getElementById("inputHcCost").value = "0";
  } else {
    rowReward.style.display = "none";
    rowPayouts.style.display = "flex";
    fieldCategory.style.display = "flex";
    document.getElementById("selectCategory").value = "Health";
    document.getElementById("inputQuestXp").value = "20";
    document.getElementById("inputQuestGold").value = "5";
    document.getElementById("inputQuestSp").value = "0";

    if (kind === "side") {
      rowSide.style.display = "flex";
      document.getElementById("selectFrequency").value = "Daily";
      document.getElementById("inputMaxCompletions").value = "1";
    } else {
      rowSide.style.display = "none";
    }
  }
  toggleModalOverlay(true);
}

function openEditModal(id, kind) {
  activeModalKind = kind;
  activeModalId = id;

  document.getElementById("modalTitle").textContent = `RECONFIG ${kind.toUpperCase()} METADATA`;
  document.getElementById("modalDelete").style.display = "block";

  const rowSide = document.getElementById("rowSideConfig");
  const rowReward = document.getElementById("rowRewardConfig");
  const rowPayouts = document.getElementById("rowQuestPayouts");
  const fieldCategory = document.getElementById("fieldCategorySelect");

  if (kind === "reward") {
    const r = state.rewards.find(x => x.id === id);
    if (!r) return;
    document.getElementById("inputLabel").value = r.label;
    rowSide.style.display = "none";
    rowPayouts.style.display = "none";
    fieldCategory.style.display = "none";
    rowReward.style.display = "flex";
    
    document.getElementById("inputGoldCost").value = r.goldCost || 0;
    document.getElementById("inputSpCost").value = r.spCost || 0;
    document.getElementById("inputHpCost").value = r.hpCost || 0;
    document.getElementById("inputMpCost").value = r.mpCost || 0;
    document.getElementById("inputHcCost").value = r.hcCost || 0;
  } else {
    const q = state.quests[kind].find(x => x.id === id);
    if (!q) return;
    document.getElementById("inputLabel").value = q.label;
    rowReward.style.display = "none";
    rowPayouts.style.display = "flex";
    fieldCategory.style.display = "flex";
    
    document.getElementById("selectCategory").value = q.category || "Health";
    document.getElementById("inputQuestXp").value = q.xpReward || 0;
    document.getElementById("inputQuestGold").value = q.goldReward || 0;
    document.getElementById("inputQuestSp").value = q.spReward || 0;

    if (kind === "side") {
      rowSide.style.display = "flex";
      document.getElementById("selectFrequency").value = q.frequency || "Daily";
      document.getElementById("inputMaxCompletions").value = q.maxCompletions || 1;
    } else {
      rowSide.style.display = "none";
    }
  }
  toggleModalOverlay(true);
}

function toggleModalOverlay(show) {
  const overlay = document.getElementById("modalOverlay");
  if (show) {
    overlay.classList.add("show");
    overlay.style.display = "flex";
  } else {
    overlay.classList.remove("show");
    setTimeout(() => { overlay.style.display = "none"; }, 150);
  }
}

function saveModalData() {
  const labelVal = document.getElementById("inputLabel").value.trim();
  if (!labelVal) return toast("Descriptor required.");

  if (activeModalId) {
    if (activeModalKind === "reward") {
      const r = state.rewards.find(x => x.id === activeModalId);
      if (r) {
        r.label = labelVal;
        r.goldCost = Math.max(0, parseInt(document.getElementById("inputGoldCost").value) || 0);
        r.spCost = Math.max(0, parseInt(document.getElementById("inputSpCost").value) || 0);
        r.hpCost = Math.max(0, parseInt(document.getElementById("inputHpCost").value) || 0);
        r.mpCost = Math.max(0, parseInt(document.getElementById("inputMpCost").value) || 0);
        r.hcCost = Math.max(0, parseInt(document.getElementById("inputHcCost").value) || 0);
      }
    } else {
      const q = state.quests[activeModalKind].find(x => x.id === activeModalId);
      if (q) {
        q.label = labelVal;
        q.category = document.getElementById("selectCategory").value;
        q.xpReward = Math.max(0, parseInt(document.getElementById("inputQuestXp").value) || 0);
        q.goldReward = Math.max(0, parseInt(document.getElementById("inputQuestGold").value) || 0);
        q.spReward = Math.max(0, parseInt(document.getElementById("inputQuestSp").value) || 0);
        if (activeModalKind === "side") {
          q.frequency = document.getElementById("selectFrequency").value;
          q.maxCompletions = Math.max(1, parseInt(document.getElementById("inputMaxCompletions").value) || 1);
        }
      }
    }
    toast("Configuration Synchronized.");
  } else {
    const newId = "id_" + Math.random().toString(16).slice(2) + Date.now();
    if (activeModalKind === "reward") {
      state.rewards.push({
        id: newId, label: labelVal,
        goldCost: Math.max(0, parseInt(document.getElementById("inputGoldCost").value) || 0),
        spCost: Math.max(0, parseInt(document.getElementById("inputSpCost").value) || 0),
        hpCost: Math.max(0, parseInt(document.getElementById("inputHpCost").value) || 0),
        mpCost: Math.max(0, parseInt(document.getElementById("inputMpCost").value) || 0),
        hcCost: Math.max(0, parseInt(document.getElementById("inputHcCost").value) || 0)
      });
    } else {
      const targetObj = { 
        id: newId, label: labelVal,
        category: document.getElementById("selectCategory").value,
        xpReward: Math.max(0, parseInt(document.getElementById("inputQuestXp").value) || 0),
        goldReward: Math.max(0, parseInt(document.getElementById("inputQuestGold").value) || 0),
        spReward: Math.max(0, parseInt(document.getElementById("inputQuestSp").value) || 0)
      };
      if (activeModalKind === "side") {
        targetObj.frequency = document.getElementById("selectFrequency").value;
        targetObj.maxCompletions = Math.max(1, parseInt(document.getElementById("inputMaxCompletions").value) || 1);
      }
      state.quests[activeModalKind].push(targetObj);
    }
    toast("Object Instantiated.");
  }

  saveState();
  toggleModalOverlay(false);
  renderAll();
}

function deleteModalData() {
  if (!activeModalId) return;
  if (activeModalKind === "reward") {
    state.rewards = state.rewards.filter(x => x.id !== activeModalId);
  } else {
    state.quests[activeModalKind] = state.quests[activeModalKind].filter(x => x.id !== activeModalId);
  }
  toast("Deallocated cleanly.");
  saveState();
  toggleModalOverlay(false);
  renderAll();
}

/* ---------- Secure Counter Reset Mechanism Overrides ---------- */
function initDangerZone() {
  const wipeTrigger = document.getElementById("btnDangerWipe");
  const confirmWindow = document.getElementById("confirmOverlay");
  const confirmTextEl = document.getElementById("confirmInput");
  const executeActionBtn = document.getElementById("confirmExecute");
  const cancelActionBtn = document.getElementById("confirmCancel");
  const closeWindowBtn = document.getElementById("confirmClose");

  let countdownInterval = null;
  let currentCountdown = 0;

  const evaluationCheck = () => {
    const textMatches = confirmTextEl.value.trim().toUpperCase() === "CONFIRM";
    executeActionBtn.disabled = !textMatches || currentCountdown > 0;
  };

  wipeTrigger.addEventListener("click", () => {
    confirmTextEl.value = "";
    currentCountdown = 10;
    executeActionBtn.disabled = true;
    executeActionBtn.textContent = `Execute Truncation (${currentCountdown}s)`;
    
    confirmWindow.classList.add("show");
    confirmWindow.style.display = "flex";

    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      currentCountdown--;
      if (currentCountdown <= 0) {
        clearInterval(countdownInterval);
        executeActionBtn.textContent = "Execute Clear";
      } else {
        executeActionBtn.textContent = `Execute Truncation (${currentCountdown}s)`;
      }
      evaluationCheck();
    }, 1000);
  });

  confirmTextEl.addEventListener("input", evaluationCheck);

  const closeWipeView = () => {
    clearInterval(countdownInterval);
    confirmWindow.classList.remove("show");
    setTimeout(() => { confirmWindow.style.display = "none"; }, 150);
  };

  cancelActionBtn.addEventListener("click", closeWipeView);
  closeWindowBtn.addEventListener("click", closeWipeView);

  executeActionBtn.addEventListener("click", () => {
    if (confirmTextEl.value.trim().toUpperCase() === "CONFIRM" && currentCountdown <= 0) {
      localStorage.clear();
      state = structuredClone(DEFAULT_STATE);
      saveState();
      closeWipeView();
      renderAll();
      toast("Cache Truncated Completely.");
    }
  });
}

/* ---------- Interface Control Tab Listeners ---------- */
function initTabs() {
  document.querySelectorAll(".tabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tabs .tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".views .view").forEach(v => v.classList.remove("active"));

      tab.classList.add("active");
      const targetView = document.getElementById(`view-${tab.dataset.view}`);
      if (targetView) targetView.classList.add("active");
    });
  });

  document.querySelectorAll("[data-action='openCreate']").forEach(btn => {
    btn.addEventListener("click", () => openCreateModal(btn.dataset.kind));
  });
}

function initForms() {
  document.getElementById("modalClose").addEventListener("click", () => toggleModalOverlay(false));
  document.getElementById("modalSave").addEventListener("click", saveModalData);
  document.getElementById("modalDelete").addEventListener("click", deleteModalData);

  ["setXpPerLevel", "setGoldPerLevel", "setSpPerLevel"].forEach(id => {
    document.getElementById(id).addEventListener("change", saveSettingsForm);
  });
}

function syncSettingsForm() {
  document.getElementById("setXpPerLevel").value = state.settings.xpPerLevel;
  document.getElementById("setGoldPerLevel").value = state.settings.goldPerLevel;
  document.getElementById("setSpPerLevel").value = state.settings.spPerLevel;
}

function saveSettingsForm() {
  state.settings.xpPerLevel = Math.max(10, parseInt(document.getElementById("setXpPerLevel").value) || 100);
  state.settings.goldPerLevel = Math.max(0, parseInt(document.getElementById("setGoldPerLevel").value) || 0);
  state.settings.spPerLevel = Math.max(0, parseInt(document.getElementById("setSpPerLevel").value) || 0);
  saveState();
  renderHUD();
}

/* ---------- Particles Grid Overlay Animation Core ---------- */
function startCelebration(title, subtitle) {
  const el = document.getElementById("celebration");
  const wrap = document.getElementById("celebrateParticles");
  if (!el || !wrap) return;

  document.getElementById("txtCelebrationTitle").textContent = title;
  document.getElementById("txtCelebrationSub").textContent = subtitle;

  wrap.innerHTML = "";
  const count = 40;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.style.setProperty("--x0", `${Math.random() * 100}vw`);
    s.style.setProperty("--y0", `${70 + Math.random() * 20}vh`);
    s.style.setProperty("--x1", `${Math.random() * 100}vw`);
    s.style.setProperty("--y1", `${-10 - Math.random() * 20}vh`);
    s.style.animationDelay = `${Math.random() * 0.2}s`;
    wrap.appendChild(s);
  }

  el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); }, 3500);
}

function completionsForInterval(questId, frequency) {
  const start = new Date();
  start.setHours(0,0,0,0);

  if (frequency === "Weekly") {
    const currentDay = start.getDay();
    start.setDate(start.getDate() - currentDay);
  } else if (frequency === "Monthly") {
    start.setDate(1);
  }

  return state.completionLog.filter(x => x.questId === questId && new Date(x.dateISO) >= start).length;
}

function findLastIndex(array, predicate) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) return i;
  }
  return -1;
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 1500);
}