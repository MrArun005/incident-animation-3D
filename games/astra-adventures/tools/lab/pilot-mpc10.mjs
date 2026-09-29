// Claude flies Astra Adventures with model-predictive control. Every frame it re-implements the Jupiter's
// flight model (Ship.update, Hard values), rolls out ~100 candidate key sequences 2.5 s ahead, measures every
// hull probe of every predicted pose against a surface model of each nearby rock (built only from
// __astra.surf rings and gap readings, kept across headings so the rock is known off the ring plane too),
// scores each rollout by the expected value of the passes it makes (knife edge > tight > close, contact very
// bad) and presses the keys of the best one's first frame. Every input is a real key press through the browser.
//   node tools/lab/pilot-mpc.mjs [--record out.mp4] [--seconds 70] [--width 1600 --height 900] [--hard] [--log f]
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { open } from '../harness.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const RECORD = arg('record', null), SECONDS = +arg('seconds', 70), W = +arg('width', 1280), H = +arg('height', 720);
const HARD = process.argv.includes('--hard'), LOG = arg('log', null);
const DEBUG = process.env.MPC_DEBUG || (LOG ? LOG.replace(/\.json$/, '') + '.dbg.json' : null);   // per-frame planner trace beside the log
const FFMPEG = '/home/user/incident-animation-3d/cartoons/node_modules/ffmpeg-static/ffmpeg';

/* ================================ flight model (game.html Ship.update) ================================ */
const FM = HARD
  ? { cruise: 56, boost: 132 } : { cruise: 42, boost: 108 };
Object.assign(FM, { accel: 18, boostAccel: 58, decel: 20, boostDecel: 30, pitchRate: 1.1, yawRate: 0.95, rateBoostScale: 0.7, rotTauIn: 0.27, rotTauOut: 0.36,
  strafeSpeed: 20, strafeTau: 0.42, driftTau: 0.95, levelRate: 0.6, boostDrain: 0.24, boostRecharge: 0.15, rechargeDelay: 0.8 });
// The 23 collision probes of the Jupiter (ship-local: +X right, +Y up, -Z forward), x, y, z, radius.
const PROBES = [[0, 0.03, -6.3, 0.42], [0, 0.08, -4.9, 0.72], [0, 0.45, -2.0, 1.0], [0, 0.1, -0.4, 1.25], [0, 0.1, 2.4, 1.25], [0, 0.1, 4.6, 1.05], [0, 0.03, 6.3, 0.6],
  [-5.3, 0.05, -0.9, 0.82], [-5.3, 0.05, 1.3, 0.82], [-5.3, 0.05, 3.5, 0.82], [5.3, 0.05, -0.9, 0.82], [5.3, 0.05, 1.3, 0.82], [5.3, 0.05, 3.5, 0.82],
  [-6.02, 0.42, -3.4, 0.28], [6.02, 0.42, -3.4, 0.28], [-2.0, 0.05, 1.2, 0.58], [-3.2, 0.05, 0.1, 0.58], [-3.2, 0.05, 1.6, 0.58], [-3.2, 0.05, 3.1, 0.58],
  [2.0, 0.05, 1.2, 0.58], [3.2, 0.05, 0.1, 0.58], [3.2, 0.05, 1.6, 0.58], [3.2, 0.05, 3.1, 0.58]];
const NP = PROBES.length;
const PX = PROBES.map((p) => p[0]), PY = PROBES.map((p) => p[1]), PZ = PROBES.map((p) => p[2]), PRAD = PROBES.map((p) => p[3]);
const SHIP_R = Math.max(...PROBES.map((p) => Math.hypot(p[0], p[1], p[2]) + p[3]));      // bounding radius of the probe cloud
// How far the hull reaches from its centre towards a rock that sits at angle phi in the ship's right/up plane.
const EXT = Array.from({ length: 72 }, (_, k) => { const a = (k / 72) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); return Math.max(...PROBES.map((p) => p[0] * c + p[1] * s + p[3])); });
const extAt = (phi) => { let k = Math.round(((phi / (Math.PI * 2)) % 1 + 1) % 1 * 72) % 72; return EXT[k]; };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const DT_FRAME = 1 / 30;

// Predicted ship state, in the PLAN frame: the player's own frame at planning time (x right, y up, z back),
// so the ship starts at the origin with identity orientation and a rock at rocks() (x, y, z) sits at (x, y, -z).
function cloneState(S) { return { ...S }; }
const E = {};                                         // exp(-h/tau) cache
function ex(tau, h) { const k = tau * 1e6 + h; let v = E[k]; if (v === undefined) { v = Math.exp(-h / tau); E[k] = v; } return v; }
function step(S, yaw, pitch, strafe, boost, h, AY) {
  const want = boost && !S.lock && S.bE > 0.01;
  if (want) { S.bst = 1; S.bE = Math.max(0, S.bE - h * FM.boostDrain); S.idle = 0; if (S.bE <= 0) S.lock = 1; }
  else { S.bst = 0; S.idle += h; if (S.idle > FM.rechargeDelay) S.bE = Math.min(1, S.bE + h * FM.boostRecharge); if (S.lock && S.bE > 0.3) S.lock = 0; }
  S.bvis = S.bst + (S.bvis - S.bst) * ex(0.35, h);
  const rs = 1 + (FM.rateBoostScale - 1) * S.bvis;
  let t = pitch * FM.pitchRate * rs; S.wx = t + (S.wx - t) * ex(pitch ? FM.rotTauIn : FM.rotTauOut, h);
  t = -yaw * FM.yawRate * rs; S.wy = t + (S.wy - t) * ex(yaw ? FM.rotTauIn : FM.rotTauOut, h);
  S.wz = S.wz * ex(0.35, h);
  // q = q * euler(XYZ)
  const hx = S.wx * h / 2, hy = S.wy * h / 2, hz = S.wz * h / 2;
  const c1 = Math.cos(hx), s1 = Math.sin(hx), c2 = Math.cos(hy), s2 = Math.sin(hy), c3 = Math.cos(hz), s3 = Math.sin(hz);
  const bx = s1 * c2 * c3 + c1 * s2 * s3, by = c1 * s2 * c3 - s1 * c2 * s3, bz = c1 * c2 * s3 + s1 * s2 * c3, bw = c1 * c2 * c3 - s1 * s2 * s3;
  let { qx, qy, qz, qw } = S;
  let nx = qx * bw + qw * bx + qy * bz - qz * by, ny = qy * bw + qw * by + qz * bx - qx * bz, nz = qz * bw + qw * bz + qx * by - qy * bx, nw = qw * bw - qx * bx - qy * by - qz * bz;
  let L = 1 / Math.hypot(nx, ny, nz, nw); qx = nx * L; qy = ny * L; qz = nz * L; qw = nw * L;
  // axes
  const rx = 1 - 2 * (qy * qy + qz * qz), ry = 2 * (qx * qy + qw * qz), rz = 2 * (qx * qz - qw * qy);
  const ux = 2 * (qx * qy - qw * qz), uy = 1 - 2 * (qx * qx + qz * qz), uz = 2 * (qy * qz + qw * qx);
  const fx = -2 * (qx * qz + qw * qy), fy = -2 * (qy * qz - qw * qx), fz = -(1 - 2 * (qx * qx + qy * qy));
  const fup = fx * AY[0] + fy * AY[1] + fz * AY[2];
  if (Math.abs(fup) < 0.94) {                         // flight assist rolls the wings back to level
    let dx = AY[0] - fx * fup, dy = AY[1] - fy * fup, dz = AY[2] - fz * fup; const dl = 1 / Math.hypot(dx, dy, dz); dx *= dl; dy *= dl; dz *= dl;
    const cx = uy * dz - uz * dy, cy = uz * dx - ux * dz, cz = ux * dy - uy * dx;
    const err = Math.atan2(cx * fx + cy * fy + cz * fz, ux * dx + uy * dy + uz * dz);
    const a = clamp(err, -1, 1) * FM.levelRate * h * (1 - Math.abs(fup)) / 2, sa = Math.sin(a), ax = fx * sa, ay = fy * sa, az = fz * sa, aw = Math.cos(a);
    nx = aw * qx + ax * qw + ay * qz - az * qy; ny = aw * qy + ay * qw + az * qx - ax * qz; nz = aw * qz + az * qw + ax * qy - ay * qx; nw = aw * qw - ax * qx - ay * qy - az * qz;
    qx = nx; qy = ny; qz = nz; qw = nw;
  }
  S.qx = qx; S.qy = qy; S.qz = qz; S.qw = qw;
  let fs = S.vx * fx + S.vy * fy + S.vz * fz, vr = S.vx * rx + S.vy * ry + S.vz * rz, vu = S.vx * ux + S.vy * uy + S.vz * uz;
  const target = S.bst ? FM.boost : FM.cruise;
  if (fs < target) fs = Math.min(target, fs + (S.bst ? FM.boostAccel : FM.accel) * h); else fs = Math.max(target, fs - (S.bvis > 0.05 ? FM.boostDecel : FM.decel) * h);
  vr = strafe ? strafe * FM.strafeSpeed + (vr - strafe * FM.strafeSpeed) * ex(FM.strafeTau, h) : vr * ex(FM.driftTau, h);
  vu = vu * ex(FM.driftTau, h);
  S.vx = fx * fs + rx * vr + ux * vu; S.vy = fy * fs + ry * vr + uy * vu; S.vz = fz * fs + rz * vr + uz * vu;
  S.px += S.vx * h; S.py += S.vy * h; S.pz += S.vz * h;
  t = clamp(-S.wy * 0.85 + vr * 0.02, -1.1, 1.1); S.bank = t + (S.bank - t) * ex(0.22, h);
}
// Rotation matrix of qv = q * rotation(-Z, bank): where the probes are drawn.
function probeMatrix(S, M) {
  const hb = S.bank / 2, bz = -Math.sin(hb), bw = Math.cos(hb), { qx, qy, qz, qw } = S;
  const x = qx * bw + qy * bz, y = qy * bw - qx * bz, z = qz * bw + qw * bz, w = qw * bw - qz * bz;
  M[0] = 1 - 2 * (y * y + z * z); M[1] = 2 * (x * y + w * z); M[2] = 2 * (x * z - w * y);
  M[3] = 2 * (x * y - w * z); M[4] = 1 - 2 * (x * x + z * z); M[5] = 2 * (y * z + w * x);
  M[6] = 2 * (x * z + w * y); M[7] = 2 * (y * z - w * x); M[8] = 1 - 2 * (x * x + y * y);
}
function axesOf(S) {
  const { qx, qy, qz, qw } = S;
  return { r: [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qw * qz), 2 * (qx * qz - qw * qy)], u: [2 * (qx * qy - qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qw * qx)],
    f: [-2 * (qx * qz + qw * qy), -2 * (qy * qz - qw * qx), -(1 - 2 * (qx * qx + qy * qy))] };
}

/* ================================ rock surface model ================================ */
// A rock's surface radius is only observable through __astra.surf (the ring of directions perpendicular to
// our nose, at whatever heading we have now) and the gap readings (the direction to us). Rings from earlier
// headings are kept (rocks that don't spin keep them for good), so a turn of the nose maps the rock above
// and below the current ring plane. Between rings: interpolate. Beyond the mapped band: grow the radius
// towards the rock's known maximum (reach), by a share that depends on how elongated its variant is.
const NR = 96, EL_MAX = 60 * Math.PI / 180, NE = 41, DEL = (2 * EL_MAX) / (NE - 1), SPAN0 = 25 * Math.PI / 180;
const RING_COS = Array.from({ length: NR }, (_, k) => Math.cos((k / NR) * Math.PI * 2)), RING_SIN = Array.from({ length: NR }, (_, k) => Math.sin((k / NR) * Math.PI * 2));
// How much a rock's radius can grow away from a mapped direction, as a share of (reach - mapped radius), for
// 0, 5, 10, 15, 20, 25, 30, 40, 50, 60 degrees off: a high percentile over random orientations of each
// variant (measured offline from rock radii); elongated variants can bulge a long way off a ring.
const VARIANTS = [['potato', 1.5303, [0, .18, .30, .44, .50, .59, .65, .70, .76, .78]], ['rubble', 1.1756, [0, .17, .25, .30, .36, .41, .45, .50, .58, .60]],
  ['shard', 1.5213, [0, .38, .59, .74, .80, .85, .86, .87, .93, .96]], ['binary', 1.7003, [0, .26, .49, .63, .74, .78, .79, .91, .97, 1]],
  ['top', 1.3386, [0, .18, .31, .40, .46, .49, .53, .58, .63, .64]], ['lumpy', 1.2752, [0, .24, .38, .47, .56, .63, .67, .72, .79, .83]]];
// A bolder set (mid percentile) used when the pass is flown near cruise speed, where a scrape is cheap and
// there is time to correct from the hull readings; the tables above apply at boost speed.
const VARIANTS_LO = { potato: [0, .14, .23, .33, .39, .46, .52, .57, .64, .67], rubble: [0, .12, .2, .25, .31, .35, .39, .45, .51, .54], shard: [0, .23, .37, .47, .53, .57, .6, .62, .67, .69],
  binary: [0, .17, .32, .42, .51, .56, .58, .69, .74, .79], top: [0, .14, .25, .33, .38, .43, .47, .51, .56, .58], lumpy: [0, .17, .29, .37, .45, .51, .56, .62, .69, .73] };
const QDEG = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60];
function growth(Q, d) {                               // d in radians
  const x = Math.abs(d) * 180 / Math.PI; if (x >= 60) return Q[9];
  let i = 0; while (QDEG[i + 1] < x) i++; const t = (x - QDEG[i]) / (QDEG[i + 1] - QDEG[i]); return Q[i] + (Q[i + 1] - Q[i]) * t;
}
function variantOf(s, reach) { const k = reach / s; let best = VARIANTS[0], d = 9; for (const v of VARIANTS) if (Math.abs(v[1] - k) < d) { d = Math.abs(v[1] - k); best = v; } return best; }
const PT_COS = Math.cos(4 * Math.PI / 180);
class Rock {
  constructor(r) {
    this.i = r.i; this.s = r.s; this.reach = r.reach; this.gauntlet = r.gauntlet; const v = variantOf(r.s, r.reach); this.vname = v[0]; this.Q = v[2]; this.QL = VARIANTS_LO[v[0]]; this.bias = 0;
    this.still = !!r.gauntlet;                        // the gauntlet rocks never spin
    this.maxAge = this.still ? 1e9 : r.s > 17 ? 1.6 : 0.9;
    this.omega = this.still ? 0 : r.s > 17 ? 0.037 : 0.082;   // worst-case spin (rad/s)
    this.rings = [];                                  // {e1,e2,e3 world axes, R, t}
    this.pts = [];                                    // {w world dir, R, t}
    this.cellR = new Float32Array(NR * NE); this.cellL = new Float32Array(NR * NE); this.cellU = new Float32Array(NR * NE); this.stamp = new Int32Array(NR * NE).fill(-1);
    this.seen = -1;
  }
}
function ringAt(R, a) {                               // linear interpolation of a ring at in-plane angle a
  let f = (a / (Math.PI * 2)) * NR; f = ((f % NR) + NR) % NR; const i0 = Math.floor(f), d = f - i0, i1 = (i0 + 1) % NR;
  return R[i0 % NR] * (1 - d) + R[i1] * d;
}

/* ================================ pass value ================================ */
// Expected score of a pass whose predicted closest probe gap is g, with the model error ~ N(mu, sig).
const HITV = 900;
function Phi(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
// The game's own points for a pass grow with speed and closeness (with a typical streak multiplier of 3).
function gameBonus(g, v, sig, mu = 0.08) {
  if (g > 9.5) return 0;
  const k = clamp((9 - g) / 9, 0, 1);
  return Phi((g - mu) / sig) * Phi((9 - g) / sig) * (60 + 440 * k ** 1.5) * v * 0.0046;
}
function passValue(g, sig, v = 56, mu = 0.08) {
  const z = (x) => Phi((g - mu - x) / sig), hv = HITV + 30 * Math.max(0, v - 56);   // a hit at boost speed can cost half the hull
  return -hv + (390 + hv) * z(0) - 180 * z(1.6) - 80 * z(3) - 130 * z(9) - 80 * Math.max(0, -g);
}

/* ================================ the pilot ================================ */
export function makePilot() {
  const rocks = new Map();
  let frameNo = 0, warm = null, lastApplied = [0, 0, 0], goal = null, lastGoalPick = -9, lastBK = 0, lastPassT = -99, streak = 0;
  const HF = 75;                                      // plan horizon in frames (2.5 s)
  let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const shadow = { bvis: 0, idle: 9, lock: 0 };
  let lastT = null, lastBoostKey = false, simPerFrame = DT_FRAME;
  const dbg = [], hist = []; let predErr = null;
  let ctx = null;                                     // per-frame planning context

  function toPlan(w) { return [w[0] * ctx.e1[0] + w[1] * ctx.e1[1] + w[2] * ctx.e1[2], w[0] * ctx.e2[0] + w[1] * ctx.e2[1] + w[2] * ctx.e2[2], w[0] * ctx.e3[0] + w[1] * ctx.e3[1] + w[2] * ctx.e3[2]]; }

  // ---- surface estimate of rock k in plan-frame direction (dx,dy,dz) (unnormalised, length L)
  function cell(k, ia, ie) {
    const idx = ia * NE + ie;
    if (k.stamp[idx] === frameNo) return idx;
    const el = -EL_MAX + ie * DEL, ce = Math.cos(el);
    const wx = ce * RING_COS[ia], wy = ce * RING_SIN[ia], wz = -Math.sin(el);
    let bD = Infinity, bR = 0, aD = -Infinity, aR = 0;
    for (const g of k.cur) {
      const s = -(wx * g.E3[0] + wy * g.E3[1] + wz * g.E3[2]);     // sine of the elevation above this ring's plane (towards its nose)
      const d = Math.asin(clamp(s, -1, 1));
      if (d >= 0 ? d >= bD : d <= aD) continue;
      const a = Math.atan2(wx * g.E2[0] + wy * g.E2[1] + wz * g.E2[2], wx * g.E1[0] + wy * g.E1[1] + wz * g.E1[2]);
      const R = ringAt(g.R, a);
      if (d >= 0) { bD = d; bR = R; } else { aD = d; aR = R; }
    }
    let R, U, RL;
    const span = bD - aD;
    if (isFinite(bD) && isFinite(aD) && span < 2 * SPAN0) {
      R = (bR * -aD + aR * bD) / span; const md = Math.min(bD, -aD), room = k.reach - Math.max(aR, bR);
      const gq = growth(k.Q, md) * 0.6; RL = R + growth(k.QL, md) * 0.6 * room; R += gq * room; U = 0.15 * gq * (k.reach - R);
    } else {
      const nearB = Math.abs(bD) < Math.abs(aD), edgeD = nearB ? bD : aD, edgeR = nearB ? bR : aR;
      const gq = growth(k.Q, edgeD); R = edgeR + gq * (k.reach - edgeR); RL = edgeR + growth(k.QL, edgeD) * (k.reach - edgeR); U = 0.15 * gq * (k.reach - edgeR);
    }
    // point samples (gap readings) close to this direction override the rings
    let ws = 0, wr = 0;
    for (const p of k.cp) { const c = wx * p.w[0] + wy * p.w[1] + wz * p.w[2]; if (c > PT_COS) { const wt = (c - PT_COS) / (1 - PT_COS); ws += wt; wr += wt * p.R; } }
    if (ws > 0) { const Wt = Math.min(1, ws); R = Wt * (wr / ws) + (1 - Wt) * R; RL = Wt * (wr / ws) + (1 - Wt) * RL; U *= 1 - Wt; }
    k.cellR[idx] = Math.min(R, k.reach); k.cellL[idx] = Math.min(RL, k.reach); k.cellU[idx] = U; k.stamp[idx] = frameNo;
    return idx;
  }
  let lastU = 0;
  function surfEst(k, dx, dy, dz, L, hi = 1) {
    if (globalThis.__mockWorld && process.env.MPC_TRUTH && Math.abs(Math.asin(clamp(-dz / L, -1, 1))) < (+process.env.MPC_TRUTH) * Math.PI / 180) { lastU = 0; const e = ctx; return globalThis.__mockWorld.trueR(k.i, [dx * e.e1[0] + dy * e.e2[0] + dz * e.e3[0], dx * e.e1[1] + dy * e.e2[1] + dz * e.e3[1], dx * e.e1[2] + dy * e.e2[2] + dz * e.e3[2]]); }
    return surfEst0(k, dx, dy, dz, L, hi);
  }
  function surfEst0(k, dx, dy, dz, L, hi = 1) {        // hi: 0 = bold priors (slow pass), 1 = cautious (fast pass)
    const az = Math.atan2(dy, dx), el = Math.asin(clamp(-dz / L, -1, 1));
    let fa = (az / (Math.PI * 2)) * NR; if (fa < 0) fa += NR; const fe = clamp((el + EL_MAX) / DEL, 0, NE - 1.0001);
    const ia = Math.floor(fa) % NR, ib = (ia + 1) % NR, ie = Math.floor(fe), da = fa - Math.floor(fa), de = fe - ie;
    const c00 = cell(k, ia, ie), c10 = cell(k, ib, ie), c01 = cell(k, ia, ie + 1), c11 = cell(k, ib, ie + 1);
    const w00 = (1 - da) * (1 - de), w10 = da * (1 - de), w01 = (1 - da) * de, w11 = da * de;
    lastU = k.cellU[c00] * w00 + k.cellU[c10] * w10 + k.cellU[c01] * w01 + k.cellU[c11] * w11;
    let R = k.cellR[c00] * w00 + k.cellR[c10] * w10 + k.cellR[c01] * w01 + k.cellR[c11] * w11;
    if (hi < 1) R = hi * R + (1 - hi) * (k.cellL[c00] * w00 + k.cellL[c10] * w10 + k.cellL[c01] * w01 + k.cellL[c11] * w11);
    if (Math.abs(el) > EL_MAX) R = Math.max(R, R + (k.reach - R) * 0.5 * Math.min(1, (Math.abs(el) - EL_MAX) / 0.4));
    return R;
  }

  // ---- ingest one observation
  function ingest(obs) {
    const s = obs.s;
    const f = norm(s.fwd), e3 = [-f[0], -f[1], -f[2]];
    let r = s.right; const rd = r[0] * e3[0] + r[1] * e3[1] + r[2] * e3[2]; const e1 = norm([r[0] - e3[0] * rd, r[1] - e3[1] * rd, r[2] - e3[2] * rd]);
    const e2 = cross(e3, e1);
    ctx = { e1, e2, e3, t: s.t, s };
    ctx.AY = [e1[1], e2[1], e3[1]];
    // hidden boost state (not in state()): replay the frame we just flew
    if (lastT !== null) {
      const dt = Math.max(0, s.t - lastT); if (dt > 0) simPerFrame = dt;
      let n = Math.max(1, Math.round(dt * 120)); const h = dt / n;
      for (let i = 0; i < n; i++) {
        const want = lastBoostKey && !shadow.lock && s.boostE > 0.01;
        const b = want ? 1 : 0; if (want) { shadow.idle = 0; } else shadow.idle += h;
        shadow.bvis = b + (shadow.bvis - b) * Math.exp(-h / 0.35);
      }
      if (s.boostE <= 0.001 && lastBoostKey) shadow.lock = 1; if (shadow.lock && s.boostE > 0.3) shadow.lock = 0;
    }
    lastT = s.t;
    const seenNow = new Set();
    for (const o of obs.rs) {
      let k = rocks.get(o.i); if (!k) { k = new Rock(o); rocks.set(o.i, k); }
      seenNow.add(o.i);
      if (k.seen >= 0 && Math.abs(o.z - k.z) > 300 && !k.still) { k.rings.length = 0; k.pts.length = 0; }    // wrapped round the field
      k.x = o.x; k.y = o.y; k.z = o.z; k.gap = o.gap; k.pgap = o.pgap; k.seen = frameNo;
      k.C = [o.x, o.y, -o.z];
      if (o.ring) {
        k.ring = o.ring;
        // keep the ring if the nose has turned since the last kept one
        const fw = [-e3[0], -e3[1], -e3[2]];
        let keep = true;
        for (const g of k.rings) { if (g.f[0] * fw[0] + g.f[1] * fw[1] + g.f[2] * fw[2] > Math.cos(1.2 * Math.PI / 180) && s.t - g.t < 0.5 * k.maxAge) { keep = false; break; } }
        if (keep) { k.rings.push({ e1, e2, e3, f: fw, R: Float32Array.from(o.ring), t: s.t }); if (k.rings.length > 36) k.rings.shift(); }
      }
      k.rings = k.rings.filter((g) => s.t - g.t <= k.maxAge);
      // the gap reading is the surface radius in the direction of the ship's centre
      const dist = Math.hypot(o.x, o.y, o.z);
      if (dist < 260 && dist > 1) {
        const wp = [-o.x / dist, -o.y / dist, o.z / dist];                     // plan-frame dir rock -> ship
        const ww = [wp[0] * e1[0] + wp[1] * e2[0] + wp[2] * e3[0], wp[0] * e1[1] + wp[1] * e2[1] + wp[2] * e3[1], wp[0] * e1[2] + wp[1] * e2[2] + wp[2] * e3[2]];
        const last = k.pts[k.pts.length - 1];
        if (!last || last.w[0] * ww[0] + last.w[1] * ww[1] + last.w[2] * ww[2] < Math.cos(0.8 * Math.PI / 180)) { k.pts.push({ w: ww, R: dist - o.gap, t: s.t }); if (k.pts.length > 80) k.pts.shift(); }
      }
      k.pts = k.pts.filter((p) => s.t - p.t <= k.maxAge);
    }
    for (const [i, k] of rocks) if (!seenNow.has(i)) rocks.delete(i);
    // plan-frame views of each rock's rings and points (current ring first)
    for (const k of rocks.values()) {
      k.cur = [];
      if (k.ring) k.cur.push({ E1: [1, 0, 0], E2: [0, 1, 0], E3: [0, 0, 1], R: k.ring });
      for (const g of k.rings) { if (g.t === s.t) continue; k.cur.push({ E1: toPlan(g.e1), E2: toPlan(g.e2), E3: toPlan(g.e3), R: g.R }); }
      k.cp = k.pts.map((p) => ({ w: toPlan(p.w), R: p.R }));
    }
    // a probe-level correction: where the hull reading disagrees with the model, the model's nearest probe
    // gives an upper bound on the surface radius in that direction
    const S0 = initState();
    const M = new Float64Array(9); probeMatrix(S0, M);
    for (const k of rocks.values()) {
      if (!(k.pgap < 12)) k.bias *= 0.85;
      if (!(k.pgap < 12) || !k.cur.length) continue;
      frameNo++;                                       // fresh cells for this check
      let best = Infinity, bj = -1, bd = null;
      for (let j = 0; j < NP; j++) {
        const px = M[0] * PX[j] + M[3] * PY[j] + M[6] * PZ[j], py = M[1] * PX[j] + M[4] * PY[j] + M[7] * PZ[j], pz = M[2] * PX[j] + M[5] * PY[j] + M[8] * PZ[j];
        const dx = px - k.C[0], dy = py - k.C[1], dz = pz - k.C[2], L = Math.hypot(dx, dy, dz);
        const g = L - surfEst(k, dx, dy, dz, L) - PRAD[j]; if (g < best) { best = g; bj = j; bd = [dx, dy, dz, L]; }
      }
      k.modelErr = k.pgap - best;
      k.bias = Math.min(0, 0.5 * k.bias + 0.5 * k.modelErr); k.biasT = s.t;
      if (Math.abs(k.modelErr) > 0.04 && bd) {
        const [dx, dy, dz, L] = bd, wp = [dx / L, dy / L, dz / L];
        k.cp.push({ w: wp, R: L - k.pgap - PRAD[bj] });
        const ww = [wp[0] * e1[0] + wp[1] * e2[0] + wp[2] * e3[0], wp[0] * e1[1] + wp[1] * e2[1] + wp[2] * e3[1], wp[0] * e1[2] + wp[1] * e2[2] + wp[2] * e3[2]];
        k.pts.push({ w: ww, R: L - k.pgap - PRAD[bj], t: s.t }); if (k.pts.length > 80) k.pts.shift();
      }
    }
    frameNo++;
  }
  function initState() {
    const s = ctx.s, v = toPlan(s.vel);
    return { px: 0, py: 0, pz: 0, vx: v[0], vy: v[1], vz: v[2], qx: 0, qy: 0, qz: 0, qw: 1, wx: s.ang[0], wy: s.ang[1], wz: s.ang[2], bank: s.bank,
      bE: s.boostE, bst: s.boosting ? 1 : 0, lock: shadow.lock, idle: shadow.idle, bvis: shadow.bvis };
  }

  // ---- goal selection: the next rock to line up a pass on
  function pickGoal(S0) {
    const speed = Math.max(30, Math.hypot(S0.vx, S0.vy, S0.vz));
    let best = null;
    for (const k of rocks.values()) {
      if (k.z < 60 || k.z > 470 || k.s < 4.5 || k.s > 42) continue;
      const ang = Math.atan2(Math.hypot(k.x, k.y), k.z); if (ang > 0.55) continue;
      const cost = k.z / speed + ang * 7 + (k.gauntlet ? -0.6 : 0) + (k.s > 30 ? 0.8 : 0);
      if (!best || cost < best.cost) best = { k, cost };
    }
    return best && best.k;
  }

  // ---- rollout evaluation
  const M = new Float64Array(9);
  function evaluate(plan, S0, active, bK, pdAim) {
    const S = cloneState(S0), AY = ctx.AY;
    const n = active.length, gmin = new Float64Array(n).fill(Infinity), tmin = new Float64Array(n), umin = new Float64Array(n), vmin = new Float64Array(n), done = new Uint8Array(n), last = new Float64Array(n).fill(Infinity);
    let cost = 0, tt = 0, spd = 0, hiW = 1, path = 0;
    const seq = pdAim ? new Int8Array(HF * 3) : null;
    for (let f = 0; f < HF; f++) {
      let y, p, s;
      if (pdAim) { [y, p, s] = pdPolicy(S, pdAim); seq[f * 3] = y; seq[f * 3 + 1] = p; seq[f * 3 + 2] = s; }
      else { y = plan[f * 3]; p = plan[f * 3 + 1]; s = plan[f * 3 + 2]; }
      if (y || p) cost += 0.25; if (s) cost += 0.15;
      const boostPlan = f < bK ? 1 : 0;
      const ts = f < 12 ? 1 + (simPerFrame / DT_FRAME - 1) * Math.exp(-f * DT_FRAME / 0.18) : 1;
      const nsub = f < 30 ? 4 : 2, h = (DT_FRAME * ts) / nsub;        // the game steps at 1/120 s: match it for the first second
      for (let sub = 0; sub < nsub; sub++) {
        step(S, y, p, s, boostPlan, h, AY); tt += h; path += Math.hypot(S.vx, S.vy, S.vz) * h;
        if (nsub === 4 && !(sub & 1)) continue;                      // probe checks every 1/60 s
        let mOK = false;
        for (let a = 0; a < n; a++) {
          if (done[a]) continue;
          const k = active[a], dx0 = S.px - k.C[0], dy0 = S.py - k.C[1], dz0 = S.pz - k.C[2], d0 = Math.hypot(dx0, dy0, dz0);
          if (d0 > k.reach + SHIP_R + 9.5) { if (gmin[a] < 30) done[a] = 1; continue; }
          if (!mOK) { probeMatrix(S, M); mOK = true; spd = Math.hypot(S.vx, S.vy, S.vz); hiW = clamp((spd - 62) / 28, 0, 1); }
          let g = Infinity, u = 0;
          for (let j = 0; j < NP; j++) {
            const px = S.px + M[0] * PX[j] + M[3] * PY[j] + M[6] * PZ[j], py = S.py + M[1] * PX[j] + M[4] * PY[j] + M[7] * PZ[j], pz = S.pz + M[2] * PX[j] + M[5] * PY[j] + M[8] * PZ[j];
            const dx = px - k.C[0], dy = py - k.C[1], dz = pz - k.C[2], L = Math.hypot(dx, dy, dz);
            if (L - k.reach - PRAD[j] > g) continue;
            const gj = L - surfEst(k, dx, dy, dz, L, hiW) - PRAD[j]; if (gj < g) { g = gj; u = lastU; }
          }
          if (k.bias) g += k.bias * Math.exp(-tt / 0.8);
          if (g < gmin[a]) { gmin[a] = g; tmin[a] = tt; umin[a] = u; vmin[a] = Math.hypot(S.vx, S.vy, S.vz); }
          else if (g > gmin[a] + 1.0 && gmin[a] < 9) done[a] = 1;
          last[a] = g;
        }
      }
    }
    // coast on past the horizon (no input) and see where the path goes
    const ext = [];
    for (let a = 0; a < n; a++) if (!done[a]) ext.push(a);
    const extMin = new Float64Array(n).fill(Infinity), extT = new Float64Array(n), extV = new Float64Array(n);
    if (ext.length) {
      const X = cloneState(S); let te = 0;
      for (let i = 0; i < 32; i++) {
        step(X, 0, 0, 0, bK >= HF && X.bE > 0.2 ? 1 : 0, 1 / 16, AY); te += 1 / 16;
        const ax = axesOf(X);
        for (const a of ext) {
          const k = active[a], dx = X.px - k.C[0], dy = X.py - k.C[1], dz = X.pz - k.C[2], L = Math.hypot(dx, dy, dz);
          if (L - k.reach - SHIP_R > extMin[a]) continue;
          const nr = -(dx * ax.r[0] + dy * ax.r[1] + dz * ax.r[2]), nu = -(dx * ax.u[0] + dy * ax.u[1] + dz * ax.u[2]);
          const g = L - surfEst(k, dx, dy, dz, L) - extAt(Math.atan2(nu, nr));
          if (g < extMin[a]) { extMin[a] = g; extT[a] = te; extV[a] = Math.hypot(X.vx, X.vy, X.vz); }
        }
      }
    }
    const win = 5 - (ctx.t - lastPassT) - 0.12;          // a pass inside this keeps the streak multiplier alive
    let firstT = Infinity, firstP = 0;
    for (let a = 0; a < n; a++) {
      const k = active[a];
      if (done[a] || gmin[a] < extMin[a]) {
        if (!(gmin[a] < 40)) continue;
        const sig = Math.sqrt(0.16 * 0.16 + (k.omega * tmin[a] * k.s * 0.45) ** 2 + (0.03 * tmin[a]) ** 2 + umin[a] * umin[a]) + 0.2 * Math.max(0, vmin[a] / 56 - 1);
        cost -= passValue(gmin[a], sig, vmin[a]) + gameBonus(gmin[a], vmin[a], sig);
        if (gmin[a] > 0.2 && gmin[a] < 8.6 && tmin[a] < firstT) { firstT = tmin[a]; firstP = Phi((gmin[a] - 0.1) / sig) * Phi((8.8 - gmin[a]) / sig); }
      } else if (extMin[a] < 40) {
        const tau = tt + extT[a];
        const sig = Math.sqrt(0.16 * 0.16 + (k.omega * tau * k.s * 0.45) ** 2 + (0.6 * extT[a] + 0.05 * tau) ** 2);
        cost -= (passValue(extMin[a], sig, extV[a]) + gameBonus(extMin[a], extV[a], sig)) * (k === goal ? 1 : 0.8);
        if (extMin[a] > 0.4 && extMin[a] < 8.4 && tau < firstT) { firstT = tau; firstP = 0.8 * Phi((extMin[a] - 0.1) / sig) * Phi((8.6 - extMin[a]) / sig); }
      }
    }
    if (win > 0 && firstT < win) cost -= (40 + 40 * Math.min(streak, 7)) * firstP;
    // goal still beyond reach of the extension: point the path at its aim point
    if (goal && goal.aim && !active.includes(goal)) {
      const ax = axesOf(S), A = goal.aim, dx = A[0] - S.px, dy = A[1] - S.py, dz = A[2] - S.pz, L = Math.hypot(dx, dy, dz), v = Math.hypot(S.vx, S.vy, S.vz);
      const c = (dx * S.vx + dy * S.vy + dz * S.vz) / (L * v); const ang = Math.acos(clamp(c, -1, 1));
      cost += 260 * ang * ang;
      const cf = (dx * ax.f[0] + dy * ax.f[1] + dz * ax.f[2]) / L; cost += 60 * (1 - cf);
    }
    cost -= 0.25 * path;                                // credit for ground covered: more field flown, more rocks met
    const fa = axesOf(S), fup = fa.f[0] * AY[0] + fa.f[1] * AY[1] + fa.f[2] * AY[2]; cost += 400 * Math.max(0, Math.abs(fup) - 0.55) ** 2;
    return { cost, seq, gmin, extMin };
  }

  // A simple closed-loop pilot used inside rollouts: nose at the aim point, then slide onto it with A/D.
  function pdPolicy(S, A) {
    const ax = axesOf(S), dx = A[0] - S.px, dy = A[1] - S.py, dz = A[2] - S.pz;
    const zf = dx * ax.f[0] + dy * ax.f[1] + dz * ax.f[2], xl = dx * ax.r[0] + dy * ax.r[1] + dz * ax.r[2], yl = dx * ax.u[0] + dy * ax.u[1] + dz * ax.u[2];
    const vf = S.vx * ax.f[0] + S.vy * ax.f[1] + S.vz * ax.f[2], vxl = S.vx * ax.r[0] + S.vy * ax.r[1] + S.vz * ax.r[2], vyl = S.vx * ax.u[0] + S.vy * ax.u[1] + S.vz * ax.u[2];
    const tau = Math.max(0.05, zf / Math.max(20, vf));
    let y = 0, p = 0, s = 0;
    const mxRel = xl - vxl * FM.driftTau * (1 - Math.exp(-tau / FM.driftTau)), myRel = yl - vyl * FM.driftTau * (1 - Math.exp(-tau / FM.driftTau));
    const pitchErr = Math.atan2(myRel, Math.max(zf, 25)), pp = pitchErr - S.wx * 0.38;
    if (pp > 0.01) p = 1; else if (pp < -0.01) p = -1;
    if (zf > 100) {
      const yawErr = Math.atan2(mxRel, Math.max(zf, 25)), py = yawErr + S.wy * 0.38;
      if (py > 0.01) y = 1; else if (py < -0.01) y = -1;
    } else if (zf > -5) {
      const py = S.wy * 0.5; if (py > 0.03) y = 1; else if (py < -0.03) y = -1;   // hold the heading
      if (mxRel > 0.25) s = 1; else if (mxRel < -0.25) s = -1;
    }
    return [y, p, s];
  }

  function plan(obs) {
    for (const e of obs.ev || []) if (e.type === 'pass') { lastPassT = e.t; streak = e.streak; }
    ingest(obs);
    const S0 = initState();
    const s = obs.s;
    // goal upkeep
    if (goal && (!rocks.has(goal.i) || goal.z < -goal.reach * 0.3)) goal = null;
    if (!goal && ctx.t - lastGoalPick > 0.3) { goal = pickGoal(S0); lastGoalPick = ctx.t; }
    const speed = Math.hypot(S0.vx, S0.vy, S0.vz);
    // rocks that any 2.5 s rollout could come near
    const reachZ = Math.max(60, speed * (HF * DT_FRAME) + 40);
    const active = [];
    for (const k of rocks.values()) {
      if (!k.cur || !k.cur.length) continue;
      if (k.z < -k.reach - 20 || k.z > reachZ + k.reach + 140) continue;
      const lat = Math.hypot(k.x, k.y); if (lat > k.reach + 25 + 0.55 * Math.max(0, k.z)) continue;
      active.push(k);
    }
    // candidate aim points for the closed-loop rollouts
    const aims = [];
    const targets = [];
    if (goal) targets.push(goal);
    for (const k of active) if (k !== goal && k.z > 25 && k.s >= 4 && targets.length < 4) targets.push(k);
    for (const k of targets) {
      const lx = -k.x, ly = -k.y;
      const sides = [[-1, 0], [1, 0]];
      if (Math.abs(ly) > Math.abs(lx) * 1.5 && Math.abs(ly) > 4) sides.push([0, Math.sign(ly)]);
      for (const [ux, uy] of sides) {
        const a = Math.atan2(uy, ux), Rs = k.ring ? ringAt(k.ring, a) : k.reach, ext = extAt(a + Math.PI);
        for (const d of k === goal ? [0.9, 2.0, 4.5] : [1.4, 4.0]) aims.push({ k, A: [k.C[0] + ux * (Rs + ext + d), k.C[1] + uy * (Rs + ext + d), k.C[2]], ux, uy, d });
      }
    }
    if (goal) {
      const lx = -goal.x, ly = -goal.y, L = Math.hypot(lx, ly) || 1; let ux = lx / L, uy = ly / L; if (L < 3) { ux = -1; uy = 0; }
      if (Math.abs(uy) > 0.6) { uy = Math.sign(uy) * 0.6; ux = Math.sign(ux || -1) * 0.8; }
      const a = Math.atan2(uy, ux), Rs = goal.ring ? ringAt(goal.ring, a) : goal.reach;
      goal.aim = [goal.C[0] + ux * (Rs + 7.5), goal.C[1] + uy * (Rs + 7.5), goal.C[2]];
    }
    // candidates
    const cands = [];
    const base = new Int8Array(HF * 3);
    if (warm) for (let f = 0; f < HF - 1; f++) for (let c = 0; c < 3; c++) base[f * 3 + c] = warm[(f + 1) * 3 + c];
    cands.push(base);
    cands.push(new Int8Array(HF * 3));
    for (let c = 0; c < 3; c++) for (const v of [-1, 0, 1]) for (const kk of [1, 3, 6, 10, 16, 26]) {
      const q = base.slice(); let same = true; for (let f = 0; f < kk; f++) { if (q[f * 3 + c] !== v) same = false; q[f * 3 + c] = v; } if (!same) cands.push(q);
    }
    for (const v1 of [-1, 1]) for (const v2 of [-1, 1]) for (const kk of [4, 10]) { const q = base.slice(); for (let f = 0; f < kk; f++) { q[f * 3] = v1; q[f * 3 + 2] = v2; } cands.push(q); }
    for (let r = 0; r < 14; r++) {
      const q = base.slice(), c = Math.floor(rnd() * 3), a0 = Math.floor(rnd() * 40), len = 1 + Math.floor(rnd() * 22), v = Math.floor(rnd() * 3) - 1;
      for (let f = a0; f < Math.min(HF, a0 + len); f++) q[f * 3 + c] = v; cands.push(q);
    }
    // boost: keep last frame's choice for the sweep, then try the others on the best few
    const canBoost = HARD && (s.boosting || (s.boostE > 0.2 && !shadow.lock));
    const bMain = canBoost ? (lastBK >= HF ? HF : Math.max(0, lastBK - 1)) : 0;
    const scored = [];
    const penal = (q) => { let c = 0; for (let ch = 0; ch < 3; ch++) if (q[ch] !== lastApplied[ch]) c += 1.2; return c; };
    for (const q of cands) { const r = evaluate(q, S0, active, bMain, null); scored.push({ q, c: r.cost + penal(q), r, bK: bMain }); }
    for (const am of aims) { const r = evaluate(null, S0, active, bMain, am.A); scored.push({ q: r.seq, c: r.cost + penal(r.seq), r, bK: bMain }); }
    scored.sort((a, b) => a.c - b.c);
    if (canBoost) {
      const top = scored.slice(0, 8);
      for (const bk of [0, 24, HF]) { if (bk === bMain) continue; for (const e of top) { const r = evaluate(e.q, S0, active, bk, null); scored.push({ q: e.q, c: r.cost + penal(e.q) + (bk > 0 && lastBK === 0 ? 3 : 0), r, bK: bk }); } }
      scored.sort((a, b) => a.c - b.c);
    }
    const best = scored[0].q, bestCost = scored[0].c, bestInfo = scored[0].r, boostNow = scored[0].bK > 0;
    lastBK = scored[0].bK;
    warm = best;
    lastApplied = [best[0], best[1], best[2]];
    if (DEBUG) {                                       // check the flight model: replay the inputs actually flown over the last 30 frames
      hist.push({ S0, e1: ctx.e1, e2: ctx.e2, e3: ctx.e3, pos: s.pos, inp: [best[0], best[1], best[2], boostNow ? 1 : 0], spf: simPerFrame, t: ctx.t });
      if (hist.length > 31) hist.shift();
      if (hist.length === 31) {
        const H0 = hist[0], X = cloneState(H0.S0), AY0 = [H0.e1[1], H0.e2[1], H0.e3[1]];
        for (let i = 0; i < 30; i++) { const hh = (hist[i + 1].t - hist[i].t) / 4; for (let j = 0; j < 4; j++) step(X, hist[i].inp[0], hist[i].inp[1], hist[i].inp[2], hist[i].inp[3], hh, AY0); }
        const wx = H0.pos[0] + X.px * H0.e1[0] + X.py * H0.e2[0] + X.pz * H0.e3[0], wy = H0.pos[1] + X.px * H0.e1[1] + X.py * H0.e2[1] + X.pz * H0.e3[1], wz = H0.pos[2] + X.px * H0.e1[2] + X.py * H0.e2[2] + X.pz * H0.e3[2];
        predErr = Math.hypot(wx - s.pos[0], wy - s.pos[1], wz - s.pos[2]);
      }
    }
    const want = new Set();
    if (best[0] > 0) want.add('ArrowRight'); else if (best[0] < 0) want.add('ArrowLeft');
    if (best[1] > 0) want.add('ArrowUp'); else if (best[1] < 0) want.add('ArrowDown');
    if (best[2] > 0) want.add('KeyD'); else if (best[2] < 0) want.add('KeyA');
    if (boostNow) want.add('Shift');
    lastBoostKey = boostNow;
    if (DEBUG) {
      const near = active.map((k, a) => ({ i: k.i, z: +k.z.toFixed(0), g: +bestInfo.gmin[a].toFixed(2), e: +bestInfo.extMin[a].toFixed(2), pg: k.pgap < 40 ? k.pgap : undefined, me: k.modelErr !== undefined && k.pgap < 12 ? +k.modelErr.toFixed(2) : undefined, v: k.vname, nr: k.cur.length })).filter((x) => x.g < 15 || x.e < 15 || x.pg !== undefined);
      const rec = { pe: predErr === null ? null : +predErr.toFixed(3), t: +ctx.t.toFixed(2), keys: [...want].join(','), cost: +bestCost.toFixed(0), goal: goal ? goal.i : null, n: scored.length, bk: lastBK, act: active.length, near };
      const MW = globalThis.__mockWorld;
      if (MW && process.env.MPC_DUMP) {                 // offline test world only: dump one rock's model vs truth
        const [di, dt0] = process.env.MPC_DUMP.split(',').map(Number), k = rocks.get(di);
        if (k && ctx.t >= dt0 && !k.dumped) {
          k.dumped = true; const az0 = Math.atan2(-k.y, -k.x); const lines = [`rock ${di} ${k.vname} s=${k.s} reach=${k.reach} z=${k.z.toFixed(1)} rings=${k.cur.length} pts=${k.cp.length} az0=${(az0 * 180 / Math.PI).toFixed(0)}`];
          lines.push('ring deltas (deg) of each ring nose vs now: ' + k.cur.map((g) => (Math.asin(clamp(Math.hypot(g.E3[0], g.E3[1]), -1, 1)) * 180 / Math.PI).toFixed(1)).join(' '));
          for (let el = -54; el <= 54; el += 6) {
            let row = `el ${String(el).padStart(3)}: `;
            for (let da = -24; da <= 24; da += 6) {
              const az = az0 + da * Math.PI / 180, e = el * Math.PI / 180, dp = [Math.cos(e) * Math.cos(az), Math.cos(e) * Math.sin(az), -Math.sin(e)];
              const est = surfEst(k, dp[0], dp[1], dp[2], 1), wv = [dp[0] * ctx.e1[0] + dp[1] * ctx.e2[0] + dp[2] * ctx.e3[0], dp[0] * ctx.e1[1] + dp[1] * ctx.e2[1] + dp[2] * ctx.e3[1], dp[0] * ctx.e1[2] + dp[1] * ctx.e2[2] + dp[2] * ctx.e3[2]];
              row += `${est.toFixed(1)}/${MW.trueR(k.i, wv).toFixed(1)} `;
            }
            lines.push(row);
          }
          console.error(lines.join('\n'));
        }
      }
      if (MW) {                                        // offline test world only: how wrong is the surface model?
        rec.err = [];
        for (const k of active) {
          if (!(k.z < 120 && k.z > -10)) continue;
          const az0 = Math.atan2(-k.y, -k.x); let worst = 9, wAt = null, n = 0;
          for (let da = -24; da <= 24; da += 6) for (let el = -54; el <= 54; el += 6) {
            const az = az0 + da * Math.PI / 180, e = el * Math.PI / 180, dp = [Math.cos(e) * Math.cos(az), Math.cos(e) * Math.sin(az), -Math.sin(e)];
            const est = surfEst(k, dp[0], dp[1], dp[2], 1), wv = [dp[0] * ctx.e1[0] + dp[1] * ctx.e2[0] + dp[2] * ctx.e3[0], dp[0] * ctx.e1[1] + dp[1] * ctx.e2[1] + dp[2] * ctx.e3[1], dp[0] * ctx.e1[2] + dp[1] * ctx.e2[2] + dp[2] * ctx.e3[2]];
            const tr = MW.trueR(k.i, wv), e2 = (est - tr) * Math.cos(e); n++;
            if (e2 < worst) { worst = e2; wAt = [da, el]; }
          }
          rec.err.push({ i: k.i, z: +k.z.toFixed(0), worst: +worst.toFixed(2), at: wAt });
        }
      }
      dbg.push(rec);
    }
    return { want, goal, bestCost, dbg };
  }
  return { plan, dbg, rocks };
}
function norm(v) { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

/* ================================ the flight ================================ */
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
let evSeen = 0;
const observe = () => page.evaluate(([NRING, from]) => {
  const A = window.__astra, s = A.state(), all = A.rocks(640), rs = [];
  for (const r of all) {
    const lat = Math.hypot(r.x, r.y);
    if (r.z < -r.reach - 40 || r.z > 560 || lat > r.reach + 90 + 0.6 * Math.max(0, r.z)) continue;
    if (r.z < 520) { const ring = new Array(NRING); for (let k = 0; k < NRING; k++) { const a = (k / NRING) * Math.PI * 2; ring[k] = A.surf(r.i, Math.cos(a), Math.sin(a)); } r.ring = ring; }
    rs.push(r);
  }
  return { s, rs, ev: s.events > from ? A.events(from).filter((e) => e.type === 'pass') : [] };
}, [NR, evSeen]);

// ---- title screen for a moment, then launch with Enter
for (let i = 0; i < 45; i++) await frame(i);
await page.keyboard.press('Enter');

const pilot = makePilot();
const log = [];
const T0 = (await state()).t;
let planMs = 0;
for (let f = 0; f < SECONDS * 30; f++) {
  const obs = await observe(), t = obs.s.t - T0; evSeen = obs.s.events;
  const c0 = Date.now();
  const { want, goal } = pilot.plan(obs);
  planMs += Date.now() - c0;
  // Set pieces: a look round at the ship mid-flight (and, on hard, back at Vega late on), and a burst of the wing guns.
  const lookAround = (t > 31 && t < 34.5) || (HARD && t > 58 && t < 61);
  if (t > 46 && t < 47.2) want.add('Space');
  await keys(want);
  if (lookAround) { const k = ((t > 50 ? t - 58 : t - 31) / (t > 50 ? 3 : 3.5)), x = W * (0.72 - Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.5); if (!page.__drag) { await page.mouse.move(W * 0.72, H * 0.45); await page.mouse.down(); page.__drag = true; } await page.mouse.move(x, H * 0.45 - Math.sin(k * Math.PI) * 40); }
  else if (page.__drag) { await page.mouse.up(); page.__drag = false; }
  const st = await frame(f);
  if (f % 30 === 0) log.push(`t=${t.toFixed(0)}s ${st.speed.toFixed(0)} m/s hull ${st.hull} score ${st.score} passes ${st.passes} closest ${st.closest} vega ${st.wing.dist} m ${goal ? `goal ${goal.i} z=${goal.z.toFixed(0)} s=${goal.s}` : 'cruising'} plan ${(planMs / (f + 1)).toFixed(0)} ms`);
}
await keys(new Set());
// End on the pause menu for a beat.
await page.keyboard.press('KeyP'); for (let i = 0; i < 50; i++) await frame(0);
await page.keyboard.press('KeyP'); for (let i = 0; i < 10; i++) await frame(0);

const s = await state(), ev = await page.evaluate(() => window.__astra.events(0));
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
fs.writeFileSync(LOG || (RECORD ? RECORD.replace(/\.mp4$/, '.json') : '/tmp/claude-0/pilot-run.json'), JSON.stringify({ frames, events: ev, final: s }));
if (DEBUG) fs.writeFileSync(DEBUG, JSON.stringify(pilot.dbg));
console.log(log.filter((_, i) => i % 3 === 0).join('\n'));
const passes = ev.filter((e) => e.type === 'pass');
console.log(`\n${SECONDS}s flown: ${passes.length} close passes, closest ${s.closest} m, score ${s.score}, ${s.hits} hits (hull ${s.hull}%), ${ev.filter((e) => e.type === 'breach').length} breaches`);
console.log('passes:', passes.map((p) => `${p.gap}m/${p.part}`).join(' '));
console.log('radio:', ev.filter((e) => e.type === 'radio').map((e) => e.text).join(' | '));
console.log('errors:', g.errors.filter((e) => !e.includes('ERR_TOO_MANY_RETRIES')).slice(0, 5));
await g.browser.close();
