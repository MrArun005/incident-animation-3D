// The Prabhu Deva character on the SPARK cutout rig (the SPARK character sheet and the SPARK x MUKKALA
// capture): 7.65 heads, a pelvis that tilts and shifts on its own, a shoulder bar that tilts against it,
// limbs as round-capped chains with one merged outline, six hand shapes, five foot contact states. The head is
// his (src/prabhu-char.js drawHead): the wave of hair, brows, moustache, grin and the hats.
// Pose params are SPARK's, in degrees, with each limb's second angle ABSOLUTE (not relative to the first):
//   hs hip shift (head units), pt pelvis tilt, tl torso lean, st shoulder tilt, ht head tilt, hx head slide,
//   aL aR [upper arm, forearm], lL lR [thigh, shin], hL hR hand shape, fL fR foot state,
// plus ours: face (0 grin, 1 focus, 2 wink, 3 oh), sx (spin squash), y (jump, in heights), inv (invisible man).
import { drawHead, L as CL } from './prabhu-char.js';

const TAU = Math.PI * 2;
const R = (d) => d * Math.PI / 180;
const rot = (x, y, a) => { const r = R(a), c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; };
const dirv = (a) => [Math.sin(R(a)), Math.cos(R(a))];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const HEADS = 7.65;
export const SDEF = { hs: 0, pt: 0, tl: 0, st: 0, ht: 0, hx: 0, aL: [-9, -6], aR: [9, 6], lL: [-4, -2], lR: [4, 2], hL: 'open', hR: 'open', fL: 'flat', fR: 'flat', face: 0, sx: 1, y: 0, inv: 0 };

// the skeleton in head units (s = 1), pelvis at the origin, y down
export function skeleton(o) {
  const p = { ...SDEF, ...o };
  const P = [p.hs, 0], hw = 0.46, sw = 0.62;
  const hipL = add(P, rot(-hw, 0, p.pt)), hipR = add(P, rot(hw, 0, p.pt));
  const SC = add(P, rot(0, -2.15, p.tl));
  const shL = add(SC, rot(-sw, 0.1, p.tl + p.st)), shR = add(SC, rot(sw, 0.1, p.tl + p.st));
  const neck = add(SC, rot(0, -0.1, p.tl)), headC = add(neck, rot(p.hx, -0.78, p.tl + p.ht));
  const limb = (a, b, l) => add(a, [dirv(b)[0] * l, dirv(b)[1] * l]);
  const kL = limb(hipL, p.lL[0], 1.85), anL = limb(kL, p.lL[1], 1.7), kR = limb(hipR, p.lR[0], 1.85), anR = limb(kR, p.lR[1], 1.7);
  const eL = limb(shL, p.aL[0], 1.2), wL = limb(eL, p.aL[1], 1.1), eR = limb(shR, p.aR[0], 1.2), wR = limb(eR, p.aR[1], 1.1);
  return { p, P, hipL, hipR, SC, shL, shR, neck, headC, kL, anL, kR, anR, eL, wL, eR, wR };
}
// pixels: the transform that puts the lower foot on the floor at fx, fh pixels tall
export function placement(K, fx, floor, fh) {
  const s = fh / HEADS, low = Math.max(K.anL[1], K.anR[1]) + 0.16;
  const oy = floor - low * s - K.p.y * fh;
  const map = (q) => [fx + (q[0] - K.P[0] * 0) * s * K.p.sx, oy + q[1] * s];
  return { s, oy, map };
}
// where the hands and joints land in pixels (for the BANG! and the puppet rivets)
export function rigPoints(o, fx, floor, fh) {
  const K = skeleton(o), { map } = placement(K, fx, floor, fh);
  const out = {}; for (const k of ['P', 'SC', 'shL', 'shR', 'neck', 'headC', 'kL', 'kR', 'anL', 'anR', 'eL', 'eR', 'wL', 'wR']) out[k] = map(K[k]);
  return out;
}

function chain(g, pts, w, col, ink, lw) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); };
  if (lw > 0) { path(); g.strokeStyle = ink; g.lineWidth = w + 2 * lw; g.stroke(); }
  path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
}
function poly(g, pts, fill, ink, lw) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); g.closePath();
  g.fillStyle = fill; g.fill(); if (lw > 0) { g.strokeStyle = ink; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
}
// hands: drawn along the forearm's direction a (degrees), in head units
function hand(g, w, a, type, sk, ink, lw) {
  const d = dirv(a), th = Math.atan2(d[1], d[0]);
  g.save(); g.translate(w[0], w[1]); g.rotate(th); g.lineCap = 'round';
  const cap = (x1, y1, x2, y2, wd) => { if (lw > 0) { g.strokeStyle = ink; g.lineWidth = wd + 2 * lw; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); } g.strokeStyle = sk; g.lineWidth = wd; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const palm = (r, cx) => { g.beginPath(); g.arc(cx, 0, r, 0, TAU); g.fillStyle = sk; g.fill(); if (lw > 0) { g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); } };
  const fingers = (spread, len) => { for (let i = 0; i < 4; i++) { const y = (i - 1.5) * spread; cap(0.2, y * 0.6, 0.2 + len, y, 0.09); } };
  switch (type) {
    case 'fist': palm(0.18, 0.16); break;
    case 'flat': g.beginPath(); g.roundRect(0, -0.11, 0.5, 0.22, 0.1); g.fillStyle = sk; g.fill(); if (lw > 0) { g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); } break;
    case 'point': fingers(0.05, 0.0); palm(0.16, 0.15); cap(0.25, -0.05, 0.6, -0.08, 0.1); cap(0.18, -0.16, 0.3, -0.3, 0.09); break;   // a finger gun: index out, thumb up
    case 'snap': palm(0.16, 0.15); cap(0.25, -0.08, 0.4, -0.02, 0.09); cap(0.22, 0.12, 0.4, 0, 0.09); break;
    case 'flick': fingers(0.14, 0.28); palm(0.16, 0.14); cap(0.15, 0.14, 0.3, 0.3, 0.09); break;
    default: fingers(0.085, 0.22); palm(0.16, 0.14); cap(0.12, 0.12, 0.26, 0.26, 0.09);
  }
  g.restore();
}
// a shoe seen from the front, toe turned out, tipped by its contact state
function shoe(g, an, state, side, O, ink, lw) {
  let ang = side === 'L' ? 158 : 22; const sgn = Math.cos(R(ang)) >= 0 ? 1 : -1;
  ang += ({ flat: 0, heelup: 35, ball: 18, toe: 75, edge: 0 }[state] || 0) * sgn;
  const Ls = 0.52, T = 0.26, heel = add(an, [-0.12 * Math.cos(R(ang)), 0.08]), sy = state === 'edge' ? 0.6 : 1;
  g.save(); g.translate(heel[0], heel[1]); g.rotate(R(ang)); g.scale(1, sy);
  g.beginPath(); g.roundRect(-0.08, -T * 0.55, Ls, T, T * 0.45); g.fillStyle = O.shoes; g.fill(); if (lw > 0) { g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); }
  if (!O.mono) { g.strokeStyle = O.sole; g.lineCap = 'round'; g.lineWidth = T * 0.28; g.beginPath(); g.moveTo(-0.06, T * 0.25); g.lineTo(Ls - 0.12, T * 0.25); g.stroke(); }
  g.restore();
}

// Draws him. o: SPARK pose; O: an outfit from prabhu-char.js OUTFITS (or mono()); hat: headwear name
export function drawRig(g, o, O, fx, floor, fh, opts = {}) {
  const K = skeleton(o), p = K.p, { s, oy } = placement(K, fx, floor, fh);
  const inv = p.inv > 0.5, mono = !!O.mono;
  const ink = mono ? O.line : (O.line || '#1a1714'), lw = mono ? 0 : Math.max(1.1, 0.055 * s * (opts.line ?? 1)) / s;
  const skin = inv ? 'rgba(0,0,0,0)' : O.skin, jac = O.shirt, jac2 = O.shirtShade || O.shirt, tee = O.open ? (O.tee || O.skin) : O.skin;
  g.save(); g.translate(fx, oy); g.scale(s * p.sx, s);
  const { P, hipL, hipR, SC, shL, shR, neck, headC, kL, anL, kR, anR, eL, wL, eR, wR } = K;
  // pelvis, legs, shoes
  const pv = [[-0.54, -0.3], [0.54, -0.3], [0.5, 0.45], [-0.5, 0.45]].map((q) => add(P, rot(q[0], q[1], p.pt)));
  poly(g, pv, O.pants, ink, lw);
  chain(g, [hipL, kL, anL], 0.4, O.pants, ink, lw); chain(g, [hipR, kR, anR], 0.4, O.pants, ink, lw);
  if (!mono) { g.strokeStyle = O.pantsShade || O.pants; g.lineWidth = 0.05; for (const [a, b, c] of [[hipL, kL, anL], [hipR, kR, anR]]) { g.beginPath(); g.moveTo(lerp2(a, b, 0.35)[0], lerp2(a, b, 0.35)[1]); g.lineTo(b[0], b[1]); g.lineTo(lerp2(b, c, 0.6)[0], lerp2(b, c, 0.6)[1]); g.stroke(); } }
  shoe(g, anL, p.fL, 'L', O, ink, lw); shoe(g, anR, p.fR, 'R', O, ink, lw);
  // torso (the shirt), shoulders, neck, the open collar
  const tq = [add(shL, rot(0, -0.02, p.tl)), add(shR, rot(0, -0.02, p.tl)), add(hipR, rot(0.1, 0.28, p.pt)), add(hipL, rot(-0.1, 0.28, p.pt))];
  poly(g, tq, jac, ink, lw);
  if (!mono && O.shirt2) { g.save(); g.beginPath(); g.moveTo(tq[0][0], tq[0][1]); for (const q of tq.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.clip(); g.fillStyle = O.shirt2; for (let i = -6; i < 7; i++) for (let j = 0; j < 12; j++) { const c0 = add(P, rot(i * 0.22, -j * 0.22 - ((i & 1) ? 0.11 : 0), p.tl)); g.beginPath(); g.arc(c0[0], c0[1], 0.05, 0, TAU); g.fill(); } g.restore(); }
  for (const q of [shL, shR]) { g.beginPath(); g.arc(q[0], q[1], 0.27, 0, TAU); g.fillStyle = jac; g.fill(); if (lw > 0) { g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); } }
  if (!inv) { const nTop = add(neck, rot(0, -0.4, p.tl + p.ht * 0.5)); chain(g, [neck, nTop], 0.3, skin, ink, lw); }
  if (!mono) {
    const v0 = add(neck, rot(-0.3, 0.14, p.tl)), v1 = add(neck, rot(0.3, 0.14, p.tl)), v2 = add(neck, rot(0, 0.95, p.tl));
    poly(g, [v0, v1, v2], inv && !O.open ? jac : tee, ink, lw);
    g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(v2[0], v2[1]); const bt = add(P, rot(0, 0.15, p.tl)); g.lineTo(bt[0], bt[1]); g.stroke();
    g.strokeStyle = jac2; g.lineWidth = lw * 1.6 + 0.04; g.beginPath(); const h0 = add(P, rot(-0.48, 0.15, p.pt)), h1 = add(P, rot(0.48, 0.15, p.pt)); g.moveTo(h0[0], h0[1]); g.lineTo(h1[0], h1[1]); g.stroke();
  }
  // arms: sleeve to the wrist (long) or to the elbow (short), then the hand
  for (const [sh, el, wr, hs, a] of [[shL, eL, wL, p.hL, p.aL[1]], [shR, eR, wR, p.hR, p.aR[1]]]) {
    if (O.sleeve === 'short') { chain(g, [sh, el], 0.38, jac, ink, lw); chain(g, [el, wr], 0.3, skin, inv ? 'rgba(0,0,0,0)' : ink, inv ? 0 : lw); chain(g, [sh, lerp2(sh, el, 0.85)], 0.4, jac, ink, 0); }
    else { chain(g, [sh, el, wr], 0.36, jac, ink, lw); if (!mono) { g.strokeStyle = jac2; g.lineWidth = 0.38; g.beginPath(); const c0 = lerp2(el, wr, 0.88); g.moveTo(c0[0], c0[1]); g.lineTo(wr[0], wr[1]); g.stroke(); } }
    if (!inv) hand(g, wr, a, hs, skin, ink, lw);
  }
  // the head: his, scaled so the face is a SPARK head tall
  const k = (1.08 * 1.14) / (2 * CL.head);
  g.save(); g.translate(headC[0], headC[1]); g.scale(k, k);
  const HO = inv ? { ...O, skin: 'rgba(0,0,0,0)', skinShade: 'rgba(0,0,0,0)', hair: 'rgba(0,0,0,0)', line: 'rgba(0,0,0,0)' } : O;
  drawHead(g, [0, 0], R(p.tl + p.ht) * 1, HO, inv ? -1 : (opts.face ?? p.face), opts.hat ?? O.hat, R(p.hat || 0), inv || lw <= 0 ? 0 : (lw / k) * 0.8, inv || lw <= 0 ? null : ink);
  g.restore();
  g.restore();
  return K;
}
function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

// ---- our moves (radians, relative second angles) -> SPARK params ---------------------------------------------------
const D = (r) => r * 180 / Math.PI;
const footState = (fa) => { const m = Math.abs(fa); return m > 1.22 ? 'flat' : m > 0.95 ? 'ball' : m > 0.6 ? 'heelup' : 'toe'; };
export function toSpark(q) {
  const lean = q.lean || 0;
  const two = (A) => [D(A[0]), D(A[0] + A[1])];
  return { hs: (q.x || 0) * HEADS, pt: -D(lean) * 0.5, tl: D(lean), st: D(Math.atan2(((q.shL || 0) - (q.shR || 0)) * HEADS, 1.24)),
    ht: D((q.head || 0) * 0.5 - lean * 0.4), hx: (q.headX || 0) * HEADS, aL: two(q.la), aR: two(q.ra), lL: two(q.ll), lR: two(q.rl),
    hL: q.hL || 'open', hR: q.hR || 'open', fL: footState(q.lf ?? -1.35), fR: footState(q.rf ?? 1.35), face: q.face || 0, sx: q.sx ?? 1, y: q.y || 0, inv: q.inv || 0, hat: D(q.hat || 0) };
}
const lerpA = (a, b, u) => { const d = ((b - a + 540) % 360) - 180; return a + d * u; };
export function blendSpark(a, b, u) {
  const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? SDEF[k], y = b[k] ?? SDEF[k];
    o[k] = Array.isArray(x) ? [lerpA(x[0], y[0], u), lerpA(x[1], y[1], u)] : typeof x === 'number' ? x + (y - x) * u : (u < 0.5 ? x : y);
  }
  return o;
}
// sample a captured clip at t (seconds, clip time)
export function sampleClip(frames, t) {
  if (t <= frames[0].t) return frames[0]; if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];
  let i = 0; while (frames[i + 1].t < t) i++;
  const a = frames[i], b = frames[i + 1], u = (t - a.t) / (b.t - a.t), o = { fL: u < 0.5 ? a.fL : b.fL, fR: u < 0.5 ? a.fR : b.fR };
  for (const k of ['tl', 'st', 'pt', 'ht', 'hx']) o[k] = a[k] + (b[k] - a[k]) * u;
  for (const k of ['aL', 'aR', 'lL', 'lR']) o[k] = [lerpA(a[k][0], b[k][0], u), lerpA(a[k][1], b[k][1], u)];
  return o;
}
