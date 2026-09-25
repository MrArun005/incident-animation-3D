// The Deccan of the Chalukyas: red sandstone, stone temples, an inscription that
// carves itself, war elephants and horses, banners with the Chalukya boar, a map.
import { W, H, TAU, clamp, lerp, rng, mix, shade, rgba, cached, canvas, softShadow, glow } from '../rich/core.js';

const OL = '#2d1a10';
const blob = (g, fill, lw = 3) => { g.fillStyle = fill; g.fill(); g.strokeStyle = OL; g.lineWidth = lw; g.stroke(); };

// ---- sandstone ---------------------------------------------------------------------------------------------------
// A layered rock mass (cached): irregular top, horizontal strata, cracks, light from the upper left.
export function sandstone(g, x, y, w, h, seed = 1, o = {}) {
  const base = o.col || '#b8683f';
  const c = cached(`ss${w}x${h}${seed}${base}`, w + 40, h + 40, (cg) => {
    const r = rng(seed), top = [];
    for (let i = 0; i <= 24; i++) { const k = i / 24; top.push([20 + k * w, 20 + h * (0.05 + 0.25 * (Math.sin(k * 5 + seed) * 0.5 + 0.5) * r() + (Math.abs(k - 0.5) * 2) ** 3 * 0.55)]); }
    cg.beginPath(); cg.moveTo(20, h + 20); for (const p of top) cg.lineTo(...p); cg.lineTo(w + 20, h + 20); cg.closePath();
    const q = cg.createLinearGradient(20, 20, w, h); q.addColorStop(0, shade(base, 0.22)); q.addColorStop(0.6, base); q.addColorStop(1, shade(base, -0.28));
    cg.fillStyle = q; cg.fill(); cg.save(); cg.clip();
    for (let yy = 30; yy < h + 20; yy += 18 + r() * 22) {
      cg.strokeStyle = `rgba(80,30,15,${0.18 + r() * 0.2})`; cg.lineWidth = 2 + r() * 3;
      cg.beginPath(); cg.moveTo(0, yy); for (let xx = 0; xx <= w + 40; xx += 40) cg.lineTo(xx, yy + Math.sin(xx * 0.02 + yy) * 5); cg.stroke();
      cg.strokeStyle = 'rgba(255,210,160,0.18)'; cg.lineWidth = 1.5; cg.beginPath(); cg.moveTo(0, yy - 3); for (let xx = 0; xx <= w + 40; xx += 40) cg.lineTo(xx, yy - 3 + Math.sin(xx * 0.02 + yy) * 5); cg.stroke();
    }
    for (let i = 0; i < w / 60; i++) { const cx = 20 + r() * w; cg.strokeStyle = 'rgba(60,20,10,0.35)'; cg.lineWidth = 2; cg.beginPath(); cg.moveTo(cx, 20 + r() * h * 0.4); cg.lineTo(cx + (r() - 0.5) * 30, 20 + h * (0.5 + r() * 0.5)); cg.stroke(); }
    for (let i = 0; i < 400; i++) { cg.fillStyle = `rgba(${r() < 0.5 ? '60,25,10' : '255,220,180'},${0.06 + r() * 0.1})`; cg.fillRect(20 + r() * w, 20 + r() * h, 2, 2); }
    const sh = cg.createLinearGradient(0, h * 0.5, 0, h + 20); sh.addColorStop(0, 'rgba(40,15,5,0)'); sh.addColorStop(1, 'rgba(40,15,5,0.35)');
    cg.fillStyle = sh; cg.fillRect(0, 0, w + 40, h + 40);
    cg.restore();
    cg.strokeStyle = 'rgba(45,20,10,0.7)'; cg.lineWidth = 3; cg.beginPath(); for (const [i, p] of top.entries()) (i ? cg.lineTo(...p) : cg.moveTo(...p)); cg.stroke();
  });
  g.drawImage(c, x - 20, y - h - 20);
}
export function boulder(g, x, y, rx, ry, seed = 1, col = '#b8683f') {
  const q = g.createRadialGradient(x - rx * 0.35, y - ry * 0.55, rx * 0.1, x, y - ry * 0.3, rx * 1.2);
  q.addColorStop(0, shade(col, 0.25)); q.addColorStop(0.7, col); q.addColorStop(1, shade(col, -0.35));
  const r = rng(seed); g.beginPath();
  for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI, k = 0.9 + r() * 0.15; g.lineTo(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * 2 * k); }
  g.closePath(); blob(g, q, 3);
}

// ---- temples ----------------------------------------------------------------------------------------------------
const STONE = '#c9a47a';
// The Meguti temple (Aihole, 634 CE): a plinth with mouldings, pilastered walls, a flat roof with a
// curved eave, and a small upper shrine. slab: where the inscription panel sits, in local units.
export function megutiTemple(g, x, y, s = 1, o = {}) {
  const col = o.col || STONE;
  g.save(); g.translate(x, y); g.scale(s, s);
  softShadow(g, 30, 0, 460, 40, 0.3);
  // Plinth.
  for (const [yy, hh, ww, k] of [[-40, 40, 860, -0.1], [-70, 30, 820, 0.05], [-90, 20, 840, -0.05]]) { g.fillStyle = shade(col, k); g.fillRect(-ww / 2, yy, ww, hh); g.strokeStyle = 'rgba(45,26,16,0.6)'; g.lineWidth = 2; g.strokeRect(-ww / 2, yy, ww, hh); }
  // Walls with pilasters and niches.
  g.fillStyle = col; g.fillRect(-380, -330, 760, 240); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(-380, -330, 760, 240);
  for (let i = 0; i < 9; i++) { const px = -370 + i * 92; g.fillStyle = shade(col, 0.08); g.fillRect(px, -325, 20, 232); g.fillStyle = 'rgba(60,35,20,0.25)'; g.fillRect(px + 20, -325, 6, 232); }
  for (const nx of [-280, 180]) { g.fillStyle = shade(col, -0.35); g.fillRect(nx, -290, 90, 150); g.fillStyle = shade(col, -0.15); g.beginPath(); g.ellipse(nx + 45, -228, 22, 50, 0, 0, TAU); g.fill(); }
  // Doorway with a porch.
  g.fillStyle = '#2a1a10'; g.fillRect(-60, -250, 120, 160); g.strokeStyle = OL; g.strokeRect(-60, -250, 120, 160);
  for (const px of [-120, 100]) { g.fillStyle = shade(col, 0.05); g.fillRect(px, -300, 22, 210); g.strokeRect(px, -300, 22, 210); }
  // Roof slab with a curved eave (kapota).
  g.fillStyle = shade(col, -0.05); g.beginPath(); g.moveTo(-420, -330); g.lineTo(420, -330); g.quadraticCurveTo(430, -356, 400, -372); g.lineTo(-400, -372); g.quadraticCurveTo(-430, -356, -420, -330); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(40,20,10,0.25)'; g.fillRect(-380, -330, 760, 12);
  // Upper shrine.
  g.fillStyle = col; g.fillRect(-120, -500, 240, 128); g.strokeRect(-120, -500, 240, 128);
  for (let i = 0; i < 4; i++) { g.fillStyle = shade(col, 0.08); g.fillRect(-112 + i * 70, -495, 16, 120); }
  g.fillStyle = shade(col, -0.05); g.fillRect(-140, -520, 280, 22); g.strokeRect(-140, -520, 280, 22);
  // The inscription panel on the east wall.
  if (o.slab !== false) { g.fillStyle = shade(col, -0.12); g.fillRect(150, -320, 210, 110); g.strokeStyle = 'rgba(45,26,16,0.7)'; g.strokeRect(150, -320, 210, 110);
    const r = rng(9); g.fillStyle = 'rgba(50,30,15,0.55)'; for (let ly = 0; ly < 7; ly++) for (let lx = 0; lx < 18; lx++) if (r() < 0.9) g.fillRect(158 + lx * 11, -312 + ly * 15, 7, 8); }
  // Weathering.
  const r = rng(3); for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,35,20' : '255,235,200'},${0.05 + r() * 0.1})`; g.fillRect(-420 + r() * 840, -520 + r() * 520, 3, 3); }
  g.restore();
}
// A small temple with a curved northern-style tower (shikhara), as in the Aihole temple clusters.
export function shikharaTemple(g, x, y, s = 1, col = STONE) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = shade(col, -0.08); g.fillRect(-110, -40, 220, 40); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(-110, -40, 220, 40);
  g.fillStyle = col; g.fillRect(-90, -170, 180, 130); g.strokeRect(-90, -170, 180, 130);
  g.fillStyle = '#2a1a10'; g.fillRect(-26, -130, 52, 90);
  g.beginPath(); g.moveTo(-80, -170); g.quadraticCurveTo(-78, -330, 0, -380); g.quadraticCurveTo(78, -330, 80, -170); g.closePath();
  const q = g.createLinearGradient(-80, 0, 80, 0); q.addColorStop(0, shade(col, 0.15)); q.addColorStop(1, shade(col, -0.2)); blob(g, q, 3);
  g.save(); g.clip(); g.strokeStyle = 'rgba(60,35,20,0.4)'; g.lineWidth = 2; for (let yy = -180; yy > -380; yy -= 18) { g.beginPath(); g.moveTo(-90, yy); g.lineTo(90, yy); g.stroke(); } g.restore();
  g.beginPath(); g.ellipse(0, -388, 30, 12, 0, 0, TAU); blob(g, shade(col, 0.05), 2.5);
  g.beginPath(); g.moveTo(-6, -398); g.lineTo(0, -430); g.lineTo(6, -398); blob(g, '#d9a441', 2);
  g.restore();
}

// ---- the inscription ------------------------------------------------------------------------------------------------
// An Old-Kannada-looking glyph: a body of loops and hooks, sometimes a vowel mark on top.
export function glyph(g, x, y, sz, seed) {
  const r = rng(seed);
  g.save(); g.translate(x, y); g.scale(sz / 20, sz / 20); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  const kind = Math.floor(r() * 5);
  if (kind === 0) { g.arc(0, 4, 7, Math.PI * 0.1, Math.PI * 1.9); g.moveTo(7, 4); g.lineTo(9, -6); }
  else if (kind === 1) { g.moveTo(-8, -4); g.quadraticCurveTo(-8, 10, 0, 10); g.quadraticCurveTo(8, 10, 8, 0); g.arc(3, 0, 5, 0, Math.PI, true); }
  else if (kind === 2) { g.moveTo(-8, 10); g.lineTo(-8, -2); g.quadraticCurveTo(0, -10, 8, -2); g.lineTo(8, 10); g.moveTo(-8, 4); g.lineTo(8, 4); }
  else if (kind === 3) { g.arc(-3, 3, 5, 0, TAU); g.moveTo(2, 3); g.quadraticCurveTo(10, 3, 9, 10); }
  else { g.moveTo(-7, -2); g.quadraticCurveTo(0, -8, 7, -2); g.quadraticCurveTo(10, 8, 0, 10); g.quadraticCurveTo(-8, 10, -6, 4); }
  if (r() < 0.55) { g.moveTo(-4, -9); g.quadraticCurveTo(0, -14, 5, -10); }
  g.stroke();
  g.restore();
}
// A panel of glyph lines; reveal carves them in reading order; glow lights the carved letters.
export function inscription(g, x, y, w, h, o = {}) {
  const rows = o.rows || 7, cols = o.cols || 16, reveal = o.reveal ?? 1, glowA = o.glow || 0;
  g.fillStyle = o.col || '#b99470'; g.fillRect(x, y, w, h);
  const q = g.createLinearGradient(x, y, x + w, y + h); q.addColorStop(0, 'rgba(255,235,200,0.18)'); q.addColorStop(1, 'rgba(40,20,10,0.25)');
  g.fillStyle = q; g.fillRect(x, y, w, h); g.strokeStyle = OL; g.lineWidth = 3; g.strokeRect(x, y, w, h);
  const total = rows * cols, n = Math.floor(total * reveal), cw = (w - 40) / cols, rh = (h - 30) / rows;
  for (let i = 0; i < n; i++) {
    const gx = x + 20 + (i % cols) * cw + cw / 2, gy = y + 18 + Math.floor(i / cols) * rh + rh / 2;
    g.strokeStyle = 'rgba(255,235,205,0.45)'; g.lineWidth = 3.6; glyph(g, gx + 1, gy + 1.5, Math.min(cw, rh) * 0.8, i * 7 + 3);
    g.strokeStyle = 'rgba(55,30,15,0.9)'; g.lineWidth = 3; glyph(g, gx, gy, Math.min(cw, rh) * 0.8, i * 7 + 3);
    if (glowA > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ffd27a', glowA); g.lineWidth = 3; g.shadowColor = '#ffb040'; g.shadowBlur = 14; glyph(g, gx, gy, Math.min(cw, rh) * 0.8, i * 7 + 3); g.restore(); }
  }
  return n < total ? [x + 20 + (n % cols) * cw + cw / 2, y + 18 + Math.floor(n / cols) * rh + rh / 2] : null;
}

// ---- the war elephant -------------------------------------------------------------------------------------------------
// Faces +x. pose: walk | stand | kneel | stuck (sunk in the river) ; trunk: 0 hanging .. 1 raised to trumpet.
// Returns the howdah seat (world) for a rider.
export function elephant(g, x, y, o = {}) {
  const s = o.s || 1, dir = o.dir || 1, t = o.t || 0, ph = o.ph || 0, pose = o.pose || 'walk', trunk = o.trunk || 0;
  const GREY = o.grey || '#8d8a94', GD = shade(GREY, -0.2), cloth = o.cloth || '#b0302a', trim = o.trim || '#e7b33c';
  g.save(); g.translate(x, y); g.scale(dir * s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  if (pose !== 'stuck') softShadow(g, 0, 4, 190, 20, 0.3);
  const kneel = pose === 'kneel' ? 1 : 0, tilt = kneel * 0.16;
  g.rotate(tilt);
  const leg = (lx, k, col) => {
    const a = pose === 'walk' ? Math.sin(ph + k) * 0.28 : 0;
    const h = kneel && lx > 0 ? 60 : 150;
    g.strokeStyle = OL; g.lineWidth = 58; g.beginPath(); g.moveTo(lx, -130); g.lineTo(lx + Math.sin(a) * h, -130 + h - (kneel && lx > 0 ? 0 : 4)); g.stroke();
    g.strokeStyle = col; g.lineWidth = 52; g.stroke();
    g.fillStyle = shade(col, 0.3); for (const tx of [-12, 2, 16]) { g.beginPath(); g.arc(lx + Math.sin(a) * h + tx, -130 + h - 6, 5, 0, TAU); g.fill(); }
  };
  leg(-95, Math.PI, GD); leg(95, 0, GD);
  // Tail.
  g.strokeStyle = OL; g.lineWidth = 7; g.beginPath(); g.moveTo(-160, -200); g.quadraticCurveTo(-190, -150 + Math.sin(t * 3) * 10, -182, -100); g.stroke();
  // Body.
  g.beginPath(); g.ellipse(0, -185, 170, 100, 0, 0, TAU);
  const bq = g.createLinearGradient(0, -285, 0, -85); bq.addColorStop(0, shade(GREY, 0.18)); bq.addColorStop(1, shade(GREY, -0.25)); blob(g, bq, 4);
  // Caparison with a gold border, a diamond pattern and bells.
  g.beginPath(); g.moveTo(-130, -265); g.quadraticCurveTo(0, -300, 130, -265); g.lineTo(140, -140); g.quadraticCurveTo(0, -120, -140, -140); g.closePath(); blob(g, cloth, 3);
  g.save(); g.clip();
  g.fillStyle = rgba(trim, 0.85); for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) { const px = -110 + i * 36 + (j % 2) * 18, py = -240 + j * 34; g.beginPath(); g.moveTo(px, py - 10); g.lineTo(px + 8, py); g.lineTo(px, py + 10); g.lineTo(px - 8, py); g.closePath(); g.fill(); }
  g.restore();
  g.strokeStyle = trim; g.lineWidth = 10; g.beginPath(); g.moveTo(-140, -140); g.quadraticCurveTo(0, -120, 140, -140); g.stroke();
  for (let i = 0; i < 7; i++) { const bx = -120 + i * 40, by = -134 + Math.abs(i - 3) * -2; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + 10); g.stroke(); g.beginPath(); g.arc(bx, by + 15, 6, 0, TAU); blob(g, '#e7b33c', 1.5); }
  leg(-60, 0, GREY); leg(125, Math.PI, GREY);
  // Head, ear, tusk, trunk.
  const hx = 165, hy = -210;
  const ear = 1 + Math.sin(t * 2.2) * 0.06;
  g.save(); g.translate(hx - 40, hy + 10); g.scale(ear, 1); g.beginPath(); g.ellipse(0, 0, 58, 82, -0.15, 0, TAU); blob(g, shade(GREY, -0.05), 3.5); g.restore();
  g.beginPath(); g.arc(hx, hy, 78, 0, TAU); blob(g, GREY, 4);
  g.beginPath(); g.moveTo(hx - 30, hy - 70); g.quadraticCurveTo(hx + 30, hy - 96, hx + 62, hy - 40); g.lineTo(hx + 40, hy - 10); g.quadraticCurveTo(hx + 10, hy - 50, hx - 30, hy - 50); g.closePath(); blob(g, trim, 2.5);  // gold head plate
  g.beginPath(); g.arc(hx + 30, hy - 40, 8, 0, TAU); blob(g, '#c0302a', 2);
  const tr = trunk, sw = Math.sin(t * 1.7) * 0.15 * (1 - tr);
  const tx1 = hx + 90 + tr * 40, ty1 = hy + 80 - tr * 150, tx2 = hx + 70 + sw * 60 + tr * 110, ty2 = hy + 190 - tr * 330;
  g.strokeStyle = OL; g.lineWidth = 50; g.beginPath(); g.moveTo(hx + 55, hy + 20); g.quadraticCurveTo(tx1, ty1, tx2, ty2); g.stroke();
  g.strokeStyle = GREY; g.lineWidth = 43; g.stroke();
  g.strokeStyle = OL; g.lineWidth = 22; g.beginPath(); g.moveTo(hx + 55, hy + 20); g.quadraticCurveTo(tx1, ty1, tx2, ty2); g.globalAlpha = 0; g.stroke(); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(40,30,40,0.35)'; g.lineWidth = 2; for (let k = 0.2; k < 1; k += 0.1) { const px = (1 - k) ** 2 * (hx + 55) + 2 * (1 - k) * k * tx1 + k * k * tx2, py = (1 - k) ** 2 * (hy + 20) + 2 * (1 - k) * k * ty1 + k * k * ty2; g.beginPath(); g.arc(px, py, 16, -0.5, 0.5); g.stroke(); }
  if (tr > 0.5) { g.fillStyle = '#5a2a2a'; g.beginPath(); g.ellipse(hx + 60, hy + 40, 16, 12, 0, 0, TAU); g.fill(); }
  g.beginPath(); g.moveTo(hx + 40, hy + 30); g.quadraticCurveTo(hx + 120, hy + 70, hx + 150, hy + 10); g.quadraticCurveTo(hx + 110, hy + 50, hx + 40, hy + 44); g.closePath(); blob(g, '#f4eee0', 3);   // tusk
  g.fillStyle = '#1a100c'; g.beginPath(); g.arc(hx + 18, hy - 12, 6, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 20, hy - 14, 2, 0, TAU); g.fill();
  g.strokeStyle = OL; g.lineWidth = 3; g.beginPath(); g.arc(hx + 18, hy - 12, 11, Math.PI * 1.1, Math.PI * 1.8); g.stroke();
  // Howdah.
  let seat = null;
  if (o.howdah !== false) {
    g.beginPath(); g.moveTo(-80, -280); g.lineTo(80, -280); g.lineTo(70, -340); g.lineTo(-70, -340); g.closePath(); blob(g, trim, 3);
    g.strokeStyle = shade(trim, -0.35); g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-60 + i * 30, -282); g.lineTo(-56 + i * 28, -338); g.stroke(); }
    if (o.canopy) { for (const px of [-66, 62]) { g.strokeStyle = OL; g.lineWidth = 6; g.beginPath(); g.moveTo(px, -340); g.lineTo(px, -470); g.stroke(); }
      g.beginPath(); g.moveTo(-90, -470); g.quadraticCurveTo(0, -560, 90, -470); g.closePath(); blob(g, o.canopy, 3);
      g.strokeStyle = trim; g.lineWidth = 5; g.beginPath(); g.moveTo(-90, -470); g.lineTo(90, -470); g.stroke(); }
    seat = [x + dir * s * 0 , y + s * (-330 * Math.cos(tilt))];
  }
  g.restore();
  return { seat, trunkTip: [x + dir * s * tx2, y + s * ty2] };
}
// A horse, facing +x; returns the saddle point.
export function horse(g, x, y, o = {}) {
  const s = o.s || 1, dir = o.dir || 1, ph = o.ph || 0, gallop = o.gallop ?? 0, rear = o.rear || 0;
  const COAT = o.coat || '#e8e2d6', CD = shade(COAT, -0.2);
  g.save(); g.translate(x, y); g.scale(dir * s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  softShadow(g, 0, 3, 110, 12, 0.28);
  g.rotate(-rear * 0.35);
  const leg = (hx, k, col) => {
    const a = gallop ? Math.sin(ph + k) * 0.7 : Math.sin(ph + k) * 0.08, b = gallop ? Math.max(0, Math.sin(ph + k + 1)) * 1.2 : 0.1;
    const kx = hx + Math.sin(a) * 50, ky = -85 + Math.cos(a) * 50, fx = kx + Math.sin(a - b) * 48, fy = ky + Math.cos(a - b) * 48;
    g.strokeStyle = OL; g.lineWidth = 16; g.beginPath(); g.moveTo(hx, -110); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    g.strokeStyle = col; g.lineWidth = 11; g.stroke();
    g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(fx + 3, fy + 2, 8, 5, 0, 0, TAU); g.fill();
  };
  leg(-60, Math.PI, CD); leg(62, 0.6, CD);
  g.strokeStyle = shade(COAT, -0.45); g.lineWidth = 12; g.beginPath(); g.moveTo(-95, -140); g.quadraticCurveTo(-140, -120, -135, -60); g.stroke();
  g.beginPath(); g.ellipse(0, -130, 100, 42, 0, 0, TAU); blob(g, COAT, 3.5);
  // Neck and head.
  g.beginPath(); g.moveTo(60, -155); g.quadraticCurveTo(95, -230, 130, -250); g.lineTo(175, -215); g.quadraticCurveTo(180, -200, 160, -196); g.lineTo(130, -205); g.quadraticCurveTo(110, -150, 90, -110); g.closePath(); blob(g, COAT, 3.5);
  g.fillStyle = shade(COAT, -0.5); g.beginPath(); g.moveTo(62, -160); g.quadraticCurveTo(90, -235, 128, -256); g.lineTo(120, -236); g.quadraticCurveTo(92, -210, 75, -150); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(128, -250); g.lineTo(122, -275); g.lineTo(138, -256); blob(g, COAT, 2);
  g.fillStyle = '#1a100c'; g.beginPath(); g.arc(142, -232, 4, 0, TAU); g.fill();
  // Saddle cloth.
  g.beginPath(); g.moveTo(-50, -170); g.lineTo(40, -170); g.lineTo(46, -110); g.lineTo(-56, -110); g.closePath(); blob(g, o.cloth || '#b0302a', 3);
  g.strokeStyle = '#e7b33c'; g.lineWidth = 5; g.beginPath(); g.moveTo(-56, -112); g.lineTo(46, -112); g.stroke();
  leg(-40, 0, COAT); leg(80, Math.PI + 0.6, COAT);
  g.restore();
  return [x + dir * s * -5, y + s * (-170 + rear * 30)];
}

// ---- banners, arms -------------------------------------------------------------------------------------------------
export function banner(g, x, y, h, col, t, o = {}) {
  g.strokeStyle = '#4a2e1a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
  const w = o.w || 110, n = 8;
  g.beginPath(); g.moveTo(x, y - h);
  for (let i = 0; i <= n; i++) { const k = i / n; g.lineTo(x + k * w, y - h + Math.sin(t * 6 - k * 4) * 10 * k + k * 10); }
  for (let i = n; i >= 0; i--) { const k = i / n; g.lineTo(x + k * w * 0.92, y - h + 60 - k * 22 + Math.sin(t * 6 - k * 4) * 10 * k); }
  g.closePath(); blob(g, col, 2.5);
  if (o.boar) boar(g, x + w * 0.42, y - h + 30 + Math.sin(t * 6 - 1.6) * 4, 0.5, o.boarCol || '#f2d27a');
}
// The Chalukya emblem: the boar (Varaha).
export function boar(g, x, y, s = 1, col = '#f2d27a') {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col;
  g.beginPath(); g.ellipse(0, 0, 34, 18, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(26, -10); g.lineTo(52, -2); g.lineTo(50, 8); g.lineTo(24, 10); g.fill();
  g.beginPath(); g.moveTo(-20, -14); g.lineTo(-10, -26); g.lineTo(6, -16); g.fill();
  g.fillRect(-24, 12, 7, 14); g.fillRect(-6, 12, 7, 14); g.fillRect(10, 12, 7, 14); g.fillRect(22, 10, 7, 14);
  g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(46, 4); g.quadraticCurveTo(52, -10, 44, -14); g.stroke();
  g.restore();
}
export function spear(g, x, y, len, ang, col = '#5a3a1e') {
  const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
  g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - Math.sin(ang) * len * 0.25, y + Math.cos(ang) * len * 0.25); g.lineTo(ex, ey); g.stroke();
  g.save(); g.translate(ex, ey); g.rotate(ang); g.beginPath(); g.moveTo(0, -24); g.lineTo(7, 2); g.lineTo(-7, 2); g.closePath(); blob(g, '#c9c9d2', 2); g.restore();
}
export function shield(g, x, y, r, col = '#8a4a2a', boss = '#e7b33c') {
  g.beginPath(); g.arc(x, y, r, 0, TAU); blob(g, col, 3);
  g.strokeStyle = boss; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.22, 0, TAU); blob(g, boss, 2);
}
export function sword(g, x, y, len, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 0); g.quadraticCurveTo(10, -len * 0.6, 0, -len); g.quadraticCurveTo(-4, -len * 0.6, -4, 0); blob(g, '#dfe2ea', 2);
  g.fillStyle = '#e7b33c'; g.fillRect(-16, -2, 32, 7); g.fillStyle = '#6a4424'; g.fillRect(-4, 5, 8, 20);
  g.restore();
}

// ---- a map of the subcontinent ----------------------------------------------------------------------------------------------
const OUTLINE = [[68.5, 23.5], [70, 21], [72.8, 21], [73, 18.9], [73.8, 15.5], [74.8, 12.9], [76.3, 9.9], [77.5, 8.1], [78.2, 8.9], [79.8, 10.3], [80.3, 13], [80.2, 15.5], [82.3, 16.7], [83.3, 17.7], [85.8, 19.8], [87, 21.5], [88.3, 22], [89.5, 21.8], [91.8, 22.3], [92.5, 24], [95, 26.5], [97, 28], [93.5, 28.8], [88.5, 27.6], [84, 28.3], [81, 30], [79, 31], [77, 33], [75, 35.5], [74, 37], [71.5, 36], [70, 34], [69, 31], [67.2, 28], [66.5, 25.3], [67.5, 24], [68.5, 23.5]];
const NARMADA = [[81.7, 22.7], [80, 23.1], [77.5, 22.5], [75.5, 22.2], [73.8, 21.9], [72.6, 21.6]];
const GANGA = [[78.9, 30.1], [79.5, 28], [80, 27], [81.9, 25.4], [83, 25.3], [85.1, 25.6], [87.9, 24.8], [88.3, 22.4]];
export function mapIndia(g, cx, cy, s, o = {}) {
  const P = ([lon, lat]) => [cx + (lon - 81) * s, cy - (lat - 22) * s * 1.05];
  const path = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p)))); };
  // Parchment ground.
  g.fillStyle = '#e9d9b4'; g.fillRect(0, 0, W, H);
  const r = rng(5); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,80,40,${0.03 + r() * 0.05})`; g.fillRect(r() * W, r() * H, 3, 3); }
  const vq = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H); vq.addColorStop(0, 'rgba(90,50,20,0)'); vq.addColorStop(1, 'rgba(90,50,20,0.45)'); g.fillStyle = vq; g.fillRect(0, 0, W, H);
  // The sea around it.
  g.fillStyle = 'rgba(80,130,150,0.25)'; g.fillRect(0, 0, W, H);
  path(OUTLINE); g.closePath(); g.fillStyle = '#e4cf9e'; g.fill(); g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; g.stroke();
  // Kingdoms: Harsha's north, the Chalukyas' Deccan.
  g.save(); path(OUTLINE); g.closePath(); g.clip();
  if (o.north) { const [, ny] = P([0, 22.6]); g.fillStyle = rgba('#3f7a5a', 0.35 * o.north); g.fillRect(0, 0, W, ny); }
  if (o.south) { const [, ny] = P([0, 22.4]), [, sy] = P([0, 14.5]); g.fillStyle = rgba('#b0302a', 0.35 * o.south); g.fillRect(0, ny, W, sy - ny); }
  g.restore();
  g.strokeStyle = '#3a78a0'; g.lineWidth = 5; path(GANGA); g.stroke();
  g.strokeStyle = '#3a78a0'; g.lineWidth = 6 + (o.narmada || 0) * 6; path(NARMADA); g.stroke();
  if (o.narmada) { g.save(); g.shadowColor = '#7ad0ff'; g.shadowBlur = 20 * o.narmada; g.strokeStyle = rgba('#9ae0ff', o.narmada); g.lineWidth = 5; path(NARMADA); g.stroke(); g.restore(); }
  const label = (txt, p, size = 30, col = '#3a2412') => { const [x, y] = P(p); g.font = `700 ${size}px "Liberation Serif", Georgia, serif`; g.textAlign = 'center'; g.fillStyle = col; g.fillText(txt, x, y); };
  const dot = (p) => { const [x, y] = P(p); g.beginPath(); g.arc(x, y, 9, 0, TAU); blob(g, '#b0302a', 2.5); };
  if (o.north) { label("HARSHA'S EMPIRE", [79.5, 26.2], 34, '#1f4a34'); dot([79.9, 27.05]); label('Kannauj', [80.6, 27.8], 26); }
  if (o.south) { label('CHALUKYAS', [76.5, 18.2], 34, '#7a1f1a'); dot([75.7, 15.9]); label('Vatapi (Badami)', [76.3, 15.1], 26); }
  label('Narmada', [77.2, 21.4], 26, '#1f4a6a');
  if (o.arrow > 0) {
    const a = [80, 26.4], b = [78.6, lerp(26.4, 22.8, o.arrow)];
    const [ax, ay] = P(a), [bx, by] = P(b);
    g.strokeStyle = '#1f4a34'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(ax - 40, (ay + by) / 2, bx, by); g.stroke();
    g.fillStyle = '#1f4a34'; g.beginPath(); g.moveTo(bx - 22, by - 10); g.lineTo(bx + 22, by - 10); g.lineTo(bx, by + 22); g.closePath(); g.fill();
  }
}

// ---- Badami: red cliffs with the cave temples cut into them ------------------------------------------------------------------
export function badamiCliff(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  sandstone(g, -700, 0, 1400, 620, 31, { col: '#b25a36' });
  for (const [cx, cy, w] of [[-420, -150, 190], [-120, -260, 220], [200, -200, 200], [470, -120, 170]]) {
    g.fillStyle = '#9a4a2c'; g.fillRect(cx - w / 2 - 14, cy - 150, w + 28, 170);
    g.fillStyle = '#1e120c'; g.fillRect(cx - w / 2, cy - 130, w, 150);
    for (let i = 0; i < 5; i++) { const px = cx - w / 2 + 10 + i * (w - 30) / 4; g.fillStyle = '#b86a44'; g.fillRect(px, cy - 130, 14, 150); g.strokeStyle = OL; g.lineWidth = 2; g.strokeRect(px, cy - 130, 14, 150); }
    g.fillStyle = '#c47a50'; g.fillRect(cx - w / 2 - 20, cy + 20, w + 40, 14); g.strokeRect(cx - w / 2 - 20, cy + 20, w + 40, 14);
  }
  g.restore();
}
export { canvas };
