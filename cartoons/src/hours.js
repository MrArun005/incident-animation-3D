// "Before the Alarm": foragers and the first farmers, told in hand-drawn ink on paper. No
// on-screen text: the narration carries the words and the drawings carry the ideas. Every shot
// keys off the measured narration timing (stories/hours.timing.json), so re-recording a line
// re-times the picture.
import { W, H, TAU, clamp, lerp, ease, lin, rng } from './rich/core.js';
import timing from '../stories/hours.timing.json' with { type: 'json' };
import * as S from './hours/sketch.js';
import * as Pr from './hours/props.js';

const { INK, SOFT, GREY, OCHRE, PAPER, POSE, figure, mixPose, stroke, line, circle, circPts, arcPts, fill, wash, hatch, glow, smooth, cam } = S;
const FPS = 30, DURATION = 194;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d'); S.bind(g);
const L = Object.fromEntries(timing.lines.map((l) => [l.id, l]));
const T = (id) => L[id].t0, E = (id) => L[id].t0 + L[id].dur;
const pr = (t, t0, d) => clamp((t - t0) / d, 0, 1);
// Camera keyframes [time, x, y, z], eased between.
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { const a = keys[i - 1], b = keys[i], k = ease((t - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)]; }
  return keys[keys.length - 1].slice(1);
}
const FORAGER = { wrap: OCHRE, hair: 'coil' };
const FARMER = { tunic: GREY, hair: 'short' };
const MODERN = { shirt: GREY, trousers: SOFT, hair: 'short' };
function savanna(t, o = {}) {
  const gy = o.gy ?? 800;
  const hl = Pr.hills(gy - 110, { seed: o.seed ?? 2, prog: o.prog ?? 1, a: 0.8 });
  fill([...hl, [2200, H + 200], [-200, H + 200]], PAPER, 0.001);
  Pr.ground(gy, { prog: o.prog ?? 1 });
  (o.trees ?? [[1500, 0.9], [1780, 0.55]]).forEach(([x, s], i) => Pr.acacia(x, gy + 4, s, { prog: o.prog ?? 1, seed: 20 + i }));
  for (let i = 0; i < (o.tufts ?? 14); i++) Pr.grass(-100 + i * 160 + 40 * Math.sin(i * 3.1), gy + 4 + (i % 3) * 22, 1.1, { prog: o.prog ?? 1, seed: i + 3 });
}

// ---- shots -----------------------------------------------------------------------------------------
function alarm(t) {
  const [cx, cy, z] = track(t, [[0, 1000, 560, 1.18], [T('a2'), 1080, 560, 1.3]]);
  cam(cx, cy, z);
  const d = pr(t, 0.2, 2.0), ring = clamp((t - T('a1')) * 4, 0, 1) * (1 - pr(t, T('a1') + 2.6, 0.3));
  Pr.windowFrame(760, 170, 260, 280, { prog: d, night: 1, moon: 1 });
  stroke([[-200, 690], [2200, 690]], { w: 2, col: SOFT, prog: d, seed: 3 });
  const bt = Pr.bed(420, 760, 720, { prog: d }).top;
  const jolt = t > T('a1') ? Math.max(0, Math.sin((t - T('a1')) * 3)) * Math.exp(-(t - T('a1')) * 0.8) : 0;
  Pr.sleeper(440, bt, 690, { prog: d, jolt, awake: pr(t, T('a1') + 0.4, 0.3) });
  const ns = [[1230, 610], [1420, 610], [1420, 760], [1230, 760], [1230, 610]];
  fill(ns, PAPER); stroke(ns, { w: 3, prog: d, seed: 44 }); line(1230, 670, 1420, 670, { w: 2.2, prog: d, seed: 45 });
  Pr.alarmClock(1325, 540, 52, { prog: d, ring, t, hour: 6.75, min: 45 });
}
function machines(t) {
  const u = t - T('a2');
  const [cx, cy, z] = track(t, [[T('a2') - 0.3, 960, 560, 1.0], [T('a3') - 0.7, 960, 540, 1.1]]);
  cam(cx, cy, z);
  stroke([[-200, 860], [2200, 860]], { w: 3, prog: pr(u, 0, 0.8), seed: 5 });
  const who = figure(960, 860, 2.35, mixPose(POSE.stand(), { ...POSE.stand(), neck: -0.2, aF: 0.5, fF: 1.3 }, pr(u, 0.5, 0.8)), { ...MODERN, seed: 11, prog: pr(u, 0, 1.2), smile: -0.4 });
  Pr.machine('phone', who.hand[0] + 8, who.hand[1] + 30, 0.55, { prog: pr(u, 0.9, 0.6) });
  const M = [['washer', 330, 860, 1.2], ['fridge', 560, 860, 1.1], ['car', 1560, 860, 1.25], ['phone', 1330, 560, 1.3], ['tv', 460, 470, 1.0], ['microwave', 1520, 560, 1.0], ['kettle', 1180, 300, 1.0], ['microwave', 700, 300, 0.8]];
  M.forEach(([k, x, y, s], i) => Pr.machine(k, x, y + 4 * Math.sin(t * 1.3 + i), s, { prog: pr(u, 0.6 + i * 0.45, 0.7), seed: 30 + i * 5 }));
  // Clocks crowd the walls, their hands racing faster and faster.
  const r = rng(8), sp = lerp(0.4, 9, pr(u, 3.5, 3.5) ** 2);
  for (let i = 0; i < 11; i++) { const x = 140 + r() * 1640, y = 90 + r() * 260, rr = 26 + r() * 30; if (Math.abs(x - 960) < 170 && y > 200) continue; const tt = t * sp * (0.7 + r() * 0.6) + r() * 10; Pr.clockFace(x, y, rr, { prog: pr(u, 3.6 + i * 0.28, 0.5), hour: tt / 12 % 12, min: (tt * 60) % 60, seed: 60 + i }); }
}
function dawn(t) {
  const u = t - (T('a3') - 0.7);
  const [cx, cy, z] = track(u, [[0, 960, 560, 1.0], [8.5, 820, 600, 1.16]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.8), sy = lerp(900, 520, ease(pr(u, 0.4, 7)));
  Pr.sun(1380, sy, 70, { prog: 1, a: pr(u, 0.3, 1), rays: pr(u, 4, 2) });
  const hl = Pr.hills(700, { seed: 2, prog: d, a: 0.9 }); fill([...hl, [2200, 1400], [-200, 1400]], PAPER); Pr.hills(700, { seed: 2, prog: d, a: 0.9 });
  Pr.ground(800, { prog: d });
  Pr.acacia(1520, 804, 0.85, { prog: d, seed: 4 }); Pr.acacia(1790, 800, 0.5, { prog: d, seed: 6 });
  for (let i = 0; i < 12; i++) Pr.grass(-60 + i * 170, 806 + (i % 3) * 18, 1.1, { prog: d, seed: i });
  Pr.rockShelter(250, 804, 1.1, { prog: d });
  Pr.embers(760, 800, 1.2, t, { a: d }); Pr.smoke(760, 780, t, { a: d * 0.8, h: 200 });
  Pr.birds(900 + u * 30, 330, t, { a: pr(u, 3, 1) });
  // She sleeps, sits up, stands, stretches, looks at the sun.
  const k1 = ease(pr(u, 2.2, 1.8)), k2 = ease(pr(u, 4.6, 1.0)), k3 = ease(pr(u, 5.4, 1.2)), k4 = ease(pr(u, 7.2, 1.0));
  let pose = POSE.sitUp(k1);
  if (k2 > 0) pose = mixPose(pose, POSE.stand(), k2);
  if (k3 > 0) pose = mixPose(pose, POSE.stretch(1 - k4), k3);
  figure(520, 802, 1.9, pose, { ...FORAGER, hair: 'long', seed: 21, prog: d, eyesShut: u < 2.3 });
}
function bones(t) {
  const t0 = T('b1') - 0.9, u = t - t0;
  const b2 = T('b2') - t0, b3 = T('b3') - t0;
  const [cx, cy, z] = track(u, [[0, 960, 580, 1.0], [b2 - 0.2, 960, 580, 1.0], [b2 + 1.2, 760, 600, 1.28], [b3 - 0.2, 760, 600, 1.28], [b3 + 1.4, 1160, 600, 1.28], [b3 + 5, 1160, 600, 1.28], [b3 + 6.2, 1206, 432, 3.4], [b3 + 9.2, 1206, 432, 3.4], [b3 + 10.4, 1195, 830, 2.3], [b3 + 14, 1195, 830, 2.3]]);
  cam(cx, cy, z);
  stroke([[-200, 942], [2200, 942]], { w: 2.6, col: SOFT, prog: pr(u, 0.2, 1), seed: 7 });
  glow(760, 600, 420, 'rgba(200,110,50,0.22)', pr(u, b2 + 0.6, 1.2) * (1 - pr(u, b3 + 1, 1)));
  const hL = 600, hR = 562;
  const Ls = S.skeleton(760, 940, hL, { prog: pr(u, 0.4, 3.4), seed: 200 });
  const Rs = S.skeleton(1180, 940, hR, { prog: pr(u, 1.3, 3.4), seed: 300, frail: 0.8, hunch: 0.6, cavities: pr(u, b3 + 6.6, 1.2), cracks: pr(u, b3 + 10.3, 0.8), arthritis: pr(u, b3 + 10.6, 1.0) });
  // Height lines.
  const hl = pr(u, b2 + 1.6, 1.2), hr = pr(u, b3 + 1.8, 1.2);
  line(500, 940, 500, 940 - hL - 6, { w: 2.4, col: SOFT, prog: hl, seed: 9 }); line(485, 940 - hL - 6, 515, 940 - hL - 6, { w: 2.4, col: SOFT, a: hl, seed: 10 });
  line(1440, 940, 1440, 940 - hR - 6, { w: 2.4, col: SOFT, prog: hr, seed: 11 }); line(1425, 940 - hR - 6, 1455, 940 - hR - 6, { w: 2.4, col: SOFT, a: hr, seed: 12 });
  if (hr > 0.9) { const gp = pr(u, b3 + 3.0, 1.0); stroke([[500, 940 - hL - 6], [1440, 940 - hL - 6]], { w: 1.8, col: OCHRE, prog: gp, seed: 13, ghost: false }); const box = [[1400, 940 - hL - 6], [1480, 940 - hL - 6], [1480, 940 - hR - 6], [1400, 940 - hR - 6]]; wash(box, OCHRE, 0.5 * gp, 3); }
  // A varied diet: hundreds of plants and animals, circling the forager.
  const food = ['leaf', 'fish', 'berries', 'nut', 'tuber', 'antelope', 'egg', 'honey'];
  food.forEach((k, i) => { const a = -2.6 + i * (2.2 / 7) * 1.0 - (i > 3 ? 0 : 0), ang = Math.PI + 0.5 - i * 0.43, x = 760 + Math.cos(ang) * 360, y = 520 + Math.sin(ang) * 330; void a; Pr.icon(k, x, y + 4 * Math.sin(t * 1.4 + i), 1.25, { prog: pr(u, b2 + 4.4 + i * 0.45, 0.6), seed: 70 + i * 3 }); });
  // Starchy grain by the farmer's jaw.
  for (let i = 0; i < 3; i++) Pr.wheat(1262 + i * 14, 470 + i * 6, 0.45, { prog: pr(u, b3 + 6.2 + i * 0.25, 0.6), sway: Math.sin(t + i) * 0.3, seed: 90 + i });
  void Ls; void Rs;
}
function grinding(t) {
  const t0 = T('b4') - 0.6, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 920, 640, 1.2], [4, 880, 690, 1.45], [10.5, 870, 700, 1.52]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.6);
  // Days passing: the sun runs its arc again and again.
  const dp = (u * 0.42) % 1, sx = lerp(260, 1660, dp), sy = 330 - Math.sin(dp * Math.PI) * 190;
  Pr.sun(sx, sy, 34, { a: d * Math.sin(dp * Math.PI) ** 0.4 });
  stroke([[-200, 820], [2200, 820]], { w: 3, prog: d, seed: 5 });
  for (let i = 0; i < 9; i++) Pr.grass(-40 + i * 250, 826, 1, { prog: d, seed: 40 + i });
  Pr.hut(1480, 820, 1.4, { prog: d, seed: 3 });
  const p = u * 2.6, pose = POSE.kneelGrind(p);
  const dry = figure(760, 820, 2.1, pose, { dry: true, face: 1 });
  Pr.quern(1015, 822, 1.6, 0, { prog: d, a: 1, noStone: true });
  const rs = circPts(dry.hand[0] + 16, 822 - 58, 40, 7, 0.05, 20); fill(rs, PAPER); wash(rs, GREY, 0.55, 5); stroke(rs, { w: 3, prog: d, seed: 71 });
  const f = figure(760, 820, 2.1, pose, { ...FARMER, hair: 'bun', tunic: GREY, seed: 31, prog: d });
  const m = pr(u, T('b4') - t0 + 3.4, 1.2);
  if (m > 0) [f.knees[1], f.feet[0], f.feet[1]].forEach((q, i) => { circle(q[0], q[1], 24, { w: 3, col: OCHRE, a: m, seed: 80 + i, over: 0.5 }); glow(q[0], q[1], 60, 'rgba(184,86,42,0.35)', m); });
}
function band(t) {
  const t0 = T('c1') - 0.9, u = t - t0;
  cam(900 + u * 55, 560, 1.05);
  savanna(t, { gy: 820, trees: [[700, 0.8], [1900, 0.95], [2600, 0.6]], tufts: 20, prog: pr(u, 0, 1.4) });
  const people = [[0, 'long', 1.8], [1, 'coil', 2.0], [2, 'long', 1.7], [3, 'coil', 1.25], [4, 'coil', 1.95]];
  people.forEach(([i, hair, s]) => {
    const x = 330 + i * 230 + u * 95 * (1 + (i % 2) * 0.03), p = u * 5.6 + i * 1.3;
    const f = figure(x, 822, s, POSE.walk(p), { ...FORAGER, hair, seed: 40 + i * 9, prog: pr(u, 0.2 + i * 0.12, 1.2) });
    if (i !== 3) line(f.hand[0] - 30, f.hand[1] + 70, f.hand[0] + 34, f.hand[1] - 90, { w: 3.4, seed: 50 + i, prog: pr(u, 0.8, 0.8) });
  });
}
function camp(t) {
  const t0 = T('c2') - 0.4, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 900, 560, 1.0], [7.3, 960, 540, 1.06]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.5);
  stroke([[-200, 840], [2200, 840]], { w: 3, prog: d, seed: 5 });
  Pr.hills(700, { seed: 5, prog: d, a: 0.7 });
  Pr.hut(250, 842, 1.5, { prog: d, seed: 4 }); Pr.hut(560, 842, 1.2, { prog: d, seed: 5 }); Pr.hut(820, 842, 1.35, { prog: d, seed: 6 });
  Pr.embers(640, 850, 1.0, t, { a: d }); Pr.smoke(640, 835, t, { a: d * 0.6, h: 150 });
  figure(470, 842, 1.35, POSE.sitKnees(t), { ...FORAGER, hair: 'long', seed: 61, prog: d });
  figure(780, 842, 1.35, POSE.sitKnees(t + 1), { ...FORAGER, seed: 62, prog: d, face: -1 });
  // The anthropologist on a stool, counting.
  line(1085, 842, 1115, 780, { w: 3, prog: d, seed: 66 }); line(1145, 842, 1115, 780, { w: 3, prog: d, seed: 67 }); line(1080, 778, 1150, 778, { w: 3.4, prog: d, seed: 68 });
  const who = figure(1115, 778, 1.7, { ...POSE.sitKnees(0), tB: 1.5, sB: -1.45, tF: 1.5, sF: -1.5, chair: true, aF: 0.8, fF: 1.2, neck: 0.45, lean: 0.25 }, { hair: 'hat', shirt: GREY, trousers: GREY, seed: 63, prog: d });
  const nb = [[who.hand[0] - 34, who.hand[1] - 6], [who.hand[0] + 30, who.hand[1] - 16], [who.hand[0] + 36, who.hand[1] + 8], [who.hand[0] - 28, who.hand[1] + 18]];
  fill(nb, PAPER); stroke([...nb, nb[0]], { w: 2.6, prog: d, seed: 69 });
  // A close-up of the notebook: tallies piling up.
  const k = pr(u, 1.4, 0.8);
  if (k > 0) { g.save(); g.globalAlpha = k; Pr.notebook(1500, 330, 560, Math.floor(lin(u, 1.8, 7.0) * 22), { prog: k }); g.restore(); }
}
function week(t) {
  const t0 = T('c3') - 0.4, u = t - t0, B = 30;
  const [cx, cy, z] = track(u, [[0, 960, 540, 1.0], [11, 960, 560, 1.03]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.2);
  for (let i = 0; i < 7; i++) Pr.sun(470 + i * 205, 120, 22, { a: pr(u, 0.2 + i * 0.12, 0.4) });
  // Forager row: food hours (ochre), then tools and chores (hatched) on top.
  const food = [3, 2, 3, 2, 3, 2, 2], chores = [3, 4, 3, 4, 3, 4, 4];
  const work = [8, 8, 8, 8, 8, 0, 0], ours = [3, 3, 3, 3, 3, 5, 5];
  figure(170, 475, 1.05, POSE.dig(t * 1.5), { ...FORAGER, seed: 91, prog: d });
  figure(170, 955, 1.05, POSE.type(t), { ...MODERN, seed: 92, prog: d });
  line(130, 955, 245, 955, { w: 2.4, prog: d, seed: 93 }); line(185, 955, 185, 905, { w: 2.4, prog: d, seed: 94 });
  stroke([[340, 478], [1850, 478]], { w: 2.6, prog: d, seed: 95 }); stroke([[340, 958], [1850, 958]], { w: 2.6, prog: d, seed: 96 });
  const block = (x, y, i, kind, a) => { if (a <= 0) return; const q = [[x, y - B + 3], [x + B * 2.6, y - B + 3], [x + B * 2.6, y], [x, y]]; fill(q, PAPER, a); if (kind === 'food') wash(q, OCHRE, 0.55 * a, i); if (kind === 'work') wash(q, SOFT, 0.5 * a, i); stroke([...q, q[0]], { w: 2, a, seed: 700 + i, ghost: false, jit: 0.6, wob: 0.6 }); if (kind === 'chore') hatch(q, { gap: 6, a: 0.45 * a, seed: 800 + i }); };
  const cF = T('c3') - t0 + 0.2, cC = T('c3') - t0 + 4.0, cW = T('c3') - t0 + 7.8;
  for (let dd = 0; dd < 7; dd++) {
    const x = 400 + dd * 205; let y = 476, n = 0;
    for (let i = 0; i < food[dd]; i++, n++) { block(x, y, dd * 20 + n, 'food', pr(u, cF + (dd * 3 + i) * 0.1, 0.25)); y -= B; }
    for (let i = 0; i < chores[dd]; i++, n++) { block(x, y, dd * 20 + n, 'chore', pr(u, cC + (dd * 4 + i) * 0.07, 0.25)); y -= B; }
    y = 956; n = 0;
    for (let i = 0; i < work[dd]; i++, n++) { block(x, y, 300 + dd * 20 + n, 'work', pr(u, cW + (dd * 8 + i) * 0.03, 0.2)); y -= B; }
    for (let i = 0; i < ours[dd]; i++, n++) { block(x, y, 300 + dd * 20 + n, 'chore', pr(u, cW + 1.6 + (dd * 5 + i) * 0.04, 0.2)); y -= B; }
  }
}
function together(t) {
  const t0 = E('c3') - 4.3, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 960, 560, 1.0], [6, 980, 580, 1.08]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.2);
  savanna(t, { gy: 830, trees: [[1650, 1.0]], tufts: 12, prog: d });
  const a = figure(560, 832, 2.0, POSE.dig(t * 3), { ...FORAGER, hair: 'long', seed: 101, prog: d });
  line(a.hand[0] - 10, a.hand[1] - 40, a.hand[0] + 30, a.hand[1] + 100, { w: 3.6, seed: 102, prog: d });
  Pr.icon('tuber', a.hand[0] + 60, 846, 1.2, { prog: pr(u, 1.2, 0.6) });
  figure(860, 832, 2.1, POSE.give(0.3 + 0.1 * Math.sin(t * 2)), { ...FORAGER, seed: 103, prog: d, face: -1, smile: 0.8 });
  figure(1120, 832, 1.3, POSE.walk(t * 6), { ...FORAGER, seed: 104, prog: d });
  const b = figure(1330, 832, 2.0, POSE.walk(t * 3.2), { ...FORAGER, hair: 'long', seed: 105, prog: d, face: -1, smile: 0.7 });
  const bag = circPts(b.handB[0] + 30, b.handB[1] + 40, 38, 5, 0.05, 30); fill(bag, PAPER); wash(bag, OCHRE, 0.35, 5); stroke(bag, { w: 2.8, prog: d, seed: 106 });
  // Talk: scribbled speech between them.
  [[700, 340, 190, 110, [790, 430]], [1060, 300, 170, 100, [900, 420]], [1420, 360, 150, 90, [1360, 470]]].forEach(([x, y, w, h, tail], i) => { const k = pr(u, 0.8 + i * 0.7, 0.4); if (k <= 0) return; Pr.bubble(x, y, w, h, tail, { prog: k, seed: 110 + i }); for (let j = 0; j < 3; j++) { const pts = []; for (let q = 0; q <= 12; q++) pts.push([x - w * 0.32 + q * w * 0.053, y - h * 0.2 + j * h * 0.2 + 5 * Math.sin(q * 1.8 + j + t * 3)]); stroke(pts, { w: 1.8, a: k, seed: 120 + i * 4 + j, ghost: false }); } });
}
function maker(t) {
  const t0 = T('d1') - 0.9, u = t - t0, d2 = T('d2') - t0;
  const [cx, cy, z] = track(u, [[0, 900, 580, 1.0], [d2 - 0.3, 880, 600, 1.1], [d2 + 0.8, 1045, 740, 2.7], [d2 + 3.6, 1055, 740, 2.8]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.4);
  savanna(t, { gy: 820, trees: [[760, 1.2]], tufts: 10, prog: d });
  const f = figure(880, 822, 2.0, POSE.sitCross(t * 2), { ...FORAGER, hair: 'long', seed: 131, prog: d });
  // Shell beads: a string from her hands, the shells threading on one at a time.
  const hx = f.hand[0], hy = f.hand[1], n = Math.floor(pr(u, d2 + 0.4, 2.6) * 12);
  const str = []; for (let i = 0; i <= 20; i++) { const k = i / 20; str.push([hx + k * 190, hy + 18 + Math.sin(k * Math.PI) * 70]); }
  stroke(str, { w: 1.2, col: SOFT, prog: pr(u, 1.2, 1.0), seed: 132, ghost: false });
  for (let i = 0; i < n; i++) { const k = 0.06 + i * 0.075, x = hx + k * 190, y = hy + 18 + Math.sin(k * Math.PI) * 70; Pr.shell(x, y, 8.5, i * 0.9, { a: 1 }); }
  if (u < d2) for (let i = 0; i < 5; i++) Pr.shell(hx - 50 + i * 12, 826 - 4, 6, i, { a: d });
}
function flutePlayer(t) {
  const t0 = T('d2') + 3.6, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 1000, 560, 1.5], [4, 960, 580, 1.35]]);
  cam(cx, cy, z);
  const d = pr(u, 0.05, 1.0);
  stroke([[-200, 820], [2200, 820]], { w: 3, prog: d, seed: 5 });
  for (let i = 0; i < 8; i++) Pr.grass(300 + i * 200, 826, 1.1, { prog: d, seed: 150 + i });
  const f = figure(900, 822, 2.1, POSE.flute(t), { ...FORAGER, seed: 141, prog: d });
  const m = [f.head[0] + f.hr * 1.0, f.head[1] + f.hr * 0.55], dx = f.hand[0] - m[0], dy = f.hand[1] - m[1], L = Math.hypot(dx, dy);
  const tip = [m[0] + dx / L * 190, m[1] + dy / L * 190];
  Pr.flute(m[0], m[1], tip[0], tip[1], 7, { prog: pr(u, 0.2, 1.2), holes: 5 });
  Pr.soundWaves(tip[0] + 10, tip[1] - 10, t, { a: pr(u, 1.2, 0.8) });
}
function sharing(t) {
  const t0 = T('d3') - 0.6, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 960, 560, 1.0], [8.5, 960, 560, 1.06]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.3), N = 7, R = 320, cy0 = 520;
  const pos = Array.from({ length: N }, (_, i) => { const a = -Math.PI / 2 + i / N * TAU; return [960 + Math.cos(a) * R * 1.35, cy0 + Math.sin(a) * R * 0.95 + 150]; });
  // The web: everyone linked to everyone.
  let e = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++, e++) stroke([[pos[i][0], pos[i][1] - 140], [pos[j][0], pos[j][1] - 140]], { w: 1.8, col: OCHRE, a: 0.55, prog: pr(u, 1.0 + e * 0.07, 0.4), seed: 900 + e, ghost: false });
  const fail = T('d3') - t0 + 4.2;
  pos.forEach(([x, y], i) => {
    const sad = i === 3 && u > fail;
    const pose = sad ? { ...POSE.stand(), neck: 0.4, lean: 0.12, aF: 0.2, fF: 0.2 } : POSE.stand();
    const f = figure(x, y, 1.65, pose, { ...FORAGER, hair: i % 2 ? 'long' : 'coil', seed: 160 + i * 7, prog: d, face: x < 960 ? 1 : -1, smile: sad ? -0.8 : 0.4 });
    if (sad) stroke(arcPts(f.hand[0] + (x < 960 ? 20 : -20), f.hand[1] + 30, 50, 0.6, 2.6), { w: 2.6, seed: 170, prog: pr(u, fail, 0.4) });
  });
  // Meat passes along the web: first from the hunter outward, then back to the one whose hunt failed.
  const hop = (a, b, k) => { const [x0, y0] = pos[a], [x1, y1] = pos[b]; Pr.meat(lerp(x0, x1, ease(k)), lerp(y0, y1, ease(k)) - 150 - Math.sin(k * Math.PI) * 40, 1.2, { a: 1 }); };
  const route = [[0, 2], [0, 5], [2, 4], [5, 1]];
  route.forEach(([a, b], i) => { const k = pr(u, 1.8 + i * 0.6, 0.6); if (k > 0 && k < 1) hop(a, b, k); });
  [[1, 3], [4, 3]].forEach(([a, b], i) => { const k = pr(u, fail + 1.2 + i * 0.7, 0.8); if (k > 0) hop(a, b, Math.min(k, 0.999)); });
}
function dayTalk(t) {
  const t0 = T('d4') - 0.6, u = t - t0, end = T('d5') - 0.3 - t0;
  const [cx, cy, z] = track(u, [[0, 960, 560, 1.0], [end, 960, 580, 1.05]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.3), set = pr(u, end - 2.4, 2.2);
  Pr.sun(1500, lerp(200, 760, ease(set)), 50, { a: 1, rays: 1 - set });
  const hl = Pr.hills(700, { seed: 7, prog: d, a: 0.8 }); fill([...hl, [2200, 1400], [-200, 1400]], PAPER); Pr.hills(700, { seed: 7, prog: d, a: 0.8 });
  Pr.ground(840, { prog: d });
  figure(330, 842, 1.7, POSE.give(0.5 + 0.2 * Math.sin(t * 3)), { ...FORAGER, seed: 181, prog: d, smile: 0.3 });
  figure(560, 842, 1.7, POSE.stand(), { ...FORAGER, hair: 'long', seed: 182, prog: d, face: -1 });
  figure(1000, 842, 1.6, POSE.sitKnees(t), { ...FORAGER, hair: 'long', seed: 183, prog: d });
  figure(1180, 842, 1.7, { ...POSE.give(0.6 + 0.3 * Math.sin(t * 5)), neck: -0.1 }, { ...FORAGER, seed: 184, prog: d, face: -1, smile: -0.6 });
  // The listener with her notebook.
  const w = figure(1640, 842, 1.75, { ...POSE.stand(), aF: 0.7, fF: 1.3, neck: 0.1 }, { hair: 'bun', shirt: GREY, trousers: GREY, seed: 185, prog: d, face: -1 });
  const nb = [[w.hand[0] - 30, w.hand[1] - 20], [w.hand[0] + 10, w.hand[1] - 26], [w.hand[0] + 14, w.hand[1] + 16], [w.hand[0] - 26, w.hand[1] + 22]]; fill(nb, PAPER); stroke([...nb, nb[0]], { w: 2.6, prog: d, seed: 186 });
  // Bubbles: land, food, complaints.
  const b1 = pr(u, 2.0, 0.4), b2 = pr(u, 3.2, 0.4), b3 = pr(u, 4.4, 0.4);
  if (b1 > 0) { Pr.bubble(420, 430, 230, 150, [400, 560], { prog: b1, seed: 190 }); stroke([[330, 470], [380, 420], [430, 450], [500, 400]], { w: 2.4, a: b1, seed: 191 }); for (let i = 0; i < 4; i++) line(340 + i * 45, 480, 340 + i * 45, 455, { w: 2, a: b1, seed: 192 + i, col: SOFT }); }
  if (b2 > 0) { Pr.bubble(1000, 470, 200, 140, [1000, 600], { prog: b2, seed: 195 }); Pr.icon('tuber', 980, 470, 1.3, { prog: b2 }); Pr.icon('nut', 1045, 450, 0.8, { prog: b2 }); }
  if (b3 > 0) { Pr.bubble(1230, 420, 190, 140, [1200, 560], { prog: b3, seed: 197 }); const sp = []; for (let i = 0; i < 40; i++) { const a = i * 0.55; sp.push([1230 + Math.cos(a) * (8 + i * 1.3) + 6 * Math.sin(i * 3), 420 + Math.sin(a) * (6 + i * 1.0)]); } stroke(sp, { w: 2.2, a: b3, seed: 198 }); }
  if (set > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(29,26,24,${0.86 * set})`; g.fillRect(0, 0, W, H); g.restore(); }
}
function night(t) {
  const t0 = T('d5') - 0.3, u = t - t0;
  S.paper(0.86);
  const [cx, cy, z] = track(u, [[0, 960, 600, 1.0], [7, 960, 560, 1.1]]);
  cam(cx, cy, z);
  const CH = '#efe3c6', dk = '#1b1714', a = pr(u, 0.1, 1.0);
  for (let i = 0; i < 40; i++) { const x = (i * 197) % 1900 + 10, y = (i * 83) % 300 + 20; g.save(); g.globalAlpha = a * (0.4 + 0.3 * Math.sin(t * 2 + i)); g.fillStyle = CH; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); g.restore(); }
  S.stroke([[-200, 860], [2200, 860]], { w: 2, col: '#5c5046', a, seed: 5 });
  figure(985, 846, 1.6, { ...POSE.tell(t * 1.5), sit: false, tB: -0.08, sB: 0, tF: 0.1, sF: -0.05 }, { hair: 'coil', body: dk, ink: '#0b0908', backInk: '#0b0908', face: 1, seed: 230, a: a * 0.95 });
  Pr.fire(960, 860, 1.25, t, { a, logs: '#0e0c0a', glowR: 520 });
  const people = [[560, 1, 'long'], [740, 1, 'coil'], [1180, -1, 'coil'], [1370, -1, 'long']];
  people.forEach(([x, f, hair], i) => figure(x, 862, 1.8, POSE.sitKnees(t + i), { hair, body: dk, ink: '#0b0908', backInk: '#0b0908', face: f, seed: 210 + i * 5, a }));
  // The story, drawn in chalk light in the smoke.
  const sk = pr(u, 1.2, 1.4);
  if (sk > 0) {
    g.save(); g.globalAlpha = 0.9;
    const ox = 700 + Math.sin(t * 0.4) * 10, oy = 300;
    Pr.icon('antelope', ox, oy, 3.2, { prog: sk, seed: 240, col: CH });
    g.restore();
    const hun = figure(1250, 400, 1.3, POSE.bow(1), { body: 'rgba(0,0,0,0)', ink: CH, backInk: CH, seed: 250, prog: pr(u, 2.0, 1.4), a: 0.85 });
    stroke(arcPts(hun.hand[0] + 6, hun.hand[1], 70, -1.2, 1.2, 70), { w: 2.4, col: CH, prog: pr(u, 3.0, 0.6), seed: 251 });
    stroke(arcPts(1560, 180, 44, -2.4, 2.4), { w: 2.4, col: CH, prog: pr(u, 3.0, 0.8), seed: 252 });
  }
}
const GEO = (pts) => pts.map(([lo, la]) => [(lo - 8) * 38.4, (45.5 - la) * 38.4]);
const MED = GEO([[8, 44.4], [8.9, 44.4], [10.3, 43.5], [11.1, 42.5], [12.5, 41.7], [14.3, 40.8], [15, 40.3], [15.7, 39.3], [15.6, 38], [16.6, 39.1], [17.2, 40.5], [18.5, 40.1], [15.9, 41.6], [14.3, 42.2], [13.6, 43.5], [12.3, 44.3], [12.4, 45.4], [13.7, 45.6], [14.5, 45.3], [16, 43.5], [18.6, 42.6], [19.5, 42], [19.6, 41.2], [20.7, 39.5], [21.1, 38.3], [21.7, 36.8], [22.5, 36.4], [23.2, 37.5], [24, 38], [23, 39.2], [22.6, 40.5], [23.8, 40.7], [26, 40.8], [26.2, 40.1], [26.6, 39.5], [26.8, 38.5], [27.3, 37.8], [27.5, 37], [28, 36.8], [29.5, 36.3], [31, 36.8], [33, 36.2], [35, 36.8], [36.1, 36.6], [35.9, 35.5], [35.5, 34.5], [35.2, 33.5], [34.9, 32.5], [34.3, 31.3], [32.3, 31.2], [31, 31.5], [29.5, 31], [25, 31.6], [23, 32.6], [20, 32], [19, 30.5], [15, 32.3], [11, 33.5], [10, 37], [8, 37.5]]);
const BLACK = GEO([[28, 41.2], [29.5, 41.2], [31.5, 41.3], [34, 42], [36, 41.7], [38, 41], [40, 41], [41.5, 41.5], [41.6, 42.5], [40, 43.5], [38, 44.5], [37.3, 45.3], [36.5, 45.3], [35, 45], [33.5, 44.5], [32.5, 45.4], [33.5, 46], [31, 46.6], [30, 45.8], [29.6, 45.2], [28.8, 44.5], [28, 43.5], [27.9, 42.5]]);
const CASP = GEO([[47, 45], [49.5, 46.2], [51.5, 46.5], [53, 45.5], [52.8, 42], [53, 40], [53.9, 38], [54, 37.2], [51, 36.8], [49, 37.5], [48.8, 38.5], [49.5, 40.2], [50.3, 40.4], [49, 41.5], [48, 42.5], [47.5, 43.5]]);
const RED = GEO([[34.9, 29.5], [35.5, 28], [36.5, 26], [38.1, 24], [39.2, 21.5], [40.5, 19], [41.5, 17], [39.3, 16.5], [38.5, 18.2], [37.2, 21], [35.7, 23.9], [34.5, 25.8], [33.6, 27.2], [32.5, 29.9], [33.6, 28.3]]);
const GULF = GEO([[47.9, 30.2], [48.9, 30], [50.3, 29.3], [51.4, 27.9], [53, 27], [55, 26.8], [56.3, 27.2], [57.5, 25.8], [56.2, 26.1], [55.5, 25.5], [54, 24.2], [52, 24], [51.5, 25.3], [51.2, 26.1], [50.6, 25.4], [50, 26.5], [49, 27.5], [48.4, 28.5]]);
const ISLES = [GEO([[32.3, 35], [33, 35.3], [34.6, 35.6], [34, 35], [33, 34.6]]), GEO([[23.5, 35.3], [24.5, 35.4], [26.3, 35.1], [25.5, 35], [24, 35.1]]), GEO([[12.4, 38.1], [15.6, 38.3], [15.1, 36.7], [12.5, 37.6]])];
const NILE = GEO([[31, 31.5], [31.2, 30], [31, 28.5], [30.8, 27], [32.5, 26], [32.9, 24], [32.5, 22], [31.5, 21], [30.5, 19], [30.8, 16.5]]);
const TIGRIS = GEO([[42.5, 37.5], [43.1, 36.3], [43.7, 34.9], [44.4, 33.3], [45.8, 32.5], [47.1, 31.1], [47.9, 30.2]]);
const EUPHR = GEO([[39, 39.5], [38.4, 37.5], [38.3, 36.8], [38.9, 35.9], [40.1, 35.2], [41, 34.4], [43.2, 33.4], [44.3, 32.5], [45.5, 31.5], [46.5, 31], [47.9, 30.2]]);
const CRESCENT = smooth(GEO([[35.4, 31.3], [35.9, 32.8], [36.3, 34.2], [36.6, 35.6], [37.4, 36.7], [39, 37.3], [41, 37.3], [43, 36.8], [44.5, 35.5], [45.8, 34.1], [46.8, 32.6], [47.6, 31.2]]), 3);
function map(t) {
  const t0 = T('e1') - 1.0, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 960, 540, 1.0], [3.5, 1330, 540, 1.35], [7.5, 1340, 530, 1.42]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.8);
  [MED, BLACK, CASP, RED, GULF].forEach((sea, i) => { const pts = smooth(sea, 1, true); wash(pts, GREY, 0.3 * d, 3 + i); stroke([...pts, pts[0]], { w: 2.8, prog: d, seed: 330 + i, step: 10 }); });
  ISLES.forEach((isl, i) => { const pts = smooth(isl, 2, true); fill(pts, PAPER, d); stroke([...pts, pts[0]], { w: 2.2, prog: d, seed: 340 + i }); });
  [NILE, TIGRIS, EUPHR].forEach((r, i) => stroke(smooth(r, 2), { w: 2.4, col: SOFT, prog: pr(u, 0.9 + i * 0.2, 1.4), seed: 350 + i }));
  // Mountains: the Taurus and the Zagros that ring the crescent.
  const mtn = GEO([[33, 37.4], [34.5, 37.6], [36, 38], [37.5, 38.3], [39.5, 38.6], [41.5, 38.4], [43.5, 37.8], [45, 36.8], [46.2, 35.4], [47.3, 34], [48.5, 32.6], [49.8, 31.2]]);
  mtn.forEach(([x, y], i) => stroke([[x - 16, y + 10], [x, y - 12], [x + 16, y + 10]], { w: 2, col: SOFT, prog: pr(u, 1.2 + i * 0.06, 0.3), seed: 360 + i, ghost: false }));
  // The Fertile Crescent, washed on in ochre.
  const k = pr(u, 1.6, 3.0), n = Math.max(2, Math.floor(CRESCENT.length * k));
  g.save(); g.globalCompositeOperation = 'multiply'; g.strokeStyle = 'rgba(184,86,42,0.42)'; g.lineWidth = 58; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < n; i++) (i ? g.lineTo(CRESCENT[i][0], CRESCENT[i][1]) : g.moveTo(CRESCENT[i][0], CRESCENT[i][1])); if (k > 0) g.stroke(); g.restore();
  for (let i = 0; i < 14; i++) { const q = CRESCENT[Math.floor(i / 13 * (CRESCENT.length - 1))]; Pr.wheat(q[0] + hn2(i) * 20, q[1] + 22 + hn2(i + 9) * 12, 0.42, { prog: pr(u, 4.4 + i * 0.1, 0.5), sway: Math.sin(t * 1.5 + i) * 0.3, seed: 320 + i }); }
}
const hn2 = (i) => S.hn(i, 77);
function multiply(t) {
  const t0 = T('e2') - 0.5, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 960, 620, 1.25], [4.5, 960, 560, 0.95]]);
  cam(cx, cy, z);
  const d = pr(u, 0.05, 1.0);
  stroke([[-400, 860], [2400, 860]], { w: 3, prog: d, seed: 5 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 26; i++) Pr.wheat(-300 + i * 95 + r * 30, 1000 + r * 50, 0.8, { prog: d, sway: Math.sin(t * 1.3 + i + r) * 0.3, seed: 400 + r * 30 + i });
  const gen = [[0, 2], [0.9, 4], [1.8, 8], [2.7, 16]];
  let shown = 0;
  gen.forEach(([at, n]) => { if (u > at) shown = n; });
  const r = rng(12);
  for (let i = 0; i < 16; i++) {
    const row = i < 2 ? 0 : i < 4 ? 1 : i < 8 ? 2 : 3, x = 960 + (i % 2 ? 1 : -1) * (60 + (Math.floor(i / 2) % 4) * 150 + row * 20) + (r() - 0.5) * 40, y = 860 - row * 0, s = 1.6 - row * 0.12;
    const ap = i < shown ? pr(u, gen.find(([, n]) => i < n)[0], 0.4) : 0;
    if (ap > 0) figure(x, y, s, POSE.stand(), { ...FARMER, hair: r() < 0.5 ? 'bun' : 'short', seed: 420 + i * 3, prog: ap, face: x < 960 ? 1 : -1 });
  }
}
function cycle(t) {
  const t0 = T('e3') - 0.5, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 960, 540, 1.0], [8, 960, 540, 1.04]]);
  cam(cx, cy, z);
  const R = 360, C = [960, 520], at = (i) => { const a = -Math.PI / 2 + i / 5 * TAU; return [C[0] + Math.cos(a) * R * 1.35, C[1] + Math.sin(a) * R]; };
  const word = [1.2, 1.9, 2.6, 3.4, 4.3].map((v) => v + 0.5);
  // Arrows round the circle, then a pulse chasing round, faster and faster.
  for (let i = 0; i < 5; i++) {
    const a0 = -Math.PI / 2 + i / 5 * TAU + 0.34, a1 = -Math.PI / 2 + (i + 1) / 5 * TAU - 0.34, k = pr(u, word[i] + 0.3, 0.5);
    const ar = arcPts(C[0], C[1], R * 1.35, a0, a1, R); stroke(ar, { w: 3, col: SOFT, prog: k, seed: 500 + i });
    if (k >= 1) { const e = ar[ar.length - 1], pv = ar[ar.length - 3], ang = Math.atan2(e[1] - pv[1], e[0] - pv[0]); [0.5, -0.5].forEach((s, j) => line(e[0], e[1], e[0] - Math.cos(ang + s) * 22, e[1] - Math.sin(ang + s) * 22, { w: 3, col: SOFT, seed: 510 + i * 2 + j })); }
  }
  const spin = u > word[4] + 0.8 ? (u - word[4] - 0.8) ** 1.6 * 0.5 : -1;
  if (spin >= 0) { const a = -Math.PI / 2 + spin * TAU; glow(C[0] + Math.cos(a) * R * 1.35, C[1] + Math.sin(a) * R, 70, 'rgba(184,86,42,0.55)', 1); }
  const P5 = [
    (x, y, p) => { const f = figure(x, y, 1.05, POSE.sow(t * 3), { ...FARMER, seed: 530, prog: p }); for (let i = 0; i < 5; i++) { const ph = (t * 1.2 + i * 0.2) % 1; g.save(); g.globalAlpha = p; g.fillStyle = OCHRE; g.beginPath(); g.arc(f.hand[0] + i * 6, f.hand[1] + ph * 90, 3, 0, TAU); g.fill(); g.restore(); } },
    (x, y, p) => { figure(x, y, 1.05, POSE.dig(t * 3), { ...FARMER, hair: 'bun', seed: 540, prog: p }); for (let i = 0; i < 3; i++) Pr.grass(x + 50 + i * 16, y + 2, 0.7, { prog: p, seed: 541 + i }); },
    (x, y, p) => { const f = figure(x, y, 1.05, POSE.carryPots(t * 3), { ...FARMER, seed: 550, prog: p }); const pot = circPts(f.head[0], f.head[1] - f.hr * 2.1, 20, 551, 0.05, 16); fill(pot, PAPER); wash(pot, OCHRE, 0.4, 3); stroke(pot, { w: 2.4, prog: p, seed: 552 }); },
    (x, y, p) => { const f = figure(x, y, 1.05, POSE.reap(t * 3), { ...FARMER, hair: 'bun', seed: 560, prog: p }); stroke(arcPts(f.hand[0] + 12, f.hand[1] + 6, 20, -2.2, 0.6), { w: 2.6, prog: p, seed: 561 }); for (let i = 0; i < 3; i++) Pr.wheat(x + 60 + i * 14, y, 0.5, { prog: p, seed: 562 + i }); },
    (x, y, p) => { const f = figure(x, y, 1.05, POSE.guard(t), { ...FARMER, seed: 570, prog: p }); line(f.hand[0], f.hand[1] + 70, f.hand[0], f.hand[1] - 110, { w: 3, prog: p, seed: 571 }); stroke([[f.hand[0] - 7, f.hand[1] - 100], [f.hand[0], f.hand[1] - 125], [f.hand[0] + 7, f.hand[1] - 100]], { w: 2.4, prog: p, seed: 572 }); Pr.birds(x + 60 + (t * 30) % 60, y - 200, t, { n: 2, a: p }); },
  ];
  P5.forEach((fn, i) => { const [x, y] = at(i); const p = pr(u, word[i] - 0.3, 0.6); if (p > 0) { stroke([[x - 80, y + 72], [x + 80, y + 72]], { w: 2, col: SOFT, prog: p, seed: 580 + i }); fn(x, y + 70, p); } });
  figure(960, 640, 1.7, { ...POSE.hold(), neck: 0.35, lean: 0.15, aF: 0.2, fF: 0.3, aB: 0.1, fB: 0.3 }, { ...FARMER, seed: 590, prog: pr(u, 0.2, 1.0), smile: -0.5 });
}
function fenced(t) {
  const t0 = T('e4') - 0.5, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 960, 600, 1.2], [6.2, 960, 560, 0.9]]);
  cam(cx, cy, z);
  const d = pr(u, 0.05, 1.0);
  stroke([[-400, 840], [2400, 840]], { w: 3, prog: d, seed: 5 });
  const mh = [[800, 840], [800, 700], [960, 640], [1120, 700], [1120, 840]]; fill(mh, PAPER); wash(mh, GREY, 0.35, 3); stroke(mh, { w: 3, prog: d, seed: 610 }); fill([[930, 840], [930, 760], [990, 760], [990, 840]], INK, 0.75 * d);
  figure(700, 842, 1.7, POSE.stand(), { ...FARMER, hair: 'bun', seed: 620, prog: d });
  figure(1210, 842, 1.8, POSE.guard(t), { ...FARMER, seed: 621, prog: d, face: -1 });
  figure(600, 842, 1.1, POSE.stand(), { ...FARMER, seed: 622, prog: d });
  Pr.fence(420, 1500, 842, 120, { prog: pr(u, 0.8, 1.8) });
  // The wheat grows up, taller than the people, like bars.
  const gr = ease(pr(u, 1.8, 2.8));
  for (let i = 0; i < 34; i++) { const x = -200 + i * 70, y = 900 + (i % 2) * 20; if (gr > 0) Pr.wheat(x, y, 0.8 + gr * 3.2, { prog: 1, sway: Math.sin(t + i) * 0.2, seed: 640 + i, a: 0.95 }); }
}
function office(t) {
  const t0 = T('f1') - 1.0, u = t - t0, dream = T('f1') - t0 + 4.3;
  const [cx, cy, z] = track(u, [[0, 1080, 620, 1.2], [dream, 1040, 580, 1.1], [dream + 1.5, 900, 520, 1.0]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.3);
  stroke([[-200, 880], [2200, 880]], { w: 3, prog: d, seed: 5 });
  const sp = lerp(0.5, 10, pr(u, 1, 12));
  Pr.clockFace(1480, 230, 70, { prog: d, hour: (t * sp / 60) % 12, min: (t * sp) % 60 });
  Pr.windowFrame(1650, 360, 200, 250, { prog: d });
  Pr.desk(1260, 880, 1.2, { prog: d });
  Pr.chair(1010, 880, 1.2, { prog: d });
  const dk = ease(pr(u, dream, 1.2));
  figure(1010, 772, 1.9, mixPose(POSE.type(t), POSE.slump(t), dk), { ...MODERN, seed: 700, prog: d, eyesShut: dk > 0.6 });
  // The daydream.
  const b = pr(u, dream + 0.3, 1.0);
  if (b > 0) {
    Pr.bubble(560, 330, 820, 400, [930, 600], { prog: b, seed: 710, thought: true });
    const w = T('f1') - t0 + 7.6, m = T('f1') - t0 + 8.8, f = T('f1') - t0 + 10.0;
    g.save(); g.beginPath(); g.ellipse(560, 330, 400, 190, 0, 0, TAU); g.clip();
    const k1 = pr(u, w - 0.8, 0.8), k2 = pr(u, m - 0.3, 0.8), k3 = pr(u, f - 0.6, 0.8);
    if (k1 > 0) { stroke(smooth([[250, 440], [330, 390], [420, 420]], 2), { w: 2.4, prog: k1, seed: 720 }); figure(300 + (t * 20) % 80, 410, 0.8, POSE.walk(t * 5), { ...FORAGER, seed: 721, prog: k1 }); }
    if (k2 > 0) { const hx = 540, hy = 360; for (let i = 0; i < 6; i++) Pr.shell(hx - 40 + i * 16, hy + Math.sin(i * 0.6) * 8, 6, i, { a: k2 }); stroke(arcPts(hx, hy - 10, 52, 0.2, 2.9, 30), { w: 1.2, a: k2, seed: 722, col: SOFT }); }
    if (k3 > 0) { Pr.fire(760, 420, 0.4, t, { a: k3, glowR: 200 }); figure(690, 422, 0.75, POSE.sitKnees(t), { ...FORAGER, seed: 723, prog: k3 }); figure(830, 422, 0.75, POSE.tell(t * 2), { ...FORAGER, hair: 'long', seed: 724, prog: k3, face: -1 }); }
    g.restore();
  }
}
function danger(t) {
  const t0 = T('f2') - 0.6, u = t - t0, kids = T('f2') - t0 + 3.1;
  const [cx, cy, z] = track(u, [[0, 820, 580, 1.0], [kids - 0.3, 900, 580, 1.0], [kids + 1.4, 1330, 640, 1.35]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.2);
  const sky = [[-300, 0], [2400, 0], [2400, 420], [-300, 420]];
  hatch(sky, { gap: 10, ang: -1.1, a: 0.3 * d, seed: 750, w: 1.3 });
  for (let i = 0; i < 3; i++) { const x = 300 + i * 600 + (t * 12) % 60; const cl = smooth([[x - 160, 190], [x - 110, 120], [x, 100], [x + 110, 125], [x + 170, 180]], 2, true); fill(cl, PAPER, 0.8); wash(cl, SOFT, 0.45 * d, i); stroke(cl, { w: 2.4, prog: d, seed: 760 + i }); }
  Pr.ground(820, { prog: d });
  Pr.lion(360, 822, 1.4, t, { a: d });
  for (let i = 0; i < 16; i++) Pr.grass(160 + i * 26, 826 + (i % 2) * 6, 1.5, { prog: d, seed: 770 + i });
  for (let i = 0; i < 3; i++) figure(880 + i * 120 + u * 25, 822, 1.1, POSE.walk(u * 5 + i), { ...FORAGER, hair: i === 1 ? 'long' : 'coil', seed: 780 + i * 5, prog: d });
  Pr.cairn(1300, 824, 1.3, { prog: pr(u, 0.6, 1), flower: pr(u, kids + 0.8, 0.8) });
  figure(1480, 822, 1.8, { ...POSE.hold(), neck: 0.6, lean: 0.12 }, { ...FORAGER, hair: 'long', seed: 790, prog: pr(u, kids - 0.4, 1.0), face: -1, eyesShut: true });
}
function ending(t) {
  const t0 = T('f3') - 0.6, u = t - t0;
  const [cx, cy, z] = track(u, [[0, 1100, 640, 1.3], [10, 980, 580, 1.0], [16, 960, 560, 0.94]]);
  cam(cx, cy, z);
  const d = pr(u, 0.1, 1.6), sy = lerp(520, 740, ease(pr(u, 0, 15)));
  Pr.sun(1450, sy, 80, { a: 1, rays: 0.6 });
  const hill = smooth([[-300, 820], [300, 800], [700, 700], [1000, 650], [1250, 690], [1700, 780], [2300, 820]], 3);
  Pr.hills(760, { seed: 9, prog: d, a: 0.6 });
  fill([...hill, [2300, 1400], [-300, 1400]], PAPER); stroke(hill, { w: 3.2, prog: d, seed: 800 });
  Pr.acacia(640, 712, 0.9, { prog: d, seed: 801 });
  figure(1010, 652, 1.9, POSE.sitKnees(t * 0.5), { ...FORAGER, hair: 'long', seed: 810, prog: d, smile: 0.5 });
  Pr.birds(1100 + u * 25, 380, t, { n: 4, a: pr(u, 2, 1) });
  // The alarm clock from the opening, lying in the grass. Its hands have stopped.
  g.save(); g.translate(400, 930); g.rotate(-0.35); Pr.alarmClock(0, 0, 58, { prog: pr(u, 2.5, 1.5), ring: 0, t, hour: 6.75, min: 45 }); g.restore();
  for (let i = 0; i < 6; i++) Pr.grass(300 + i * 34, 985, 1.8, { prog: pr(u, 3.2, 1), seed: 820 + i });
}

// ---- the cut -----------------------------------------------------------------------------------
const SHOTS = [
  [0, alarm], [T('a2') - 0.3, machines], [T('a3') - 0.7, dawn],
  [T('b1') - 0.9, bones], [T('b4') - 0.6, grinding],
  [T('c1') - 0.9, band], [T('c2') - 0.4, camp], [T('c3') - 0.4, week], [E('c3') - 4.3, together],
  [T('d1') - 0.9, maker], [T('d2') + 3.6, flutePlayer], [T('d3') - 0.6, sharing], [T('d4') - 0.6, dayTalk], [T('d5') - 0.3, night],
  [T('e1') - 1.0, map], [T('e2') - 0.5, multiply], [T('e3') - 0.5, cycle], [T('e4') - 0.5, fenced],
  [T('f1') - 1.0, office], [T('f2') - 0.6, danger], [T('f3') - 0.6, ending],
];
function frame(t) {
  S.boil(t);
  let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
  const fn = SHOTS[i][1];
  if (fn !== night) S.paper();
  g.save(); fn(t); g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Cuts: the ink lifts off the page and the next drawing starts on clean paper.
  let f = 0;
  for (let j = 1; j < SHOTS.length; j++) { const tb = SHOTS[j][0]; if (t < tb && t > tb - 0.4) f = Math.max(f, 1 - (tb - t) / 0.4); }
  if (f > 0) { const dark = fn === night || (fn === dayTalk && t > SHOTS[i + 1][0] - 0.5); g.fillStyle = dark ? `rgba(29,26,24,${f})` : `rgba(242,235,219,${f})`; g.fillRect(0, 0, W, H); }
  const tail = clamp((t - (DURATION - 4)) / 2.6, 0, 1), black = Math.max(clamp(1 - t / 0.5, 0, 1), clamp((t - (DURATION - 1.4)) / 1.4, 0, 1));
  if (tail > 0) { g.fillStyle = `rgba(242,235,219,${tail * 0.85})`; g.fillRect(0, 0, W, H); }
  if (black > 0) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, W, H); }
}
window.DURATION = DURATION;
window.FPS = FPS;
window.renderFrame = (i) => frame(i / FPS);
window.ready = true;
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now();
  const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
}
