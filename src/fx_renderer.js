// 战斗抛物线飞弹 + 《闯关勇者》原生 Hud 位图数字跳字池（支持精确瞄准场上任意魔物槽位）

import { ASSET_BASE } from './engine/catalog.js';

const HUD_DIR = `${ASSET_BASE}/sprites/UI_界面/ui/Hud/`;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quadBezier(p0, p1, p2, u) {
  const inv = 1 - u;
  return {
    x: inv * inv * p0.x + 2 * inv * u * p1.x + u * u * p2.x,
    y: inv * inv * p0.y + 2 * inv * u * p1.y + u * u * p2.y,
  };
}

function hurtNumCurve(age) {
  if (age < 0 || age > 0.82) return null;
  let scale = 1.0;
  let op = 1.0;
  if (age < 0.14) {
    const u = age / 0.14;
    scale = lerp(0.25, 1.26, u);
    op = u;
  } else if (age < 0.25) {
    scale = 1.26;
  } else if (age < 0.36) {
    scale = lerp(1.26, 1.0, (age - 0.25) / 0.11);
  } else if (age < 0.56) {
    scale = 1.0;
  } else {
    scale = 1.0;
    op = 1.0 - (age - 0.56) / 0.26;
  }
  const dy = -age * 42;
  return { scale, op: clamp(op, 0, 1), dy };
}

export class ArenaFxRenderer {
  constructor(arenaEl) {
    this.arenaEl = arenaEl;

    this.projLayer = document.createElement('div');
    this.projLayer.className = 'fx-proj-layer';
    this.projLayer.setAttribute('aria-hidden', 'true');
    arenaEl.appendChild(this.projLayer);

    this.hudLayer = document.createElement('div');
    this.hudLayer.className = 'fx-hud-layer';
    this.hudLayer.setAttribute('aria-hidden', 'true');
    arenaEl.appendChild(this.hudLayer);

    this.hudPool = [];
    for (let i = 0; i < 28; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'fx-hud-item';
      wrap.style.display = 'none';

      const boom = document.createElement('img');
      boom.className = 'fx-hud-boom';
      boom.src = `${HUD_DIR}boom.png`;
      boom.alt = '';

      const row = document.createElement('div');
      row.className = 'fx-hud-digits';
      const digits = [];
      for (let k = 0; k < 6; k++) {
        const d = document.createElement('img');
        d.className = 'fx-digit-img';
        d.alt = '';
        d.style.display = 'none';
        row.appendChild(d);
        digits.push(d);
      }

      const tag = document.createElement('span');
      tag.className = 'fx-hud-tag';
      tag.style.display = 'none';

      wrap.appendChild(boom);
      wrap.appendChild(row);
      wrap.appendChild(tag);
      this.hudLayer.appendChild(wrap);
      this.hudPool.push({ wrap, boom, row, digits, tag });
    }

    this.activePopups = [];
    this.activeProjectiles = [];
    this.jitterSeq = 0;
    this.rafId = null;
    this.startLoop();
  }

  startLoop() {
    const tick = () => {
      this.renderFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  clearAll() {
    this.activePopups.length = 0;
    for (const p of this.activeProjectiles) p.el.remove();
    this.activeProjectiles.length = 0;
    for (const h of this.hudPool) h.wrap.style.display = 'none';
  }

  getUnitCenterInArena(uid, fallbackSide = 'ally') {
    const arenaRect = this.arenaEl.getBoundingClientRect();
    const w = arenaRect.width || 380;
    const h = arenaRect.height || 260;

    if (uid) {
      const cardEl = this.arenaEl.querySelector(`[data-uid="${uid}"]`);
      if (cardEl) {
        const r = cardEl.getBoundingClientRect();
        return {
          x: r.left - arenaRect.left + r.width * 0.5,
          y: r.top - arenaRect.top + r.height * 0.45,
        };
      }
    }

    // 兜底锚点（1号前锋列）
    return {
      x: w * 0.14,
      y: fallbackSide === 'enemy' ? h * 0.28 : h * 0.74,
    };
  }

  spawnBitmapPopup({ uid, side = 'ally', prefix = 'PT_', amount = 0, isHeal = false, heavy = false, shieldBroken = false }) {
    const pos = this.getUnitCenterInArena(uid, side);
    this.jitterSeq = (this.jitterSeq + 1) % 5;
    const jx = (this.jitterSeq - 2) * 8;

    const cleanNum = Math.max(0, Math.round(Math.abs(amount)));
    const str = isHeal ? `+${cleanNum}` : `${cleanNum}`;

    this.activePopups.push({
      born: performance.now() / 1000,
      x: pos.x + jx,
      y: pos.y - 6,
      prefix,
      str,
      heavy,
      shieldBroken,
    });
  }

  flyProjectile({ fromUid, fromSide = 'ally', toUid, toSide = 'enemy', sprite, durationMs = 260 }) {
    const p0 = this.getUnitCenterInArena(fromUid, fromSide);
    const p2 = this.getUnitCenterInArena(toUid, toSide);
    const midX = (p0.x + p2.x) * 0.5 + (p0.y > p2.y ? -22 : 22);
    const midY = Math.min(p0.y, p2.y) - 34;

    const img = document.createElement('img');
    img.className = 'fx-flying-bullet';
    img.src = sprite;
    img.alt = '';
    this.projLayer.appendChild(img);

    return new Promise((resolve) => {
      this.activeProjectiles.push({
        el: img,
        p0,
        p1: { x: midX, y: midY },
        p2,
        born: performance.now(),
        durationMs: Math.max(90, durationMs),
        resolve,
      });
    });
  }

  renderFrame() {
    const nowMs = performance.now();
    const nowSec = nowMs / 1000;

    // 1. 推进飞弹轨迹
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      const u = clamp((nowMs - p.born) / p.durationMs, 0, 1);
      const pos = quadBezier(p.p0, p.p1, p.p2, u);
      const rot = u * 420;
      const sc = lerp(0.82, 1.16, Math.sin(u * Math.PI));
      p.el.style.transform = `translate3d(${pos.x - 16}px, ${pos.y - 16}px, 0) rotate(${rot}deg) scale(${sc})`;
      if (u >= 1) {
        p.el.remove();
        this.activeProjectiles.splice(i, 1);
        p.resolve();
      }
    }

    // 2. 渲染原版位图数字跳字池
    this.activePopups = this.activePopups.filter((pop) => nowSec - pop.born <= 0.82);
    for (let i = 0; i < this.hudPool.length; i++) {
      const slot = this.hudPool[i];
      const pop = this.activePopups[i];
      if (!pop) {
        slot.wrap.style.display = 'none';
        continue;
      }
      const curve = hurtNumCurve(nowSec - pop.born);
      if (!curve) {
        slot.wrap.style.display = 'none';
        continue;
      }

      slot.wrap.style.display = 'flex';
      slot.wrap.style.opacity = `${curve.op}`;
      slot.wrap.style.transform = `translate3d(${pop.x}px, ${pop.y + curve.dy}px, 0) translate(-50%, -50%) scale(${curve.scale})`;

      slot.boom.style.display = pop.heavy ? 'block' : 'none';

      if (pop.shieldBroken && pop.str === '0') {
        slot.row.style.display = 'none';
        slot.tag.style.display = 'inline-block';
        slot.tag.textContent = '🛡️格挡!';
      } else {
        slot.row.style.display = 'flex';
        slot.tag.style.display = pop.shieldBroken ? 'inline-block' : 'none';
        if (pop.shieldBroken) slot.tag.textContent = '破盾';

        const chars = pop.str.slice(0, slot.digits.length).split('');
        for (let k = 0; k < slot.digits.length; k++) {
          const dEl = slot.digits[k];
          const ch = chars[k];
          if (!ch) {
            dEl.style.display = 'none';
            continue;
          }
          dEl.style.display = 'block';
          dEl.src = `${HUD_DIR}${pop.prefix}${ch}.png`;
        }
      }
    }
  }
}
