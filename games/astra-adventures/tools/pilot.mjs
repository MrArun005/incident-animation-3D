// Claude flies Astra Adventures. A closed-loop pilot that plays the way a person does: it looks at the rocks
// ahead, picks one, lines up a close pass with the arrow keys, fine-tunes with A/D, boosts on the straights
// and dodges anything else in the way. Every input is a real key press through the browser.
//   node tools/pilot.mjs [--record out.mp4] [--seconds 70] [--width 1600 --height 900]
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { open } from './harness.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const RECORD = arg('record', null), SECONDS = +arg('seconds', 70), W = +arg('width', 1280), H = +arg('height', 720);
const FFMPEG = '/home/user/incident-animation-3d/cartoons/node_modules/ffmpeg-static/ffmpeg';
const g = await open({ width: W, height: H });
const { page, state } = g;
const rocks = (d) => page.evaluate((d) => window.__astra.rocks(d), d);

let ff = null;
if (RECORD) ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', RECORD], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = [];                                   // per video frame: speed, thrust, boost (for the soundtrack)
const held = new Set();
async function keys(want) {                          // press / release so exactly `want` is held
  for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function frame(i) {                            // two 1/60 s steps per 30 fps video frame; draw the second
  await page.evaluate((draw) => { window.__astra.step(1 / 60, false); window.__astra.step(1 / 60, draw); }, !!ff);   // a dry run doesn't draw
  if (ff) { const buf = await page.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
  const s = await state(); frames.push({ t: s.t, speed: s.speed, boosting: s.boosting }); return s;
}

// ---- title screen for a moment, then launch with Enter
for (let i = 0; i < 45; i++) await frame(i);
await page.keyboard.press('Enter');

let target = null, lastPick = -9, stats = { picks: 0 };
const log = [];
const T0 = (await state()).t;
for (let f = 0; f < SECONDS * 30; f++) {
  const s = await state(), t = s.t - T0;
  const near = await rocks(520);
  const ahead = near.filter((r) => r.z > -r.s);
  // Keep a target until it is behind us; pick a new one among rocks ahead within a comfortable cone.
  if (target) { const cur = near.find((r) => r.i === target.i); if (!cur || cur.z < -cur.s * 0.5) target = null; else target = { ...target, ...cur }; }
  if (!target && t - lastPick > 0.4) {
    const cand = ahead.filter((r) => r.z > 90 && r.z < 430 && r.s > 6 && r.s < 40 && Math.atan2(Math.hypot(r.x, r.y), r.z) < 0.5)   // giants are for looking at, not threading
      .map((r) => ({ ...r, cost: r.z / Math.max(20, s.speed) + Math.atan2(Math.hypot(r.x, r.y), r.z) * 6 }))
      .sort((a, b) => a.cost - b.cost);
    if (cand.length) {
      const r = cand[0], lx = -r.x, ly = -r.y, L = Math.hypot(lx, ly) || 1;
      // pass on the side we're already on; horizontal passes leave room for the wing
      let ux = lx / L, uy = ly / L; if (L < 3) { ux = -1; uy = 0; }
      target = { ...r, ux, uy, clearance: 3.6 + 5.2 * Math.abs(ux) + (stats.picks % 3 === 2 ? -0.9 : 0) }; lastPick = t; stats.picks++;
    }
  }
  const want = new Set();
  let aimX = 0, aimY = 0, aimZ = 300, dodge = false;
  // Too close to any surface (the target included): pull straight away from it.
  const scrape = near.filter((r) => r.gap < 7).sort((a, b) => a.gap - b.gap)[0];
  if (scrape) { const L = Math.hypot(scrape.x, scrape.y, scrape.z) || 1; aimX = -scrape.x / L * 100; aimY = -scrape.y / L * 100; aimZ = Math.max(20, -scrape.z / L * 100 + 60); dodge = true; }
  // Anything other than the target that we'd clip in the next 2 s: steer off it first.
  for (const r of dodge ? [] : ahead) {
    if (target && r.i === target.i) continue;
    const tArr = r.z / Math.max(15, s.speed); if (tArr > 2.2 || r.z < 0) continue;
    const miss = Math.hypot(r.x, r.y), need = r.reach + 8;
    if (miss < need) { aimX = -r.x / Math.max(miss, 0.1) * need * 1.6; aimY = -r.y / Math.max(miss, 0.1) * need * 1.6; aimZ = r.z; dodge = true; break; }
  }
  if (!dodge && target) {
    const off = target.s * 1.08 + target.clearance;
    aimX = target.x + target.ux * off; aimY = target.y + target.uy * off; aimZ = Math.max(target.z, 25);
  }
  const yawErr = Math.atan2(aimX, aimZ), pitchErr = Math.atan2(aimY, Math.hypot(aimX, aimZ));
  const py = yawErr - (-s.ang[1]) * 0.38, pp = pitchErr - s.ang[0] * 0.38;
  if (py > 0.012) want.add('ArrowRight'); else if (py < -0.012) want.add('ArrowLeft');
  if (pp > 0.012) want.add('ArrowUp'); else if (pp < -0.012) want.add('ArrowDown');
  // Final 90 m: slide with A/D to trim the line instead of yawing.
  if (!dodge && target && target.z < 90 && target.z > 0) {
    const ex = target.x + target.ux * (target.s * 1.08 + target.clearance);
    want.delete('ArrowRight'); want.delete('ArrowLeft');
    if (ex > 0.6) want.add('KeyD'); else if (ex < -0.6) want.add('KeyA');
  }
  // Boost on long clear runs.
  const clearRun = !target || target.z > 250;
  if (clearRun && !dodge && Math.abs(yawErr) < 0.08 && Math.abs(pitchErr) < 0.08 && s.boostE > 0.35) want.add('Shift');
  // Two set pieces: a look round at Vega mid-flight, and a burst of the wing guns at a far rock.
  const lookAround = t > 31 && t < 34.5;
  if (t > 46 && t < 47.2) want.add('Space');
  await keys(want);
  if (lookAround) { const k = (t - 31) / 3.5, x = W * (0.72 - Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.5); if (!page.__drag) { await page.mouse.move(W * 0.72, H * 0.45); await page.mouse.down(); page.__drag = true; } await page.mouse.move(x, H * 0.45 - Math.sin(k * Math.PI) * 40); }
  else if (page.__drag) { await page.mouse.up(); page.__drag = false; }
  const st = await frame(f);
  if (f % 30 === 0) log.push(`t=${t.toFixed(0)}s ${st.speed.toFixed(0)} m/s hull ${st.hull} score ${st.score} passes ${st.passes} closest ${st.closest} vega ${st.wing.dist} m ${dodge ? 'DODGE' : target ? `target z=${target.z.toFixed(0)} s=${target.s}` : 'cruising'}`);
}
await keys(new Set());
// End on the pause menu for a beat.
await page.keyboard.press('KeyP'); for (let i = 0; i < 50; i++) await frame(0);
await page.keyboard.press('KeyP'); for (let i = 0; i < 10; i++) await frame(0);

const s = await state(), ev = await page.evaluate(() => window.__astra.events(0));
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
fs.writeFileSync(RECORD ? RECORD.replace(/\.mp4$/, '.json') : '/tmp/claude-0/pilot-run.json', JSON.stringify({ frames, events: ev, final: s }));
console.log(log.filter((_, i) => i % 3 === 0).join('\n'));
const passes = ev.filter((e) => e.type === 'pass');
console.log(`\n${SECONDS}s flown: ${passes.length} close passes, closest ${s.closest} m, score ${s.score}, ${s.hits} hits (hull ${s.hull}%), ${ev.filter((e) => e.type === 'breach').length} breaches, ${stats.picks} rocks lined up`);
console.log('passes:', passes.map((p) => `${p.gap}m/${p.part}`).join(' '));
console.log('radio:', ev.filter((e) => e.type === 'radio').map((e) => e.text).join(' | '));
console.log('errors:', g.errors.filter((e) => !e.includes('ERR_TOO_MANY_RETRIES')).slice(0, 5));
await g.browser.close();
