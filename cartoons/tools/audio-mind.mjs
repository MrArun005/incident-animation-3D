// Soundtrack for "Inside a Mind": cinematic ambient synth that moves from D minor
// to D major as the answer turns from "dark" to "light". Typing ticks, token
// chimes, a harp through the galaxy of meaning, plucks as attention arcs draw, one
// rising pulse per layer, a chime per chosen word, waves, and the narration.
//   node tools/audio-mind.mjs -> out/cartoon-mind.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'mind.beats.json'), 'utf8'));
const DUR = B.duration, st = studio(DUR);
const { SR, TAU, MUS, FX, put, S, nz, n2, LP, hz } = st;

// ---- synths ------------------------------------------------------------------------------------------------------
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
const tick = (t, g = 0.05, f = 2400) => st.tone(t, f + nz() * 300, 0.025, g);
function swell(t, d, g = 0.08, f0 = 300, f1 = 3000) { st.whoosh(t, d, g, f0, f1); }
const D = 50;                                      // D3 as the root
const Dm = [D, D + 7, D + 12, D + 15, D + 19], Bb = [D - 4, D + 3, D + 10, D + 14], F = [D + 3, D + 10, D + 15, D + 19], Cm = [D - 2, D + 5, D + 10, D + 14, D + 17], DM = [D, D + 7, D + 12, D + 16, D + 19, D + 26];
const PENT = [0, 3, 5, 7, 10];                    // D minor pentatonic
const mp = (i, base = D + 24) => base + PENT[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);

// ---- score -----------------------------------------------------------------------------------------------------------
// The prompt: a low drone, the keystrokes, a rising swell into the text.
pad(0.2, B.tokens + 1, [D - 12, D - 5], 0.07, 400, 2);
for (let i = 0; i < 32; i++) tick(0.8 + i * 0.075, 0.05);
swell(4.2, 2.0, 0.08, 200, 2600); sub(B.tokens, D - 12, 2.5, 0.2);
// Tokens: a glassy shatter, a bell per tile, digital blips for the ids.
for (let i = 0; i < 14; i++) bell(6.2 + nz() * 0.25, mp(5 + Math.floor(nz() * 6)), 0.03, nz());
[0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => bell(6.6 + i * 0.22, mp(i), 0.05, 0.2 + i * 0.08));
for (let i = 0; i < 8; i++) { tick(9.4 + i * 0.09, 0.04, 3200); tick(9.44 + i * 0.09, 0.03, 1800); }
pad(B.tokens, B.cloud + 1, Dm, 0.055, 800);
swell(14.2, 2.4, 0.09, 300, 3000); sub(B.cloud, D - 12, 3, 0.18);
// The galaxy: a harp arpeggio drifting over Bb and F.
pad(B.cloud, 22.5, Bb, 0.055, 1000); pad(22, B.attention + 1, F, 0.055, 1100);
for (let i = 0; i < 44; i++) st.sitar(B.cloud + 0.4 + i * 0.28, mp([0, 2, 4, 3, 1, 2, 5, 4][i % 8] + (i > 22 ? 2 : 0)), 0.055, 0.3 + (i % 5) * 0.1, 1.6);
// Attention: plucks as each arc draws; a big shimmer when all the heads join.
pad(B.attention, B.layers + 1, Cm, 0.05, 1200);
for (let j = 0; j < 8; j++) { st.sitar(28.7 + j * 0.13, mp(j + 3), 0.035, 0.2 + j * 0.08, 1.2); st.sitar(33.1 + j * 0.13, mp(j + 5), 0.035, 0.8 - j * 0.08, 1.2); }
swell(36.8, 1.6, 0.09); st.shimmer(37.3, 0.06, D + 36); for (let i = 0; i < 24; i++) bell(37.4 + i * 0.16, mp(i % 10 + 4), 0.022, nz(), 2);
// Layers: one pulse per layer, climbing; tension underneath.
pad(B.layers, B.predict + 0.5, [D - 12, D - 5, D + 3], 0.06, 600);
for (let L = 0; L < 12; L++) { const t = 42.4 + L * 0.9; sub(t, D - 12 + L, 0.8, 0.12); bell(t, mp(L + 2), 0.035, 0.5, 1.6); }
swell(51.8, 1.8, 0.1, 400, 4000);
// Prediction: a quiet pulse while the bars fill; a chime for each chosen word, the melody of the answer.
pad(B.predict, B.sea + 1, [D - 12, D], 0.045, 500);
for (let t = B.predict + 0.2; t < B.pick; t += 0.5) tick(t, 0.025, 900);
bell(B.pick, D + 24, 0.09, 0.5, 3.2); sub(B.pick, D - 12, 1.5, 0.18);
const answerNotes = [3, 2, 4, 3, 5, 6, 5, 8];
answerNotes.forEach((d, i) => { const t = B.loop0 + i * B.loopStep + 0.55 * B.loopStep; bell(t, mp(d), 0.07, 0.35 + (i % 3) * 0.15, 2.4); for (let k = 0; k < 3; k++) tick(t - 0.5 + k * 0.12, 0.018, 1100); });
// The sea: waves, a warm D major, the answer falling in as light.
st.river(B.sea, DUR, 0.06); st.wind(B.sea, DUR, 0.02);
pad(B.sea, B.end + 1, DM, 0.06, 1400, 2.5);
for (let i = 0; i < 26; i++) bell(B.dissolve + 0.6 + (i / 26) * 1.8, D + 36 - [0, 2, 4, 7, 9, 12][i % 6], 0.03, (i % 7) / 7, 2.2);
swell(B.dissolve + 1.0, 3.0, 0.07, 300, 2400);
[[0, 12, 1.8], [2.0, 14, 1.2], [3.2, 16, 1.8], [5.2, 19, 2.8]].forEach(([d, m, l]) => st.bansuri(B.dissolve + 2.6 + d, D + m + 12, l, 0.05, false));
// The end card: a wide D major with a shimmer, to silence.
pad(B.end, DUR, [D - 12, ...DM], 0.07, 1600, 1.2, 3);
st.shimmer(B.end + 0.1, 0.06, D + 24); sub(B.end, D - 12, 4, 0.18);

const { peak, clip } = st.mixdown(path.join(ROOT, 'out', 'mind-voice.wav'), path.join(ROOT, 'out', 'cartoon-mind.wav'), { musRev: 0.45, drRev: 0.1 });
console.log(`wrote out/cartoon-mind.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
void FX; void n2;
