/* Questify - Complete Fixed Version */

const GAME_STORAGE_KEY = "questify.simple_rpg";

const STARTING_GAME_STATE = {
  settings: {
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
  completionLog: [],
  purchaseHistory: []
};

let gameState = loadGameData();

// Helper to safely attach listeners without crashing the app
function safeListen(id, event, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, callback);
  }
}

function loadGameData() {
  const savedData = localStorage.getItem(GAME_STORAGE_KEY);
  if (!savedData) return structuredClone(STARTING_GAME_STATE);
  try {
    const parsedData = JSON.parse(savedData);
    parsedData.settings = { ...STARTING_GAME_STATE.settings, ...parsedData.settings };
    parsedData.player = { ...STARTING_GAME_STATE.player, ...parsedData.player };
    parsedData.quests = parsedData.quests || { side: [], main: [] };
    parsedData.rewards = parsedData.rewards || [];
    parsedData.completionLog = parsedData.completionLog || [];
    parsedData.purchaseHistory = parsedData.purchaseHistory || [];
    return parsedData;
  } catch {
    return structuredClone(STARTING_GAME_STATE);
  }
}

function saveGameData() {
  localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupForms();
  setupResetButton();
  refreshScreen();
  startCountdownTicker();
});

/* ---------- Live Countdown Ticker ---------- */
let countdownTickerInterval = null;

function startCountdownTicker() {
  if (countdownTickerInterval) clearInterval(countdownTickerInterval);
  countdownTickerInterval = setInterval(() => {
    const countdownEls = document.querySelectorAll(".itemCountdown");
    countdownEls.forEach(el => {
      const questId = el.dataset.questId;
      const frequency = el.dataset.frequency;
      const maxCompletions = parseInt(el.dataset.maxCompletions) || 1;
      // Build a minimal quest object for getResetCountdown
      const q = { id: questId, frequency, maxCompletions };
      const text = getResetCountdown(q);
      el.textContent = text || "";
      // If countdown expired, trigger a full refresh so the quest unlocks
      if (!text) {
        refreshScreen();
      }
    });
  }, 1000);
}

function refreshScreen() {
  updatePlayerStats();
  showQuestsList("side");
  showQuestsList("main");
  showRewardsList();
  updateSettingsFormNumbers();
}

function getXpNeeded() {
  return 95 + (gameState.player.level * 5);
}

/* ---------- Player Stats Dashboard ---------- */
function updatePlayerStats() {
  const pointsNeeded = getXpNeeded();
  const levelLine = document.getElementById("levelLine");
  if (levelLine) levelLine.textContent = `Level ${gameState.player.level} • ${gameState.player.xp}/${pointsNeeded} XP`;
  
  const gold = document.getElementById("gold");
  if (gold) gold.textContent = gameState.player.gold;
  
  const skill = document.getElementById("skill");
  if (skill) skill.textContent = gameState.player.skill;
  
  const tokenHp = document.getElementById("tokenHp");
  if (tokenHp) tokenHp.textContent = gameState.player.hpTokens || 0;
  
  const tokenHc = document.getElementById("tokenHc");
  if (tokenHc) tokenHc.textContent = gameState.player.hcTokens || 0;

  const xpFill = document.getElementById("xpFill");
  const xpPct = document.getElementById("xpPct");
  const progressPercent = Math.floor((gameState.player.xp / pointsNeeded) * 100);
  if (xpFill) xpFill.style.width = `${Math.min(progressPercent, 100)}%`;
  if (xpPct) xpPct.textContent = `${progressPercent}%`;

  const fillHealth = document.getElementById("fillHealth");
  if (fillHealth) fillHealth.style.width = `${gameState.player.healthXp}%`;
  
  const fillFinancial = document.getElementById("fillFinancial");
  if (fillFinancial) fillFinancial.style.width = `${gameState.player.financialXp}%`;
  
  const fillHoneydew = document.getElementById("fillHoneydew");
  if (fillHoneydew) fillHoneydew.style.width = `${gameState.player.honeydewXp}%`;
}

/* ---------- Reset Countdown Helper ---------- */
function getResetCountdown(quest) {
  const now = new Date();
  const frequency = quest.frequency || "Daily";
  const maxTimes = quest.maxCompletions || 1;

  // Find the most recent completion for this quest
  const logs = gameState.completionLog
    .filter(x => x.questId === quest.id)
    .map(x => new Date(x.dateISO))
    .sort((a, b) => b - a);

  let resetAt = null;

  if (frequency === "Daily") {
    // Resets at midnight tonight
    resetAt = new Date(now);
    resetAt.setHours(24, 0, 0, 0);

  } else if (frequency === "Weekly") {
    // Resets Sunday at midnight (start of next Sunday)
    resetAt = new Date(now);
    const daysUntilSunday = (7 - resetAt.getDay()) % 7 || 7;
    resetAt.setDate(resetAt.getDate() + daysUntilSunday);
    resetAt.setHours(0, 0, 0, 0);

  } else if (frequency === "Monthly") {
    // Per-completion interval: 30 days / maxTimes
    const intervalDays = Math.round(30 / maxTimes);
    const lastDone = logs[0];
    if (lastDone) {
      resetAt = new Date(lastDone.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    }
  }

  if (!resetAt) return null;

  const msLeft = resetAt - now;
  if (msLeft <= 0) return null;

  const totalSecs = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 0) {
    return `⏳ Resets in ${days}d ${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `⏳ Resets in ${hours}h ${mins}m ${secs}s`;
  } else {
    return `⏳ Resets in ${mins}m ${secs}s`;
  }
}

/* ---------- Quests List ---------- */
function showQuestsList(questType) {
  const listContainer = document.getElementById(`${questType}List`);
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const items = gameState.quests[questType] || [];
  if (items.length === 0) {
    listContainer.innerHTML = `<div class="hintLine" style="padding:10px 0; margin:0;">No ${questType} quests found.</div>`;
    return;
  }

  const sortedItems = items.map(quest => {
    let completed = false;
    let labelText = "";
    const badgeIcon = quest.category === "Financial" ? "🪙" : (quest.category === "Honeydew" ? "🍯" : "❤️");
    const sectionName = quest.category === "Financial" ? "Money" : (quest.category === "Honeydew" ? "Honeydew" : "Health");

    if (questType === "side") {
      const timesDone = checkCompletions(quest.id, quest.frequency || "Daily");
      const maxTimes = quest.maxCompletions || 1;
      completed = timesDone >= maxTimes;
      labelText = `${badgeIcon} ${sectionName} • ${quest.frequency || "Daily"} (${timesDone}/${maxTimes})`;
    } else {
      completed = gameState.completionLog.some(log => log.questId === quest.id);
      labelText = `${badgeIcon} ${sectionName} • Milestone`;
    }
    return { quest, completed, labelText };
  });

  sortedItems.sort((a, b) => a.completed - b.completed);

  sortedItems.forEach(pack => {
    const q = pack.quest;
    const cardElement = document.createElement("div");
    cardElement.className = `itemCard ${pack.completed ? "completed" : ""}`;

    const textSection = document.createElement("div");
    textSection.className = "itemMeta";
    
    const titleElement = document.createElement("div");
    titleElement.className = "itemTitle";
    titleElement.textContent = q.label;

    const subTextElement = document.createElement("div");
    subTextElement.className = "itemSubtitle";
    
    const rewardString = `+${q.xpReward || 0}XP / ${q.goldReward || 0}G` + (q.spReward ? ` / ${q.spReward}SP` : '');
    subTextElement.innerHTML = `<span style="color:var(--accent-light)">${pack.labelText}</span> <span style="color:var(--lineSoft)">|</span> <span style="color:#fbbf24">${rewardString}</span>`;

    textSection.appendChild(titleElement);
    textSection.appendChild(subTextElement);

    if (questType === "side" && pack.completed) {
      const countdownEl = document.createElement("div");
      countdownEl.className = "itemCountdown";
      countdownEl.dataset.questId = q.id;
      countdownEl.dataset.frequency = q.frequency || "Daily";
      countdownEl.dataset.maxCompletions = q.maxCompletions || 1;
      const initial = getResetCountdown(q);
      countdownEl.textContent = initial || "";
      textSection.appendChild(countdownEl);
    }

    cardElement.appendChild(textSection);

    const buttonGroup = document.createElement("div");
    buttonGroup.style.display = "flex";
    buttonGroup.style.gap = "6px";

    if (gameState.completionLog.some(log => log.questId === q.id)) {
      const undoButton = document.createElement("button");
      undoButton.className = "btn btnUndo";
      undoButton.textContent = "Undo";
      undoButton.addEventListener("click", (e) => {
        e.stopPropagation();
        undoQuestCompletion(q.id);
      });
      buttonGroup.appendChild(undoButton);
    }

    const actionButton = document.createElement("button");
    if (pack.completed) {
      actionButton.className = "btn btnDoneState";
      actionButton.textContent = "✓";
      actionButton.disabled = true;
    } else {
      actionButton.className = "btn btnComplete";
      actionButton.textContent = "Complete";
      actionButton.addEventListener("click", (e) => {
        e.stopPropagation();
        finishQuest(q.id, questType);
      });
    }

    const editButton = document.createElement("button");
    editButton.className = "iconBtn";
    editButton.innerHTML = "⚙️";
    editButton.title = "Edit Quest";
    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      openPopupBox(q.id, questType);
    });

    buttonGroup.appendChild(actionButton);
    buttonGroup.appendChild(editButton);
    cardElement.appendChild(buttonGroup);
    listContainer.appendChild(cardElement);
  });
}

/* ---------- Rewards Store ---------- */
function showRewardsList() {
  const listContainer = document.getElementById("rewardList");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  let rewardItems = [...(gameState.rewards || [])];
  if (rewardItems.length === 0) {
    listContainer.innerHTML = `<div class="hintLine" style="padding:10px 0; margin:0;">No rewards added yet.</div>`;
    return;
  }

  rewardItems.sort((a, b) => {
    const scoreA = (a.spCost || 0) * 10000 + (a.hpCost || 0) * 1000 + (a.hcCost || 0) * 1000 + (a.goldCost || 0);
    const scoreB = (b.spCost || 0) * 10000 + (b.hpCost || 0) * 1000 + (b.hcCost || 0) * 1000 + (b.goldCost || 0);
    return scoreA - scoreB;
  });

  rewardItems.forEach(r => {
    const cardElement = document.createElement("div");
    cardElement.className = "itemCard";

    const textSection = document.createElement("div");
    textSection.className = "itemMeta";
    
    const titleElement = document.createElement("div");
    titleElement.className = "itemTitle";
    titleElement.textContent = r.label;

    const subTextElement = document.createElement("div");
    subTextElement.className = "itemSubtitle";

    let costMessages = [];
    if (r.spCost > 0) costMessages.push(`${r.spCost} SP`);
    if (r.goldCost > 0) costMessages.push(`${r.goldCost} Gold`);
    if (r.hpCost > 0) costMessages.push(`❤️ ${r.hpCost} Life Points`);
    if (r.hcCost > 0) costMessages.push(`🍯 ${r.hcCost} Honey`);
    if (costMessages.length === 0) costMessages.push("Free");

    subTextElement.textContent = costMessages.join(" • ");

    textSection.appendChild(titleElement);
    textSection.appendChild(subTextElement);
    cardElement.appendChild(textSection);

    const buttonGroup = document.createElement("div");
    buttonGroup.style.display = "flex";
    buttonGroup.style.gap = "6px";

    const buyButton = document.createElement("button");
    buyButton.className = "btn btnComplete";
    buyButton.style.background = "linear-gradient(135deg, #0055ff, #001144)";
    buyButton.textContent = "Buy Reward";

    const canBuy = gameState.player.gold >= (r.goldCost || 0) &&
                   gameState.player.skill >= (r.spCost || 0) &&
                   (gameState.player.hpTokens || 0) >= (r.hpCost || 0) &&
                   (gameState.player.hcTokens || 0) >= (r.hcCost || 0);

    if (!canBuy) {
      buyButton.disabled = true;
      buyButton.style.opacity = "0.2";
    } else {
      buyButton.addEventListener("click", (e) => {
        e.stopPropagation();
        purchaseReward(r.id);
      });
    }

    const editButton = document.createElement("button");
    editButton.className = "iconBtn";
    editButton.innerHTML = "⚙️";
    editButton.title = "Edit Reward";
    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      openPopupBox(r.id, "reward");
    });

    buttonGroup.appendChild(buyButton);
    buttonGroup.appendChild(editButton);
    cardElement.appendChild(buttonGroup);
    listContainer.appendChild(cardElement);
  });
}

/* ---------- Completing & Undoing Quests ---------- */
function finishQuest(id, questType) {
  const currentList = gameState.quests[questType] || [];
  const targetQuest = currentList.find(x => x.id === id);
  if (!targetQuest) return;

  const xpEarned = Math.max(0, parseInt(targetQuest.xpReward) || 0);
  const goldEarned = Math.max(0, parseInt(targetQuest.goldReward) || 0);
  const spEarned = Math.max(0, parseInt(targetQuest.spReward) || 0);
  const itemCategory = targetQuest.category || "Health";

  gameState.completionLog.push({
    id: "log_" + Math.random().toString(16).slice(2) + Date.now(),
    questId: targetQuest.id,
    kind: questType,
    category: itemCategory,
    xpGained: xpEarned,
    goldGained: goldEarned,
    spGained: spEarned,
    dateISO: new Date().toISOString()
  });

  addRewardsToPlayer(xpEarned, goldEarned, spEarned);
  addCategoryXpPoints(itemCategory, 25);
  
  showPopupToast(`Quest Done! +${xpEarned} XP`);
  saveGameData();
  refreshScreen();
}

function addCategoryXpPoints(category, points) {
  let mainMessage = "";
  let sideMessage = "";

  if (category === "Health") {
    gameState.player.healthXp += points;
    if (gameState.player.healthXp >= 100) {
      gameState.player.healthXp -= 100;
      gameState.player.hpTokens = (gameState.player.hpTokens || 0) + 1;
      mainMessage = "HEALTH LEVEL UP!";
      sideMessage = "YOU GOT 1 LIFE POINT ❤️";
    }
  } else if (category === "Financial") {
    gameState.player.financialXp += points;
    if (gameState.player.financialXp >= 100) {
      gameState.player.financialXp -= 100;
      mainMessage = "MONEY LEVEL UP!";
      sideMessage = "YOUR SAVINGS GROW 🪙";
    }
  } else if (category === "Honeydew") {
    gameState.player.honeydewXp += points;
    if (gameState.player.honeydewXp >= 100) {
      gameState.player.honeydewXp -= 100;
      gameState.player.hcTokens = (gameState.player.hcTokens || 0) + 1;
      mainMessage = "HONEYDEW LEVEL UP!";
      sideMessage = "YOU GOT 1 HONEY POT 🍯";
    }
  }

  if (mainMessage !== "") {
    triggerCelebrationScreen(mainMessage, sideMessage);
  }
}

function undoQuestCompletion(questId) {
  const itemIndex = findLastIndex(gameState.completionLog, x => x.questId === questId);
  if (itemIndex === -1) return;

  const logEntry = gameState.completionLog[itemIndex];
  gameState.completionLog.splice(itemIndex, 1);

  gameState.player.xp -= logEntry.xpGained;
  gameState.player.gold -= logEntry.goldGained;
  gameState.player.skill -= logEntry.spGained;

  const typeCategory = logEntry.category || "Health";
  if (typeCategory === "Health") {
    gameState.player.healthXp -= 25;
    if (gameState.player.healthXp < 0 && gameState.player.healthLvl > 1) {
      gameState.player.healthXp += 100;
      gameState.player.hpTokens = Math.max(0, (gameState.player.hpTokens || 0) - 1);
    }
    if (gameState.player.healthXp < 0) gameState.player.healthXp = 0;
  } else if (typeCategory === "Financial") {
    gameState.player.financialXp -= 25;
    if (gameState.player.financialXp < 0 && gameState.player.financialLvl > 1) {
      gameState.player.financialXp += 100;
    }
    if (gameState.player.financialXp < 0) gameState.player.financialXp = 0;
  } else if (typeCategory === "Honeydew") {
    gameState.player.honeydewXp -= 25;
    if (gameState.player.honeydewXp < 0 && gameState.player.honeydewLvl > 1) {
      gameState.player.honeydewXp += 100;
      gameState.player.hcTokens = Math.max(0, (gameState.player.hcTokens || 0) - 1);
    }
    if (gameState.player.honeydewXp < 0) gameState.player.honeydewXp = 0;
  }

  while (gameState.player.xp < 0 && gameState.player.level > 1) {
    gameState.player.level -= 1;
    gameState.player.xp += getXpNeeded();
    gameState.player.gold -= gameState.settings.goldPerLevel;
    gameState.player.skill -= gameState.settings.spPerLevel;
  }

  if (gameState.player.xp < 0) gameState.player.xp = 0;
  if (gameState.player.gold < 0) gameState.player.gold = 0;
  if (gameState.player.skill < 0) gameState.player.skill = 0;

  showPopupToast("Quest Un-done.");
  saveGameData();
  refreshScreen();
}

function purchaseReward(id) {
  const targetReward = gameState.rewards.find(x => x.id === id);
  if (!targetReward) return;
  
  const goldCost = targetReward.goldCost || 0;
  const spCost = targetReward.spCost || 0;
  const hpCost = targetReward.hpCost || 0;
  const hcCost = targetReward.hcCost || 0;

  if (gameState.player.gold >= goldCost && 
      gameState.player.skill >= spCost && 
      (gameState.player.hpTokens || 0) >= hpCost && 
      (gameState.player.hcTokens || 0) >= hcCost) {
    
    gameState.player.gold -= goldCost;
    gameState.player.skill -= spCost;
    gameState.player.hpTokens = (gameState.player.hpTokens || 0) - hpCost;
    gameState.player.hcTokens = (gameState.player.hcTokens || 0) - hcCost;

    gameState.purchaseHistory.push({
      label: targetReward.label,
      goldCost: goldCost,
      spCost: spCost,
      hpCost: hpCost,
      hcCost: hcCost,
      timestamp: new Date().toISOString()
    });

    showPopupToast(`Bought reward successfully!`);
    saveGameData();
    refreshScreen();
  }
}

function addRewardsToPlayer(xp, gold, sp) {
  let currentXp = gameState.player.xp + xp;
  gameState.player.gold += gold;
  gameState.player.skill += sp;

  let didLevelUp = false;
  while (currentXp >= getXpNeeded()) {
    currentXp -= getXpNeeded();
    gameState.player.level += 1;
    gameState.player.gold += gameState.settings.goldPerLevel;
    gameState.player.skill += gameState.settings.spPerLevel;
    didLevelUp = true;
  }
  gameState.player.xp = currentXp;

  if (didLevelUp) triggerCelebrationScreen("LEVEL UP!", "YOU ARE STRONGER NOW!");
}

/* ---------- Form Popups Logic ---------- */
function openPopupBox(id, type) {
  const modalId = (type === "reward") ? "rewardModal" : "questModal";
  const modalBox = document.getElementById(modalId);
  if (!modalBox) return;

  if (type === "reward") {
    const r = gameState.rewards.find(x => x.id === id);
    if (!r) return;
    document.getElementById("rewardId").value = r.id;
    document.getElementById("rewardLabel").value = r.label;
    document.getElementById("rewardGoldCost").value = r.goldCost || 0;
    document.getElementById("rewardSpCost").value = r.spCost || 0;
    document.getElementById("rewardHpCost").value = r.hpCost || 0;
    document.getElementById("rewardHcCost").value = r.hcCost || 0;
    document.getElementById("btnDeleteReward").style.display = "block";
  } else {
    const q = gameState.quests[type].find(x => x.id === id);
    if (!q) return;
    document.getElementById("questId").value = q.id;
    document.getElementById("questKind").value = type;
    document.getElementById("questLabel").value = q.label;
    document.getElementById("questCategory").value = q.category || "Health";
    document.getElementById("questXpReward").value = q.xpReward || 0;
    document.getElementById("questGoldReward").value = q.goldReward || 0;
    document.getElementById("questSpReward").value = q.spReward || 0;

    const frequencyField = document.getElementById("wrapFrequency");
    const maxCompletionsField = document.getElementById("wrapMaxCompletions");
    if (type === "side") {
      if(frequencyField) frequencyField.style.display = "block";
      if(maxCompletionsField) maxCompletionsField.style.display = "block";
      document.getElementById("questFrequency").value = q.frequency || "Daily";
      document.getElementById("questMaxCompletions").value = q.maxCompletions || 1;
    } else {
      if(frequencyField) frequencyField.style.display = "none";
      if(maxCompletionsField) maxCompletionsField.style.display = "none";
    }
    document.getElementById("btnDeleteQuest").style.display = "block";
  }

  modalBox.style.display = "flex";
  modalBox.setAttribute("aria-hidden", "false");
}

function closePopupBox(boxId) {
  const modalBox = document.getElementById(boxId);
  if (modalBox) {
    modalBox.style.display = "none";
    modalBox.setAttribute("aria-hidden", "true");
  }
}

/* ---------- Reset System Feature ---------- */
function setupResetButton() {
  const triggerButton = document.getElementById("btnDangerWipe");
  const overlayBox = document.getElementById("confirmOverlay");
  const typingInput = document.getElementById("confirmInput");
  const goButton = document.getElementById("confirmExecute");
  const backButton = document.getElementById("confirmCancel");
  const smallCloseButton = document.getElementById("confirmClose");

  if(!triggerButton || !overlayBox) return;

  let timerClock = null;
  let secondsLeft = 0;

  const checkInputText = () => {
    if(!typingInput || !goButton) return;
    const typedCorrectly = typingInput.value.trim().toUpperCase() === "CONFIRM";
    goButton.disabled = !typedCorrectly || secondsLeft > 0;
  };

  triggerButton.addEventListener("click", () => {
    typingInput.value = "";
    secondsLeft = 10;
    goButton.disabled = true;
    goButton.textContent = `Reset Game Data (${secondsLeft}s)`;
    
    overlayBox.style.display = "flex";
    overlayBox.setAttribute("aria-hidden", "false");

    clearInterval(timerClock);
    timerClock = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(timerClock);
        goButton.textContent = "Reset Everything";
      } else {
        goButton.textContent = `Reset Game Data (${secondsLeft}s)`;
      }
      checkInputText();
    }, 1000);
  });

  safeListen("confirmInput", "input", checkInputText);

  const closeResetWindow = () => {
    clearInterval(timerClock);
    overlayBox.style.display = "none";
    overlayBox.setAttribute("aria-hidden", "true");
  };

  safeListen("confirmCancel", "click", closeResetWindow);
  safeListen("confirmClose", "click", closeResetWindow);

  safeListen("confirmExecute", "click", () => {
    if (typingInput.value.trim().toUpperCase() === "CONFIRM" && secondsLeft <= 0) {
      localStorage.clear();
      gameState = structuredClone(STARTING_GAME_STATE);
      saveGameData();
      closeResetWindow();
      refreshScreen();
      showPopupToast("App reset successfully.");
    }
  });
}

/* ---------- Tab & Page Control Switching ---------- */
function setupTabs() {
  document.querySelectorAll(".tabs .tab").forEach(tabElement => {
    tabElement.addEventListener("click", () => {
      document.querySelectorAll(".tabs .tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll("main .view-panel").forEach(v => v.classList.remove("active"));

      tabElement.classList.add("active");
      const targetView = document.getElementById(`view-${tabElement.dataset.view}`);
      if (targetView) targetView.classList.add("active");
    });
  });

  safeListen("btnCreateQuest", "click", () => {
    document.getElementById("questId").value = "";
    document.getElementById("questKind").value = "side";
    document.getElementById("questLabel").value = "";
    document.getElementById("questCategory").value = "Health";
    document.getElementById("wrapFrequency").style.display = "block";
    document.getElementById("wrapMaxCompletions").style.display = "block";
    document.getElementById("questFrequency").value = "Daily";
    document.getElementById("questMaxCompletions").value = "1";
    document.getElementById("questXpReward").value = "25";
    document.getElementById("questGoldReward").value = "10";
    document.getElementById("questSpReward").value = "0";
    document.getElementById("btnDeleteQuest").style.display = "none";

    const modalBox = document.getElementById("questModal");
    modalBox.style.display = "flex";
    modalBox.setAttribute("aria-hidden", "false");
  });

  safeListen("btnCreateReward", "click", () => {
    document.getElementById("rewardId").value = "";
    document.getElementById("rewardLabel").value = "";
    document.getElementById("rewardGoldCost").value = "20";
    document.getElementById("rewardSpCost").value = "0";
    document.getElementById("rewardHpCost").value = "0";
    document.getElementById("rewardHcCost").value = "0";
    document.getElementById("btnDeleteReward").style.display = "none";

    const modalBox = document.getElementById("rewardModal");
    modalBox.style.display = "flex";
    modalBox.setAttribute("aria-hidden", "false");
  });

  const historyToggleButton = document.getElementById("btnToggleHistory");
  if (historyToggleButton) {
    historyToggleButton.addEventListener("click", () => {
      const logPanel = document.getElementById("historyLogPanel");
      if (logPanel.style.display === "none") {
        logPanel.style.display = "block";
        showHistoryLogs();
      } else {
        logPanel.style.display = "none";
      }
    });
  }
}

function showHistoryLogs() {
  const container = document.getElementById("historyLogList");
  if (!container) return;
  container.innerHTML = "";
  
  const entries = [...(gameState.purchaseHistory || [])].reverse();
  if (entries.length === 0) {
    container.innerHTML = `<div style="color:var(--muted); font-style:italic;">No rewards bought yet.</div>`;
    return;
  }
  
  entries.forEach(entry => {
    const logRow = document.createElement("div");
    logRow.style.padding = "6px 0";
    logRow.style.borderBottom = "1px dashed var(--lineSoft)";
    logRow.style.display = "flex";
    logRow.style.justifyContent = "space-between";
    
    const timeText = new Date(entry.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    
    let costs = [];
    if (entry.goldCost > 0) costs.push(`${entry.goldCost}G`);
    if (entry.spCost > 0) costs.push(`${entry.spCost}SP`);
    if (entry.hpCost > 0) costs.push(`${entry.hpCost}❤️`);
    if (entry.hcCost > 0) costs.push(`${entry.hcCost}🍯`);
    const costStr = costs.length > 0 ? `-${costs.join(', ')}` : "Free";

    logRow.innerHTML = `
      <div>
        <div style="color:#fff; font-weight:700;">${escapeHtml(entry.label)}</div>
        <div style="color:var(--accent-light); font-size:0.8rem;">${timeText}</div>
      </div>
      <div style="color:#ef4444; font-family:var(--fontHud); font-weight:700; text-align:right;">${costStr}</div>
    `;
    container.appendChild(logRow);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function setupForms() {
  // Safe listener attachments
  safeListen("questModalClose", "click", () => closePopupBox("questModal"));
  safeListen("questModalCancel", "click", () => closePopupBox("questModal"));
  safeListen("rewardModalClose", "click", () => closePopupBox("rewardModal"));
  safeListen("rewardModalCancel", "click", () => closePopupBox("rewardModal"));

  safeListen("questForm", "submit", (e) => { e.preventDefault(); saveQuestFormData(); });
  safeListen("rewardForm", "submit", (e) => { e.preventDefault(); saveRewardFormData(); });

  safeListen("btnDeleteQuest", "click", () => {
    const id = document.getElementById("questId")?.value;
    const type = document.getElementById("questKind")?.value;
    if (id && type) {
      gameState.quests[type] = gameState.quests[type].filter(x => x.id !== id);
      showPopupToast("Quest deleted.");
      saveGameData();
      refreshScreen();
    }
    closePopupBox("questModal");
  });

  safeListen("btnDeleteReward", "click", () => {
    const id = document.getElementById("rewardId")?.value;
    if (id) {
      gameState.rewards = gameState.rewards.filter(x => x.id !== id);
      showPopupToast("Reward deleted.");
      saveGameData();
      refreshScreen();
    }
    closePopupBox("rewardModal");
  });

  safeListen("settingsForm", "submit", (e) => {
    e.preventDefault();
    gameState.settings.goldPerLevel = Math.max(0, parseInt(document.getElementById("setGold")?.value) || 0);
    gameState.settings.spPerLevel = Math.max(0, parseInt(document.getElementById("setSp")?.value) || 0);
    saveGameData();
    updatePlayerStats();
    showPopupToast("Settings saved.");
  });
}

function saveQuestFormData() {
  const id = document.getElementById("questId")?.value;
  const label = document.getElementById("questLabel")?.value?.trim();
  const category = document.getElementById("questCategory")?.value;
  const xpReward = Math.max(0, parseInt(document.getElementById("questXpReward")?.value) || 0);
  const goldReward = Math.max(0, parseInt(document.getElementById("questGoldReward")?.value) || 0);
  const spReward = Math.max(0, parseInt(document.getElementById("questSpReward")?.value) || 0);

  if (!id) {
    const type = document.getElementById("questKind")?.value || "side";
    const freshQuest = { id: "q_" + Math.random().toString(16).slice(2) + Date.now(), label, category, xpReward, goldReward, spReward };
    if (type === "side") {
      freshQuest.frequency = document.getElementById("questFrequency")?.value || "Daily";
      freshQuest.maxCompletions = Math.max(1, parseInt(document.getElementById("questMaxCompletions")?.value) || 1);
    }
    gameState.quests[type].push(freshQuest);
    showPopupToast("Quest created.");
  } else {
    const type = document.getElementById("questKind")?.value;
    const q = gameState.quests[type].find(x => x.id === id);
    if (q) {
      q.label = label;
      q.category = category;
      q.xpReward = xpReward;
      q.goldReward = goldReward;
      q.spReward = spReward;
      if (type === "side") {
        q.frequency = document.getElementById("questFrequency")?.value || "Daily";
        q.maxCompletions = Math.max(1, parseInt(document.getElementById("questMaxCompletions")?.value) || 1);
      }
    }
    showPopupToast("Quest updated.");
  }
  saveGameData();
  refreshScreen();
  closePopupBox("questModal");
}

function saveRewardFormData() {
  const id = document.getElementById("rewardId")?.value;
  const label = document.getElementById("rewardLabel")?.value?.trim();
  const goldCost = Math.max(0, parseInt(document.getElementById("rewardGoldCost")?.value) || 0);
  const spCost = Math.max(0, parseInt(document.getElementById("rewardSpCost")?.value) || 0);
  const hpCost = Math.max(0, parseInt(document.getElementById("rewardHpCost")?.value) || 0);
  const hcCost = Math.max(0, parseInt(document.getElementById("rewardHcCost")?.value) || 0);

  if (!id) {
    gameState.rewards.push({ id: "r_" + Math.random().toString(16).slice(2) + Date.now(), label, goldCost, spCost, hpCost, hcCost });
    showPopupToast("Reward added.");
  } else {
    const r = gameState.rewards.find(x => x.id === id);
    if (r) {
      r.label = label;
      r.goldCost = goldCost;
      r.spCost = spCost;
      r.hpCost = hpCost;
      r.hcCost = hcCost;
    }
    showPopupToast("Reward updated.");
  }
  saveGameData();
  refreshScreen();
  closePopupBox("rewardModal");
}

function updateSettingsFormNumbers() {
  const setGold = document.getElementById("setGold");
  const setSp = document.getElementById("setSp");
  if(setGold) setGold.value = gameState.settings.goldPerLevel;
  if(setSp) setSp.value = gameState.settings.spPerLevel;
}

/* ---------- Celebrations & Mini Messages ---------- */
function triggerCelebrationScreen(mainText, subText) {
  const popScreen = document.getElementById("celebration");
  const burstContainer = document.getElementById("celebrateParticles");
  if (!popScreen || !burstContainer) return;

  const title = document.getElementById("txtCelebrationTitle");
  const sub = document.getElementById("txtCelebrationSub");
  if(title) title.textContent = mainText;
  if(sub) sub.textContent = subText;

  burstContainer.innerHTML = "";
  const dotCount = 40;
  for (let i = 0; i < dotCount; i++) {
    const dot = document.createElement("span");
    dot.style.setProperty("--x0", `${Math.random() * 100}vw`);
    dot.style.setProperty("--y0", `${70 + Math.random() * 20}vh`);
    dot.style.setProperty("--x1", `${Math.random() * 100}vw`);
    dot.style.setProperty("--y1", `${-10 - Math.random() * 20}vh`);
    dot.style.animationDelay = `${Math.random() * 0.2}s`;
    burstContainer.appendChild(dot);
  }

  popScreen.classList.add("show");
  setTimeout(() => { popScreen.classList.remove("show"); }, 3500);
}

function checkCompletions(questId, frequency) {
  const startTime = new Date();
  startTime.setHours(0,0,0,0);

  if (frequency === "Weekly") {
    const dayNumber = startTime.getDay();
    startTime.setDate(startTime.getDate() - dayNumber);
  } else if (frequency === "Monthly") {
    startTime.setDate(1);
  }

  return gameState.completionLog.filter(x => x.questId === questId && new Date(x.dateISO) >= startTime).length;
}

function findLastIndex(array, conditionCheck) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (conditionCheck(array[i])) return i;
  }
  return -1;
}

function showPopupToast(messageText) {
  const element = document.getElementById("toast");
  if (!element) return;
  element.textContent = messageText;
  element.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => element.classList.remove("show"), 1500);
}