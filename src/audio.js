// 《猛宠斗阵 · 勇者酒馆自走棋》原生音频池管理器

import { ASSET_BASE } from './engine/catalog.js';

const BGM_TRACKS = {
  prep: `${ASSET_BASE}/audio/BGM_ShangDian.mp3`,
  battle: `${ASSET_BASE}/audio/BGM_ZiDongZhanDou.mp3`,
  menu: `${ASSET_BASE}/audio/BGM_ZhuJieMian.mp3`,
};

const SFX_MAP = {
  click: 'AnNiuDianJi',
  close: 'AnNiuGuanBi',
  reroll: 'ShangDianShuaXin',
  buy: 'ZhuBi_HuiShou',
  sell: 'ZhuBi_HuoDe',
  levelUp: 'BaoWuHeCheng_1',
  summon: 'BaoWuHeCheng_2',
  reward: 'GongXiHuoDe',
  pick: 'JiNeng_XuanZe',
  faint: 'SiWang',
  win: 'JieSuan_ShengLi',
  loss: 'JieSuan_ShiBai',
  statUp: 'ZiDanShuXing_BianHua',
};

export class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('autopack_yongzhe_muted') === '1';
    this.unlocked = false;
    this.currentBgmKey = null;
    this.bgmEl = new Audio();
    this.bgmEl.loop = true;
    this.bgmEl.volume = 0.32;
    this.lastPlayedAt = new Map();
    this.pool = new Map();
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (!this.muted && this.currentBgmKey) {
      this.playBgm(this.currentBgmKey);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('autopack_yongzhe_muted', this.muted ? '1' : '0');
    if (this.muted) {
      this.bgmEl.pause();
    } else if (this.currentBgmKey) {
      this.playBgm(this.currentBgmKey);
    }
    return this.muted;
  }

  playBgm(key) {
    this.currentBgmKey = key;
    if (this.muted || !this.unlocked) return;
    const src = BGM_TRACKS[key];
    if (!src) return;
    const suffix = encodeURI(src.replace('./', ''));
    if (!this.bgmEl.src.endsWith(suffix)) {
      this.bgmEl.src = src;
    }
    this.bgmEl.volume = key === 'battle' ? 0.36 : 0.28;
    this.bgmEl.play().catch(() => {});
  }

  playSfx(name, { volume = 0.62, minIntervalMs = 45 } = {}) {
    if (this.muted) return;
    const fileBase = SFX_MAP[name] || name;
    const now = performance.now();
    const prev = this.lastPlayedAt.get(fileBase) || 0;
    if (now - prev < minIntervalMs) return;
    this.lastPlayedAt.set(fileBase, now);

    const src = `${ASSET_BASE}/audio/${fileBase}.mp3`;
    let list = this.pool.get(fileBase);
    if (!list) {
      list = [];
      this.pool.set(fileBase, list);
    }
    let audio = list.find((a) => a.paused || a.ended);
    if (!audio) {
      if (list.length >= 5) {
        audio = list[0];
      } else {
        audio = new Audio(src);
        list.push(audio);
      }
    }
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}
