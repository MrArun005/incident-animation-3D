// Claude flies Astra Adventures -- the "tuned" pilot. Same job as pilot-base (a closed-loop target-chaser that
// flies with real key presses), with a sharper eye and a steadier hand:
//  * it carries a model of the Jupiter's handling (the flight model's published constants and update rule) and
//    picks each frame's keys by rolling that model forward for ~150 short key sequences (hold X for d, then let
//    go) and scoring where each one puts the hull relative to the rocks -- so drift, bank and sideslip are in
//    the prediction instead of being fought after the fact;
//  * clearances are measured the way a collision sees them: the 23 hull probes (with the bank) against a
//    silhouette of each rock built from surface samples (window.__astra.surf rings plus the centre-gap
//    readings on the way in), padded by a per-shape margin, and cross-checked against the live probe gap
//    (pgap) as the rock comes alongside;
//  * gauntlet rocks are passed on the side the gauntlet line runs (towards their neighbours), field targets on
//    the side the ship is already on, preferring wing passes and skipping lines that run into a second rock.
//   node tools/lab/pilot-tuned.mjs [--record out.mp4] [--seconds 70] [--width 1600 --height 900] [--hard] [--log f]
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { open } from '../harness.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const RECORD = arg('record', null), SECONDS = +arg('seconds', 70), W = +arg('width', 1280), H = +arg('height', 720);
const HARD = process.argv.includes('--hard'), LOG = arg('log', null);
const FFMPEG = '/home/user/incident-animation-3d/cartoons/node_modules/ffmpeg-static/ffmpeg';
const SELFTEST = !!process.env.PILOT_SELFTEST;

/* ============================ the ship model (what a pilot learns of the handling) ============================ */
const FMK = { cruise: HARD ? 56 : 42, boost: HARD ? 132 : 108, accel: 18, boostAccel: 58, decel: 20, boostDecel: 30,
  pitchRate: 1.1, yawRate: 0.95, rateBoostScale: 0.7, rotTauIn: 0.27, rotTauOut: 0.36, strafeSpeed: 20, strafeTau: 0.42,
  driftTau: 0.95, levelRate: 0.6, boostDrain: 0.24, boostRecharge: 0.15, rechargeDelay: 0.8 };
// hull probes (x, y, z, radius), ship axes +X right, +Y up, -Z forward
const PROBES = [[0, 0.03, -6.3, 0.42], [0, 0.08, -4.9, 0.72], [0, 0.45, -2, 1], [0, 0.1, -0.4, 1.25], [0, 0.1, 2.4, 1.25], [0, 0.1, 4.6, 1.05], [0, 0.03, 6.3, 0.6],
  [-5.3, 0.05, -0.9, 0.82], [-5.3, 0.05, 1.3, 0.82], [-5.3, 0.05, 3.5, 0.82], [5.3, 0.05, -0.9, 0.82], [5.3, 0.05, 1.3, 0.82], [5.3, 0.05, 3.5, 0.82],
  [-6.02, 0.42, -3.4, 0.28], [6.02, 0.42, -3.4, 0.28], [-2, 0.05, 1.2, 0.58], [-3.2, 0.05, 0.1, 0.58], [-3.2, 0.05, 1.6, 0.58], [-3.2, 0.05, 3.1, 0.58],
  [2, 0.05, 1.2, 0.58], [3.2, 0.05, 0.1, 0.58], [3.2, 0.05, 1.6, 0.58], [3.2, 0.05, 3.1, 0.58]];
const NP = PROBES.length, PR = PROBES.map((p) => p[3]);
const appr = (a, b, tau, dt) => b + (a - b) * Math.exp(-dt / tau);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const TAU = Math.PI * 2;
const wrapA = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const perp = (a, v) => { const k = dot(a, v); return [a[0] - v[0] * k, a[1] - v[1] * k, a[2] - v[2] * k]; };

// State vector: 0-2 pos, 3-5 vel, 6-9 q (x,y,z,w), 10-12 ang, 13 bank, 14 boostE, 15 boostVis, 16 boosting, 17 boostIdle, 18 boostLock
const NS = 19;
function stepShip(S, pitch, yaw, strafe, boost, h) {
  const F = FMK;
  if (boost && !S[18] && S[14] > 0.01) { S[16] = 1; S[14] = Math.max(0, S[14] - h * F.boostDrain); S[17] = 0; if (S[14] <= 0) S[18] = 1; }
  else { S[16] = 0; S[17] += h; if (S[17] > F.rechargeDelay) S[14] = Math.min(1, S[14] + h * F.boostRecharge); if (S[18] && S[14] > 0.3) S[18] = 0; }
  S[15] = appr(S[15], S[16], 0.35, h);
  const rs = 1 + (F.rateBoostScale - 1) * S[15];
  S[10] = appr(S[10], pitch * F.pitchRate * rs, pitch ? F.rotTauIn : F.rotTauOut, h);
  S[11] = appr(S[11], -yaw * F.yawRate * rs, yaw ? F.rotTauIn : F.rotTauOut, h);
  S[12] = appr(S[12], 0, 0.35, h);
  const hx = S[10] * h / 2, hy = S[11] * h / 2, hz = S[12] * h / 2;
  const c1 = Math.cos(hx), c2 = Math.cos(hy), c3 = Math.cos(hz), s1 = Math.sin(hx), s2 = Math.sin(hy), s3 = Math.sin(hz);
  const wx = s1 * c2 * c3 + c1 * s2 * s3, wy = c1 * s2 * c3 - s1 * c2 * s3, wz = c1 * c2 * s3 + s1 * s2 * c3, ww = c1 * c2 * c3 - s1 * s2 * s3;
  let qx = S[6], qy = S[7], qz = S[8], qw = S[9];
  let nx = qx * ww + qw * wx + qy * wz - qz * wy, ny = qy * ww + qw * wy + qz * wx - qx * wz, nz = qz * ww + qw * wz + qx * wy - qy * wx, nw = qw * ww - qx * wx - qy * wy - qz * wz;
  let L = Math.hypot(nx, ny, nz, nw); qx = nx / L; qy = ny / L; qz = nz / L; qw = nw / L;
  // axes of q
  const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, xw = qx * qw, yw = qy * qw, zw = qz * qw;
  const rx = 1 - 2 * (yy + zz), ry = 2 * (xy + zw), rz = 2 * (xz - yw);
  const ux = 2 * (xy - zw), uy = 1 - 2 * (xx + zz), uz = 2 * (yz + xw);
  const fx = -2 * (xz + yw), fy = -2 * (yz - xw), fz = -(1 - 2 * (xx + yy));
  // flight assist: roll the wings back towards level
  if (Math.abs(fy) < 0.94) {
    let dx = -fx * fy, dy = 1 - fy * fy, dz = -fz * fy; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
    const cx = uy * dz - uz * dy, cy = uz * dx - ux * dz, cz = ux * dy - uy * dx;
    const err = Math.atan2(cx * fx + cy * fy + cz * fz, ux * dx + uy * dy + uz * dz);
    const ang = clamp(err, -1, 1) * F.levelRate * h * (1 - Math.abs(fy)), sh = Math.sin(ang / 2), ch = Math.cos(ang / 2);
    const ax = fx * sh, ay = fy * sh, az = fz * sh, aw = ch;   // q = a * q
    nx = ax * qw + aw * qx + ay * qz - az * qy; ny = ay * qw + aw * qy + az * qx - ax * qz; nz = az * qw + aw * qz + ax * qy - ay * qx; nw = aw * qw - ax * qx - ay * qy - az * qz;
    qx = nx; qy = ny; qz = nz; qw = nw;
  }
  S[6] = qx; S[7] = qy; S[8] = qz; S[9] = qw;
  const vx = S[3], vy = S[4], vz = S[5];
  let fs = vx * fx + vy * fy + vz * fz, vr = vx * rx + vy * ry + vz * rz, vu = vx * ux + vy * uy + vz * uz;
  const target = S[16] ? F.boost : F.cruise;
  if (fs < target) fs = Math.min(target, fs + (S[16] ? F.boostAccel : F.accel) * h); else fs = Math.max(target, fs - (S[15] > 0.05 ? F.boostDecel : F.decel) * h);
  vr = strafe ? appr(vr, strafe * F.strafeSpeed, F.strafeTau, h) : appr(vr, 0, F.driftTau, h);
  vu = appr(vu, 0, F.driftTau, h);
  S[3] = fx * fs + rx * vr + ux * vu; S[4] = fy * fs + ry * vr + uy * vu; S[5] = fz * fs + rz * vr + uz * vu;
  S[0] += S[3] * h; S[1] += S[4] * h; S[2] += S[5] * h;
  S[13] = appr(S[13], clamp(-S[11] * 0.85 + vr * 0.02, -1.1, 1.1), 0.22, h);
}
// world offsets of the hull probes for state S (q with the visual bank, which is what collisions use)
const PW = new Float64Array(NP * 3);
function probeWorld(S) {
  const qx = S[6], qy = S[7], qz = S[8], qw = S[9], cb = Math.cos(S[13]), sb = Math.sin(S[13]);
  const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, xw = qx * qw, yw = qy * qw, zw = qz * qw;
  const m00 = 1 - 2 * (yy + zz), m01 = 2 * (xy - zw), m02 = 2 * (xz + yw), m10 = 2 * (xy + zw), m11 = 1 - 2 * (xx + zz), m12 = 2 * (yz - xw), m20 = 2 * (xz - yw), m21 = 2 * (yz + xw), m22 = 1 - 2 * (xx + yy);
  for (let p = 0; p < NP; p++) {
    const o = PROBES[p], bx = o[0] * cb + o[1] * sb, by = -o[0] * sb + o[1] * cb, bz = o[2];   // bank about the forward axis
    PW[p * 3] = m00 * bx + m01 * by + m02 * bz; PW[p * 3 + 1] = m10 * bx + m11 * by + m12 * bz; PW[p * 3 + 2] = m20 * bx + m21 * by + m22 * bz;
  }
}
function quatFromAxes(r, u, f) {             // rotation whose columns are right, up, back
  const m11 = r[0], m12 = u[0], m13 = -f[0], m21 = r[1], m22 = u[1], m23 = -f[1], m31 = r[2], m32 = u[2], m33 = -f[2], tr = m11 + m22 + m33;
  let x, y, z, w, s;
  if (tr > 0) { s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m32 - m23) * s; y = (m13 - m31) * s; z = (m21 - m12) * s; }
  else if (m11 > m22 && m11 > m33) { s = 2 * Math.sqrt(1 + m11 - m22 - m33); w = (m32 - m23) / s; x = 0.25 * s; y = (m12 + m21) / s; z = (m13 + m31) / s; }
  else if (m22 > m33) { s = 2 * Math.sqrt(1 + m22 - m11 - m33); w = (m13 - m31) / s; x = (m12 + m21) / s; y = 0.25 * s; z = (m23 + m32) / s; }
  else { s = 2 * Math.sqrt(1 + m33 - m11 - m22); w = (m21 - m12) / s; x = (m13 + m31) / s; y = (m23 + m32) / s; z = 0.25 * s; }
  const l = Math.hypot(x, y, z, w); return [x / l, y / l, z / l, w / l];
}

/* ============================ rock silhouettes ============================ */
// A rock is star-shaped about its centre; seen along the flight direction, what a hull probe has to clear is the
// rock's SILHOUETTE. Every surface point we learn (surf rings, centre-gap readings) is inside it, so the max per
// angle is a lower bound; a per-shape margin (measured offline over random orientations: how far the silhouette
// pokes out beyond what the approach shows) covers the rest.
const NB = 72, BW = TAU / NB;
const VARS = [['potato', 1.5303], ['rubble', 1.1756], ['shard', 1.5213], ['binary', 1.7003], ['top', 1.3386], ['lumpy', 1.2752]];
const variantOf = (s, reach) => { const k = reach / s; let best = 0, bd = 9; VARS.forEach(([, m], i) => { const d = Math.abs(m - k); if (d < bd) { bd = d; best = i; } }); return VARS[best][0]; };
const MARGIN = { rubble: 0.035, lumpy: 0.05, top: 0.06, potato: 0.075, shard: 0.17, binary: 0.16 };    // x rock scale
const GTAB = {                                         // aimed clearance (m, over the padded silhouette) against rock scale
  rubble: [[4, 0.6], [8, 0.6], [11, 0.5], [15.5, 0.42], [20, 0.36], [24.5, 0.3], [40, 0.3]],
  lumpy: [[4, 0.55], [8, 0.55], [11, 0.45], [15.5, 0.38], [24.5, 0.38], [29, 0.5], [40, 0.7]],
  top: [[4, 0.6], [6, 0.6], [8, 0.42], [15.5, 0.42], [40, 0.5]],
  potato: [[4, 0.7], [6, 0.6], [8, 0.5], [11, 0.55], [15.5, 1.0], [20, 2.0], [24.5, 2.8], [40, 3.0]],
  shard: [[4, 0.7], [6, 1.05], [8, 1.15], [11, 2.2], [15.5, 3.3], [40, 3.6]],
  binary: [[4, 0.75], [6, 1.1], [8, 1.3], [11, 2.3], [15.5, 3.3], [40, 3.6]],
};
const gaim = (v, s, gauntlet) => { const T = GTAB[v]; let g = T[T.length - 1][1]; if (s <= T[0][0]) g = T[0][1]; else for (let k = 1; k < T.length; k++) if (s <= T[k][0]) { const [s0, g0] = T[k - 1], [s1, g1] = T[k]; g = g0 + (g1 - g0) * (s - s0) / (s1 - s0); break; } return g + (gauntlet ? 0 : 0.2); };
function buildTable(mem, e1, e2, extra) {
  const tab = new Float64Array(NB).fill(-1), P = mem.pts;
  for (let k = 0; k < P.length; k += 3) {
    const x = P[k], y = P[k + 1], z = P[k + 2];
    const a = x * e1[0] + y * e1[1] + z * e1[2], b = x * e2[0] + y * e2[1] + z * e2[2];
    let bi = Math.round(Math.atan2(b, a) / BW); bi = ((bi % NB) + NB) % NB;
    const rr = Math.hypot(a, b); if (rr > tab[bi]) tab[bi] = rr;
  }
  let any = -1; for (let i = 0; i < NB; i++) if (tab[i] >= 0) { any = i; break; }
  if (any < 0) tab.fill(mem.reach);
  else for (let i = 0; i < NB; i++) {
    if (tab[i] >= 0) continue;
    let a = 1, b = 1; while (tab[(i - a + NB) % NB] < 0) a++; while (tab[(i + b) % NB] < 0) b++;
    const va = tab[(i - a + NB) % NB], vb = tab[(i + b) % NB], span = a + b;
    tab[i] = span > 8 ? Math.max(va, vb, mem.reach * 0.9) : va + (vb - va) * (a / span);
  }
  const out = new Float64Array(NB), m = mem.margin + extra; let smax = 0;
  for (let i = 0; i < NB; i++) { const v = Math.min(mem.reach, (tab[i] < 0 ? mem.reach : tab[i]) + m); out[i] = v; if (v > smax) smax = v; }
  return { tab: out, smax };
}
const circle = (reach) => { const t = new Float64Array(NB).fill(reach); return { tab: t, smax: reach }; };
function lookup(tab, th) { let x = th / BW; if (x < 0) x += NB; const i0 = Math.floor(x), fr = x - i0; const a = tab[i0 % NB], b = tab[(i0 + 1) % NB]; return a + (b - a) * fr; }
// min probe gap for a ship whose centre sits at (a, b) in the silhouette plane (probe offsets in PW)
function probeGap(R, a, b, al, stopAt) {
  const e1 = R.e1, e2 = R.e2, v = R.v, r2 = R.reach * R.reach;
  let g = Infinity;
  for (let p = 0; p < NP; p++) {
    const wx = PW[p * 3], wy = PW[p * 3 + 1], wz = PW[p * 3 + 2];
    const pa = a + wx * e1[0] + wy * e1[1] + wz * e1[2], pb = b + wx * e2[0] + wy * e2[1] + wz * e2[2];
    const alp = al + wx * v[0] + wy * v[1] + wz * v[2], l2 = r2 - alp * alp, lim = l2 > 0 ? Math.sqrt(l2) : 0;   // no surface point lies beyond reach
    const rho = Math.hypot(pa, pb);
    if (rho - PR[p] - Math.min(R.smax, lim) > g) continue;
    let sv = lookup(R.tab, Math.atan2(pb, pa)); if (sv > lim) sv = lim;
    const gp = rho - sv - PR[p]; if (gp < g) { g = gp; if (g < stopAt) return g; }
  }
  return g;
}

/* ============================ the planner ============================ */
const ACTS = [];
for (const y of [-1, 0, 1]) for (const p of [-1, 0, 1]) for (const s of [-1, 0, 1]) if (y || p || s) for (const d of [1, 2, 4, 8, 16, 40]) ACTS.push([y, p, s, d / 30]);
ACTS.push([0, 0, 0, 0]);
const S1 = new Float64Array(NS);
const GMIN = new Float64Array(64), CROSS = new Float64Array(64), CROSSED = new Uint8Array(64);
// Fly the model forward under one key sequence; returns its cost (and fills out.*).
function rollout(S0, act, env, out) {
  const S = S1; S.set(S0);
  const rocks = env.rocks, nr = rocks.length, h = env.h, v = env.v;
  for (let j = 0; j < nr; j++) { GMIN[j] = Infinity; CROSSED[j] = 0; CROSS[j] = 0; }
  let t = 0, tCross = -1, turnMax = 0;
  const tg = env.tg;
  for (let k = 0; k < env.steps; k++) {
    const hold = t < act[3] - 1e-9;
    stepShip(S, hold ? act[1] : 0, hold ? act[0] : 0, hold ? act[2] : 0, env.boostNow && t < env.boostT, h);
    t += h;
    let pw = false, inWin = false;
    for (let j = 0; j < nr; j++) {
      const R = rocks[j], rx = S[0] - R.c[0], ry = S[1] - R.c[1], rz = S[2] - R.c[2];
      const al = rx * v[0] + ry * v[1] + rz * v[2];
      if (al < -R.win || al > R.win) continue;
      inWin = true;
      const a = rx * R.e1[0] + ry * R.e1[1] + rz * R.e1[2], b = rx * R.e2[0] + ry * R.e2[1] + rz * R.e2[2];
      if (!CROSSED[j] && al >= 0) { CROSSED[j] = 1; CROSS[j] = Math.hypot(a, b) * Math.abs(wrapA(Math.atan2(b, a) - R.thu)); if (j === tg) tCross = t; }
      const rc = Math.hypot(a, b);
      if (rc - R.smax - 7.5 > Math.min(GMIN[j], R.care)) continue;
      if (!pw) { probeWorld(S); pw = true; }
      const g = probeGap(R, a, b, al, -5);
      if (g < GMIN[j]) GMIN[j] = g;
    }
    if (inWin) { const sp = Math.hypot(S[3], S[4], S[5]), ca = (S[3] * v[0] + S[4] * v[1] + S[5] * v[2]) / sp, an = Math.acos(ca > 1 ? 1 : ca); if (an > turnMax) turnMax = an; }
    if (tCross >= 0 && t > tCross + env.after && t > env.tMin) break;
  }
  let J = 0, tgGap = NaN;
  if (tg >= 0) {
    const R = rocks[tg]; let g = GMIN[tg], dev = CROSS[tg], w = 1;
    if (!CROSSED[tg]) {                           // not reached inside the horizon: extrapolate the straight line
      const rx = S[0] - R.c[0], ry = S[1] - R.c[1], rz = S[2] - R.c[2], al = rx * v[0] + ry * v[1] + rz * v[2], va = S[3] * v[0] + S[4] * v[1] + S[5] * v[2];
      if (al < 0 && va > 1) {
        const tau = -al / va, px = rx + S[3] * tau, py = ry + S[4] * tau, pz = rz + S[5] * tau;
        const a = px * R.e1[0] + py * R.e1[1] + pz * R.e1[2], b = px * R.e2[0] + py * R.e2[1] + pz * R.e2[2];
        probeWorld(S); g = Math.min(g, probeGap(R, a, b, 0, -99)); dev = Math.hypot(a, b) * Math.abs(wrapA(Math.atan2(b, a) - R.thu));
        w = clamp(2.2 / Math.max(2.2, tau), 0.35, 1);
      }
    }
    tgGap = g;
    const e = g - R.G;
    J += w * (e < 0 ? 6 : 1.3) * e * e;
    if (g < 0.35) J += 120 * (0.35 - g) * (0.35 - g);
    J += w * env.wTan * dev * dev;
    if (env.P2 && CROSSED[tg]) {                  // set up for the next one
      const rx = env.P2[0] - S[0], ry = env.P2[1] - S[1], rz = env.P2[2] - S[2], al = rx * v[0] + ry * v[1] + rz * v[2], va = S[3] * v[0] + S[4] * v[1] + S[5] * v[2];
      if (al > 0 && va > 1) { const tau = al / va, mx = rx - S[3] * tau, my = ry - S[4] * tau, mz = rz - S[5] * tau; J += env.wNext * (mx * mx + my * my + mz * mz); }
    }
  } else if (env.aim) {                           // no target: head for a point
    const rx = env.aim[0] - S[0], ry = env.aim[1] - S[1], rz = env.aim[2] - S[2], al = rx * v[0] + ry * v[1] + rz * v[2], va = S[3] * v[0] + S[4] * v[1] + S[5] * v[2];
    if (al > 0 && va > 1) { const tau = al / va, mx = rx - S[3] * tau, my = ry - S[4] * tau, mz = rz - S[5] * tau; J += 0.002 * (mx * mx + my * my + mz * mz); }
  }
  let worstHaz = Infinity;
  for (let j = 0; j < nr; j++) {
    if (j === tg) continue;
    const R = rocks[j], g = GMIN[j]; if (g < worstHaz) worstHaz = g;
    const hs = R.g0 != null ? Math.min(R.Hs, R.g0 - 0.15) : R.Hs, hard = R.g0 != null ? Math.min(0.35, R.g0 - 0.4) : 0.35;
    if (g < hs) J += 30 * (hs - g) * (hs - g);
    if (g < hard) J += 300 * (hard - g) * (hard - g);
  }
  J += 0.015 * act[3] * (Math.abs(act[0]) + Math.abs(act[1]) + Math.abs(act[2]));
  if (turnMax > 0.12) J += 60 * (turnMax - 0.12) * (turnMax - 0.12);
  if (out) { out.tgGap = tgGap; out.worstHaz = worstHaz; out.dev = tg >= 0 ? CROSS[tg] : 0; let wi = -1, wg = Infinity; for (let j = 0; j < nr; j++) if (j !== tg && GMIN[j] < wg) { wg = GMIN[j]; wi = rocks[j].i; } out.worstId = wi; }
  return J;
}
function plan(S0, env, prev) {
  let best = ACTS[ACTS.length - 1], bj = Infinity;
  for (const a of ACTS) {
    let J = rollout(S0, a, env, null);
    if (prev && (a[0] !== prev[0] || a[1] !== prev[1] || a[2] !== prev[2])) J += 0.004;
    if (J < bj) { bj = J; best = a; }   // NaN never wins
  }
  const info = {}; rollout(S0, best, env, info);
  return { act: best, J: bj, ...info };
}

/* ============================ self test (no browser) ============================ */
if (SELFTEST) {
  // a straight run at cruise past a rock 150 m ahead, 20 m right
  const S = new Float64Array(NS); S.set([0, 0, 0, 0, 0, -56, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 9, 0]);
  const v = [0, 0, -1], e1 = [1, 0, 0], e2 = [0, 1, 0];
  const mem = { pts: [], reach: 14, margin: 0.4 };
  for (let k = 0; k < 72; k++) { const th = k * BW; mem.pts.push(11 * Math.cos(th), 11 * Math.sin(th), 0); }
  const T = buildTable(mem, e1, e2, 0);
  const R = { c: [20, 0, -150], reach: 14, win: 22, e1, e2, v, tab: T.tab, smax: T.smax, G: 1.0, Hs: 1.2, care: Infinity, thu: Math.PI };
  const env = { rocks: [R], tg: 0, h: 1 / 60, steps: 240, after: 0.3, tMin: 0, v, boostNow: false, boostT: 0, wTan: 0.04, wNext: 0, P2: null };
  const t0 = Date.now(); let r;
  for (let i = 0; i < 20; i++) r = plan(S, env, null);
  console.log('plan ms', (Date.now() - t0) / 20, r);
  // closed loop on the model alone
  const X = new Float64Array(S); let prev = null, gm = Infinity;
  for (let f = 0; f < 110; f++) {
    const p = plan(X, env, prev); prev = p.act;
    for (let s = 0; s < 4; s++) stepShip(X, p.act[1], p.act[0], p.act[2], false, 1 / 120);
    probeWorld(X); const rx = X[0] - 20, ry = X[1], rz = X[2] + 150; if (Math.abs(rz) < 22) gm = Math.min(gm, probeGap(R, rx, ry, rz, -9) + 0.4);
    if (f % 10 === 0) console.log(f, X.slice(0, 3).map((x) => x.toFixed(2)).join(','), p.act.join(','), p.tgGap && p.tgGap.toFixed(2), p.J.toFixed(2));
  }
  console.log('closest (vs bare 11 m circle):', gm.toFixed(2));
  process.exit(0);
}

/* ============================ flying ============================ */
const g = await open({ width: W, height: H, storage: { 'astra-hard': HARD ? '1' : '0' } });
const { page, state } = g;

let ff = null;
if (RECORD) ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', RECORD], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = [];                                   // per video frame: speed, thrust, boost (for the soundtrack)
const held = new Set();
async function keys(want) {                          // press / release so exactly `want` is held
  for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
async function frame(i) {                            // two 1/60 s steps per 30 fps video frame; draw the second
  await page.evaluate((draw) => { window.__astra.step(1 / 60, false); window.__astra.step(1 / 60, draw); }, !!ff);   // a dry run doesn't draw
  if (ff) { const buf = await page.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
  const s = await state(); frames.push({ t: s.t, speed: s.speed, boosting: s.boosting }); return s;
}
// One look at the world per frame: the ship's state, the rocks around it, and surface rings for the ones that matter.
const sense = (rings) => page.evaluate(([rings]) => {
  const A = window.__astra, st = A.state(), rocks = A.rocks(560), out = {};
  for (const [i, n] of rings) { const a = new Array(n); for (let k = 0; k < n; k++) { const th = (k / n) * Math.PI * 2; a[k] = A.surf(i, Math.cos(th), Math.sin(th)); } out[i] = a; }
  return { st, rocks, rings: out };
}, [rings]);

// ---- title screen for a moment, then launch with Enter
for (let i = 0; i < 45; i++) await frame(i);
await page.keyboard.press('Enter');

const mem = new Map();                               // rock index -> what we know of it
const passed = new Set();
let lastPasses = 0, lastPassT = -99;
let target = null, lastTgt = -1, prevAct = null, lastT = null, boostVis = 0, boostIdle = 9, boostLock = 0, wantBoost = false;
let ringReq = [];
const stats = { picks: 0 };
const log = [], dbg = [], tlog = [];
const T0 = (await state()).t;
const lastPg = new Map();
for (let f = 0; f < SECONDS * 30; f++) {
  const { st: s, rocks: near, rings } = await sense(ringReq);
  const t = s.t - T0, dtSim = lastT == null ? 1 / 30 : Math.max(0, s.t - lastT); lastT = s.t;
  boostVis = appr(boostVis, s.boosting ? 1 : 0, 0.35, dtSim);
  if (s.boosting) boostIdle = 0; else boostIdle += dtSim;
  if (wantBoost && !s.boosting && s.boostE < 0.05) boostLock = 1; if (boostLock && s.boostE > 0.3) boostLock = 0;
  // ship frame, world coordinates
  const pos = s.pos, vel = s.vel, fw = nrm(s.fwd), rt = nrm(cross(fw, s.up)), up = cross(rt, fw), q = quatFromAxes(rt, up, fw);
  const speed = Math.hypot(vel[0], vel[1], vel[2]), vhat = speed > 1 ? mul(vel, 1 / speed) : fw;
  const e1 = nrm(perp(rt, vhat)), e2 = nrm(perp(perp(up, vhat), e1));
  const S0 = new Float64Array(NS); S0.set([...pos, ...vel, ...q, ...s.ang, s.bank, s.boostE, boostVis, s.boosting ? 1 : 0, boostIdle, boostLock]);
  // ---- memory of the rocks
  for (const r of near) {
    const c = add(add(add(pos, mul(rt, r.x)), mul(up, r.y)), mul(fw, r.z));
    let m = mem.get(r.i);
    if (!m || Math.hypot(c[0] - m.c[0], c[1] - m.c[1], c[2] - m.c[2]) > 6) {
      const v = variantOf(r.s, r.reach), wrapped = !!m || (r.gauntlet && r.z < -300);
      m = { i: r.i, c, s: r.s, reach: r.reach, v, gauntlet: r.gauntlet && !wrapped, pts: [], ptT: [], margin: (MARGIN[v] + (r.gauntlet ? 0 : 0.015)) * r.s, delta: 0 };
      mem.set(r.i, m); passed.delete(r.i);
    }
    m.c = c; m.r = r; m.seen = t;
    if (rings[r.i]) {
      const n = rings[r.i].length;
      for (let k = 0; k < n; k++) { const th = (k / n) * TAU, d = add(mul(rt, Math.cos(th)), mul(up, Math.sin(th))), rr = rings[r.i][k]; m.pts.push(d[0] * rr, d[1] * rr, d[2] * rr); m.ptT.push(t); }
    }
    if (m.tracked && r.gap > 0.5) {                // the centre-gap reading is a surface sample on the way in
      const dc = sub(pos, c), L = Math.hypot(dc[0], dc[1], dc[2]), rr = L - r.gap;
      if (rr > 0) { m.pts.push(dc[0] / L * rr, dc[1] / L * rr, dc[2] / L * rr); m.ptT.push(t); }
    }
    const keep = m.gauntlet ? 4 : 0.5;
    if (m.ptT.length && t - m.ptT[0] > keep) { let k = 0; while (k < m.ptT.length && t - m.ptT[k] > keep) k++; m.ptT.splice(0, k); m.pts.splice(0, k * 3); }
    if (m.ptT.length > 4000) { const k = m.ptT.length - 4000; m.ptT.splice(0, k); m.pts.splice(0, k * 3); }
  }
  const nearById = new Map(near.map((r) => [r.i, r]));
  const alongOf = (m) => dot(sub(pos, m.c), vhat);          // < 0: still ahead
  // ---- target bookkeeping
  if (target) { const m = mem.get(target.i), r = nearById.get(target.i); if (!r || alongOf(m) > 2) { passed.add(target.i); tlog.push({ t: +t.toFixed(2), i: target.i, s: m.s, v: m.v, gt: m.gauntlet, G: target.G, pred: target.lastPred, side: target.side }); lastTgt = target.i; target = null; } }
  for (const r of near) { const m = mem.get(r.i); if (alongOf(m) > m.reach + 2) passed.add(r.i); }
  const gaunt = near.map((r) => mem.get(r.i)).filter((m) => m.gauntlet).sort((a, b) => alongOf(b) - alongOf(a));   // nearest ahead first
  const inGauntlet = gaunt.some((m) => !passed.has(m.i) && alongOf(m) < 0);
  const hullSup = (th) => { let best = 0; for (const p of PROBES) best = Math.max(best, p[0] * Math.cos(th) + p[1] * Math.sin(th) + p[3]); return best; };
  // pass direction (unit, world, perpendicular to the flight) for a rock
  const passDir = (m) => {
    if (target && target.i === m.i && target.u) { const d = perp(target.u, vhat); if (Math.hypot(...d) > 0.3) return nrm(d); }
    if (m.gauntlet) {
      const ga = gaunt.filter((o) => o !== m), al = alongOf(m);
      const prev = ga.filter((o) => alongOf(o) > al).sort((a, b) => alongOf(a) - alongOf(b))[0], next = ga.filter((o) => alongOf(o) < al).sort((a, b) => alongOf(b) - alongOf(a))[0];
      let goal = prev && next ? mul(add(prev.c, next.c), 0.5) : (next || prev) ? (next || prev).c : null;
      if (goal) { const d = perp(sub(goal, m.c), vhat); if (Math.hypot(...d) > 1) return nrm(d); }
    }
    const tArr = Math.max(0, -alongOf(m)) / Math.max(20, speed), Q = add(pos, mul(vel, tArr));
    let d = perp(sub(Q, m.c), vhat); if (Math.hypot(...d) < 1) d = mul(rt, -Math.sign(dot(sub(m.c, pos), rt)) || -1);
    d = nrm(d);
    const sx = dot(d, rt), sy = dot(d, up);                 // wing passes trim with A/D: prefer them
    if (Math.abs(sy) < 0.72) d = nrm(add(mul(rt, Math.sign(sx) || 1), mul(up, 0)));
    return d;
  };
  const planPoint = (m, u, G) => {
    const tb = buildTable(m, e1, e2, m.delta), th = Math.atan2(dot(u, e2), dot(u, e1));
    const sx = dot(u, rt), sy = dot(u, up), hs = hullSup(Math.atan2(-sy, -sx));
    return add(m.c, mul(u, lookup(tb.tab, th) + G + hs));
  };
  if (!target) {
    let pick = null;
    if (inGauntlet) {
      const m = gaunt.filter((o) => !passed.has(o.i) && alongOf(o) < -1).sort((a, b) => alongOf(b) - alongOf(a))[0];
      if (m) pick = m;
    } else {
      const cands = [];
      for (const r of near) {
        const m = mem.get(r.i); if (passed.has(r.i) || r.s > 45 || r.s < 3 || r.z < 60 || r.z > 470) continue;
        const ang = Math.atan2(Math.hypot(r.x, r.y), r.z); if (ang > 0.62 || (r.z < 85 && ang > 0.3)) continue;
        const u = passDir(m), P = add(m.c, mul(u, m.reach * 0.85 + 7));
        let clash = 0;
        for (const o of near) { if (o.i === r.i) continue; const mo = mem.get(o.i), d = Math.hypot(...sub(P, mo.c)) - o.reach; if (d < 14) clash += (14 - d); }
        const risk = { rubble: 0, lumpy: 0.2, top: 0.3, potato: 0.6, shard: 1.4, binary: 1.4 }[m.v];
        cands.push({ m, cost: r.z / Math.max(25, speed) + ang * 5 + risk + clash * 0.5 });
      }
      cands.sort((a, b) => a.cost - b.cost);
      if (cands.length) pick = cands[0].m;
    }
    if (pick) { target = { i: pick.i, G: gaim(pick.v, pick.s, pick.gauntlet), t0: t }; if (!pick.gauntlet) target.u = passDir(pick); stats.picks++; }
  }
  if (target) { const m = mem.get(target.i), al = alongOf(m), ang = Math.acos(clamp(dot(nrm(sub(m.c, pos)), vhat), -1, 1)); if (-al > 40 && ang > (m.gauntlet ? 1.4 : 1.0)) { passed.add(target.i); tlog.push({ t: +t.toFixed(2), i: target.i, drop: 1 }); target = null; } }
  // ---- plan
  const tm = target ? mem.get(target.i) : null;
  if (tm) tm.tracked = true;
  const hazards = [];
  for (const r of near) {
    const m = mem.get(r.i); if (tm && m === tm) continue;
    const al = alongOf(m); if (al > m.reach + 8 || -al > speed * 4.3 + m.reach + 10) continue;
    const lat = Math.hypot(...perp(sub(m.c, pos), vhat)); if (lat - m.reach > 75) continue;
    hazards.push({ m, al, lat });
  }
  hazards.sort((a, b) => (a.lat - a.m.reach) - (b.lat - b.m.reach));
  const envRocks = [];
  let uT = null, P2 = null;
  if (tm) {
    uT = passDir(tm); target.side = [+dot(uT, rt).toFixed(2), +dot(uT, up).toFixed(2)];
    const tb = buildTable(tm, e1, e2, tm.delta);
    envRocks.push({ c: tm.c, reach: tm.reach, win: tm.reach + 8, e1, e2, v: vhat, tab: tb.tab, smax: tb.smax, G: target.G, Hs: 1.2, care: Infinity, thu: Math.atan2(dot(uT, e2), dot(uT, e1)), i: tm.i });
    if (inGauntlet) {
      const nx = gaunt.filter((o) => o !== tm && !passed.has(o.i) && alongOf(o) < alongOf(tm)).sort((a, b) => alongOf(b) - alongOf(a))[0];
      if (nx) P2 = planPoint(nx, passDir(nx), gaim(nx.v, nx.s, true));
    }
  }
  const rq = [];
  if (tm) rq.push([tm.i, 72]);
  hazards.slice(0, 9).forEach((hz, k) => { const m = hz.m; const tracked = hz.lat - m.reach < 50; m.tracked = m.tracked || tracked; if (tracked) rq.push([m.i, 36]);
    const tb = m.pts.length ? buildTable(m, e1, e2, m.delta) : circle(m.reach);
    const R = { c: m.c, reach: m.reach, win: m.reach + 8, e1, e2, v: vhat, tab: tb.tab, smax: tb.smax, G: 0, Hs: Math.max(1.1, gaim(m.v, m.s, m.gauntlet) + 0.5), care: 12, thu: 0, i: m.i, g0: null };
    if (m.i === lastTgt && hz.al > 0) { probeWorld(S0); const rel = sub(pos, m.c); R.g0 = probeGap(R, dot(rel, e1), dot(rel, e2), hz.al, -99); R.Hs = Math.min(R.Hs, 1.0); }
    envRocks.push(R); });
  if (P2) { const nx = gaunt.find((o) => o !== tm && !passed.has(o.i) && alongOf(o) < alongOf(tm)); if (nx && !rq.some((q) => q[0] === nx.i)) { rq.push([nx.i, 36]); nx.tracked = true; } }
  ringReq = rq;
  // live probe gap vs the model: if the rock is closer than our silhouette says, widen it now
  let pgMin = Infinity, pgId = -1;
  for (const r of near) {
    if (r.pgap < pgMin) { pgMin = r.pgap; pgId = r.i; }
    const m = mem.get(r.i); if (r.pgap > 8 || !m) continue;
    const R = envRocks.find((e) => e.i === r.i); if (!R) continue;
    const rel = sub(pos, m.c), al = dot(rel, vhat); if (Math.abs(al) > 5) continue;
    probeWorld(S0); const a = dot(rel, e1), b = dot(rel, e2), model = probeGap(R, a, b, al, -99);
    if (r.pgap < model - 0.05) { m.delta += Math.min(1.2, model - r.pgap + 0.1); const tb = buildTable(m, e1, e2, m.delta); R.tab = tb.tab; R.smax = tb.smax; }
  }
  // boost on long clear runs (never inside the gauntlet once under way)
  const tAl = tm ? -alongOf(tm) : Infinity, release = (inGauntlet ? 300 : 200) + Math.max(0, (speed * speed - FMK.cruise * FMK.cruise) / 45);
  const tgtAng = tm ? Math.acos(clamp(dot(nrm(sub(tm.c, pos)), vhat), -1, 1)) : 0;
  const hazClear = hazards.every((hz) => hz.lat - hz.m.reach > 22 || hz.al > 0);
  if (s.passes > lastPasses) { lastPasses = s.passes; lastPassT = t; }
  const streakLeft = 4.7 - (t - lastPassT), chase = !inGauntlet && tm && streakLeft > 0 && tAl > 150 && tAl / Math.max(FMK.cruise, speed) > streakLeft;
  const relUse = chase ? 150 : release;
  wantBoost = (!inGauntlet || t < 3) && tAl > relUse && tgtAng < (inGauntlet ? 0.2 : 0.45) && hazClear && (s.boosting ? s.boostE > 0.04 : s.boostE > (chase ? 0.2 : 0.35));
  let aim = null;
  if (!tm) aim = add(pos, mul(vhat, 400));
  const horizon = tm ? Math.min(4.2, Math.max(1.7, tAl / Math.max(20, speed) + 0.45)) : 3;
  const env = { rocks: envRocks, tg: tm ? 0 : -1, h: 1 / 60, steps: Math.ceil(horizon * 60), after: 0.35, tMin: 1.7, v: vhat, boostNow: wantBoost,
    boostT: wantBoost ? Math.max(0, (tAl - relUse) / Math.max(20, speed)) : 0, wTan: 0.04, wNext: 0.0015, P2, aim };
  const pl = plan(S0, env, prevAct); prevAct = pl.act;
  let tr = null;
  if (tm) { const r = nearById.get(tm.i), R = envRocks[0]; tr = [r.x, r.y, r.z, r.pgap, +lookup(R.tab, R.thu).toFixed(2), +tm.delta.toFixed(2), +tm.margin.toFixed(2), +dot(uT, rt).toFixed(2), +dot(uT, up).toFixed(2)]; }
  if (target) target.lastPred = +pl.tgGap.toFixed(2);
  const [ay, ap, as] = pl.act;
  const want = new Set();
  if (ay > 0) want.add('ArrowRight'); else if (ay < 0) want.add('ArrowLeft');
  if (ap > 0) want.add('ArrowUp'); else if (ap < 0) want.add('ArrowDown');
  let strafe = as;
  // last resort: a surface closer than half a metre and closing -- slide off it
  if (pgMin < 0.45 && pgId >= 0) { const r = nearById.get(pgId), was = lastPg.get(pgId);
    if (was != null && r.pgap < was) { if (Math.abs(r.x) > Math.abs(r.y) * 0.7) strafe = r.x > 0 ? -1 : 1; else { want.delete('ArrowUp'); want.delete('ArrowDown'); want.add(r.y > 0 ? 'ArrowDown' : 'ArrowUp'); } } }
  for (const r of near) lastPg.set(r.i, r.pgap);
  if (strafe > 0) want.add('KeyD'); else if (strafe < 0) want.add('KeyA');
  if (wantBoost) want.add('Shift');
  // look round at the ship mid-flight, and (on hard) back at Vega late on; a burst of the wing guns at a far rock
  const lookAround = (t > 31 && t < 34.5) || (HARD && t > 58 && t < 61);
  if (t > 46 && t < 47.2) want.add('Space');
  await keys(want);
  if (lookAround) { const k = ((t > 50 ? t - 58 : t - 31) / (t > 50 ? 3 : 3.5)), x = W * (0.72 - Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.5); if (!page.__drag) { await page.mouse.move(W * 0.72, H * 0.45); await page.mouse.down(); page.__drag = true; } await page.mouse.move(x, H * 0.45 - Math.sin(k * Math.PI) * 40); }
  else if (page.__drag) { await page.mouse.up(); page.__drag = false; }
  dbg.push({ t: +t.toFixed(3), p: pos, v: vel, f: s.fwd, u: s.up, a: s.ang, b: s.bank, e: s.boostE, bo: s.boosting, k: [...want].join(' '), tg: target ? target.i : -1, G: target ? target.G : 0,
    pg: +(pl.tgGap || 0).toFixed(2), J: +pl.J.toFixed(3), hz: +(pl.worstHaz === Infinity ? 99 : pl.worstHaz).toFixed(2), hi: pl.worstId, pm: [+pgMin.toFixed(2), pgId], hull: s.hull, sc: s.score, tr });
  const st = await frame(f);
  if (f % 30 === 0) log.push(`t=${t.toFixed(0)}s ${st.speed.toFixed(0)} m/s hull ${st.hull} score ${st.score} passes ${st.passes} closest ${st.closest} vega ${st.wing.dist} m ${target ? `target ${target.i} pred ${target.lastPred}` : 'cruising'}`);
}
await keys(new Set());
// End on the pause menu for a beat.
await page.keyboard.press('KeyP'); for (let i = 0; i < 50; i++) await frame(0);
await page.keyboard.press('KeyP'); for (let i = 0; i < 10; i++) await frame(0);

const s = await state(), ev = await page.evaluate(() => window.__astra.events(0));
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
const LOGF = LOG || (RECORD ? RECORD.replace(/\.mp4$/, '.json') : '/tmp/claude-0/pilot-run.json');
fs.writeFileSync(LOGF, JSON.stringify({ frames, events: ev, final: s }));
try { fs.writeFileSync(LOGF.replace(/\.json$/, '') + '.dbg.json', JSON.stringify({ dbg, tlog })); } catch (e) {}
console.log(log.filter((_, i) => i % 3 === 0).join('\n'));
const passes = ev.filter((e) => e.type === 'pass');
console.log(`\n${SECONDS}s flown: ${passes.length} close passes, closest ${s.closest} m, score ${s.score}, ${s.hits} hits (hull ${s.hull}%), ${ev.filter((e) => e.type === 'breach').length} breaches, ${stats.picks} rocks lined up`);
console.log('passes:', passes.map((p) => `${p.gap}m/${p.part}`).join(' '));
console.log('radio:', ev.filter((e) => e.type === 'radio').map((e) => e.text).join(' | '));
console.log('errors:', g.errors.filter((e) => !e.includes('ERR_TOO_MANY_RETRIES')).slice(0, 5));
await g.browser.close();
