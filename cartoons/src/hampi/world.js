// Vijayanagara (Hampi), c. 1520: granite boulder hills, the Virupaksha gopuram,
// bazaar colonnades with heaps of gems, the stone chariot, the singing pillars,
// the Mahanavami platform, lamps, coracles on the Tungabhadra.
import { W, H, TAU, clamp, lerp, rng, mix, shade, rgba, cached, softShadow, glow } from '../rich/core.js';
import { elephant } from '../pulakeshi/world.js';

const OL = '#2d1a10';
const blob = (g, fill, lw = 3) => { g.fillStyle = fill; g.fill(); g.strokeStyle = OL; g.lineWidth = lw; g.stroke(); };
const GRANITE = '#c49a78';

// ---- the boulder hills --------------------------------------------------------------------------------------------
export function boulderPile(g, x, y, s = 1, seed = 1, col = GRANITE, key = '') {
  const c = cached(`pile${seed}${col}${key}`, 900, 620, (cg) => {
    const r = rng(seed), rocks = [];
    for (let i = 0; i < 15; i++) {
      const layer = Math.floor(i / 5), rx = 70 + r() * 80 - layer * 12, ry = rx * (0.75 + r() * 0.2);
      rocks.push([450 + (r() - 0.5) * (620 - layer * 170), 600 - layer * 120 - ry * 0.7 - r() * 30, rx, ry, r()]);
    }
    rocks.sort((a, b) => a[1] - b[1]);
    for (const [bx, by, rx, ry, v] of rocks) {
      // An irregular, soft-cornered block of weathered granite.
      const pts = [], n = 9, rot = (v - 0.5) * 0.8;
      for (let i = 0; i < n; i++) { const a = rot + i * TAU / n, k = 0.78 + r() * 0.3; pts.push([bx + Math.cos(a) * rx * k, by + Math.sin(a) * ry * k]); }
      cg.beginPath();
      for (let i = 0; i < n; i++) { const p0 = pts[i], p1 = pts[(i + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; if (i === 0) cg.moveTo(mx, my); else cg.quadraticCurveTo(p0[0], p0[1], mx, my); }
      cg.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2); cg.closePath();
      const tone = mix(col, ['#8a6048', '#d4a878', '#a8785a', '#c9906a'][Math.floor(v * 4)], 0.45);
      const q = cg.createLinearGradient(bx - rx, by - ry, bx + rx * 0.8, by + ry);
      q.addColorStop(0, shade(tone, 0.3)); q.addColorStop(0.45, tone); q.addColorStop(1, shade(tone, -0.45));
      cg.fillStyle = q; cg.fill(); cg.strokeStyle = 'rgba(45,25,15,0.75)'; cg.lineWidth = 3.5; cg.stroke();
      cg.save(); cg.clip();
      for (let k = 0; k < 6; k++) { const sx = bx - rx + r() * rx * 2; cg.strokeStyle = `rgba(50,30,20,${0.12 + r() * 0.15})`; cg.lineWidth = 3 + r() * 6; cg.beginPath(); cg.moveTo(sx, by - ry); cg.quadraticCurveTo(sx + (r() - 0.5) * 20, by, sx + (r() - 0.5) * 30, by + ry); cg.stroke(); }
      cg.fillStyle = 'rgba(30,15,10,0.3)'; cg.beginPath(); cg.ellipse(bx + rx * 0.3, by + ry * 0.6, rx * 0.9, ry * 0.5, 0, 0, TAU); cg.fill();
      for (let k = 0; k < 40; k++) { cg.fillStyle = `rgba(${r() < 0.5 ? '40,25,15' : '255,235,215'},${0.1 + r() * 0.15})`; cg.fillRect(bx + (r() - 0.5) * rx * 1.8, by + (r() - 0.5) * ry * 1.8, 2.5, 2.5); }
      cg.restore();
    }
  });
  g.drawImage(c, x - 450 * s, y - 610 * s, 900 * s, 620 * s);
}

// ---- the Virupaksha gopuram ------------------------------------------------------------------------------------------
export function gopuram(g, x, y, s = 1, o = {}) {
  const col = o.col || '#e6d6b8';
  g.save(); g.translate(x, y); g.scale(s, s);
  // Two stone storeys with the great doorway.
  g.fillStyle = '#b8987a'; g.fillRect(-230, -180, 460, 180); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(-230, -180, 460, 180);
  for (let i = 0; i < 6; i++) { g.fillStyle = shade('#b8987a', 0.1); g.fillRect(-220 + i * 82, -175, 16, 170); }
  g.fillStyle = '#1e120c'; g.fillRect(-55, -170, 110, 170);
  // Tiers of the tower, each narrower, with niches and figures.
  const tiers = o.tiers || 9;
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers, w0 = lerp(440, 160, k), w1 = lerp(440, 160, (i + 1) / tiers), y0 = -180 - i * 62, y1 = y0 - 62;
    g.beginPath(); g.moveTo(-w0 / 2, y0); g.lineTo(w0 / 2, y0); g.lineTo(w1 / 2, y1); g.lineTo(-w1 / 2, y1); g.closePath();
    const q = g.createLinearGradient(-w0 / 2, 0, w0 / 2, 0); q.addColorStop(0, shade(col, 0.1)); q.addColorStop(0.55, col); q.addColorStop(1, shade(col, -0.25));
    blob(g, q, 2.5);
    g.fillStyle = shade(col, -0.12); g.fillRect(-w0 / 2 - 6, y0 - 8, w0 + 12, 10);
    const n = Math.max(3, Math.round(w1 / 44));
    for (let j = 0; j < n; j++) { const nx = -w1 / 2 + 12 + j * (w1 - 24) / n; g.fillStyle = shade(col, -0.35); g.fillRect(nx + 4, y0 - 50, (w1 - 24) / n - 10, 34); g.fillStyle = shade(col, -0.05); g.beginPath(); g.ellipse(nx + (w1 - 24) / n / 2 - 1, y0 - 34, 6, 12, 0, 0, TAU); g.fill(); }
  }
  // The barrel-vaulted crown with finials.
  const ty = -180 - tiers * 62;
  g.beginPath(); g.moveTo(-110, ty); g.lineTo(110, ty); g.lineTo(96, ty - 30); g.quadraticCurveTo(0, ty - 110, -96, ty - 30); g.closePath(); blob(g, shade(col, 0.05), 3);
  for (let i = 0; i < 7; i++) { const fx = -84 + i * 28; g.beginPath(); g.moveTo(fx - 7, ty - 44 - Math.sin(i / 6 * Math.PI) * 50); g.lineTo(fx + 7, ty - 44 - Math.sin(i / 6 * Math.PI) * 50); g.lineTo(fx, ty - 74 - Math.sin(i / 6 * Math.PI) * 50); g.closePath(); blob(g, '#d9a441', 1.5); }
  g.restore();
}

// ---- stone halls ------------------------------------------------------------------------------------------------------------
export function pillar(g, x, y, h, o = {}) {
  const col = o.col || '#c8ae90', w = o.w || 40;
  g.fillStyle = shade(col, 0.05); g.fillRect(x - w / 2, y - h, w, h); g.strokeStyle = OL; g.lineWidth = 2.5; g.strokeRect(x - w / 2, y - h, w, h);
  for (const k of [0.15, 0.45, 0.75]) { g.fillStyle = shade(col, -0.15); g.fillRect(x - w / 2 - 4, y - h * k - 14, w + 8, 28); g.strokeRect(x - w / 2 - 4, y - h * k - 14, w + 8, 28); g.fillStyle = shade(col, -0.3); g.beginPath(); g.arc(x, y - h * k, 8, 0, TAU); g.fill(); }
  g.fillStyle = shade(col, -0.1); g.beginPath(); g.moveTo(x - w / 2 - 14, y - h); g.lineTo(x + w / 2 + 14, y - h); g.lineTo(x + w / 2, y - h + 20); g.lineTo(x - w / 2, y - h + 20); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(40,20,10,0.2)'; g.fillRect(x + w * 0.1, y - h + 20, w * 0.4, h - 20);
}
// A colonnade of the bazaar: two storeys of pillared pavilions.
export function colonnade(g, x0, x1, y, o = {}) {
  const col = o.col || '#c8ae90', h = o.h || 260;
  g.fillStyle = shade(col, -0.35); g.fillRect(x0, y - h, x1 - x0, h);
  for (let x = x0 + 30; x < x1; x += 120) pillar(g, x, y, h, { col });
  g.fillStyle = shade(col, -0.05); g.fillRect(x0 - 20, y - h - 30, x1 - x0 + 40, 32); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(x0 - 20, y - h - 30, x1 - x0 + 40, 32);
  // Upper storey.
  g.fillStyle = shade(col, -0.3); g.fillRect(x0, y - h * 1.75 - 30, x1 - x0, h * 0.75);
  for (let x = x0 + 60; x < x1; x += 180) pillar(g, x, y - h - 30, h * 0.75, { col, w: 30 });
  g.fillStyle = shade(col, -0.08); g.fillRect(x0 - 16, y - h * 1.75 - 56, x1 - x0 + 32, 28); g.strokeRect(x0 - 16, y - h * 1.75 - 56, x1 - x0 + 32, 28);
  // A plinth for the sellers.
  g.fillStyle = shade(col, -0.1); g.fillRect(x0 - 10, y - 40, x1 - x0 + 20, 40); g.strokeRect(x0 - 10, y - 40, x1 - x0 + 20, 40);
}
export function gemHeap(g, x, y, s, t, cols = ['#d42a3a', '#f4f4ff', '#f2f0e0', '#2a8a5a', '#3a5ad0']) {
  const r = rng(Math.round(x));
  g.fillStyle = '#7a2a3a'; g.beginPath(); g.ellipse(x, y, 70 * s, 16 * s, 0, 0, TAU); g.fill();
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, rr = r() ** 0.7, gx = x + Math.cos(a) * rr * 55 * s, gy = y - (1 - rr) * 42 * s + Math.sin(a) * rr * 10 * s, col = cols[Math.floor(r() * cols.length)];
    g.fillStyle = col; g.beginPath(); g.moveTo(gx, gy - 5 * s); g.lineTo(gx + 4 * s, gy); g.lineTo(gx, gy + 5 * s); g.lineTo(gx - 4 * s, gy); g.closePath(); g.fill();
    if (Math.sin(t * 5 + i * 1.7) > 0.93) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,240,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx - 9 * s, gy); g.lineTo(gx + 9 * s, gy); g.moveTo(gx, gy - 9 * s); g.lineTo(gx, gy + 9 * s); g.stroke(); g.restore(); }
  }
}

// ---- the stone chariot of the Vittala temple ----------------------------------------------------------------------------------
export function stoneChariot(g, x, y, s = 1, t = 0) {
  const col = '#c2a486';
  g.save(); g.translate(x, y); g.scale(s, s);
  softShadow(g, 0, 0, 420, 34, 0.3);
  // Two stone elephants pulling it.
  elephant(g, 330, 0, { s: 0.55, t: 0, pose: 'stand', howdah: false, grey: '#b89c80', cloth: '#a88c70', trim: '#b89c80' });
  // The platform, carved with friezes.
  g.fillStyle = col; g.fillRect(-230, -150, 420, 150); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(-230, -150, 420, 150);
  for (let i = 0; i < 3; i++) { g.fillStyle = shade(col, -0.12 - i * 0.04); g.fillRect(-230, -150 + i * 48, 420, 12); }
  const r = rng(4); for (let i = 0; i < 30; i++) { g.fillStyle = rgba('#5a3a28', 0.35); g.fillRect(-222 + (i % 10) * 41, -132 + Math.floor(i / 10) * 48, 20 + r() * 10, 22); }
  // Stone wheels.
  for (const wx of [-150, 110]) {
    g.beginPath(); g.arc(wx, -40, 86, 0, TAU); blob(g, shade(col, 0.04), 4);
    for (const rr of [70, 44, 20]) { g.strokeStyle = 'rgba(60,35,20,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(wx, -40, rr, 0, TAU); g.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; g.beginPath(); g.moveTo(wx + Math.cos(a) * 44, -40 + Math.sin(a) * 44); g.lineTo(wx + Math.cos(a) * 70, -40 + Math.sin(a) * 70); g.stroke(); }
  }
  // The shrine on top, with its tower.
  g.fillStyle = col; g.fillRect(-170, -330, 300, 180); g.strokeRect(-170, -330, 300, 180);
  for (let i = 0; i < 4; i++) pillar(g, -150 + i * 86, -150, 180, { col, w: 26 });
  for (let i = 0; i < 4; i++) { const w0 = lerp(320, 140, i / 4), w1 = lerp(320, 140, (i + 1) / 4); g.beginPath(); g.moveTo(-20 - w0 / 2, -330 - i * 50); g.lineTo(-20 + w0 / 2, -330 - i * 50); g.lineTo(-20 + w1 / 2, -380 - i * 50); g.lineTo(-20 - w1 / 2, -380 - i * 50); g.closePath(); blob(g, shade(col, -i * 0.04), 2.5); }
  g.beginPath(); g.arc(-20, -540, 36, Math.PI, 0); g.closePath(); blob(g, shade(col, 0.05), 2.5);
  g.beginPath(); g.moveTo(-28, -574); g.lineTo(-12, -574); g.lineTo(-20, -610); g.closePath(); blob(g, '#d9a441', 1.5);
  g.restore();
  void t;
}
// A singing pillar: a thick core with slender colonettes; `ring` 0..1 makes it glow and shimmer.
export function musicalPillar(g, x, y, h, ring = 0, t = 0, col = '#c9b294') {
  const n = 7, w = 110;
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + i * w / (n - 1), rr = i === 3 ? 30 : 12, shake = ring * Math.sin(t * 90 + i) * 1.5;
    g.fillStyle = shade(col, (i % 2 ? -0.08 : 0.04)); g.fillRect(cx - rr / 2 + shake, y - h, rr, h); g.strokeStyle = OL; g.lineWidth = 2; g.strokeRect(cx - rr / 2 + shake, y - h, rr, h);
    for (const k of [0.2, 0.5, 0.8]) { g.fillStyle = shade(col, -0.2); g.fillRect(cx - rr / 2 - 2 + shake, y - h * k - 6, rr + 4, 12); }
  }
  g.fillStyle = shade(col, -0.1); g.fillRect(x - w / 2 - 40, y - h - 36, w + 80, 38); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(x - w / 2 - 40, y - h - 36, w + 80, 38);
  g.fillRect(x - w / 2 - 30, y - 30, w + 60, 30); g.strokeRect(x - w / 2 - 30, y - 30, w + 60, 30);
  if (ring > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const q = g.createLinearGradient(x - w, 0, x + w, 0); q.addColorStop(0, 'rgba(255,210,120,0)'); q.addColorStop(0.5, rgba('#ffd27a', 0.45 * ring)); q.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = q; g.fillRect(x - w, y - h, w * 2, h); g.restore(); }
}
// A floating music note.
export function musicNote(g, x, y, s, a, col = '#ffe07a') {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(s, s);
  g.fillStyle = col; g.strokeStyle = OL; g.lineWidth = 3;
  g.beginPath(); g.ellipse(0, 0, 14, 10, -0.4, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(12, -4); g.lineTo(12, -54); g.quadraticCurveTo(30, -44, 30, -26); g.stroke();
  g.restore();
}

// ---- the Mahanavami platform, lamps ------------------------------------------------------------------------------------------------
export function dibba(g, x, y, s = 1) {
  const col = '#b8987c';
  g.save(); g.translate(x, y); g.scale(s, s);
  for (let i = 0; i < 3; i++) {
    const w = 1300 - i * 300, h = 110, yy = -i * h;
    g.fillStyle = shade(col, -i * 0.04); g.fillRect(-w / 2, yy - h, w, h); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(-w / 2, yy - h, w, h);
    // Friezes: horses, elephants, dancers in low relief.
    g.fillStyle = rgba('#4a2e1e', 0.4);
    for (let k = 0; k < w / 70; k++) { const fx = -w / 2 + 20 + k * 70, kind = k % 3; if (kind === 0) { g.fillRect(fx, yy - 70, 34, 16); g.fillRect(fx + 4, yy - 54, 4, 16); g.fillRect(fx + 26, yy - 54, 4, 16); g.fillRect(fx + 30, yy - 82, 8, 18); } else if (kind === 1) { g.beginPath(); g.ellipse(fx + 18, yy - 64, 20, 12, 0, 0, TAU); g.fill(); g.fillRect(fx + 34, yy - 64, 6, 22); } else { g.beginPath(); g.arc(fx + 16, yy - 80, 5, 0, TAU); g.fill(); g.fillRect(fx + 13, yy - 75, 6, 18); g.beginPath(); g.moveTo(fx + 6, yy - 60); g.lineTo(fx + 26, yy - 60); g.lineTo(fx + 16, yy - 50); g.fill(); } }
    g.fillStyle = shade(col, 0.1); g.fillRect(-w / 2 - 10, yy - h - 10, w + 20, 12);
  }
  // Steps up the front.
  for (let i = 0; i < 9; i++) { g.fillStyle = shade(col, 0.06 - i * 0.02); g.fillRect(-90 + i * 4, -i * 36, 180 - i * 8, 36); g.strokeStyle = 'rgba(45,26,16,0.6)'; g.lineWidth = 2; g.strokeRect(-90 + i * 4, -i * 36, 180 - i * 8, 36); }
  g.restore();
}
export function lamp(g, x, y, s, t, lit = 1) {
  g.fillStyle = '#b8862a'; g.strokeStyle = OL; g.lineWidth = 2;
  g.fillRect(x - 3 * s, y - 60 * s, 6 * s, 60 * s); g.beginPath(); g.ellipse(x, y - 60 * s, 16 * s, 5 * s, 0, 0, TAU); g.fill(); g.stroke();
  g.fillRect(x - 12 * s, y - 4 * s, 24 * s, 4 * s);
  if (lit > 0) { const f = 1 + 0.15 * Math.sin(t * 17 + x); g.fillStyle = '#ffd05a'; g.beginPath(); g.ellipse(x, y - 70 * s, 5 * s, 11 * s * f, 0, 0, TAU); g.fill(); glow(g, x, y - 70 * s, 60 * s, '#ffb040', 0.5 * lit); }
}
// A round coracle with a boatman.
export function coracle(g, x, y, s, t) {
  g.save(); g.translate(x, y + Math.sin(t * 1.5 + x) * 3); g.scale(s, s);
  g.beginPath(); g.ellipse(0, 0, 90, 26, 0, 0, Math.PI); g.lineTo(-90, 0); g.fillStyle = '#6a4a28'; g.fill(); g.strokeStyle = OL; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.ellipse(0, 0, 90, 20, 0, 0, TAU); g.fillStyle = '#8a6a3a'; g.fill(); g.stroke();
  g.strokeStyle = 'rgba(40,20,10,0.4)'; g.lineWidth = 2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 24, -18); g.quadraticCurveTo(i * 26, 10, i * 20, 24); g.stroke(); }
  g.strokeStyle = '#4a2e1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(30, -90 + Math.sin(t * 2) * 10); g.lineTo(70 + Math.sin(t * 2) * 20, 40); g.stroke();
  g.restore();
}
export function banana(g, x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#7a8a3a'; g.fillRect(-12, -200, 24, 200); g.strokeStyle = OL; g.lineWidth = 2; g.strokeRect(-12, -200, 24, 200);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45 + Math.sin(t * 1.2 + i) * 0.04;
    g.save(); g.translate(0, -200); g.rotate(a + Math.PI / 2);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40, -90, 12, -190); g.quadraticCurveTo(-30, -100, 0, 0); g.fillStyle = i % 2 ? '#4f8f3a' : '#5fa04a'; g.fill(); g.strokeStyle = OL; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(40,60,20,0.5)'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -100, 12, -190); g.stroke();
    g.restore();
  }
  g.restore();
}
