// 《猛宠斗阵 · 勇者酒馆自走棋》全量静态图鉴配置表（100% 映射 ../assets/ 原生解包立绘、_st 挨揍颜艺帧与音效）

export const ASSET_BASE = './assets';

export const MAX_TEAM_SLOTS = 5;
export const WIN_CROWNS_TARGET = 10;
export const INITIAL_HEARTS = 5;
export const TURN_GOLD = 10;
export const UNIT_COST = 3;
export const DEFAULT_FOOD_COST = 3;
export const REROLL_COST = 1;

// 回合对应酒馆等级与槽位数
export function getTavernTierByRound(round) {
  if (round <= 2) return 1;
  if (round <= 4) return 2;
  if (round <= 6) return 3;
  if (round <= 8) return 4;
  return 5;
}

export function getShopUnitSlotCount(round) {
  if (round <= 2) return 3;
  if (round <= 6) return 4;
  return 5;
}

export const SHOP_FOOD_SLOT_COUNT = 2;

export const ARENA_BACKGROUNDS = [
  `${ASSET_BASE}/textures/背景_大图/bigimg/img_jgbj_jgzq.jpg`,
  `${ASSET_BASE}/textures/背景_大图/bigimg/bg_normal_level_1.jpg`,
  `${ASSET_BASE}/textures/背景_大图/bigimg/bg_normal_level_2.jpg`,
  `${ASSET_BASE}/textures/背景_大图/bigimg/bg_normal_level_4.jpg`,
  `${ASSET_BASE}/textures/背景_大图/bigimg/bg_normal_level_6.jpg`,
  `${ASSET_BASE}/textures/背景_大图/bigimg/img_bg_boss.jpg`,
];

export const PROJECTILES = {
  stone: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_1.png`,
  muscle: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_2.png`,
  axe: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_3.png`,
  bat: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_4.png`,
  hearth: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_5.png`,
  ice: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_6.png`,
  poison: `${ASSET_BASE}/sprites/UI_界面/ui/Bullets/zidan_8.png`,
};

// 4 位可选酒馆掌柜（统帅被动）
export const COMMANDERS = [
  {
    id: 'tauren',
    name: '圣角·牛头酋长',
    title: '前锋战鼓流',
    portrait: `${ASSET_BASE}/textures/角色/role/skin_8.png`,
    hitPortrait: `${ASSET_BASE}/textures/角色/role/skin_8_st.png`,
    badgeColor: '#f2a93b',
    passiveName: '战鼓先驱',
    passiveDesc: '每回合首次刷新酒馆免费；开战时我方 1 号前锋获得 +2攻 / +3血。',
  },
  {
    id: 'witch',
    name: '星辉·冰雪女巫',
    title: '秘药干饭流',
    portrait: `${ASSET_BASE}/textures/角色/role/skin_12.png`,
    hitPortrait: `${ASSET_BASE}/textures/角色/role/skin_12_st.png`,
    badgeColor: '#4fc3f7',
    passiveName: '魔药精酿',
    passiveDesc: '酒馆所有食物/装备价格 -1 金币（仅需 2 金），且每次投喂额外使目标永久 +1 生命。',
  },
  {
    id: 'panda',
    name: '竹仙·熊猫羊驼',
    title: '财源滚滚流',
    portrait: `${ASSET_BASE}/textures/角色/role/skin_14.png`,
    hitPortrait: `${ASSET_BASE}/textures/角色/role/skin_14_st.png`,
    badgeColor: '#5ce07a',
    passiveName: '招财进宝',
    passiveDesc: '每回合初始金币 +1（每轮 11 金币），且出售魔物时额外返还 +1 金币。',
  },
  {
    id: 'demon',
    name: '邪翼·恶魔猎手',
    title: '亡语收割流',
    portrait: `${ASSET_BASE}/textures/角色/role/skin_15.png`,
    hitPortrait: `${ASSET_BASE}/textures/角色/role/skin_15_st.png`,
    badgeColor: '#c95cf2',
    passiveName: '灵魂献祭',
    passiveDesc: '战斗中每有一只友军阵亡，随机友军本场 +1/+1 并向敌方前锋发射 2 伤嗜血蝙蝠。',
  },
];

function roleImg(key) {
  return {
    portrait: `${ASSET_BASE}/textures/角色/role/${key}.png`,
    hitPortrait: `${ASSET_BASE}/textures/角色/role/${key}_st.png`,
  };
}

// 22 种可招募魔物 + 3 种衍生召唤物（100% 具备独立 _st 挨揍颜艺帧）
export const UNITS = {
  // ===== 衍生召唤物（token: true，不进酒馆刷新池） =====
  tok_goblin: {
    id: 'tok_goblin',
    name: '呆瓜哥布林',
    tier: 1,
    token: true,
    archetype: '亡语召唤',
    atk: 1,
    hp: 1,
    ...roleImg('moster_1_14'),
    triggerTag: '召唤物',
    skillName: '凑数小弟',
    desc: () => '无畏冲锋的召唤小鬼，替大哥挡刀吃伤害。',
  },
  tok_fireling: {
    id: 'tok_fireling',
    name: '狂躁小火灵',
    tier: 2,
    token: true,
    archetype: '亡语召唤',
    atk: 2,
    hp: 2,
    ...roleImg('moster_2_22'),
    triggerTag: '召唤物',
    skillName: '余烬冲撞',
    desc: () => '鱼人呼唤出的烈焰元素。',
  },
  tok_whelp: {
    id: 'tok_whelp',
    name: '暴怒赤幼龙',
    tier: 4,
    token: true,
    archetype: '亡语召唤',
    atk: 4,
    hp: 4,
    ...roleImg('moster_3_5_b'),
    triggerTag: '召唤物',
    skillName: '龙裔破壳',
    desc: () => '继承龙母怒火破壳而出的幼龙。',
  },

  // ===== Tier 1（第 1 回合解锁） =====
  piggy: {
    id: 'piggy',
    name: '粉红猪猪',
    tier: 1,
    archetype: '亡语召唤',
    atk: 2,
    hp: 2,
    ...roleImg('moster_2_1'),
    triggerTag: '亡语',
    skillName: '遗愿投喂',
    desc: (lv) => `阵亡时：使随机 1 名存活友军获得 +${2 * lv}攻 / +${1 * lv}血。`,
  },
  white_cat: {
    id: 'white_cat',
    name: '炸毛白喵',
    tier: 1,
    archetype: '亡语召唤',
    atk: 3,
    hp: 1,
    ...roleImg('moster_2_29'),
    triggerTag: '亡语',
    skillName: '替身猫奴',
    desc: (lv) => `阵亡时：召唤 1 只 ${lv}/${lv} 的【呆瓜哥布林】顶上前排。`,
  },
  green_slime: {
    id: 'green_slime',
    name: '绿果冻史莱姆',
    tier: 1,
    archetype: '挨揍反击',
    atk: 1,
    hp: 4,
    ...roleImg('moster_2_11'),
    triggerTag: '挨揍',
    skillName: '酸液飞溅',
    desc: (lv) => `受击存活时：向敌方前锋喷射 ${2 * lv} 点腐蚀酸液伤害。`,
  },
  blue_pigeon: {
    id: 'blue_pigeon',
    name: '呆呆蓝鸽',
    tier: 1,
    archetype: '干饭成长',
    atk: 2,
    hp: 3,
    ...roleImg('moster_3_13'),
    triggerTag: '出售',
    skillName: '鸽子放生',
    desc: (lv) => `出售时：使最靠前的 2 名友军永久获得 +${1 * lv}攻 / +${1 * lv}血。`,
  },
  red_crab: {
    id: 'red_crab',
    name: '铁钳红蟹',
    tier: 1,
    archetype: '干饭成长',
    atk: 3,
    hp: 2,
    ...roleImg('moster_2_4'),
    triggerTag: '登场',
    skillName: '横行霸道',
    desc: (lv) => `购买上阵时：获得当前最高血量友军 ${lv === 1 ? '50%' : lv === 2 ? '75%' : '100%'} 的生命值（至少保底原血量）。`,
  },

  // ===== Tier 2（第 3 回合解锁） =====
  scarecrow: {
    id: 'scarecrow',
    name: '南瓜稻草人',
    tier: 2,
    archetype: '亡语召唤',
    atk: 2,
    hp: 4,
    ...roleImg('moster_2_36'),
    triggerTag: '光环',
    skillName: '丰收号令',
    desc: (lv) => `战斗中友军被召唤时：使其立即获得 +${2 * lv}攻 / +${1 * lv}血。`,
  },
  pepe_frog: {
    id: 'pepe_frog',
    name: '悲伤蛙蛙',
    tier: 2,
    archetype: '挨揍反击',
    atk: 2,
    hp: 5,
    ...roleImg('moster_2_32'),
    triggerTag: '挨揍',
    skillName: '委屈鼓劲',
    desc: (lv) => `受击存活时：使紧跟身后的友军获得 +${1 * lv}攻 / +${2 * lv}血。`,
  },
  thorn_treant: {
    id: 'thorn_treant',
    name: '荆棘树精',
    tier: 2,
    archetype: '挨揍反击',
    atk: 3,
    hp: 6,
    ...roleImg('moster_2_19'),
    triggerTag: '挨揍',
    skillName: '木刺反甲',
    desc: (lv) => `每次受击时：对敌方前锋反弹 ${2 * lv + 1} 点荆棘伤害。`,
  },
  shiba_guard: {
    id: 'shiba_guard',
    name: '柴犬盾卫',
    tier: 2,
    archetype: '干饭成长',
    atk: 3,
    hp: 4,
    ...roleImg('role_6'),
    triggerTag: '整备末',
    skillName: '忠犬护主',
    desc: (lv) => `点击【开战】时：使正前方 ${lv} 名友军永久获得 +1攻 / +2血。`,
  },
  banana_rogue: {
    id: 'banana_rogue',
    name: '香蕉刺客',
    tier: 2,
    archetype: '奇袭破阵',
    atk: 4,
    hp: 2,
    ...roleImg('moster_2_28'),
    triggerTag: '开战',
    skillName: '蕉皮暗器',
    desc: (lv) => `开战时：随机向 ${lv} 名敌人投掷飞镖，各造成 3 点破盾伤害。`,
  },

  // ===== Tier 3（第 5 回合解锁） =====
  murloc_caller: {
    id: 'murloc_caller',
    name: '奔波儿鱼人',
    tier: 3,
    archetype: '亡语召唤',
    atk: 4,
    hp: 3,
    ...roleImg('moster_2_26'),
    triggerTag: '亡语',
    skillName: '潮汐呼朋',
    desc: (lv) => `阵亡时：召唤 2 只 ${2 * lv}/${2 * lv} 的【狂躁小火灵】冲阵。`,
  },
  iron_rhino: {
    id: 'iron_rhino',
    name: '重甲犀牛',
    tier: 3,
    archetype: '挨揍反击',
    atk: 4,
    hp: 7,
    ...roleImg('moster_2_13'),
    triggerTag: '挨揍',
    skillName: '碎岩狙后',
    desc: (lv) => `受击存活时：向敌方【最后排】猛掷巨石，造成 ${4 * lv} 点狙击伤害。`,
  },
  holy_nun: {
    id: 'holy_nun',
    name: '圣光修女',
    tier: 3,
    archetype: '干饭成长',
    atk: 3,
    hp: 5,
    ...roleImg('moster_2_35'),
    triggerTag: '干饭',
    skillName: '食前祷告',
    desc: (lv) => `每当友军吃下酒馆食物时：使该友军永久额外获得 +${1 * lv}攻 / +${1 * lv}血。`,
  },
  gold_griffin: {
    id: 'gold_griffin',
    name: '疾风狮鹫',
    tier: 3,
    archetype: '奇袭破阵',
    atk: 5,
    hp: 5,
    ...roleImg('moster_2_43'),
    triggerTag: '凯旋',
    skillName: '嗜血凯旋',
    desc: (lv) => `击倒敌人时：自身恢复 ${3 * lv} 点生命并获得 +${2 * lv}攻 / +${2 * lv}血。`,
  },

  // ===== Tier 4（第 7 回合解锁） =====
  death_knight: {
    id: 'death_knight',
    name: '亡灵死骑',
    tier: 4,
    archetype: '亡语召唤',
    atk: 5,
    hp: 5,
    ...roleImg('moster_3_11'),
    triggerTag: '收割',
    skillName: '亡魂战马',
    desc: (lv) => `其他友军阵亡时：自身获得 +${2 * lv}/+${1 * lv}，并向敌方前锋投射 ${3 * lv} 伤寒冰枪。`,
  },
  ogre_magi: {
    id: 'ogre_magi',
    name: '双头食人魔',
    tier: 4,
    archetype: '挨揍反击',
    atk: 5,
    hp: 8,
    ...roleImg('moster_2_12'),
    triggerTag: '援护',
    skillName: '双重飞斧',
    desc: (lv) => `正前方紧邻的友军每次攻击或受击时：向敌方前锋怒劈 ${4 * lv} 伤狂战飞斧。`,
  },
  spit_alpaca: {
    id: 'spit_alpaca',
    name: '神兽白羊驼',
    tier: 4,
    archetype: '干饭成长',
    atk: 5,
    hp: 6,
    ...roleImg('role_7'),
    triggerTag: '整备末',
    skillName: '仙露共鸣',
    desc: (lv) => `点击【开战】时：使所有 ★2 及以上的友军永久获得 +${1 * lv}攻 / +${2 * lv}血。`,
  },
  frost_dragon: {
    id: 'frost_dragon',
    name: '寒霜双翼龙',
    tier: 4,
    archetype: '奇袭破阵',
    atk: 6,
    hp: 6,
    ...roleImg('moster_3_12'),
    triggerTag: '开战',
    skillName: '极寒吐息',
    desc: (lv) => `开战时：冻结敌方最高生命目标，直接削减其 ${lv === 1 ? '33%' : lv === 2 ? '50%' : '66%'} 当前生命值（最多 35 点）。`,
  },

  // ===== Tier 5（第 9 回合解锁 · 传说首领） =====
  dragon_mother: {
    id: 'dragon_mother',
    name: '赤焰龙母',
    tier: 5,
    archetype: '亡语召唤',
    atk: 6,
    hp: 7,
    ...roleImg('moster_3_5'),
    triggerTag: '亡语',
    skillName: '真龙涅槃',
    desc: (lv) => `阵亡时：召唤继承自身 ${lv === 1 ? '60%' : lv === 2 ? '100%' : '140%'} 攻血的【暴怒赤幼龙】，并对敌全体喷吐 ${3 * lv} 点龙息。`,
  },
  ragnaros: {
    id: 'ragnaros',
    name: '熔核炎魔',
    tier: 5,
    archetype: '挨揍反击',
    atk: 8,
    hp: 10,
    ...roleImg('moster_3_17'),
    triggerTag: '霸主',
    skillName: '陨石天降',
    desc: (lv) => `开战时及每次受击存活时：随机向 2 名敌人轰击 ${4 * lv} 点熔岩火球。`,
  },
  t_rex: {
    id: 't_rex',
    name: '暴食霸王龙',
    tier: 5,
    archetype: '干饭成长',
    atk: 9,
    hp: 9,
    ...roleImg('moster_3_14'),
    triggerTag: '整备末',
    skillName: '百兽霸王餐',
    desc: (lv) => `点击【开战】时：其他所有友军永久获得 +${2 * lv}攻 / +${2 * lv}血！`,
  },
  cthulhu: {
    id: 'cthulhu',
    name: '深渊克苏鲁',
    tier: 5,
    archetype: '奇袭破阵',
    atk: 7,
    hp: 9,
    ...roleImg('moster_3_8'),
    triggerTag: '先手',
    skillName: '深海吸魂',
    desc: (lv) => `每次交锋攻击前：先用触手吸取敌方前锋 ${4 * lv} 点生命治疗自身（可超上限涨血）。`,
  },
};

export const SHOP_UNIT_IDS = Object.values(UNITS)
  .filter((u) => !u.token)
  .map((u) => u.id);

// 酒馆食物与穿戴装备（perk 为穿戴在魔物身上的持久化词条）
export const FOODS = {
  chicken_leg: {
    id: 'chicken_leg',
    name: '烤肉鸡腿',
    tier: 1,
    kind: 'stat',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/2001.png`,
    atk: 1,
    hp: 2,
    desc: '投喂 1 只友军：永久获得 +1攻 / +2血。',
  },
  garlic_armor: {
    id: 'garlic_armor',
    name: '荆棘藤盾',
    tier: 1,
    kind: 'perk',
    perkId: 'garlic',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/100602.png`,
    desc: '装备给 1 只友军：每次受到伤害减免 2 点（最低受 1 点）。',
  },
  dumbbell: {
    id: 'dumbbell',
    name: '群练哑铃',
    tier: 2,
    kind: 'team_random',
    count: 2,
    atk: 1,
    hp: 1,
    targetMode: 'team',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/200205.png`,
    desc: '直接使用：随机 2 名友军永久获得 +1攻 / +1血。',
  },
  brain_exp: {
    id: 'brain_exp',
    name: '智慧脑花',
    tier: 2,
    kind: 'exp',
    atk: 1,
    hp: 1,
    exp: 1,
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/2003.png`,
    desc: '投喂 1 只友军：立即 +1 升星经验并永久 +1/+1！',
  },
  honey_jar: {
    id: 'honey_jar',
    name: '召唤蜜罐',
    tier: 2,
    kind: 'perk',
    perkId: 'honey',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/2017.png`,
    desc: '装备给 1 只友军：阵亡时额外破罐召唤 1 只 3/2 狂躁小火灵。',
  },
  dual_axe: {
    id: 'dual_axe',
    name: '狂战利斧',
    tier: 3,
    kind: 'perk',
    perkId: 'axe',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/weapon_axe_2.png`,
    desc: '装备给 1 只友军：交锋攻击时额外造成 +4 点物理伤害。',
  },
  canned_soup: {
    id: 'canned_soup',
    name: '秘制罐头',
    tier: 3,
    kind: 'shop_buff',
    atk: 1,
    hp: 1,
    targetMode: 'team',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/100703.png`,
    desc: '直接使用：本局后续酒馆刷出的所有魔物永久 +1攻 / +1血！',
  },
  golden_shield: {
    id: 'golden_shield',
    name: '圣光金盾',
    tier: 4,
    kind: 'perk',
    perkId: 'melon',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/equip_shield.png`,
    desc: '装备给 1 只友军：抵消首次受到的最高 16 点伤害！',
  },
  dragon_chalice: {
    id: 'dragon_chalice',
    name: '龙血圣爵',
    tier: 4,
    kind: 'team_all',
    atk: 2,
    hp: 2,
    targetMode: 'team',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3009.png`,
    desc: '直接使用：场上所有友军永久获得 +2攻 / +2血！',
  },
  venom_flask: {
    id: 'venom_flask',
    name: '穿刺毒剂',
    tier: 4,
    kind: 'perk',
    perkId: 'splash',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/2010.png`,
    desc: '装备给 1 只友军：攻击时向敌方 2 号位溅射 5 点剧毒伤害。',
  },
  phoenix_1up: {
    id: 'phoenix_1up',
    name: '不死心章',
    tier: 5,
    kind: 'perk',
    perkId: '1up',
    targetMode: 'unit',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/200314.png`,
    desc: '装备给 1 只友军：阵亡后原地以 2/2 保留星级与技能复活 1 次！',
  },
};

export const PERKS = {
  garlic: {
    id: 'garlic',
    name: '荆棘藤盾',
    short: '减伤2',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/100602.png`,
    desc: '每次受击减免 2 点伤害（最低受 1 点）',
  },
  honey: {
    id: 'honey',
    name: '召唤蜜罐',
    short: '亡语火灵',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/2017.png`,
    desc: '阵亡时召唤 1 只 3/2 狂躁小火灵',
  },
  axe: {
    id: 'axe',
    name: '狂战利斧',
    short: '攻+4',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/weapon_axe_2.png`,
    desc: '正面交锋攻击伤害 +4',
  },
  melon: {
    id: 'melon',
    name: '圣光金盾',
    short: '圣盾16',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/equip_shield.png`,
    desc: '单次抵挡最高 16 点伤害（触发后碎裂）',
  },
  splash: {
    id: 'splash',
    name: '穿刺毒剂',
    short: '溅射5',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/2010.png`,
    desc: '交锋攻击时对敌方 2 号位溅射 5 点毒伤',
  },
  '1up': {
    id: '1up',
    name: '不死心章',
    short: '复活',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/200314.png`,
    desc: '首次阵亡后以 2/2 保留星级原地复活 1 次',
  },
};

// 酒馆升阶（第 3 / 5 / 7 回合）三选一镇馆宝物
export const RELICS = {
  war_drum: {
    id: 'war_drum',
    name: '狂怒战鼓',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3001.png`,
    desc: '开战时，我方全体友军本场攻击力 +2。',
  },
  vamp_fang: {
    id: 'vamp_fang',
    name: '嗜血龙戒',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3010.png`,
    desc: '我方前锋每次成功击倒敌人，额外恢复 4 点生命并 +1 攻击。',
  },
  summon_banner: {
    id: 'summon_banner',
    name: '亡灵号角',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3005.png`,
    desc: '战斗中所有我方衍生召唤物登场时额外获得 +2攻 / +2血。',
  },
  thorn_crest: {
    id: 'thorn_crest',
    name: '反伤铁砧',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3006.png`,
    desc: '我方 1 号前锋开战自带【圣光金盾】（抵消首次最高 16 点伤害）。',
  },
  gold_pouch: {
    id: 'gold_pouch',
    name: '贪婪钱袋',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3015.png`,
    desc: '每回合初始金币永久 +2，刷新酒馆更从容。',
  },
  chef_wand: {
    id: 'chef_wand',
    name: '鸡腿法杖',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3021.png`,
    desc: '每次购买酒馆食物/装备时，随机友军永久获得 +1攻 / +2血。',
  },
  clover_coin: {
    id: 'clover_coin',
    name: '四叶幸运币',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3023.png`,
    desc: '魔物升星时，该魔物额外永久获得 +2攻 / +2血。',
  },
  pack_bag: {
    id: 'pack_bag',
    name: '勇者行囊',
    icon: `${ASSET_BASE}/textures/UI_图标/icon/3026.png`,
    desc: '每回合点击【开战】时，最后排友军永久获得 +2攻 / +2血。',
  },
};

export const RELIC_IDS = Object.keys(RELICS);

// 敌方预设主题战队名号
export const ENEMY_WARBAND_TITLES = [
  { prefix: '荒野猪猪团', style: 'swarm' },
  { prefix: '绿泥挨揍帮', style: 'bruiser' },
  { prefix: '暗影蕉皮队', style: 'snipe' },
  { prefix: '黄金干饭盟', style: 'scaler' },
  { prefix: '亡灵天灾军', style: 'swarm' },
  { prefix: '深渊巨兽营', style: 'boss' },
];
