// Soundtrack for "The Lord of the South": a martial South Indian score (nadaswaram
// fanfares in Hamsadhwani, nagara war drums, tanpura, sitar, bansuri), elephants,
// the river, crowds, chisel taps, and the dialogue on top.
//   node tools/audio-pulakeshi.mjs -> out/cartoon-pulakeshi.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'pulakeshi.beats.json'), 'utf8'));
const TM = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'pulakeshi.timing.json'), 'utf8'));
const DUR = B.duration, st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, lpa, SA, hz, deg } = st;
const SC = Object.fromEntries(B.scenes.map(([id, t0], i) => [id, [t0, i + 1 < B.scenes.length ? B.scenes[i + 1][1] : DUR]]));
const VO = Object.fromEntries(TM.lines.map((l) => [l.id, l]));
const HAMSA = [0, 2, 4, 7, 11], KAFI = [0, 2, 3, 5, 7, 9, 10], BHAIRAVI = [0, 1, 3, 5, 7, 8, 10];

// ---- extra instruments --------------------------------------------------------------------------------------
// Nadaswaram: a loud double reed: bright saw, nasal formant, vibrato, a slide into each note.
function nadas(t0, m, d, gain = 0.05, slide = 1) {
  const s = S(t0), n = S(d), f = hz(m), bp = new BP(1400, 1.6), lp = new LP(); let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, e = Math.min(1, t / 0.04) * Math.min(1, (d - t) / 0.1);
    const bend = t < 0.08 ? 2 ** (-slide * (1 - t / 0.08) / 12) : 1;
    ph = (ph + f * bend * (1 + 0.009 * Math.sin(TAU * 6 * t) * Math.min(1, t * 2)) / SR) % 1;
    const saw = ph * 2 - 1, v = (lp.run(saw, 0.35) * 0.6 + bp.run(saw) * 1.4) * e * gain;
    put(MUS, s + k, v * 0.95, v);
  }
}
function tune(t0, bpm, notes, scale, gain, base = SA, inst = nadas) { const bt = 60 / bpm; for (const [b, dg, len] of notes) inst(t0 + b * bt, deg(scale, dg, base), len * bt * 0.95, gain); }
// Nagara: a big kettle drum, a low boom with a skin slap.
function nagara(t, g = 0.4) {
  const s = S(t), n = S(0.7); let ph = 0; const lp = new LP();
  for (let j = 0; j < n; j++) { const u = j / SR; ph += TAU * (62 - 18 * Math.min(1, u / 0.3)) / SR; put(DR, s + j, (Math.sin(ph) * Math.exp(-u / 0.25) + lp.run(n2(), 0.08) * Math.exp(-u / 0.05) * 1.5) * g); }
}
const slap = (t, g = 0.2) => { const s = S(t); for (let j = 0; j < SR * 0.06; j++) put(DR, s + j, n2() * g * Math.exp(-j / 350)); };
function drums(t0, t1, bpm, g = 1, pat = 'x.x.xx.x') { const bt = 60 / bpm / 2; for (let i = 0, t = t0; t < t1; i++, t += bt) { const c = pat[i % pat.length]; if (c === 'x') nagara(t, 0.38 * g * (i % 8 === 0 ? 1.2 : 1)); else if (c === 's') slap(t, 0.2 * g); } }
function trumpet(t, g = 0.22, up = 1) {
  // An elephant: a rough rising blare with a noisy edge.
  const s = S(t), n = S(1.0), bp = new BP(900, 1.2); let ph = 0;
  for (let j = 0; j < n; j++) { const u = j / n, f = 380 * (1 + up * 0.8 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5)) * (1 + 0.04 * Math.sin(TAU * 28 * j / SR)); ph = (ph + f / SR) % 1; const src = (ph * 2 - 1) + n2() * 0.35 + (ph < 0.5 ? 0.6 : -0.6); const v = bp.run(src) * g * Math.min(1, u * 12) * (1 - u) ** 0.7 * 1.6; put(FX, s + j, v, v * 0.9); }
}
function cheer(t0, d, g = 0.08) { const lp = new LP(); for (let i = S(t0); i < S(t0 + d) && i < st.N; i++) { const u = (i - S(t0)) / SR, e = Math.min(1, u / 0.3, (d - u) / 0.6); put(FX, i, lp.run(n2(), 0.25) * g * 3 * e * (0.8 + 0.2 * Math.sin(u * 17))); } st.ambience(t0, t0 + d, g * 0.6); }
function chisel(t0, t1, every = 0.45, g = 0.1) { for (let t = t0; t < t1; t += every) { st.tone(t, 2600 + nz() * 600, 0.04, g); st.snap(t, g * 0.6); st.tone(t + 0.01, 700, 0.05, g * 0.5); } }

// ---- score ----------------------------------------------------------------------------------------------------
// Opening: tanpura, a bansuri alap in Hamsadhwani, a shimmer under the title.
st.tanpura(0.3, SC.harsha[0], 0.042);
[[1.0, 4, 1.4], [2.6, 3, 0.8], [3.5, 4, 0.6], [4.3, 5, 1.6], [6.2, 4, 1.8]].forEach(([t, d, l]) => st.bansuri(t, deg(HAMSA, d), l, 0.075));
st.shimmer(1.8, 0.07);
// Temple: soft sitar, chisel taps, then the rising glow into the story.
st.melody(8.9, 84, [[0, 5, 1], [1, 4, 1], [2, 3, 2], [4, 4, 1], [5, 5, 1], [6, 7, 2], [8, 5, 2], [10, 4, 2]], HAMSA, 0.05);
chisel(8.7, B.glowUp, 0.45, 0.09);
st.whoosh(B.glowUp, 2.4, 0.1, 300, 2400); st.sweep(B.glowUp + 0.4, 300, 1200, 2.0, 0.04);
st.shimmer(B.flash - 0.1, 0.09); st.shimmer(B.flash + 0.3, 0.06, SA + 24);
// Harsha's march: nagara on the beat, a stately nadaswaram tune in Kafi, elephants' feet.
drums(SC.harsha[0] + 0.2, SC.map[0], 84, 0.9, 'x...x.s.');
st.tanpura(SC.harsha[0], SC.narmada[0] + 0.5, 0.035, SA - 12);
tune(SC.harsha[0] + 0.4, 84, [[0, 0, 1], [1, 2, 1], [2, 3, 2], [4, 4, 1], [5, 3, 1], [6, 2, 2]], KAFI, 0.05);
tune(SC.harsha[0] + 0.4 + 8 * 60 / 84, 84, [[0, 4, 1], [1, 5, 1], [2, 4, 1], [3, 3, 1]], KAFI, 0.05);
for (let t = SC.harsha[0]; t < SC.map[0]; t += 60 / 84) st.tone(t, 55, 0.2, 0.12);
trumpet(21.0, 0.2); trumpet(24.4, 0.14);
// Map: a low drone, the arrow's sweep, a sting for the south.
st.note(SC.map[0] + 0.1, SA - 24, 4, 0.03);
st.sweep(B.mapArrow, 200, 500, 1.6, 0.05);
for (const m of [SA - 12, SA - 5, SA, SA + 4]) st.sitar(B.mapSouth, m, 0.05, 0.5, 1.8);
// The Narmada: water, tension, the king's line, a hit.
st.river(SC.narmada[0], SC.joy[0], 0.05);
st.tanpura(SC.narmada[0], SC.battle[1], 0.03, SA - 12);
for (let t = SC.narmada[0] + 0.4, gap = 1.2; t < B.pushIn; t += gap, gap *= 0.93) nagara(t, 0.22);
st.sweep(B.pushIn, 200, 700, VO.nostep.t0 - B.pushIn, 0.04);
st.BOLS.dha(VO.nostep.t0 + VO.nostep.dur + 0.1, 1.6); nagara(VO.nostep.t0 + VO.nostep.dur + 0.1, 0.5);
for (const m of [SA - 12, SA - 5, SA, SA + 7]) st.sitar(VO.nostep.t0 + VO.nostep.dur + 0.1, m, 0.06, 0.5, 2.2);
tune(37.6, 100, [[0, 0, 0.5], [0.5, 1, 0.5], [1, 2, 1], [2, 3, 2]], HAMSA, 0.045);
// The battle: fast war drums, elephants trumpeting, splashes; a sad fall-off for Harsha's face.
drums(B.drums, B.harshaFace - 0.3, 150, 1.1, 'x.xsx.xs');
st.tabla(B.drums, B.harshaFace - 0.3, 150, 0.7);
tune(B.drums + 0.2, 150, [[0, 4, 0.5], [0.5, 3, 0.5], [1, 4, 1], [2, 2, 0.5], [2.5, 3, 0.5], [3, 4, 1], [4, 4, 0.5], [4.5, 3, 0.5], [5, 1, 1], [6, 0, 2]], HAMSA, 0.05);
tune(B.drums + 0.2 + 8 * 60 / 150, 150, [[0, 5, 0.5], [0.5, 4, 0.5], [1, 5, 1], [2, 7, 2], [4, 5, 1], [5, 4, 1], [6, 3, 2]], HAMSA, 0.05);
[41.2, 43.0].forEach((t) => trumpet(t, 0.22));
B.falls.forEach((t, i) => { trumpet(t - 0.05, 0.26, 1.2); st.splashSnd(t + 0.2, 0.35); st.thud(t + 0.1, 0.3); void i; });
for (let t = B.charge; t < B.falls[2]; t += 0.24) st.tone(t, 50, 0.18, 0.1);
cheer(B.retreat + 0.6, 2.8, 0.07);
st.note(B.harshaFace, SA - 12, 4, 0.03);
// Joy melts: a sad bansuri in Bhairavi, falling santoor notes.
[[0, 4, 1.2], [1.3, 3, 0.8], [2.2, 2, 0.8], [3.1, 1, 1.4]].forEach(([d, x, l]) => st.bansuri(SC.joy[0] + 0.3 + d, deg(BHAIRAVI, x), l, 0.07));
for (let i = 0; i < 6; i++) st.santoor(B.melt + i * 0.28, deg(BHAIRAVI, 9 - i), 0.05, 0.3 + i * 0.08);
// The laugh: light and quick.
st.tabla(SC.laugh[0] + 0.2, SC.lord[0] - 0.2, 110, 0.6);
st.melody(SC.laugh[0] + 0.3, 110, [[0, 4, 0.5], [0.5, 5, 0.5], [1, 7, 1], [2, 5, 0.5], [2.5, 4, 0.5], [3, 2, 1], [4, 4, 2]], HAMSA, 0.055);
// Lord of the South: a fanfare, drums, bells, the crowd.
drums(SC.lord[0], SC.china[0], 120, 0.9, 'x.x.xsx.');
tune(SC.lord[0] + 0.2, 120, [[0, 0, 0.5], [0.5, 2, 0.5], [1, 4, 1], [2, 5, 1], [3, 7, 2], [5, 5, 0.5], [5.5, 7, 0.5], [6, 9, 2]], HAMSA, 0.06);
cheer(SC.lord[0] + 0.3, 4.3, 0.08); for (let t = SC.lord[0] + 0.5; t < SC.china[0]; t += 0.5) st.bells(t, 0.03);
st.shimmer(B.capLord, 0.06);
// China: a calm travelling tune; distant drilling; a brush on paper.
st.tanpura(SC.china[0], DUR, 0.035);
st.tabla(SC.china[0] + 0.3, SC.name[0] - 0.2, 96, 0.45);
st.melody(SC.china[0] + 0.4, 96, [[0, 0, 1], [1, 2, 1], [2, 4, 2], [4, 3, 1], [5, 4, 1], [6, 5, 2], [8, 4, 1], [9, 2, 1], [10, 0, 2]], HAMSA, 0.05);
for (let t = SC.china[0] + 0.5; t < SC.name[0]; t += 0.5) st.tone(t, 90, 0.06, 0.04);
for (let t = B.write; t < SC.name[0]; t += 0.22) st.brush(t, 0.12, 0.04);
// Name: chisel again, a comic bend on the eye roll, laughter music.
chisel(SC.name[0] + 0.2, B.eyeRoll - 0.2, 0.45, 0.08);
st.melody(SC.name[0] + 0.3, 90, [[0, 4, 1], [1, 3, 1], [2, 4, 1], [3, 5, 1], [4, 7, 2]], HAMSA, 0.05);
st.bayan(B.eyeRoll + 0.1, 0.35, 2.5); st.sweep(B.eyeRoll + 0.2, 700, 300, 0.35, 0.05);
st.melody(B.bothLaugh, 120, [[0, 7, 0.5], [0.5, 5, 0.5], [1, 4, 0.5], [1.5, 5, 0.5], [2, 7, 1]], HAMSA, 0.055);
// Epilogue: slow bansuri, a final chord under the title.
[[0, 0, 1.5], [1.6, 2, 1.0], [2.7, 4, 1.4], [4.2, 7, 2.2]].forEach(([d, x, l]) => st.bansuri(SC.epi[0] + 0.4 + d, deg(HAMSA, x), l, 0.075));
for (const m of [SA - 24, SA - 12, SA - 5, SA, SA + 4, SA + 11]) st.sitar(B.endCard, m, 0.05, 0.5, 2.4);
st.bansuri(B.endCard + 0.2, SA + 12, 1.4, 0.06);
// Ambience.
st.birds(0.4, 8.4, 0.022, 1); st.wind(0, SC.temple[0] + 0.5, 0.03); st.birds(SC.temple[0], SC.dive[0], 0.015, 2);
st.ambience(SC.harsha[0], SC.map[0], 0.02);
st.birds(SC.epi[0], DUR, 0.018, 9); st.wind(SC.epi[0], DUR, 0.025);

const { peak, clip } = st.mixdown(path.join(ROOT, 'out', 'pulakeshi-voice.wav'), path.join(ROOT, 'out', 'cartoon-pulakeshi.wav'));
console.log(`wrote out/cartoon-pulakeshi.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
void FX; void DR; void lpa;
