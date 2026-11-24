// 构建独立自包含静态发布包 autopack/dist/（仅抽取实际引用的《闯关勇者》立绘/颜艺帧/UI/字体/音效）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ARENA_BACKGROUNDS,
  COMMANDERS,
  FOODS,
  PERKS,
  PROJECTILES,
  RELICS,
  UNITS,
} from '../src/engine/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTOPACK_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(AUTOPACK_ROOT, '..');
const SRC_ASSETS = path.join(REPO_ROOT, 'assets');
const DIST_DIR = path.join(AUTOPACK_ROOT, 'dist');

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

const assetRels = new Set([
  'fonts/fz.ttf',
  'sprites/UI_界面/ui/Common/jinbi.png',
  'sprites/UI_界面/ui/TavernFight/img_difang_jgzq.png',
  'sprites/UI_界面/ui/TavernFight/img_wofang_jgzq.png',
  'sprites/UI_界面/ui/TavernFight/img_duijue_jgzq.png',
  'sprites/UI_界面/ui/TavernFight/img_gongji_jgzq.png',
  'sprites/UI_界面/ui/TavernFight/img_sm_jgzq.png',
  'sprites/UI_界面/ui/TavernFight/btn_suoding_jgzq.png',
  'sprites/UI_界面/ui/Hud/boom.png',
  'sprites/UI_界面/ui/Hud/HX_+.png',
  'audio/BGM_ShangDian.mp3',
  'audio/BGM_ZiDongZhanDou.mp3',
  'audio/BGM_ZhuJieMian.mp3',
  'audio/AnNiuDianJi.mp3',
  'audio/AnNiuGuanBi.mp3',
  'audio/ShangDianShuaXin.mp3',
  'audio/ZhuBi_HuiShou.mp3',
  'audio/ZhuBi_HuoDe.mp3',
  'audio/BaoWuHeCheng_1.mp3',
  'audio/BaoWuHeCheng_2.mp3',
  'audio/GongXiHuoDe.mp3',
  'audio/JiNeng_XuanZe.mp3',
  'audio/SiWang.mp3',
  'audio/JieSuan_ShengLi.mp3',
  'audio/JieSuan_ShiBai.mp3',
  'audio/ZiDanShuXing_BianHua.mp3',
  'audio/ZiDan_FaShe.mp3',
  'audio/ZiDan_QuanTao.mp3',
  'audio/ZiDan_FuTou.mp3',
  'audio/ZiDan_BingKuai.mp3',
  'audio/ZiDan_XiXueGui.mp3',
  'audio/ZiDan_XueDi.mp3',
]);

function addUrl(u) {
  if (!u) return;
  assetRels.add(u.replace(/^\.\.\/assets\//, '').replace(/^\.\/assets\//, ''));
}

for (const bg of ARENA_BACKGROUNDS) addUrl(bg);
for (const p of Object.values(PROJECTILES)) addUrl(p);
for (const c of COMMANDERS) {
  addUrl(c.portrait);
  addUrl(c.hitPortrait);
}
for (const u of Object.values(UNITS)) {
  addUrl(u.portrait);
  addUrl(u.hitPortrait);
}
for (const f of Object.values(FOODS)) addUrl(f.icon);
for (const pk of Object.values(PERKS)) addUrl(pk.icon);
for (const r of Object.values(RELICS)) addUrl(r.icon);

for (const pfx of ['PT_', 'BJ_', 'HX_', 'JN_', 'ZD_', 'FS_']) {
  for (let d = 0; d <= 9; d++) {
    assetRels.add(`sprites/UI_界面/ui/Hud/${pfx}${d}.png`);
  }
}

function copyAndRewrite(relPath, replacer = (s) => s) {
  const srcFile = path.join(AUTOPACK_ROOT, relPath);
  const dstFile = path.join(DIST_DIR, relPath);
  fs.mkdirSync(path.dirname(dstFile), { recursive: true });
  const raw = fs.readFileSync(srcFile, 'utf8');
  fs.writeFileSync(dstFile, replacer(raw), 'utf8');
}

copyAndRewrite('index.html', (s) => s.replaceAll('../assets/', './assets/'));
copyAndRewrite('styles.css', (s) => s.replaceAll('../assets/', './assets/'));
copyAndRewrite('src/audio.js', (s) =>
  s.replace("src.replace('../', '')", "src.replace('./', '')"),
);
copyAndRewrite('src/fx_renderer.js');
copyAndRewrite('src/main.js');
copyAndRewrite('src/engine/prng.js');
copyAndRewrite('src/engine/battle.js');
copyAndRewrite('src/engine/session.js');
copyAndRewrite('src/engine/catalog.js', (s) =>
  s.replace("export const ASSET_BASE = '../assets';", "export const ASSET_BASE = './assets';"),
);

fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '', 'utf8');

let copiedAssets = 0;
let totalBytes = 0;
for (const rel of assetRels) {
  const src = path.join(SRC_ASSETS, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing required asset during dist build: ${src}`);
  }
  const dst = path.join(DIST_DIR, 'assets', rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  copiedAssets += 1;
  totalBytes += fs.statSync(dst).size;
}

console.log(
  JSON.stringify({
    ok: true,
    distDir: DIST_DIR,
    copiedAssets,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  }),
);
