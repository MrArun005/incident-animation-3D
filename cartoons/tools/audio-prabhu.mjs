// Score for "Prabhu Deva: the dance through time" (src/prabhu.js). Original music, no words, on the 120 bpm
// grid of stories/prabhu.beats.json. One hook in raag Bhupali travels through the ages with the panels:
// tanpura and bansuri at the rock shelters, temple bells for the bronze, sitar and tabla through the courts and
// the folk panels, a cranky silent-film piano, then a 90s filmi drum machine and synth bass, truck horns,
// synthwave in the neon, a chiptune on the phone, and a modern beat with tabla for the reel.
//   node tools/audio-prabhu.mjs -> out/cartoon-prabhu.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'stories', 'prabhu.beats.json'), 'utf8'));
const DUR = B.duration, BT = 60 / B.bpm, st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, lpa, hz, rng, SA, BHUP, deg } = st;
const PT = (k) => B.intro + k * B.panel;                 // panel k starts
const IDX = Object.fromEntries(B.panels.map((id, k) => [id, k]));
const at = (id, beat = 0) => PT(IDX[id]) + beat * BT;
const END = PT(B.panels.length);

// ---- extra instruments: a drum machine, synth bass and leads -------------------------------------------------------
function kick(t, g = 0.5) { const s = S(t), n = S(0.35); let ph = 0; for (let j = 0; j < n; j++) { const u = j / SR; ph += TAU * (45 + 110 * Math.exp(-u * 28)) / SR; put(DR, s + j, Math.sin(ph) * Math.exp(-u * 9) * g); } }
function snare(t, g = 0.22) { const s = S(t), n = S(0.22), bp = new BP(1800, 0.7); for (let j = 0; j < n; j++) { const u = j / SR; put(DR, s + j, (bp.run(n2()) * 1.6 + Math.sin(TAU * 190 * u) * 0.4 * Math.exp(-u * 30)) * Math.exp(-u * 16) * g); } }
function clap(t, g = 0.2) { for (const d of [0, 0.011, 0.022]) { const s = S(t + d), bp = new BP(1400, 1.2); for (let j = 0; j < SR * 0.08; j++) put(DR, s + j, bp.run(n2()) * Math.exp(-j / (SR * 0.012)) * g * 1.5); } }
function hat(t, g = 0.06, open = false) { const s = S(t), n = S(open ? 0.18 : 0.04); let p = 0; for (let j = 0; j < n; j++) { const x = n2(); const v = x - p; p = x; put(DR, s + j, v * Math.exp(-j / (n / 4)) * g, v * Math.exp(-j / (n / 4)) * g * 0.8); } }
function bass(t, m, d, g = 0.12) { const s = S(t), n = S(d), f = hz(m), lp = new LP(); let ph = 0; for (let j = 0; j < n; j++) { const u = j / SR; ph = (ph + f / SR) % 1; const saw = ph * 2 - 1, e = Math.min(1, u / 0.005, (d - u) / 0.04); put(MUS, s + j, lp.run(saw, lpa(260 + 1400 * Math.exp(-u * 12))) * g * e); } }
function lead(t, m, d, g = 0.05, wave = 'saw', pan = 0.5, buf = MUS) { const s = S(t), n = S(d), f = hz(m), lp = new LP(); let ph = 0, ph2 = 0; for (let j = 0; j < n; j++) { const u = j / SR, vib = 1 + 0.004 * Math.sin(TAU * 5.5 * u) * Math.min(1, u * 3); ph = (ph + f * vib / SR) % 1; ph2 = (ph2 + f * 1.006 * vib / SR) % 1;
  const x = wave === 'square' ? (ph < 0.5 ? 1 : -1) * 0.6 : wave === 'pulse' ? (ph < 0.25 ? 1 : -1) * 0.6 : (ph * 2 - 1) * 0.5 + (ph2 * 2 - 1) * 0.5;
  const e = Math.min(1, u / 0.01, (d - u) / 0.06), v = (wave === 'saw' ? lp.run(x, lpa(2400)) : x) * g * e; put(buf, s + j, v * (1 - pan) * 2, v * pan * 2); } }
function pad(t0, t1, notes, g = 0.03, fc = 900) { const s0 = S(t0), s1 = S(t1), ph = notes.map(() => [0, 0]), f = [new LP(), new LP()];
  for (let i = s0; i < s1 && i < st.N; i++) { const t = (i - s0) / SR, e = Math.max(0, Math.min(1, t / 0.8, (t1 - t0 - t) / 0.8)); let l = 0, r = 0;
    notes.forEach((m, j) => { const fr = hz(m); ph[j][0] = (ph[j][0] + fr * 0.996 / SR) % 1; ph[j][1] = (ph[j][1] + fr * 1.005 / SR) % 1; l += ph[j][0] * 2 - 1; r += ph[j][1] * 2 - 1; });
    put(MUS, i, f[0].run(l, lpa(fc)) * g * e / notes.length * 2.5, f[1].run(r, lpa(fc)) * g * e / notes.length * 2.5); } }
function horn(t, d = 0.35, g = 0.08) { for (const f of [311, 392]) { const s = S(t), n = S(d), bp = new BP(f * 2, 2); let ph = 0; for (let j = 0; j < n; j++) { ph = (ph + f / SR) % 1; const e = Math.min(1, j / 400, (n - j) / 900); put(FX, s + j, bp.run(ph * 2 - 1) * g * e * 3); } } }
function bell(t, m, g = 0.05) { const f = hz(m), s = S(t), n = S(2.5); for (let j = 0; j < n; j++) { const u = j / SR; const v = (Math.sin(TAU * f * u) + 0.6 * Math.sin(TAU * f * 2.76 * u) * Math.exp(-u * 2) + 0.4 * Math.sin(TAU * f * 5.4 * u) * Math.exp(-u * 4)) * Math.exp(-u * 1.3) * g * Math.min(1, u * 800); put(MUS, s + j, v * 0.9, v); } }
function crackle(t0, t1, g = 0.04) { const r = rng(5); for (let t = t0; t < t1; t += 0.005 + r() * 0.05) st.snap(t, g * (0.3 + r())); const lp = new LP(); for (let i = S(t0); i < S(t1); i++) put(FX, i, lp.run(n2(), lpa(4000)) * 0.008); }

// The hook, one note a beat (raag Bhupali degrees; null = rest): 8 beats.
const HOOK = [4, 4, 5, 4, 2, 1, 2, null], HOOK2 = [4, 5, 7, 5, 4, 2, 1, 0];
const hookNote = (h, i, base = SA) => (h[i % 8] === null ? null : deg(BHUP, h[i % 8], base));
function hookLine(t0, beats, fn, h = HOOK, base = SA) { for (let i = 0; i < beats; i++) { const m = hookNote(h, i, base); if (m !== null) fn(t0 + i * BT, m, i); } }

// ---- intro ------------------------------------------------------------------------------------------------------------
st.tanpura(0, PT(4), 0.03);
for (let i = 0; i < 20; i++) st.santoor(0.8 + i * 0.09, deg(BHUP, i % 10, SA), 0.03, 0.2 + (i % 5) * 0.15);
st.whoosh(3.3, 1.6, 0.06, 300, 2600);
st.shimmer(4.8, 0.04, SA + 12);

// ---- 8000 BC to 1520: drone, flute, bells, the tabla arrives ------------------------------------------------------------
hookLine(at('rock'), 6, (t, m) => st.bansuri(t, m, BT * 0.95, 0.045));
for (let i = 0; i < 6; i++) st.bayan(at('rock', i), 0.18 + (i % 2) * 0.06, 0.5);
hookLine(at('seal'), 6, (t, m) => st.bansuri(t, m + 12, BT * 0.9, 0.04), HOOK2);
for (let i = 0; i < 12; i++) (i % 2 ? st.BOLS.na : st.BOLS.ge)(at('seal', i / 2), 0.7);
for (let i = 0; i < 6; i++) bell(at('nataraja', i), deg(BHUP, [0, 2, 4, 7, 4, 2][i], SA + 12), 0.045);
st.tabla(at('nataraja', 2), at('nataraja', 6), B.bpm, 0.7);
st.tabla(at('relief'), PT(IDX.silent), B.bpm, 1.0, st.KEHERWA, true);
hookLine(at('relief'), 6, (t, m) => st.sitar(t, m, 0.06, 0.55, 0.9));

// ---- the courts and the folk panels: sitar, faster tabla -------------------------------------------------------------
st.tanpura(PT(4), PT(IDX.silent), 0.025);
hookLine(at('mughal'), 6, (t, m, i) => { st.sitar(t, m, 0.06, 0.55, 0.9); if (i % 2) st.sitar(t + BT / 2, m + 2, 0.04, 0.6, 0.5); }, HOOK2);
hookLine(at('tanjore'), 6, (t, m) => { st.sitar(t, m + 12, 0.055, 0.55, 0.8); bell(t, m + 24, 0.012); });
for (let i = 0; i < 24; i++) st.BOLS[['dha', 'ti', 'na', 'ke'][i % 4]](at('warli', i / 4), 0.8);
hookLine(at('warli'), 6, (t, m) => st.bansuri(t, m + 12, BT * 0.8, 0.045));
hookLine(at('madhubani'), 6, (t, m, i) => { st.sitar(t, m, 0.06, 0.4, 0.8); st.santoor(t + BT / 2, m + 12, 0.03, 0.7); });
for (let i = 0; i < 12; i++) { st.tone(at('puppet', i / 2), 900 + (i % 3) * 200, 0.05, 0.05); st.snap(at('puppet', i / 2), 0.08); }
hookLine(at('puppet'), 6, (t, m) => st.sitar(t, m - 12, 0.07, 0.5, 0.6), HOOK2);
hookLine(at('kalighat'), 6, (t, m) => { st.santoor(t, m, 0.05, 0.4); st.santoor(t + BT / 2, m + 7, 0.03, 0.6); });
// every glide to the next panel is a whoosh
for (let k = 0; k < B.panels.length - 1; k++) st.whoosh(at(B.panels[k], 4.1), BT * 1.8, 0.05, 400, 2400);

// ---- 1913: a silent-film piano on a scratchy reel ---------------------------------------------------------------------
crackle(at('silent'), at('poster'), 0.03);
hookLine(at('silent'), 6, (t, m, i) => { st.santoor(t, m, 0.06, 0.45); st.santoor(t, m - 12 + (i % 2 ? 7 : 0), 0.035, 0.55); st.santoor(t + BT / 2, m + 4, 0.025, 0.5); });

// ---- 1994 onwards: the filmi drum machine -----------------------------------------------------------------------------
const groove = (t0, t1, { clapOn = false, hats = true, fill = true } = {}) => { for (let t = t0, i = 0; t < t1 - 0.01; t += BT / 2, i++) { if (i % 2 === 0) kick(t, 0.45); if (i % 4 === 2) (clapOn ? clap : snare)(t, 0.2); if (hats) hat(t + (i % 2 ? 0 : 0), i % 2 ? 0.05 : 0.03, i % 8 === 7); } if (fill) for (let k = 0; k < 4; k++) snare(t1 - BT / 2 + k * BT / 8, 0.08 + k * 0.03); };
const BASSLINE = [SA - 24, SA - 24, SA - 17, SA - 15, SA - 24, SA - 24, SA - 20, SA - 17];
const bassline = (t0, beats) => { for (let i = 0; i < beats * 2; i++) bass(t0 + i * BT / 2, BASSLINE[i % 8], BT / 2 * 0.9, 0.11); };
groove(at('poster'), at('truck')); bassline(at('poster'), 18);
pad(at('poster'), at('truck'), [SA - 12, SA - 8, SA - 5, SA], 0.035, 1200);
hookLine(at('poster'), 6, (t, m) => lead(t, m, BT * 0.9, 0.05, 'saw', 0.5));
st.tabla(at('poster'), at('tv'), B.bpm, 0.6, st.KEHERWA, false);
hookLine(at('tv'), 6, (t, m, i) => { lead(t, m + 12, BT * 0.45, 0.035, 'square', 0.4); lead(t + BT / 2, m + 7, BT * 0.4, 0.025, 'square', 0.6); }, HOOK2);
hookLine(at('cassette'), 6, (t, m) => lead(t + nz() * 0.01, m, BT * 0.95, 0.05, 'saw', 0.5));
for (let i = 0; i < 6; i++) st.sweep(at('cassette', i), 900, 1200, 0.03, 0.006);       // a little tape wow
// truck: horns on the beat, a tabla roll
groove(at('truck'), at('neon'), { clapOn: true }); bassline(at('truck'), 6);
[0, 1.5, 2, 4, 5.5].forEach((b) => horn(at('truck', b), 0.3, 0.06));
st.roll(at('truck', 4.5), BT * 1.4, 0.8);
// neon: synthwave arps
groove(at('neon'), at('popart')); bassline(at('neon'), 6);
for (let i = 0; i < 24; i++) lead(at('neon', i / 4), [SA, SA + 4, SA + 7, SA + 12][i % 4] + (i >= 12 ? 2 : 0), BT / 4 * 0.9, 0.03, 'pulse', 0.3 + (i % 4) * 0.12);
pad(at('neon'), at('popart'), [SA - 10, SA - 5, SA - 1, SA + 2], 0.035, 1800);
// pop art: claps and the hook in stabs
groove(at('popart'), at('lcd'), { clapOn: true }); bassline(at('popart'), 6);
hookLine(at('popart'), 6, (t, m) => { lead(t, m, BT * 0.3, 0.05, 'saw', 0.4); lead(t, m + 7, BT * 0.3, 0.03, 'saw', 0.6); }, HOOK2);
// the phone: chiptune
for (let i = 0; i < 12; i++) { const m = hookNote(HOOK, Math.floor(i / 2)); if (m !== null) lead(at('lcd', i / 2), m + 12 + (i % 2 ? 12 : 0), BT * 0.22, 0.035, 'square', 0.5, FX); }
for (let i = 0; i < 6; i++) { lead(at('lcd', i), SA - 12, BT * 0.2, 0.03, 'pulse', 0.5, FX); st.snap(at('lcd', i + 0.5), 0.05); }
// low poly: the game soundtrack, square lead over the groove
groove(at('lowpoly'), at('reel')); bassline(at('lowpoly'), 6);
hookLine(at('lowpoly'), 6, (t, m) => lead(t, m + 12, BT * 0.8, 0.04, 'square', 0.5), HOOK2);
st.tone(at('lowpoly', 2), 1320, 0.1, 0.04); st.tone(at('lowpoly', 2.1), 1760, 0.15, 0.04);       // a coin
// the reel: a modern beat with tabla, the hook on sitar, then the final pose
const fin = at('reel', 9.6);
for (let t = at('reel'), i = 0; t < fin - 0.01; t += BT / 4, i++) { if (i % 8 === 0 || i % 16 === 11) kick(t, 0.55); if (i % 8 === 4) clap(t, 0.22); hat(t, i % 2 ? 0.025 : 0.04); }
bassline(at('reel'), 9.5);
st.tabla(at('reel'), fin, B.bpm, 0.7, st.KEHERWA, true);
hookLine(at('reel'), 9, (t, m) => { st.sitar(t, m, 0.065, 0.5, 0.8); lead(t, m - 12, BT * 0.8, 0.02, 'saw', 0.5); });
pad(at('reel'), fin, [SA - 12, SA - 5, SA, SA + 4], 0.03, 1500);
kick(fin, 0.7); clap(fin, 0.3); st.BOLS.dha(fin, 1.4); st.shimmer(fin, 0.05, SA + 12);
// outro: tanpura, the hook once more on bansuri, slowly
st.tanpura(fin, DUR, 0.032);
hookLine(fin + 1.2, 8, (t, m) => st.bansuri(t, m, BT * 1.6, 0.04), HOOK2);
for (let i = 0; i < 6; i++) st.santoor(DUR - 3.2 + i * 0.12, deg(BHUP, 5 + i, SA), 0.03, 0.3 + i * 0.08);

// ---- mix (no voice: a silent placeholder for the shared mixdown) ---------------------------------------------------------
const silent = path.join(ROOT, 'out', 'prabhu-silence.wav');
{ const b = Buffer.alloc(48); b.write('RIFF', 0); b.writeUInt32LE(40, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(4, 40); fs.writeFileSync(silent, b); }
const out = path.join(ROOT, 'out', 'cartoon-prabhu.wav');
st.mixdown(silent, out, { musRev: 0.3, drRev: 0.08 });
console.log(`wrote out/cartoon-prabhu.wav, ${DUR}s`);
void END; void FX;
