// Soundtrack for "Before the Alarm": a quiet nylon-guitar theme (Karplus-Strong with a warm
// loop filter and a body resonance) over soft pads, a breathy flute for the bone flute, and
// sound for every drawn moment: the ticking and the alarm, clocks racing, dawn birds, bones
// drawing on, a grinding stone, shells threading, firelight crackle and crickets, fence posts,
// the office hum and keys, the storm, and the clock falling silent at the end.
//   node tools/audio-hours.mjs -> out/cartoon-hours.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'hours.timing.json'), 'utf8'));
const L = Object.fromEntries(timing.lines.map((l) => [l.id, l]));
const T = (id) => L[id].t0, E = (id) => L[id].t0 + L[id].dur;
const DUR = 194, st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, lpa, hz, rng } = st;

// ---- instruments ------------------------------------------------------------------------------------
function pluck(t0, m, g = 0.08, pan = 0.5, len = 2.6, bright = 0.5) {
  const f = hz(m), n = Math.max(2, Math.round(SR / f)), b = new Float32Array(n), r = rng(Math.round(f * 37 + t0 * 911));
  let lp = 0; for (let i = 0; i < n; i++) { lp += (r() * 2 - 1 - lp) * (0.3 + bright * 0.5); b[i] = lp; }
  const s = S(t0), N = S(len), body = new BP(hz(m) * 2.1, 1.4), body2 = new BP(220, 1.2); let k = 0, prev = 0, env = 1;
  const damp = 0.4 + 0.1 * bright;
  for (let j = 0; j < N; j++) {
    const x = b[k], nx = b[(k + 1) % n], y = (x * (1 - damp) + nx * damp) * 0.996;
    b[k] = y * 0.6 + prev * 0.4; prev = y; k = (k + 1) % n;
    env = Math.min(1, (N - j) / (SR * 0.3));
    const v = (x + body.run(x) * 0.5 + body2.run(x) * 0.4) * g * env * Math.min(1, j / 40);
    put(MUS, s + j, v * (1 - pan) * 1.6, v * pan * 1.6);
  }
}
function pad(t0, t1, notes, g = 0.04, fc = 700, att = 2, rel = 2.5) {
  const s0 = S(t0), s1 = S(t1), ph = notes.map(() => [0, 0]), f = [new LP(), new LP()];
  for (let i = s0; i < s1 && i < st.N; i++) {
    const t = (i - s0) / SR, e = Math.min(1, t / att, (t1 - t0 - t) / rel);
    let l = 0, r = 0;
    notes.forEach((m, j) => { const fr = hz(m); ph[j][0] = (ph[j][0] + fr * 0.997 / SR) % 1; ph[j][1] = (ph[j][1] + fr * 1.004 / SR) % 1; const a = 1 - 4 * Math.abs(ph[j][0] - 0.5), b = 1 - 4 * Math.abs(ph[j][1] - 0.5); l += a + b * 0.4; r += b + a * 0.4; });
    const k = lpa(fc * (1 + 0.2 * Math.sin(t * 0.3)));
    put(MUS, i, f[0].run(l, k) * g * e / notes.length * 2.2, f[1].run(r, k) * g * e / notes.length * 2.2);
  }
}
function flute(t0, m, d, g = 0.05) {
  const s = S(t0), n = S(d), f = hz(m), bp = new BP(f * 1.02, 6); let ph = 0;
  for (let j = 0; j < n; j++) {
    const t = j / SR, e = Math.min(1, t / 0.08, (d - t) / 0.2), vib = 1 + 0.006 * Math.sin(TAU * 5 * t) * Math.min(1, t * 2);
    ph += TAU * f * vib / SR;
    const v = (Math.sin(ph) * 0.8 + Math.sin(ph * 2) * 0.08 + bp.run(n2()) * 1.4) * e * g;
    put(MUS, s + j, v * 0.9, v);
  }
}
const tick = (t, g = 0.06, f = 3200) => { st.tone(t, f + nz() * 200, 0.018, g); st.snap(t, g * 0.35); };
const Am = [45, 52, 57, 60, 64], F = [41, 48, 53, 57, 60], C = [48, 52, 55, 60, 64], G = [43, 50, 55, 59, 62], Dm = [50, 57, 62, 65, 69], Em = [52, 59, 64, 67, 71], Bb = [46, 53, 58, 62, 65], E7 = [40, 52, 56, 59, 62];
// A fingerpicked arpeggio: bass, then the upper voices in a gentle rolling pattern.
function arp(t0, chord, dur, g = 0.06, step = 0.32, pat = [0, 2, 3, 4, 3, 2, 3, 1]) {
  for (let k = 0, t = t0; t < t0 + dur - 0.05; k++, t += step) { const m = chord[pat[k % pat.length]] + (pat[k % pat.length] === 0 ? 0 : 12); pluck(t + nz() * 0.012, m, g * (pat[k % pat.length] === 0 ? 1.2 : 0.8), 0.35 + (k % 3) * 0.15, 2.4, 0.45); }
}
function progression(t0, t1, chords, bar, g, step) { let i = 0; for (let t = t0; t < t1 - 0.2; t += bar, i++) arp(t, chords[i % chords.length], Math.min(bar, t1 - t), g, step); }
const melody = (t0, notes, g = 0.07, step = 0.64) => notes.forEach((m, i) => { if (m) pluck(t0 + i * step, m, g, 0.6, 3, 0.7); });

// ---- the score, shot by shot ------------------------------------------------------------------------
const SH = { machines: T('a2') - 0.3, dawn: T('a3') - 0.7, bones: T('b1') - 0.9, grind: T('b4') - 0.6, band: T('c1') - 0.9, camp: T('c2') - 0.4, week: T('c3') - 0.4, together: E('c3') - 4.3, maker: T('d1') - 0.9, flute: T('d2') + 3.6, sharing: T('d3') - 0.6, day: T('d4') - 0.6, night: T('d5') - 0.3, map: T('e1') - 1.0, multiply: T('e2') - 0.5, cycle: T('e3') - 0.5, fenced: T('e4') - 0.5, office: T('f1') - 1.0, danger: T('f2') - 0.6, ending: T('f3') - 0.6 };

// Night, the bedroom: a clock ticking, then the alarm.
for (let t = 0.4; t < T('a1'); t += 0.5) tick(t, t % 1 < 0.5 ? 0.05 : 0.035, t % 1 < 0.5 ? 3000 : 2400);
for (let t = T('a1'); t < T('a1') + 2.6; t += 0.07) { st.tone(t, 2600 + (Math.floor(t * 14) % 2) * 380, 0.06, 0.07); st.tone(t + 0.01, 1300, 0.05, 0.035); }
st.thud(T('a1') + 0.1, 0.2);
// The machines: each lands with a small beep or whirr, clocks tick faster and faster.
pad(SH.machines, SH.dawn + 0.4, [45, 52, 59], 0.03, 420);
[0.6, 1.05, 1.5, 1.95, 2.4, 2.85, 3.3, 3.75].forEach((d, i) => { const t = SH.machines + d + 0.6; st.tone(t, [880, 1320, 660, 990, 1760, 740, 1175, 1480][i], 0.12, 0.04, 0.2 + i * 0.08); st.whoosh(t - 0.1, 0.3, 0.03, 600, 2400); });
st.tone(SH.machines + 1.2, 1100, 0.3, 0.02); st.tone(SH.machines + 1.45, 1100, 0.3, 0.02);
{ let t = SH.machines + 3.6, p = 0.5; while (t < SH.dawn - 0.2) { tick(t, 0.04, 2800 + nz() * 900); t += p; p = Math.max(0.045, p * 0.9); } }
// Dawn: wind, birds, and the guitar begins.
st.wind(SH.dawn, SH.bones + 1, 0.022); st.birds(SH.dawn + 1.5, SH.bones, 0.025, 4);
pad(SH.dawn, SH.bones + 1, [45, 52, 57, 64], 0.035, 900);
progression(SH.dawn + 0.6, SH.bones, [Am, F, C, G], 2.56, 0.055, 0.32);
// The bones: pencil scratches as they draw, a sparse minor accompaniment.
for (let i = 0; i < 14; i++) st.brush(SH.bones + 0.5 + i * 0.3, 0.25, 0.035);
for (let i = 0; i < 10; i++) st.tone(SH.bones + 1.2 + i * 0.32, 700 + nz() * 300, 0.04, 0.02);
pad(SH.bones, SH.grind + 0.8, [45, 52, 60], 0.03, 600);
progression(SH.bones + 1.0, SH.grind, [Am, Dm, Am, E7], 3.84, 0.045, 0.48);
[0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => st.tone(T('b2') + 4.6 + i * 0.45, 1500 + i * 120, 0.08, 0.02, 0.5));
[0, 1, 2].forEach((i) => st.tone(T('b3') + 6.8 + i * 0.35, 520, 0.14, 0.03));
// Grinding: stone on stone with every stroke, days turning overhead.
pad(SH.grind, SH.band + 0.6, [40, 47, 52], 0.035, 500);
{ const bp = new BP(900, 0.8); for (let i = S(SH.grind + 0.6); i < S(SH.band - 0.2); i++) { const t = i / SR, u = t - SH.grind, e = Math.abs(Math.cos(u * 2.6)) ** 2; if (i % 64 === 0) bp.set(500 + 500 * e, 0.8); put(FX, i, bp.run(n2()) * 0.07 * (0.3 + e)); } }
for (let t = SH.grind + 0.5; t < SH.band; t += 2.4) pluck(t, 57, 0.035, 0.5, 3, 0.3);
// The band walks: footsteps, wind, a brighter figure.
st.wind(SH.band, SH.week, 0.02); st.birds(SH.band, SH.week, 0.02, 7); st.steps(SH.band + 0.6, SH.camp - 0.2, 0.3, 0.035, 120);
pad(SH.band, SH.week + 0.5, [48, 55, 60, 64], 0.03, 900);
progression(SH.band + 0.3, SH.week, [C, G, Am, F], 2.4, 0.05, 0.3);
for (let i = 0; i < 22; i++) st.tone(SH.camp + 1.8 + i * (5.2 / 22), 1900 + nz() * 300, 0.03, 0.03);
// The week: soft pops as the hours stack up.
for (let d = 0; d < 7; d++) for (let i = 0; i < 3; i++) st.tone(T('c3') + 0.2 + (d * 3 + i) * 0.1, 900 + i * 200, 0.05, 0.025, 0.2 + d * 0.1);
for (let k = 0; k < 26; k++) st.tone(T('c3') + 4.0 + k * 0.07, 500, 0.04, 0.018);
for (let k = 0; k < 40; k++) st.tone(T('c3') + 7.8 + k * 0.03, 380, 0.03, 0.015);
pad(SH.week, SH.maker + 0.5, [48, 52, 55, 60], 0.03, 800);
progression(SH.week + 0.2, SH.maker, [Am, F, C, G], 2.56, 0.045, 0.32);
st.ambience(SH.together + 0.4, SH.maker - 0.2, 0.012);
// Making things: shells click onto the string, then the bone flute plays.
progression(SH.maker + 0.3, SH.flute, [F, C, G, Am], 2.4, 0.05, 0.3);
for (let i = 0; i < 12; i++) { const t = T('d2') + 0.4 + (i / 12) * 2.6; st.tone(t, 2400 + nz() * 900, 0.03, 0.05, 0.6); st.tone(t + 0.02, 3600, 0.02, 0.02); }
pad(SH.flute, SH.sharing + 0.5, [45, 52, 57], 0.035, 800);
[[0, 69, 0.5], [0.5, 72, 0.4], [0.9, 74, 0.7], [1.6, 76, 0.5], [2.1, 74, 0.3], [2.4, 72, 0.4], [2.8, 69, 0.9]].forEach(([d, m, l]) => flute(SH.flute + 0.5 + d, m, l, 0.05));
// Sharing: a pluck on every hop of the meat.
progression(SH.sharing + 0.3, SH.day, [C, Am, F, G], 2.4, 0.045, 0.3);
[1.8, 2.4, 3.0, 3.6].forEach((d, i) => pluck(SH.sharing + d + 0.3, [72, 76, 79, 84][i], 0.05, 0.3 + i * 0.12, 2, 0.8));
[1.2, 1.9].forEach((d, i) => pluck(T('d3') - 0.6 + 4.2 + d + 0.4, [79, 84][i], 0.06, 0.6, 2.4, 0.8));
// Day talk: voices far off, birds; then sunset.
st.ambience(SH.day, SH.night, 0.014); st.birds(SH.day, SH.night - 2, 0.018, 9);
pad(SH.day, SH.night + 0.5, [48, 55, 64], 0.03, 800);
progression(SH.day + 0.3, SH.night - 1.2, [F, C, Dm, Am], 2.56, 0.04, 0.32);
// Night: fire and crickets; a slow tune on the flute, the storyteller's.
{ const lp = new LP(); for (let i = S(SH.night); i < S(SH.map + 0.3); i++) { const t = i / SR, e = Math.min(1, (t - SH.night) / 0.6, (SH.map + 0.3 - t) / 0.6); put(FX, i, lp.run(n2(), lpa(300)) * 0.05 * e); } }
for (let t = SH.night + 0.2; t < SH.map; t += 0.04 + nz() * 0.18) st.snap(t, 0.04 + nz() * 0.07);
for (let t = SH.night + 0.3; t < SH.map; t += 0.55) for (let k = 0; k < 3; k++) st.tone(t + k * 0.04, 4600, 0.025, 0.012, 0.8);
pad(SH.night, SH.map + 0.4, [45, 52, 57, 60], 0.04, 600);
[[0.6, 64, 0.9], [1.6, 67, 0.6], [2.3, 69, 1.4], [4.0, 67, 0.6], [4.7, 64, 1.6]].forEach(([d, m, l]) => flute(SH.night + d, m, l, 0.04));
// The map and the fields: darker, the pulse of work.
for (let i = 0; i < 8; i++) st.brush(SH.map + 0.3 + i * 0.35, 0.3, 0.03);
pad(SH.map, SH.multiply + 0.5, [50, 57, 62, 65], 0.04, 700);
progression(SH.map + 0.4, SH.multiply, [Dm, Bb, F, C], 2.4, 0.05, 0.3);
st.whoosh(T('e1') + 0.4, 3.0, 0.04, 200, 900);
pad(SH.multiply, SH.cycle + 0.5, [50, 57, 62], 0.04, 700);
[0, 0.9, 1.8, 2.7].forEach((d, i) => { for (let k = 0; k < 2 ** (i + 1) && k < 8; k++) st.tone(SH.multiply + d + k * 0.04, 700 + k * 60, 0.05, 0.03, (k % 4) / 4 + 0.1); });
progression(SH.multiply + 0.3, SH.cycle, [Dm, Bb], 1.6, 0.05, 0.2);
// The cycle: a pluck per task, then an ostinato that speeds up and up.
pad(SH.cycle, SH.fenced + 0.5, [50, 57, 62, 65], 0.045, 900);
[1.2, 1.9, 2.6, 3.4, 4.3].forEach((d, i) => pluck(SH.cycle + d + 0.5, [62, 65, 69, 72, 74][i], 0.07, 0.2 + i * 0.15, 2.2, 0.7));
{ let t = SH.cycle + 5.6, p = 0.36, i = 0; while (t < SH.fenced - 0.1) { pluck(t, [50, 57, 62, 57][i % 4] + 12, 0.045, 0.5, 1.2, 0.6); st.tone(t, 180, 0.08, 0.05); t += p; p = Math.max(0.1, p * 0.93); i++; } }
// Fenced in: posts thud into the ground, a low held chord.
for (let i = 0; i < 38; i++) st.thud(SH.fenced + 0.8 + i * (1.8 / 38), 0.06);
pad(SH.fenced, SH.office + 0.3, [38, 45, 50, 53], 0.05, 500);
for (let t = SH.fenced + 1.8; t < SH.office - 0.2; t += 0.9) st.wind(t, t + 0.9, 0.012);
// The office: hum, keys, the clock; then the daydream, and the guitar theme comes back.
{ for (let i = S(SH.office); i < S(SH.danger); i++) { const t = i / SR, e = Math.min(1, (t - SH.office) / 0.5, (SH.danger - t) / 0.5); put(FX, i, Math.sin(TAU * 60 * t) * 0.01 * e + Math.sin(TAU * 120 * t) * 0.005 * e); } }
const dream = T('f1') + 4.3;
for (let t = SH.office + 0.8; t < dream; t += 0.09 + nz() * 0.12) st.snap(t, 0.05 + nz() * 0.04);
for (let t = SH.office + 0.5; t < SH.danger; t += 1) tick(t, 0.03, 2600);
st.shimmer(dream + 0.3, 0.04, 72);
pad(dream, SH.danger + 0.6, [48, 55, 60, 64], 0.035, 1000);
progression(dream + 0.8, SH.danger, [Am, F, C, G], 2.4, 0.045, 0.3);
st.birds(dream + 3, SH.danger, 0.012, 11);
// The danger: storm and a growl, then quiet at the cairn.
{ const lp = new LP(); for (let i = S(SH.danger); i < S(SH.ending + 0.4); i++) { const t = i / SR, e = Math.min(1, (t - SH.danger) / 0.8, (SH.ending + 0.4 - t) / 0.8); put(FX, i, lp.run(n2(), lpa(160)) * 0.12 * e * (0.6 + 0.4 * Math.sin(t * 0.7))); } }
st.wind(SH.danger, SH.ending, 0.03);
{ const lp = new LP(); const s = S(SH.danger + 1.0); for (let j = 0; j < SR * 1.4; j++) { const u = j / SR; put(FX, s + j, lp.run(n2(), lpa(120 + 40 * Math.sin(u * 30))) * 0.25 * Math.sin(Math.PI * u / 1.4)); } }
pad(SH.danger, SH.ending + 0.6, [45, 48, 52], 0.04, 450);
pluck(T('f2') + 3.4, 64, 0.05, 0.5, 4, 0.3); pluck(T('f2') + 3.9, 60, 0.04, 0.5, 4, 0.3);
// The end: the theme, resolving; birds; the clock does not tick.
st.birds(SH.ending + 1, DUR - 2, 0.015, 13); st.wind(SH.ending, DUR, 0.012);
pad(SH.ending, DUR, [45, 52, 57, 64], 0.04, 1000, 2, 4);
progression(SH.ending + 0.3, E('f3') + 1.5, [Am, F, C, G], 2.56, 0.05, 0.32);
melody(E('f3') + 1.6, [69, 72, 76, 74, 72, 0, 67, 69], 0.06, 0.64);
arp(E('f3') + 7.0, [45, 52, 57, 61, 64], 3.2, 0.05, 0.4);
pad(E('f3') + 6.8, DUR, [45, 52, 57, 61, 64, 69], 0.05, 1200, 1.5, 3);

const { peak, clip } = st.mixdown(path.join(ROOT, 'out', 'hours-voice.wav'), path.join(ROOT, 'out', 'cartoon-hours.wav'), { musRev: 0.4, drRev: 0.1 });
console.log(`wrote out/cartoon-hours.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
void DR;
