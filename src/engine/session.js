// 《猛宠斗阵 · 勇者酒馆自走棋》战前酒馆整备、三合一升星、投喂装备与敌军生成器

import {
  ARENA_BACKGROUNDS,
  COMMANDERS,
  DEFAULT_FOOD_COST,
  ENEMY_WARBAND_TITLES,
  FOODS,
  INITIAL_HEARTS,
  MAX_TEAM_SLOTS,
  RELIC_IDS,
  RELICS,
  REROLL_COST,
  SHOP_FOOD_SLOT_COUNT,
  SHOP_UNIT_IDS,
  TURN_GOLD,
  UNIT_COST,
  UNITS,
  WIN_CROWNS_TARGET,
  getShopUnitSlotCount,
  getTavernTierByRound,
} from './catalog.js';
import { simulateBattle } from './battle.js';
import { createRng } from './prng.js';

// 升星经验规则：★1 满 2 点经验升 ★2；★2 满 3 点经验升 ★3（最高 ★3）
export function getExpNeededForNextLevel(level) {
  if (level === 1) return 2;
  if (level === 2) return 3;
  return 0;
}

export class GameSession {
  constructor(seed = Date.now()) {
    this.baseSeed = seed >>> 0;
    this.rng = createRng(this.baseSeed);
    this.uidCounter = 1;
    this.resetRun('tauren', false);
  }

  nextUid(prefix = 'u') {
    this.uidCounter += 1;
    return `${prefix}_${this.uidCounter}`;
  }

  resetRun(commanderId = 'tauren', autoStart = true) {
    this.commanderId = COMMANDERS.some((c) => c.id === commanderId) ? commanderId : 'tauren';
    this.round = 1;
    this.wins = 0;
    this.hearts = INITIAL_HEARTS;
    this.draws = 0;
    this.phase = autoStart ? 'prep' : 'commander_select'; // commander_select | relic_pick | prep | battle | gameover
    this.runResult = null; // 'victory' | 'defeat' | null

    this.team = Array(MAX_TEAM_SLOTS).fill(null); // index 0 = 1号前锋, index 4 = 5号后卫
    this.shopUnits = [];
    this.shopFoods = [];
    this.shopPermBuff = { atk: 0, hp: 0 }; // 秘制罐头永久商店增益

    this.relics = [];
    this.pendingRelicChoices = [];
    this.rerollsThisTurn = 0;
    this.gold = this.getStartingGold();

    this.enemyPreview = null;
    this.lastBattleReport = null;
    this.history = [];

    this.rollShop({ keepFrozen: false });
    this.enemyPreview = this.generateEnemyWarband(this.round);
    return this;
  }

  getCommander() {
    return COMMANDERS.find((c) => c.id === this.commanderId) || COMMANDERS[0];
  }

  getTavernTier() {
    return getTavernTierByRound(this.round);
  }

  getBackgroundUrl() {
    return ARENA_BACKGROUNDS[(this.round - 1) % ARENA_BACKGROUNDS.length];
  }

  getStartingGold() {
    let g = TURN_GOLD;
    if (this.commanderId === 'panda') g += 1;
    if (this.relics.includes('gold_pouch')) g += 2;
    return g;
  }

  getRerollCost() {
    if (this.commanderId === 'tauren' && this.rerollsThisTurn === 0) return 0;
    return REROLL_COST;
  }

  getFoodCost() {
    return this.commanderId === 'witch' ? Math.max(1, DEFAULT_FOOD_COST - 1) : DEFAULT_FOOD_COST;
  }

  getSellValue(unit) {
    if (!unit) return 0;
    return unit.level + (this.commanderId === 'panda' ? 1 : 0);
  }

  createShopUnitEntry(defId, frozen = false, isBonus = false) {
    const def = UNITS[defId];
    return {
      shopUid: this.nextUid('su'),
      defId,
      atk: def.atk + this.shopPermBuff.atk,
      hp: def.hp + this.shopPermBuff.hp,
      frozen,
      isBonus,
    };
  }

  createShopFoodEntry(foodId, frozen = false) {
    return {
      shopUid: this.nextUid('sf'),
      foodId,
      frozen,
    };
  }

  rollShop({ keepFrozen = true } = {}) {
    const tier = this.getTavernTier();
    const unitPool = SHOP_UNIT_IDS.filter((id) => UNITS[id].tier <= tier);
    const foodPool = Object.keys(FOODS).filter((id) => FOODS[id].tier <= tier);

    const targetUnitCount = getShopUnitSlotCount(this.round);
    const keptUnits = keepFrozen ? this.shopUnits.filter((s) => s && s.frozen) : [];
    const nextUnits = [...keptUnits];
    while (nextUnits.length < targetUnitCount) {
      const defId = this.rng.pick(unitPool);
      nextUnits.push(this.createShopUnitEntry(defId, false, false));
    }
    this.shopUnits = nextUnits;

    const keptFoods = keepFrozen ? this.shopFoods.filter((f) => f && f.frozen) : [];
    const nextFoods = [...keptFoods];
    while (nextFoods.length < SHOP_FOOD_SLOT_COUNT) {
      const foodId = this.rng.pick(foodPool);
      nextFoods.push(this.createShopFoodEntry(foodId, false));
    }
    this.shopFoods = nextFoods;
  }

  reroll() {
    if (this.phase !== 'prep') return { ok: false, reason: '当前不在整备阶段' };
    const cost = this.getRerollCost();
    if (this.gold < cost) return { ok: false, reason: '金币不足，无法刷新酒馆' };
    this.gold -= cost;
    this.rerollsThisTurn += 1;
    this.rollShop({ keepFrozen: true });
    return { ok: true, cost };
  }

  toggleFreezeUnit(shopIndex) {
    const item = this.shopUnits[shopIndex];
    if (!item) return { ok: false };
    item.frozen = !item.frozen;
    return { ok: true, frozen: item.frozen };
  }

  toggleFreezeFood(foodIndex) {
    const item = this.shopFoods[foodIndex];
    if (!item) return { ok: false };
    item.frozen = !item.frozen;
    return { ok: true, frozen: item.frozen };
  }

  // 给目标魔物增加经验并处理升星奖励（爆出高一阶酒馆奖励魔物！）
  grantUnitExp(unit, expGain = 1, bonusAtk = 1, bonusHp = 1) {
    unit.atk += bonusAtk;
    unit.hp += bonusHp;
    unit.maxHp = Math.max(unit.maxHp + bonusHp, unit.hp);

    if (unit.level >= 3) {
      return { leveledUp: false, newLevel: 3, bonusSpawn: null };
    }

    unit.exp += expGain;
    let leveledUp = false;
    while (unit.level < 3) {
      const need = getExpNeededForNextLevel(unit.level);
      if (unit.exp >= need) {
        unit.exp -= need;
        unit.level += 1;
        leveledUp = true;
      } else {
        break;
      }
    }
    if (unit.level >= 3) unit.exp = 0;

    let bonusSpawn = null;
    if (leveledUp) {
      // 四叶幸运币宝物升星额外 +2/+2
      if (this.relics.includes('clover_coin')) {
        unit.atk += 2;
        unit.hp += 2;
        unit.maxHp += 2;
      }
      // 经典自走棋爽点：升星立刻在商店额外刷出 1 只高一阶（最高 T5）魔物！
      const bonusTier = Math.min(5, this.getTavernTier() + 1);
      const exactPool = SHOP_UNIT_IDS.filter((id) => UNITS[id].tier === bonusTier);
      const fallbackPool = SHOP_UNIT_IDS.filter((id) => UNITS[id].tier <= bonusTier);
      const pickId = this.rng.pick(exactPool.length > 0 ? exactPool : fallbackPool);
      if (pickId && this.shopUnits.length < 7) {
        bonusSpawn = this.createShopUnitEntry(pickId, false, true);
        this.shopUnits.push(bonusSpawn);
      }
    }

    return { leveledUp, newLevel: unit.level, bonusSpawn };
  }

  buyUnit(shopIndex, teamSlotIndex) {
    if (this.phase !== 'prep') return { ok: false, reason: '当前不在整备阶段' };
    const shopEntry = this.shopUnits[shopIndex];
    if (!shopEntry) return { ok: false, reason: '该酒馆槽位已售空' };
    if (teamSlotIndex < 0 || teamSlotIndex >= MAX_TEAM_SLOTS) {
      return { ok: false, reason: '无效的上阵槽位' };
    }
    if (this.gold < UNIT_COST) {
      return { ok: false, reason: `需要 ${UNIT_COST} 金币才能招募魔物` };
    }

    const existing = this.team[teamSlotIndex];

    // 情况 A：直接叠到同名未满星友军身上合体！
    if (existing) {
      if (existing.defId !== shopEntry.defId) {
        return { ok: false, reason: '该位置已有其他魔物，请点选空位或同名魔物合体' };
      }
      if (existing.level >= 3) {
        return { ok: false, reason: '该魔物已达最高 ★3，无需继续吞并' };
      }

      this.gold -= UNIT_COST;
      this.shopUnits.splice(shopIndex, 1);

      // 若商店魔物自带更高罐头白值，先取高值再 +1/+1
      existing.atk = Math.max(existing.atk, shopEntry.atk);
      existing.hp = Math.max(existing.hp, shopEntry.hp);
      existing.maxHp = Math.max(existing.maxHp, existing.hp);
      const mergeRes = this.grantUnitExp(existing, 1, 1, 1);
      if (existing.defId === 'red_crab') {
        const others = this.team.filter((a) => a && a.uid !== existing.uid);
        if (others.length > 0) {
          const ratio = existing.level === 1 ? 0.5 : existing.level === 2 ? 0.75 : 1.0;
          const copied = Math.max(existing.hp, Math.round(Math.max(...others.map((a) => a.hp)) * ratio));
          existing.hp = copied;
          existing.maxHp = Math.max(existing.maxHp, copied);
        }
      }
      return {
        ok: true,
        merged: true,
        unit: existing,
        leveledUp: mergeRes.leveledUp,
        bonusSpawn: mergeRes.bonusSpawn,
      };
    }

    // 情况 B：放入空槽位登场
    this.gold -= UNIT_COST;
    this.shopUnits.splice(shopIndex, 1);

    const def = UNITS[shopEntry.defId];
    const newUnit = {
      uid: this.nextUid('ally'),
      defId: shopEntry.defId,
      name: def.name,
      level: 1,
      exp: 0,
      atk: shopEntry.atk,
      hp: shopEntry.hp,
      maxHp: shopEntry.hp,
      perk: null,
    };

    // 铁钳红蟹登场技：复制最高生命友军 50% 血量
    if (newUnit.defId === 'red_crab') {
      const allies = this.team.filter(Boolean);
      if (allies.length > 0) {
        const maxAllyHp = Math.max(...allies.map((a) => a.hp));
        const copied = Math.max(newUnit.hp, Math.round(maxAllyHp * 0.5));
        newUnit.hp = copied;
        newUnit.maxHp = copied;
      }
    }

    this.team[teamSlotIndex] = newUnit;
    return { ok: true, merged: false, unit: newUnit, leveledUp: false, bonusSpawn: null };
  }

  // 队伍内部调换位置，或把两只同名友军合体腾出空位
  moveOrMergeTeam(fromIdx, toIdx) {
    if (this.phase !== 'prep') return { ok: false, reason: '当前不在整备阶段' };
    if (fromIdx === toIdx) return { ok: false, reason: '相同槽位' };
    const src = this.team[fromIdx];
    const dst = this.team[toIdx];
    if (!src) return { ok: false, reason: '起始槽位为空' };

    // 同名且目标未满 3 星 → 合体！
    if (dst && dst.defId === src.defId && dst.level < 3) {
      dst.atk = Math.max(dst.atk, src.atk);
      dst.hp = Math.max(dst.hp, src.hp);
      dst.maxHp = Math.max(dst.maxHp, dst.hp);
      if (!dst.perk && src.perk) dst.perk = src.perk;

      const totalExpGain = 1 + src.exp + (src.level === 2 ? 2 : 0);
      this.team[fromIdx] = null;
      const mergeRes = this.grantUnitExp(dst, totalExpGain, 1, 1);
      return {
        ok: true,
        action: 'merge',
        unit: dst,
        leveledUp: mergeRes.leveledUp,
        bonusSpawn: mergeRes.bonusSpawn,
      };
    }

    // 否则直接交换位置
    this.team[fromIdx] = dst;
    this.team[toIdx] = src;
    return { ok: true, action: 'swap' };
  }

  sellUnit(teamSlotIndex) {
    if (this.phase !== 'prep') return { ok: false, reason: '当前不在整备阶段' };
    const unit = this.team[teamSlotIndex];
    if (!unit) return { ok: false, reason: '该槽位没有魔物' };

    const livingCount = this.team.filter(Boolean).length;
    if (livingCount <= 1 && this.gold < UNIT_COST && this.shopUnits.length > 0) {
      // 允许卖，但若卖光没钱买会在开战前提示；这里不做死锁拦截以免卡手，交给开战校验或兜底
    }

    const refund = this.getSellValue(unit);
    this.gold += refund;
    this.team[teamSlotIndex] = null;

    const buffedTargets = [];
    // 呆呆蓝鸽出售技能：最靠前的 2 名友军永久 +lv/+lv
    if (unit.defId === 'blue_pigeon') {
      const frontTwo = this.team.filter(Boolean).slice(0, 2);
      const gain = 1 * unit.level;
      for (const ally of frontTwo) {
        ally.atk += gain;
        ally.hp += gain;
        ally.maxHp += gain;
        buffedTargets.push(ally.uid);
      }
    }

    return { ok: true, refund, soldUnit: unit, buffedTargets };
  }

  buyFood(foodIndex, targetTeamSlotIndex = null) {
    if (this.phase !== 'prep') return { ok: false, reason: '当前不在整备阶段' };
    const foodEntry = this.shopFoods[foodIndex];
    if (!foodEntry) return { ok: false, reason: '该食物已售空' };

    const food = FOODS[foodEntry.foodId];
    const cost = this.getFoodCost();
    if (this.gold < cost) return { ok: false, reason: `需要 ${cost} 金币购买【${food.name}】` };

    const allies = this.team.filter(Boolean);
    if (food.targetMode === 'unit') {
      const target = targetTeamSlotIndex !== null ? this.team[targetTeamSlotIndex] : null;
      if (!target) return { ok: false, reason: `请先点选 1 只我方魔物来投喂【${food.name}】` };
      if (food.kind === 'exp' && target.level >= 3 && food.atk === 0) {
        return { ok: false, reason: '该魔物已满 ★3' };
      }
    } else if (food.kind !== 'shop_buff' && allies.length === 0) {
      return { ok: false, reason: '场上还没有可受惠的友军魔物' };
    }

    this.gold -= cost;
    this.shopFoods.splice(foodIndex, 1);

    const witchBonusHp = this.commanderId === 'witch' ? 1 : 0;
    const affectedUids = [];
    let leveledUp = false;
    let bonusSpawn = null;

    if (food.kind === 'stat') {
      const target = this.team[targetTeamSlotIndex];
      target.atk += food.atk;
      target.hp += food.hp + witchBonusHp;
      target.maxHp += food.hp + witchBonusHp;
      affectedUids.push(target.uid);
      this.applyNunFoodPassive(target);
    } else if (food.kind === 'perk') {
      const target = this.team[targetTeamSlotIndex];
      target.perk = food.perkId;
      if (witchBonusHp > 0) {
        target.hp += witchBonusHp;
        target.maxHp += witchBonusHp;
      }
      affectedUids.push(target.uid);
      this.applyNunFoodPassive(target);
    } else if (food.kind === 'exp') {
      const target = this.team[targetTeamSlotIndex];
      if (witchBonusHp > 0) {
        target.hp += witchBonusHp;
        target.maxHp += witchBonusHp;
      }
      const res = this.grantUnitExp(target, food.exp, food.atk, food.hp);
      leveledUp = res.leveledUp;
      bonusSpawn = res.bonusSpawn;
      affectedUids.push(target.uid);
      this.applyNunFoodPassive(target);
    } else if (food.kind === 'team_random') {
      const picks = this.rng.shuffle(allies).slice(0, food.count);
      for (const p of picks) {
        p.atk += food.atk;
        p.hp += food.hp + witchBonusHp;
        p.maxHp += food.hp + witchBonusHp;
        affectedUids.push(p.uid);
      }
    } else if (food.kind === 'team_all') {
      for (const p of allies) {
        p.atk += food.atk;
        p.hp += food.hp + witchBonusHp;
        p.maxHp += food.hp + witchBonusHp;
        affectedUids.push(p.uid);
      }
    } else if (food.kind === 'shop_buff') {
      this.shopPermBuff.atk += food.atk;
      this.shopPermBuff.hp += food.hp;
      for (const su of this.shopUnits) {
        su.atk += food.atk;
        su.hp += food.hp;
      }
    }

    // 鸡腿法杖宝物：每次买食物随机友军 +1/+2
    if (this.relics.includes('chef_wand') && allies.length > 0) {
      const lucky = this.rng.pick(allies);
      lucky.atk += 1;
      lucky.hp += 2;
      lucky.maxHp += 2;
      if (!affectedUids.includes(lucky.uid)) affectedUids.push(lucky.uid);
    }

    return { ok: true, food, affectedUids, leveledUp, bonusSpawn };
  }

  applyNunFoodPassive(fedTarget) {
    const nuns = this.team.filter((u) => u && u.defId === 'holy_nun');
    for (const nun of nuns) {
      const bonus = 1 * nun.level;
      fedTarget.atk += bonus;
      fedTarget.hp += bonus;
      fedTarget.maxHp += bonus;
    }
  }

  // 点击【开战】时先结算整备末成长技能（柴犬盾卫、神兽白羊驼、暴食霸王龙、勇者行囊）
  triggerEndOfPrepGrowth() {
    const growthLogs = [];
    for (let idx = 0; idx < MAX_TEAM_SLOTS; idx++) {
      const u = this.team[idx];
      if (!u) continue;

      if (u.defId === 'shiba_guard') {
        let remain = u.level;
        for (let j = idx - 1; j >= 0 && remain > 0; j--) {
          if (this.team[j]) {
            this.team[j].atk += 1;
            this.team[j].hp += 2;
            this.team[j].maxHp += 2;
            remain -= 1;
            growthLogs.push(`🐕【${u.name}】护主使前方【${this.team[j].name}】永久 +1/+2！`);
          }
        }
      } else if (u.defId === 'spit_alpaca') {
        const stars = this.team.filter((ally) => ally && ally.level >= 2);
        for (const st of stars) {
          st.atk += 1 * u.level;
          st.hp += 2 * u.level;
          st.maxHp += 2 * u.level;
        }
        if (stars.length > 0) {
          growthLogs.push(`🦙【${u.name}】仙露共鸣强化了 ${stars.length} 名高星友军！`);
        }
      } else if (u.defId === 't_rex') {
        const others = this.team.filter((ally) => ally && ally.uid !== u.uid);
        const gain = 2 * u.level;
        for (const o of others) {
          o.atk += gain;
          o.hp += gain;
          o.maxHp += gain;
        }
        if (others.length > 0) {
          growthLogs.push(`🦖【${u.name}】百兽霸王餐使全体队友永久 +${gain}/+${gain}！`);
        }
      }
    }

    if (this.relics.includes('pack_bag')) {
      const living = this.team.filter(Boolean);
      const back = living[living.length - 1];
      if (back) {
        back.atk += 2;
        back.hp += 2;
        back.maxHp += 2;
        growthLogs.push(`🎒【勇者行囊】使压阵后卫【${back.name}】永久 +2/+2！`);
      }
    }

    return growthLogs;
  }

  // 生成契合当前回合强度的敌方 AI 战队（兼具主题协同与平滑数值曲线）
  generateEnemyWarband(round) {
    const tier = getTavernTierByRound(round);
    const titleObj = ENEMY_WARBAND_TITLES[(round - 1) % ENEMY_WARBAND_TITLES.length];
    let teamSize = 5;
    if (round === 1) teamSize = 3;
    else if (round === 2) teamSize = 3 + (this.rng.next() < 0.65 ? 1 : 0);
    else if (round === 3) teamSize = 4 + (this.rng.next() < 0.55 ? 1 : 0);

    const pool = SHOP_UNIT_IDS.filter((id) => UNITS[id].tier <= tier);
    const highPool = SHOP_UNIT_IDS.filter((id) => UNITS[id].tier === tier);

    const units = [];
    for (let i = 0; i < teamSize; i++) {
      const useHigh = (i === 0 || (i === 1 && round >= 5)) && round >= 3 && this.rng.next() < 0.68;
      const defId = this.rng.pick(useHigh && highPool.length > 0 ? highPool : pool);
      const def = UNITS[defId];

      let level = 1;
      if (round >= 5 && i === 0 && this.rng.next() < 0.45) level = 2;
      if (round >= 9 && i <= 1 && this.rng.next() < 0.60) level = 2;
      if (round >= 12 && i === 0 && this.rng.next() < 0.35) level = 3;

      // 平滑回合属性成长：前2轮轻快破冰，中后期稳步抬升压迫感与决赛圈博弈感
      const effRound = Math.max(0, round - 1);
      const scaleAtk = Math.floor(effRound * 0.78) + (level - 1) * 2;
      const scaleHp = Math.floor(effRound * 1.05) + (level - 1) * 2;

      let perk = null;
      if (round >= 4 && i === 0 && this.rng.next() < 0.42) {
        perk = this.rng.pick(['garlic', 'honey', 'axe']);
      }
      if (round >= 8 && i <= 1 && this.rng.next() < 0.48) {
        perk = this.rng.pick(['melon', 'axe', 'splash', '1up']);
      }

      units.push({
        uid: this.nextUid('enemy'),
        defId,
        name: def.name,
        level,
        atk: Math.max(1, def.atk + scaleAtk),
        hp: Math.max(1, def.hp + scaleHp),
        maxHp: Math.max(1, def.hp + scaleHp),
        perk,
      });
    }

    // 站位智能微调：把高血坦克或亡语放前排，把南瓜稻草人/双头食人魔/亡灵死骑放中后排
    const roleWeight = (u) => {
      if (['scarecrow', 'death_knight', 'ragnaros'].includes(u.defId)) return 30;
      if (u.defId === 'ogre_magi') return 12; // 尽量在 2 号位紧贴前锋
      if (['white_cat', 'piggy', 'murloc_caller', 'thorn_treant', 'green_slime', 'pepe_frog'].includes(u.defId)) return 1;
      return 15 - u.hp * 0.2;
    };
    units.sort((a, b) => roleWeight(a) - roleWeight(b));

    return {
      title: `第${round}轮 · ${titleObj.prefix}`,
      tier,
      units,
    };
  }

  // 开战并生成完整战斗数据（由 UI 逐帧播放后调用 commitBattleOutcome 进入下一轮）
  startBattle() {
    if (this.phase !== 'prep') return { ok: false, reason: '当前不在整备阶段' };
    const compactedTeam = this.team.filter(Boolean);
    if (compactedTeam.length === 0) {
      return { ok: false, reason: '请至少招募 1 只魔物上阵再开战！' };
    }

    const prepGrowthLogs = this.triggerEndOfPrepGrowth();

    // 自动左对齐紧凑站位（保持相对先后顺序不变，消除空隙让前锋站上 1 号位）
    const nonNull = this.team.filter(Boolean);
    this.team = Array.from({ length: MAX_TEAM_SLOTS }, (_, i) => nonNull[i] || null);

    if (!this.enemyPreview) {
      this.enemyPreview = this.generateEnemyWarband(this.round);
    }

    const battleSeed = (this.baseSeed + this.round * 7919 + this.wins * 131) >>> 0;
    const report = simulateBattle({
      allyTeamInput: nonNull,
      enemyTeamInput: this.enemyPreview.units,
      allyCommanderId: this.commanderId,
      allyRelics: this.relics,
      round: this.round,
      seed: battleSeed,
    });

    report.prepGrowthLogs = prepGrowthLogs;
    this.lastBattleReport = report;
    this.phase = 'battle';

    return { ok: true, report };
  }

  commitBattleOutcome() {
    if (this.phase !== 'battle' || !this.lastBattleReport) {
      return { ok: false };
    }

    const { outcome } = this.lastBattleReport;
    this.history.push({
      round: this.round,
      outcome,
      enemyTitle: this.enemyPreview?.title || '',
    });

    if (outcome === 'win') {
      this.wins += 1;
    } else if (outcome === 'loss') {
      this.hearts = Math.max(0, this.hearts - 1);
    } else {
      this.draws += 1;
    }

    if (this.wins >= WIN_CROWNS_TARGET) {
      this.phase = 'gameover';
      this.runResult = 'victory';
      return { ok: true, gameOver: true, runResult: 'victory' };
    }

    if (this.hearts <= 0) {
      this.phase = 'gameover';
      this.runResult = 'defeat';
      return { ok: true, gameOver: true, runResult: 'defeat' };
    }

    const prevTier = this.getTavernTier();
    this.round += 1;
    const nextTier = this.getTavernTier();

    this.rerollsThisTurn = 0;
    this.gold = this.getStartingGold();
    this.rollShop({ keepFrozen: true });
    this.enemyPreview = this.generateEnemyWarband(this.round);

    // 升入 T2(第3轮) / T3(第5轮) / T4(第7轮) 时触发镇馆宝物三选一！
    if (nextTier > prevTier && [2, 3, 4].includes(nextTier) && this.relics.length < 3) {
      const unowned = RELIC_IDS.filter((id) => !this.relics.includes(id));
      this.pendingRelicChoices = this.rng.shuffle(unowned).slice(0, 3);
      if (this.pendingRelicChoices.length > 0) {
        this.phase = 'relic_pick';
        return { ok: true, gameOver: false, relicPick: true, choices: this.pendingRelicChoices };
      }
    }

    this.phase = 'prep';
    return { ok: true, gameOver: false, relicPick: false };
  }

  chooseRelic(relicId) {
    if (this.phase !== 'relic_pick') return { ok: false };
    const chosen = this.pendingRelicChoices.includes(relicId)
      ? relicId
      : this.pendingRelicChoices[0];
    if (chosen && !this.relics.includes(chosen)) {
      this.relics.push(chosen);
      if (chosen === 'gold_pouch') {
        this.gold += 2;
      }
    }
    this.pendingRelicChoices = [];
    this.phase = 'prep';
    return { ok: true, relic: RELICS[chosen] };
  }
}
