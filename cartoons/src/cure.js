// "The Compressed Century": a visual essay on an idea from Dario Amodei's 2024
// essay "Machines of Loving Grace": that AI working alongside scientists might
// compress decades of biology into years. One cell goes rogue; science is slow;
// a datacenter of minds tries thousands of ideas at once; molecules dock; an immune
// cell learns to see; a hundred years folds into ten. A possibility, not a promise.
import * as C from './rich/core.js';
import B from '../stories/cure.beats.json' with { type: 'json' };
import timing from '../stories/cure.timing.json' with { type: 'json' };

const { W, H, TAU, lerp, seg, lin, clamp, fade, win, ease, easeOut, rng } = C;
const FPS = 30, DURATION = B.duration;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const SANS = C.FONT, SERIF = C.SERIF, MONO = '"Liberation Mono", monospace';

// ---- glow + text helpers (as in Inside a Mind) --------------------------------------------------------------------
const SPR = {};
function sprite(col) {
  if (!SPR[col]) { const s = C.canvas(128, 128), sg = s.getContext('2d'), q = sg.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.12, C.rgba(col, 0.95)); q.addColorStop(0.4, C.rgba(col, 0.28)); q.addColorStop(1, C.rgba(col, 0)); sg.fillStyle = q; sg.fillRect(0, 0, 128, 128); SPR[col] = s; }
  return SPR[col];
}
const glowAt = (x, y, r, col, a = 1) => { if (a <= 0 || r <= 0.3) return; g.globalAlpha = Math.min(1, a); g.drawImage(sprite(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };
const additive = (fn) => { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); };
function label(txt, x, y, size, col = '#eaf6ff', a = 1, font = SANS, weight = '600', blur = 0.6) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = `${weight} ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * blur; g.fillStyle = col; g.fillText(txt, x, y); g.restore();
}
function darkField(t, tint = '#0d0a1c') {
  const q = g.createRadialGradient(W / 2, H * 0.48, 60, W / 2, H / 2, W * 0.75); q.addColorStop(0, tint); q.addColorStop(1, '#020206');
  g.fillStyle = q; g.fillRect(0, 0, W, H);
  const r = rng(5); additive(() => { for (let i = 0; i < 40; i++) { const x = (r() * W + t * (8 + r() * 12)) % W, y = r() * H, rr = 30 + r() * 90; glowAt(x, y, rr, r() < 0.5 ? '#6a4aa0' : '#2a6a9a', 0.05 + r() * 0.05); } });
}
function vignette(k = 0.6) { const q = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H); q.addColorStop(0, 'rgba(0,0,0,0)'); q.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = q; g.fillRect(0, 0, W, H); }
function grain(t) { const n = C.noiseTile(3, 256, 1), f = Math.floor(t * 30); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.04; g.fillStyle = C.pattern(g, n, 1, (f * 97) % 256, (f * 61) % 256); g.fillRect(0, 0, W, H); g.restore(); }

// ---- cells ------------------------------------------------------------------------------------------------------------------
// A soft membrane with a nucleus, wobbling; `rogue` turns it hot red-orange.
function cell(x, y, r, t, seed, o = {}) {
  const rogue = o.rogue || 0, a = o.a ?? 1, col = C.mix('#9a7ae0', '#ff5a3a', rogue), wob = o.wob ?? 1;
  const n = 28, pts = [];
  for (let i = 0; i < n; i++) { const ang = i / n * TAU, k = 1 + 0.06 * wob * Math.sin(ang * 3 + t * 1.5 + seed) + 0.04 * Math.sin(ang * 5 - t * 2 + seed * 2); pts.push([x + Math.cos(ang) * r * k * (o.sx || 1), y + Math.sin(ang) * r * k]); }
  g.save(); g.globalAlpha = a;
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath();
  const q = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.1); q.addColorStop(0, C.rgba(C.mix(col, '#ffffff', 0.25), 0.28)); q.addColorStop(1, C.rgba(col, 0.1));
  g.fillStyle = q; g.fill(); g.strokeStyle = C.rgba(col, 0.75); g.lineWidth = 2.5; g.shadowColor = col; g.shadowBlur = 18; g.stroke();
  g.shadowBlur = 0; g.fillStyle = C.rgba(C.mix(col, '#ffffff', 0.15), 0.55); g.beginPath(); g.ellipse(x + r * 0.1, y, r * 0.34, r * 0.3, seed, 0, TAU); g.fill();
  g.restore();
  if (rogue > 0) additive(() => glowAt(x, y, r * 2.2, '#ff5a3a', 0.35 * rogue * a));
}
// Rogue divisions: a binary tree of cells spreading from one.
function rogueCells(t, t0, cx, cy, gens = 5) {
  const out = [];
  const rec = (x, y, ang, gen, born) => {
    const next = born + 1.15;
    if (gen < gens && t > next) { const d = 34 + gen * 6; rec(x + Math.cos(ang) * d, y + Math.sin(ang) * d, ang + 0.9, gen + 1, next); rec(x - Math.cos(ang) * d, y - Math.sin(ang) * d, ang - 1.1, gen + 1, next); }
    else { const split = gen < gens ? clamp((t - next + 0.35) / 0.35, 0, 1) : 0; out.push([x, y, gen, split, ang]); }
  };
  rec(cx, cy, 0.4, 0, t0);
  return out;
}
function tissue(t, rogueOn, calm = 0) {
  const r = rng(12), cells = [];
  for (let i = 0; i < 60; i++) cells.push([80 + (i % 10) * 190 + (Math.floor(i / 10) % 2) * 95 + (r() - 0.5) * 30, 90 + Math.floor(i / 10) * 180 + (r() - 0.5) * 30, 70 + r() * 18, r() * 10]);
  for (const [x, y, rr, sd] of cells) cell(x + Math.sin(t * 0.3 + sd) * 6, y + Math.cos(t * 0.25 + sd) * 6, rr, t, sd, { a: 0.8 });
  if (!rogueOn) return;
  const kids = rogueCells(t, B.divide, W / 2, H / 2 + 20);
  for (const [x, y, gen, split, ang] of kids) {
    const rr = 44 - gen * 3;
    if (split > 0) { const d = rr * 0.7 * split; cell(x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr * (1 - split * 0.15), t, gen, { rogue: 1 - calm, sx: 1 }); cell(x - Math.cos(ang) * d, y - Math.sin(ang) * d, rr * (1 - split * 0.15), t, gen + 3, { rogue: 1 - calm }); }
    else cell(x, y, rr, t, gen + x * 0.01, { rogue: 1 - calm, a: 1 - calm });
  }
}

// ---- scenes -----------------------------------------------------------------------------------------------------------------
function sCell(t) {
  darkField(t, '#140a1e');
  const zoom = lerp(1.15, 1.0, seg(t, 0, 10.5));
  g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  tissue(t, t > B.turn);
  if (t > B.turn && t < B.divide) { const k = seg(t, B.turn, B.divide); cell(W / 2, H / 2 + 20, 44, t, 1, { rogue: k }); }
  g.restore();
  label('one cell stops listening', W / 2, H * 0.12, 36, '#ffb4a0', win(t, 4.2, 10.2, 0.5), SANS, '500');
}
function sSlow(t) {
  darkField(t, '#0c1020');
  // A timeline: one experiment at a time, crawling along the years.
  const x0 = 220, x1 = W - 220, y = H * 0.55, k = lin(t, 11.2, 21.8), years = Math.floor(k * 12) + 1;
  g.strokeStyle = 'rgba(160,190,230,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  for (let i = 0; i <= 12; i++) { const xx = lerp(x0, x1, i / 12); g.fillStyle = 'rgba(160,190,230,0.5)'; g.fillRect(xx - 1.5, y - 14, 3, 28); if (i % 2 === 0) label(`${i}`, xx, y + 44, 24, '#8aa0c0', 0.8, MONO, '500', 0); }
  label('years', x1 + 80, y + 44, 24, '#8aa0c0', 0.8, SANS, '500', 0);
  const px = lerp(x0, x1, k);
  additive(() => { glowAt(px, y, 50, '#6ac8ff', 1); g.strokeStyle = 'rgba(106,200,255,0.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, y); g.lineTo(px, y); g.stroke(); });
  // Little trial markers: most fail.
  for (let i = 0; i < 11; i++) { const tx = lerp(x0, x1, (i + 0.5) / 12); if (px > tx) { const ok = i === 10; label(ok ? '✓' : '×', tx, y - 70, 40, ok ? '#7cf0a0' : '#ff7a6a', 0.9, SANS, '700', 0.4); } }
  label(`year ${years}`, W / 2, H * 0.3, 64, '#ffffff', 0.9, MONO, '600');
  if (k > 0.97) label('one new medicine', lerp(x0, x1, 11 / 12), y - 130, 32, '#7cf0a0', fade(t, 21.5, 0.4), SANS, '600');
}
function sEssay(t) {
  darkField(t, '#10101c');
  const k = seg(t, 22.5, 31.5), s = lerp(0.74, 0.84, k);
  g.save(); g.translate(W / 2, H / 2 - 40); g.rotate(-0.04 + k * 0.03); g.scale(s, s);
  // A page of paper, glowing lines of text coming alive.
  g.shadowColor = 'rgba(255,230,190,0.35)'; g.shadowBlur = 80;
  g.fillStyle = '#f3ecdc'; g.fillRect(-380, -470, 760, 940); g.shadowBlur = 0;
  g.fillStyle = '#2a2420'; g.font = `700 50px ${SERIF}`; g.textAlign = 'center'; g.fillText('Machines of Loving Grace', 0, -370);
  g.font = `italic 400 24px ${SERIF}`; g.fillStyle = '#5a5048'; g.fillText('How AI Could Transform the World for the Better', 0, -325);
  g.font = `400 24px ${SERIF}`; g.fillText('Dario Amodei  ·  October 2024', 0, -285);
  const r = rng(3), lit = Math.floor(lin(t, 24, 31) * 26);
  for (let i = 0; i < 26; i++) { const w = 560 + (r() - 0.5) * 120, y = -220 + i * 26; g.fillStyle = i < lit ? '#4a3a2a' : '#c9bfae'; g.fillRect(-w / 2, y, w, 7); }
  g.restore();
  label('an essay about what AI might help us do', W / 2, H - 150, 30, '#c9d8ff', win(t, 26, 31.2, 0.5), SANS, '500');
}
function sCountry(t) {
  darkField(t, '#08101e');
  // A vast lattice of minds: each node a researcher-in-a-box running its own experiment.
  const k = seg(t, 31.5, 41.5), zoom = lerp(2.4, 0.75, k);
  const r = rng(9);
  additive(() => {
    for (let gy = -18; gy <= 18; gy++) for (let gx = -30; gx <= 30; gx++) {
      const bx = gx * 60, by = gy * 60 + (gx % 2) * 30, x = W / 2 + bx * zoom, y = H / 2 + by * zoom * 0.9;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const ph = r(), on = Math.sin(t * (2 + ph * 3) + ph * 50) > 0.6, col = on ? (ph < 0.3 ? '#7cf0a0' : '#6ac8ff') : '#3a5a9a';
      glowAt(x, y, (on ? 12 : 6) * Math.min(1.6, zoom), col, on ? 0.9 : 0.45);
      if (on && ph < 0.12) { const d = 50 * zoom; g.strokeStyle = C.rgba('#6ac8ff', 0.3); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + d, y + d * 0.5); g.stroke(); }
    }
  });
  if (k < 0.35) { const n = 1; label(`${n} mind`, W / 2, H * 0.14, 44, '#ffffff', 1 - k * 3, MONO, '600'); }
  label('thousands of experiments at once', W / 2, H * 0.14, 44, '#ffffff', win(t, 35.5, 41.2, 0.5), SANS, '600');
}
// A protein with a pocket; candidate molecules try to dock; one fits.
function molecule(x, y, s, rot, col, a = 1) {
  const atoms = [[0, 0], [30, -10], [55, 8], [22, 26], [-24, 18], [-40, -14], [8, -34]];
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.globalAlpha = a;
  g.strokeStyle = C.rgba(col, 0.8); g.lineWidth = 5; atoms.slice(1).forEach(([ax, ay], i) => { const [bx, by] = atoms[[0, 1, 0, 0, 4, 0][i]]; g.beginPath(); g.moveTo(bx, by); g.lineTo(ax, ay); g.stroke(); });
  atoms.forEach(([ax, ay], i) => { g.fillStyle = i === 0 ? '#ffffff' : col; g.beginPath(); g.arc(ax, ay, i === 0 ? 11 : 9, 0, TAU); g.fill(); });
  g.restore();
  additive(() => glowAt(x, y, 70 * s, col, 0.4 * a));
}
function sSearch(t) {
  darkField(t, '#0c0a1c');
  const px = W / 2 + 120, py = H / 2 + 10;
  // The target protein: a lumpy ribbon mass with a pocket on its left.
  additive(() => { for (let i = 0; i < 90; i++) { const a = i * 0.21, rr = 190 + Math.sin(i * 1.7) * 40 + Math.sin(i * 0.5 + t * 0.6) * 10, x = px + Math.cos(a) * rr * (Math.cos(a) < -0.7 ? 0.45 : 1), y = py + Math.sin(a) * rr * 0.8; glowAt(x, y, 34, i % 3 ? '#ff6a5a' : '#ff9a5a', 0.35); } });
  g.strokeStyle = 'rgba(255,140,110,0.5)'; g.lineWidth = 6; g.beginPath(); for (let i = 0; i <= 200; i++) { const a = i / 200 * TAU * 3, rr = 150 + 40 * Math.sin(a * 2.3), x = px + Math.cos(a) * rr * (Math.cos(a) < -0.7 ? 0.5 : 1), y = py + Math.sin(a) * rr * 0.75; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  const pocket = [px - 130, py];
  // Candidates fly in; the wrong shapes bounce off; the last one clicks into the pocket.
  const cands = 6;
  for (let i = 0; i < cands; i++) {
    const t0 = 42.0 + i * 0.85, u = t - t0; if (u < 0) continue;
    const fits = i === cands - 1, sx = 200, sy = 150 + i * 140;
    if (!fits) { const k = clamp(u / 0.5, 0, 1), back = clamp((u - 0.5) / 0.5, 0, 1); const x = lerp(sx, pocket[0] - 60, ease(k)) - back * 300, y = lerp(sy, pocket[1], ease(k)) + back * (sy - pocket[1]) * 0.8; molecule(x, y, 0.9, i + u * 3, '#6ac8ff', 1 - back); if (u > 0.45 && u < 0.8) label('×', pocket[0] - 60, pocket[1] - 70, 50, '#ff7a6a', 1 - (u - 0.45) / 0.35, SANS, '700', 0.3); }
    else { const k = clamp(u / 0.7, 0, 1); molecule(lerp(sx, pocket[0], ease(k)), lerp(sy, pocket[1], ease(k)), 0.9, lerp(2, 0, ease(k)), '#7cf0a0', 1); if (k >= 1) { additive(() => glowAt(pocket[0], pocket[1], 220, '#7cf0a0', 0.6 * (1 - clamp((u - 0.7) / 1.5, 0, 0.6)))); label('fits', pocket[0], pocket[1] - 110, 40, '#7cf0a0', fade(t, t0 + 0.7, 0.3), SANS, '700'); } }
  }
}
// A T cell finds the cancer cell's markers, binds, and it breaks apart.
function sImmune(t) {
  darkField(t, '#0a0c1c');
  const cx = W / 2 + 180, cy = H / 2 + 20, bind = B.bind, burst = seg(t, bind + 1.4, bind + 3.6);
  if (burst < 1) {
    cell(cx, cy, 150, t, 3, { rogue: 1, a: 1 - burst });
    for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + t * 0.15, mx = cx + Math.cos(a) * 158, my = cy + Math.sin(a) * 158, seen = t > B.see; g.save(); g.globalAlpha = 1 - burst; g.strokeStyle = '#ffd66a'; g.lineWidth = 4; g.beginPath(); g.moveTo(mx, my); g.lineTo(cx + Math.cos(a) * 185, cy + Math.sin(a) * 185); g.stroke(); g.fillStyle = '#ffd66a'; g.beginPath(); g.arc(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190, 9, 0, TAU); g.fill(); g.restore(); if (seen) additive(() => glowAt(cx + Math.cos(a) * 190, cy + Math.sin(a) * 190, 40, '#ffd66a', 0.8 * (1 - burst))); }
  }
  if (burst > 0) additive(() => { const r = rng(4); for (let i = 0; i < 120; i++) { const a = r() * TAU, d = burst * (150 + r() * 400); glowAt(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 8 + r() * 10, r() < 0.5 ? '#ff7a5a' : '#ffd66a', 1 - burst); } });
  // The T cell: a round cell covered in receptors, approaching from the left.
  const tx = lerp(-150, cx - 330, easeOut(lin(t, 48.2, bind))) + (W / 2 - (cx - 330)) * ease(burst), ty = cy + Math.sin(t * 1.5) * 12;
  cell(tx, ty, 110, t, 9, { rogue: 0, a: 1 });
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + t * 0.2, lit = t > B.see; g.strokeStyle = lit ? '#7cf0ff' : '#6a8ad0'; g.lineWidth = 5; g.beginPath(); g.moveTo(tx + Math.cos(a) * 110, ty + Math.sin(a) * 110); g.lineTo(tx + Math.cos(a) * 140, ty + Math.sin(a) * 140); g.stroke(); g.beginPath(); g.moveTo(tx + Math.cos(a) * 140 + Math.cos(a + 0.6) * 12, ty + Math.sin(a) * 140 + Math.sin(a + 0.6) * 12); g.lineTo(tx + Math.cos(a) * 140, ty + Math.sin(a) * 140); g.lineTo(tx + Math.cos(a) * 140 + Math.cos(a - 0.6) * 12, ty + Math.sin(a) * 140 + Math.sin(a - 0.6) * 12); g.stroke(); if (lit) additive(() => glowAt(tx + Math.cos(a) * 140, ty + Math.sin(a) * 140, 22, '#7cf0ff', 0.7)); }
  if (t > bind && burst < 0.3) additive(() => { g.strokeStyle = `rgba(124,240,255,${0.7 * (1 - burst / 0.3)})`; g.lineWidth = 6; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(tx + 140, ty + i * 30); g.lineTo(cx - 190, cy + i * 30); g.stroke(); } });
  label('T cell', tx, ty + 190, 30, '#9fdcff', win(t, 49, bind + 1, 0.4), SANS, '600');
  label('cancer cell', cx, cy + 250, 30, '#ffb4a0', win(t, 49, bind + 1.4, 0.4) * (1 - burst), SANS, '600');
}
function sCentury(t) {
  darkField(t, '#0a0c18');
  // A hundred years of milestones on a timeline that folds up into ten.
  const fold = seg(t, B.fold, B.fold + 3.2), half = lerp(W / 2 - 160, 260, ease(fold)), x0 = W / 2 - half, xEnd = W / 2 + half, y = H * 0.55;
  g.strokeStyle = 'rgba(160,190,230,0.4)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x0, y); g.lineTo(xEnd, y); g.stroke();
  if (fold > 0) additive(() => glowAt(W / 2, y, 420 * fold, '#7cf0a0', 0.18 * fold));
  const r = rng(21);
  for (let i = 0; i < 40; i++) { const k = r(), x = lerp(x0, xEnd, k), up = i % 2 ? -1 : 1, col = ['#7cf0a0', '#6ac8ff', '#ffd66a', '#ff9ad0'][i % 4]; additive(() => glowAt(x, y + up * (30 + (i % 5) * 26), 16, col, 0.9)); g.strokeStyle = C.rgba(col, 0.4); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + up * (30 + (i % 5) * 26)); g.stroke(); }
  const yr = Math.round(lerp(2125, 2035, fold));
  label('2025', x0, y + 60, 34, '#8aa0c0', 1, MONO, '600', 0.2);
  label(`${yr}`, xEnd, y + 60, 34, fold > 0.5 ? '#7cf0a0' : '#8aa0c0', 1, MONO, '700', 0.4);
  label(fold < 0.5 ? 'a hundred years of progress' : '…in perhaps ten', W / 2, H * 0.24, 56, '#ffffff', 0.95, SANS, '600');
  label('“the compressed 21st century”', W / 2, H * 0.84, 36, '#c9d8ff', win(t, 58.8, 67.2, 0.5), SERIF, '400');
}
function sPromise(t) {
  darkField(t, '#120c1c');
  const calm = seg(t, 67.5, 71);
  g.save(); g.globalAlpha = 1; tissue(t, false); g.restore();
  additive(() => glowAt(W / 2, H / 2, 600, '#9a7ae0', 0.12 + 0.08 * Math.sin(t)));
  label('a possibility, not a promise', W / 2, H * 0.14, 40, '#ffffff', win(t, 68.4, 75.8, 0.5) * calm, SANS, '500');
}
function sEnd(t) {
  sPromise(t);
  const k = seg(t, B.end, B.end + 1.2);
  g.fillStyle = `rgba(4,3,10,${0.72 * k})`; g.fillRect(0, 0, W, H);
  label('THE COMPRESSED CENTURY', W / 2, H * 0.44, 96, '#ffffff', k, SANS, '800');
  label('inspired by “Machines of Loving Grace” (Dario Amodei, 2024)', W / 2, H * 0.44 + 86, 32, '#c9d8ff', fade(t, B.end + 0.5, 0.6), SANS, '500', 0.2);
  label('a vision, not a prediction  ·  every frame made in code', W / 2, H * 0.44 + 136, 26, '#7a8aa4', fade(t, B.end + 1.0, 0.6), SANS, '500', 0.1);
}

function subtitle(t) {
  const l = timing.lines.find((x) => t > x.t0 - 0.05 && t < x.t0 + x.dur + 0.4);
  if (!l) return;
  C.text(g, l.text, W / 2, H - 40, { size: 34, col: '#e8f2ff', weight: '500', shadow: 0.9, a: 0.92 * win(t, l.t0 - 0.05, l.t0 + l.dur + 0.4, 0.15) });
}
const SCENES = [[0, sCell], [B.slow, sSlow], [B.essay, sEssay], [B.country, sCountry], [B.search, sSearch], [B.immune, sImmune], [B.century, sCentury], [B.promise, sPromise], [B.end, sEnd]];
function frame(t) {
  let i = 0; while (i + 1 < SCENES.length && t >= SCENES[i + 1][0]) i++;
  g.save(); SCENES[i][1](t); g.restore();
  vignette(0.55); grain(t);
  if (t < B.end) subtitle(t);
  let f = Math.max(1 - clamp(t / 0.6, 0, 1), clamp((t - (DURATION - 1.2)) / 1.2, 0, 1));
  for (const [d] of SCENES.slice(1, -1)) f = Math.max(f, 1 - clamp(Math.abs(t - d) / 0.3, 0, 1));
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
