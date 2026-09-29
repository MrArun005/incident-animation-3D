// Records "Clawd vs The Bugs" for the trailer. A seeded bot plays the real game, stepped by hand at
// 60 Hz (two steps per 30 fps frame), so every run is identical. For each clip it writes the 240x360
// canvas as PNGs plus clip.json (per-frame score/wave/lives/boss state and every sound event).
//   node tools/capture-game.mjs            -> assets/gameplay/<clip>/0000.png ... clip.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.resolve(ROOT, '..', 'games', 'clawd-vs-the-bugs', 'index.html');
const OUT = path.join(ROOT, 'assets', 'gameplay');
const CLIPS = [
  { name: 'waves', frames: 450, wave: 1, seed: 7, gives: [] },
  { name: 'power', frames: 300, wave: 3, seed: 21, gives: [[10, 'S'], [110, 'R'], [200, 'H']] },
  { name: 'boss', frames: 450, wave: 5, seed: 5, gives: [[0, 'S'], [0, 'R'], [0, 'H']] },
  { name: 'rush', frames: 240, wave: 8, seed: 33, gives: [[0, 'S'], [0, 'R']] },
  { name: 'mid', frames: 330, wave: 6, seed: 12, gives: [] },
];

// The bot: dodge shots, grab power-ups, otherwise line up under the lowest bug (or the boss).
function decide(s, f) {
  let tx = s.px;
  const danger = s.ebul.filter((b) => b.y > s.py - 95 && b.y < s.py + 6 && Math.abs(b.x - s.px) < 15).sort((a, b) => Math.abs(a.x - s.px) - Math.abs(b.x - s.px))[0];
  const pu = s.pups.filter((u) => u.y > 150).sort((a, b) => b.y - a.y)[0];
  if (danger) tx = s.px + (danger.x >= s.px ? -34 : 34);
  else if (pu) tx = pu.x;
  else if (s.boss) tx = s.boss.x + Math.sin(f * 0.11) * 26;
  else { const t = s.enemies.filter((e) => e.y > 4).sort((a, b) => b.y - a.y)[0]; if (t) tx = t.x + Math.sin(f * 0.2) * 3; else tx = 120 + Math.sin(f * 0.05) * 60; }
  return Math.max(14, Math.min(226, tx));
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ONLY = process.argv[2];
for (const clip of CLIPS) {
  if (ONLY && clip.name !== ONLY) continue;
  const dir = path.join(OUT, clip.name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 700, height: 900 } });
  await ctx.addInitScript((seed) => {
    let a = seed >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.requestAnimationFrame = () => 0; window.__evs = []; window.__f = 0; window.__game_ev = (k) => window.__evs.push([window.__f, k]);
  }, clip.seed);
  const pg = await ctx.newPage();
  await pg.goto('file://' + GAME); await pg.waitForTimeout(300);
  await pg.evaluate((w) => { window.__game.start(); window.__game.mute(true); if (w > 1) window.__game.warp(w); }, clip.wave);
  const meta = []; let s = await pg.evaluate(() => window.__game.snap());
  for (let f = 0; f < clip.frames; f++) {
    for (const [gf, k] of clip.gives) if (gf === f) await pg.evaluate((k) => window.__game.give(k), k);
    const tx = decide(s, f);
    const r = await pg.evaluate(([tx, f]) => { window.__f = f; window.__game.setInput(tx, true); window.__game.tick(1 / 60); window.__game.tick(1 / 60); return { s: window.__game.snap(), png: document.getElementById('cv').toDataURL('image/png') }; }, [tx, f]);
    s = r.s; fs.writeFileSync(path.join(dir, String(f).padStart(4, '0') + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    meta.push({ score: s.score, wave: s.wave, lives: s.lives, mult: s.mult, spread: +s.spread.toFixed(1), rapid: +s.rapid.toFixed(1), shield: s.shield, px: s.px, boss: s.boss, nEn: s.enemies.length });
    if (s.state !== 'play') { console.log(clip.name, 'ended at frame', f, s.state); break; }
  }
  const evs = await pg.evaluate(() => window.__evs);
  fs.writeFileSync(path.join(dir, 'clip.json'), JSON.stringify({ name: clip.name, frames: meta.length, meta, events: evs }));
  const last = meta[meta.length - 1];
  console.log(clip.name, meta.length, 'frames  score', last.score, 'wave', last.wave, 'lives', last.lives, 'events', evs.length, 'boss', last.boss ? last.boss.hp + '/' + last.boss.max : 'none');
  await ctx.close();
}
await browser.close();
