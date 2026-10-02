// The Prabhu Deva character: one model, used by every panel of src/prabhu.js and by the character sheet
// (src/prabhusheet.js). A cartoon tribute, not a likeness study: tall and lanky (eight heads), long rubbery
// limbs, a long face with a strong nose, thick brows, a thin moustache, the big toothy grin, and a tall wave of
// black 90s hair. Front view, 2D; the pose format (angles from straight down, + toward screen right) is shared
// with the dance moves.
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// lengths in units of his height; the pelvis is the origin, y down
export const L = { thigh: 0.255, shin: 0.245, foot: 0.032, torso: 0.295, neck: 0.026, head: 0.064, sh: 0.098, hip: 0.05, ua: 0.172, fa: 0.152, hand: 0.05 };
export const BASE = { x: 0, y: 0, lean: 0, head: 0, headX: 0, sx: 1, hat: 0, inv: 0, shL: 0, shR: 0, la: [-0.18, -0.1], ra: [0.18, 0.1], ll: [-0.05, 0], rl: [0.05, 0], lf: -1.35, rf: 1.35, face: 0 };
export const P = (o) => ({ ...BASE, ...o, la: o.la || BASE.la, ra: o.ra || BASE.ra, ll: o.ll || BASE.ll, rl: o.rl || BASE.rl });
const dir = (a) => [Math.sin(a), Math.cos(a)];

export function joints(p) {
  const td = [Math.sin(p.lean), -Math.cos(p.lean)], perp = [Math.cos(p.lean), Math.sin(p.lean)];
  const pel = [p.x, 0];
  const neck = [pel[0] + td[0] * L.torso, pel[1] + td[1] * L.torso];
  const shC = [pel[0] + td[0] * (L.torso - 0.03), pel[1] + td[1] * (L.torso - 0.03)];
  const head = [neck[0] + td[0] * (L.neck + L.head) + p.headX, neck[1] + td[1] * (L.neck + L.head)];
  const side = (s, A, legs) => {
    const lift = legs ? 0 : (s < 0 ? p.shL : p.shR);
    const root = legs ? [pel[0] + perp[0] * L.hip * s, pel[1] + perp[1] * L.hip * s] : [shC[0] + perp[0] * L.sh * s, shC[1] + perp[1] * L.sh * s - lift];
    const [l1, l2] = legs ? [L.thigh, L.shin] : [L.ua, L.fa];
    const d1 = dir(A[0]), mid = [root[0] + d1[0] * l1, root[1] + d1[1] * l1], d2 = dir(A[0] + A[1]), end = [mid[0] + d2[0] * l2, mid[1] + d2[1] * l2];
    return [root, mid, end, A[0] + A[1]];
  };
  return { pel, neck, head, shC, perp, td, la: side(-1, p.la, false), ra: side(1, p.ra, false), ll: side(-1, p.ll, true), rl: side(1, p.rl, true) };
}
// where the feet land: the pelvis height that puts the lower foot on the floor
export const footDrop = (J) => Math.max(J.ll[2][1], J.rl[2][1]) + L.foot;

// ---- outfits ----------------------------------------------------------------------------------------------------
export const OUTFITS = {
  // the 1994 film look: loose white shirt with the sleeves full, black baggy trousers, white high-tops, red cap
  film94: { name: '1994 film look', skin: '#8f5b3a', skinShade: '#6e4228', hair: '#120c09', shirt: '#f6f2ea', shirtShade: '#d8d0c2', shirt2: null, pants: '#17171d', pantsShade: '#2c2c36', shoes: '#f4f4f4', sole: '#c9c9c9', hat: 'cap', hatCol: '#d1252c', sleeve: 'long', open: true, tee: null, line: '#1a0f0a' },
  // the bus-top look: an oversized printed shirt, blue jeans, a bandana
  bus94: { name: 'printed shirt', skin: '#8f5b3a', skinShade: '#6e4228', hair: '#120c09', shirt: '#2c6fd6', shirtShade: '#1f53a6', shirt2: '#ffd23a', pants: '#3b5f9a', pantsShade: '#2a4472', shoes: '#f4f4f4', sole: '#c9c9c9', hat: 'bandana', hatCol: '#e2282f', sleeve: 'short', open: false, tee: null, line: '#1a0f0a' },
  // today: black tee, cap backwards, white sneakers
  now: { name: 'today', skin: '#8f5b3a', skinShade: '#6e4228', hair: '#120c09', shirt: '#151517', shirtShade: '#0a0a0b', shirt2: null, pants: '#1f1f24', pantsShade: '#111114', shoes: '#f4f4f4', sole: '#c9c9c9', hat: 'capBack', hatCol: '#f1f1f1', sleeve: 'short', open: false, tee: null, line: '#0a0a0a' },
};
// a palette with every part the same colour (silhouettes, carved relief, outlines)
export const mono = (c) => ({ skin: c, skinShade: c, hair: c, shirt: c, shirtShade: c, shirt2: null, pants: c, pantsShade: c, shoes: c, sole: c, hatCol: c, tee: c, line: c, sleeve: 'long', open: false, mono: true });
// an outfit recoloured by a panel (keeps the cut, swaps the colours)
export const recolour = (o, cols) => ({ ...o, ...cols });

// ---- drawing ------------------------------------------------------------------------------------------------------
// a limb segment: the hull of two circles (radius ra at a, rb at b)
function capsule(g, a, b, ra, rb) {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(th), ny = Math.cos(th);
  g.beginPath(); g.moveTo(a[0] + nx * ra, a[1] + ny * ra); g.lineTo(b[0] + nx * rb, b[1] + ny * rb);
  g.arc(b[0], b[1], rb, th + Math.PI / 2, th - Math.PI / 2, true);
  g.lineTo(a[0] - nx * ra, a[1] - ny * ra); g.arc(a[0], a[1], ra, th - Math.PI / 2, th - 3 * Math.PI / 2, true); g.closePath();
}
const fillPath = (g, col, stroke, w) => { g.fillStyle = col; g.fill(); if (stroke && w > 0) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); } };

// Draws him with the feet on (fx, floor), fh pixels tall. o: an outfit (or mono). opts: { face, hat, line }
export function drawPrabhu(g, p, o, fx, floor, fh, opts = {}) {
  let O = o;
  const inv = p.inv > 0.5;
  if (inv) O = { ...o, skin: 'rgba(0,0,0,0)', skinShade: 'rgba(0,0,0,0)', hair: 'rgba(0,0,0,0)' };
  const J = joints(p), py = floor - footDrop(J) * fh - p.y * fh;
  const LW = opts.line === false || O.mono ? 0 : (opts.lineW ?? 0.0055);
  const ln = LW ? O.line : null;
  g.save(); g.translate(fx, py); g.scale(fh * p.sx, fh); g.lineJoin = 'round'; g.lineCap = 'round';
  const { perp, td, pel } = J, sh = J.shC;
  const pt = (o0, a, b) => [o0[0] + perp[0] * a + td[0] * b, o0[1] + perp[1] * a + td[1] * b];

  // legs: baggy trousers flaring a little at the knee, chunky high-tops
  for (const [leg, fa] of [[J.ll, p.lf], [J.rl, p.rf]]) {
    capsule(g, leg[0], leg[1], 0.05, 0.044); fillPath(g, O.pants, ln, LW);
    capsule(g, leg[1], leg[2], 0.044, 0.043); fillPath(g, O.pants, ln, LW);
    if (!O.mono) { g.strokeStyle = O.pantsShade; g.lineWidth = 0.006; g.beginPath(); g.moveTo(...lerp2(leg[0], leg[1], 0.3)); g.lineTo(...lerp2(leg[1], leg[2], 0.6)); g.stroke(); }
    // the shoe: a rounded high-top pointing along the foot angle, with a sole stripe
    const sl = Math.sign(fa || 1), tilt = (Math.abs(fa) - 1.35) * 0.9 * sl;
    g.save(); g.translate(leg[2][0], leg[2][1] + 0.012); g.rotate(-tilt);
    g.beginPath(); g.moveTo(-0.028 * sl, -0.03); g.quadraticCurveTo(-0.036 * sl, 0.022, -0.016 * sl, 0.024); g.lineTo(0.046 * sl, 0.024); g.quadraticCurveTo(0.064 * sl, 0.02, 0.054 * sl, 0.002); g.quadraticCurveTo(0.03 * sl, -0.01, 0.02 * sl, -0.03); g.closePath(); fillPath(g, O.shoes, ln, LW);
    if (!O.mono) { g.fillStyle = O.sole; g.beginPath(); g.moveTo(-0.03 * sl, 0.014); g.lineTo(0.06 * sl, 0.014); g.lineTo(0.058 * sl, 0.022); g.lineTo(-0.02 * sl, 0.024); g.closePath(); g.fill(); g.strokeStyle = O.sole; g.lineWidth = 0.003; g.beginPath(); g.moveTo(0.0, -0.01); g.lineTo(0.02 * sl, 0.004); g.stroke(); }
    g.restore();
  }
  // torso: a loose shirt from shoulder to hip, a little wider at the hem, with the collar open
  const hem = [pt(pel, -0.088, -0.035), pt(pel, 0.088, -0.035)];
  g.beginPath(); const S0 = pt(sh, -L.sh - 0.028, 0.012), S1 = pt(sh, L.sh + 0.028, 0.012);
  const sL = [S0[0], S0[1] - p.shL * 0.6], sR = [S1[0], S1[1] - p.shR * 0.6];
  g.moveTo(...sL); g.quadraticCurveTo(...pt(sh, 0, 0.03), ...sR); g.quadraticCurveTo(...pt(sh, L.sh + 0.02, -0.12), hem[1][0], hem[1][1]);
  g.lineTo(...pt(pel, 0.06, -0.055)); g.lineTo(...pt(pel, -0.06, -0.055)); g.lineTo(...hem[0]); g.quadraticCurveTo(...pt(sh, -L.sh - 0.02, -0.12), ...sL); g.closePath();
  fillPath(g, O.shirt, ln, LW);
  if (!O.mono) {
    if (O.shirt2) { g.save(); g.clip(); g.fillStyle = O.shirt2; for (let i = -6; i < 7; i++) for (let j = 0; j < 8; j++) { const c0 = pt(sh, i * 0.03, -j * 0.04 - ((i & 1) ? 0.02 : 0)); g.beginPath(); g.arc(c0[0], c0[1], 0.007, 0, TAU); g.fill(); } g.restore(); }
    if (O.open) { g.beginPath(); g.moveTo(...pt(sh, -0.035, 0.03)); g.lineTo(...pt(sh, 0, -0.07)); g.lineTo(...pt(sh, 0.035, 0.03)); g.closePath(); g.fillStyle = O.tee || O.skin; g.fill();
      g.strokeStyle = O.shirtShade; g.lineWidth = 0.005; g.beginPath(); g.moveTo(...pt(sh, 0, -0.07)); g.lineTo(...pt(pel, 0.005, -0.04)); g.stroke(); }
    else { g.beginPath(); g.moveTo(...pt(sh, -0.03, 0.03)); g.quadraticCurveTo(...pt(sh, 0, -0.025), ...pt(sh, 0.03, 0.03)); g.closePath(); g.fillStyle = O.skin; g.fill(); }
    g.strokeStyle = O.shirtShade; g.lineWidth = 0.004; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...pt(sh, 0.06 * s, -0.04)); g.quadraticCurveTo(...pt(sh, 0.075 * s, -0.14), ...pt(pel, 0.07 * s, -0.04)); g.stroke(); }
  }
  // belt line
  if (!O.mono) { g.beginPath(); g.moveTo(...pt(pel, -0.07, -0.035)); g.lineTo(...pt(pel, 0.07, -0.035)); g.strokeStyle = O.pantsShade; g.lineWidth = 0.008; g.stroke(); }
  // arms: sleeve, forearm (skin or sleeve), a hand with the fingers together and a thumb
  for (const [arm, s] of [[J.la, -1], [J.ra, 1]]) {
    capsule(g, arm[0], arm[1], 0.036, 0.03); fillPath(g, O.shirt, ln, LW);
    const longS = O.sleeve === 'long';
    capsule(g, arm[1], arm[2], longS ? 0.03 : 0.024, longS ? 0.027 : 0.021); fillPath(g, longS ? O.shirt : O.skin, ln, LW);
    if (!longS && !O.mono) { capsule(g, arm[1], lerp2(arm[1], arm[2], 0.12), 0.031, 0.029); fillPath(g, O.shirt, null, 0); }
    if (longS && !O.mono) { capsule(g, lerp2(arm[1], arm[2], 0.88), arm[2], 0.03, 0.028); fillPath(g, O.shirtShade, null, 0); }
    // hand
    const a = arm[3]; g.save(); g.translate(arm[2][0], arm[2][1]); g.rotate(-a);
    g.beginPath(); g.ellipse(0, 0.026, 0.02, 0.03, 0, 0, TAU); fillPath(g, O.skin, ln, LW);
    g.beginPath(); g.ellipse(0.017 * s, 0.012, 0.007, 0.016, -0.5 * s, 0, TAU); fillPath(g, O.skin, ln, LW * 0.8);
    g.restore();
  }
  // neck
  capsule(g, J.neck, [J.neck[0] + td[0] * 0.04 + p.headX * 0.5, J.neck[1] + td[1] * 0.04], 0.021, 0.021); fillPath(g, O.skinShade, null, 0);
  // head
  drawHead(g, J.head, p.lean * 0.6 + p.head * 0.5, O, opts.face ?? p.face, opts.hat ?? O.hat, p.hat, LW, ln);
  g.restore();
  return { J, py };
}
function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

// The head: long face tapering to the chin, ears, a tall wave of hair, brows, eyes, nose, moustache, grin.
// face: 0 grin, 1 focus (mouth closed), 2 wink, 3 'oh'
export function drawHead(g, hd, rot, O, face, hat, hatTilt, LW, ln) {
  const H = L.head, Wd = H * 0.74;
  g.save(); g.translate(hd[0], hd[1]); g.rotate(rot);
  // ears
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(Wd * 0.98 * s, -0.004, 0.012, 0.02, 0, 0, TAU); fillPath(g, O.skin, ln, LW); }
  // face shape
  g.beginPath(); g.moveTo(-Wd, -H * 0.25); g.bezierCurveTo(-Wd, -H * 1.05, Wd, -H * 1.05, Wd, -H * 0.25);
  g.bezierCurveTo(Wd * 1.0, H * 0.45, Wd * 0.45, H * 0.98, 0, H * 1.0); g.bezierCurveTo(-Wd * 0.45, H * 0.98, -Wd * 1.0, H * 0.45, -Wd, -H * 0.25); g.closePath();
  fillPath(g, O.skin, ln, LW);
  if (!O.mono) { g.save(); g.clip(); g.fillStyle = O.skinShade; g.globalAlpha = 0.22; g.beginPath(); g.ellipse(Wd * 0.75, H * 0.25, Wd * 0.55, H * 0.85, 0, 0, TAU); g.fill(); g.restore(); }
  // hair: a tall, wavy 90s wave with a side part and a curl falling on the forehead
  if (hat !== 'bandana') {
    g.beginPath(); g.moveTo(-Wd * 1.04, -H * 0.12);
    g.bezierCurveTo(-Wd * 1.35, -H * 1.1, -Wd * 0.6, -H * 1.75, Wd * 0.15, -H * 1.6);
    g.bezierCurveTo(Wd * 0.95, -H * 1.62, Wd * 1.4, -H * 1.0, Wd * 1.06, -H * 0.12);
    g.lineTo(Wd * 0.92, -H * 0.4); g.bezierCurveTo(Wd * 0.7, -H * 0.62, Wd * 0.2, -H * 0.55, -Wd * 0.05, -H * 0.72);
    g.bezierCurveTo(-Wd * 0.3, -H * 0.48, -Wd * 0.75, -H * 0.62, -Wd * 0.92, -H * 0.4); g.closePath();
    fillPath(g, O.hair, ln, LW);
    g.beginPath(); g.moveTo(-Wd * 0.05, -H * 0.72); g.bezierCurveTo(-Wd * 0.25, -H * 0.5, -Wd * 0.05, -H * 0.32, Wd * 0.12, -H * 0.42); g.bezierCurveTo(-Wd * 0.02, -H * 0.45, -Wd * 0.1, -H * 0.6, Wd * 0.05, -H * 0.7); g.closePath(); fillPath(g, O.hair, null, 0);
    if (!O.mono) { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.004; for (const k of [0.2, 0.5, 0.8]) { g.beginPath(); g.moveTo(-Wd * 0.8 + k * Wd, -H * 1.1); g.quadraticCurveTo(-Wd * 0.4 + k * Wd * 1.2, -H * 1.4, Wd * 0.2 + k * Wd, -H * 1.0); g.stroke(); } }
    // sideburns
    g.fillStyle = O.hair; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(Wd * 0.98 * s, -H * 0.35); g.lineTo(Wd * 0.86 * s, -H * 0.35); g.lineTo(Wd * 0.9 * s, H * 0.05); g.lineTo(Wd * 0.99 * s, H * 0.02); g.fill(); }
  }
  if (!O.mono && face !== -1) {
    const dark = '#140c08';
    // brows
    g.fillStyle = dark; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(Wd * 0.12 * s, -H * 0.3); g.quadraticCurveTo(Wd * 0.45 * s, -H * 0.48, Wd * 0.78 * s, -H * 0.32); g.lineTo(Wd * 0.76 * s, -H * 0.24); g.quadraticCurveTo(Wd * 0.45 * s, -H * 0.36, Wd * 0.14 * s, -H * 0.22); g.fill(); }
    // eyes
    for (const s of [-1, 1]) {
      if (face === 2 && s === 1) { g.strokeStyle = dark; g.lineWidth = 0.007; g.beginPath(); g.moveTo(Wd * 0.22, -H * 0.1); g.quadraticCurveTo(Wd * 0.45, -H * 0.2, Wd * 0.68, -H * 0.1); g.stroke(); continue; }
      g.beginPath(); g.ellipse(Wd * 0.45 * s, -H * 0.1, Wd * 0.24, H * 0.13, 0, 0, TAU); g.fillStyle = '#fbf6ee'; g.fill(); g.strokeStyle = dark; g.lineWidth = 0.004; g.stroke();
      g.beginPath(); g.arc(Wd * 0.45 * s + 0.003, -H * 0.09, H * 0.085, 0, TAU); g.fillStyle = '#2a170c'; g.fill();
      g.beginPath(); g.arc(Wd * 0.45 * s + 0.003, -H * 0.09, H * 0.045, 0, TAU); g.fillStyle = dark; g.fill();
      g.beginPath(); g.arc(Wd * 0.45 * s + 0.008, -H * 0.12, H * 0.022, 0, TAU); g.fillStyle = '#fff'; g.fill();
    }
    // nose: long and straight, a shadow down one side and the nostrils
    g.strokeStyle = O.skinShade; g.lineWidth = 0.006; g.beginPath(); g.moveTo(Wd * 0.06, -H * 0.12); g.quadraticCurveTo(Wd * 0.16, H * 0.2, Wd * 0.1, H * 0.32); g.stroke();
    g.fillStyle = O.skinShade; g.beginPath(); g.ellipse(-Wd * 0.12, H * 0.34, Wd * 0.08, H * 0.04, 0, 0, TAU); g.ellipse(Wd * 0.12, H * 0.34, Wd * 0.08, H * 0.04, 0, 0, TAU); g.fill();
    // moustache: thin
    g.fillStyle = dark; g.beginPath(); g.moveTo(-Wd * 0.4, H * 0.5); g.quadraticCurveTo(0, H * 0.36, Wd * 0.4, H * 0.5); g.quadraticCurveTo(0, H * 0.44, -Wd * 0.4, H * 0.5); g.fill();
    // mouth
    if (face === 1) { g.strokeStyle = dark; g.lineWidth = 0.006; g.beginPath(); g.moveTo(-Wd * 0.3, H * 0.62); g.quadraticCurveTo(0, H * 0.68, Wd * 0.3, H * 0.62); g.stroke(); }
    else if (face === 3) { g.beginPath(); g.ellipse(0, H * 0.66, Wd * 0.14, H * 0.12, 0, 0, TAU); g.fillStyle = '#4a1410'; g.fill(); }
    else { g.beginPath(); g.moveTo(-Wd * 0.52, H * 0.55); g.quadraticCurveTo(0, H * 0.62, Wd * 0.52, H * 0.55); g.quadraticCurveTo(Wd * 0.3, H * 0.9, 0, H * 0.9); g.quadraticCurveTo(-Wd * 0.3, H * 0.9, -Wd * 0.52, H * 0.55); g.closePath(); g.fillStyle = '#4a1410'; g.fill();
      g.save(); g.clip(); g.fillStyle = '#fbf8f2'; g.fillRect(-Wd * 0.55, H * 0.55, Wd * 1.1, H * 0.14); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.002; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * Wd * 0.18, H * 0.56); g.lineTo(k * Wd * 0.18, H * 0.68); g.stroke(); } g.restore();
      g.strokeStyle = dark; g.lineWidth = 0.004; g.beginPath(); g.moveTo(-Wd * 0.52, H * 0.55); g.quadraticCurveTo(0, H * 0.62, Wd * 0.52, H * 0.55); g.quadraticCurveTo(Wd * 0.3, H * 0.9, 0, H * 0.9); g.quadraticCurveTo(-Wd * 0.3, H * 0.9, -Wd * 0.52, H * 0.55); g.stroke(); }
  }
  // headwear
  g.rotate(hatTilt || 0);
  if (hat === 'cap' || hat === 'capBack') {
    g.beginPath(); g.moveTo(-Wd * 1.08, -H * 0.42); g.bezierCurveTo(-Wd * 1.1, -H * 1.45, Wd * 1.1, -H * 1.45, Wd * 1.08, -H * 0.42); g.closePath(); fillPath(g, O.hatCol, ln, LW);
    if (hat === 'cap') { g.beginPath(); g.moveTo(-Wd * 1.12, -H * 0.42); g.quadraticCurveTo(0, -H * 0.62, Wd * 1.25, -H * 0.38); g.quadraticCurveTo(Wd * 0.6, -H * 0.2, -Wd * 1.12, -H * 0.42); fillPath(g, O.hatCol, ln, LW); }
    else { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, -H * 0.5, Wd * 0.3, H * 0.08, 0, 0, TAU); g.fill(); }
    if (!O.mono) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(0, -H * 1.2, 0.006, 0, TAU); g.fill(); }
  } else if (hat === 'bandana') {
    g.beginPath(); g.moveTo(-Wd * 1.06, -H * 0.3); g.bezierCurveTo(-Wd * 1.15, -H * 1.35, Wd * 1.15, -H * 1.35, Wd * 1.06, -H * 0.3); g.quadraticCurveTo(0, -H * 0.55, -Wd * 1.06, -H * 0.3); fillPath(g, O.hatCol, ln, LW);
    if (!O.mono) { g.fillStyle = '#fff'; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(-Wd * 0.7 + k * Wd * 0.23, -H * 0.75 - Math.sin(k) * H * 0.1, 0.004, 0, TAU); g.fill(); } }
    g.beginPath(); g.moveTo(Wd * 0.95, -H * 0.45); g.lineTo(Wd * 1.5, -H * 0.2); g.lineTo(Wd * 1.25, -H * 0.05); g.closePath(); fillPath(g, O.hatCol, ln, LW);
  } else if (hat === 'fedora') {
    g.beginPath(); g.moveTo(-Wd * 0.95, -H * 0.55); g.lineTo(-Wd * 0.8, -H * 1.6); g.quadraticCurveTo(0, -H * 1.4, Wd * 0.8, -H * 1.6); g.lineTo(Wd * 0.95, -H * 0.55); g.closePath(); fillPath(g, O.hatCol, ln, LW);
    g.beginPath(); g.ellipse(0, -H * 0.55, Wd * 1.9, H * 0.16, 0, 0, TAU); fillPath(g, O.hatCol, ln, LW);
    if (!O.mono) { g.fillStyle = O.band || '#f3efe6'; g.fillRect(-Wd * 0.93, -H * 0.82, Wd * 1.86, H * 0.18); }
  } else if (hat === 'turban') {
    g.beginPath(); g.moveTo(-Wd * 1.1, -H * 0.35); g.bezierCurveTo(-Wd * 1.3, -H * 1.6, Wd * 1.3, -H * 1.6, Wd * 1.1, -H * 0.35); g.quadraticCurveTo(0, -H * 0.6, -Wd * 1.1, -H * 0.35); fillPath(g, O.hatCol, ln, LW);
    if (!O.mono) { g.strokeStyle = O.band || '#c9a227'; g.lineWidth = 0.006; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-Wd * 1.05, -H * (0.5 + i * 0.22)); g.quadraticCurveTo(0, -H * (0.85 + i * 0.22), Wd * 1.05, -H * (0.42 + i * 0.25)); g.stroke(); } g.fillStyle = O.band || '#c9a227'; g.beginPath(); g.arc(0, -H * 1.0, 0.009, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 0.008; g.beginPath(); g.moveTo(0, -H * 1.1); g.quadraticCurveTo(Wd * 0.5, -H * 1.9, Wd * 1.1, -H * 1.7); g.stroke(); }
  }
  g.restore();
}
