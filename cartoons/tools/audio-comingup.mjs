// Soundtrack for "Clawd: Coming Up" (comingup.js / comingup3d.js). Music and sound only, no words.
// An arcade hum and a slightly out-of-tune music box at the bottom; chiptune blips for every jump; a gnat's
// buzz and a thud for each fall; silence and static at the lowest point; one blip of light answering another;
// a warm pad and plucked theme as the Clawds gather; a rising ostinato for the living ladder; a crack and a
// swell into space; the theme in full at the end, then the cabinet hum again.
//   node tools/audio-comingup.mjs -> out/cartoon-comingup3d.wav (and cartoon-comingup.wav for the 2D cut)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'comingup.beats.json'), 'utf8'));
const SC = Object.fromEntries(B.scenes.map(([id, t0]) => [id, t0]));
const DUR = B.duration, st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, lpa, hz, rng } = st;

// ---- instruments ----------------------------------------------------------------------------------------------
// Music box: a bright bell tone with an inharmonic upper partial; `detune` in cents bends it out of tune.
function box(t0, m, g = 0.05, pan = 0.5, detune = 0) {
  const f = hz(m) * 2 ** (detune / 1200), s = S(t0), n = S(2.4);
  for (let j = 0; j < n; j++) {
    const u = j / SR, v = (Math.sin(TAU * f * u) + 0.35 * Math.sin(TAU * f * 3.98 * u) * Math.exp(-u * 6) + 0.2 * Math.sin(TAU * f * 2.01 * u) * Math.exp(-u * 3)) * Math.exp(-u * 1.8) * Math.min(1, u * 600) * g;
    put(MUS, s + j, v * (1 - pan) * 2, v * pan * 2);
  }
}
// Warm pluck (Karplus-Strong), for the theme once they are together.
function pluck(t0, m, g = 0.06, pan = 0.5, len = 2.6, bright = 0.5) {
  const f = hz(m), n = Math.max(2, Math.round(SR / f)), b = new Float32Array(n), r = rng(Math.round(f * 37 + t0 * 911));
  let lp = 0; for (let i = 0; i < n; i++) { lp += (r() * 2 - 1 - lp) * (0.3 + bright * 0.5); b[i] = lp; }
  const s = S(t0), N = S(len), body = new BP(f * 2.1, 1.4); let k = 0, prev = 0;
  const damp = 0.4 + 0.1 * bright;
  for (let j = 0; j < N; j++) {
    const x = b[k], nx = b[(k + 1) % n], y = (x * (1 - damp) + nx * damp) * 0.996;
    b[k] = y * 0.6 + prev * 0.4; prev = y; k = (k + 1) % n;
    const env = Math.min(1, (N - j) / (SR * 0.3)), v = (x + body.run(x) * 0.5) * g * env * Math.min(1, j / 40);
    put(MUS, s + j, v * (1 - pan) * 1.6, v * pan * 1.6);
  }
}
function pad(t0, t1, notes, g = 0.04, fc = 700, att = 2, rel = 2.5) {
  const s0 = S(t0), s1 = S(t1), ph = notes.map(() => [0, 0]), f = [new LP(), new LP()];
  for (let i = s0; i < s1 && i < st.N; i++) {
    const t = (i - s0) / SR, e = Math.max(0, Math.min(1, t / att, (t1 - t0 - t) / rel));
    let l = 0, r = 0;
    notes.forEach((m, j) => { const fr = hz(m); ph[j][0] = (ph[j][0] + fr * 0.997 / SR) % 1; ph[j][1] = (ph[j][1] + fr * 1.004 / SR) % 1; const a = 1 - 4 * Math.abs(ph[j][0] - 0.5), b = 1 - 4 * Math.abs(ph[j][1] - 0.5); l += a + b * 0.4; r += b + a * 0.4; });
    const k = lpa(fc * (1 + 0.2 * Math.sin(t * 0.3)));
    put(MUS, i, f[0].run(l, k) * g * e / notes.length * 2.2, f[1].run(r, k) * g * e / notes.length * 2.2);
  }
}
// Chip square (pulse wave), for blips and the arcade voice.
function chip(t0, m, d, g = 0.03, duty = 0.25, pan = 0.5, slide = 0, buf = FX) {
  const s = S(t0), n = S(d); let ph = 0;
  for (let j = 0; j < n; j++) { const u = j / n; ph = (ph + hz(m + slide * u) / SR) % 1; const v = (ph < duty ? 1 : -1) * g * Math.min(1, j / 60, (n - j) / 300); put(buf, s + j, v * (1 - pan) * 2, v * pan * 2); }
}
const jumpBlip = (t, g = 0.025) => chip(t, 72, 0.12, g, 0.25, 0.5, 12);
const landBlip = (t, g = 0.02) => chip(t, 60, 0.06, g, 0.5, 0.5, -5);
function buzz(t0, t1, g = 0.03) { const bp = new BP(520, 3); for (let i = S(t0); i < S(t1); i++) { const t = i / SR, e = Math.min(1, (t - t0) / 0.3, (t1 - t) / 0.2), saw = ((t * (180 + 20 * Math.sin(t * 40))) % 1) * 2 - 1; put(FX, i, bp.run(saw) * g * e * 3); } }
function staticNoise(t0, t1, g = 0.03, fc = 3000) { const bp = new BP(fc, 0.6); for (let i = S(t0); i < S(t1); i++) { const t = i / SR, e = Math.max(0, Math.min(1, (t - t0) / 1.2, (t1 - t) / 1.2)); const crackle = nz() < 0.0006 ? 6 : 1; put(FX, i, bp.run(n2()) * g * e * crackle, bp.y * g * e * 0.9); } }
function hum(t0, t1, g = 0.012) { for (let i = S(t0); i < S(t1); i++) { const t = i / SR, e = Math.max(0, Math.min(1, (t - t0) / 1, (t1 - t) / 1)); put(FX, i, (Math.sin(TAU * 60 * t) + 0.5 * Math.sin(TAU * 120 * t) + 0.2 * Math.sin(TAU * 15734 / 8 * t)) * g * e); } }
function crack(t, g = 0.35) { st.snap(t, g); for (let k = 0; k < 9; k++) st.snap(t + 0.04 + k * 0.03 + nz() * 0.03, g * (0.6 - k * 0.05)); st.thud(t, 0.25); }
function shatter(t, d = 2, g = 0.05) { for (let u = 0; u < d; u += 0.01 + nz() * 0.02) st.tone(t + u, 2400 + nz() * 3600, 0.05, g * (1 - u / d) * (0.4 + nz() * 0.6), nz()); }
function swell(t0, t1, notes, g = 0.05) { pad(t0, t1, notes, g, 1400, (t1 - t0) * 0.7, 1.2); }

// ---- the score -------------------------------------------------------------------------------------------------------
const C = [48, 55, 60, 64, 67], Am = [45, 52, 57, 60, 64], F = [41, 48, 53, 57, 60], G = [43, 50, 55, 59, 62], Em = [40, 47, 52, 55, 59], Dm = [38, 50, 53, 57, 62];
function arp(t0, chord, dur, g = 0.05, step = 0.3, pat = [0, 2, 3, 4, 3, 2, 3, 1]) {
  for (let k = 0, t = t0; t < t0 + dur - 0.05; k++, t += step) { const i = pat[k % pat.length], m = chord[i] + (i === 0 ? 0 : 12); pluck(t + nz() * 0.01, m, g * (i === 0 ? 1.2 : 0.8), 0.35 + (k % 3) * 0.15, 2.4, 0.5); }
}
function progression(t0, t1, chords, bar, g, step) { let i = 0; for (let t = t0; t < t1 - 0.2; t += bar, i++) arp(t, chords[i % chords.length], Math.min(bar, t1 - t), g, step); }
// The theme: eight notes, the shape of a climb that slips and then makes it.
const THEME = [67, 69, 72, 71, 69, 67, 64, 67, 69, 72, 74, 76];

// 1. Bottom: the cabinet's hum in the dark room, then the music box, out of tune, slow.
hum(0, 7.5, 0.014);
pad(0.5, SC.trying + 1, [45, 52, 57], 0.03, 450, 3, 3);
THEME.slice(0, 8).forEach((m, i) => box(1.4 + i * 1.05, m, 0.045, 0.4 + (i % 3) * 0.1, (i % 2 ? -1 : 1) * (18 + i * 3)));
st.whoosh(5.6, 1.0, 0.05, 300, 2600);                                  // through the glass
chip(B.title, 64, 0.08, 0.02); chip(B.title + 0.09, 71, 0.12, 0.02);   // CLAWD
for (const t of [B.lookUp, B.tiltUp + 0.3]) chip(t, 76, 0.05, 0.012);
staticNoise(SC.bottom + 6, SC.trying, 0.008);

// 2. Trying: a hopeful little loop, a blip per jump; the smile, the gnat, the fall.
const climbs = [{ t0: B.c1, dt: 1.3, n: 6, fall: B.hit1, land: B.land1 }, { t0: B.c2, dt: 0.95, n: 8, fall: B.hit2, land: B.land2 }, { t0: B.c3, dt: 0.62, n: 12, fall: B.crumble, land: B.land3 }];
for (const [ci, c] of climbs.entries()) {
  for (let i = 0; i < c.n; i++) { const t = c.t0 + i * c.dt + c.dt * 0.35; if (t < c.fall) { jumpBlip(t, 0.022); landBlip(t + c.dt * 0.6, 0.016); } }
  const tempo = [0.42, 0.36, 0.3][ci];
  for (let t = c.t0, k = 0; t < c.fall - 0.1; t += tempo, k++) chip(t, [48, 55, 52, 55][k % 4] + ci * 2, tempo * 0.8, 0.012, 0.5, 0.5, 0, MUS);
  for (let t = c.t0, k = 0; t < c.fall - 0.1; t += tempo * 2, k++) box(t, THEME[k % 8] + ci * 2, 0.025, 0.6, ci === 0 ? 8 : 0);
  // the fall: a falling chip whine, and the thud when he lands
  chip(c.fall, 76, c.land - c.fall, 0.02, 0.25, 0.5, -30);
  st.thud(c.land, 0.45); st.snap(c.land, 0.1);
}
pad(SC.trying, SC.again + 1, [48, 55, 64], 0.025, 700);
chip(B.smile1, 79, 0.08, 0.016); chip(B.smile1 + 0.1, 84, 0.12, 0.016);
buzz(B.bug1, B.hit1 + 1.2, 0.025); buzz(B.hit2 - 1.2, B.hit2 + 1.0, 0.025);
pad(SC.again, SC.lowest + 0.5, [45, 52, 60], 0.028, 600);
// the crumble: grinding, a cascade of small cubes
{ const bp = new BP(400, 0.7); for (let i = S(B.crumble); i < S(B.crumble + 2.2); i++) { const t = i / SR, e = Math.min(1, (t - B.crumble) / 0.1, (B.crumble + 2.2 - t) / 0.6); if (i % 64 === 0) bp.set(250 + 300 * nz(), 0.7); put(FX, i, bp.run(n2()) * 0.12 * e); } }
for (let u = 0; u < 2.5; u += 0.03 + nz() * 0.05) st.tone(B.crumble + 0.3 + u, 300 + nz() * 700, 0.05, 0.03 * (1 - u / 2.5));

// 3. Lowest point: almost nothing. Static, a slow heartbeat of a low note, the music box once, very out of tune.
staticNoise(B.land3 + 0.3, SC.light + 2, 0.022, 2400);
for (let t = B.dimOut + 0.5; t < SC.light; t += 2.2) { st.tone(t, 55, 0.4, 0.06); st.tone(t + 0.25, 55, 0.3, 0.035); }
box(B.staticPeak - 2, 64, 0.03, 0.5, -45); box(B.staticPeak, 60, 0.025, 0.5, -60);

// 4. Light in the dark: one blip, answered; each lit Clawd a soft bell.
chip(B.blip, 84, 0.1, 0.02); chip(B.blip + 0.6, 84, 0.1, 0.012);
box(B.headUp, 72, 0.035, 0.5);
for (let i = 0; i < 12; i++) box(B.blip + 2.2 + i * 0.55, [72, 76, 79, 84][i % 4] - (i % 3 === 0 ? 12 : 0), 0.022, 0.2 + (i % 5) * 0.15);
pad(SC.light + 1, SC.together + 2, [45, 52, 57, 64], 0.03, 800, 3, 3);
st.whoosh(B.reveal, 2.5, 0.03, 200, 900);

// 5. Together: the theme arrives, warm.
pad(SC.together, SC.climb + 1, [48, 55, 60, 64], 0.035, 1000);
box(B.offer, 76, 0.04); box(B.take, 79, 0.045); box(B.take + 0.15, 84, 0.04);
progression(B.rise, SC.climb, [C, Am, F, G], 2.4, 0.045, 0.3);
for (let i = 0; i < 12; i++) chip(B.spread + i * 0.45, 72 + [0, 4, 7, 12][i % 4], 0.07, 0.01, 0.5, 0.2 + (i % 6) * 0.12);
THEME.slice(0, 8).forEach((m, i) => pluck(B.spread + 2.4 + i * 0.6, m + 12, 0.05, 0.6, 2.4, 0.7));

// 6. Coming up: a driving ostinato that climbs; the slip, a gasp of silence, the catch; the gap, the bridge.
const climbEnd = SC.break;
{ let t = B.stack, k = 0; const bass = [48, 48, 55, 53]; while (t < climbEnd - 0.1) { const lift = Math.floor((t - B.stack) / ((climbEnd - B.stack) / 5)); if (!(t > B.slip && t < B.catch)) { pluck(t, bass[Math.floor(k / 4) % 4] + lift * 2, 0.04, 0.5, 0.8, 0.4); if (k % 2 === 0) st.tone(t, 70, 0.1, 0.05); } t += 0.3; k++; } }
progression(B.stack, B.slip, [C, G, Am, F], 2.4, 0.035, 0.3);
progression(B.catch + 0.3, climbEnd, [F, G, Am, G, C, F, G, G], 1.6, 0.04, 0.2);
for (let i = 0; i < 11; i++) { jumpBlip(B.stack + 0.3 + i * 0.27, 0.014); }
buzz(B.slip - 0.6, B.slip + 0.4, 0.02);
chip(B.slip, 79, 0.4, 0.02, 0.25, 0.5, -14); st.tone(B.catch, 880, 0.2, 0.04); chip(B.catch + 0.05, 84, 0.12, 0.016);
chip(B.gap, 60, 0.3, 0.014, 0.5, 0.5, -6); for (let i = 0; i < 4; i++) chip(B.bridge + i * 0.18, 67 + i * 3, 0.1, 0.016);
pad(SC.climb, climbEnd + 0.5, [48, 55, 60, 67], 0.035, 1100);
pad(B.top - 2, climbEnd + 2, [43, 50, 55, 62], 0.035, 1400, 2, 1.5);

// 7. Breaking through: pushes, the crack, the glass, a swell into space.
for (let i = 0; i < 5; i++) st.thud(B.push + i * 0.35, 0.12 + i * 0.03);
crack(B.crack, 0.25); crack(B.crack + 1.1, 0.3); crack(B.open - 0.1, 0.42);
shatter(B.open, 2.6, 0.05); st.whoosh(B.open, 2.4, 0.08, 200, 3000);
swell(B.crack - 1, B.open + 0.5, [43, 50, 55, 59, 62], 0.04);
pad(B.open, SC.last + 1, [36, 48, 55, 60, 64, 67, 72], 0.055, 2200, 0.8, 2);
for (let i = 0; i < 11; i++) { const t = B.pour + i * 0.65; box(t, [72, 76, 79, 84, 79, 76, 84, 88, 84, 79, 91][i], 0.03, 0.2 + (i % 5) * 0.15); st.whoosh(t, 0.5, 0.02, 600, 2400); }
progression(B.pour, SC.last, [C, Em, F, G], 2.4, 0.045, 0.3);

// 8. Last one up: the music thins to the music box, IN tune now; the chain reaches down; pulled up, the swell.
pad(SC.last, SC.end + 1, [45, 52, 57, 64], 0.03, 900);
THEME.slice(0, 6).forEach((m, i) => box(B.alone + 0.2 + i * 0.5, m, 0.035, 0.5));
for (let j = 0; j < 9; j++) chip(B.chain + j * ((B.grab - B.chain) / 9), 60 + j * 2, 0.06, 0.012, 0.5, 0.3 + j * 0.05);
st.tone(B.grab, 660, 0.3, 0.05); st.whoosh(B.pulled, B.solid - B.pulled + 0.5, 0.07, 200, 2800);
swell(B.pulled - 0.5, B.solid + 0.6, [48, 55, 60, 64, 67], 0.05);
st.shimmer(B.solid, 0.035, 72);

// 9. End: the theme in full, warm; then the cabinet hum as we pull back out to the room.
pad(SC.end, DUR, [48, 55, 60, 64, 67], 0.045, 1200, 2, 4);
progression(SC.end + 0.3, B.fadeOut - 0.5, [C, Am, F, G], 2.4, 0.045, 0.3);
THEME.forEach((m, i) => pluck(SC.end + 1.2 + i * 0.6, m + 12, 0.06, 0.55, 2.8, 0.75));
box(B.lookBack, 79, 0.035); box(B.lookBack + 0.3, 84, 0.03);
[72, 76, 79, 84].forEach((m, i) => box(B.endTitle + i * 0.18, m, 0.03, 0.3 + i * 0.12));
hum(B.endTitle + 1.2, DUR, 0.012);
box(B.fadeOut - 0.2, 67, 0.03, 0.5); box(B.fadeOut + 0.5, 72, 0.025, 0.5);

// no voice: a silent placeholder for the shared mixdown
const silent = path.join(ROOT, 'out', 'comingup-silence.wav');
{ const b = Buffer.alloc(48); b.write('RIFF', 0); b.writeUInt32LE(40, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(4, 40); fs.writeFileSync(silent, b); }
const out = path.join(ROOT, 'out', 'cartoon-comingup3d.wav');
const { peak, clip } = st.mixdown(silent, out, { musRev: 0.42, drRev: 0.1 });
fs.copyFileSync(out, path.join(ROOT, 'out', 'cartoon-comingup.wav'));
console.log(`wrote out/cartoon-comingup3d.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
void DR;
