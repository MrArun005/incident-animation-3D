// Soundtrack for "The Compressed Century": a slow ambient score that climbs from D minor
// (one rogue cell, one slow experiment at a time) to D major (the century folding into ten).
// Wet blips as the cancer cell divides, a clock-tick per year of the slow timeline, a dull
// knock per failed experiment, paper for the essay, a lattice of bells for the country of
// minds, a buzz per wrong molecule and a chord when one fits, the immune strike, the fold.
//   node tools/audio-cure.mjs -> out/cartoon-cure.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'cure.beats.json'), 'utf8'));
const DUR = B.duration, st = studio(DUR);
const { SR, TAU, MUS, put, S, nz, LP, hz } = st;

// ---- synths (the Mind score's pad, bell and sub) ------------------------------------------------
function pad(t0, t1, notes, gain = 0.05, fc = 900, att = 1.5, rel = 2) {
  const s0 = S(t0), s1 = S(t1), ph = notes.map(() => [0, 0, 0]), f = [new LP(), new LP()];
  for (let i = s0; i < s1 && i < st.N; i++) {
    const t = (i - s0) / SR, e = Math.min(1, t / att) * Math.min(1, (t1 - t0 - t) / rel);
    let l = 0, r = 0;
    notes.forEach((m, j) => { const fr = hz(m); for (let d = 0; d < 3; d++) { ph[j][d] = (ph[j][d] + fr * [0.995, 1, 1.006][d] / SR) % 1; const v = ph[j][d] * 2 - 1; if (d === 0) l += v; else if (d === 2) r += v; else { l += v * 0.5; r += v * 0.5; } } });
    const fcc = fc * (1 + 0.25 * Math.sin(t * 0.4));
    put(MUS, i, f[0].run(l, 1 - Math.exp(-TAU * fcc / SR)) * gain * 2.6 * e / notes.length, f[1].run(r, 1 - Math.exp(-TAU * fcc / SR)) * gain * 2.6 * e / notes.length);
  }
}
function bell(t, m, g = 0.06, pan = 0.5, len = 3) {
  g *= 1.5; const f = hz(m), s = S(t), n = S(len);
  for (let j = 0; j < n; j++) { const u = j / SR, v = (Math.sin(TAU * f * u) + 0.4 * Math.sin(TAU * f * 2.76 * u) * Math.exp(-u * 3) + 0.2 * Math.sin(TAU * f * 5.4 * u) * Math.exp(-u * 7)) * Math.exp(-u * 1.3) * Math.min(1, u * 800) * g; put(MUS, s + j, v * (1 - pan) * 2, v * pan * 2); }
}
function sub(t, m, d = 1.2, g = 0.15) { const s = S(t), n = S(d), f = hz(m); for (let j = 0; j < n; j++) { const u = j / SR; put(MUS, s + j, Math.sin(TAU * f * u) * g * Math.min(1, u * 30) * Math.exp(-u / (d * 0.5))); } }
// A soft heartbeat: two low thumps.
function beat(t, g = 0.14) { sub(t, 26, 0.35, g); sub(t + 0.22, 26, 0.3, g * 0.7); }
// A wet cell-division blip: a quick upward bend with a bubbly tail.
function blip(t, g = 0.05, f0 = 220) { st.sweep(t, f0, f0 * 2.4, 0.18, g); st.sweep(t + 0.05, f0 * 1.5, f0 * 3.2, 0.12, g * 0.6); }
// A dull buzz for a wrong fit.
function buzz(t, g = 0.05) { const s = S(t), n = S(0.22); for (let j = 0; j < n; j++) { const u = j / n, v = (((j * 140 / SR) % 1) * 2 - 1) * g * Math.sin(u * Math.PI); put(st.FX, s + j, v, v); } }
const tick = (t, g = 0.05, f = 2400) => st.tone(t, f + nz() * 300, 0.025, g);
const D = 50;
const Dm = [D, D + 7, D + 12, D + 15, D + 19], Bb = [D - 4, D + 3, D + 10, D + 14], Gm = [D - 7, D + 5, D + 10, D + 13], A7 = [D - 5, D + 7, D + 11, D + 14, D + 17], F = [D + 3, D + 10, D + 15, D + 19], DM = [D, D + 7, D + 12, D + 16, D + 19, D + 26];
const PENT = [0, 3, 5, 7, 10], MAJ = [0, 2, 4, 7, 9];
const mp = (i, base = D + 24, sc = PENT) => base + sc[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);

// ---- score -----------------------------------------------------------------------------------------------------------
// One cell: a low drone, a heartbeat; the rogue cell turns and starts dividing.
pad(0.2, B.slow + 1, [D - 12, D - 5], 0.07, 380, 2.5);
for (let t = 0.8; t < B.slow; t += 1.05) beat(t, t > B.turn ? 0.17 : 0.12);
sub(B.turn, D - 13, 2.4, 0.18); st.whoosh(B.turn - 0.6, 1.2, 0.05, 200, 900);
for (let gen = 0, t = B.divide; t < B.slow - 0.1; gen++, t += 1.15) for (let k = 0; k < 2 ** gen && k < 8; k++) blip(t + k * 0.06 + nz() * 0.03, 0.05, 200 + gen * 60 + k * 15);
// Slow: one tick per year, a dull knock for each experiment that fails.
pad(B.slow, B.essay + 1, [D - 12, D - 9, D - 5], 0.055, 500);
for (let y = 0; y < 12; y++) { const t = 11.2 + y * (10.6 / 12); tick(t, 0.05, 1600); tick(t + 0.45, 0.03, 1200); if (y < 11) st.thud(t + 0.3, 0.14); }
sub(21.8, D - 12, 2.2, 0.16);
// The essay: paper, a warm Bb swell, the lines lighting like a slow harp.
st.brush(B.essay + 0.3, 0.6, 0.08); st.brush(B.essay + 0.9, 0.4, 0.05);
pad(B.essay, B.country + 1, Bb, 0.055, 1000);
for (let i = 0; i < 24; i++) st.sitar(24 + i * 0.3, mp([0, 2, 4, 3, 5, 4, 2, 1][i % 8] + (i > 12 ? 2 : 0)), 0.045, 0.3 + (i % 5) * 0.1, 1.6);
st.shimmer(B.essay + 0.6, 0.04, D + 24);
// The country of geniuses: a lattice of bells, thickening as the camera pulls back.
pad(B.country, B.search + 1, Gm, 0.055, 1200);
for (let i = 0; i < 90; i++) { const u = i / 90, t = B.country + 0.3 + (1 - (1 - u) ** 1.8) * 9.6; bell(t, mp(Math.floor(nz() * 10) + 2), 0.012 + 0.018 * u, nz(), 1.8); }
st.whoosh(B.country + 0.2, 2.4, 0.06, 1800, 300); st.whoosh(39.5, 2.0, 0.07, 300, 2800);
// The search: a buzz per wrong molecule, a major chord when the last one fits.
pad(B.search, B.immune + 1, A7, 0.05, 900);
for (let i = 0; i < 6; i++) { const t0 = 42.0 + i * 0.85; st.whoosh(t0, 0.5, 0.05, 500, 1800); if (i < 5) { buzz(t0 + 0.45, 0.05); st.snap(t0 + 0.45, 0.12); } }
{ const fit = 42.0 + 5 * 0.85 + 0.7; sub(fit, D - 12, 2, 0.2); [0, 4, 7, 12, 16].forEach((d, i) => bell(fit + i * 0.05, D + 24 + d, 0.05, 0.3 + i * 0.1, 3)); st.shimmer(fit + 0.25, 0.05, D + 36); }
// Immune: the T cell glides in; the markers light; it binds; the cancer cell breaks apart.
pad(B.immune, B.century + 0.8, [D - 12, D - 5, D + 4], 0.05, 700);
st.whoosh(48.4, 2.8, 0.05, 200, 800);
[0, 3, 7, 10, 12].forEach((d, i) => bell(B.see + i * 0.09, D + 36 + d, 0.03, 0.7, 2));
sub(B.bind, D - 12, 1.6, 0.22); st.sweep(B.bind, 180, 900, 0.8, 0.04);
{ const bt = B.bind + 1.4; st.thud(bt, 0.32); st.whoosh(bt, 1.8, 0.1, 2400, 300); st.beadSpill(bt + 0.05, 1.6, 0.04); }
// The century: a hundred years of milestones pinging in, then the fold into D major.
pad(B.century, B.fold + 0.5, F, 0.055, 1100);
for (let i = 0; i < 28; i++) bell(B.century + 0.4 + i * 0.13, mp(i % 12 + 1, D + 24, MAJ), 0.022, (i * 0.37) % 1, 1.6);
st.whoosh(B.fold - 0.2, 3.4, 0.09, 2600, 250); sub(B.fold + 3.2, D - 12, 3, 0.22);
pad(B.fold, B.promise + 1, DM, 0.06, 1400, 2.4);
[[0, 12, 1.8], [2.0, 14, 1.2], [3.2, 16, 1.8]].forEach(([d, m, l]) => st.bansuri(B.fold + 3.4 + d, D + m + 12, l, 0.045, false));
// The promise: quiet, open, the heartbeat back but calm.
pad(B.promise, B.end + 1, [D - 12, D, D + 7, D + 16], 0.06, 1100, 2.5);
for (let t = B.promise + 0.8; t < B.end - 0.5; t += 1.3) beat(t, 0.09);
[[0, 7], [1.6, 9], [3.0, 12], [5.0, 14]].forEach(([d, m]) => bell(B.promise + 1.2 + d, D + 24 + m, 0.035, 0.5, 3));
// The end card: a wide D major and a shimmer, to silence.
pad(B.end, DUR, [D - 12, ...DM], 0.07, 1600, 1.2, 3);
st.shimmer(B.end + 0.1, 0.06, D + 24); sub(B.end, D - 12, 4, 0.18);
[[1.2, 12, 2.4], [3.8, 16, 1.4], [5.4, 19, 2.8]].forEach(([d, m, l]) => st.bansuri(B.end + d, D + m + 12, l, 0.045, false));

const { peak, clip } = st.mixdown(path.join(ROOT, 'out', 'cure-voice.wav'), path.join(ROOT, 'out', 'cartoon-cure.wav'), { musRev: 0.45, drRev: 0.1 });
console.log(`wrote out/cartoon-cure.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
