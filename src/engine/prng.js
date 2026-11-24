// 确定性伪随机数生成器（Mulberry32），用于商店刷新、战斗结算与 200 局平衡性自动压测

export function createRng(seed = Date.now()) {
  let state = (seed >>> 0) || 0x6d2b79f5;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, maxInclusive) {
    if (maxInclusive <= min) return min;
    return min + Math.floor(next() * (maxInclusive - min + 1));
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(next() * arr.length)];
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  return { next, int, pick, shuffle, getState: () => state };
}
