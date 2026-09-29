// Test flight: every control pressed with real key / mouse events, the game stepped at 60 Hz, and the
// ship's actual response measured. Prints a report and saves screenshots of the key moments.
//   node tools/playtest.mjs
import { open } from './harness.mjs';

const SP = '/tmp/claude-0/-home-user-3D-Game/a8e029d3-2f16-59c3-b012-4582e92c4956/scratchpad';
const g = await open();
const { page, step, tick, state } = g;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const deg = (r) => (r * 180 / Math.PI).toFixed(1);
const heading = (s) => Math.atan2(s.fwd[0], -s.fwd[2]);          // + = turned right
const hold = async (key, secs) => { await page.keyboard.down(key); await step(Math.round(secs * 60)); await page.keyboard.up(key); };
const shot = (n) => page.screenshot({ path: `${SP}/astra-${n}.png` });
const events = (from) => page.evaluate((f) => window.__astra.events(f), from);

// ---- launch with the keyboard
await step(20);
await page.keyboard.press('Enter');
await step(150);
let s = await state();
check('Enter launches', s.mode === 'fly', `mode=${s.mode}`);
check('cruise speed', Math.abs(s.speed - 42) < 1.5, `speed ${s.speed} m/s after 2.5 s`);

// ---- steer right, then let go: the turn should ease in and carry on a little after release (weight)
let s0 = await state();
await page.keyboard.down('ArrowRight'); await step(12); let sEarly = await state(); await step(48); let sHeld = await state(); await page.keyboard.up('ArrowRight');
await step(30); let sAfter = await state();
const rateEarly = -sEarly.ang[1], rateHeld = -sHeld.ang[1];
check('steer right turns right', heading(sHeld) - heading(s0) > 0.5, `+${deg(heading(sHeld) - heading(s0))}° in 1 s`);
check('turn eases in', rateEarly < rateHeld * 0.7, `yaw rate ${rateEarly.toFixed(2)} rad/s at 0.2 s vs ${rateHeld.toFixed(2)} at 1 s`);
check('turn carries past release', heading(sAfter) - heading(sHeld) > 0.08, `+${deg(heading(sAfter) - heading(sHeld))}° more in the 0.5 s after letting go`);
check('ship banks into the turn', sHeld.bank > 0.3, `bank ${deg(sHeld.bank)}°`);
// drift: the velocity lags the nose during the turn
const velAng = (st) => Math.atan2(st.vel[0], -st.vel[2]);
check('velocity lags the nose (drift)', heading(sHeld) - velAng(sHeld) > 0.08, `nose leads velocity by ${deg(heading(sHeld) - velAng(sHeld))}°`);
await shot('turn');
await hold('ArrowLeft', 1.0); await step(60);

// ---- pitch, then inverted pitch
s0 = await state(); await hold('ArrowUp', 0.8); s = await state();
const up1 = s.fwd[1] - s0.fwd[1];
check('↑ lifts the nose', up1 > 0.3, `forward.y ${s0.fwd[1].toFixed(2)} → ${s.fwd[1].toFixed(2)}`);
await hold('ArrowDown', 0.8); await step(90);
await page.keyboard.press('KeyI'); await step(2);
s0 = await state(); await hold('ArrowUp', 0.8); s = await state();
check('inverted: ↑ drops the nose', s.inverted && s.fwd[1] - s0.fwd[1] < -0.3, `inverted=${s.inverted}, forward.y ${s0.fwd[1].toFixed(2)} → ${s.fwd[1].toFixed(2)}`);
await hold('ArrowDown', 0.8); await page.keyboard.press('KeyI'); await step(120);
s = await state(); check('invert toggles back off', !s.inverted, `inverted=${s.inverted}`);

// ---- boost builds, drains, and dies away slowly
s0 = await state();
await page.keyboard.down('Shift'); await step(30); const sB05 = await state(); await step(120); const sB = await state(); await page.keyboard.up('Shift');
await step(60); const sB1 = await state();
check('boost accelerates', sB.speed > 100, `${s0.speed} → ${sB05.speed} (0.5 s) → ${sB.speed} m/s (2.5 s)`);
check('boost drains the meter', sB.boostE < 0.5, `meter ${s0.boostE} → ${sB.boostE}`);
check('speed bleeds off after boost', sB1.speed > 70 && sB1.speed < sB.speed, `${sB1.speed} m/s 1 s after release`);
check('boost widens the view', sB.fov > s0.fov + 8, `fov ${s0.fov}° → ${sB.fov}°`);
await shot('boost');
await step(240);

// ---- slide sideways with D (and back with A): heading must not change
s0 = await state();
await hold('KeyD', 1.5); s = await state();
const lat = (s.pos[0] - s0.pos[0]) * s0.right[0] + (s.pos[1] - s0.pos[1]) * s0.right[1] + (s.pos[2] - s0.pos[2]) * s0.right[2];
check('D slides right', lat > 15, `${lat.toFixed(1)} m to the right in 1.5 s`);
check('slide keeps the heading', Math.abs(heading(s) - heading(s0)) < 0.02, `heading changed ${deg(heading(s) - heading(s0))}°`);
await step(150);
s0 = await state(); await hold('KeyA', 1.5); s = await state();
const lat2 = (s.pos[0] - s0.pos[0]) * s0.right[0] + (s.pos[1] - s0.pos[1]) * s0.right[1] + (s.pos[2] - s0.pos[2]) * s0.right[2];
check('A slides left', lat2 < -15, `${lat2.toFixed(1)} m`);
await step(90);

// ---- camera drag: look around without turning the ship
s0 = await state();
await page.mouse.move(640, 360); await page.mouse.down();
for (let i = 0; i < 20; i++) { await page.mouse.move(640 + i * 16, 360 - i * 3); await tick(1); }
await step(20); s = await state();
check('drag swings the camera', Math.abs(s.camYaw) > 1.2, `camera yaw ${deg(s.camYaw)}°, pitch ${deg(s.camPitch)}°`);
check('drag does not turn the ship', Math.abs(heading(s) - heading(s0)) < 0.01 && Math.abs(s.fwd[1] - s0.fwd[1]) < 0.01, `heading moved ${deg(heading(s) - heading(s0))}°`);
await shot('drag');
await page.mouse.up(); await step(150); s = await state();
check('camera eases back behind', Math.abs(s.camYaw) < 0.1, `yaw ${deg(s.camYaw)}° 2.5 s after release`);

// ---- pause freezes the flight; the camera can still be dragged
await page.keyboard.press('KeyP'); await step(2); s0 = await state();
await page.mouse.move(300, 640); await page.mouse.down(); for (let i = 0; i < 10; i++) { await page.mouse.move(300 - i * 20, 640); await tick(1); } await page.mouse.up();   // drag in the open space around the pause card
await step(90); s = await state();
check('P pauses', s.paused, `paused=${s.paused}`);
check('paused flight is frozen', Math.hypot(s.pos[0] - s0.pos[0], s.pos[1] - s0.pos[1], s.pos[2] - s0.pos[2]) < 1e-3 && s.t === s0.t, `moved ${Math.hypot(s.pos[0] - s0.pos[0], s.pos[1] - s0.pos[1], s.pos[2] - s0.pos[2]).toFixed(4)} m in 1.5 s`);
check('camera still drags while paused', Math.abs(s.camYaw) > 0.8, `yaw ${deg(s.camYaw)}°`);
await shot('pause');
await page.keyboard.press('Escape'); await step(2); s = await state();
check('Esc resumes', !s.paused, `paused=${s.paused}`);
await step(120);

// ---- guns
let ev0 = (await state()).events;
await hold('Space', 1.0);
let ev = await events(ev0);
check('Space fires both wing guns', ev.filter((e) => e.type === 'shot').length >= 7 && new Set(ev.filter((e) => e.type === 'shot').map((e) => e.side)).size === 2, `${ev.filter((e) => e.type === 'shot').length} shots, sides ${[...new Set(ev.filter((e) => e.type === 'shot').map((e) => e.side))]}`);

// ---- reset
await page.keyboard.press('KeyR'); await step(2); s = await state();
check('R resets to the start line', Math.hypot(...s.pos) < 1 && s.speed < 20 && s.score === 0, `pos ${s.pos}, speed ${s.speed}`);

// ---- fly straight from the start: the opening rock is set up for a wingtip pass
ev0 = s.events;
await step(60 * 12);
ev = await events(ev0); s = await state();
const passes = ev.filter((e) => e.type === 'pass');
check('opening rock gives a close pass', passes.length >= 1, passes.map((p) => `${p.part} ${p.gap} m +${p.pts}`).join(', ') || 'none');
await shot('straight');

// ---- aim at a rock and hit it: bounce, damage, feedback
const rocks = await page.evaluate(() => window.__astra.rocks(420));
const target = rocks.filter((r) => r.z > 60 && r.z < 380 && r.s > 8).sort((a, b) => Math.hypot(a.x, a.y) / a.z - Math.hypot(b.x, b.y) / b.z)[0];
ev0 = (await state()).events;
let hitEv = null;
for (let f = 0; f < 60 * 14 && target; f++) {
  const r = (await page.evaluate((i) => window.__astra.rocks(900).find((x) => x.i === i), target.i));
  if (!r) break;
  const yawErr = Math.atan2(r.x, r.z), pitchErr = Math.atan2(r.y, Math.hypot(r.x, r.z));
  const st = await state();
  const kx = yawErr - (-st.ang[1]) * 0.35, ky = pitchErr - st.ang[0] * 0.35;
  for (const [cond, key] of [[kx > 0.01, 'ArrowRight'], [kx < -0.01, 'ArrowLeft'], [ky > 0.01, 'ArrowUp'], [ky < -0.01, 'ArrowDown']]) await (cond ? page.keyboard.down(key) : page.keyboard.up(key));
  await tick(1);
  const e2 = await events(ev0); hitEv = e2.find((e) => e.type === 'hit'); if (hitEv) break;
}
for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) await page.keyboard.up(k);
await step(4); await shot('hit'); s = await state();
check('ramming a rock hurts', !!hitEv && s.hull < 100, hitEv ? `impact ${hitEv.impact} m/s, hull ${s.hull}%` : `no hit (target ${target ? target.i : 'none'})`);
check('the ship bounces off', s.alive && s.speed > 5, `speed ${s.speed} m/s after the hit`);

// ---- Vega over a longer flight: does she keep station, and does she avoid the rocks?
await page.keyboard.press('KeyR'); await step(2);
ev0 = (await state()).events;
const dists = []; const pattern = ['ArrowRight', null, 'ArrowUp', null, 'ArrowLeft', 'Shift', null, 'ArrowDown', null, 'KeyD', null, 'KeyA'];
for (let seg = 0; seg < 24; seg++) {
  const k = pattern[seg % pattern.length];
  if (k) await page.keyboard.down(k);
  for (let i = 0; i < 5; i++) { await step(24); dists.push((await state()).wing.dist); }
  if (k) await page.keyboard.up(k);
}
ev = await events(ev0); s = await state();
const mean = dists.reduce((a, b) => a + b, 0) / dists.length, max = Math.max(...dists);
check('Vega keeps station', mean < 45 && max < 140, `distance mean ${mean.toFixed(1)} m, max ${max.toFixed(1)} m over ${(dists.length * 24 / 60).toFixed(0)} s of manoeuvring`);
check('Vega avoids rocks', ev.filter((e) => e.type === 'vegaHit').length <= 1, `${ev.filter((e) => e.type === 'vegaHit').length} Vega collisions`);
console.log('flight events:', Object.entries(ev.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', '));
await shot('vega');

console.log(JSON.stringify(await page.evaluate(() => window.__astra.info())));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
console.log('console errors:', g.errors.length ? g.errors.slice(0, 10) : 'none');
await g.browser.close();
