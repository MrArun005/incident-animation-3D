// Score for "The World in 2076" (src/world2076.js). Original synthesis, no samples.
// A clock ticking once per year as the counter runs 2026 -> 2076; a soft hit and a wide D-major pad with bells
// for Earth; a whoosh through the clouds; air, rotor hum and a light pluck line in the sky; birds, voices and a
// gentle 120 bpm groove on the street and in the pod; a swell for the city at golden hour; a chord for the title.
//   node tools/audio-world2076.mjs -> out/cartoon-world2076.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 44100, DUR = 25, N = SR * DUR, TAU = Math.PI * 2;
const DRY = [new Float32Array(N), new Float32Array(N)], WET = [new Float32Array(N), new Float32Array(N)];
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const nz = rng(2076), n2 = () => nz() * 2 - 1;
const S = (t) => Math.round(t * SR);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const put = (i, l, r, send = 0.2) => { if (i < 0 || i >= N) return; DRY[0][i] += l; DRY[1][i] += r; WET[0][i] += l * send; WET[1][i] += r * send; };
const pan2 = (v, p) => [v * Math.cos(p * Math.PI / 2) * 1.41, v * Math.sin(p * Math.PI / 2) * 1.41];
class BP { constructor(f = 1000, q = 1) { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q) { const w = TAU * clamp(f, 20, SR * 0.45) / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al; this.b0 = al / a0; this.b2 = -al / a0; this.a1 = -2 * Math.cos(w) / a0; this.a2 = (1 - al) / a0; return this; }
  run(x) { const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; } }
const lpk = (fc) => 1 - Math.exp(-TAU * fc / SR);
// same curve as the picture
const yearAt = (t) => 2026 + Math.floor(50 * Math.pow(clamp(t / 2.3, 0, 1), 2.2) + 1e-6);

// ---- instruments ----------------------------------------------------------------------------------------------
function tick(t0, k) {                                   // a clock tick that brightens as the years run
  const s = S(t0), n = S(0.05), f = 2400 + k * 40, bp = new BP(f, 6);
  for (let j = 0; j < n; j++) { const u = j / SR, e = Math.exp(-u * 160);
    const v = (bp.run(n2()) * 0.9 + Math.sin(TAU * f * 0.5 * u) * 0.25) * e * 0.32;
    put(s + j, ...pan2(v, 0.4 + 0.2 * Math.sin(k)), 0.15); }
}
function boom(t0, g = 1, f0 = 62, f1 = 32, len = 3.2) {
  const s = S(t0), n = S(len); let ph = 0, lp = 0; const k = lpk(400);
  for (let j = 0; j < n; j++) { const u = j / SR, f = f1 + (f0 - f1) * Math.exp(-u * 3);
    ph += TAU * f / SR; lp += k * (n2() - lp);
    const v = (Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-u * 1.3) + lp * 1.6 * Math.exp(-u * 9)) * g * 0.55 * Math.min(1, u * 400);
    put(s + j, v, v, 0.35); }
}
function sweep(t0, t1, fa, fb, g = 0.2, q = 2.5, curve = 2) {       // filtered-noise riser or whoosh
  const s = S(t0), n = S(t1 - t0), bpL = new BP(fa, q), bpR = new BP(fa, q);
  for (let j = 0; j < n; j++) { const u = j / n, f = fa * (fb / fa) ** u; if (j % 32 === 0) { bpL.set(f, q); bpR.set(f * 1.03, q); }
    const e = Math.pow(u, curve) * Math.min(1, (1 - u) * 30) * g;
    put(s + j, bpL.run(n2()) * e, bpR.run(n2()) * e, 0.4); }
}
function tone(t0, len, m0, m1, g, pan = 0.5) {           // a sine glide (riser pitch, sub drops)
  const s = S(t0), n = S(len); let ph = 0;
  for (let j = 0; j < n; j++) { const u = j / n, f = hz(m0 + (m1 - m0) * u); ph += TAU * f / SR;
    const v = Math.sin(ph) * g * Math.min(1, u * 8) * Math.min(1, (1 - u) * 12); put(s + j, ...pan2(v, pan), 0.3); }
}
function pad(t0, t1, notes, g = 0.05, cutoff = 1400, att = 1.2, rel = 1.6) {   // detuned saws through two one-pole lowpasses
  const s = S(t0), n = S(t1 - t0 + rel), k = lpk(cutoff);
  for (const [vi, m] of notes.entries()) {
    const det = [-0.11, -0.04, 0.03, 0.09, 0.14], ph = det.map(() => nz()), f = hz(m), p = 0.2 + 0.6 * (vi / Math.max(1, notes.length - 1));
    let a = 0, b = 0;
    for (let j = 0; j < n; j++) { const u = j / SR;
      let v = 0; for (let d = 0; d < det.length; d++) { ph[d] = (ph[d] + f * 2 ** (det[d] / 12) / SR) % 1; v += ph[d] * 2 - 1; }
      v /= det.length; a += k * (v - a); b += k * (a - b);
      const e = Math.min(1, u / att) * (u > t1 - t0 ? Math.max(0, 1 - (u - (t1 - t0)) / rel) : 1);
      put(s + j, ...pan2(b * e * g, p), 0.55); }
  }
}
function bell(t0, m, g = 0.05, pan = 0.5) {
  const s = S(t0), n = S(3), f = hz(m);
  for (let j = 0; j < n; j++) { const u = j / SR;
    const v = (Math.sin(TAU * f * u) + 0.4 * Math.sin(TAU * f * 2.76 * u) * Math.exp(-u * 4) + 0.2 * Math.sin(TAU * f * 5.4 * u) * Math.exp(-u * 8)) * Math.exp(-u * 1.6) * Math.min(1, u * 800) * g;
    put(s + j, ...pan2(v, pan), 0.6); }
}
function pluck(t0, m, g = 0.05, pan = 0.5, bright = 2500) {   // the arp: a pulse wave with a closing filter
  const s = S(t0), n = S(0.32), f = hz(m); let ph = 0, a = 0, b = 0;
  for (let j = 0; j < n; j++) { const u = j / SR; ph = (ph + f / SR) % 1;
    const k = lpk(300 + bright * Math.exp(-u * 18)), v = (ph < 0.32 ? 1 : -1);
    a += k * (v - a); b += k * (a - b);
    put(s + j, ...pan2(b * Math.exp(-u * 9) * g * Math.min(1, u * 1500), pan), 0.3); }
}
function kick(t0, g = 0.5) {
  const s = S(t0), n = S(0.4); let ph = 0;
  for (let j = 0; j < n; j++) { const u = j / SR; ph += TAU * (45 + 110 * Math.exp(-u * 30)) / SR;
    const v = Math.tanh(Math.sin(ph) * 2) * Math.exp(-u * 8) * g; put(s + j, v, v, 0.05); }
}
function hat(t0, g = 0.08, pan = 0.6) {
  const s = S(t0), n = S(0.06), bp = new BP(9000, 1.2);
  for (let j = 0; j < n; j++) { const u = j / SR; put(s + j, ...pan2(bp.run(n2()) * Math.exp(-u * 70) * g, pan), 0.1); }
}
function clap(t0, g = 0.16) {
  const s = S(t0), n = S(0.25), bp = new BP(1500, 1.5);
  for (let j = 0; j < n; j++) { const u = j / SR, e = [0, 0.011, 0.022].reduce((a, o) => a + (u >= o ? Math.exp(-(u - o) * (o < 0.02 ? 140 : 18)) : 0), 0);
    const v = bp.run(n2()) * e * g; put(s + j, v, v * 0.9, 0.5); }
}

// ---- the cue ------------------------------------------------------------------------------------------------
// cuts (src/world2076.js SHOTS): earth 2.6, sky 6.0, street 10.5, car 15.5, city 19.5, title 22.5
function bird(t0, g = 0.03, pan = 0.5) {               // a two-note chirp
  const r = rng(Math.round(t0 * 1000)), n = 2 + Math.floor(r() * 3), f0 = 2600 + r() * 1800;
  for (let k = 0; k < n; k++) { const s = S(t0 + k * 0.09), len = S(0.06); let ph = 0;
    for (let j = 0; j < len; j++) { const u = j / len; ph += TAU * (f0 * (1 + 0.25 * Math.sin(u * Math.PI) - 0.1 * k)) / SR;
      put(s + j, ...pan2(Math.sin(ph) * Math.sin(u * Math.PI) * g, pan), 0.4); } }
}
function murmur(t0, t1, g = 0.03) {                     // distant voices: band-limited noise with a syllable-rate swell
  const s = S(t0), n = S(t1 - t0), bl = new BP(500, 0.8), br = new BP(650, 0.8);
  for (let j = 0; j < n; j++) { const u = j / SR, e = Math.min(1, u / 0.6, (t1 - t0 - u) / 0.4) * (0.6 + 0.4 * Math.sin(u * 7.3) * Math.sin(u * 3.1 + 1)) * g;
    put(s + j, bl.run(n2()) * e, br.run(n2()) * e, 0.3); }
}
function hum(t0, t1, f, g = 0.02, pan = 0.5) {         // an electric rotor: a soft tone with blade flutter
  const s = S(t0), n = S(t1 - t0); let ph = 0; const bp = new BP(f * 4, 3);
  for (let j = 0; j < n; j++) { const u = j / SR; ph += TAU * f / SR; const e = Math.min(1, u / 0.5, (t1 - t0 - u) / 0.5) * g * (0.7 + 0.3 * Math.sin(TAU * 31 * u));
    put(s + j, ...pan2((Math.sin(ph) * 0.6 + bp.run(n2()) * 0.8) * e, pan), 0.2); }
}
// 0-2.6: years tick by over a rising sweep
let last = 2026; for (let i = 0; i < S(2.4); i += 32) { const t = i / SR, y = yearAt(t); if (y !== last) { tick(t, y - 2026); last = y; } }
tick(0.05, 0);
sweep(0.2, 2.6, 300, 7000, 0.2, 2.0, 2.6);
tone(0.4, 2.2, 38, 62, 0.045, 0.5);
sweep(1.9, 2.6, 9000, 2500, 0.07, 0.8, 3);
// 2.6: Earth. A soft hit, a wide D-major pad, bells
boom(2.6, 0.8);
pad(2.6, 6.0, [38, 50, 54, 57, 61, 64], 0.05, 1300, 0.4, 1.2);
const LYD = [62, 64, 66, 69, 71, 73, 74, 76, 78, 81];
{ const r = rng(9); for (let t = 2.9; t < 5.2; t += 0.38 + r() * 0.4) bell(t, LYD[Math.floor(r() * LYD.length)] + 12, 0.032, 0.2 + r() * 0.6); }
// 5-6: the dive through the clouds
sweep(5.0, 6.0, 250, 5000, 0.26, 1.5, 2.2);
tone(5.3, 0.7, 74, 52, 0.025, 0.6);
// 6-10.5: the sky. Air, rotor hum passing, a gentle pluck line over B minor -> G
sweep(6.0, 7.0, 6000, 500, 0.1, 0.9, 0.3);
pad(6.0, 8.3, [35, 47, 54, 57, 62, 66], 0.042, 1600, 0.5, 0.8);
pad(8.3, 10.5, [31, 43, 55, 59, 62, 66], 0.042, 1700, 0.5, 0.6);
hum(6.0, 10.4, 92, 0.03, 0.62);
sweep(7.2, 8.6, 300, 1200, 0.05, 2.0, 1.0); sweep(8.6, 9.6, 1200, 300, 0.05, 2.0, 0.4);    // a taxi lane passing
{ const pat = [0, 2, 1, 3]; for (let i = 0; 6.25 + i * 0.25 < 10.4; i++) { const t = 6.25 + i * 0.25, c = t < 8.3 ? [59, 62, 66, 69] : [55, 59, 62, 66];
  pluck(t, c[pat[i % 4]] + 12, 0.028, i % 2 ? 0.35 : 0.65, 1600); } }
// 10.5-19.5: on the ground. Birds, voices, a light groove (kick, hats, claps from the car shot), arpeggio
murmur(10.5, 19.4, 0.035);
{ const r = rng(21); for (let t = 10.7; t < 19.2; t += 0.35 + r() * 0.9) bird(t, 0.022 + r() * 0.015, 0.15 + r() * 0.7); }
const BEAT = 0.5, CH = [[10.5, [55, 59, 62, 66, 69]], [13.0, [57, 61, 64, 69, 73]], [15.5, [59, 62, 66, 69, 74]], [17.5, [55, 59, 62, 66, 71]]];
const chordAt = (t) => { let c = CH[0][1]; for (const [t0, n] of CH) if (t >= t0) c = n; return c; };
for (let b = 0; ; b++) { const t = 10.5 + b * BEAT; if (t >= 19.3) break;
  kick(t, t < 15.5 ? 0.32 : 0.45); hat(t + BEAT / 2, 0.06, 0.65);
  if (t >= 15.5 && b % 2 === 1) clap(t, 0.12); }
for (let i = 0; i * 0.125 + 10.5 < 19.3; i++) { const t = 10.5 + i * 0.125, c = chordAt(t), pat = [0, 2, 1, 3, 2, 4, 3, 1];
  pluck(t, c[pat[i % 8]] + (i % 16 >= 8 ? 12 : 0), 0.038, i % 2 ? 0.3 : 0.7, 900 + 3000 * clamp((t - 10.5) / 9, 0, 1)); }
for (const [i, [t0, n]] of CH.entries()) { const t1 = i + 1 < CH.length ? CH[i + 1][0] : 19.5;
  pad(t0, t1, [n[0] - 24, n[0] - 12, ...n.slice(1, 4)], 0.03, 900 + 300 * i, 0.3, 0.6); }
hum(15.5, 19.4, 70, 0.018, 0.4);                         // the pod's quiet motor
// 19.5: the city at golden hour. A swell, then the title
sweep(18.8, 19.5, 400, 8000, 0.18, 2.0, 2.4);
boom(19.5, 0.6, 70, 36, 2.5);
pad(19.5, 22.6, [38, 50, 57, 61, 64, 69], 0.045, 1800, 0.8, 1.2);
{ const r = rng(19); for (let t = 19.8; t < 22.3; t += 0.5 + r() * 0.5) bell(t, LYD[Math.floor(r() * LYD.length)] + (r() < 0.4 ? 12 : 0), 0.028, 0.2 + r() * 0.6); }
sweep(21.9, 22.6, 600, 8000, 0.12, 1.2, 3);
boom(22.6, 1.0, 64, 30, 2.0);
pad(22.6, 24.2, [26, 38, 50, 57, 62, 66, 69, 76], 0.04, 2200, 0.08, 0.8);
bell(22.62, 86, 0.055, 0.5); bell(22.9, 81, 0.04, 0.35); bell(23.15, 90, 0.03, 0.65);

// ---- reverb (Schroeder) and the mix ------------------------------------------------------------------------------
function reverb(x, seed) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * (1 + seed * 0.03) * 1.6)), aps = [225, 556, 441].map((d) => d + seed * 7);
  const out = new Float32Array(N);
  for (const d of combs) { const b = new Float32Array(d); let i = 0, lp = 0; for (let j = 0; j < N; j++) { const y = b[i]; lp += 0.35 * (y - lp); b[i] = x[j] + lp * 0.86; i = (i + 1) % d; out[j] += y / combs.length; } }
  for (const d of aps) { const b = new Float32Array(d); let i = 0; for (let j = 0; j < N; j++) { const bi = b[i], y = -out[j] + bi; b[i] = out[j] + bi * 0.5; out[j] = y; i = (i + 1) % d; } }
  return out;
}
const RL = reverb(WET[0], 0), RR = reverb(WET[1], 1);
const L = new Float32Array(N), Rr = new Float32Array(N);
let peak = 0;
for (let j = 0; j < N; j++) { const t = j / SR, fade = clamp((DUR - t) / 0.7, 0, 1) * clamp(t / 0.02, 0, 1);
  L[j] = Math.tanh((DRY[0][j] + RL[j] * 0.9) * 1.1) * fade; Rr[j] = Math.tanh((DRY[1][j] + RR[j] * 0.9) * 1.1) * fade; peak = Math.max(peak, Math.abs(L[j]), Math.abs(Rr[j])); }
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const g = 0.92 / peak;
for (let j = 0; j < N; j++) { buf.writeInt16LE(Math.round(clamp(L[j] * g, -1, 1) * 32767), 44 + j * 4); buf.writeInt16LE(Math.round(clamp(Rr[j] * g, -1, 1) * 32767), 46 + j * 4); }
const out = path.join(ROOT, 'out', 'cartoon-world2076.wav'); fs.writeFileSync(out, buf);
console.log(`wrote ${path.relative(ROOT, out)} (peak ${peak.toFixed(2)})`);
