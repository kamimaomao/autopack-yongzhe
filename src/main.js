// 《猛宠斗阵 · 勇者酒馆自走棋》前端主控制器（点选/双击/拖拽三模丝滑交互 + 颜艺对撞逐帧播放器）

import { AudioManager } from './audio.js';
import {
  ASSET_BASE,
  COMMANDERS,
  FOODS,
  INITIAL_HEARTS,
  MAX_TEAM_SLOTS,
  PERKS,
  RELICS,
  UNIT_COST,
  UNITS,
  WIN_CROWNS_TARGET,
} from './engine/catalog.js';
import { GameSession, getExpNeededForNextLevel } from './engine/session.js';
import { ArenaFxRenderer } from './fx_renderer.js';

const ICON_ATK = `${ASSET_BASE}/sprites/UI_界面/ui/TavernFight/img_gongji_jgzq.png`;
const ICON_HP = `${ASSET_BASE}/sprites/UI_界面/ui/TavernFight/img_sm_jgzq.png`;
const ICON_LOCK = `${ASSET_BASE}/sprites/UI_界面/ui/TavernFight/btn_suoding_jgzq.png`;

const session = new GameSession();
const audio = new AudioManager();

// DOM 引用
const els = {
  toastBanner: document.getElementById('toastBanner'),
  btnCommanderInfo: document.getElementById('btnCommanderInfo'),
  hudCommanderImg: document.getElementById('hudCommanderImg'),
  hudCommanderTag: document.getElementById('hudCommanderTag'),
  hudHearts: document.getElementById('hudHearts'),
  hudGold: document.getElementById('hudGold'),
  hudRoundTier: document.getElementById('hudRoundTier'),
  hudCrowns: document.getElementById('hudCrowns'),
  btnCompendium: document.getElementById('btnCompendium'),
  btnHelp: document.getElementById('btnHelp'),
  btnMute: document.getElementById('btnMute'),

  battleArena: document.getElementById('battleArena'),
  arenaBg: document.getElementById('arenaBg'),
  enemyWarbandTitle: document.getElementById('enemyWarbandTitle'),
  btnOpenLog: document.getElementById('btnOpenLog'),
  enemyGrid: document.getElementById('enemyGrid'),
  allyGrid: document.getElementById('allyGrid'),
  liveTicker: document.getElementById('liveTicker'),
  relicsStrip: document.getElementById('relicsStrip'),
  allyCountText: document.getElementById('allyCountText'),

  inspectorMain: document.getElementById('inspectorMain'),
  inspectorActions: document.getElementById('inspectorActions'),

  cabinetTierBadge: document.getElementById('cabinetTierBadge'),
  soupBuffChip: document.getElementById('soupBuffChip'),
  foodPriceHint: document.getElementById('foodPriceHint'),
  shopUnitsRow: document.getElementById('shopUnitsRow'),
  shopFoodsRow: document.getElementById('shopFoodsRow'),

  prepActionBar: document.getElementById('prepActionBar'),
  battleActionBar: document.getElementById('battleActionBar'),
  btnReroll: document.getElementById('btnReroll'),
  rerollCostText: document.getElementById('rerollCostText'),
  btnFreezeMode: document.getElementById('btnFreezeMode'),
  freezeModeSub: document.getElementById('freezeModeSub'),
  btnStartBattle: document.getElementById('btnStartBattle'),
  fightBtnSub: document.getElementById('fightBtnSub'),

  btnSpeed: document.getElementById('btnSpeed'),
  speedBtnTitle: document.getElementById('speedBtnTitle'),
  btnPause: document.getElementById('btnPause'),
  pauseBtnTitle: document.getElementById('pauseBtnTitle'),
  btnSkipBattle: document.getElementById('btnSkipBattle'),

  commanderDialog: document.getElementById('commanderDialog'),
  commanderGrid: document.getElementById('commanderGrid'),
  relicDialog: document.getElementById('relicDialog'),
  relicDialogSub: document.getElementById('relicDialogSub'),
  relicChoicesGrid: document.getElementById('relicChoicesGrid'),
  compendiumDialog: document.getElementById('compendiumDialog'),
  compendiumTabs: document.getElementById('compendiumTabs'),
  compendiumBody: document.getElementById('compendiumBody'),
  helpDialog: document.getElementById('helpDialog'),
  logDialog: document.getElementById('logDialog'),
  battleLogList: document.getElementById('battleLogList'),
  resultDialog: document.getElementById('resultDialog'),
  resultDialogTitle: document.getElementById('resultDialogTitle'),
  resultDialogSub: document.getElementById('resultDialogSub'),
  finalTeamShowcase: document.getElementById('finalTeamShowcase'),
  btnRestartRun: document.getElementById('btnRestartRun'),
};

const fx = new ArenaFxRenderer(els.battleArena);

// 交互状态
let selection = null; // { kind, index, id }
let freezeMode = false;
let compendiumTab = 'units';

// 战斗动画状态
let battleSpeed = 1;
let battlePaused = false;
let battleSkipRequested = false;
let activeBattleView = null; // { allyTeam, enemyTeam, hitUids, clashUids, buffUids }
let toastTimer = null;

function showToast(msg) {
  els.toastBanner.textContent = msg;
  els.toastBanner.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toastBanner.classList.remove('is-visible');
  }, 2100);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ================= 原生 <dialog> 兼容增强与关闭钩子 =================
function setupDialogs() {
  const allDialogs = document.querySelectorAll('dialog.game-dialog');
  for (const dlg of allDialogs) {
    dlg.addEventListener('close', () => {
      dlg.returnValue = '';
    });
  }

  // 强制必选弹窗拦截 Esc 取消
  for (const dlg of [els.commanderDialog, els.relicDialog, els.resultDialog]) {
    dlg.addEventListener('cancel', (ev) => {
      ev.preventDefault();
    });
  }

  // 针对暂不支持 closedby="any" 的浏览器（如部分 Safari 版本）补充点击背景关闭兜底
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (ev, dialog) => {
      const r = dialog.getBoundingClientRect();
      return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (ev) => {
        if (ev.target !== dialog) {
          pressedOutside = false;
          return;
        }
        pressedOutside = outside(ev, dialog);
      });
      dialog.addEventListener('pointerup', (ev) => {
        if (pressedOutside && ev.target === dialog && outside(ev, dialog)) {
          dialog.close();
        }
        pressedOutside = false;
      });
    }
  }
}

function openModalSafe(dialogEl) {
  if (!dialogEl.open) {
    dialogEl.showModal();
  }
}

function closeModalSafe(dialogEl) {
  if (dialogEl.open) {
    dialogEl.close();
  }
}

// ================= 渲染主视图 =================
function renderAll() {
  renderHud();
  renderArena();
  renderInspector();
  renderCabinet();
}

function renderHud() {
  const cmd = session.getCommander();
  els.hudCommanderImg.src = cmd.portrait;
  els.hudCommanderTag.textContent = cmd.passiveName.slice(0, 2);

  const lostHearts = Math.max(0, INITIAL_HEARTS - session.hearts);
  els.hudHearts.textContent = '❤️'.repeat(session.hearts) + '🖤'.repeat(lostHearts);
  els.hudGold.textContent = `${session.gold}`;
  els.hudRoundTier.textContent = `🍺T${session.getTavernTier()} · 第${session.round}轮`;
  els.hudCrowns.textContent = `🏆 ${session.wins}/${WIN_CROWNS_TARGET}`;
  els.btnMute.textContent = audio.muted ? '🔇' : '🔊';
}

function createUnitSlotElement(unit, slotIdx, side, interactive) {
  const slot = document.createElement('div');
  const isVanguard = slotIdx === 0;
  slot.className = `unit-slot${isVanguard ? ' is-vanguard' : ''}${unit ? ' has-unit' : ''}`;
  slot.setAttribute('role', 'listitem');

  if (interactive || unit) {
    slot.tabIndex = 0;
  }

  const wm = document.createElement('span');
  wm.className = 'slot-index-watermark';
  wm.textContent = isVanguard ? '⚔️1前锋' : `${slotIdx + 1}号`;
  slot.appendChild(wm);

  // 高亮整备阶段合法落点
  if (side === 'ally' && session.phase === 'prep') {
    if (selection?.kind === 'ally_unit' && selection.index === slotIdx) {
      slot.classList.add('is-selected');
    } else if (selection?.kind === 'shop_unit') {
      const shopEntry = session.shopUnits[selection.index];
      if (shopEntry) {
        if (!unit) {
          slot.classList.add('can-place');
        } else if (unit.defId === shopEntry.defId && unit.level < 3) {
          slot.classList.add('can-merge-target');
        }
      }
    } else if (selection?.kind === 'shop_food') {
      const foodEntry = session.shopFoods[selection.index];
      const food = foodEntry ? FOODS[foodEntry.foodId] : null;
      if (food?.targetMode === 'unit' && unit) {
        slot.classList.add('can-merge-target');
      }
    } else if (selection?.kind === 'ally_unit' && selection.index !== slotIdx) {
      const srcUnit = session.team[selection.index];
      if (srcUnit && unit && srcUnit.defId === unit.defId && unit.level < 3) {
        slot.classList.add('can-merge-target');
      } else {
        slot.classList.add('can-place');
      }
    }
  } else if (side === 'enemy' && selection?.kind === 'enemy_unit' && selection.index === slotIdx) {
    slot.classList.add('is-selected');
  }

  if (!unit) {
    const empty = document.createElement('span');
    empty.className = 'slot-empty-hint';
    empty.textContent = side === 'ally' ? (isVanguard ? '前锋空位' : '空槽') : '—';
    slot.appendChild(empty);
  } else {
    const def = UNITS[unit.defId];
    slot.dataset.uid = unit.uid;

    const isHit = activeBattleView?.hitUids?.has(unit.uid);
    const isClash = activeBattleView?.clashUids?.has(unit.uid);
    const isBuff = activeBattleView?.buffUids?.has(unit.uid);

    if (isHit) slot.classList.add('is-hit');
    if (isClash) slot.classList.add('is-clash-lunge');
    if (isBuff) slot.classList.add('is-buff-pop');

    const topMeta = document.createElement('div');
    topMeta.className = 'unit-top-meta';

    const star = document.createElement('span');
    star.className = `star-pill lv-${unit.level}`;
    const needExp = getExpNeededForNextLevel(unit.level);
    const expSuffix = session.phase === 'prep' && side === 'ally' && needExp > 0 && unit.exp > 0
      ? `·${unit.exp}/${needExp}`
      : '';
    star.textContent = `★${unit.level}${expSuffix}`;
    topMeta.appendChild(star);

    if (unit.perk && PERKS[unit.perk]) {
      const perkImg = document.createElement('img');
      perkImg.className = 'perk-badge';
      perkImg.src = PERKS[unit.perk].icon;
      perkImg.alt = PERKS[unit.perk].name;
      perkImg.title = `${PERKS[unit.perk].name}：${PERKS[unit.perk].desc}`;
      topMeta.appendChild(perkImg);
    }

    const wrap = document.createElement('div');
    wrap.className = 'unit-portrait-wrap';
    const img = document.createElement('img');
    img.className = 'unit-portrait';
    img.src = isHit ? def.hitPortrait : def.portrait;
    img.alt = def.name;
    wrap.appendChild(img);

    const nameEl = document.createElement('span');
    nameEl.className = 'unit-name-label';
    nameEl.textContent = def.name;

    const statsRow = document.createElement('div');
    statsRow.className = 'unit-stats-row';
    statsRow.innerHTML = `
      <span class="stat-chip atk-chip"><img src="${ICON_ATK}" alt="" aria-hidden="true">${unit.atk}</span>
      <span class="stat-chip hp-chip"><img src="${ICON_HP}" alt="" aria-hidden="true">${Math.max(0, unit.hp)}</span>
    `;

    slot.appendChild(topMeta);
    slot.appendChild(wrap);
    slot.appendChild(nameEl);
    slot.appendChild(statsRow);

    if (side === 'ally' && session.phase === 'prep') {
      slot.draggable = true;
      slot.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('application/json', JSON.stringify({ kind: 'ally_unit', index: slotIdx }));
      });
    }
  }

  // 点击与拖拽事件
  if (side === 'ally') {
    slot.addEventListener('click', () => handleAllySlotClick(slotIdx));
    slot.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        handleAllySlotClick(slotIdx);
      }
    });
    slot.addEventListener('dragover', (ev) => {
      if (session.phase === 'prep') ev.preventDefault();
    });
    slot.addEventListener('drop', (ev) => {
      if (session.phase !== 'prep') return;
      ev.preventDefault();
      try {
        const payload = JSON.parse(ev.dataTransfer.getData('application/json'));
        handleDropOnAllySlot(payload, slotIdx);
      } catch {
        // ignore invalid drag data
      }
    });
  } else {
    slot.addEventListener('click', () => {
      if (!unit) return;
      audio.unlock();
      audio.playSfx('click');
      selection = { kind: 'enemy_unit', index: slotIdx };
      renderAll();
    });
  }

  return slot;
}

function renderArena() {
  els.arenaBg.style.backgroundImage = `url("${session.getBackgroundUrl()}")`;
  els.enemyWarbandTitle.textContent = session.enemyPreview
    ? session.enemyPreview.title
    : `第${session.round}轮 · 酒馆劲敌`;

  const enemyArr = session.phase === 'battle' && activeBattleView
    ? activeBattleView.enemyTeam
    : (session.enemyPreview?.units || []);

  const allyArr = session.phase === 'battle' && activeBattleView
    ? activeBattleView.allyTeam
    : session.team;

  els.enemyGrid.replaceChildren();
  for (let i = 0; i < MAX_TEAM_SLOTS; i++) {
    els.enemyGrid.appendChild(createUnitSlotElement(enemyArr[i] || null, i, 'enemy', false));
  }

  els.allyGrid.replaceChildren();
  for (let i = 0; i < MAX_TEAM_SLOTS; i++) {
    els.allyGrid.appendChild(createUnitSlotElement(allyArr[i] || null, i, 'ally', session.phase === 'prep'));
  }

  const count = session.team.filter(Boolean).length;
  els.allyCountText.textContent = `(${count}/${MAX_TEAM_SLOTS})`;

  // 渲染已持有的镇馆宝物小图标
  els.relicsStrip.replaceChildren();
  for (const rId of session.relics) {
    const r = RELICS[rId];
    if (!r) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'relic-mini-btn';
    btn.title = `${r.name}：${r.desc}`;
    btn.setAttribute('aria-label', `查看宝物 ${r.name}`);
    btn.innerHTML = `<img src="${r.icon}" alt="">`;
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.playSfx('click');
      selection = { kind: 'relic', id: rId };
      renderInspector();
    });
    els.relicsStrip.appendChild(btn);
  }
}

function renderInspector() {
  els.inspectorMain.replaceChildren();
  els.inspectorActions.replaceChildren();

  if (!selection) {
    const span = document.createElement('span');
    span.className = 'inspector-placeholder';
    span.textContent = session.phase === 'battle'
      ? '⚔️ 战斗自动演武中！可切换 ×1/×2/×3 倍速或点击【📜 战报】复盘连锁细节。'
      : '💡 点击酒馆魔物上阵（再次点击可快捷自动上阵/合体），点两只我方魔物可互换站位！';
    els.inspectorMain.appendChild(span);
    return;
  }

  if (selection.kind === 'commander') {
    const cmd = session.getCommander();
    renderInspectorContent(cmd.portrait, cmd.name, cmd.title, `${cmd.passiveName}：${cmd.passiveDesc}`);
    return;
  }

  if (selection.kind === 'relic') {
    const r = RELICS[selection.id];
    if (r) {
      renderInspectorContent(r.icon, r.name, '镇馆宝物', r.desc);
    }
    return;
  }

  if (selection.kind === 'shop_unit') {
    const entry = session.shopUnits[selection.index];
    if (!entry) {
      selection = null;
      renderInspector();
      return;
    }
    const def = UNITS[entry.defId];
    renderInspectorContent(
      def.portrait,
      `${def.name} (${entry.atk}/${entry.hp})`,
      `T${def.tier} · ${def.triggerTag}`,
      `${def.skillName}：${def.desc(1)}`,
    );

    if (session.phase === 'prep') {
      const quickBtn = document.createElement('button');
      quickBtn.type = 'button';
      quickBtn.className = 'insp-btn use-btn';
      quickBtn.textContent = `⚡上阵 (${UNIT_COST}金)`;
      quickBtn.disabled = session.gold < UNIT_COST;
      quickBtn.addEventListener('click', () => quickBuyShopUnit(selection.index));

      const frzBtn = document.createElement('button');
      frzBtn.type = 'button';
      frzBtn.className = 'insp-btn freeze-btn';
      frzBtn.textContent = entry.frozen ? '🔓解锁' : '❄️冻结';
      frzBtn.addEventListener('click', () => {
        session.toggleFreezeUnit(selection.index);
        audio.playSfx('click');
        renderAll();
      });

      els.inspectorActions.append(quickBtn, frzBtn);
    }
    return;
  }

  if (selection.kind === 'shop_food') {
    const entry = session.shopFoods[selection.index];
    if (!entry) {
      selection = null;
      renderInspector();
      return;
    }
    const food = FOODS[entry.foodId];
    const cost = session.getFoodCost();
    renderInspectorContent(food.icon, food.name, `T${food.tier} 秘药`, food.desc);

    if (session.phase === 'prep') {
      if (food.targetMode === 'team') {
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'insp-btn use-btn';
        useBtn.textContent = `🍽️使用 (${cost}金)`;
        useBtn.disabled = session.gold < cost;
        useBtn.addEventListener('click', () => executeFoodPurchase(selection.index, null));
        els.inspectorActions.appendChild(useBtn);
      }

      const frzBtn = document.createElement('button');
      frzBtn.type = 'button';
      frzBtn.className = 'insp-btn freeze-btn';
      frzBtn.textContent = entry.frozen ? '🔓解锁' : '❄️冻结';
      frzBtn.addEventListener('click', () => {
        session.toggleFreezeFood(selection.index);
        audio.playSfx('click');
        renderAll();
      });
      els.inspectorActions.appendChild(frzBtn);
    }
    return;
  }

  if (selection.kind === 'ally_unit' || selection.kind === 'enemy_unit') {
    const arr = selection.kind === 'ally_unit'
      ? (session.phase === 'battle' && activeBattleView ? activeBattleView.allyTeam : session.team)
      : (session.phase === 'battle' && activeBattleView ? activeBattleView.enemyTeam : (session.enemyPreview?.units || []));
    const unit = arr[selection.index];
    if (!unit) {
      selection = null;
      renderInspector();
      return;
    }
    const def = UNITS[unit.defId];
    const perkStr = unit.perk && PERKS[unit.perk] ? ` ｜ 装备【${PERKS[unit.perk].name}：${PERKS[unit.perk].short}】` : '';
    renderInspectorContent(
      def.portrait,
      `${def.name} ★${unit.level}`,
      `${selection.kind === 'ally_unit' ? '我方' : '敌方'} ${selection.index + 1}号位 · ${def.triggerTag}`,
      `${def.skillName}：${def.desc(unit.level)}${perkStr}`,
    );

    if (selection.kind === 'ally_unit' && session.phase === 'prep') {
      const sellBtn = document.createElement('button');
      sellBtn.type = 'button';
      sellBtn.className = 'insp-btn sell-btn';
      sellBtn.textContent = `💰出售 +${session.getSellValue(unit)}金`;
      sellBtn.addEventListener('click', () => {
        const res = session.sellUnit(selection.index);
        if (res.ok) {
          audio.playSfx('sell');
          if (res.buffedTargets.length > 0) {
            showToast(`🕊️【呆呆蓝鸽】放生祝福，前排友军获得永久强化！`);
          } else {
            showToast(`💰 出售【${res.soldUnit.name}】，回收 +${res.refund} 金币`);
          }
          selection = null;
          renderAll();
        }
      });
      els.inspectorActions.appendChild(sellBtn);
    }
  }
}

function renderInspectorContent(iconUrl, title, tag, desc) {
  const img = document.createElement('img');
  img.className = 'insp-icon';
  img.src = iconUrl;
  img.alt = '';

  const wrap = document.createElement('div');
  wrap.className = 'insp-text-wrap';

  const line = document.createElement('div');
  line.className = 'insp-title-line';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const tagEl = document.createElement('span');
  tagEl.className = 'insp-tag';
  tagEl.textContent = tag;
  line.append(strong, tagEl);

  const p = document.createElement('p');
  p.className = 'insp-desc';
  p.textContent = desc;

  wrap.append(line, p);
  els.inspectorMain.append(img, wrap);
}

function renderCabinet() {
  const tier = session.getTavernTier();
  els.cabinetTierBadge.textContent = `🍺 T${tier} 酒馆`;

  if (session.shopPermBuff.atk > 0 || session.shopPermBuff.hp > 0) {
    els.soupBuffChip.hidden = false;
    els.soupBuffChip.textContent = `🥫 新宠 +${session.shopPermBuff.atk}/+${session.shopPermBuff.hp}`;
  } else {
    els.soupBuffChip.hidden = true;
  }

  const foodCost = session.getFoodCost();
  els.foodPriceHint.innerHTML = `秘药 <strong>${foodCost}金</strong>`;

  // 切换整备/战斗按钮栏
  const inBattle = session.phase === 'battle';
  els.prepActionBar.hidden = inBattle;
  els.battleActionBar.hidden = !inBattle;

  const rerollCost = session.getRerollCost();
  els.rerollCostText.textContent = rerollCost === 0 ? '🎁 本次免费' : `消耗 ${rerollCost} 金`;
  els.btnReroll.disabled = inBattle || session.gold < rerollCost;

  els.btnFreezeMode.setAttribute('aria-pressed', freezeMode ? 'true' : 'false');
  els.freezeModeSub.textContent = freezeMode ? '点任意商品即锁/解' : '保留心仪魔物到下轮';

  els.fightBtnSub.textContent = `迎战第 ${session.round} 轮`;
  els.btnStartBattle.disabled = inBattle || session.team.every((u) => !u);

  // 渲染酒馆魔物槽
  els.shopUnitsRow.replaceChildren();
  if (session.shopUnits.length === 0) {
    const emptyNote = document.createElement('div');
    emptyNote.className = 'shop-empty-note';
    emptyNote.textContent = '本批魔物已全部招募，可【🔄 刷新酒馆】进新货或直接开战！';
    els.shopUnitsRow.appendChild(emptyNote);
  }
  session.shopUnits.forEach((entry, idx) => {
    const def = UNITS[entry.defId];
    const hasMatchOnTeam = session.team.some((u) => u && u.defId === entry.defId && u.level < 3);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `shop-card shop-unit-card${entry.frozen ? ' is-frozen' : ''}${entry.isBonus ? ' is-bonus' : ''}${selection?.kind === 'shop_unit' && selection.index === idx ? ' is-selected' : ''}`;
    card.setAttribute('role', 'listitem');
    card.disabled = inBattle;

    card.innerHTML = `
      <div class="shop-card-top">
        <span class="tier-tag">${entry.isBonus ? '★奖T' : 'T'}${def.tier}</span>
        ${hasMatchOnTeam ? '<span class="merge-hint-tag">可合!</span>' : ''}
        ${entry.frozen ? `<img class="freeze-lock-icon" src="${ICON_LOCK}" alt="已冰封">` : ''}
      </div>
      <img class="shop-art" src="${def.portrait}" alt="${def.name}">
      <span class="shop-name">${def.name}</span>
      <div class="unit-stats-row">
        <span class="stat-chip atk-chip"><img src="${ICON_ATK}" alt="" aria-hidden="true">${entry.atk}</span>
        <span class="stat-chip hp-chip"><img src="${ICON_HP}" alt="" aria-hidden="true">${entry.hp}</span>
      </div>
    `;

    card.draggable = !inBattle;
    card.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('application/json', JSON.stringify({ kind: 'shop_unit', index: idx }));
    });
    card.addEventListener('click', () => handleShopUnitClick(idx));
    els.shopUnitsRow.appendChild(card);
  });

  // 渲染酒馆食物/装备槽
  els.shopFoodsRow.replaceChildren();
  session.shopFoods.forEach((entry, idx) => {
    const food = FOODS[entry.foodId];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `shop-card shop-food-card${entry.frozen ? ' is-frozen' : ''}${selection?.kind === 'shop_food' && selection.index === idx ? ' is-selected' : ''}`;
    card.setAttribute('role', 'listitem');
    card.disabled = inBattle;

    let shortSub = '增益';
    if (food.kind === 'stat') shortSub = `+${food.atk}/+${food.hp}`;
    else if (food.kind === 'exp') shortSub = '升星经验+1';
    else if (food.kind === 'perk' && PERKS[food.perkId]) shortSub = PERKS[food.perkId].short;
    else if (food.kind === 'shop_buff') shortSub = '商店+1/+1';
    else if (food.kind === 'team_all') shortSub = '全队+2/+2';
    else if (food.kind === 'team_random') shortSub = '双宠+1/+1';

    card.innerHTML = `
      <div class="shop-card-top">
        <span class="tier-tag">T${food.tier}</span>
        ${entry.frozen ? `<img class="freeze-lock-icon" src="${ICON_LOCK}" alt="已冰封">` : ''}
      </div>
      <img class="shop-art" src="${food.icon}" alt="${food.name}">
      <span class="shop-name">${food.name}</span>
      <span class="shop-effect-sub">${shortSub}</span>
    `;

    card.draggable = !inBattle;
    card.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('application/json', JSON.stringify({ kind: 'shop_food', index: idx }));
    });
    card.addEventListener('click', () => handleShopFoodClick(idx));
    els.shopFoodsRow.appendChild(card);
  });
}

// ================= 交互动作处理器 =================
function handleShopUnitClick(idx) {
  audio.unlock();
  if (session.phase !== 'prep') return;

  if (freezeMode) {
    const r = session.toggleFreezeUnit(idx);
    if (r.ok) {
      audio.playSfx('click');
      showToast(r.frozen ? '❄️ 已冰封锁定该魔物，下回合保留' : '🔓 已解除锁定');
      renderAll();
    }
    return;
  }

  // 再次点击已选中的酒馆魔物 → 智能快捷上阵/合体！
  if (selection?.kind === 'shop_unit' && selection.index === idx) {
    quickBuyShopUnit(idx);
    return;
  }

  audio.playSfx('click');
  selection = { kind: 'shop_unit', index: idx };
  renderAll();
}

function quickBuyShopUnit(shopIdx) {
  const entry = session.shopUnits[shopIdx];
  if (!entry) return;

  // 优先自动合体到场上同名未满星友军，否则放入第一个空位
  let targetSlot = session.team.findIndex((u) => u && u.defId === entry.defId && u.level < 3);
  if (targetSlot === -1) {
    targetSlot = session.team.findIndex((u) => !u);
  }
  if (targetSlot === -1) {
    showToast('⚠️ 5 个上阵槽位已满！请先合体同名宠或出售腾出空位');
    return;
  }
  executeUnitPurchase(shopIdx, targetSlot);
}

function executeUnitPurchase(shopIdx, teamSlotIdx) {
  const res = session.buyUnit(shopIdx, teamSlotIdx);
  if (!res.ok) {
    showToast(`⚠️ ${res.reason}`);
    return;
  }

  selection = null;
  if (res.leveledUp) {
    audio.playSfx('levelUp');
    const bonusName = res.bonusSpawn ? UNITS[res.bonusSpawn.defId].name : '';
    showToast(
      bonusName
        ? `🌟【${res.unit.name}】升至 ★${res.unit.level}！酒馆爆出高阶奖励【${bonusName}】！`
        : `🌟【${res.unit.name}】升至 ★${res.unit.level}！技能威力大幅跃升！`,
    );
  } else if (res.merged) {
    audio.playSfx('statUp');
    showToast(`✨ 同名吞并！【${res.unit.name}】+1/+1 并积累升星经验！`);
  } else {
    audio.playSfx('buy');
  }
  renderAll();
}

function handleShopFoodClick(idx) {
  audio.unlock();
  if (session.phase !== 'prep') return;

  if (freezeMode) {
    const r = session.toggleFreezeFood(idx);
    if (r.ok) {
      audio.playSfx('click');
      showToast(r.frozen ? '❄️ 已冰封锁定该秘药' : '🔓 已解除锁定');
      renderAll();
    }
    return;
  }

  const entry = session.shopFoods[idx];
  if (!entry) return;
  const food = FOODS[entry.foodId];

  // 群体类食物再次点击直接生效
  if (selection?.kind === 'shop_food' && selection.index === idx && food.targetMode === 'team') {
    executeFoodPurchase(idx, null);
    return;
  }

  audio.playSfx('click');
  selection = { kind: 'shop_food', index: idx };
  renderAll();
}

function executeFoodPurchase(foodIdx, targetSlotIdx) {
  const res = session.buyFood(foodIdx, targetSlotIdx);
  if (!res.ok) {
    showToast(`⚠️ ${res.reason}`);
    return;
  }

  selection = null;
  if (res.leveledUp) {
    audio.playSfx('levelUp');
    showToast(`🧠 智慧脑花激发潜能！友军升星并爆出酒馆高阶奖励宠！`);
  } else {
    audio.playSfx('statUp');
    showToast(`🍖 使用【${res.food.name}】成功！`);
  }
  renderAll();
}

function handleAllySlotClick(slotIdx) {
  audio.unlock();
  if (session.phase !== 'prep') {
    if (activeBattleView?.allyTeam[slotIdx]) {
      selection = { kind: 'ally_unit', index: slotIdx };
      renderInspector();
    }
    return;
  }

  if (selection?.kind === 'shop_unit') {
    executeUnitPurchase(selection.index, slotIdx);
    return;
  }

  if (selection?.kind === 'shop_food') {
    const entry = session.shopFoods[selection.index];
    const food = entry ? FOODS[entry.foodId] : null;
    if (food?.targetMode === 'unit') {
      executeFoodPurchase(selection.index, slotIdx);
      return;
    }
  }

  if (selection?.kind === 'ally_unit') {
    if (selection.index === slotIdx) {
      selection = null;
      audio.playSfx('click');
      renderAll();
      return;
    }
    const fromIdx = selection.index;
    const res = session.moveOrMergeTeam(fromIdx, slotIdx);
    selection = null;
    if (res.ok) {
      if (res.action === 'merge') {
        audio.playSfx(res.leveledUp ? 'levelUp' : 'statUp');
        showToast(
          res.leveledUp
            ? `🌟 队伍合体升星！【${res.unit.name}】升至 ★${res.unit.level}！`
            : `✨ 同名合体成功，腾出 1 个上阵槽位！`,
        );
      } else {
        audio.playSfx('click');
      }
      renderAll();
    }
    return;
  }

  if (session.team[slotIdx]) {
    audio.playSfx('click');
    selection = { kind: 'ally_unit', index: slotIdx };
    renderAll();
  }
}

function handleDropOnAllySlot(payload, targetSlotIdx) {
  audio.unlock();
  if (payload.kind === 'shop_unit') {
    executeUnitPurchase(payload.index, targetSlotIdx);
  } else if (payload.kind === 'shop_food') {
    const entry = session.shopFoods[payload.index];
    const food = entry ? FOODS[entry.foodId] : null;
    if (food?.targetMode === 'team') {
      executeFoodPurchase(payload.index, null);
    } else {
      executeFoodPurchase(payload.index, targetSlotIdx);
    }
  } else if (payload.kind === 'ally_unit') {
    const res = session.moveOrMergeTeam(payload.index, targetSlotIdx);
    selection = null;
    if (res.ok) {
      audio.playSfx(res.leveledUp ? 'levelUp' : 'click');
      renderAll();
    }
  }
}

// ================= 战斗逐帧动画回放引擎 =================
async function startAndPlayBattle() {
  audio.unlock();
  if (session.phase !== 'prep') return;

  selection = null;
  freezeMode = false;

  const startRes = session.startBattle();
  if (!startRes.ok) {
    showToast(`⚠️ ${startRes.reason}`);
    return;
  }

  const { report } = startRes;
  if (report.prepGrowthLogs?.length > 0) {
    showToast(report.prepGrowthLogs[0]);
  }

  battlePaused = false;
  battleSkipRequested = false;
  els.btnPause.setAttribute('aria-pressed', 'false');
  els.pauseBtnTitle.textContent = '⏸️ 暂停观战';
  audio.playBgm('battle');

  for (let i = 0; i < report.steps.length; i++) {
    const step = report.steps[i];

    while (battlePaused && !battleSkipRequested) {
      await sleep(80);
    }

    if (battleSkipRequested) {
      const finalStep = report.steps[report.steps.length - 1];
      activeBattleView = {
        allyTeam: finalStep.allyTeam,
        enemyTeam: finalStep.enemyTeam,
        hitUids: new Set(),
        clashUids: new Set(),
        buffUids: new Set(),
      };
      els.liveTicker.textContent = finalStep.log || '';
      fx.clearAll();
      renderAll();
      break;
    }

    const speedDiv = battleSpeed;

    // 如果是远程投射物，先飞弹再命中切 _st 颜艺！
    if (step.type === 'projectile' && step.projectile) {
      if (step.log) els.liveTicker.textContent = step.log;
      audio.playSfx('ZiDan_FaShe', { volume: 0.45 });
      await fx.flyProjectile({
        fromUid: step.actorUid,
        fromSide: step.actorSide,
        toUid: step.targetUid,
        toSide: step.targetSide,
        sprite: step.projectile,
        durationMs: 240 / speedDiv,
      });
    }

    activeBattleView = {
      allyTeam: step.allyTeam,
      enemyTeam: step.enemyTeam,
      hitUids: new Set(step.hitUids || []),
      clashUids: new Set(
        step.type === 'clash' ? [step.allyFrontUid, step.enemyFrontUid].filter(Boolean) : [],
      ),
      buffUids: new Set(
        step.type === 'buff' || step.type === 'heal' || step.type === 'summon' || step.type === 'revive'
          ? [step.targetUid].filter(Boolean)
          : [],
      ),
    };

    if (step.log) {
      els.liveTicker.textContent = step.log;
    }
    if (step.sfx) {
      audio.playSfx(step.sfx);
    }

    renderAll();

    // 触发原版 Hud 位图数字跳字
    if (step.popups?.length) {
      for (const p of step.popups) {
        fx.spawnBitmapPopup(p);
      }
    }

    let stepWaitMs = 430;
    if (step.type === 'clash') stepWaitMs = 560;
    else if (step.type === 'faint') stepWaitMs = 360;
    else if (step.type === 'result') stepWaitMs = 760;

    await sleep(Math.max(95, stepWaitMs / speedDiv));
  }

  populateBattleLogModal(report);
  activeBattleView = null;

  const post = session.commitBattleOutcome();
  audio.playBgm('prep');
  renderAll();

  if (post.gameOver) {
    openResultModal(post.runResult);
  } else if (post.relicPick) {
    openRelicPickModal(post.choices);
  } else {
    els.liveTicker.textContent = `🍺 第 ${session.round} 回合酒馆已进货！剩余金币已补满至 ${session.gold} 金。`;
  }
}

// ================= 模态框内容构建 =================
function openCommanderSelectModal() {
  els.commanderGrid.replaceChildren();
  COMMANDERS.forEach((cmd, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'commander-card';
    if (idx === 0) btn.autofocus = true;
    btn.innerHTML = `
      <img src="${cmd.portrait}" alt="${cmd.name}">
      <strong>${cmd.name}</strong>
      <span class="commander-role-chip">${cmd.title}</span>
      <p>${cmd.passiveDesc}</p>
    `;
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.playSfx('pick');
      session.resetRun(cmd.id, true);
      selection = null;
      freezeMode = false;
      closeModalSafe(els.commanderDialog);
      audio.playBgm('prep');
      els.liveTicker.textContent = `🍺 欢迎掌柜【${cmd.name}】！招募魔物站上左侧 1 号前锋位吧！`;
      renderAll();
    });
    els.commanderGrid.appendChild(btn);
  });
  openModalSafe(els.commanderDialog);
}

function openRelicPickModal(choiceIds) {
  els.relicDialogSub.textContent = `酒馆升至 T${session.getTavernTier()}！挑选 1 件镇馆宝物强化全团：`;
  els.relicChoicesGrid.replaceChildren();
  choiceIds.forEach((rId, idx) => {
    const r = RELICS[rId];
    if (!r) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'relic-choice-btn';
    if (idx === 0) btn.autofocus = true;
    btn.innerHTML = `
      <img src="${r.icon}" alt="">
      <div>
        <strong>${r.name}</strong>
        <span>${r.desc}</span>
      </div>
    `;
    btn.addEventListener('click', () => {
      audio.playSfx('reward');
      session.chooseRelic(rId);
      closeModalSafe(els.relicDialog);
      showToast(`✨ 获得镇馆宝物【${r.name}】！`);
      renderAll();
    });
    els.relicChoicesGrid.appendChild(btn);
  });
  openModalSafe(els.relicDialog);
}

function renderCompendiumContent() {
  for (const btn of els.compendiumTabs.querySelectorAll('.tab-chip')) {
    btn.classList.toggle('is-active', btn.dataset.tab === compendiumTab);
  }
  els.compendiumBody.replaceChildren();

  if (compendiumTab === 'units') {
    const list = Object.values(UNITS).filter((u) => !u.token);
    for (const u of list) {
      const row = document.createElement('div');
      row.className = 'comp-item';
      row.innerHTML = `
        <img src="${u.portrait}" alt="${u.name}">
        <div class="comp-item-info">
          <strong>[T${u.tier}] ${u.name} (${u.atk}/${u.hp}) · ${u.archetype}</strong>
          <p>★1：${u.desc(1)}</p>
        </div>
      `;
      els.compendiumBody.appendChild(row);
    }
  } else if (compendiumTab === 'foods') {
    for (const f of Object.values(FOODS)) {
      const row = document.createElement('div');
      row.className = 'comp-item';
      row.innerHTML = `
        <img src="${f.icon}" alt="${f.name}">
        <div class="comp-item-info">
          <strong>[T${f.tier}] ${f.name}</strong>
          <p>${f.desc}</p>
        </div>
      `;
      els.compendiumBody.appendChild(row);
    }
  } else {
    for (const r of Object.values(RELICS)) {
      const row = document.createElement('div');
      row.className = 'comp-item';
      row.innerHTML = `
        <img src="${r.icon}" alt="${r.name}">
        <div class="comp-item-info">
          <strong>${r.name}</strong>
          <p>${r.desc}</p>
        </div>
      `;
      els.compendiumBody.appendChild(row);
    }
  }
}

function populateBattleLogModal(report) {
  els.battleLogList.replaceChildren();
  for (const line of report.logs) {
    const li = document.createElement('li');
    li.textContent = line;
    els.battleLogList.appendChild(li);
  }
}

function openResultModal(runResult) {
  const isWin = runResult === 'victory';
  els.resultDialogTitle.textContent = isWin
    ? '🏆 十胜登顶 · 勇者酒馆霸主！'
    : '💔 不屈红心耗尽 · 虽败犹荣';
  els.resultDialogSub.textContent = `统帅【${session.getCommander().name}】征战至第 ${session.round} 回合，累计夺得 ${session.wins}/${WIN_CROWNS_TARGET} 顶胜场皇冠（平局 ${session.draws} 场）。`;

  els.finalTeamShowcase.replaceChildren();
  for (const u of session.team) {
    const cell = document.createElement('div');
    cell.className = 'final-mini-unit';
    if (!u) {
      cell.textContent = '空槽';
    } else {
      const def = UNITS[u.defId];
      cell.innerHTML = `
        <img src="${def.portrait}" alt="${def.name}">
        <strong>★${u.level} ${def.name}</strong>
        <span>⚔️${u.atk} ❤️${u.hp}</span>
      `;
    }
    els.finalTeamShowcase.appendChild(cell);
  }
  openModalSafe(els.resultDialog);
}

// ================= 全局按钮监听绑定 =================
function bindEvents() {
  els.btnCommanderInfo.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    selection = { kind: 'commander' };
    renderInspector();
  });

  els.btnCompendium.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    renderCompendiumContent();
    openModalSafe(els.compendiumDialog);
  });

  els.compendiumTabs.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.tab-chip');
    if (!btn) return;
    audio.playSfx('click');
    compendiumTab = btn.dataset.tab;
    renderCompendiumContent();
  });

  els.btnHelp.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    openModalSafe(els.helpDialog);
  });

  els.btnOpenLog.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    if (!els.battleLogList.children.length) {
      const li = document.createElement('li');
      li.textContent = '尚未进行战斗，点击右下角【⚔️ 擂鼓开战】后即可查看完整连锁战报！';
      els.battleLogList.replaceChildren(li);
    }
    openModalSafe(els.logDialog);
  });

  els.btnMute.addEventListener('click', () => {
    audio.unlock();
    audio.toggleMute();
    renderHud();
  });

  els.btnReroll.addEventListener('click', () => {
    audio.unlock();
    const res = session.reroll();
    if (!res.ok) {
      showToast(`⚠️ ${res.reason}`);
      return;
    }
    selection = null;
    audio.playSfx('reroll');
    renderAll();
  });

  els.btnFreezeMode.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    freezeMode = !freezeMode;
    if (freezeMode) {
      selection = null;
      showToast('❄️ 冰封锁店模式开启：点击任意酒馆魔物或秘药即可锁定/解锁');
    }
    renderAll();
  });

  els.btnStartBattle.addEventListener('click', () => {
    startAndPlayBattle();
  });

  els.btnSpeed.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    battleSpeed = battleSpeed === 1 ? 2 : battleSpeed === 2 ? 3 : 1;
    els.speedBtnTitle.textContent = `⏩ 倍速 ×${battleSpeed}`;
  });

  els.btnPause.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    battlePaused = !battlePaused;
    els.btnPause.setAttribute('aria-pressed', battlePaused ? 'true' : 'false');
    els.pauseBtnTitle.textContent = battlePaused ? '▶️ 继续观战' : '⏸️ 暂停观战';
  });

  els.btnSkipBattle.addEventListener('click', () => {
    audio.unlock();
    audio.playSfx('click');
    battleSkipRequested = true;
    battlePaused = false;
  });

  els.btnRestartRun.addEventListener('click', () => {
    audio.playSfx('click');
    closeModalSafe(els.resultDialog);
    openCommanderSelectModal();
  });
}

// 初始化启动
setupDialogs();
bindEvents();
renderAll();
openCommanderSelectModal();
