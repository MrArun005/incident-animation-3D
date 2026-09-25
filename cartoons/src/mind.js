// "Inside a Mind": a language model answers one question, "What is the ocean
// like at night?". Tokens, a galaxy of meaning (embeddings), attention, layers,
// probabilities, one word at a time, and the answer becoming light on a night sea.
// Its own little 3D renderer: a look-at camera, perspective projection, additive
// glow sprites. Beat times: stories/mind.beats.json (the soundtrack reads it too).
import * as C from './rich/core.js';
import B from '../stories/mind.beats.json' with { type: 'json' };
import timing from '../stories/mind.timing.json' with { type: 'json' };

const { W, H, TAU, lerp, seg, lin, clamp, fade, win, ease, easeOut, rng } = C;
const FPS = 30, DURATION = B.duration;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const MONO = '"Liberation Mono", "DejaVu Sans Mono", monospace';
const SANS = C.FONT;

// ---- a tiny 3D camera -----------------------------------------------------------------------------------------------
const V = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, lerp: (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)] };
const CAM = { eye: [0, 0, -800], f: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], foc: 900 };
function look(eye, target, fov = 55, roll = 0) {
  const f = V.norm(V.sub(target, eye)); let r = V.norm(V.cross([0, 1, 0], f)); let u = V.cross(f, r);
  if (roll) { const cr = Math.cos(roll), sr = Math.sin(roll); [r, u] = [V.add(V.mul(r, cr), V.mul(u, sr)), V.sub(V.mul(u, cr), V.mul(r, sr))]; }
  Object.assign(CAM, { eye, f, r, u, foc: (H / 2) / Math.tan((fov * Math.PI / 180) / 2) });
}
function proj(p) {
  const d = V.sub(p, CAM.eye), z = V.dot(d, CAM.f);
  if (z < 5) return null;
  const k = CAM.foc / z;
  return [W / 2 + V.dot(d, CAM.r) * k, H / 2 - V.dot(d, CAM.u) * k, k, z];
}

// ---- glow sprites ---------------------------------------------------------------------------------------------------------
const SPR = {};
function sprite(col) {
  if (!SPR[col]) {
    const s = C.canvas(128, 128), sg = s.getContext('2d'), q = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
    q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.12, C.rgba(col, 0.95)); q.addColorStop(0.4, C.rgba(col, 0.28)); q.addColorStop(1, C.rgba(col, 0));
    sg.fillStyle = q; sg.fillRect(0, 0, 128, 128); SPR[col] = s;
  }
  return SPR[col];
}
function glowAt(x, y, r, col, a = 1) { if (a <= 0 || r <= 0.3) return; g.globalAlpha = Math.min(1, a); g.drawImage(sprite(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; }
const additive = (fn) => { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); };
function label(txt, x, y, size, col = '#eaf6ff', a = 1, font = SANS, weight = '600') {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * 0.6; g.fillStyle = col; g.fillText(txt, x, y); g.restore();
}

// ---- the story's data ------------------------------------------------------------------------------------------------------
const PROMPT = ['What', ' is', ' the', ' ocean', ' like', ' at', ' night', '?'];
const IDS = [2061, 318, 262, 9151, 588, 379, 1755, 30];            // illustrative token ids
const ANSWER = [['Dark', [['Dark', 0.34], ['Beautiful', 0.18], ['Quiet', 0.14], ['Cold', 0.09], ['Calm', 0.07]]],
  [',', [[',', 0.61], [' and', 0.21], ['.', 0.08], [' but', 0.04]]],
  [' quiet', [[' quiet', 0.41], [' cold', 0.19], [' deep', 0.12], [' vast', 0.08]]],
  [',', [[',', 0.72], [' and', 0.19], ['.', 0.05]]],
  [' and', [[' and', 0.83], [' but', 0.09], [' yet', 0.04]]],
  [' full', [[' full', 0.28], [' strangely', 0.16], [' alive', 0.15], [' still', 0.1]]],
  [' of', [[' of', 0.97], [' with', 0.02]]],
  [' light', [[' light', 0.44], [' life', 0.23], [' stars', 0.16], [' secrets', 0.06]]],
  ['.', [['.', 0.88], ['!', 0.07], [',', 0.03]]]];
const HUE = { ocean: '#3ad6ff', night: '#8a7cff', light: '#ffd66a', feel: '#ff7ab8', fn: '#9fb4c8' };
const CLUSTERS = {
  ocean: { c: [-170, 30, 40], words: ['sea', 'wave', 'tide', 'water', 'deep', 'shore', 'coral', 'whale', 'salt', 'current', 'reef'] },
  night: { c: [170, -20, 90], words: ['dark', 'moon', 'stars', 'midnight', 'shadow', 'dream', 'sleep', 'dusk', 'sky'] },
  light: { c: [40, 170, -60], words: ['glow', 'shine', 'bright', 'spark', 'lantern', 'sun', 'flame'] },
  feel: { c: [-60, -170, 120], words: ['calm', 'quiet', 'vast', 'lonely', 'peaceful', 'cold', 'beautiful'] },
  fn: { c: [30, 20, -260], words: ['a', 'of', 'and', 'in', 'to', 'it', 'was', 'that', 'on', 'for'] },
};
const TOKEN_CLUSTER = ['fn', 'fn', 'fn', 'ocean', 'fn', 'fn', 'night', 'fn'];
// Place the named words and a big background of other meanings.
const R = rng(42), WORDS = [], DUST = [];
for (const [k, cl] of Object.entries(CLUSTERS)) cl.words.forEach((w, j) => { const a = j * 2.4, rr = 60 + (j % 3) * 40; WORDS.push({ w, k, p: [cl.c[0] + Math.cos(a) * rr, cl.c[1] + Math.sin(a * 1.3) * 70, cl.c[2] + Math.sin(a) * rr] }); });
for (let i = 0; i < 5200; i++) {
  const arm = i % 4, t = R() ** 0.7, a = arm * TAU / 4 + t * 5.5 + (R() - 0.5) * 0.6, rr = 60 + t * 900;
  DUST.push([Math.cos(a) * rr + (R() - 0.5) * 80, (R() - 0.5) * 160 * (1 - t * 0.6), Math.sin(a) * rr + (R() - 0.5) * 80, R()]);
}
const TOKEN_POS = PROMPT.map((_, i) => { const k = TOKEN_CLUSTER[i], cc = CLUSTERS[k].c; return k === 'fn' ? [cc[0] + (i - 3.5) * 40, cc[1] + ((i * 37) % 60) - 30, cc[2] + ((i * 53) % 80) - 40] : [cc[0], cc[1], cc[2]]; });
// Attention weights (illustrative): rows are the looking word, columns what it looks at.
const ATT = [
  [1, 0, 0, 0, 0, 0, 0, 0], [0.5, 0.5, 0, 0, 0, 0, 0, 0], [0.2, 0.3, 0.5, 0, 0, 0, 0, 0], [0.15, 0.1, 0.45, 0.3, 0, 0, 0, 0],
  [0.3, 0.1, 0.1, 0.4, 0.1, 0, 0, 0], [0.05, 0.05, 0.1, 0.3, 0.3, 0.2, 0, 0], [0.05, 0.02, 0.08, 0.5, 0.1, 0.2, 0.05, 0], [0.35, 0.05, 0.05, 0.2, 0.1, 0.05, 0.15, 0.05]];

// ---- background ------------------------------------------------------------------------------------------------------------
function space(t, a = 1) {
  const q = g.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H / 2, W * 0.75);
  q.addColorStop(0, '#0c1024'); q.addColorStop(1, '#020308');
  g.fillStyle = q; g.fillRect(0, 0, W, H);
  const r = rng(7);
  additive(() => { for (let i = 0; i < 220; i++) { const x = r() * W, y = r() * H, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i); g.fillStyle = `rgba(200,220,255,${a * tw * (0.15 + r() * 0.35)})`; g.fillRect(x, y, 1.6, 1.6); } });
}
function vignette(k = 0.6) { const q = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0); q.addColorStop(0, 'rgba(0,0,0,0)'); q.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = q; g.fillRect(0, 0, W, H); }
function grain(t) { const n = C.noiseTile(3, 256, 1), f = Math.floor(t * 30); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.04; g.fillStyle = C.pattern(g, n, 1, (f * 97) % 256, (f * 61) % 256); g.fillRect(0, 0, W, H); g.restore(); }
function tile(txt, x, y, s, a, col = '#3ad6ff', sub = null) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = `600 ${40 * s}px ${MONO}`;
  const w = g.measureText(txt.replace(/^ /, '·')).width + 34 * s, h = 70 * s;
  g.shadowColor = col; g.shadowBlur = 30 * s; g.fillStyle = C.rgba(col, 0.12); g.strokeStyle = C.rgba(col, 0.9); g.lineWidth = 2.5 * s;
  g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 14 * s); g.fill(); g.stroke();
  g.shadowBlur = 16 * s; g.fillStyle = '#f2fbff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt.replace(/^ /, '·'), x, y + 2 * s);
  if (sub) { g.shadowBlur = 0; g.font = `500 ${22 * s}px ${MONO}`; g.fillStyle = C.rgba(col, 0.85); g.fillText(sub, x, y + h * 0.85); }
  g.restore();
}

// ---- scenes ---------------------------------------------------------------------------------------------------------------------
function prompt(t) {
  space(t, 0.6);
  const full = 'What is the ocean like at night?', n = Math.floor(clamp((t - 0.8) / 2.4, 0, 1) * full.length);
  const push = seg(t, 4.2, 6.2), s = lerp(1, 1.5, push);
  g.save(); g.translate(W / 2, H / 2); g.scale(s, s);
  label(full.slice(0, n) + (Math.floor(t * 2) % 2 && t < 4.4 ? '▍' : ''), 0, 0, 56, '#eaf6ff', 1 - push * 0.2, MONO, '500');
  g.restore();
  additive(() => glowAt(W / 2, H / 2, 600 * push, '#3ad6ff', 0.5 * push));
}
function tokens(t) {
  space(t, 0.6);
  const split = seg(t, 6.2, 8.2), ids = fade(t, 9.4, 0.8), toCloud = seg(t, 14.4, 16.4);
  look([Math.sin(t * 0.2) * 60, 20, -760], [0, 0, 0], 50);
  let x = -((PROMPT.length - 1) * 135 * split) / 2;
  PROMPT.forEach((tk, i) => {
    const px = lerp((i - 3.5) * 110, x + i * 135 * split + (i - 3.5) * 110 * (1 - split), split) * (1 - toCloud), py = Math.sin(t * 1.3 + i) * 14 * split * (1 - toCloud), pz = Math.cos(t * 1.1 + i * 2) * 40 * split;
    const target = TOKEN_POS[i], p = V.lerp([px, py, pz], target, ease(toCloud));
    const q = proj(p); if (!q) return;
    const col = HUE[TOKEN_CLUSTER[i]];
    if (toCloud < 0.6) tile(tk, q[0], q[1], q[2] * 0.85 * (1 - toCloud * 0.8), 1 - toCloud * 1.5, col, ids > 0 ? `#${IDS[i]}` : null);
    additive(() => glowAt(q[0], q[1], 30 + 60 * toCloud, col, 0.4 + toCloud * 0.6));
    x += 0;
  });
  if (ids > 0) label('each piece gets a number', W / 2, H * 0.78, 30, '#9fb4c8', ids * (1 - toCloud));
}
function cloud(t) {
  space(t, 0.4);
  const k = seg(t, 15.5, 28.5);
  // Fly in, sweep past the ocean words, then the night words, then pull back to see both.
  const eyes = [[0, 60, -1400], [-260, 80, -320], [-60, 40, -260], [260, 40, -120], [0, 260, -900]], tgts = [[0, 0, 0], [-170, 30, 40], [0, 10, 60], [170, -20, 90], [0, 0, 60]];
  const u = k * (eyes.length - 1), i = Math.min(eyes.length - 2, Math.floor(u)), f = ease(u - i);
  look(V.lerp(eyes[i], eyes[i + 1], f), V.lerp(tgts[i], tgts[i + 1], f), 58, Math.sin(t * 0.3) * 0.05);
  // Dust: thousands of other meanings.
  additive(() => {
    for (const [x, y, z, v] of DUST) { const q = proj([x, y, z]); if (!q) continue; const r = clamp(q[2] * 2.4, 0.6, 6); g.fillStyle = `rgba(${v < 0.3 ? '255,200,140' : v < 0.6 ? '140,200,255' : '200,170,255'},${clamp(0.25 + q[2] * 0.6, 0, 0.9)})`; g.fillRect(q[0], q[1], r, r); }
  });
  // Named words, faint links within a cluster, the prompt's tokens bright.
  additive(() => {
    for (const [kk, cl] of Object.entries(CLUSTERS)) {
      const qc = proj(cl.c); if (!qc) continue;
      for (const wd of WORDS.filter((w) => w.k === kk)) { const q = proj(wd.p); if (!q) continue; g.strokeStyle = C.rgba(HUE[kk], 0.18); g.lineWidth = 1.2; g.beginPath(); g.moveTo(qc[0], qc[1]); g.lineTo(q[0], q[1]); g.stroke(); glowAt(q[0], q[1], 10 + q[2] * 18, HUE[kk], 0.8); }
    }
  });
  for (const wd of WORDS) { const q = proj(wd.p); if (!q || q[2] < 0.5) continue; label(wd.w, q[0], q[1] - 14 - q[2] * 10, clamp(q[2] * 26, 12, 42), C.mix(HUE[wd.k], '#ffffff', 0.4), clamp((q[2] - 0.5) * 1.5, 0, 0.95)); }
  PROMPT.forEach((tk, i) => { const q = proj(TOKEN_POS[i]); if (!q) return; const col = HUE[TOKEN_CLUSTER[i]]; additive(() => glowAt(q[0], q[1], 40 + q[2] * 60, col, 1)); label(tk.trim(), q[0], q[1] - 30 - q[2] * 24, clamp(q[2] * 40, 16, 60), '#ffffff', clamp(q[2] * 2, 0.3, 1)); });
  label('similar meanings live close together', W / 2, H * 0.88, 30, '#9fb4c8', win(t, 22.6, 27.8, 0.5));
}
const ROW = PROMPT.map((_, i) => [(i - 3.5) * 150, 0, 0]);
function orbs(t, colAt = () => null, labels = true, yOff = 0) {
  PROMPT.forEach((tk, i) => { const q = proj([ROW[i][0], ROW[i][1] + yOff, ROW[i][2]]); if (!q) return; const col = colAt(i) || HUE[TOKEN_CLUSTER[i]]; additive(() => glowAt(q[0], q[1], 34 * q[2] * 1.4, col, 1)); if (labels) label(tk.trim(), q[0], q[1] + 44 * q[2], 30 * q[2], '#eaf6ff', 0.95, MONO, '600'); });
}
function arc(i, j, w, col, t, yOff = 0, lift = 1) {
  if (w < 0.02 || i === j) return;
  const a = ROW[i], b = ROW[j], h = (60 + Math.abs(i - j) * 38) * lift, pts = [];
  for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push(proj([lerp(a[0], b[0], u), yOff + Math.sin(u * Math.PI) * h, lerp(a[2], b[2], u) - Math.sin(u * Math.PI) * 30])); }
  if (pts.some((p) => !p)) return;
  additive(() => {
    g.strokeStyle = C.rgba(col, 0.25 + w * 0.6); g.lineWidth = 1.5 + w * 12; g.lineCap = 'round';
    g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    const u = (t * 0.9 + i * 0.13 + j * 0.07) % 1, p = pts[Math.round(u * 24)]; glowAt(p[0], p[1], 10 + w * 26, col, 0.9);
  });
}
function attention(t) {
  space(t, 0.4);
  look([Math.sin(t * 0.25) * 120, 260, -900], [0, 70, 0], 50);
  const phase = t < 33 ? 0 : t < 37.2 ? 1 : 2;
  // 1: "ocean" looks back; 2: "night" looks back (mostly at ocean); 3: everyone, three heads.
  if (phase < 2) {
    const qi = phase === 0 ? 3 : 6, k = seg(t, phase === 0 ? 28.6 : 33.0, phase === 0 ? 29.8 : 34.2);
    for (let j = 0; j < 8; j++) arc(qi, j, ATT[qi][j] * k, '#ffd66a', t);
    orbs(t, (i) => (i === qi ? '#ffd66a' : null));
    const q = proj(ROW[qi]); if (q) label(phase === 0 ? '“ocean” looks back' : '“night” looks at “ocean”', q[0], q[1] - 250, 34, '#ffd66a', win(t, phase === 0 ? 29.2 : 33.6, phase === 0 ? 33 : 37.2, 0.4));
  } else {
    const k = seg(t, 37.2, 38.6), heads = ['#ffd66a', '#3ad6ff', '#ff7ab8'];
    heads.forEach((col, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const w = h === 0 ? ATT[i][j] : ATT[i][(j + h * 3) % 8] * 0.7; arc(i, j, w * k * 0.8, col, t + h, 0, 0.7 + h * 0.25); } });
    orbs(t);
    label('many heads, each noticing something different', W / 2, H * 0.86, 30, '#9fb4c8', win(t, 38.4, 41.8, 0.5));
  }
}
function layers(t) {
  space(t, 0.35);
  const k = seg(t, 41.8, 53.2), N = 12, GAP = 170;
  const eyeY = lerp(-240, N * GAP + 120, k);
  look([Math.sin(t * 0.3) * 80, eyeY, -780], [0, eyeY + 110, 0], 55);
  for (let L = 0; L < N; L++) {
    const y = L * GAP, rel = (y - eyeY) / GAP;
    if (rel < -2.5 || rel > 6) continue;
    const a = clamp(1 - Math.abs(rel - 0.6) / 4, 0, 1);
    // A glass sheet with a grid.
    additive(() => {
      g.strokeStyle = `rgba(120,190,255,${0.12 * a})`; g.lineWidth = 1.2;
      for (let gx = -700; gx <= 700; gx += 100) { const p0 = proj([gx, y, -300]), p1 = proj([gx, y, 500]); if (p0 && p1) { g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); } }
      for (let gz = -300; gz <= 500; gz += 100) { const p0 = proj([-700, y, gz]), p1 = proj([700, y, gz]); if (p0 && p1) { g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); } }
    });
    const hue = C.mix('#3ad6ff', '#ffd66a', L / (N - 1));
    orbs(t, (i) => (i === 3 || i === 6 ? hue : null), false, y);
    for (let i = 0; i < 7; i++) arc(i, i + 1, 0.2 * a, hue, t + L, y, 0.4);
    const q = proj([-760, y, 0]); if (q) label(`layer ${L + 1}`, q[0], q[1], clamp(q[2] * 26, 12, 30), C.rgba('#9fb4c8', 1), a * 0.8, MONO, '500');
  }
  const stage = t < 45.6 ? 'ocean' : t < 49.2 ? 'ocean · water · waves' : 'the ocean · at night · dark · vast';
  label(stage, W / 2, H * 0.14, 44, '#eaf6ff', win(t, 42.6, 53.2, 0.5), SANS, '600');
}
// The answer builds at the bottom; distributions flash above.
function answerLine(n, a = 1, y = H * 0.84, size = 60) {
  const txt = ANSWER.slice(0, n).map((x) => x[0]).join('');
  g.save(); g.globalAlpha = a * 0.5; g.font = `500 30px ${MONO}`; g.textAlign = 'center'; g.fillStyle = '#9fb4c8'; g.fillText('What is the ocean like at night?', W / 2, y - 70); g.restore();
  label(txt + (a > 0.5 && Math.floor(n * 3 + 1) % 2 ? '' : ''), W / 2, y, size, '#ffffff', a, SANS, '700');
  return txt;
}
function bars(dist, x, y, w, k, chosen, flash, a = 1) {
  const rowH = 96;
  dist.forEach(([tk, p], i) => {
    const yy = y + i * rowH, bw = w * p / dist[0][1] * 0.9 * ease(k), sel = tk === chosen && flash > 0;
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(120,190,255,0.08)'; g.beginPath(); g.roundRect(x, yy, w, rowH - 18, 12); g.fill();
    const col = sel ? '#ffd66a' : '#3ad6ff';
    g.shadowColor = col; g.shadowBlur = sel ? 40 : 18; g.fillStyle = C.rgba(col, sel ? 0.9 : 0.6); g.beginPath(); g.roundRect(x, yy, Math.max(8, bw), rowH - 18, 12); g.fill();
    g.shadowBlur = 0; g.font = `600 44px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.fillText(tk.replace(/^ /, '·'), x + 18, yy + (rowH - 18) / 2 + 2);
    g.textAlign = 'right'; g.fillStyle = '#cfe6ff'; g.fillText(`${Math.round(p * 100 * ease(k))}%`, x + w - 16, yy + (rowH - 18) / 2 + 2);
    g.restore();
  });
}
function predict(t) {
  space(t, 0.35);
  additive(() => glowAt(W / 2, H * 0.4, 700, '#3ad6ff', 0.08));
  const first = t < B.pick + 0.9;
  if (first) {
    const k = seg(t, 53.8, 56.2), flash = fade(t, B.pick, 0.15);
    bars(ANSWER[0][1], W / 2 - 460, 230, 920, k, 'Dark', flash);
    label('what comes next?', W / 2, 160, 40, '#9fb4c8', win(t, 53.6, B.pick + 0.9, 0.4));
    answerLine(t > B.pick + 0.5 ? 1 : 0);
    if (t > B.pick) { const u = seg(t, B.pick + 0.1, B.pick + 0.6); label('Dark', lerp(W / 2 - 330, W / 2, u), lerp(270, H * 0.84, u), 60, '#ffd66a', 1 - u * 0.3, SANS, '700'); }
    return;
  }
  // The loop: each next token gets a quick look at its choices.
  const t0 = B.loop0, step = B.loopStep, idx = clamp(Math.floor((t - t0) / step) + 1, 1, ANSWER.length - 1), lt = (t - t0) - (idx - 1) * step;
  if (t >= t0 && idx < ANSWER.length) {
    const [tk, dist] = ANSWER[idx];
    bars(dist, W / 2 - 400, 230, 800, clamp(lt / (step * 0.45), 0, 1), tk, lt > step * 0.55 ? 1 : 0, clamp((step - lt) / 0.2, 0, 1) * 0.95);
  }
  const n = t < t0 ? 1 : clamp(Math.floor((t - t0 - step * 0.7) / step) + 2, 1, ANSWER.length);
  answerLine(n);
  label('illustrative probabilities', W - 250, H - 50, 22, '#6a7f94', 0.8, SANS, '500');
}
// The night sea: a field of glowing points, waves, and the answer falling in as light.
function sea(t) {
  const q = g.createLinearGradient(0, 0, 0, H); q.addColorStop(0, '#02030c'); q.addColorStop(0.55, '#0a1030'); q.addColorStop(1, '#02030a');
  g.fillStyle = q; g.fillRect(0, 0, W, H);
  const r = rng(3); additive(() => { for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H * 0.5; g.fillStyle = `rgba(220,230,255,${(0.2 + r() * 0.6) * (0.6 + 0.4 * Math.sin(t * 2 + i))})`; g.fillRect(x, y, 1.8, 1.8); } });
  const drift = (t - 70) * 22;
  look([Math.sin(t * 0.2) * 40, 190 + Math.sin(t * 0.5) * 8, -300 + drift], [0, -30, 420 + drift], 62);
  const moon = proj([900, 900, 2600 + drift]); if (moon) { additive(() => glowAt(moon[0], moon[1], 260, '#bfd4ff', 0.5)); g.fillStyle = '#eef2ff'; g.beginPath(); g.arc(moon[0], moon[1], 34, 0, TAU); g.fill(); }
  const fall = seg(t, B.dissolve, B.dissolve + 2.4);
  const hits = []; for (let i = 0; i < 26; i++) { const hx = (i - 13) * 34 + Math.sin(i * 7) * 20, hz = 260 + (i % 5) * 40 + (70 + (B.dissolve + 0.6 + (i / 26) * 1.8 - 70)) * 22 - 0, ht = B.dissolve + 0.6 + (i / 26) * 1.8; hits.push([hx, hz, ht]); }
  additive(() => {
    for (let zi = 0; zi < 70; zi++) for (let xi = -44; xi <= 44; xi++) {
      const z = Math.floor(drift / 24) * 24 + zi * 24, x = xi * 24;
      const y = Math.sin(x * 0.012 + t * 1.1) * 10 + Math.sin(z * 0.018 - t * 1.4) * 12 + Math.sin((x + z) * 0.03 + t * 2) * 4;
      let glowK = 0.25 + 0.5 * clamp((y + 10) / 30, 0, 1);
      for (const [hx, hz, ht] of hits) { const u = t - ht; if (u > 0 && u < 4) { const d = Math.hypot(x - hx, z - hz), ring = Math.exp(-((d - u * 140) ** 2) / 4000) * (1 - u / 4); glowK += ring * 1.8; } }
      glowK += fall * 0.8 * Math.exp(-((z - drift - 360) ** 2) / 90000) + 0.4 * seg(t, B.dissolve + 1.2, B.dissolve + 3.6) * (0.6 + 0.4 * Math.sin(x * 0.05 + z * 0.04 + t * 3));
      const p = proj([x, y, z]); if (!p) continue;
      const s = clamp(p[2] * 4.2, 0.8, 6);
      g.fillStyle = `rgba(${Math.round(60 + 140 * clamp(glowK - 0.6, 0, 1))},${Math.round(200 + 55 * clamp(glowK, 0, 1))},255,${clamp(glowK * 0.7 * clamp(p[2] * 7, 0.25, 1), 0, 1)})`;
      g.fillRect(p[0], p[1], s, s);
      if (glowK > 0.85 && (xi + zi) % 2 === 0) glowAt(p[0], p[1], 5 + p[2] * 40, glowK > 1.4 ? '#9ff0ff' : '#3ad6ff', clamp((glowK - 0.85) * 0.3, 0, 0.35));
    }
  });
  // The answer hangs over the water, then falls into it as sparks.
  const txt = 'Dark, quiet, and full of light.';
  if (fall < 1) {
    g.save(); g.globalAlpha = 1 - fall; label(txt, W / 2, H * 0.36 + fall * 80, 62, '#ffffff', 1 - fall, SANS, '700'); g.restore();
  }
  if (fall > 0) additive(() => { const rr = rng(11); for (let i = 0; i < 160; i++) { const sx = W / 2 + (rr() - 0.5) * 900, u = clamp(fall * 1.3 - rr() * 0.3, 0, 1), sy = H * 0.36 + u * u * (H * 0.35), col = rr() < 0.5 ? '#ffd66a' : '#3ad6ff'; glowAt(sx, sy, 6 + rr() * 10, col, (1 - u) * 0.9); } });
}
function endCard(t) {
  sea(t);
  const k = seg(t, B.end, B.end + 1.2);
  g.fillStyle = `rgba(2,3,10,${0.55 * k})`; g.fillRect(0, 0, W, H);
  label('INSIDE A MIND', W / 2, H * 0.44, 110, '#ffffff', k, SANS, '800');
  label('a language model, answering one question', W / 2, H * 0.44 + 90, 34, '#9fdcff', fade(t, B.end + 0.5, 0.6), SANS, '500');
  label('every frame made in code  ·  no footage, no stock', W / 2, H * 0.44 + 144, 26, '#6a7f94', fade(t, B.end + 1.0, 0.6), SANS, '500');
}

function subtitle(t) {
  const l = timing.lines.find((x) => t > x.t0 - 0.05 && t < x.t0 + x.dur + 0.4);
  if (!l || l.id === 'answer') return;
  C.text(g, l.text, W / 2, H - 40, { size: 34, col: '#e8f2ff', weight: '500', shadow: 0.9, a: 0.92 * win(t, l.t0 - 0.05, l.t0 + l.dur + 0.4, 0.15) });
}
function frame(t) {
  g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  if (t < B.tokens) prompt(t);
  else if (t < B.cloud) tokens(t);
  else if (t < B.attention) cloud(t);
  else if (t < B.layers) attention(t);
  else if (t < B.predict) layers(t);
  else if (t < B.sea) predict(t);
  else if (t < B.end) sea(t);
  else endCard(t);
  g.restore();
  vignette(0.55); grain(t);
  if (t < B.end) subtitle(t);
  const dips = [B.attention, B.layers, B.predict, B.sea];
  let f = Math.max(1 - clamp(t / 0.6, 0, 1), clamp((t - (DURATION - 1.2)) / 1.2, 0, 1));
  for (const d of dips) f = Math.max(f, 1 - clamp(Math.abs(t - d) / 0.3, 0, 1));
  if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
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
