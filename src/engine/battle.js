// 《猛宠斗阵 · 勇者酒馆自走棋》事件驱动排队对撞战斗引擎（纯函数快照序列，支持倍速回放与瞬时无头压测）

import {
  MAX_TEAM_SLOTS,
  PROJECTILES,
  UNITS,
} from './catalog.js';
import { createRng } from './prng.js';

function cloneFighter(u, side, seqObj) {
  const def = UNITS[u.defId];
  return {
    uid: u.uid || `${side}_${++seqObj.id}`,
    side,
    defId: u.defId,
    name: def ? def.name : u.name,
    level: u.level || 1,
    exp: u.exp || 0,
    atk: Math.max(1, Math.round(u.atk)),
    hp: Math.max(1, Math.round(u.hp)),
    maxHp: Math.max(1, Math.round(u.maxHp || u.hp)),
    perk: u.perk || null,
    revived: Boolean(u.revived),
    token: Boolean(def?.token),
  };
}

function snapshotTeam(arr) {
  return arr.map((u) => ({
    uid: u.uid,
    side: u.side,
    defId: u.defId,
    name: u.name,
    level: u.level,
    atk: u.atk,
    hp: Math.max(0, u.hp),
    maxHp: u.maxHp,
    perk: u.perk,
    revived: u.revived,
  }));
}

/**
 * 执行一整场 5v5 排队自走棋自动战斗，返回完整分步动画帧 steps 与胜负结果
 */
export function simulateBattle({
  allyTeamInput,
  enemyTeamInput,
  allyCommanderId = 'tauren',
  enemyCommanderId = null,
  allyRelics = [],
  round = 1,
  seed = Date.now(),
}) {
  const rng = createRng(seed);
  const seq = { id: 100 };
  const relicSet = new Set(allyRelics);

  const allies = allyTeamInput
    .filter(Boolean)
    .slice(0, MAX_TEAM_SLOTS)
    .map((u) => cloneFighter(u, 'ally', seq));

  const enemies = enemyTeamInput
    .filter(Boolean)
    .slice(0, MAX_TEAM_SLOTS)
    .map((u) => cloneFighter(u, 'enemy', seq));

  const steps = [];
  const logs = [];
  const pendingHurts = [];

  function getTeam(side) {
    return side === 'ally' ? allies : enemies;
  }

  function getEnemyTeam(side) {
    return side === 'ally' ? enemies : allies;
  }

  function pushStep(type, payload = {}) {
    if (payload.log) {
      logs.push(payload.log);
    }
    steps.push({
      type,
      allyTeam: snapshotTeam(allies),
      enemyTeam: snapshotTeam(enemies),
      ...payload,
    });
  }

  function buffUnit(target, dAtk, dHp, reasonText, actorUid = null) {
    if (!target || target.hp <= 0) return;
    target.atk = Math.max(1, target.atk + dAtk);
    target.hp += dHp;
    target.maxHp = Math.max(target.maxHp + Math.max(0, dHp), target.hp);
    pushStep('buff', {
      actorUid: actorUid || target.uid,
      targetUid: target.uid,
      targetSide: target.side,
      dAtk,
      dHp,
      sfx: 'ZiDanShuXing_BianHua',
      popups: [
        {
          uid: target.uid,
          side: target.side,
          prefix: 'HX_',
          text: `+${dAtk}/+${dHp}`,
          amount: Math.max(dAtk, dHp),
          isHeal: true,
        },
      ],
      log: reasonText,
    });
  }

  function healUnit(target, amount, reasonText, overheal = false) {
    if (!target || target.hp <= 0 || amount <= 0) return 0;
    const before = target.hp;
    if (overheal) {
      target.hp += amount;
      target.maxHp = Math.max(target.maxHp, target.hp);
    } else {
      target.hp = Math.min(target.maxHp, target.hp + amount);
    }
    const gained = target.hp - before;
    if (gained > 0) {
      pushStep('heal', {
        actorUid: target.uid,
        targetUid: target.uid,
        targetSide: target.side,
        sfx: 'ZiDanShuXing_BianHua',
        popups: [
          {
            uid: target.uid,
            side: target.side,
            prefix: 'HX_',
            text: `+${gained}`,
            amount: gained,
            isHeal: true,
          },
        ],
        log: reasonText,
      });
    }
    return gained;
  }

  function applyDamageRaw(target, rawDmg, { source = null, ignoreShield = false, ignoreArmor = false, prefix = 'PT_' } = {}) {
    if (!target || target.hp <= 0 || rawDmg <= 0) {
      return { actual: 0, shieldBroken: false, killed: false, popup: null };
    }

    let dmg = Math.round(rawDmg);
    let shieldBroken = false;

    if (!ignoreShield && target.perk === 'melon') {
      const blocked = Math.min(16, dmg);
      dmg = Math.max(0, dmg - blocked);
      target.perk = null;
      shieldBroken = true;
    } else if (!ignoreArmor && target.perk === 'garlic') {
      dmg = Math.max(1, dmg - 2);
    }

    target.hp -= dmg;
    const killed = target.hp <= 0;

    // 入队受击事件（包括荆棘树精阵亡前瞬间反刺，以及存活受击技能）
    if (dmg > 0 || shieldBroken) {
      pendingHurts.push({ target, source, dmg });
    }

    const chosenPrefix = dmg >= 12 ? 'BJ_' : prefix;
    return {
      actual: dmg,
      shieldBroken,
      killed,
      popup: {
        uid: target.uid,
        side: target.side,
        prefix: chosenPrefix,
        amount: dmg,
        heavy: dmg >= 12,
        shieldBroken,
      },
    };
  }

  function summonUnit(side, slotIdx, defId, atk, hp, level = 1, extraOpts = {}) {
    const team = getTeam(side);
    if (team.length >= MAX_TEAM_SLOTS) return null;

    const def = UNITS[defId];
    if (!def) return null;

    const unit = {
      uid: `sum_${side}_${++seq.id}`,
      side,
      defId,
      name: def.name,
      level,
      exp: 0,
      atk: Math.max(1, Math.round(atk)),
      hp: Math.max(1, Math.round(hp)),
      maxHp: Math.max(1, Math.round(hp)),
      perk: extraOpts.perk || null,
      revived: Boolean(extraOpts.revived),
      token: Boolean(def.token),
    };

    // 我方亡灵号角宝物加成
    if (side === 'ally' && relicSet.has('summon_banner') && !extraOpts.revived) {
      unit.atk += 2;
      unit.hp += 2;
      unit.maxHp += 2;
    }

    const insertAt = Math.max(0, Math.min(team.length, slotIdx));
    team.splice(insertAt, 0, unit);

    pushStep(extraOpts.revived ? 'revive' : 'summon', {
      actorUid: unit.uid,
      targetUid: unit.uid,
      targetSide: side,
      sfx: extraOpts.revived ? 'GongXiHuoDe' : 'BaoWuHeCheng_2',
      log: extraOpts.log || `✨ ${side === 'ally' ? '我方' : '敌方'}召唤了【${unit.name}】(${unit.atk}/${unit.hp})！`,
    });

    // 南瓜稻草人召唤光环
    if (!extraOpts.revived) {
      const crows = team.filter((f) => f.uid !== unit.uid && f.hp > 0 && f.defId === 'scarecrow');
      for (const crow of crows) {
        const dA = 2 * crow.level;
        const dH = 1 * crow.level;
        buffUnit(
          unit,
          dA,
          dH,
          `🎃【${crow.name}】丰收号令使新召唤的【${unit.name}】获得 +${dA}/+${dH}！`,
          crow.uid,
        );
      }
    }

    return unit;
  }

  function shootProjectile({
    actor,
    target,
    dmg,
    proj = PROJECTILES.stone,
    sfx = 'ZiDan_FaShe',
    prefix = 'PT_',
    skillLabel = '',
  }) {
    if (!target || target.hp <= 0) return;
    const res = applyDamageRaw(target, dmg, { source: actor, prefix });
    pushStep('projectile', {
      actorUid: actor?.uid || null,
      actorSide: actor?.side || 'ally',
      targetUid: target.uid,
      targetSide: target.side,
      projectile: proj,
      sfx,
      hitUids: res.actual > 0 ? [target.uid] : [],
      popups: res.popup ? [res.popup] : [],
      log: `${actor ? `【${actor.name}】` : ''}发动${skillLabel}，对【${target.name}】造成 ${res.actual} 点伤害${res.shieldBroken ? '（击碎圣盾）' : ''}！`,
    });
  }

  function resolveChainReactions() {
    let guard = 0;
    while ((pendingHurts.length > 0 || allies.some((u) => u.hp <= 0) || enemies.some((u) => u.hp <= 0)) && guard < 80) {
      guard += 1;

      // 1. 先结算所有待处理的受击反击
      while (pendingHurts.length > 0) {
        const { target, source, dmg } = pendingHurts.shift();
        if (dmg <= 0 && target.hp > 0) continue;
        const oppTeam = getEnemyTeam(target.side);
        const ownTeam = getTeam(target.side);
        const myIdx = ownTeam.indexOf(target);

        // 荆棘树精：即使同归于尽也能扎出木刺！
        if (target.defId === 'thorn_treant' && oppTeam.length > 0) {
          const frontOpp = oppTeam.find((e) => e.hp > 0);
          if (frontOpp) {
            shootProjectile({
              actor: target,
              target: frontOpp,
              dmg: 2 * target.level + 1,
              proj: PROJECTILES.poison,
              sfx: 'ZiDan_XueDi',
              prefix: 'FS_',
              skillLabel: '【木刺反甲】',
            });
          }
        }

        // 双头食人魔援护：若受击者身后紧邻是存活的双头食人魔
        if (myIdx >= 0 && ownTeam[myIdx + 1]?.defId === 'ogre_magi' && ownTeam[myIdx + 1].hp > 0) {
          const ogre = ownTeam[myIdx + 1];
          const frontOpp = oppTeam.find((e) => e.hp > 0);
          if (frontOpp) {
            shootProjectile({
              actor: ogre,
              target: frontOpp,
              dmg: 4 * ogre.level,
              proj: PROJECTILES.axe,
              sfx: 'ZiDan_FuTou',
              prefix: 'BJ_',
              skillLabel: '【双重飞斧】援护',
            });
          }
        }

        // 以下受击技能要求受击者存活
        if (target.hp <= 0) continue;

        if (target.defId === 'green_slime') {
          const frontOpp = oppTeam.find((e) => e.hp > 0);
          if (frontOpp) {
            shootProjectile({
              actor: target,
              target: frontOpp,
              dmg: 2 * target.level,
              proj: PROJECTILES.poison,
              sfx: 'ZiDan_XueDi',
              prefix: 'ZD_',
              skillLabel: '【酸液飞溅】',
            });
          }
        } else if (target.defId === 'pepe_frog') {
          const behind = myIdx >= 0 ? ownTeam[myIdx + 1] : null;
          if (behind && behind.hp > 0) {
            const dA = 1 * target.level;
            const dH = 2 * target.level;
            buffUnit(
              behind,
              dA,
              dH,
              `🐸【${target.name}】挨揍委屈鼓劲，身后【${behind.name}】获得 +${dA}/+${dH}！`,
              target.uid,
            );
          }
        } else if (target.defId === 'iron_rhino') {
          const livingOpps = oppTeam.filter((e) => e.hp > 0);
          const backOpp = livingOpps[livingOpps.length - 1];
          if (backOpp) {
            shootProjectile({
              actor: target,
              target: backOpp,
              dmg: 4 * target.level,
              proj: PROJECTILES.stone,
              sfx: 'ZiDan_QuanTao',
              prefix: 'BJ_',
              skillLabel: '【碎岩狙后】',
            });
          }
        } else if (target.defId === 'ragnaros') {
          const livingOpps = oppTeam.filter((e) => e.hp > 0);
          const picks = rng.shuffle(livingOpps).slice(0, 2);
          for (const p of picks) {
            shootProjectile({
              actor: target,
              target: p,
              dmg: 4 * target.level,
              proj: PROJECTILES.stone,
              sfx: 'ZiDan_QuanTao',
              prefix: 'BJ_',
              skillLabel: '【陨石天降】',
            });
          }
        }
      }

      // 2. 收集并清理所有阵亡单位（按前排优先结算亡语）
      const deadEntries = [];
      for (const side of ['ally', 'enemy']) {
        const team = getTeam(side);
        for (let i = team.length - 1; i >= 0; i--) {
          if (team[i].hp <= 0) {
            const [fallen] = team.splice(i, 1);
            deadEntries.unshift({ fallen, side, slotIdx: i });
          }
        }
      }

      if (deadEntries.length === 0) continue;

      pushStep('faint', {
        faintedUids: deadEntries.map((d) => d.fallen.uid),
        sfx: 'SiWang',
        log: `💀 ${deadEntries.map((d) => `【${d.fallen.name}】`).join('、')}力竭退场！`,
      });

      // 3. 逐个结算阵亡单位亡语、装备复活/蜜罐、队友收割与统帅献祭
      for (const { fallen, side, slotIdx } of deadEntries) {
        const ownTeam = getTeam(side);
        const oppTeam = getEnemyTeam(side);
        const cmdId = side === 'ally' ? allyCommanderId : enemyCommanderId;

        // 自身亡语
        if (fallen.defId === 'piggy') {
          const alive = ownTeam.filter((u) => u.hp > 0);
          const lucky = rng.pick(alive);
          if (lucky) {
            const dA = 2 * fallen.level;
            const dH = 1 * fallen.level;
            buffUnit(
              lucky,
              dA,
              dH,
              `🐷【${fallen.name}】遗愿投喂，【${lucky.name}】获得 +${dA}/+${dH}！`,
              fallen.uid,
            );
          }
        } else if (fallen.defId === 'white_cat') {
          summonUnit(side, slotIdx, 'tok_goblin', fallen.level, fallen.level, fallen.level, {
            log: `🐱【${fallen.name}】炸毛退场，召唤 ${fallen.level}/${fallen.level}【呆瓜哥布林】顶上！`,
          });
        } else if (fallen.defId === 'murloc_caller') {
          const st = 2 * fallen.level;
          for (let k = 0; k < 2; k++) {
            summonUnit(side, slotIdx + k, 'tok_fireling', st, st, fallen.level, {
              log: `🐟【${fallen.name}】潮汐呼朋，召唤 ${st}/${st}【狂躁小火灵】！`,
            });
          }
        } else if (fallen.defId === 'dragon_mother') {
          const mult = fallen.level === 1 ? 0.6 : fallen.level === 2 ? 1.0 : 1.4;
          const wAtk = Math.max(3, Math.round(fallen.atk * mult));
          const wHp = Math.max(3, Math.round(fallen.maxHp * mult));
          summonUnit(side, slotIdx, 'tok_whelp', wAtk, wHp, fallen.level, {
            log: `🐲【${fallen.name}】真龙涅槃，破壳召唤 ${wAtk}/${wHp}【暴怒赤幼龙】！`,
          });
          for (const opp of oppTeam.filter((e) => e.hp > 0)) {
            shootProjectile({
              actor: fallen,
              target: opp,
              dmg: 3 * fallen.level,
              proj: PROJECTILES.axe,
              sfx: 'ZiDan_FuTou',
              prefix: 'BJ_',
              skillLabel: '【涅槃龙息】',
            });
          }
        }

        // 穿戴蜜罐亡语
        if (fallen.perk === 'honey') {
          summonUnit(side, slotIdx, 'tok_fireling', 3, 2, 1, {
            log: `🍯【${fallen.name}】的召唤蜜罐碎裂，蹦出 3/2【狂躁小火灵】！`,
          });
        }

        // 穿戴 1UP 不死心章复活
        if (fallen.perk === '1up' && !fallen.revived) {
          summonUnit(side, slotIdx, fallen.defId, 2, 2, fallen.level, {
            revived: true,
            log: `💖【${fallen.name}】触发 1UP 不死心章，以 2/2 满星原地复活！`,
          });
        }

        // 队友亡灵死骑收割
        const dks = ownTeam.filter((u) => u.hp > 0 && u.defId === 'death_knight');
        for (const dk of dks) {
          buffUnit(
            dk,
            2 * dk.level,
            1 * dk.level,
            `💀【${dk.name}】吸收阵亡友军灵魂，获得 +${2 * dk.level}/+${1 * dk.level}！`,
            dk.uid,
          );
          const frontOpp = oppTeam.find((e) => e.hp > 0);
          if (frontOpp) {
            shootProjectile({
              actor: dk,
              target: frontOpp,
              dmg: 3 * dk.level,
              proj: PROJECTILES.ice,
              sfx: 'ZiDan_BingKuai',
              prefix: 'JN_',
              skillLabel: '【亡魂冰枪】',
            });
          }
        }

        // 恶魔猎手统帅灵魂献祭
        if (cmdId === 'demon') {
          const alive = ownTeam.filter((u) => u.hp > 0);
          const lucky = rng.pick(alive);
          if (lucky) {
            buffUnit(lucky, 1, 1, `🦇 统帅【灵魂献祭】使【${lucky.name}】获得 +1/+1！`, lucky.uid);
          }
          const frontOpp = oppTeam.find((e) => e.hp > 0);
          if (frontOpp) {
            shootProjectile({
              actor: lucky || fallen,
              target: frontOpp,
              dmg: 2,
              proj: PROJECTILES.bat,
              sfx: 'ZiDan_XiXueGui',
              prefix: 'ZD_',
              skillLabel: '【献祭血蝠】',
            });
          }
        }
      }
    }
  }

  // ================= 阶段 0：初始亮相快照 =================
  pushStep('intro', {
    log: `⚔️ 第 ${round} 回合酒馆斗阵开战！`,
  });

  // ================= 阶段 1：统帅与镇馆宝物开战光环 =================
  if (allyCommanderId === 'tauren' && allies[0]) {
    buffUnit(allies[0], 2, 3, `🐂 统帅【战鼓先驱】赋予 1 号前锋【${allies[0].name}】+2/+3！`);
  }
  if (enemyCommanderId === 'tauren' && enemies[0]) {
    buffUnit(enemies[0], 2, 3, `🐂 敌方统帅赋予前锋【${enemies[0].name}】+2/+3！`);
  }

  if (relicSet.has('war_drum') && allies.length > 0) {
    for (const u of allies) {
      u.atk += 2;
    }
    pushStep('buff', {
      sfx: 'ZiDanShuXing_BianHua',
      popups: allies.map((u) => ({
        uid: u.uid,
        side: 'ally',
        prefix: 'HX_',
        amount: 2,
        isHeal: true,
      })),
      log: '🥁 宝物【狂怒战鼓】擂响，我方全体本场攻击力 +2！',
    });
  }

  if (relicSet.has('thorn_crest') && allies[0] && !allies[0].perk) {
    allies[0].perk = 'melon';
    pushStep('buff', {
      targetUid: allies[0].uid,
      sfx: 'GongXiHuoDe',
      log: `🛡️ 宝物【反伤铁砧】为前锋【${allies[0].name}】披上圣光金盾！`,
    });
  }

  // ================= 阶段 2：双方魔物开战先手技 =================
  const startCasters = [
    ...allies.map((u) => ({ u, opp: enemies })),
    ...enemies.map((u) => ({ u, opp: allies })),
  ];

  for (const { u, opp } of startCasters) {
    if (u.hp <= 0) continue;
    const livingOpp = opp.filter((e) => e.hp > 0);
    if (livingOpp.length === 0) continue;

    if (u.defId === 'banana_rogue') {
      const targets = rng.shuffle(livingOpp).slice(0, u.level);
      for (const t of targets) {
        shootProjectile({
          actor: u,
          target: t,
          dmg: 3,
          proj: PROJECTILES.muscle,
          sfx: 'ZiDan_FaShe',
          prefix: 'PT_',
          skillLabel: '【蕉皮暗器】',
        });
      }
      resolveChainReactions();
    } else if (u.defId === 'frost_dragon') {
      const highest = livingOpp.reduce((best, cur) => (cur.hp > best.hp ? cur : best), livingOpp[0]);
      if (highest) {
        const ratio = u.level === 1 ? 0.33 : u.level === 2 ? 0.50 : 0.66;
        const cut = Math.max(2, Math.min(35, Math.floor(highest.hp * ratio)));
        shootProjectile({
          actor: u,
          target: highest,
          dmg: cut,
          proj: PROJECTILES.ice,
          sfx: 'ZiDan_BingKuai',
          prefix: 'JN_',
          skillLabel: '【极寒吐息】',
        });
        resolveChainReactions();
      }
    } else if (u.defId === 'ragnaros') {
      const targets = rng.shuffle(livingOpp).slice(0, 2);
      for (const t of targets) {
        shootProjectile({
          actor: u,
          target: t,
          dmg: 4 * u.level,
          proj: PROJECTILES.stone,
          sfx: 'ZiDan_QuanTao',
          prefix: 'BJ_',
          skillLabel: '【陨石天降】',
        });
      }
      resolveChainReactions();
    }
  }

  // ================= 阶段 3：1号前锋循环对撞主循环 =================
  let clashCount = 0;
  const MAX_CLASHES = 48;

  while (allies.length > 0 && enemies.length > 0 && clashCount < MAX_CLASHES) {
    clashCount += 1;
    const aFront = allies[0];
    const eFront = enemies[0];

    // 3.1 交锋前先手触手/飞斧援护
    for (const [front, oppFront, ownSideArr] of [
      [aFront, eFront, allies],
      [eFront, aFront, enemies],
    ]) {
      if (front.hp <= 0 || oppFront.hp <= 0) continue;
      if (front.defId === 'cthulhu') {
        const drain = 4 * front.level;
        shootProjectile({
          actor: front,
          target: oppFront,
          dmg: drain,
          proj: PROJECTILES.bat,
          sfx: 'ZiDan_XiXueGui',
          prefix: 'ZD_',
          skillLabel: '【深海吸魂】',
        });
        healUnit(front, drain, `🐙【${front.name}】吸魂治疗自身 +${drain} 生命！`, true);
      }
      if (ownSideArr[1]?.defId === 'ogre_magi' && ownSideArr[1].hp > 0 && oppFront.hp > 0) {
        const ogre = ownSideArr[1];
        shootProjectile({
          actor: ogre,
          target: oppFront,
          dmg: 4 * ogre.level,
          proj: PROJECTILES.axe,
          sfx: 'ZiDan_FuTou',
          prefix: 'BJ_',
          skillLabel: '【双重飞斧】先手协战',
        });
      }
    }

    if (allies[0]?.hp <= 0 || enemies[0]?.hp <= 0) {
      resolveChainReactions();
      continue;
    }

    // 3.2 前锋正面硬碰硬对撞！
    const a0 = allies[0];
    const e0 = enemies[0];
    if (!a0 || !e0) break;

    const suddenBonus = clashCount > 30 ? (clashCount - 30) * 3 : 0;
    const aAtkDmg = a0.atk + (a0.perk === 'axe' ? 4 : 0) + suddenBonus;
    const eAtkDmg = e0.atk + (e0.perk === 'axe' ? 4 : 0) + suddenBonus;

    const hitOnEnemy = applyDamageRaw(e0, aAtkDmg, { source: a0 });
    const hitOnAlly = applyDamageRaw(a0, eAtkDmg, { source: e0 });

    const popups = [];
    const hitUids = [];
    if (hitOnEnemy.popup) popups.push(hitOnEnemy.popup);
    if (hitOnAlly.popup) popups.push(hitOnAlly.popup);
    if (hitOnEnemy.actual > 0 || hitOnEnemy.shieldBroken) hitUids.push(e0.uid);
    if (hitOnAlly.actual > 0 || hitOnAlly.shieldBroken) hitUids.push(a0.uid);

    // 穿刺毒剂溅射 2 号位
    if (a0.perk === 'splash' && enemies[1] && enemies[1].hp > 0) {
      const sp = applyDamageRaw(enemies[1], 5, { source: a0, prefix: 'ZD_' });
      if (sp.popup) popups.push(sp.popup);
      if (sp.actual > 0) hitUids.push(enemies[1].uid);
    }
    if (e0.perk === 'splash' && allies[1] && allies[1].hp > 0) {
      const sp = applyDamageRaw(allies[1], 5, { source: e0, prefix: 'ZD_' });
      if (sp.popup) popups.push(sp.popup);
      if (sp.actual > 0) hitUids.push(allies[1].uid);
    }

    pushStep('clash', {
      allyFrontUid: a0.uid,
      enemyFrontUid: e0.uid,
      hitUids,
      popups,
      sfx: Math.max(aAtkDmg, eAtkDmg) >= 12 ? 'ZiDan_FuTou' : 'ZiDan_QuanTao',
      log: `💥 前锋互拱：【${a0.name}】造成 ${hitOnEnemy.actual} 伤 ⇄ 【${e0.name}】造成 ${hitOnAlly.actual} 伤！`,
    });

    // 3.3 击杀凯旋判定（疾风狮鹫 & 嗜血龙戒）
    if (hitOnEnemy.killed && a0.hp > 0) {
      if (a0.defId === 'gold_griffin') {
        healUnit(a0, 3 * a0.level, `🦅【${a0.name}】嗜血凯旋恢复 ${3 * a0.level} 点生命！`);
        buffUnit(a0, 2 * a0.level, 2 * a0.level, `🦅【${a0.name}】凯旋越战越勇 +${2 * a0.level}/+${2 * a0.level}！`);
      }
      if (relicSet.has('vamp_fang')) {
        healUnit(a0, 4, `💍【嗜血龙戒】为前锋【${a0.name}】恢复 4 点生命！`);
        buffUnit(a0, 1, 0, `💍【嗜血龙戒】使【${a0.name}】攻击 +1！`);
      }
    }
    if (hitOnAlly.killed && e0.hp > 0 && e0.defId === 'gold_griffin') {
      healUnit(e0, 3 * e0.level, `🦅 敌方【${e0.name}】触发凯旋恢复！`);
      buffUnit(e0, 2 * e0.level, 2 * e0.level, `🦅 敌方【${e0.name}】凯旋成长！`);
    }

    // 3.4 结算受击、阵亡、亡语召唤与顺位前移
    resolveChainReactions();
  }

  // ================= 阶段 4：终局判定 =================
  let outcome = 'draw';
  if (allies.length > 0 && enemies.length === 0) {
    outcome = 'win';
  } else if (enemies.length > 0 && allies.length === 0) {
    outcome = 'loss';
  }

  const resultMsg =
    outcome === 'win'
      ? '🏆 大获全胜！夺取 1 顶胜场皇冠！'
      : outcome === 'loss'
        ? '💔 阵线失守，扣除 1 颗不屈红心！'
        : '⚖️ 旗鼓相当同归于尽！本轮平局不扣红心！';

  pushStep('result', {
    outcome,
    sfx: outcome === 'win' ? 'JieSuan_ShengLi' : outcome === 'loss' ? 'JieSuan_ShiBai' : 'GongXiHuoDe',
    log: resultMsg,
  });

  return {
    outcome,
    steps,
    logs,
    survivingAllies: snapshotTeam(allies),
    survivingEnemies: snapshotTeam(enemies),
    clashCount,
  };
}
