// Soundtrack for "The City of Victory": a Carnatic-flavoured score (veena-like
// plucks, nadaswaram, mridangam-style drums, cymbals) in Mohanam by day and
// Kalyani at night; the bazaar, horses, an elephant, coracles; the singing
// pillars ring Sa Re Ga Pa Dha; the dialogue on top.
//   node tools/audio-hampi.mjs -> out/cartoon-hampi.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'hampi.beats.json'), 'utf8'));
const TM = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'hampi.timing.json'), 'utf8'));
const DUR = B.duration, st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, SA, hz, deg } = st;
const SC = Object.fromEntries(B.scenes.map(([id, t0], i) => [id, [t0, i + 1 < B.scenes.length ? B.scenes[i + 1][1] : DUR]]));
const VO = Object.fromEntries(TM.lines.map((l) => [l.id, l]));
const MOHANAM = [0, 2, 4, 7, 9], KALYANI = [0, 2, 4, 6, 7, 9, 11], HAMSA = [0, 2, 4, 7, 11];

function nadas(t0, m, d, gain = 0.05, slide = 1) {
  const s = S(t0), n = S(d), f = hz(m), bp = new BP(1400, 1.6), lp = new LP(); let ph = 0;
  for (let k = 0; k < n; k++) { const t = k / SR, e = Math.min(1, t / 0.04) * Math.min(1, (d - t) / 0.1), bend = t < 0.08 ? 2 ** (-slide * (1 - t / 0.08) / 12) : 1; ph = (ph + f * bend * (1 + 0.009 * Math.sin(TAU * 6 * t) * Math.min(1, t * 2)) / SR) % 1; const saw = ph * 2 - 1, v = (lp.run(saw, 0.35) * 0.6 + bp.run(saw) * 1.4) * e * gain; put(MUS, s + k, v * 0.95, v); }
}
const tune = (t0, bpm, notes, scale, gain, inst = nadas, base = SA) => { const bt = 60 / bpm; for (const [b, dg, len] of notes) inst(t0 + b * bt, deg(scale, dg, base), len * bt * 0.95, gain); };
const veena = (t0, bpm, notes, scale, gain = 0.06) => st.melody(t0, bpm, notes, scale, gain);
function cymbal(t, g = 0.05) { const s = S(t), n = S(0.5), bp = new BP(6500, 2); for (let j = 0; j < n; j++) { const u = j / SR; put(DR, s + j, (bp.run(n2()) * 1.5 + Math.sin(TAU * 3300 * u) * 0.3 + Math.sin(TAU * 4700 * u) * 0.2) * g * Math.exp(-u / 0.12)); } }
function talam(t0, t1, bpm, g = 0.05) { const bt = 60 / bpm; for (let t = t0, i = 0; t < t1; t += bt, i++) cymbal(t, g * (i % 4 === 0 ? 1.3 : 0.7)); }
function trumpet(t, g = 0.2) { const s = S(t), n = S(1.0), bp = new BP(900, 1.2); let ph = 0; for (let j = 0; j < n; j++) { const u = j / n, f = 380 * (1 + 0.8 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5)); ph = (ph + f / SR) % 1; const v = bp.run((ph * 2 - 1) + n2() * 0.35) * g * Math.min(1, u * 12) * (1 - u) ** 0.7 * 1.6; put(FX, s + j, v, v * 0.9); } }
function neigh(t, g = 0.08) { const s = S(t), n = S(0.8), bp = new BP(1100, 3); let ph = 0; for (let j = 0; j < n; j++) { const u = j / n, f = 700 + 500 * Math.sin(u * Math.PI) * (1 + 0.2 * Math.sin(TAU * 18 * j / SR)); ph = (ph + f / SR) % 1; const v = bp.run(ph * 2 - 1 + n2() * 0.2) * g * Math.sin(u * Math.PI) * 2; put(FX, s + j, v, v); } }
function cheer(t0, d, g = 0.08) { const lp = new LP(); for (let i = S(t0); i < S(t0 + d) && i < st.N; i++) { const u = (i - S(t0)) / SR, e = Math.min(1, u / 0.3, (d - u) / 0.6); put(FX, i, lp.run(n2(), 0.25) * g * 3 * e * (0.8 + 0.2 * Math.sin(u * 17))); } st.ambience(t0, t0 + d, g * 0.6); }
// A stone pillar's note: a bright bell with a long, slightly beating tail.
function pillarNote(t, m, g = 0.1) {
  const f = hz(m), s = S(t), n = S(2.4);
  for (let j = 0; j < n; j++) { const u = j / SR, v = (Math.sin(TAU * f * u) + 0.5 * Math.sin(TAU * f * 2.005 * u) * Math.exp(-u * 2) + 0.3 * Math.sin(TAU * f * 3.01 * u) * Math.exp(-u * 4) + 0.15 * Math.sin(TAU * f * 5.4 * u) * Math.exp(-u * 9)) * Math.exp(-u * 1.4) * Math.min(1, u * 600) * g; put(MUS, s + j, v * 0.9, v); }
}

// ---- score ---------------------------------------------------------------------------------------------------------
// Opening: tanpura, a nadaswaram alap in Hamsadhwani, the title shimmer.
st.tanpura(0.3, SC.gate[1], 0.05);
[[1.0, 0, 1.2], [2.3, 2, 0.8], [3.2, 4, 1.4], [4.8, 3, 0.8], [5.7, 4, 1.8]].forEach(([t, d, l]) => nadas(t, deg(HAMSA, d), l, 0.065, 2));
st.shimmer(1.8, 0.07);
// Gate: wonder; a light veena phrase as Kamala arrives.
st.sweep(B.arrive, 300, 800, 1.2, 0.03);
veena(B.kamalaIn, 132, [[0, 4, 0.5], [0.5, 5, 0.5], [1, 7, 1], [2, 5, 0.5], [2.5, 4, 0.5], [3, 2, 1]], MOHANAM, 0.06);
// Bazaar: a bright walking tune in Mohanam over mridangam-style tabla and cymbals.
st.tabla(SC.bazaar[0], SC.chariot[0] - 0.2, 116, 0.75);
talam(SC.bazaar[0], SC.chariot[0] - 0.2, 116, 0.035);
{ const bt = 60 / 116, phr = [[0, 0, 1], [1, 1, 1], [2, 2, 1], [3, 4, 1], [4, 5, 2], [6, 4, 1], [7, 2, 1], [8, 4, 1], [9, 5, 1], [10, 7, 2], [12, 5, 1], [13, 4, 1], [14, 2, 2]];
  for (let t = SC.bazaar[0] + 0.2, rep = 0; t < SC.chariot[0] - 1; t += 16 * bt, rep++) veena(t, 116, phr.map(([b, d, l]) => [b, d + (rep % 2 ? 2 : 0), l]), MOHANAM, 0.06); }
st.tanpura(SC.bazaar[0], SC.pillars[1], 0.03);
// Chariot: awe; a slow rising phrase.
tune(SC.chariot[0] + 0.3, 72, [[0, 0, 2], [2, 2, 1], [3, 4, 2], [5, 7, 3]], MOHANAM, 0.07);
st.shimmer(SC.chariot[0] + 2.0, 0.05);
st.melody(SC.chariot[0] + 5.0, 90, [[0, 4, 1], [1, 5, 1], [2, 7, 2], [4, 5, 1], [5, 4, 1], [6, 2, 2]], MOHANAM, 0.075);
// Pillars: quiet, then the five notes ring out, then the clunk.
st.note(SC.pillars[0] + 0.2, SA - 24, 6.5, 0.035);
[0, 2, 4, 7, 9].forEach((d, i) => pillarNote(B.taps[i], SA + 12 + d, 0.24));
st.thud(B.paesTap + 0.02, 0.25); st.tone(B.paesTap, 180, 0.12, 0.12);
st.melody(B.giggle, 140, [[0, 7, 0.5], [0.5, 5, 0.5], [1, 4, 0.5], [1.5, 2, 0.5], [2, 0, 1]], MOHANAM, 0.05);
// Festival night: Kalyani, drums and cymbals, the nadaswaram leading a procession.
st.tanpura(SC.festival[0], DUR, 0.035);
st.tabla(SC.festival[0] + 0.3, SC.epi[0] - 0.3, 104, 0.85);
talam(SC.festival[0] + 0.3, SC.epi[0] - 0.3, 104, 0.04);
{ const bt = 60 / 104, phr = [[0, 4, 1], [1, 5, 1], [2, 6, 2], [4, 7, 1], [5, 6, 1], [6, 5, 1], [7, 4, 1], [8, 3, 2], [10, 4, 1], [11, 2, 1], [12, 0, 4]];
  for (let t = SC.festival[0] + 0.5, rep = 0; t < SC.epi[0] - 2; t += 16 * bt, rep++) tune(t, 104, phr.map(([b, d, l]) => [b, d + (rep % 2 ? 2 : 0), l]), KALYANI, 0.045); }
cheer(B.kingUp, 3.0, 0.08); st.shimmer(B.kingUp + 0.3, 0.06);
cheer(B.wear, 3.2, 0.09); st.shimmer(B.wear + 0.1, 0.06, SA + 24);
for (let t = SC.festival[0]; t < SC.epi[0]; t += 0.7) st.bells(t + nz() * 0.3, 0.02);
// Epilogue: slow, a veena line, the final chord.
[[0, 0, 1.5], [1.6, 2, 1.0], [2.7, 4, 1.4], [4.2, 7, 2.2], [6.6, 5, 1.2], [7.9, 4, 2.4]].forEach(([d, x, l]) => st.bansuri(SC.epi[0] + 0.4 + d, deg(MOHANAM, x), l, 0.07));
for (const m of [SA - 24, SA - 12, SA - 5, SA, SA + 4, SA + 9]) st.sitar(B.endCard, m, 0.05, 0.5, 2.4);
st.bansuri(B.endCard + 0.2, SA + 12, 1.4, 0.06);

// ---- effects and ambience -------------------------------------------------------------------------------------------------
st.birds(0.4, 8, 0.022, 1); st.river(0, SC.gate[0] + 0.4, 0.045);
st.wind(SC.gate[0], SC.bazaar[0], 0.02);
for (let t = SC.gate[0]; t < B.arrive; t += 0.5) st.tone(t, 120, 0.05, 0.06);
for (let t = B.kamalaIn; t < 13.4; t += 0.16) st.tone(t, 160, 0.04, 0.06);
st.ambience(SC.bazaar[0], SC.chariot[0], 0.03);
neigh(19.0, 0.07); neigh(26.8, 0.06); trumpet(27.6, 0.12);
for (let t = SC.bazaar[0]; t < SC.chariot[0]; t += 0.45) st.tone(t, 110, 0.05, 0.05);
for (let t = B.write; t < 26.8; t += 0.2) st.brush(t, 0.1, 0.035);
st.birds(SC.chariot[0], SC.pillars[0], 0.018, 4);
st.snap(B.touch, 0.08);
for (const t of [44.2, 44.6]) st.tone(t, 300, 0.08, 0.04);
st.sweep(B.jaw, 900, 400, 0.4, 0.04);
st.ambience(SC.festival[0], SC.epi[0], 0.03);
for (let t = B.pen; t < 67.4; t += 0.2) st.brush(t, 0.1, 0.035);
for (let t = 73.6; t < 75.6; t += 0.2) st.brush(t, 0.1, 0.035);
st.birds(SC.epi[0], DUR, 0.018, 9); st.wind(SC.epi[0], DUR, 0.025);

const { peak, clip } = st.mixdown(path.join(ROOT, 'out', 'hampi-voice.wav'), path.join(ROOT, 'out', 'cartoon-hampi.wav'));
console.log(`wrote out/cartoon-hampi.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
void FX; void DR; void VO;
