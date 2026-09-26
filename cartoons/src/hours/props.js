// Hand-drawn props for "Before the Alarm". Every function draws with the sketch primitives and
// takes o = { prog (draw-on 0..1), a (alpha), seed }. Sizes are in scene pixels.
import { TAU, clamp, lerp } from '../rich/core.js';
import { g, INK, SOFT, GREY, OCHRE, PAPER, stroke, line, circle, circPts, arcPts, poly, smooth, fill, wash, hatch, glow, hn } from './sketch.js';

const P = (o, i, n) => clamp((o.prog ?? 1) * n - i, 0, 1);
const so = (o, i, n, w = 3, extra = {}) => ({ w, col: o.col ?? INK, a: o.a ?? 1, prog: P(o, i, n), seed: (o.seed ?? 1) + i * 7, ...extra });
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];

// ---- the modern bedroom ----------------------------------------------------------------------------
export function bed(x, y, w, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const h = w * 0.22;
  fill(rect(x, y - h, w, h), PAPER);
  stroke(rect(x, y - h, w, h), so(o, 0, 5));
  stroke([[x, y - h], [x, y - h * 2.6], [x + w * 0.05, y - h * 2.6], [x + w * 0.05, y - h]], so(o, 1, 5));
  stroke([[x + w * 0.05, y], [x + w * 0.05, y + h * 0.35]], so(o, 1, 5)); stroke([[x + w * 0.96, y], [x + w * 0.96, y + h * 0.35]], so(o, 1, 5));
  hatch(rect(x, y - h, w, h).slice(0, 4), { gap: 12, a: 0.25, prog: P(o, 2, 5), seed: 9 });
  return { top: y - h };
}
export function sleeper(x, y, w, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  // Pillow, head, blanket lump; o.jolt lifts the blanket, o.awake opens the eye.
  const j = o.jolt ?? 0, hr = w * 0.07;
  const pil = smooth([[x, y], [x + w * 0.04, y - hr * 1.3], [x + w * 0.2, y - hr * 1.4], [x + w * 0.24, y], [x + w * 0.12, y + 3]], 2, true);
  fill(pil, PAPER); stroke(pil, so(o, 0, 4, 2.5));
  const hx = x + w * 0.14, hy = y - hr * 1.2 - j * 10;
  fill(circPts(hx, hy, hr, 3), PAPER); stroke(circPts(hx, hy, hr, 3), so(o, 1, 4, 3));
  const hp = smooth([[hx - hr, hy + hr * 0.2], [hx - hr * 0.8, hy - hr * 0.9], [hx + hr * 0.6, hy - hr * 1.05], [hx + hr * 0.2, hy - hr * 0.3]], 2, true);
  wash(hp, INK, 0.45, 4); hatch(hp, { gap: 5, a: 0.5, prog: P(o, 1, 4), seed: 5 });
  if (o.awake) { g.save(); g.fillStyle = INK; g.globalAlpha = o.awake; g.beginPath(); g.arc(hx + hr * 0.4, hy + hr * 0.05, 3.5, 0, TAU); g.fill(); g.restore(); }
  else stroke([[hx + hr * 0.2, hy + hr * 0.1], [hx + hr * 0.6, hy + hr * 0.15]], so(o, 2, 4, 2));
  const bl = smooth([[x + w * 0.2, y + 2], [x + w * 0.22, y - hr * 1.6 - j * 26], [x + w * 0.5, y - hr * 2.1 - j * 30], [x + w * 0.75, y - hr * 1.7 - j * 20], [x + w * 0.95, y - hr * 1.2], [x + w * 1.0, y + 2]], 3, true);
  fill(bl, PAPER); wash(bl, GREY, 0.35, 6); stroke(bl, so(o, 2, 4, 3)); hatch(bl, { gap: 16, ang: 0.4, a: 0.25, prog: P(o, 3, 4), seed: 7 });
}
export function clockFace(x, y, r, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const hour = o.hour ?? 6.75, min = o.min ?? 45;
  fill(circPts(x, y, r, o.seed ?? 3), PAPER, (o.a ?? 1) * clamp((o.prog ?? 1) * 4, 0, 1));
  circle(x, y, r, so(o, 0, 3, 3.2));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(x + Math.sin(a) * r * 0.78, y - Math.cos(a) * r * 0.78, x + Math.sin(a) * r * 0.9, y - Math.cos(a) * r * 0.9, so(o, 1, 3, i % 3 ? 1.6 : 2.6, { ghost: false, jit: 0.4, wob: 0.2 })); }
  const ha = hour / 12 * TAU, ma = min / 60 * TAU;
  line(x, y, x + Math.sin(ha) * r * 0.5, y - Math.cos(ha) * r * 0.5, so(o, 2, 3, 4.2, { jit: 0.5, wob: 0.2 }));
  line(x, y, x + Math.sin(ma) * r * 0.75, y - Math.cos(ma) * r * 0.75, so(o, 2, 3, 2.8, { jit: 0.5, wob: 0.2 }));
}
export function alarmClock(x, y, r, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const ring = o.ring ?? 0, sh = ring * Math.sin((o.t ?? 0) * 70) * 5;
  g.save(); g.translate(sh, 0); g.rotate(ring * 0.04 * Math.sin((o.t ?? 0) * 55));
  [-1, 1].forEach((s, i) => {
    const bx = x + s * r * 0.62, by = y - r * 0.95, bp = arcPts(bx, by, r * 0.36, Math.PI * 1.05, Math.PI * 1.95);
    const bpc = [...bp, [bx + r * 0.36, by + 4], [bx - r * 0.36, by + 4]];
    fill(bpc, PAPER); if (ring > 0) wash(bpc, OCHRE, 0.55 * ring, 3 + i); stroke(bp, so(o, 0, 3, 3)); line(bx - r * 0.38, by + 3, bx + r * 0.38, by + 3, so(o, 0, 3, 3));
    line(x + s * r * 0.55, y + r * 0.75, x + s * r * 0.8, y + r * 1.15, so(o, 0, 3, 3));
  });
  line(x - r * 0.15, y - r * 1.25, x + r * 0.15, y - r * 1.25, so(o, 0, 3, 3)); line(x, y - r * 1.25, x, y - r * 1.0, so(o, 0, 3, 2.5));
  clockFace(x, y, r, o);
  g.restore();
  if (ring > 0) for (let k = 0; k < 3; k++) [-1, 1].forEach((s) => { const rr = r * (1.35 + k * 0.28 + ((o.t ?? 0) * 3 % 0.28)); stroke(arcPts(x, y - r * 0.2, rr, s > 0 ? -0.9 : Math.PI - 0.5, s > 0 ? -0.2 : Math.PI + 0.2), { w: 3, col: OCHRE, a: ring * (1 - k * 0.3), seed: 40 + k * 3 + s, ghost: false }); });
}
export function windowFrame(x, y, w, h, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  fill(rect(x, y, w, h), PAPER); if (o.night) wash(rect(x, y, w, h).slice(0, 4), SOFT, 0.35 * o.night, 2);
  stroke(rect(x, y, w, h), so(o, 0, 2, 3.2)); line(x + w / 2, y, x + w / 2, y + h, so(o, 1, 2, 2.4)); line(x, y + h / 2, x + w, y + h / 2, so(o, 1, 2, 2.4));
  if (o.moon) { const mp = [...arcPts(x + w * 0.72, y + h * 0.25, h * 0.1, -2.2, 2.2), ...arcPts(x + w * 0.76, y + h * 0.25, h * 0.08, 2.0, -2.0)]; fill(mp, PAPER, o.moon); stroke(mp, { ...so(o, 1, 2, 2), a: o.moon }); }
}
// Time-saving machines, simple line drawings.
export function machine(kind, x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const S = (v) => v * s, oo = (i, w = 3) => so(o, i, 3, w);
  if (kind === 'washer') { const r = rect(x - S(55), y - S(120), S(110), S(120)); fill(r, PAPER); stroke(r, oo(0)); circle(x, y - S(55), S(34), oo(1)); circle(x, y - S(55), S(22), oo(2, 2)); line(x - S(55), y - S(100), x + S(55), y - S(100), oo(1, 2)); }
  if (kind === 'microwave') { const r = rect(x - S(70), y - S(70), S(140), S(70)); fill(r, PAPER); stroke(r, oo(0)); stroke(rect(x - S(60), y - S(60), S(90), S(50)), oo(1, 2)); for (let i = 0; i < 3; i++) circle(x + S(50), y - S(52) + i * S(16), S(5), oo(2, 1.6)); hatch(rect(x - S(60), y - S(60), S(90), S(50)).slice(0, 4), { gap: 8, a: 0.3, prog: P(o, 2, 3) }); }
  if (kind === 'phone') { const r = rect(x - S(28), y - S(100), S(56), S(100)); fill(r, PAPER); stroke(r, oo(0)); stroke(rect(x - S(22), y - S(90), S(44), S(78)), oo(1, 2)); circle(x, y - S(6), S(3), oo(2, 1.5)); }
  if (kind === 'laptop') { const sc = [[x - S(60), y - S(10)], [x - S(52), y - S(88)], [x + S(52), y - S(88)], [x + S(60), y - S(10)]]; fill(sc, PAPER); stroke([...sc], oo(0)); stroke([[x - S(80), y], [x + S(80), y], [x + S(62), y - S(10)], [x - S(62), y - S(10)], [x - S(80), y]], oo(1)); wash(sc, GREY, 0.3, 3); }
  if (kind === 'car') { const b = smooth([[x - S(110), y - S(20)], [x - S(105), y - S(50)], [x - S(50), y - S(58)], [x - S(25), y - S(95)], [x + S(45), y - S(95)], [x + S(75), y - S(55)], [x + S(110), y - S(48)], [x + S(112), y - S(20)]], 2); fill([...b, [x + S(112), y - S(15)], [x - S(110), y - S(15)]], PAPER); stroke(b, oo(0)); line(x - S(110), y - S(18), x + S(112), y - S(18), oo(0)); [-1, 1].forEach((d) => { fill(circPts(x + d * S(62), y - S(18), S(20), 5 + d), PAPER); circle(x + d * S(62), y - S(18), S(20), oo(1)); circle(x + d * S(62), y - S(18), S(7), oo(2, 2)); }); stroke([[x - S(18), y - S(88)], [x + S(40), y - S(88)], [x + S(62), y - S(58)], [x - S(38), y - S(58)], [x - S(18), y - S(88)]], oo(1, 2)); }
  if (kind === 'kettle') { const b = smooth([[x - S(40), y], [x - S(45), y - S(50)], [x - S(20), y - S(75)], [x + S(25), y - S(75)], [x + S(45), y - S(45)], [x + S(40), y]], 2); fill([...b, [x - S(40), y]], PAPER); stroke([...b, [x - S(40), y]], oo(0)); stroke([[x + S(40), y - S(35)], [x + S(75), y - S(70)], [x + S(80), y - S(62)]], oo(1)); stroke(arcPts(x, y - S(75), S(28), Math.PI, TAU, S(26)), oo(2)); }
  if (kind === 'tv') { const r = rect(x - S(95), y - S(125), S(190), S(110)); fill(r, PAPER); stroke(r, oo(0)); wash(r.slice(0, 4), GREY, 0.35, 8); line(x - S(30), y, x, y - S(15), oo(1)); line(x + S(30), y, x, y - S(15), oo(1)); }
  if (kind === 'fridge') { const r = rect(x - S(55), y - S(210), S(110), S(210)); fill(r, PAPER); stroke(r, oo(0)); line(x - S(55), y - S(135), x + S(55), y - S(135), oo(1)); line(x + S(38), y - S(175), x + S(38), y - S(150), oo(2, 3.5)); line(x + S(38), y - S(115), x + S(38), y - S(70), oo(2, 3.5)); }
}

// ---- the savanna -----------------------------------------------------------------------------------
export function hills(y, o = {}) {
  const pts = []; for (let x = -200; x <= 2200; x += 40) pts.push([x, y - 60 * Math.sin(x * 0.0021 + (o.seed ?? 0)) - 30 * Math.sin(x * 0.0057 + 1)]);
  stroke(pts, { w: o.w ?? 2.4, col: o.col ?? SOFT, a: o.a ?? 1, prog: o.prog ?? 1, seed: o.seed ?? 3, step: 12 });
  return pts;
}
export function ground(y, o = {}) {
  const pts = []; for (let x = -300; x <= 2300; x += 40) pts.push([x, y + 6 * Math.sin(x * 0.01 + (o.seed ?? 0))]);
  stroke(pts, { w: o.w ?? 3, col: INK, a: o.a ?? 1, prog: o.prog ?? 1, seed: o.seed ?? 5, step: 12 });
}
export function grass(x, y, s, o = {}) {
  for (let i = 0; i < 5; i++) { const a = -0.5 + i * 0.25 + hn((o.seed ?? 1) + i, 2) * 0.1, L = s * (18 + 10 * Math.sin(i * 2.1)); stroke([[x + i * s * 3, y], [x + i * s * 3 + Math.sin(a) * L * 0.5, y - L * 0.6], [x + i * s * 3 + Math.sin(a) * L, y - L]], { w: 1.8, col: o.col ?? SOFT, a: o.a ?? 1, prog: o.prog ?? 1, seed: (o.seed ?? 1) * 13 + i, ghost: false }); }
}
export function acacia(x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const S = (v) => v * s;
  stroke(smooth([[x, y], [x + S(4), y - S(70)], [x - S(6), y - S(140)], [x - S(40), y - S(200)]], 2), so(o, 0, 3, 4.5 * Math.min(1, s)));
  stroke(smooth([[x - S(2), y - S(120)], [x + S(40), y - S(185)], [x + S(80), y - S(205)]], 2), so(o, 0, 3, 3.5 * Math.min(1, s)));
  const can = smooth([[x - S(140), y - S(200)], [x - S(90), y - S(245)], [x - S(10), y - S(262)], [x + S(80), y - S(255)], [x + S(150), y - S(215)], [x + S(60), y - S(200)], [x - S(40), y - S(196)]], 3, true);
  fill(can, PAPER, o.a ?? 1); wash(can, o.dark ? INK : GREY, o.dark ? 0.7 : 0.4, (o.seed ?? 1) + 2); stroke(can, so(o, 1, 3, 2.6));
  hatch(can, { gap: 7, ang: -0.3, a: 0.4 * (o.a ?? 1), prog: P(o, 2, 3), seed: (o.seed ?? 1) + 5 });
}
export function rockShelter(x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  // A granite outcrop: stacked, weathered boulders with an overhang to shelter under.
  const S = (v) => v * s;
  [[-60, 0, 120, 80], [90, 0, 95, 70], [10, -120, 150, 70], [150, -95, 70, 50], [-140, -40, 60, 50]].forEach(([dx, dy, rx, ry], i) => {
    const b = circPts(x + S(dx), y + S(dy) - S(ry) * 0.85, S(rx), 700 + i * 3, 0.05, S(ry));
    fill(b, PAPER, o.a ?? 1); wash(b, GREY, 0.42, i); stroke(b, so(o, 0, 2, 3.2, { seed: 710 + i }));
    hatch(b.map(([px, py]) => [px, py]).filter((_, j) => j % 2 === 0), { gap: 7, ang: 0.8, a: 0.32, prog: P(o, 1, 2), seed: 720 + i });
    stroke(arcPts(x + S(dx) - S(rx) * 0.2, y + S(dy) - S(ry) * 0.9, S(rx) * 0.55, -2.6, -1.6, S(ry) * 0.5), so(o, 1, 2, 1.8, { seed: 730 + i, col: SOFT }));
  });
}
export function sun(x, y, r, o = {}) {
  glow(x, y, r * 3, 'rgba(214,120,60,0.28)', o.a ?? 1);
  const c = circPts(x, y, r, o.seed ?? 9, 0.05);
  wash(c, OCHRE, 0.55 * (o.a ?? 1), 4); stroke(c, { w: 2.4, col: OCHRE, a: o.a ?? 1, prog: o.prog ?? 1, seed: 8 });
  if (o.rays) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.2; line(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, x + Math.cos(a) * r * (1.6 + 0.12 * Math.sin(i)), y + Math.sin(a) * r * (1.6 + 0.12 * Math.sin(i)), { w: 2.2, col: OCHRE, a: (o.a ?? 1) * o.rays, seed: 20 + i, ghost: false }); }
}
export function birds(x, y, t, o = {}) {
  for (let i = 0; i < (o.n ?? 5); i++) { const bx = x + i * 46 + t * 40 + 20 * Math.sin(i * 2.3), by = y + 18 * Math.sin(i * 1.7) + 6 * Math.sin(t * 2 + i), f = 8 * Math.sin(t * 9 + i * 1.3); stroke([[bx - 13, by - f * 0.6], [bx, by + 3], [bx + 13, by - f * 0.6]], { w: 2, col: SOFT, a: o.a ?? 1, seed: 300 + i, ghost: false }); }
}
export function smoke(x, y, t, o = {}) {
  const pts = []; for (let i = 0; i < 16; i++) { const k = i / 15; pts.push([x + Math.sin(t * 1.3 + k * 5) * 14 * k + k * 30, y - k * (o.h ?? 160)]); }
  stroke(pts, { w: 2, col: GREY, a: (o.a ?? 1) * 0.8, seed: 77, ghost: false });
}
export function embers(x, y, s, t, o = {}) {
  for (let i = 0; i < 4; i++) line(x - s * 30 + i * s * 18, y + s * 4, x - s * 10 + i * s * 14, y - s * 8, { w: 3.2, col: INK, a: o.a ?? 1, seed: 90 + i });
  glow(x, y - s * 5, s * 45, 'rgba(210,110,50,0.4)', (o.a ?? 1) * (0.7 + 0.2 * Math.sin(t * 6)));
}
export function fire(x, y, s, t, o = {}) {
  const a = o.a ?? 1;
  glow(x, y - s * 40, s * (o.glowR ?? 420), 'rgba(226,120,48,0.55)', a * (0.8 + 0.1 * Math.sin(t * 7) + 0.06 * Math.sin(t * 13)));
  for (let i = 0; i < 5; i++) line(x - s * 60 + i * s * 30, y + s * 8, x - s * 20 + i * s * 12, y - s * 14, { w: 5 * s, col: o.logs ?? INK, a, seed: 120 + i });
  for (let k = 0; k < 3; k++) {
    const hh = s * (95 - k * 25) * (1 + 0.15 * Math.sin(t * 9 + k * 2)), ww = s * (38 - k * 9);
    const fl = smooth([[x - ww, y], [x - ww * 0.8, y - hh * 0.45], [x - ww * 0.2 + 8 * Math.sin(t * 11 + k), y - hh * 0.75], [x + 4 * Math.sin(t * 8 + k), y - hh], [x + ww * 0.3, y - hh * 0.6], [x + ww * 0.9, y - hh * 0.35], [x + ww, y]], 2, true);
    const col = ['#d8672c', '#eb9a3e', '#f6d27a'][k];
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.beginPath(); fl.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); g.restore();
    if (k === 0) stroke(fl, { w: 2.2, col: '#7a2e14', a: a * 0.7, seed: 130 });
  }
}

// ---- food, tools, crafts ---------------------------------------------------------------------------
export function icon(kind, x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const S = (v) => v * s, oo = (i, w = 2.6) => so(o, i, 2, w);
  if (kind === 'leaf') { const l = smooth([[x - S(30), y + S(20)], [x - S(20), y - S(15)], [x + S(25), y - S(25)], [x + S(10), y + S(10)]], 2, true); wash(l, GREY, 0.4, 2); stroke(l, oo(0)); line(x - S(28), y + S(18), x + S(20), y - S(20), oo(1, 1.6)); }
  if (kind === 'fish') { const f = smooth([[x - S(35), y], [x - S(10), y - S(15)], [x + S(20), y - S(8)], [x + S(30), y], [x + S(20), y + S(8)], [x - S(10), y + S(14)]], 2, true); wash(f, GREY, 0.3, 3); stroke(f, oo(0)); stroke([[x + S(28), y], [x + S(45), y - S(14)], [x + S(45), y + S(14)], [x + S(28), y]], oo(1)); g.save(); g.fillStyle = INK; g.globalAlpha = P(o, 1, 2); g.beginPath(); g.arc(x - S(20), y - S(3), S(2.5), 0, TAU); g.fill(); g.restore(); }
  if (kind === 'berries') { [[0, 0], [S(16), S(4)], [S(6), S(16)], [-S(10), S(12)], [S(20), S(20)]].forEach(([dx, dy], i) => { const c = circPts(x + dx, y + dy, S(9), 30 + i); wash(c, OCHRE, 0.5, i); stroke(c, so(o, i > 2 ? 1 : 0, 2, 2)); }); stroke([[x, y - S(8)], [x + S(8), y - S(28)], [x + S(20), y - S(4)]], oo(1, 1.6)); }
  if (kind === 'nut') { const n = circPts(x, y, S(20), 44, 0.05, S(15)); wash(n, SOFT, 0.35, 4); stroke(n, oo(0)); hatch(n.slice(0, -1), { gap: 5, a: 0.4, prog: P(o, 1, 2), seed: 5 }); }
  if (kind === 'tuber') { const tb = smooth([[x - S(35), y], [x - S(20), y - S(16)], [x + S(15), y - S(18)], [x + S(38), y - S(4)], [x + S(20), y + S(14)], [x - S(20), y + S(14)]], 2, true); wash(tb, SOFT, 0.35, 6); stroke(tb, oo(0)); for (let i = 0; i < 3; i++) line(x - S(28) - i * S(4), y + S(8), x - S(42) - i * S(6), y + S(18), oo(1, 1.4)); }
  if (kind === 'antelope') { const b = smooth([[x - S(35), y], [x - S(30), y - S(20)], [x + S(20), y - S(22)], [x + S(34), y - S(35)], [x + S(44), y - S(30)], [x + S(34), y - S(12)], [x + S(28), y + S(2)]], 2); stroke(b, oo(0)); [[-28, 0], [-18, 2], [18, 0], [26, 2]].forEach(([dx, dy], i) => line(x + S(dx), y + S(dy), x + S(dx + 2), y + S(30), oo(1, 2))); stroke([[x + S(36), y - S(34)], [x + S(34), y - S(56)], [x + S(44), y - S(64)]], oo(1, 2)); }
  if (kind === 'egg') { const e = circPts(x, y, S(15), 50, 0.05, S(20)); fill(e, PAPER); stroke(e, oo(0)); for (let i = 0; i < 5; i++) { g.save(); g.fillStyle = SOFT; g.globalAlpha = 0.6 * P(o, 1, 2); g.beginPath(); g.arc(x + hn(i, 3) * S(8), y + hn(i, 4) * S(12), S(2), 0, TAU); g.fill(); g.restore(); } }
  if (kind === 'honey') { for (let i = 0; i < 4; i++) { const hx = x + (i % 2) * S(22) - S(11) + (i > 1 ? S(11) : 0), hy = y + Math.floor(i / 2) * S(19) - S(9); const hp = []; for (let k = 0; k <= 6; k++) hp.push([hx + Math.cos(k / 6 * TAU) * S(12), hy + Math.sin(k / 6 * TAU) * S(12)]); wash(hp, OCHRE, 0.35, i); stroke(hp, oo(i > 1 ? 1 : 0, 2)); } }
  if (kind === 'wheat') wheat(x, y + S(35), s * 0.8, o);
}
export function wheat(x, y, s, o = {}) {
  const S = (v) => v * s, sw = (o.sway ?? 0);
  const top = [x + S(6) + sw * S(10), y - S(70)];
  stroke([[x, y], [x + S(3) + sw * S(4), y - S(35)], top], { w: 2, col: o.col ?? SOFT, a: o.a ?? 1, prog: o.prog ?? 1, seed: (o.seed ?? 1) + 1, ghost: false });
  if ((o.prog ?? 1) > 0.5) for (let i = 0; i < 5; i++) [-1, 1].forEach((d) => { const kx = top[0] - i * S(1.5), ky = top[1] + i * S(8) - S(2), gr = smooth([[kx, ky], [kx + d * S(6), ky - S(4)], [kx + d * S(4), ky - S(10)], [kx, ky]], 1, true); wash(gr, o.grain ?? OCHRE, 0.45 * (o.a ?? 1), i + d); stroke(gr, { w: 1.4, col: INK, a: (o.a ?? 1) * clamp(((o.prog ?? 1) - 0.5) * 2, 0, 1), seed: (o.seed ?? 1) * 7 + i * 2 + d, ghost: false, jit: 0.4, wob: 0.3 }); });
}
export function quern(x, y, s, p, o = {}) {
  const S = (v) => v * s, slab = smooth([[x - S(90), y], [x - S(80), y - S(22)], [x + S(80), y - S(34)], [x + S(95), y - S(10)], [x + S(80), y]], 2, true);
  fill(slab, PAPER); wash(slab, GREY, 0.5, 3); stroke(slab, so(o, 0, 2, 3)); hatch(slab, { gap: 6, a: 0.4, prog: P(o, 1, 2), seed: 4 });
  for (let i = 0; i < 14; i++) { g.save(); g.fillStyle = OCHRE; g.globalAlpha = 0.6 * (o.a ?? 1); g.beginPath(); g.arc(x + S(60) + hn(i, 1) * S(18), y - S(34) + hn(i, 2) * S(5) - Math.abs(hn(i, 3)) * S(8), S(3), 0, TAU); g.fill(); g.restore(); }
  if (o.noStone) return null;
  const rx = x + Math.sin(p) * S(45) - S(10), rs = circPts(rx, y - S(40), S(26), 7, 0.05, S(13));
  fill(rs, PAPER); wash(rs, GREY, 0.55, 5); stroke(rs, so(o, 1, 2, 3));
  return [rx, y - S(46)];
}
export function hut(x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const S = (v) => v * s, d = [...arcPts(x, y, S(80), Math.PI, TAU, S(70))];
  fill([...d, [x - S(80), y]], PAPER); wash([...d, [x - S(80), y]], GREY, 0.35, (o.seed ?? 1)); stroke(d, so(o, 0, 3, 3));
  for (let i = 0; i < 14; i++) { const a = Math.PI + (i + 0.5) / 14 * Math.PI; stroke([[x + Math.cos(a) * S(80) * 0.98, y + Math.sin(a) * S(70) * 0.98], [x + Math.cos(a) * S(40), y + Math.sin(a) * S(24)]], so(o, 1, 3, 1.4, { seed: (o.seed ?? 1) * 9 + i, ghost: false })); }
  const door = arcPts(x + S(20), y, S(22), Math.PI, TAU, S(34)); fill(door, INK, 0.75 * P(o, 2, 3));
}
export function notebook(x, y, w, n, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const h = w * 0.7, pg = [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2], [x - w / 2, y - h / 2]];
  fill(pg, PAPER); stroke(pg, so(o, 0, 2, 3)); line(x, y - h / 2, x, y + h / 2, so(o, 0, 2, 2));
  for (let r = 0; r < 6; r++) line(x - w * 0.46, y - h * 0.38 + r * h * 0.15, x - w * 0.04, y - h * 0.38 + r * h * 0.15, so(o, 1, 2, 1, { col: GREY, ghost: false }));
  // Tally marks, bundles of five on the right page.
  for (let i = 0; i < n; i++) { const b = Math.floor(i / 5), k = i % 5, bx = x + w * 0.06 + (b % 4) * w * 0.1, by = y - h * 0.3 + Math.floor(b / 4) * h * 0.22; if (k < 4) line(bx + k * w * 0.018, by, bx + k * w * 0.018, by + h * 0.14, { w: 2.4, seed: 500 + i, a: o.a ?? 1, ghost: false }); else line(bx - w * 0.01, by + h * 0.12, bx + w * 0.07, by + h * 0.02, { w: 2.4, seed: 500 + i, col: OCHRE, a: o.a ?? 1, ghost: false }); }
}
export function shell(x, y, r, rot, o = {}) {
  const sp = []; for (let i = 0; i <= 26; i++) { const a = i / 26 * TAU * 1.6 + rot, rr = r * (0.25 + 0.75 * i / 26); sp.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]); }
  const body = circPts(x, y, r, 60 + Math.round(rot * 10), 0.05, r * 0.8, rot);
  fill(body, PAPER, o.a ?? 1); wash(body, OCHRE, 0.45 * (o.a ?? 1), 3); stroke(body, { w: 2.2, a: o.a ?? 1, seed: 61 + Math.round(rot * 10) });
  stroke(sp, { w: 1.3, a: (o.a ?? 1) * 0.7, seed: 62, ghost: false, jit: 0.4, wob: 0.3 });
  g.save(); g.globalAlpha = o.a ?? 1; g.fillStyle = INK; g.beginPath(); g.arc(x + Math.cos(rot) * r * 0.2, y + Math.sin(rot) * r * 0.2, r * 0.22, 0, TAU); g.fill(); g.restore();
}
export function flute(x0, y0, x1, y1, w, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w;
  const q = [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
  fill(q, PAPER, o.a ?? 1); wash(q, '#d9ccb0', 0.6, 3); stroke([q[0], q[1]], so(o, 0, 2, 2.6)); stroke([q[3], q[2]], so(o, 0, 2, 2.6));
  circle(x0, y0, w * 1.1, so(o, 0, 2, 2.4)); circle(x1, y1, w * 1.05, so(o, 0, 2, 2.4));
  const n = Math.floor((o.holes ?? 5) * P(o, 1, 2) + 0.001);
  for (let i = 0; i < n; i++) { const k = 0.35 + i * 0.11; g.save(); g.globalAlpha = o.a ?? 1; g.fillStyle = INK; g.beginPath(); g.ellipse(x0 + dx * k, y0 + dy * k, w * 0.45, w * 0.35, Math.atan2(dy, dx), 0, TAU); g.fill(); g.restore(); }
}
export function soundWaves(x, y, t, o = {}) {
  for (let k = 0; k < 4; k++) { const ph = (t * 0.8 + k * 0.25) % 1, r = 30 + ph * 150; stroke(arcPts(x, y, r, -0.9, 0.4), { w: 2.4, col: o.col ?? OCHRE, a: (o.a ?? 1) * (1 - ph), seed: 70 + k, ghost: false }); }
}
export function meat(x, y, s, o = {}) {
  const S = (v) => v * s, m = smooth([[x - S(10), y + S(8)], [x - S(25), y - S(10)], [x - S(10), y - S(28)], [x + S(15), y - S(20)], [x + S(12), y + S(2)]], 2, true);
  fill(m, PAPER, o.a ?? 1); wash(m, OCHRE, 0.65 * (o.a ?? 1), 5); stroke(m, { w: 2.6, a: o.a ?? 1, seed: 80 });
  line(x - S(4), y + S(4), x + S(18), y + S(24), { w: 5 * s, a: o.a ?? 1, seed: 81 }); circle(x + S(20), y + S(27), S(5), { w: 2.4, a: o.a ?? 1, seed: 82 });
}
export function bubble(x, y, w, h, tail, o = {}) {
  const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; pts.push([x + Math.cos(a) * w / 2 * (1 + 0.05 * Math.sin(a * 9)), y + Math.sin(a) * h / 2 * (1 + 0.06 * Math.sin(a * 9))]); }
  fill(pts, PAPER, o.a ?? 1); stroke(pts, { w: 2.6, a: o.a ?? 1, prog: o.prog ?? 1, seed: o.seed ?? 90 });
  if (tail) { if (o.thought) [0.3, 0.55, 0.8].forEach((k, i) => { const bx = lerp(x, tail[0], k), by = lerp(y + h / 2, tail[1], k), r = 14 - i * 4; fill(circPts(bx, by, r, 91 + i), PAPER, o.a ?? 1); circle(bx, by, r, { w: 2, a: (o.a ?? 1) * (o.prog ?? 1), seed: 92 + i }); }); else { const b0 = [x - w * 0.12, y + h * 0.45], b1 = [x + w * 0.05, y + h * 0.48]; fill([b0, tail, b1], PAPER, o.a ?? 1); stroke([b0, tail, b1], { w: 2.6, a: o.a ?? 1, prog: o.prog ?? 1, seed: 93 }); } }
}
export function lion(x, y, s, t, o = {}) {
  const S = (v) => v * s, a = o.a ?? 1, lw = 3 * Math.min(1.2, s);
  const body = smooth([[x - S(120), y - S(30)], [x - S(90), y - S(70)], [x + S(20), y - S(72)], [x + S(70), y - S(60)], [x + S(80), y - S(20)], [x - S(110), y - S(15)]], 2, true);
  fill(body, PAPER, a); wash(body, OCHRE, 0.3 * a, 3); stroke(body, { w: lw, a, seed: 400 });
  const mane = circPts(x + S(95), y - S(62), S(42), 401, 0.1, S(38)); fill(mane, PAPER, a); wash(mane, SOFT, 0.5 * a, 4); stroke(mane, { w: lw, a, seed: 402 }); hatch(mane.slice(0, -2), { gap: 5, a: 0.5 * a, seed: 403 });
  const hd = circPts(x + S(108), y - S(58), S(22), 404, 0.05, S(20)); fill(hd, PAPER, a); stroke(hd, { w: lw, a, seed: 405 });
  [[-1, 0], [1, 0]].forEach(([d], i) => { g.save(); g.globalAlpha = a; g.fillStyle = INK; g.beginPath(); g.arc(x + S(108) + d * S(8), y - S(62), S(3), 0, TAU); g.fill(); g.restore(); });
  [[-95, -18], [-70, -18], [30, -18], [55, -18]].forEach(([dx, dy], i) => stroke([[x + S(dx), y + S(dy)], [x + S(dx + 6), y], [x + S(dx + 18), y]], { w: lw, a, seed: 410 + i }));
  stroke(smooth([[x - S(118), y - S(40)], [x - S(160), y - S(50) + S(10) * Math.sin(t * 2)], [x - S(170), y - S(80) + S(8) * Math.sin(t * 2 + 1)]], 2), { w: lw * 0.8, a, seed: 420 });
}
export function cairn(x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  [[0, 0, 26], [-30, -4, 20], [28, -2, 22], [-12, -34, 20], [16, -32, 18], [2, -60, 16]].forEach(([dx, dy, r], i) => { const st = circPts(x + dx * s, y + dy * s - r * s * 0.6, r * s, 430 + i, 0.05, r * s * 0.7); fill(st, PAPER, o.a ?? 1); wash(st, GREY, 0.45, i); stroke(st, so(o, i > 2 ? 1 : 0, 2, 2.6)); });
  if (o.flower) { stroke([[x + 60 * s, y], [x + 62 * s, y - 50 * s]], { w: 2, col: SOFT, a: o.flower, seed: 440 }); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const pe = circPts(x + 62 * s + Math.cos(a) * 9 * s, y - 50 * s + Math.sin(a) * 9 * s, 6 * s, 441 + i); wash(pe, OCHRE, 0.7 * o.flower, i); stroke(pe, { w: 1.5, a: o.flower, seed: 450 + i, ghost: false }); } }
}
export function fence(x0, x1, y, h, o = {}) {
  const n = Math.round((x1 - x0) / 28), m = Math.ceil(n * (o.prog ?? 1));
  for (let i = 0; i < m; i++) { const x = x0 + i * 28; line(x, y, x + hn(i, 5) * 3, y - h - hn(i, 6) * 8, { w: 3.2, a: o.a ?? 1, seed: 600 + i }); }
  if (m > 1) [0.35, 0.7].forEach((k, j) => stroke([[x0, y - h * k], [x0 + (m - 1) * 28, y - h * k + 3]], { w: 2.6, a: o.a ?? 1, seed: 650 + j }));
}
export function desk(x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const S = (v) => v * s;
  stroke([[x - S(200), y - S(150)], [x + S(200), y - S(150)]], so(o, 0, 3, 3.6)); line(x - S(185), y - S(150), x - S(185), y, so(o, 0, 3, 3.2)); line(x + S(185), y - S(150), x + S(185), y, so(o, 0, 3, 3.2));
  const scr = [[x - S(20), y - S(310)], [x + S(150), y - S(310)], [x + S(150), y - S(195)], [x - S(20), y - S(195)], [x - S(20), y - S(310)]];
  fill(scr, PAPER); wash(scr.slice(0, 4), GREY, 0.45, 4); stroke(scr, so(o, 1, 3, 3)); line(x + S(65), y - S(195), x + S(65), y - S(152), so(o, 1, 3, 3)); line(x + S(35), y - S(152), x + S(95), y - S(152), so(o, 1, 3, 3));
  for (let i = 0; i < 5; i++) line(x, y - S(290) + i * S(18), x + S(100 - (i * 37) % 60), y - S(290) + i * S(18), so(o, 2, 3, 1.6, { col: INK, ghost: false }));
  stroke([[x - S(90), y - S(158)], [x + S(10), y - S(158)]], so(o, 2, 3, 5));
}
export function chair(x, y, s, o = {}) {
  if ((o.prog ?? 1) <= 0) return {};
  const S = (v) => v * s;
  line(x - S(50), y - S(90), x + S(40), y - S(90), so(o, 0, 2, 3.4)); line(x - S(50), y - S(90), x - S(60), y - S(230), so(o, 0, 2, 3.4));
  line(x - S(5), y - S(90), x - S(5), y - S(20), so(o, 1, 2, 3)); [-1, 1].forEach((d) => line(x - S(5), y - S(20), x - S(5) + d * S(45), y, so(o, 1, 2, 3)));
}
