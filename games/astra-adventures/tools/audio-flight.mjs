// Soundtrack for a recorded flight: rebuilds the game's own sound design offline from the flight log that
// tools/pilot.mjs writes (per-frame speed and boost, plus every pass, hit, shot and radio call), so the audio
// lines up with the picture. The browser's WebAudio output can't be captured headless; this re-creates it.
//   node tools/audio-flight.mjs out/astra-flight-video.json out/astra-flight.wav
import fs from 'node:fs';
import { studio } from '../../../cartoons/tools/lib/studio.mjs';

const [, , logPath, outPath] = process.argv;
const L = JSON.parse(fs.readFileSync(logPath, 'utf8'));
const FPS = 30, DUR = L.frames.length / FPS + 0.5;
const st = studio(DUR);
const { SR, TAU, FX, MUS, put, S, n2, LP, BP, lpa } = st;

// sim time -> video time (the title screen and the pause don't advance sim time)
const simT = L.frames.map((f) => f.t);
const launchF = simT.findIndex((t) => t > 0);
const toVideo = (t) => { let i = launchF; while (i < simT.length - 1 && simT[i] < t) i++; return i / FPS; };
const pausedF = (() => { const out = new Set(); for (let i = 1; i < simT.length; i++) if (i > launchF && simT[i] === simT[i - 1]) out.add(i); return out; })();

// ---- engine: saws + triangle through a lowpass that opens with speed; a noise band for the burners
{
  const ph = [0, 0, 0], lp = [new LP(), new LP()], bp = new BP(500, 0.6); let g = 0, gb = 0, f = 0, sp = 0, bv = 0;
  for (let i = 0; i < st.N; i++) {
    const t = i / SR, fi = Math.min(L.frames.length - 1, Math.floor(t * FPS)), fr = L.frames[fi];
    const flying = fi >= launchF, paused = pausedF.has(fi);
    sp += ((flying ? fr.speed : 0) - sp) * 0.0004; bv += ((fr.boosting ? 1 : 0) - bv) * 0.0002;
    const on = !flying ? 0.45 : paused ? 0.15 : 1;
    g += ((0.05 + (0.3 + bv * 0.7) * 0.07) * on - g) * 0.0006; gb += ((0.006 + bv * 0.05) * on - gb) * 0.0006;
    const fr0 = 38 + sp * 0.3, frq = [fr0, 57 + sp * 0.45, 19 + sp * 0.15];
    let v = 0; for (let k = 0; k < 3; k++) { ph[k] = (ph[k] + frq[k] / SR) % 1; v += k === 2 ? (Math.abs(ph[k] * 4 - 2) - 1) : ph[k] * 2 - 1; }
    const fc = 160 + sp * 6 + bv * 900; f += (fc - f) * 0.001;
    const e = lp[1].run(lp[0].run(v / 3, lpa(f)), lpa(f * 1.4)) * g * 5;
    if (i % 64 === 0) bp.set(350 + sp * 10, 0.6);
    const n = bp.run(n2()) * gb * 3.2;
    put(MUS, i, e + n, e * 0.96 + n);
  }
}
// ---- one-shots
function whoosh(t, pan, k) {
  const s = S(t), n = S(0.9), bp = new BP(2600 + k * 1800, 1.3);
  for (let j = 0; j < n; j++) {
    const u = j / SR; if (j % 32 === 0) bp.set((2600 + k * 1800) * Math.pow(380 / (2600 + k * 1800), Math.min(1, u / 0.7)), 1.3);
    const env = u < 0.09 ? u / 0.09 : Math.exp(-(u - 0.09) * 6);
    const v = bp.run(n2()) * (0.25 + k * 0.5) * env * 1.6;
    const p = Math.max(-1, Math.min(1, pan * 0.85 * (1 - u * 0.8)));                      // the rock sweeps from the side to behind
    put(FX, s + j, v * (1 - p) * 0.9, v * (1 + p) * 0.9);
  }
  st.sweep(t, 520 + k * 300, 140, 0.65, 0.05 + k * 0.08);
}
function thud(t, k) { st.thud(t, 0.2 + k * 0.5); const s = S(t), lp = new LP(); for (let j = 0; j < SR * 0.35; j++) put(FX, s + j, lp.run(n2(), lpa(1400)) * (0.35 * k + 0.1) * Math.exp(-j / (SR * 0.08))); }
function pew(t, pan) { const s = S(t), n = S(0.1); let ph = 0; for (let j = 0; j < n; j++) { const u = j / n; ph += TAU * (1500 * Math.pow(260 / 1500, u)) / SR; const v = (Math.sin(ph) > 0 ? 1 : -1) * 0.045 * (1 - u); put(FX, s + j, v * (1 - pan * 0.5), v * (1 + pan * 0.5)); } }
function blip(t) { [880, 1320].forEach((f, i) => st.tone(t + i * 0.07, f, 0.08, 0.05, 0.35)); }
function boostOn(t) { st.whoosh(t, 0.7, 0.2, 300, 2200); }
function chip(t) { const s = S(t), bp = new BP(3500, 1); for (let j = 0; j < SR * 0.12; j++) put(FX, s + j, bp.run(n2()) * 0.08 * Math.exp(-j / (SR * 0.03))); }
for (const e of L.events) {
  const t = toVideo(e.t);
  if (e.type === 'pass') whoosh(t, e.side || 0, e.k);
  else if (e.type === 'hit') thud(t, Math.min(1, e.impact / 30));
  else if (e.type === 'shot') pew(t, e.side);
  else if (e.type === 'radio') blip(t);
  else if (e.type === 'boostOn') boostOn(t);
  else if (e.type === 'chip') chip(t);
  else if (e.type === 'launch') st.whoosh(t, 1.4, 0.12, 120, 1400);
}
// a faint bed of space hiss so silence isn't digital
{ const lp = new LP(); for (let i = 0; i < st.N; i++) put(FX, i, lp.run(n2(), lpa(900)) * 0.006); }

// Silent voice track: this mix has no narration.
const tmp = outPath.replace(/\.wav$/, '-silence.wav'), vo = Buffer.alloc(44 + 2 * 8000 * Math.ceil(DUR));
vo.write('RIFF', 0); vo.writeUInt32LE(vo.length - 8, 4); vo.write('WAVE', 8); vo.write('fmt ', 12); vo.writeUInt32LE(16, 16); vo.writeUInt16LE(1, 20); vo.writeUInt16LE(1, 22); vo.writeUInt32LE(8000, 24); vo.writeUInt32LE(16000, 28); vo.writeUInt16LE(2, 32); vo.writeUInt16LE(16, 34); vo.write('data', 36); vo.writeUInt32LE(vo.length - 44, 40);
fs.writeFileSync(tmp, vo);
const { peak, clip } = st.mixdown(tmp, outPath, { musRev: 0.05, drRev: 0.05 });
fs.unlinkSync(tmp);
console.log(`wrote ${outPath}: ${DUR.toFixed(1)} s, peak ${peak.toFixed(2)}, ${clip} clipped; ${L.events.filter((e) => e.type === 'pass').length} passes, ${L.events.filter((e) => e.type === 'hit').length} hits`);
