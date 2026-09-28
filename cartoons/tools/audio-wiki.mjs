// Soundtrack for "Erased": silence and page-hum while it is a plain article, then an 8-bit chiptune
// that builds with every erased block (bass, drums, arpeggio, lead), and the sounds of the gag:
// footsteps, the eraser drawn like a sword, squeaky scrubs, crumbs, the pixel wave, hops, the tank,
// a shell whistle, the boom and the confetti. Times match src/wiki.js.
//   node tools/audio-wiki.mjs -> out/cartoon-wiki.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DUR = 30, st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, lpa, hz } = st;

// The picture's schedule (copied from src/wiki.js).
const BLOCKS = [[5.4, 7.8, 3], [7.8, 9.6, 3], [9.6, 11.4, 3], [11.4, 13.2, 3], [13.2, 15.2, 6], [15.2, 16.3, 2], [16.3, 17.8, 3]];
const T_TANK_IN = 18.4, T_LAND = 20.6, T_GO = 21.0, T_OFF = 25.0, T_FIRE = 22.4, T_BOOM = 22.9;

// ---- 8-bit voices ---------------------------------------------------------------------------------------
function sq(t0, m, d, g = 0.05, duty = 0.5, pan = 0.5, buf = MUS, slide = 0) {
  const s = S(t0), n = S(d), f0 = hz(m); let ph = 0;
  for (let j = 0; j < n; j++) {
    const u = j / n, e = Math.min(1, j / 60) * (1 - u) ** 0.6, f = f0 * (1 + slide * u);
    ph = (ph + f / SR) % 1; const v = (ph < duty ? 1 : -1) * g * e;
    put(buf, s + j, v * (1 - pan) * 2, v * pan * 2);
  }
}
function tri(t0, m, d, g = 0.09) { const s = S(t0), n = S(d), f = hz(m); let ph = 0; for (let j = 0; j < n; j++) { ph = (ph + f / SR) % 1; const v = (Math.abs(ph * 4 - 2) - 1) * g * Math.min(1, j / 50) * (1 - j / n) ** 0.5; put(MUS, s + j, v); } }
function noiseHit(t0, d, g, fc, buf = DR) { const s = S(t0), n = S(d), lp = new LP(); for (let j = 0; j < n; j++) { const u = j / n, v = lp.run(n2(), lpa(fc)) * g * (1 - u) ** 2.2; put(buf, s + j, v); } }
const kick = (t) => { st.sweep(t, 150, 45, 0.12, 0.2); };
const snare = (t) => { noiseHit(t, 0.12, 0.18, 6000); st.tone(t, 190, 0.08, 0.06); };
const hat = (t, g = 0.06) => noiseHit(t, 0.035, g, 9000);

// ---- the plain page ---------------------------------------------------------------------------------------
{ for (let i = S(0.4); i < S(6); i++) { const t = i / SR; put(FX, i, Math.sin(TAU * 120 * t) * 0.012 + Math.sin(TAU * 240 * t) * 0.006); } }
st.tone(0.5, 1320, 0.4, 0.09); st.tone(0.58, 1760, 0.5, 0.07);          // page load chime
// Footsteps as Clawd trots in (2.0 - 4.0).
for (let t = 2.05; t < 4.0; t += 0.16) { st.tone(t, 220 + nz() * 30, 0.05, 0.16); st.snap(t, 0.08); }
// The eraser is drawn like a sword (4.0 - 5.2), then held up.
st.whoosh(4.0, 0.9, 0.09, 300, 3200); st.sweep(4.55, 900, 3400, 0.4, 0.07); st.tone(5.0, 1568, 0.3, 0.05); st.tone(5.08, 2093, 0.3, 0.04);
sq(5.1, 84, 0.08, 0.03); sq(5.2, 91, 0.12, 0.03);

// ---- the music, growing with every block --------------------------------------------------------------
const BEAT = 0.4, ROOT_M = 36;
const chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];              // C  G  Am  F
const bassRoot = [0, -5, -3, -7];
for (let bar = 0, t0 = 5.4; t0 < 25.0; bar++, t0 += BEAT * 4) {
  const ch = chords[bar % 4], br = bassRoot[bar % 4], stage = t0 < 9.6 ? 1 : t0 < 13.2 ? 2 : t0 < 17.8 ? 3 : 4;
  for (let k = 0; k < 8; k++) {
    const t = t0 + k * BEAT / 2;
    tri(t, ROOT_M + 12 + br + (k % 2 ? 12 : 0), BEAT / 2 * 0.9, 0.11);
    if (stage >= 2) sq(t, ROOT_M + 36 + ch[k % 3] + (k >= 4 ? 12 : 0), BEAT / 2 * 0.7, 0.028, 0.25, 0.3 + (k % 3) * 0.2);
    if (stage >= 3 && k % 2 === 0) hat(t);
  }
  if (stage >= 1) { kick(t0); kick(t0 + BEAT * 2); snare(t0 + BEAT); snare(t0 + BEAT * 3); }
  if (stage >= 3) { hat(t0 + BEAT * 0.5, 0.05); hat(t0 + BEAT * 2.5, 0.05); kick(t0 + BEAT * 2.5); }
  if (stage >= 3) {
    const lead = [[0, 4, 7, 4, 9, 7, 4, 2], [2, 5, 9, 5, 11, 9, 5, 2], [4, 7, 12, 7, 9, 7, 4, 0], [5, 9, 12, 9, 7, 5, 4, 0]][bar % 4];
    lead.forEach((d, k) => sq(t0 + k * BEAT / 2, ROOT_M + 48 + d, BEAT / 2 * 0.8, 0.04, 0.5, 0.6));
  }
}

// ---- the erasing: squeaky scrubs and a crumb of pop per block ----------------------------------------
for (const [ta, tb, n] of BLOCKS) {
  const per = (tb - ta) / n;
  for (let k = 0; k < n; k++) {
    const t = ta + k * per, s = S(t), len = S(per), bp = new BP(1800, 2.2); let ph = 0;
    for (let j = 0; j < len; j++) {
      const u = j / len, f = k % 2 ? 2600 - 700 * u : 1900 + 700 * u;
      if (j % 48 === 0) bp.set(f, 2.2);
      ph += TAU * (f * 0.5) / SR;
      const v = (bp.run(n2()) * 0.55 + Math.sin(ph) * 0.12) * 0.09 * Math.min(1, u * 12, (1 - u) * 12) * (0.7 + 0.3 * Math.sin(j / 1400));
      put(FX, s + j, v * 0.9, v);
    }
    for (let c = 0; c < 9; c++) st.tone(t + nz() * per, 2400 + nz() * 1800, 0.02, 0.02, nz());
  }
  [72, 76, 79, 84].forEach((m, i) => sq(tb + i * 0.06, m, 0.12, 0.05, 0.25, 0.3 + i * 0.13, FX));
}
// The pixel wave (17.6 - 20.2): rising glitch crackle.
st.beadSpill(17.6, 2.6, 0.05); st.whoosh(17.6, 2.6, 0.06, 200, 4000);
for (let i = 0; i < 26; i++) sq(17.6 + i * 0.1, 60 + (i * 7) % 24, 0.05, 0.03, 0.125, nz(), FX);

// ---- the ride -------------------------------------------------------------------------------------------------
// Hops to the tank: boings; a landing thud.
[18.6, 19.4, 20.1].forEach((t) => { st.sweep(t, 300, 900, 0.16, 0.08); st.sweep(t + 0.14, 900, 300, 0.14, 0.06); st.thud(t + 0.28, 0.1); });
st.thud(T_LAND, 0.32); st.tone(T_LAND, 260, 0.2, 0.06);
// Tank engine: a rough saw with a chug, from its entrance to its exit.
{ const s0 = S(T_TANK_IN), s1 = S(T_OFF + 0.5), lp = new LP(); let ph = 0;
  for (let i = s0; i < s1; i++) {
    const t = i / SR, arrive = Math.min(1, (t - T_TANK_IN) / 0.5), gone = Math.min(1, (T_OFF + 0.5 - t) / 0.8), gain = 0.07 * arrive * gone * (t < T_GO ? (t < T_LAND ? 0.7 : 0.9) : 1);
    ph = (ph + (58 + 20 * Math.sin(t * 5)) / SR) % 1;
    const chug = 0.6 + 0.4 * Math.sin(t * 34);
    put(FX, i, lp.run((ph * 2 - 1) * 0.8 + n2() * 0.3, lpa(340)) * gain * chug * 2.4);
  } }
st.thud(T_GO, 0.25); st.whoosh(T_GO, 0.6, 0.05, 150, 700);
// Shell: a muzzle bang, a whistle down, a boom.
st.thud(T_FIRE, 0.4); st.snap(T_FIRE, 0.25); st.sweep(T_FIRE + 0.05, 2600, 700, 0.45, 0.06);
for (let k = 0; k < 4; k++) st.thud(T_BOOM + k * 0.05, 0.55 - k * 0.1);
noiseHit(T_BOOM, 1.2, 0.5, 2600, FX); noiseHit(T_BOOM, 0.4, 0.5, 8000, FX);
for (let k = 0; k < 3; k++) sq(T_BOOM + 0.05, 30 - k * 4, 0.35, 0.09, 0.5, 0.5, FX, -0.5);
// Confetti: a glittering fall and a party horn.
st.beadSpill(T_BOOM + 0.1, 2.4, 0.07); st.shimmer(T_BOOM + 0.3, 0.05, 84);
[[0, 72], [0.09, 76], [0.18, 79], [0.27, 84], [0.5, 79], [0.59, 84], [0.75, 88]].forEach(([d, m]) => sq(T_BOOM + 0.5 + d, m, 0.14, 0.05, 0.25, 0.5, FX));
// The exit: engine fades, then the end card's soft bells and a final major chord.
[0, 4, 7, 12, 16].forEach((d, i) => { const t = 26.3 + i * 0.12; st.tone(t, hz(72 + d), 1.4, 0.07, 0.3 + i * 0.1); });
[0, 7, 12, 16, 19].forEach((d) => sq(28.6, 60 + d, 1.2, 0.06, 0.5, 0.5, MUS));

// Silent "voice" track: the mix wants one, this film has none.
const vo = Buffer.alloc(44 + 2 * 8000 * DUR);
vo.write('RIFF', 0); vo.writeUInt32LE(vo.length - 8, 4); vo.write('WAVE', 8); vo.write('fmt ', 12); vo.writeUInt32LE(16, 16); vo.writeUInt16LE(1, 20); vo.writeUInt16LE(1, 22); vo.writeUInt32LE(8000, 24); vo.writeUInt32LE(16000, 28); vo.writeUInt16LE(2, 32); vo.writeUInt16LE(16, 34); vo.write('data', 36); vo.writeUInt32LE(vo.length - 44, 40);
fs.writeFileSync(path.join(ROOT, 'out', 'wiki-silence.wav'), vo);
const { peak, clip } = st.mixdown(path.join(ROOT, 'out', 'wiki-silence.wav'), path.join(ROOT, 'out', 'cartoon-wiki.wav'), { musRev: 0.12, drRev: 0.05 });
console.log(`wrote out/cartoon-wiki.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${clip} samples > 0.95`);
