// Claude flies Astra Adventures with a SAMPLING PLANNER. Every frame it samples ~150-250 candidate aim directions
// in a cone ahead (a coarse grid round the flight path, plus aim points set a metre or two off the surface of
// each promising rock on eight sides), rolls each one out 2.4 s through a re-implementation of the Jupiter's
// flight model (Ship.update, Hard values) steered by the same damped (PD) bang-bang controller that presses the
// arrow keys, measures every hull probe against each nearby rock's surface ring (read through __astra.surf),
// and scores the rollout by the expected value of the passes it makes (knife edge > tight > close, contact very
// bad, with an uncertainty that grows with lead time and with how far the rock type can bulge off its ring),
// plus a look-ahead term that pulls the nose toward the next rocks. The best candidates are hill-climbed in aim,
// then tried with short A/D slide pulses for the last metres of lateral trim, and the keys of the winner's first
// frame are pressed. Every input is a real key press through the browser; the game is only read via __astra.
//   node tools/lab/pilot-sampler.mjs [--record out.mp4] [--seconds 70] [--width 1600 --height 900] [--hard] [--log f]
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const LIB = !!process.env.SAMPLER_LIB;                 // imported by a self-test: export the planner, fly nothing
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const RECORD = arg('record', null), SECONDS = +arg('seconds', 70), W = +arg('width', 1280), H = +arg('height', 720);
const HARD = process.argv.includes('--hard') || LIB, LOG = arg('log', null);
const FFMPEG = '/home/user/incident-animation-3d/cartoons/node_modules/ffmpeg-static/ffmpeg';

/* ================================ the ship: probes and flight model ================================ */
// The 23 collision probes ship with the model (assets/jupiter.json): ship-local +X right, +Y up, -Z forward.
const SHIP = JSON.parse(fs.readFileSync(new URL('../../assets/jupiter.json', import.meta.url), 'utf8'));
const PX = Float64Array.from(SHIP.samples, (s) => s.p[0]), PY = Float64Array.from(SHIP.samples, (s) => s.p[1]);
const PZ = Float64Array.from(SHIP.samples, (s) => s.p[2]), PR = Float64Array.from(SHIP.samples, (s) => s.r);
const NP = PX.length;
let SHIP_R = 0; for (let p = 0; p < NP; p++) SHIP_R = Math.max(SHIP_R, Math.hypot(PX[p], PY[p], PZ[p]) + PR[p]);
// How far the hull reaches from its centre toward angle phi in its own cross-section plane (x right, y up).
const NE = 180, EXT = new Float64Array(NE);
for (let k = 0; k < NE; k++) { const a = (k / NE) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); let m = 0; for (let p = 0; p < NP; p++) m = Math.max(m, PX[p] * c + PY[p] * s + PR[p]); EXT[k] = m; }
const TAU = Math.PI * 2;
const extAt = (phi) => { let k = Math.round((phi / TAU) * NE) % NE; if (k < 0) k += NE; return EXT[k]; };

// Game.html FM + DIFF (Hard: cruise 56, boost 132).
const FM = { cruise: HARD ? 56 : 42, boost: HARD ? 132 : 108, accel: 18, boostAccel: 58, decel: 20, boostDecel: 30, pitchRate: 1.1, yawRate: 0.95, rbs: 0.7,
  tauIn: 0.27, tauOut: 0.36, strafe: 20, strafeTau: 0.42, drift: 0.95, level: 0.6, drain: 0.24, recharge: 0.15, delay: 0.8 };
let EXC = new Map();
function EF(h) {
  let e = EXC.get(h);
  if (!e) {
    if (EXC.size > 400) EXC = new Map();
    e = { rin: Math.exp(-h / FM.tauIn), rout: Math.exp(-h / FM.tauOut), roll: Math.exp(-h / 0.35), bv: Math.exp(-h / 0.35), st: Math.exp(-h / FM.strafeTau), dr: Math.exp(-h / FM.drift), bk: Math.exp(-h / 0.22) };
    EXC.set(h, e);
  }
  return e;
}
// One Ship.update step. The PLAN frame is the ship's own local frame at planning time (x right, y up, z back), so
// the state starts at the origin with an identity quaternion. (A0, A1, A2) is world up in that frame.
function step(S, pitch, yaw, strafe, boost, h, e, A0, A1, A2) {
  if (boost && !S.lock && S.bE > 0.01) { S.bst = 1; S.bE = Math.max(0, S.bE - h * FM.drain); S.idle = 0; if (S.bE <= 0) S.lock = 1; }
  else { S.bst = 0; S.idle += h; if (S.idle > FM.delay) S.bE = Math.min(1, S.bE + h * FM.recharge); if (S.lock && S.bE > 0.3) S.lock = 0; }
  S.bvis = S.bst + (S.bvis - S.bst) * e.bv;
  const rs = 1 + (FM.rbs - 1) * S.bvis;
  let tg = pitch * FM.pitchRate * rs; S.wx = tg + (S.wx - tg) * (pitch ? e.rin : e.rout);
  tg = -yaw * FM.yawRate * rs; S.wy = tg + (S.wy - tg) * (yaw ? e.rin : e.rout);
  S.wz *= e.roll;
  const hx = S.wx * h * 0.5, hy = S.wy * h * 0.5, hz = S.wz * h * 0.5;
  const c1 = Math.cos(hx), s1 = Math.sin(hx), c2 = Math.cos(hy), s2 = Math.sin(hy), c3 = Math.cos(hz), s3 = Math.sin(hz);
  const bx = s1 * c2 * c3 + c1 * s2 * s3, by = c1 * s2 * c3 - s1 * c2 * s3, bz = c1 * c2 * s3 + s1 * s2 * c3, bw = c1 * c2 * c3 - s1 * s2 * s3;
  let qx = S.qx, qy = S.qy, qz = S.qz, qw = S.qw;
  let nx = qx * bw + qw * bx + qy * bz - qz * by, ny = qy * bw + qw * by + qz * bx - qx * bz, nz = qz * bw + qw * bz + qx * by - qy * bx, nw = qw * bw - qx * bx - qy * by - qz * bz;
  const L = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw); qx = nx * L; qy = ny * L; qz = nz * L; qw = nw * L;
  const rx = 1 - 2 * (qy * qy + qz * qz), ry = 2 * (qx * qy + qw * qz), rz = 2 * (qx * qz - qw * qy);
  const ux = 2 * (qx * qy - qw * qz), uy = 1 - 2 * (qx * qx + qz * qz), uz = 2 * (qy * qz + qw * qx);
  const fx = -2 * (qx * qz + qw * qy), fy = -2 * (qy * qz - qw * qx), fz = -(1 - 2 * (qx * qx + qy * qy));
  const fup = fx * A0 + fy * A1 + fz * A2;
  if (Math.abs(fup) < 0.94) {                         // the flight assist rolls the wings back towards level
    let dx = A0 - fx * fup, dy = A1 - fy * fup, dz = A2 - fz * fup; const dl = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz); dx *= dl; dy *= dl; dz *= dl;
    const cx = uy * dz - uz * dy, cy = uz * dx - ux * dz, cz = ux * dy - uy * dx;
    const err = Math.atan2(cx * fx + cy * fy + cz * fz, ux * dx + uy * dy + uz * dz);
    const a = (err < -1 ? -1 : err > 1 ? 1 : err) * FM.level * h * (1 - Math.abs(fup)) * 0.5, sa = Math.sin(a), ax = fx * sa, ay = fy * sa, az = fz * sa, aw = Math.cos(a);
    nx = aw * qx + ax * qw + ay * qz - az * qy; ny = aw * qy + ay * qw + az * qx - ax * qz; nz = aw * qz + az * qw + ax * qy - ay * qx; nw = aw * qw - ax * qx - ay * qy - az * qz;
    qx = nx; qy = ny; qz = nz; qw = nw;
  }
  S.qx = qx; S.qy = qy; S.qz = qz; S.qw = qw;
  let fs = S.vx * fx + S.vy * fy + S.vz * fz, vr = S.vx * rx + S.vy * ry + S.vz * rz, vu = S.vx * ux + S.vy * uy + S.vz * uz;
  const target = S.bst ? FM.boost : FM.cruise;
  if (fs < target) fs = Math.min(target, fs + (S.bst ? FM.boostAccel : FM.accel) * h); else fs = Math.max(target, fs - (S.bvis > 0.05 ? FM.boostDecel : FM.decel) * h);
  vr = strafe ? strafe * FM.strafe + (vr - strafe * FM.strafe) * e.st : vr * e.dr;
  vu *= e.dr;
  S.vx = fx * fs + rx * vr + ux * vu; S.vy = fy * fs + ry * vr + uy * vu; S.vz = fz * fs + rz * vr + uz * vu;
  S.px += S.vx * h; S.py += S.vy * h; S.pz += S.vz * h;
  tg = -S.wy * 0.85 + vr * 0.02; tg = tg < -1.1 ? -1.1 : tg > 1.1 ? 1.1 : tg; S.bank = tg + (S.bank - tg) * e.bk;
}
const copyS = (S) => ({ px: S.px, py: S.py, pz: S.pz, vx: S.vx, vy: S.vy, vz: S.vz, qx: S.qx, qy: S.qy, qz: S.qz, qw: S.qw, wx: S.wx, wy: S.wy, wz: S.wz, bank: S.bank, bE: S.bE, bst: S.bst, bvis: S.bvis, idle: S.idle, lock: S.lock });

/* ================================ the controller (the same one in the rollout and at the keys) ================================ */
const KD = 0.38, DB = 0.012;
const KEY = { yaw: 0, pitch: 0 };
function ctrl(S, ax, ay, az) {                        // bang-bang PD toward a fixed aim direction (plan frame)
  const qx = S.qx, qy = S.qy, qz = S.qz, qw = S.qw;
  const lx = (1 - 2 * (qy * qy + qz * qz)) * ax + 2 * (qx * qy + qw * qz) * ay + 2 * (qx * qz - qw * qy) * az;
  const ly = 2 * (qx * qy - qw * qz) * ax + (1 - 2 * (qx * qx + qz * qz)) * ay + 2 * (qy * qz + qw * qx) * az;
  const lz = 2 * (qx * qz + qw * qy) * ax + 2 * (qy * qz - qw * qx) * ay + (1 - 2 * (qx * qx + qy * qy)) * az;
  const yawErr = Math.atan2(lx, -lz), pitchErr = Math.atan2(ly, Math.sqrt(lx * lx + lz * lz));
  const py = yawErr + S.wy * KD, pp = pitchErr - S.wx * KD;
  KEY.yaw = py > DB ? 1 : py < -DB ? -1 : 0; KEY.pitch = pp > DB ? 1 : pp < -DB ? -1 : 0;
}

/* ================================ rock types ================================ */
// A rock's type shows in reach / scale (its variant's max radius). How far a type's true pass gap can fall
// short of the ring model (the surface cross-section through its centre, square to the nose): the 97th
// percentile, in units of scale, measured offline over random orientations from the same radial tables.
const TYPES = [[1.5303, 0.177], [1.1756, 0.055], [1.5213, 0.39], [1.7003, 0.38], [1.3386, 0.093], [1.2752, 0.09]];
function shapeMargin(s, reach) {
  const ratio = reach / Math.max(s, 0.1); let best = null, bd = 1e9;
  for (const [r, m] of TYPES) { const d = Math.abs(r - ratio); if (d < bd) { bd = d; best = m; } }
  const tol = 0.006 + 0.03 / Math.max(s, 1);
  return (bd < tol ? best + 0.015 : 0.3) * s;
}

/* ================================ values ================================ */
// A hit is -450 and voids the pass, and on Hard it can take 60 hull: two of those and the breach costs 3000.
let HIT_COST = 1200;
function passVal(g, spd, mult) {                       // score.mjs for one pass, plus the game points / 25
  if (g < 0) return -HIT_COST;
  if (g >= 9) return 0;
  const k = (9 - g) / 9, pts = (60 + 440 * k * Math.sqrt(k)) * (spd / 42) * mult * 1.6;
  return 100 + (g < 1.6 ? 150 : 0) + (g < 3 ? 60 : 0) + pts / 25;
}
// Expected value over the shape shortfall u (skewed: mostly ~0, a tail to the type's margin) and a Gaussian
// prediction error that grows with lead time.
const UQ = [0.02, 0.12, 0.3, 0.55, 0.85, 1.3], UW = [0.3, 0.2, 0.3, 0.1, 0.07, 0.03];
const ZQ = [-1.732, 0, 1.732], ZW = [1 / 6, 2 / 3, 1 / 6];
function evPass(g, spd, mult, tau, M, spinK) {
  const sig = 0.08 + 0.2 * tau + spinK * tau + 0.0015 * spd * tau;
  let ev = 0;
  for (let a = 0; a < 6; a++) { const gu = g - UQ[a] * M; for (let b = 0; b < 3; b++) ev += UW[a] * ZW[b] * passVal(gu + ZQ[b] * sig, spd, mult); }
  return ev;
}

/* ================================ the rollout ================================ */
const NR = 72, NR_K = NR / TAU;
const NF = 72;                                         // 2.4 s ahead: 1/120 steps (the game's) for 0.4 s, 1/60 to 1.2 s, then 1/30
function ringAt(P, j, dx, dy) {
  const o = P.ro[j]; if (o < 0) return P.rR[j];
  let f = Math.atan2(dy, dx) * NR_K; if (f < 0) f += NR;
  let i0 = f | 0; const fr = f - i0; if (i0 >= NR) i0 -= NR; const i1 = i0 + 1 === NR ? 0 : i0 + 1;
  const a = P.rb[o + i0]; return a + (P.rb[o + i1] - a) * fr;
}
// Probe-level gap of the ship state S to rock j (the game's gapTo: radial, from the rock centre).
function probeGap(P, j, S) {
  const sb = Math.sin(S.bank * 0.5), cb = Math.cos(S.bank * 0.5);
  const x = S.qx * cb - S.qy * sb, y = S.qy * cb + S.qx * sb, z = S.qz * cb - S.qw * sb, w = S.qw * cb + S.qz * sb;
  const m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - w * z), m02 = 2 * (x * z + w * y);
  const m10 = 2 * (x * y + w * z), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - w * x);
  const m20 = 2 * (x * z - w * y), m21 = 2 * (y * z + w * x), m22 = 1 - 2 * (x * x + y * y);
  const ox = S.px - P.cx[j], oy = S.py - P.cy[j], oz = S.pz - P.cz[j];
  let g = 1e9;
  for (let p = 0; p < NP; p++) {
    const ex = ox + m00 * PX[p] + m01 * PY[p] + m02 * PZ[p], ey = oy + m10 * PX[p] + m11 * PY[p] + m12 * PZ[p], ez = oz + m20 * PX[p] + m21 * PY[p] + m22 * PZ[p];
    const gg = Math.sqrt(ex * ex + ey * ey + ez * ez) - ringAt(P, j, ex, ey) - PR[p];
    if (gg < g) g = gg;
  }
  return g;
}
// Work arrays, sized to the rock list.
const WK = { n: 0, min: null, tmin: null, spd: null, last: null, done: null };
function sizeWork(n) { if (WK.n >= n) return; WK.n = n + 64; for (const k of ['min', 'tmin', 'spd', 'last']) WK[k] = new Float64Array(WK.n); WK.done = new Uint8Array(WK.n); }
const RES = { yaw: 0, pitch: 0, strafe: 0, boost: 0, value: 0, passes: null, pen: 0 };
function rollout(P, cand, wantInfo) {
  const S = copyS(P.S0), A0 = P.AY[0], A1 = P.AY[1], A2 = P.AY[2];
  const ci = P.ci, nc = ci.length;
  for (let a = 0; a < nc; a++) { const j = ci[a]; WK.min[j] = 1e9; WK.last[j] = 1e9; WK.done[j] = 0; }
  let t = 0, pen = 0; const ax = cand.ax, ay = cand.ay, az = cand.az;
  for (let k = 0; k < NF; k++) {
    ctrl(S, ax, ay, az);
    const yaw = KEY.yaw, pitch = KEY.pitch, strafe = k < cand.sN ? cand.sg : 0, boost = k < cand.bN ? 1 : 0;
    if (k === 0) { RES.yaw = yaw; RES.pitch = pitch; RES.strafe = strafe; RES.boost = boost; }
    const nsub = k < 12 ? 4 : k < 36 ? 2 : 1, h = (k === 0 ? P.dt0 : 1 / 30) / nsub, e = EF(h);
    for (let sub = 0; sub < nsub; sub++) {
      step(S, pitch, yaw, strafe, boost, h, e, A0, A1, A2); t += h;
      const px = S.px, py = S.py, pz = S.pz;
      for (let a = 0; a < nc; a++) {
        const j = ci[a];
        if (WK.done[j]) continue;
        const dx = px - P.cx[j], dy = py - P.cy[j], dz = pz - P.cz[j], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > P.chk2[j]) { if (WK.min[j] < 9) WK.done[j] = 1; continue; }
        const gc = Math.sqrt(d2) - ringAt(P, j, dx, dy) - SHIP_R;
        if (gc > 9.4) { if (WK.min[j] < 9) WK.done[j] = 1; continue; }
        const g = probeGap(P, j, S) + P.bias[j];
        if (g < WK.min[j]) { WK.min[j] = g; WK.tmin[j] = t; WK.spd[j] = Math.sqrt(S.vx * S.vx + S.vy * S.vy + S.vz * S.vz); }
        else if (WK.min[j] < 9 && g > WK.min[j] + 0.35) WK.done[j] = 1;
        WK.last[j] = g;
        if (g < 0.3) pen += (0.3 - g) * h * 600;
      }
    }
  }
  // Passes made inside the horizon, in time order, with the streak multiplier they would carry.
  const vs = Math.sqrt(S.vx * S.vx + S.vy * S.vy + S.vz * S.vz), vx = S.vx / vs, vy = S.vy / vs, vz = S.vz / vs;
  let list = null;
  for (let a = 0; a < nc; a++) {
    const j = ci[a]; if (WK.min[j] >= 9) continue;
    let g = WK.min[j];
    if (!WK.done[j]) {                                // still closing at the horizon: extrapolate the straight line
      const dx = P.cx[j] - S.px, dy = P.cy[j] - S.py, dz = P.cz[j] - S.pz, al = dx * vx + dy * vy + dz * vz;
      if (al > 0) { const wx = dx - vx * al, wy = dy - vy * al, wz = dz - vz * al, miss = Math.sqrt(wx * wx + wy * wy + wz * wz); g = Math.min(g, miss - ringAt(P, j, -wx, -wy) - extAt(Math.atan2(wy, wx)) + P.bias[j]); }
    }
    (list || (list = [])).push([WK.tmin[j], j, g, WK.spd[j]]);
  }
  let value = -pen;
  let streak = P.streak, last = P.lastPass;
  if (list) {
    list.sort((p, q) => p[0] - q[0]);
    for (const p of list) {
      streak = p[0] - last < 5 ? streak + 1 : 1; last = p[0];
      const mult = Math.min(4, 1 + (streak - 1) * 0.5);
      p.push(evPass(p[2], p[3], mult, p[0], P.M[p[1]], P.spinK[p[1]]));
      value += p[4];
    }
  }
  // The multiplier is worth keeping: if the streak is still alive when the horizon ends, the passes after it
  // score up to 4x. (Every rollout shares this while the last pass was recent; it only separates them when the
  // streak is about to lapse and one line reaches a rock in time.)
  if (t - last < 5) value += 60 * (Math.min(4, 1 + (streak - 1) * 0.5) - 1);
  // Look-ahead past the horizon: lines that pass rocks later, and rocks the nose is turning toward.
  let opp = 0; const T = t;
  for (let a = 0, n = P.tn; a < n; a++) {
    const j = P.ti[a];
    if (P.rc[j] && WK.min[j] < 9) continue;
    const dx = P.cx[j] - S.px, dy = P.cy[j] - S.py, dz = P.cz[j] - S.pz, al = dx * vx + dy * vy + dz * vz;
    if (al < 0) continue;
    const wx = dx - vx * al, wy = dy - vy * al, wz = dz - vz * al, miss = Math.sqrt(wx * wx + wy * wy + wz * wz);
    const gx = miss - ringAt(P, j, -wx, -wy) - extAt(Math.atan2(wy, wx));
    if (al < 200 && gx < 9) {
      const v = evPass(gx, vs, 2.5, T + al / vs, P.M[j] + 0.004 * al, P.spinK[j]); value += v * (v > 0 ? 0.55 : 0.3);
    } else if (al > 20) {
      const aa = Math.max(0, gx - 1.5) / Math.max(al, 40); opp += 70 * Math.exp(-(aa * aa) / 0.0256) * Math.exp(-al / 450);
    }
  }
  value += Math.min(260, opp);
  RES.value = value; RES.pen = pen; RES.passes = wantInfo ? list : null;
  return value;
}

/* ================================ the planner ================================ */
const aimOf = (psi, th) => { const c = Math.cos(th); return [Math.sin(psi) * c, Math.sin(th), -Math.cos(psi) * c]; };
const angOf = (a) => [Math.atan2(a[0], -a[2]), Math.atan2(a[1], Math.hypot(a[0], a[2]))];
function mkCand(aim, sg = 0, sN = 0, bN = 0, tag = '') { const L = Math.hypot(aim[0], aim[1], aim[2]) || 1; return { ax: aim[0] / L, ay: aim[1] / L, az: aim[2] / L, sg, sN, bN, tag, v: -1e9 }; }
function evalC(P, c) { c.v = rollout(P, c, false) + (c.tag === 'prev' ? 4 : 0); c.k = [RES.yaw, RES.pitch, RES.strafe, RES.boost]; return c.v; }
const STATS = { rollouts: 0 };
function plan(P, prev) {
  const S0 = P.S0, vs = Math.hypot(S0.vx, S0.vy, S0.vz) || 1, v = [S0.vx / vs, S0.vy / vs, S0.vz / vs];
  const [psi0, th0] = angOf(v);
  const C = [];
  const canBoost = S0.bE > 0.3 && !S0.lock;
  if (prev) C.push(mkCand(prev.aim, prev.sg, Math.max(0, prev.sN - 1), Math.max(0, prev.bN - 1), 'prev'));
  for (const dp of [0, -0.07, 0.07, -0.18, 0.18, -0.4, 0.4]) for (const dt of [0, -0.1, 0.1, -0.28, 0.28]) C.push(mkCand(aimOf(psi0 + dp, th0 + dt), 0, 0, 0, 'grid'));
  // Aim points just off the surface of the most promising rocks, on eight sides and on the side the path is on.
  const tg = [];
  for (let a = 0; a < P.tn; a++) {
    const j = P.ti[a], cx = P.cx[j], cy = P.cy[j], cz = P.cz[j], al = cx * v[0] + cy * v[1] + cz * v[2];
    if (al < 25 || al > 520 || P.rR[j] > 60) continue;
    const wx = cx - v[0] * al, wy = cy - v[1] * al, wz = cz - v[2] * al, miss = Math.hypot(wx, wy, wz);
    const need = Math.max(0, Math.abs(miss - (P.rR[j] * 0.85 + 5)) - 3) / al;
    if (need > 0.7) continue;
    tg.push([Math.exp(-need / 0.15) * Math.exp(-al / 380) / (1 + P.M[j] / 3), j, Math.atan2(-wy, -wx)]);
  }
  tg.sort((a, b) => b[0] - a[0]);
  for (const [, j, thp] of tg.slice(0, 7)) {
    const sides = [thp, thp + 0.35, thp - 0.35]; for (let k = 0; k < 8; k++) sides.push((k * Math.PI) / 4 + 0.2);
    const gd = 1.1 + 0.45 * P.M[j];
    for (const th of sides) {
      const c = Math.cos(th), s = Math.sin(th), R = P.ro[j] >= 0 ? ringAt(P, j, c, s) : P.rR[j] * 0.85, off = R + extAt(th + Math.PI) + gd;
      C.push(mkCand([P.cx[j] + off * c, P.cy[j] + off * s, P.cz[j]], 0, 0, 0, 't' + j));
    }
  }
  for (const c of C) evalC(P, c);
  STATS.rollouts += C.length;
  C.sort((a, b) => b.v - a.v);
  // Hill-climb the aim of the best few, then try slide pulses and boost on the best.
  const top = [];
  for (const c of C) { if (top.length >= 4) break; if (top.every((o) => Math.abs(o.ax - c.ax) + Math.abs(o.ay - c.ay) + Math.abs(o.az - c.az) > 0.01)) top.push(c); }
  let n = 0;
  const climb = (c0, steps) => {
    let best = c0;
    for (const d of steps) {
      let improved = true, guard = 0;
      while (improved && guard++ < 3) {
        improved = false; const [ps, th] = angOf([best.ax, best.ay, best.az]);
        for (const [a, b] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
          const c = mkCand(aimOf(ps + a, th + b), best.sg, best.sN, best.bN, best.tag + '~'); evalC(P, c); n++;
          if (c.v > best.v + 0.01) { best = c; improved = true; }
        }
      }
    }
    return best;
  };
  let best = null;
  for (const c of top) { const r = climb(c, [0.02, 0.006]); if (!best || r.v > best.v) best = r; }
  const base = best;
  for (const sg of [-1, 1]) for (const sN of [1, 2, 4, 7, 11]) { const c = mkCand([base.ax, base.ay, base.az], sg, sN, base.bN, base.tag + (sg > 0 ? 'D' : 'A') + sN); evalC(P, c); n++; if (c.v > best.v) best = c; }
  if (canBoost || S0.bst) {
    rollout(P, best, true); const idle = !RES.passes;               // no pass inside the horizon: an empty stretch
    for (const bN of best.bN ? [0, best.bN + 12] : [12, 36]) {
      const c = mkCand([best.ax, best.ay, best.az], best.sg, best.sN, bN, best.tag + 'B' + bN); evalC(P, c); n++;
      if (c.v > best.v || (idle && bN >= 36 && S0.bE > 0.5 && c.v > best.v - 8)) best = c;   // cross empty space fast
    }
  }
  best = climb(best, [0.0025]);
  STATS.rollouts += n;
  rollout(P, best, true);
  return { best, keys: { yaw: RES.yaw, pitch: RES.pitch, strafe: RES.strafe, boost: RES.boost }, value: RES.value, passes: RES.passes, ncand: C.length + n };
}

// Plan context from the game's own readings: state, rocks(), and surface rings from surf().
function buildPlan(s, rs, rings, trk, dt0) {
  const n = rs.length, P = { n, cx: new Float64Array(n), cy: new Float64Array(n), cz: new Float64Array(n), chk2: new Float64Array(n), ro: new Int32Array(n).fill(-1), rR: new Float64Array(n),
    rc: new Uint8Array(n), M: new Float64Array(n), spinK: new Float64Array(n), bias: new Float64Array(n), idx: new Int32Array(n), ci: [], ti: [], tn: 0 };
  const ringMap = new Map(rings.map((r) => [r[0], r[1]]));
  P.rb = new Float64Array(rings.length * NR);
  let o = 0;
  rs.forEach((r, j) => {
    P.idx[j] = r.i; P.cx[j] = r.x; P.cy[j] = r.y; P.cz[j] = -r.z; P.rR[j] = r.reach;
    P.M[j] = shapeMargin(r.s, r.reach);
    P.spinK[j] = r.gauntlet ? 0 : (r.s > 17 ? 0.037 : 0.082) * 0.18 * r.s;
    const ring = ringMap.get(r.i);
    if (ring) { P.ro[j] = o; let mx = 0; for (let k = 0; k < NR; k++) { P.rb[o + k] = ring[k]; if (ring[k] > mx) mx = ring[k]; } o += NR; P.rc[j] = 1; P.ci.push(j); P.chk2[j] = (mx + SHIP_R + 10) ** 2; }
    if (r.z > -r.reach - 5) P.ti.push(j);
  });
  P.tn = P.ti.length;
  sizeWork(n);
  const f = s.fwd, rt = s.right, u = s.up, V = s.vel;
  P.AY = [rt[1], u[1], -f[1]];
  P.S0 = { px: 0, py: 0, pz: 0, vx: V[0] * rt[0] + V[1] * rt[1] + V[2] * rt[2], vy: V[0] * u[0] + V[1] * u[1] + V[2] * u[2], vz: -(V[0] * f[0] + V[1] * f[1] + V[2] * f[2]),
    qx: 0, qy: 0, qz: 0, qw: 1, wx: s.ang[0], wy: s.ang[1], wz: s.ang[2], bank: s.bank, bE: s.boostE, bst: s.boosting ? 1 : 0, bvis: trk.bvis, idle: trk.idle, lock: trk.lock ? 1 : 0 };
  P.dt0 = dt0; P.streak = s.streak; P.lastPass = trk.lastPassT - s.t;
  HIT_COST = 1200 + 25 * (100 - s.hull);
  // What the ring model says the nearest probe is now, against the game's pgap: when it reads closer than we
  // think, carry the difference into the prediction for that rock.
  P.near = [];
  for (const j of P.ci) {
    const r = rs[j]; if (r.pgap > 12) continue;
    const mg = probeGap(P, j, P.S0), b = r.pgap - mg;
    if (b < 0) P.bias[j] = b;
    P.near.push([r.i, r.pgap, +mg.toFixed(2), r.s, r.reach, +P.M[j].toFixed(2)]);
  }
  return P;
}

export { step, copyS, ctrl, KEY, rollout, plan, buildPlan, probeGap, ringAt, passVal, evPass, shapeMargin, EF, FM, NR, NF, SHIP_R, extAt, STATS, RES };

/* ================================ flying ================================ */
if (!LIB) {
  const { open } = await import('../harness.mjs');
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
    const s = await page.evaluate((draw) => { window.__astra.step(1 / 60, false); window.__astra.step(1 / 60, draw); return window.__astra.state(); }, !!ff);   // a dry run doesn't draw
    if (ff) { const buf = await page.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
    frames.push({ t: s.t, speed: s.speed, boosting: s.boosting }); return s;
  }
  // One read per frame: the state, every rock within 620 m, and a 72-sample surface ring for each rock the
  // next 2.4 s could reach.
  const sense = () => page.evaluate(([maxD, zMax, latX, NR]) => {
    const A = window.__astra, s = A.state(), rs = A.rocks(maxD), rings = [];
    for (const r of rs) {
      if (r.z < -r.reach - 30 || r.z > zMax + r.reach || Math.hypot(r.x, r.y) > r.reach + latX) continue;
      const a = new Array(NR); for (let k = 0; k < NR; k++) { const th = (k / NR) * Math.PI * 2; a[k] = A.surf(r.i, Math.cos(th), Math.sin(th)); }
      rings.push([r.i, a]);
    }
    return { s, rs, rings };
  }, [620, 340, 115, NR]);

  // ---- title screen for a moment, then launch with Enter
  let st = null;
  for (let i = 0; i < 45; i++) st = await frame(i);
  await page.keyboard.press('Enter');

  const trk = { bvis: 0, idle: 9, lock: false, lastPassT: -99, passes: 0 };
  let prev = null, dt0 = 1 / 30, pred = null;
  const log = [], dbg = [], modelErr = [];
  const T0 = (await state()).t;
  const tPlan0 = Date.now(); let planMs = 0;
  for (let f = 0; f < SECONDS * 30; f++) {
    const { s, rs, rings } = await sense(), t = s.t - T0;
    if (pred) { const e = Math.hypot(s.pos[0] - pred[0], s.pos[1] - pred[1], s.pos[2] - pred[2]); modelErr.push(e); pred = null; }
    const tp = Date.now();
    const P = buildPlan(s, rs, rings, trk, dt0);
    // carry the previous winner's aim across (it is fixed in the world, re-expressed in the new plan frame)
    let prevC = null;
    if (prev) { const a = prev.aimW; prevC = { aim: [a[0] * s.right[0] + a[1] * s.right[1] + a[2] * s.right[2], a[0] * s.up[0] + a[1] * s.up[1] + a[2] * s.up[2], -(a[0] * s.fwd[0] + a[1] * s.fwd[1] + a[2] * s.fwd[2])], sg: prev.sg, sN: prev.sN, bN: prev.bN }; }
    const R = plan(P, prevC);
    planMs += Date.now() - tp;
    const b = R.best, aw = [s.right[0] * b.ax + s.up[0] * b.ay - s.fwd[0] * b.az, s.right[1] * b.ax + s.up[1] * b.ay - s.fwd[1] * b.az, s.right[2] * b.ax + s.up[2] * b.ay - s.fwd[2] * b.az];
    prev = { aimW: aw, sg: b.sg, sN: b.sN, bN: b.bN };
    // where the model says we will be after this frame (checked against the game next frame)
    { const S = copyS(P.S0), e = EF(dt0 / 4); for (let k = 0; k < 4; k++) step(S, R.keys.pitch, R.keys.yaw, R.keys.strafe, R.keys.boost, dt0 / 4, e, P.AY[0], P.AY[1], P.AY[2]);
      pred = [s.pos[0] + s.right[0] * S.px + s.up[0] * S.py - s.fwd[0] * S.pz, s.pos[1] + s.right[1] * S.px + s.up[1] * S.py - s.fwd[1] * S.pz, s.pos[2] + s.right[2] * S.px + s.up[2] * S.py - s.fwd[2] * S.pz]; }
    const want = new Set();
    if (R.keys.yaw > 0) want.add('ArrowRight'); else if (R.keys.yaw < 0) want.add('ArrowLeft');
    if (R.keys.pitch > 0) want.add('ArrowUp'); else if (R.keys.pitch < 0) want.add('ArrowDown');
    if (R.keys.strafe > 0) want.add('KeyD'); else if (R.keys.strafe < 0) want.add('KeyA');
    if (R.keys.boost) want.add('Shift');
    // Set pieces: a look round at the ship mid-flight (and, on hard, back at Vega late on), and a burst of the
    // wing guns at a far rock.
    const lookAround = (t > 31 && t < 34.5) || (HARD && t > 58 && t < 61);
    if (t > 46 && t < 47.2) want.add('Space');
    await keys(want);
    if (lookAround) { const k = ((t > 50 ? t - 58 : t - 31) / (t > 50 ? 3 : 3.5)), x = W * (0.72 - Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.5); if (!page.__drag) { await page.mouse.move(W * 0.72, H * 0.45); await page.mouse.down(); page.__drag = true; } await page.mouse.move(x, H * 0.45 - Math.sin(k * Math.PI) * 40); }
    else if (page.__drag) { await page.mouse.up(); page.__drag = false; }
    st = await frame(f);
    // trackers for what state() does not expose: the boost glow, the recharge delay, the lock, the last pass
    const sdt = st.t - s.t; if (sdt > 0) dt0 = Math.min(1 / 30, Math.max(1 / 240, sdt));
    trk.bvis = (st.boosting ? 1 : 0) + (trk.bvis - (st.boosting ? 1 : 0)) * Math.exp(-sdt / 0.35);
    trk.idle = st.boosting ? 0 : trk.idle + sdt;
    if (st.boosting && st.boostE <= 0.001) trk.lock = true; if (trk.lock && st.boostE > 0.3) trk.lock = false;
    if (st.passes > trk.passes) { trk.passes = st.passes; trk.lastPassT = st.t; }
    dbg.push([+t.toFixed(3), R.ncand, +R.value.toFixed(0), [...want].join('+'), b.tag, (R.passes || []).slice(0, 3).map((p) => [P.idx[p[1]], +p[2].toFixed(2), +p[0].toFixed(2), +p[4].toFixed(0)]), P.near, st.hull, st.passes]);
    if (f % 30 === 0) log.push(`t=${t.toFixed(0)}s ${st.speed.toFixed(0)} m/s hull ${st.hull} score ${st.score} passes ${st.passes} closest ${st.closest} vega ${st.wing.dist} m plan ${b.tag} v=${R.value.toFixed(0)} ${(R.passes || []).map((p) => `r${P.idx[p[1]]}@${p[2].toFixed(1)}m/${p[0].toFixed(1)}s`).join(' ')}`);
  }
  await keys(new Set());
  // End on the pause menu for a beat.
  await page.keyboard.press('KeyP'); for (let i = 0; i < 50; i++) await frame(0);
  await page.keyboard.press('KeyP'); for (let i = 0; i < 10; i++) await frame(0);

  const s = await state(), ev = await page.evaluate(() => window.__astra.events(0));
  if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  const out = LOG || (RECORD ? RECORD.replace(/\.mp4$/, '.json') : '/tmp/claude-0/pilot-run.json');
  fs.writeFileSync(out, JSON.stringify({ frames, events: ev, final: s }));
  const rms = Math.sqrt(modelErr.reduce((a, e) => a + e * e, 0) / Math.max(1, modelErr.length));
  try { fs.writeFileSync(out.replace(/\.json$/, '') + '.dbg.json', JSON.stringify({ dbg, modelErr: { n: modelErr.length, rms, max: Math.max(0, ...modelErr) }, planMs, wall: Date.now() - tPlan0, rollouts: STATS.rollouts })); } catch (e) {}
  console.log(log.filter((_, i) => i % 3 === 0).join('\n'));
  const passes = ev.filter((e) => e.type === 'pass');
  console.log(`\n${SECONDS}s flown: ${passes.length} close passes, closest ${s.closest} m, score ${s.score}, ${s.hits} hits (hull ${s.hull}%), ${ev.filter((e) => e.type === 'breach').length} breaches, ${STATS.rollouts} rollouts, planner ${(planMs / Math.max(1, SECONDS * 30)).toFixed(1)} ms/frame, model error rms ${rms.toFixed(4)} m`);
  console.log('passes:', passes.map((p) => `${p.gap}m/${p.part}`).join(' '));
  console.log('radio:', ev.filter((e) => e.type === 'radio').map((e) => e.text).join(' | '));
  console.log('errors:', g.errors.filter((e) => !e.includes('ERR_TOO_MANY_RETRIES')).slice(0, 5));
  await g.browser.close();
}
