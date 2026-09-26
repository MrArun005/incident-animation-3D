// A hand-drawn ink engine for "Before the Alarm": pencil-and-ink strokes on paper that
// "boil" (redrawn with fresh jitter eight times a second, the way hand-drawn animation
// shimmers), draw themselves on, taper at the ends and carry a faint pencil ghost line.
// Minimal colour: warm paper, brown-black ink, grey wash and one red-ochre accent.
import { W, H, TAU, clamp, lerp, rng, cached } from '../rich/core.js';

export let g = null;
export function bind(ctx) { g = ctx; }
export const INK = '#2a2521', SOFT = '#6f675d', GREY = '#a39b8e', OCHRE = '#b8562a', PAPER = '#f2ebdb', NIGHT = '#1d1a18';

let BO = 0;
export function boil(t) { BO = Math.floor(t * 8); }
// Integer hash noise in [-1, 1].
export function hn(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 1013, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

// ---- paper ---------------------------------------------------------------------------------------
export function paper(dark = 0) {
  const P = cached('paper', W, H, (c) => {
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    const r = rng(11), img = c.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
    c.putImageData(img, 0, 0);
    // Fibres and a few soft stains, like cold-pressed paper.
    for (let i = 0; i < 2600; i++) { const x = r() * W, y = r() * H, a = r() * TAU, l = 4 + r() * 16; c.strokeStyle = `rgba(120,100,70,${0.04 + r() * 0.05})`; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H, R = 120 + r() * 260, gr = c.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, 'rgba(170,140,90,0.05)'); gr.addColorStop(1, 'rgba(170,140,90,0)'); c.fillStyle = gr; c.fillRect(x - R, y - R, R * 2, R * 2); }
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(90,70,40,0)'); v.addColorStop(1, 'rgba(90,70,40,0.22)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  });
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(P, 0, 0);
  if (dark > 0) { g.fillStyle = `rgba(29,26,24,${dark})`; g.fillRect(0, 0, W, H); }
}

// ---- camera --------------------------------------------------------------------------------------
export function cam(x = W / 2, y = H / 2, z = 1, rot = 0) {
  const c = Math.cos(rot) * z, s = Math.sin(rot) * z;
  g.setTransform(c, s, -s, c, W / 2 - (x * c - y * s), H / 2 - (x * s + y * c));
}

// ---- strokes -------------------------------------------------------------------------------------
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= L) { const k = d / L; out.push([ax + (bx - ax) * k, ay + (by - ay) * k]); d += step; }
    carry = L - (d - step);
  }
  const last = pts[pts.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
// A stroke through pts: o = { w, col, a, jit, seed, prog, ghost, wob }.
export function stroke(pts, o = {}) {
  const prog = clamp(o.prog ?? 1, 0, 1), a = o.a ?? 1;
  if (prog <= 0 || a <= 0.003 || pts.length < 2) return;
  const w = o.w ?? 3, col = o.col ?? INK, jit = o.jit ?? 1.1, seed = o.seed ?? 1, wob = o.wob ?? 1.6;
  const P = resample(pts, o.step ?? 8), n = Math.max(2, Math.ceil(P.length * prog));
  const Q = new Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y] = P[i];
    Q[i] = [x + hn(seed * 131 + i, BO) * jit + hn(seed * 17 + (i >> 2), 7) * wob, y + hn(seed * 977 + i, BO + 50) * jit + hn(seed * 29 + (i >> 2), 9) * wob];
  }
  g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  const CH = 5, N = P.length;
  for (let s = 0; s < n - 1; s += CH) {
    const e = Math.min(n - 1, s + CH), taper = Math.min(1, (s + 2) / 5, (N - s) / 5);
    g.lineWidth = Math.max(0.6, w * (0.82 + 0.28 * hn(seed * 53 + s, 3)) * (0.45 + 0.55 * taper));
    g.beginPath(); g.moveTo(Q[s][0], Q[s][1]);
    for (let i = s + 1; i <= e; i++) g.lineTo(Q[i][0], Q[i][1]);
    g.stroke();
  }
  if (o.ghost !== false && w > 1.2) {
    g.globalAlpha = a * 0.28; g.lineWidth = Math.max(0.5, w * 0.4); g.beginPath();
    for (let i = 0; i < n; i++) { const x = Q[i][0] + hn(seed * 7 + i, BO + 3) * 1.8 + 1.2, y = Q[i][1] + hn(seed * 11 + i, BO + 5) * 1.8 - 0.8; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }
  g.restore();
}
export const line = (x1, y1, x2, y2, o = {}) => {
  const bow = o.bow ?? 0, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
  stroke([[x1, y1], [mx + nx * bow, my + ny * bow], [x2, y2]], o);
};
// Point generators.
export function circPts(x, y, r, seed = 1, over = 0.1, ry = r, rot = 0) {
  const a0 = hn(seed, 1) * Math.PI, n = Math.max(12, Math.round(r * 0.5)), pts = [];
  for (let i = 0; i <= n * (1 + over); i++) {
    const a = a0 + (i / n) * TAU, k = 1 + 0.035 * Math.sin(a * 2 + seed) + 0.02 * (i / n), cx = Math.cos(a) * r * k, cy = Math.sin(a) * ry * k;
    pts.push([x + cx * Math.cos(rot) - cy * Math.sin(rot), y + cx * Math.sin(rot) + cy * Math.cos(rot)]);
  }
  return pts;
}
export function arcPts(x, y, r, a0, a1, ry = r) { const n = Math.max(6, Math.round(Math.abs(a1 - a0) * r / 8)), pts = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * ry]); } return pts; }
export const circle = (x, y, r, o = {}) => stroke(circPts(x, y, r, o.seed ?? 1, o.over ?? 0.1, o.ry ?? r, o.rot ?? 0), o);
export const poly = (pts, o = {}) => stroke(o.closed ? [...pts, pts[0]] : pts, o);
// Smooth a polyline with Chaikin corner cutting.
export function smooth(pts, it = 2, closed = false) {
  let p = pts;
  for (let k = 0; k < it; k++) {
    const q = []; const n = p.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) { const a = p[i], b = p[(i + 1) % n]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    if (!closed) { q.unshift(p[0]); q.push(p[n - 1]); }
    p = q;
  }
  return p;
}

// ---- fills ---------------------------------------------------------------------------------------
function tracePath(pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
export function fill(pts, col = PAPER, a = 1) { if (a <= 0) return; g.save(); g.globalAlpha = a; g.fillStyle = col; tracePath(pts); g.fill(); g.restore(); }
// A watercolour wash: multiplied, with a slightly darker, offset second layer for the pooled edge.
export function wash(pts, col = OCHRE, a = 0.35, seed = 1) {
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = col;
  g.globalAlpha = a; tracePath(pts.map(([x, y], i) => [x + hn(seed + i, 3) * 2.5, y + hn(seed + i, 4) * 2.5])); g.fill();
  g.globalAlpha = a * 0.35; g.translate(2.5, 1.5); tracePath(pts); g.fill();
  g.restore();
}
// Hatching clipped to a polygon.
export function hatch(pts, o = {}) {
  const ang = o.ang ?? -0.8, gap = o.gap ?? 9, prog = o.prog ?? 1, seed = o.seed ?? 3;
  if (prog <= 0) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4, ca = Math.cos(ang), sa = Math.sin(ang);
  g.save(); tracePath(pts); g.clip();
  const n = Math.ceil((2 * R) / gap), m = Math.ceil(n * prog);
  for (let i = 0; i < m; i++) {
    const d = -R + i * gap, px = cx - sa * d, py = cy + ca * d;
    stroke([[px - ca * R, py - sa * R], [px + ca * R, py + sa * R]], { w: o.w ?? 1.3, col: o.col ?? INK, a: o.a ?? 0.5, jit: 0.8, wob: 1, seed: seed + i, ghost: false, step: 14 });
  }
  g.restore();
}
// A soft round glow (for fire, sun, the ochre accent).
export function glow(x, y, r, col, a = 1) {
  if (a <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}

// ---- the figure ----------------------------------------------------------------------------------
// A posed, hand-drawn person. Angles are radians measured from straight DOWN, positive swinging
// FORWARD (towards +x when facing right). Upper limbs: a* (upper arm), f* (forearm, relative);
// legs: t* (thigh), s* (shin, relative; negative bends the knee back). lean tilts the torso
// forward. The figure grounds itself: its lowest foot (or its seat, when sit) lands on y.
export const POSE = {
  stand: () => ({ lean: 0.03, neck: 0, aB: -0.08, fB: 0.25, aF: 0.1, fF: 0.3, tB: -0.05, sB: 0, tF: 0.06, sF: -0.04 }),
  walk: (p) => { const s = Math.sin(p); return { lean: 0.07, neck: -0.03, aB: 0.38 * s, fB: 0.35 + 0.2 * Math.max(0, s), aF: -0.38 * s, fF: 0.35 + 0.2 * Math.max(0, -s), tB: -0.42 * s, sB: -0.55 * Math.max(0, Math.sin(p + 1.9)), tF: 0.42 * s, sF: -0.55 * Math.max(0, Math.sin(p + 1.9 + Math.PI)) }; },
  stretch: (k) => ({ lean: -0.06 * k, neck: -0.25 * k, aB: lerp(-0.1, 2.9, k), fB: lerp(0.3, 0.1, k), aF: lerp(0.1, 3.0, k), fF: lerp(0.3, 0.1, k), tB: -0.05, sB: 0, tF: 0.06, sF: -0.04 }),
  sitUp: (k) => ({ lean: lerp(-1.45, -0.15, k), neck: 0.2 * (1 - k), aB: 0.5, fB: 0.6, aF: lerp(0.9, 0.6, k), fF: 0.5, tB: 1.5, sB: -0.1, tF: 1.45, sF: -0.4 * k, sit: true }),
  kneelGrind: (p) => { const s = Math.sin(p); return { lean: 0.72 + 0.2 * s, neck: -0.45 - 0.15 * s, aB: 0.7 + 0.35 * s, fB: 0.2, aF: 0.8 + 0.35 * s, fF: 0.15, tB: 0.28, sB: -1.85, tF: 0.32, sF: -1.9 }; },
  sitCross: (p = 0) => ({ lean: 0.22, neck: 0.3, aB: 0.55, fB: 1.05 + 0.08 * Math.sin(p), aF: 0.65, fF: 1.0 + 0.1 * Math.sin(p * 1.3), tB: 1.42, sB: -2.95, tF: 1.5, sF: -3.0, sit: true }),
  sitKnees: (p = 0) => ({ lean: 0.18 + 0.03 * Math.sin(p), neck: 0.05, aB: 1.0, fB: 0.5, aF: 1.05, fF: 0.45, tB: 2.4, sB: -2.15, tF: 2.5, sF: -2.2, sit: true }),
  flute: (p = 0) => ({ lean: 0.08, neck: -0.12, aB: 0.95, fB: 2.05 + 0.04 * Math.sin(p * 5), aF: 1.1, fF: 1.95 + 0.04 * Math.sin(p * 6), tB: 1.42, sB: -2.95, tF: 1.5, sF: -3.0, sit: true }),
  dig: (p) => { const s = Math.sin(p); return { lean: 0.95 + 0.1 * s, neck: -0.6, aB: 0.35 + 0.25 * s, fB: 0.1, aF: 0.45 + 0.25 * s, fF: 0.05, tB: -0.3, sB: -0.25, tF: 0.55, sF: -0.9 }; },
  hoe: (p) => { const k = 0.5 + 0.5 * Math.sin(p); return { lean: lerp(0.15, 0.65, 1 - k), neck: -0.3, aB: lerp(0.9, 2.6, k), fB: 0.2, aF: lerp(1.0, 2.7, k), fF: 0.15, tB: -0.3, sB: -0.05, tF: 0.3, sF: -0.3 }; },
  reap: (p) => { const s = Math.sin(p); return { lean: 0.85, neck: -0.45, aB: 1.0 + 0.1 * s, fB: 0.4, aF: 1.25 + 0.5 * s, fF: 0.25, tB: -0.3, sB: -0.35, tF: 0.45, sF: -0.7 }; },
  sow: (p) => { const s = Math.sin(p); return { ...POSE.walk(p), aF: 0.9 + 0.7 * s, fF: 0.3, aB: 0.9, fB: 1.6 }; },
  carryPots: (p) => ({ ...POSE.walk(p), aB: 2.9, fB: 0.5, aF: 3.0, fF: 0.45, lean: 0.02 }),
  guard: (p = 0) => ({ lean: 0.02, neck: -0.05 + 0.1 * Math.sin(p * 0.7), aB: -0.05, fB: 0.3, aF: 0.45, fF: 1.3, tB: -0.12, sB: 0, tF: 0.14, sF: -0.03 }),
  bow: (k = 1) => ({ lean: 0.02, neck: 0, aB: lerp(1.1, 1.45, k), fB: lerp(0.4, 1.6, k), aF: 1.55, fF: 0, tB: -0.25, sB: 0, tF: 0.25, sF: -0.05 }),
  give: (k = 1) => ({ lean: 0.1 * k, neck: 0.1, aB: 0.05, fB: 0.3, aF: lerp(0.2, 1.3, k), fF: lerp(0.4, 0.05, k), tB: -0.1, sB: 0, tF: 0.12, sF: -0.06 }),
  tell: (p) => ({ lean: 0.1 * Math.sin(p * 0.6), neck: -0.2, aB: 2.2 + 0.35 * Math.sin(p), fB: 0.4, aF: 2.5 + 0.4 * Math.sin(p * 1.3 + 1), fF: 0.3 + 0.2 * Math.sin(p), tB: 2.4, sB: -2.15, tF: 2.5, sF: -2.2, sit: true }),
  type: (p) => ({ chair: true, lean: 0.18, neck: 0.1, aB: 1.0, fB: 0.55 + 0.06 * Math.sin(p * 9), aF: 1.1, fF: 0.45 + 0.06 * Math.sin(p * 11 + 1), tB: 1.5, sB: -1.45, tF: 1.52, sF: -1.5, sit: true }),
  slump: (p = 0) => ({ chair: true, lean: 0.35, neck: 0.4, aB: 0.9, fB: 0.9, aF: 1.0, fF: 0.85, tB: 1.5, sB: -1.45, tF: 1.52, sF: -1.5, sit: true }),
  hold: (p = 0) => ({ lean: 0.08, neck: 0.35, aB: 0.25, fB: 0.9, aF: 0.3, fF: 0.95, tB: -0.05, sB: 0, tF: 0.06, sF: -0.04 }),
};
export function mixPose(a, b, k) { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const va = a[key] ?? 0, vb = b[key] ?? 0; o[key] = typeof va === 'boolean' || typeof vb === 'boolean' ? (k < 0.5 ? a[key] : b[key]) : va + (vb - va) * k; } return o; }
const dir = (a) => [Math.sin(a), Math.cos(a)];
const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];
// Limb as a filled tube with two jittered contour lines.
function limb(a, b, w1, w2, o, seed) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const q = [[a[0] + nx * w1, a[1] + ny * w1], [b[0] + nx * w2, b[1] + ny * w2], [b[0] - nx * w2, b[1] - ny * w2], [a[0] - nx * w1, a[1] - ny * w1]];
  fill([...q, ...arcPts(a[0], a[1], w1, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI)], o.body, 1);
  g.save(); g.fillStyle = o.body; g.beginPath(); g.arc(b[0], b[1], w2, 0, TAU); g.fill(); g.restore();
  if (o.cloth) wash(q, o.cloth, o.clothA ?? 0.3, seed);
  stroke([q[0], q[1]], { w: o.lw, col: o.ink, a: o.a, seed, prog: o.prog });
  stroke([q[3], q[2]], { w: o.lw, col: o.ink, a: o.a, seed: seed + 1, prog: o.prog });
}
// st: { face: 1|-1, hair: 'short'|'long'|'bun'|'coil'|'hat'|'bald', wrap (forager hide), tunic, shirt, trousers,
//       ink, a, prog, body }
export function figure(x, y, s, pose, st = {}) {
  const U = 170 * s, face = st.face ?? 1, seed = st.seed ?? 5;
  if (!st.dry && (st.prog ?? 1) <= 0) return { hand: [x, y], handB: [x, y], head: [x, y], hr: 0, shoulder: [x, y], pelvis: [x, y], feet: [[x, y], [x, y]], knees: [[x, y], [x, y]], U };
  const P = { lean: 0, neck: 0, ...pose };
  const pel = [0, 0], torsoL = 0.29 * U;
  const shoulder = [Math.sin(P.lean) * torsoL, -Math.cos(P.lean) * torsoL];
  const neckTop = [shoulder[0] + Math.sin(P.lean + P.neck * 0.5) * 0.04 * U, shoulder[1] - Math.cos(P.lean + P.neck * 0.5) * 0.04 * U];
  const hr = 0.078 * U, head = [neckTop[0] + Math.sin(P.lean + P.neck) * hr * 0.9, neckTop[1] - Math.cos(P.lean + P.neck) * hr * 0.9];
  const arm = (a, f) => { const e = add(shoulder, dir(a), 0.165 * U); return [e, add(e, dir(a + f), 0.15 * U)]; };
  const leg = (t, sh) => { const k = add(pel, dir(t), 0.235 * U); const an = add(k, dir(t + sh), 0.225 * U); return [k, an]; };
  const [eB, hB] = arm(P.aB, P.fB), [eF, hF] = arm(P.aF, P.fF), [kB, aB] = leg(P.tB, P.sB), [kF, aF] = leg(P.tF, P.sF);
  let low = Math.max(aB[1], aF[1]) + 0.022 * U;
  if (P.chair) low = 0.035 * U;
  else if (P.sit) low = Math.max(0.035 * U, aB[1] + 0.02 * U, aF[1] + 0.02 * U, kB[1] + 0.03 * U, kF[1] + 0.03 * U);
  else low = Math.max(low, kB[1] + 0.03 * U, kF[1] + 0.03 * U);
  const oy = y - low;
  if (st.dry) { const T = ([px, py]) => [x + px * face, y - low + py]; return { hand: T(hF), handB: T(hB), head: T(head), hr, shoulder: T(shoulder), pelvis: T(pel), feet: [T(aB), T(aF)], knees: [T(kB), T(kF)], U }; }
  const ink = st.ink ?? INK, a = st.a ?? 1, body = st.body ?? PAPER, lw = st.lw ?? Math.max(1.6, 3.2 * s), prog = st.prog ?? 1;
  const back = { body, ink: st.backInk ?? SOFT, a, lw: lw * 0.9, prog, cloth: null };
  const front = { body, ink, a, lw, prog };
  g.save(); g.translate(x, oy); g.scale(face, 1);
  const W1 = 0.042 * U;
  // Back limbs, lighter.
  limb(pel, kB, W1 * 1.25, W1 * 0.95, { ...back, cloth: st.trousers }, seed + 10);
  limb(kB, aB, W1 * 0.95, W1 * 0.7, { ...back, cloth: st.trousers }, seed + 12);
  stroke([aB, [aB[0] + 0.07 * U * Math.cos(P.tB + P.sB) , aB[1] + 0.01 * U]], { w: lw, col: back.ink, a, seed: seed + 14, prog });
  limb(shoulder, eB, W1 * 0.8, W1 * 0.65, { ...back, cloth: st.shirt ?? st.tunic }, seed + 16);
  limb(eB, hB, W1 * 0.62, W1 * 0.5, back, seed + 18);
  circle(hB[0], hB[1], W1 * 0.7, { w: lw * 0.8, col: back.ink, a, seed: seed + 19, prog, over: 0.05 });
  // Torso.
  const tl = torsoL, tdx = shoulder[0] / tl, tdy = shoulder[1] / tl, nx = -tdy, ny = tdx, cw = 0.085 * U, ww = 0.07 * U, hw = 0.075 * U;
  const at = (k, w) => [pel[0] + shoulder[0] * k + nx * w, pel[1] + shoulder[1] * k + ny * w];
  const torso = [at(0.96, cw * 0.95), at(0.72, cw * 1.05), at(0.42, ww), at(0.05, hw), at(-0.02, 0), at(0.05, -hw), at(0.42, -ww * 0.95), at(0.75, -cw), at(0.97, -cw * 0.8), at(1.03, 0)];
  const tsm = smooth(torso, 2, true);
  fill(tsm, body, 1);
  if (st.tunic) { wash(smooth([at(1.0, cw), at(0.4, ww * 1.1), at(-0.35, hw * 1.35), at(-0.36, -hw * 1.35), at(0.4, -ww * 1.1), at(1.0, -cw)], 2, true), st.tunic, st.tunicA ?? 0.32, seed); }
  if (st.shirt) wash(tsm, st.shirt, st.shirtA ?? 0.3, seed);
  stroke(tsm, { w: lw, col: ink, a, seed: seed + 20, prog });
  if (st.wrap) {
    const wr = smooth([at(0.2, ww * 1.15), at(-0.05, hw * 1.2), [pel[0] + 0.04 * U, pel[1] + 0.13 * U], [pel[0] - 0.05 * U, pel[1] + 0.12 * U], at(-0.05, -hw * 1.2), at(0.2, -ww * 1.1)], 2, true);
    fill(wr, body, 1); wash(wr, st.wrap, 0.42, seed + 3); stroke(wr, { w: lw * 0.85, col: ink, a, seed: seed + 22, prog });
    hatch(wr, { gap: 7, a: 0.3 * a, prog, seed: seed + 23, w: 1 });
  }
  // Front limbs.
  limb(pel, kF, W1 * 1.25, W1 * 0.95, { ...front, cloth: st.trousers }, seed + 30);
  limb(kF, aF, W1 * 0.95, W1 * 0.7, { ...front, cloth: st.trousers }, seed + 32);
  stroke([aF, [aF[0] + 0.075 * U, aF[1] + 0.012 * U]], { w: lw * 1.1, col: ink, a, seed: seed + 34, prog });
  // Head.
  const hd = circPts(head[0], head[1], hr, seed + 40, 0.08, hr * 1.08, 0);
  fill(hd, body, 1);
  const hair = st.hair ?? 'short';
  if (hair !== 'bald' && hair !== 'hat') {
    const hp = smooth([[head[0] - hr * 1.02, head[1] + hr * 0.1], [head[0] - hr * 0.9, head[1] - hr * 0.8], [head[0] + hr * 0.1, head[1] - hr * 1.18], [head[0] + hr * 0.85, head[1] - hr * 0.62], [head[0] + hr * 0.55, head[1] - hr * 0.4], [head[0] - hr * 0.2, head[1] - hr * 0.45], [head[0] - hr * 0.55, head[1] + hr * 0.2]], 2, true);
    wash(hp, INK, 0.5, seed + 41);
    if (hair === 'coil') for (let i = 0; i < 9; i++) { const aa = -2.6 + i * 0.32, cx = head[0] + Math.cos(aa) * hr * 0.85, cy = head[1] + Math.sin(aa) * hr * 0.9; circle(cx, cy, hr * 0.14, { w: lw * 0.55, col: ink, a, seed: seed + 50 + i, prog, jit: 0.4, wob: 0.3 }); }
    else hatch(hp, { gap: 5, ang: 0.9, a: 0.55 * a, prog, seed: seed + 42, w: 1.1 });
    if (hair === 'long') stroke(smooth([[head[0] - hr * 0.8, head[1] - hr * 0.2], [head[0] - hr * 1.15, head[1] + hr * 0.9], [head[0] - hr * 1.0, head[1] + hr * 1.8]], 2), { w: lw * 1.6, col: ink, a: a * 0.8, seed: seed + 43, prog });
    if (hair === 'bun') circle(head[0] - hr * 0.95, head[1] - hr * 0.35, hr * 0.33, { w: lw, col: ink, a, seed: seed + 44, prog });
  }
  stroke(hd, { w: lw, col: ink, a, seed: seed + 45, prog });
  if (hair === 'hat') { stroke([[head[0] - hr * 1.6, head[1] - hr * 0.35], [head[0] + hr * 1.6, head[1] - hr * 0.45]], { w: lw * 1.2, col: ink, a, seed: seed + 46, prog }); const hp = [[head[0] - hr * 0.85, head[1] - hr * 0.4], [head[0] - hr * 0.7, head[1] - hr * 1.3], [head[0] + hr * 0.7, head[1] - hr * 1.35], [head[0] + hr * 0.85, head[1] - hr * 0.45]]; fill(hp, body); wash(hp, GREY, 0.5, seed); stroke([...hp], { w: lw, col: ink, a, seed: seed + 47, prog }); }
  // Face: an eye, a nose tick, a mouth; features sit toward the facing side.
  if (prog > 0.6) {
    const fa = a * clamp((prog - 0.6) / 0.3, 0, 1), fx = head[0] + hr * 0.42, fy = head[1] - hr * 0.05;
    if (st.eyesShut) stroke([[fx - hr * 0.14, fy], [fx + hr * 0.1, fy + hr * 0.04]], { w: lw * 0.8, col: ink, a: fa, seed: seed + 60 });
    else { g.save(); g.globalAlpha = fa; g.fillStyle = ink; g.beginPath(); g.arc(fx, fy, Math.max(1.2, hr * 0.08), 0, TAU); g.fill(); g.restore(); }
    stroke([[head[0] + hr * 0.95, head[1] - hr * 0.02], [head[0] + hr * 1.12, head[1] + hr * 0.25], [head[0] + hr * 0.94, head[1] + hr * 0.3]], { w: lw * 0.75, col: ink, a: fa, seed: seed + 61, jit: 0.5, wob: 0.3 });
    const sm = st.smile ?? 0.2;
    stroke([[head[0] + hr * 0.55, head[1] + hr * 0.55], [head[0] + hr * 0.72, head[1] + hr * (0.58 + sm * 0.1)], [head[0] + hr * 0.86, head[1] + hr * (0.52 - sm * 0.05)]], { w: lw * 0.7, col: ink, a: fa, seed: seed + 62, jit: 0.4, wob: 0.3 });
  }
  // Front arm last so it reads over the body.
  limb(shoulder, eF, W1 * 0.8, W1 * 0.65, { ...front, cloth: st.shirt ?? st.tunic }, seed + 70);
  limb(eF, hF, W1 * 0.62, W1 * 0.5, front, seed + 72);
  fill(circPts(hF[0], hF[1], W1 * 0.72, seed + 74), body, 1);
  circle(hF[0], hF[1], W1 * 0.72, { w: lw * 0.9, col: ink, a, seed: seed + 75, prog, over: 0.05 });
  g.restore();
  const T = ([px, py]) => [x + px * face, oy + py];
  return { hand: T(hF), handB: T(hB), head: T(head), hr, shoulder: T(shoulder), pelvis: T(pel), feet: [T(aB), T(aF)], knees: [T(kB), T(kF)], U };
}

// ---- skeleton (front view) -----------------------------------------------------------------------
function bone(a, b, w, o, seed) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
  const q = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
  fill(q, PAPER, o.a); [a, b].forEach(([x, y], i) => { [-1, 1].forEach((sd) => fill(circPts(x + nx * sd * 0.9, y + ny * sd * 0.9, w * 1.05, seed + i * 3 + sd), PAPER, o.a)); });
  stroke([[a[0] + nx * 0.8, a[1] + ny * 0.8 + w * 0.3], [(a[0] + b[0]) / 2 + nx * 0.75, (a[1] + b[1]) / 2 + ny * 0.75], [b[0] + nx * 0.8, b[1] + ny * 0.8 - w * 0.3]], { ...o, seed });
  stroke([[a[0] - nx * 0.8, a[1] - ny * 0.8 + w * 0.3], [(a[0] + b[0]) / 2 - nx * 0.75, (a[1] + b[1]) / 2 - ny * 0.75], [b[0] - nx * 0.8, b[1] - ny * 0.8 - w * 0.3]], { ...o, seed: seed + 1 });
  [a, b].forEach(([x, y], i) => [-1, 1].forEach((sd) => stroke(arcPts(x + nx * sd * 0.9, y + ny * sd * 0.9, w * 1.05, 0, TAU), { ...o, w: o.w * 0.8, seed: seed + 5 + i * 2 + sd })));
}
// x: centre, y: ground, h: height. o = { prog, a, frail (0..1), hunch (0..1), cavities, cracks, arthritis, glow }
export function skeleton(x, y, h, o = {}) {
  const prog = o.prog ?? 1, a = o.a ?? 1, fr = o.frail ?? 0, hunch = o.hunch ?? 0, lw = o.lw ?? 2.4, seed = o.seed ?? 100;
  const Y = (k) => y - h + k * h, bw = (k) => k * h * (1 - fr * 0.2);
  const step = (i, n = 12) => clamp(prog * n - i, 0, 1);
  const so = (i) => ({ w: lw, col: INK, a, prog: step(i), jit: 0.7, wob: 0.8 });
  const sx = (k) => x + hunch * h * 0.05 * Math.sin(k * Math.PI);
  // Skull.
  const skR = 0.062 * h, sk = [sx(0.06), Y(0.065)];
  const skull = smooth([[sk[0] - skR, sk[1] + skR * 0.2], [sk[0] - skR * 0.95, sk[1] - skR * 0.7], [sk[0], sk[1] - skR * 1.1], [sk[0] + skR * 0.95, sk[1] - skR * 0.7], [sk[0] + skR, sk[1] + skR * 0.2], [sk[0] + skR * 0.72, sk[1] + skR * 0.9], [sk[0] + skR * 0.4, sk[1] + skR * 1.45], [sk[0] - skR * 0.4, sk[1] + skR * 1.45], [sk[0] - skR * 0.72, sk[1] + skR * 0.9]], 2, true);
  fill(skull, PAPER, a); stroke(skull, { ...so(0), seed });
  [-1, 1].forEach((sd) => { const e = circPts(sk[0] + sd * skR * 0.4, sk[1] + skR * 0.12, skR * 0.27, seed + sd, 0.05, skR * 0.24); fill(e, INK, a * 0.75 * step(0)); });
  stroke([[sk[0], sk[1] + skR * 0.45], [sk[0] - skR * 0.1, sk[1] + skR * 0.68], [sk[0] + skR * 0.1, sk[1] + skR * 0.68]], { ...so(0), seed: seed + 3, w: lw * 0.8 });
  // Teeth: a row of small ticks; the farmer's show dark cavities.
  for (let i = -3; i <= 3; i++) { const tx = sk[0] + i * skR * 0.13; stroke([[tx, sk[1] + skR * 1.05], [tx, sk[1] + skR * 1.3]], { w: lw * 0.55, col: INK, a, prog: step(1), seed: seed + 10 + i, jit: 0.3, wob: 0.2 }); if (o.cavities && (i === -2 || i === 1 || i === 2)) { g.save(); g.globalAlpha = a * step(1) * o.cavities; g.fillStyle = INK; g.beginPath(); g.arc(tx + skR * 0.06, sk[1] + skR * 1.17, skR * 0.06, 0, TAU); g.fill(); g.restore(); } }
  stroke([[sk[0] - skR * 0.5, sk[1] + skR * 1.17], [sk[0] + skR * 0.5, sk[1] + skR * 1.17]], { w: lw * 0.6, col: INK, a, prog: step(1), seed: seed + 20 });
  // Spine: a column of vertebrae.
  for (let i = 0; i < 16; i++) { const k = 0.155 + i * 0.022, vx = sx(k); if (step(2) * 16 > i) stroke(circPts(vx, Y(k), 0.014 * h, seed + 30 + i, 0.05, 0.008 * h), { w: lw * 0.7, col: INK, a, jit: 0.3, wob: 0.2, seed: seed + 30 + i }); }
  // Collarbones, ribs.
  const shY = Y(0.19), shW = bw(0.125);
  [-1, 1].forEach((sd) => { stroke([[sx(0.17), Y(0.175)], [sx(0.19) + sd * shW * 0.55, Y(0.17)], [sx(0.19) + sd * shW, shY]], { ...so(3), seed: seed + 50 + sd }); });
  for (let r = 0; r < 6; r++) { const k = 0.205 + r * 0.028, rw = bw(0.1) * (1 - Math.abs(r - 2) * 0.07); [-1, 1].forEach((sd) => stroke(smooth([[sx(k), Y(k)], [sx(k) + sd * rw * 0.7, Y(k) - h * 0.008], [sx(k) + sd * rw, Y(k) + h * 0.018], [sx(k) + sd * rw * 0.85, Y(k) + h * 0.04]], 2), { w: lw * 0.8, col: INK, a, prog: step(4), seed: seed + 60 + r * 2 + sd, jit: 0.6 })); }
  // Pelvis.
  const pc = [sx(0.5), Y(0.505)], pw = bw(0.1);
  const pel = smooth([[pc[0], pc[1] - h * 0.02], [pc[0] - pw * 0.5, pc[1] - h * 0.05], [pc[0] - pw, pc[1] - h * 0.03], [pc[0] - pw * 0.8, pc[1] + h * 0.03], [pc[0] - pw * 0.3, pc[1] + h * 0.055], [pc[0], pc[1] + h * 0.035], [pc[0] + pw * 0.3, pc[1] + h * 0.055], [pc[0] + pw * 0.8, pc[1] + h * 0.03], [pc[0] + pw, pc[1] - h * 0.03], [pc[0] + pw * 0.5, pc[1] - h * 0.05]], 2, true);
  fill(pel, PAPER, a); stroke(pel, { ...so(5), seed: seed + 80 });
  // Arms and legs.
  const W0 = 0.011 * h * (1 - fr * 0.25), limbs = [];
  [-1, 1].forEach((sd) => {
    const sh = [sx(0.19) + sd * shW, shY], el = [x + sd * bw(0.15), Y(0.355)], wr = [x + sd * bw(0.165), Y(0.5)];
    const hip = [pc[0] + sd * pw * 0.55, pc[1] + h * 0.02], kn = [x + sd * bw(0.07), Y(0.745)], an = [x + sd * bw(0.075), Y(0.96)];
    limbs.push({ sd, sh, el, wr, hip, kn, an });
  });
  limbs.forEach(({ sd, sh, el, wr, hip, kn, an }, j) => {
    const st6 = step(6), st7 = step(7), st8 = step(8), st9 = step(9);
    if (st6 > 0) bone(sh, el, W0, { w: lw * 0.85, col: INK, a, prog: st6 }, seed + 90 + j * 20);
    if (st7 > 0) { bone(el, wr, W0 * 0.7, { w: lw * 0.75, col: INK, a, prog: st7 }, seed + 95 + j * 20); for (let f = 0; f < 4; f++) stroke([[wr[0] + sd * f * 2 - sd * 3, wr[1] + h * 0.01], [wr[0] + sd * (f * 3 - 2), wr[1] + h * 0.055]], { w: lw * 0.55, col: INK, a, prog: st7, seed: seed + 99 + f + j * 20, jit: 0.4, wob: 0.3 }); }
    if (st8 > 0) bone(hip, kn, W0 * 1.3, { w: lw, col: INK, a, prog: st8 }, seed + 130 + j * 20);
    if (st9 > 0) { bone(kn, an, W0 * 1.05, { w: lw * 0.9, col: INK, a, prog: st9 }, seed + 135 + j * 20); stroke([[an[0], an[1] + h * 0.012], [an[0] + sd * h * 0.045, an[1] + h * 0.035], [an[0] + sd * h * 0.012, an[1] + h * 0.04]], { w: lw * 0.85, col: INK, a, prog: st9, seed: seed + 139 + j * 20 }); }
    if (o.arthritis && st9 > 0) { circle(kn[0], kn[1], h * 0.035, { w: lw * 1.2, col: OCHRE, a: a * o.arthritis, seed: seed + 150 + j, over: 0.6 }); glow(kn[0], kn[1], h * 0.06, 'rgba(184,86,42,0.35)', o.arthritis); }
    if (o.cracks && st8 > 0 && j === 1) { const m = [(hip[0] + kn[0]) / 2, (hip[1] + kn[1]) / 2]; stroke([[m[0] - W0 * 1.6, m[1] - 6], [m[0] - 2, m[1] + 2], [m[0] + 3, m[1] - 5], [m[0] + W0 * 1.6, m[1] + 4]], { w: lw * 1.1, col: OCHRE, a: a * o.cracks, seed: seed + 160, jit: 0.3, wob: 0.2 }); }
  });
  return { skull: sk, skR, top: Y(0) - skR * 0.1, jaw: [sk[0], sk[1] + skR * 1.2], knees: limbs.map((l) => l.kn), feet: limbs.map((l) => l.an), hip: pc };
}
