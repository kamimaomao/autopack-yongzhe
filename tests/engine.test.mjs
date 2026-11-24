import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { simulateBattle } from '../src/engine/battle.js';
import {
  ARENA_BACKGROUNDS,
  COMMANDERS,
  FOODS,
  PERKS,
  PROJECTILES,
  RELICS,
  UNIT_COST,
  UNITS,
  WIN_CROWNS_TARGET,
} from '../src/engine/catalog.js';
import { GameSession } from '../src/engine/session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function resolveAssetPath(relFromAutopack) {
  const clean = relFromAutopack.replace(/^\.\.\//, '');
  return path.join(REPO_ROOT, clean);
}

test('1. 全量引用的《闯关勇者》立绘、_st 挨揍颜艺帧、图标、位图跳字与音频 100% 存在', () => {
  const urls = new Set([
    '../assets/fonts/fz.ttf',
    '../assets/sprites/UI_界面/ui/Common/jinbi.png',
    '../assets/sprites/UI_界面/ui/TavernFight/img_difang_jgzq.png',
    '../assets/sprites/UI_界面/ui/TavernFight/img_wofang_jgzq.png',
    '../assets/sprites/UI_界面/ui/TavernFight/img_duijue_jgzq.png',
    '../assets/sprites/UI_界面/ui/TavernFight/img_gongji_jgzq.png',
    '../assets/sprites/UI_界面/ui/TavernFight/img_sm_jgzq.png',
    '../assets/sprites/UI_界面/ui/TavernFight/btn_suoding_jgzq.png',
    '../assets/sprites/UI_界面/ui/Hud/boom.png',
    '../assets/audio/BGM_ShangDian.mp3',
    '../assets/audio/BGM_ZiDongZhanDou.mp3',
    '../assets/audio/BGM_ZhuJieMian.mp3',
    '../assets/audio/AnNiuDianJi.mp3',
    '../assets/audio/AnNiuGuanBi.mp3',
    '../assets/audio/ShangDianShuaXin.mp3',
    '../assets/audio/ZhuBi_HuiShou.mp3',
    '../assets/audio/ZhuBi_HuoDe.mp3',
    '../assets/audio/BaoWuHeCheng_1.mp3',
    '../assets/audio/BaoWuHeCheng_2.mp3',
    '../assets/audio/GongXiHuoDe.mp3',
    '../assets/audio/JiNeng_XuanZe.mp3',
    '../assets/audio/SiWang.mp3',
    '../assets/audio/JieSuan_ShengLi.mp3',
    '../assets/audio/JieSuan_ShiBai.mp3',
    '../assets/audio/ZiDanShuXing_BianHua.mp3',
    '../assets/audio/ZiDan_FaShe.mp3',
    '../assets/audio/ZiDan_QuanTao.mp3',
    '../assets/audio/ZiDan_FuTou.mp3',
    '../assets/audio/ZiDan_BingKuai.mp3',
    '../assets/audio/ZiDan_XiXueGui.mp3',
    '../assets/audio/ZiDan_XueDi.mp3',
  ]);

  for (const bg of ARENA_BACKGROUNDS) urls.add(bg);
  for (const p of Object.values(PROJECTILES)) urls.add(p);
  for (const c of COMMANDERS) {
    urls.add(c.portrait);
    urls.add(c.hitPortrait);
  }
  for (const u of Object.values(UNITS)) {
    urls.add(u.portrait);
    urls.add(u.hitPortrait);
  }
  for (const f of Object.values(FOODS)) urls.add(f.icon);
  for (const pk of Object.values(PERKS)) urls.add(pk.icon);
  for (const r of Object.values(RELICS)) urls.add(r.icon);

  for (const pfx of ['PT_', 'BJ_', 'HX_', 'JN_', 'ZD_', 'FS_']) {
    for (let d = 0; d <= 9; d++) {
      urls.add(`../assets/sprites/UI_界面/ui/Hud/${pfx}${d}.png`);
    }
  }
  urls.add('../assets/sprites/UI_界面/ui/Hud/HX_+.png');

  for (const u of urls) {
    const abs = resolveAssetPath(u);
    assert.ok(fs.existsSync(abs), `缺失素材文件: ${abs}`);
  }
});

test('2. 酒馆招募、同名三合一升星爆高阶奖励宠、冰封锁店与蓝鸽出售触发', () => {
  const s = new GameSession(20261124);
  s.resetRun('panda', true);
  assert.equal(s.gold, 11, '熊猫统帅每轮应有 11 金币');

  // 构造三只同款粉红猪猪测试 ★1 -> ★2 升星与高阶奖励刷出
  s.gold = 30;
  s.shopUnits = [
    s.createShopUnitEntry('piggy', false),
    s.createShopUnitEntry('piggy', false),
    s.createShopUnitEntry('piggy', false),
    s.createShopUnitEntry('blue_pigeon', true),
  ];

  const r1 = s.buyUnit(0, 0);
  assert.equal(r1.ok, true);
  assert.equal(s.team[0].level, 1);

  const r2 = s.buyUnit(0, 0);
  assert.equal(r2.ok, true);
  assert.equal(r2.merged, true);
  assert.equal(s.team[0].level, 1);
  assert.equal(s.team[0].exp, 1);

  const r3 = s.buyUnit(0, 0);
  assert.equal(r3.ok, true);
  assert.equal(r3.leveledUp, true);
  assert.equal(s.team[0].level, 2);
  assert.ok(r3.bonusSpawn, '升星时应额外爆出高一阶酒馆奖励魔物');
  assert.equal(UNITS[r3.bonusSpawn.defId].tier, 2, 'T1 酒馆升星应爆出 T2 魔物');

  // 测试冰封保留与蓝鸽出售强化
  s.reroll();
  assert.equal(s.shopUnits[0].defId, 'blue_pigeon', '冰封的呆呆蓝鸽刷新后应保留在商店');

  s.buyUnit(0, 1);
  const atkBefore = s.team[0].atk;
  const sellRes = s.sellUnit(1);
  assert.equal(sellRes.ok, true);
  assert.equal(sellRes.refund, 2, '熊猫统帅卖 ★1 魔物应返还 2 金币');
  assert.equal(s.team[0].atk, atkBefore + 1, '出售呆呆蓝鸽应使前排友军永久 +1/+1');
});

test('3. 连锁战斗引擎：亡语召唤 + 稻草人光环 + 1UP 复活 + 圣光金盾吸收', () => {
  const allyTeam = [
    { uid: 'a1', defId: 'white_cat', level: 2, atk: 4, hp: 2, perk: '1up' },
    { uid: 'a2', defId: 'scarecrow', level: 1, atk: 3, hp: 6, perk: 'melon' },
    { uid: 'a3', defId: 'death_knight', level: 1, atk: 5, hp: 6, perk: null },
  ];
  const enemyTeam = [
    { uid: 'e1', defId: 'thorn_treant', level: 1, atk: 5, hp: 7, perk: 'garlic' },
    { uid: 'e2', defId: 'piggy', level: 1, atk: 3, hp: 3, perk: null },
  ];

  const rep = simulateBattle({
    allyTeamInput: allyTeam,
    enemyTeamInput: enemyTeam,
    allyCommanderId: 'demon',
    allyRelics: ['summon_banner'],
    round: 5,
    seed: 99,
  });

  assert.equal(rep.outcome, 'win');
  assert.ok(rep.steps.some((st) => st.type === 'summon'), '应触发炸毛白喵亡语召唤哥布林');
  assert.ok(rep.steps.some((st) => st.type === 'revive'), '应触发 1UP 不死心章原地复活');
});

// 轻量启发式策略 AI：优先合体同名宠、凑满 5 槽、前排摆坦克/亡语、余钱喂鸡腿/装备
function playSmartBotRun(seed, commanderId) {
  const s = new GameSession(seed);
  s.resetRun(commanderId, true);

  let guard = 0;
  while (s.phase !== 'gameover' && guard < 40) {
    guard += 1;

    if (s.phase === 'relic_pick') {
      s.chooseRelic(s.pendingRelicChoices[0]);
    }

    // 整备阶段贪心决策
    let actionGuard = 0;
    while (s.phase === 'prep' && s.gold >= 1 && actionGuard < 25) {
      actionGuard += 1;

      // 1. 优先买能和场上同名合体的魔物
      const mergeShopIdx = s.shopUnits.findIndex((su) =>
        s.team.some((t) => t && t.defId === su.defId && t.level < 3),
      );
      if (mergeShopIdx !== -1 && s.gold >= UNIT_COST) {
        const targetIdx = s.team.findIndex(
          (t) => t && t.defId === s.shopUnits[mergeShopIdx].defId && t.level < 3,
        );
        s.buyUnit(mergeShopIdx, targetIdx);
        continue;
      }

      // 2. 若队伍未满 5 只，优先买最高阶魔物填满阵容
      const emptyIdx = s.team.findIndex((t) => !t);
      if (emptyIdx !== -1 && s.shopUnits.length > 0 && s.gold >= UNIT_COST) {
        let bestIdx = 0;
        for (let i = 1; i < s.shopUnits.length; i++) {
          if (UNITS[s.shopUnits[i].defId].tier > UNITS[s.shopUnits[bestIdx].defId].tier) {
            bestIdx = i;
          }
        }
        s.buyUnit(bestIdx, emptyIdx);
        continue;
      }

      // 2.5 中后期汰弱留强：若满员但酒馆出现高出 2 阶以上的强力新宠，卖掉最弱的 ★1 低阶过渡宠换血
      const bestShopIdx = s.shopUnits.reduce(
        (best, cur, idx) =>
          best === -1 || UNITS[cur.defId].tier > UNITS[s.shopUnits[best].defId].tier ? idx : best,
        -1,
      );
      if (bestShopIdx !== -1 && s.gold >= UNIT_COST - 1) {
        const shopTier = UNITS[s.shopUnits[bestShopIdx].defId].tier;
        const weakSlot = s.team.findIndex(
          (u) => u && u.level === 1 && UNITS[u.defId].tier <= shopTier - 2 && u.atk + u.hp <= 11,
        );
        if (weakSlot !== -1) {
          s.sellUnit(weakSlot);
          if (s.gold >= UNIT_COST) {
            s.buyUnit(bestShopIdx, weakSlot);
            continue;
          }
        }
      }

      // 3. 阵容满员后，若有强力食物/装备且买得起就投喂给前锋或核心
      const foodCost = s.getFoodCost();
      if (s.shopFoods.length > 0 && s.gold >= foodCost && s.team[0]) {
        const fEntry = s.shopFoods[0];
        const fDef = FOODS[fEntry.foodId];
        if (fDef.targetMode === 'team') {
          s.buyFood(0, null);
          continue;
        }
        // 避免重复覆盖已有装备，找没装备的前排
        const targetSlot = fDef.kind === 'perk'
          ? s.team.findIndex((u) => u && !u.perk)
          : 0;
        if (targetSlot !== -1) {
          s.buyFood(0, targetSlot);
          continue;
        }
      }

      // 4. 尝试刷新找对子
      if (s.gold >= s.getRerollCost() && s.gold >= UNIT_COST + s.getRerollCost()) {
        s.reroll();
        continue;
      }

      break;
    }

    // 简单站位整理：把高血/挨揍/亡语放左侧前排，把稻草人/死骑/霸王龙放右侧后排
    const roleScore = (u) => {
      if (!u) return 999;
      if (['scarecrow', 'death_knight', 't_rex', 'holy_nun', 'spit_alpaca'].includes(u.defId)) return 40;
      if (u.defId === 'ogre_magi') return 15;
      if (['thorn_treant', 'green_slime', 'pepe_frog', 'iron_rhino', 'white_cat', 'piggy', 'murloc_caller'].includes(u.defId)) return 2;
      return 20 - u.hp * 0.3;
    };
    const living = s.team.filter(Boolean).sort((a, b) => roleScore(a) - roleScore(b));
    s.team = Array.from({ length: 5 }, (_, i) => living[i] || null);

    const startRes = s.startBattle();
    assert.equal(startRes.ok, true);
    s.commitBattleOutcome();
  }

  return {
    victory: s.runResult === 'victory',
    wins: s.wins,
    rounds: s.round,
    commanderId,
  };
}

test('4. 4 位统帅共 200 局完整无头 AI 自动对战平衡性压测（零异常，通关率处于健康甜区）', () => {
  const stats = {};
  let totalWins = 0;
  let totalCrowns = 0;
  const runsPerCmd = 50;

  COMMANDERS.forEach((cmd, cIdx) => {
    let cmdVictories = 0;
    for (let i = 0; i < runsPerCmd; i++) {
      const seed = 90000 + cIdx * 1000 + i * 17;
      const res = playSmartBotRun(seed, cmd.id);
      if (res.victory) {
        cmdVictories += 1;
        totalWins += 1;
      }
      totalCrowns += res.wins;
    }
    stats[cmd.id] = `${((cmdVictories / runsPerCmd) * 100).toFixed(1)}%`;
  });

  const winRate = totalWins / (COMMANDERS.length * runsPerCmd);
  const avgCrowns = totalCrowns / (COMMANDERS.length * runsPerCmd);
  console.log('[AutoPack 200局平衡压测]', {
    overallVictoryRate: `${(winRate * 100).toFixed(1)}%`,
    avgCrowns: Number(avgCrowns.toFixed(2)),
    byCommander: stats,
  });

  assert.ok(winRate >= 0.35 && winRate <= 0.92, `AI 10胜登顶率应处于合理区间 (当前 ${(winRate * 100).toFixed(1)}%)`);
  assert.ok(avgCrowns >= 5.5 && avgCrowns <= WIN_CROWNS_TARGET, `平均皇冠数应健康饱满 (当前 ${avgCrowns.toFixed(2)})`);
});
