// "Clawd: Coming Up": a small, glitched Clawd at the bottom of an old arcade screen tries to climb to the
// glow at the top, falls again and again, finds the other fallen Clawds in the dark, and they climb together
// until they break through the top of the screen into deep space, where each one turns solid. Wordless:
// music and sound only (tools/audio-comingup.mjs). 1920x1080, 30 fps.
// The arcade is real pixel art: drawn on a 320x180 buffer in world pixels and scaled up 6x, nearest
// neighbour. Space, and every Clawd that has crossed into it, is drawn at full resolution with depth.
// Every beat time is in stories/comingup.beats.json, shared with the soundtrack.
import B from '../stories/comingup.beats.json' with { type: 'json' };

const W = 1920, H = 1080, FPS = 30, DURATION = B.duration, LW = 320, LH = 180, SC = W / LW;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const lb = document.createElement('canvas'); lb.width = LW; lb.height = LH;
const lg = lb.getContext('2d');
const FONT = '"Liberation Sans", Arial, sans-serif';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = (n) => { const r = rng(n * 7919 + 13); return r(); };
const SCN = Object.fromEntries(B.scenes.map(([id, t0], i) => [id, [t0, i + 1 < B.scenes.length ? B.scenes[i + 1][1] : DURATION]]));
const sceneAt = (t) => { let s = B.scenes[0][0]; for (const [id, t0] of B.scenes) if (t >= t0) s = id; return s; };

// ---- assets -----------------------------------------------------------------------------------------
const IMG = {};
const load = (k, src) => new Promise((res) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => res(); i.src = src; });
let RING = null;                                   // Saturn's ring colours, inner -> outer, [r, g, b, a]
const ready = Promise.all([
  load('sky', 'assets/comingup/sky-2k.jpg'), load('jupiter', 'assets/comingup/planet-jupiter.jpg'),
  load('saturn', 'assets/comingup/planet-saturn.jpg'), load('earth', 'assets/comingup/planet-earth.jpg'),
  load('neptune', 'assets/comingup/planet-neptune.jpg'), load('mars', 'assets/comingup/planet-mars.jpg'),
  load('rings', 'assets/comingup/planet-rings.png'),
]).then(() => {
  if (!IMG.rings) return;
  const k = document.createElement('canvas'); k.width = 256; k.height = 1; const kg = k.getContext('2d');
  kg.drawImage(IMG.rings, 0, 0, 256, 1); const d = kg.getImageData(0, 0, 256, 1).data;
  RING = Array.from({ length: 256 }, (_, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3] / 255]);
});

// ---- the world: an arcade tower in world pixels (y up is negative; the dead-pixel floor is y = 0) -----
const PL = Array.from({ length: 13 }, (_, k) => ({ x: 160 + (k % 2 ? 50 : -50) + (hash(k + 3) - 0.5) * 16, y: -36 * (k + 1), w: 36 + Math.round(hash(k + 40) * 10) }));
const TOPY = -36 * 14 - 6;                         // the glow line (the high-score line) and later the crack
const STAND = (k) => (k < 0 ? { x: 160, y: 0 } : { x: PL[k].x, y: PL[k].y });
const PILE = (() => {                               // the heap of dead pixels: dim squares in mounds
  const r = rng(5), out = [];
  for (let i = 0; i < 1400; i++) {
    const x = r() * 340 - 10, mound = 4 + 5 * Math.sin(x * 0.045 + 1.3) + 3 * Math.sin(x * 0.13), y = -(r() ** 2) * Math.max(0, mound);
    const v = 18 + r() * 40, tint = r();
    out.push([Math.round(x), Math.round(y), tint < 0.1 ? `rgb(${v + 30},${v * 0.6},${v})` : tint < 0.2 ? `rgb(${v * 0.6},${v},${v + 20})` : `rgb(${v},${v},${v + 8})`]);
  }
  return out;
})();
// The other fallen Clawds, half buried in the pile; ours is at x = 160.
const OTHERS = [44, 78, 112, 186, 214, 246, 278, 22, 132, 300, 64, 232].map((x, i) => ({ x, i, dir: x < 160 ? 1 : -1, lit: B.blip + 2.2 + i * 0.55 }));

// ---- camera (world pixel at the centre of the buffer, integer zoom) ------------------------------------
let CX = 160, CY = -60, Z = 1;
const LX = (wx) => Math.round(LW / 2 + (wx - CX) * Z), LY = (wy) => Math.round(LH / 2 + (wy - CY) * Z);
const toFull = (wx, wy) => [(LW / 2 + (wx - CX) * Z) * SC, (LH / 2 + (wy - CY) * Z) * SC];
const rect = (wx, wy, w, h, col) => { lg.fillStyle = col; const x0 = LX(wx), y0 = LY(wy), x1 = LX(wx + w), y1 = LY(wy + h); lg.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)); };

// ---- colour ------------------------------------------------------------------------------------------
const ORANGE = [204, 127, 97], TOP = [221, 154, 128], DEAD = [40, 34, 44];
const mix = (a, b, k) => `rgb(${Math.round(lerp(b[0], a[0], k))},${Math.round(lerp(b[1], a[1], k))},${Math.round(lerp(b[2], a[2], k))})`;

// ---- Clawd in the arcade (11 x 11 world pixels, feet at wx, wy) ---------------------------------------
// pose: stand | jump | curl | lie | reach | hang; dim 0..1 (1 = full colour); glow 0..1; flick: the bad leg
function clawdPx(wx, wy, o = {}) {
  const { dir = 1, dim = 1, pose = 'stand', eyeUp = 0, flick = false, t = 0, squash = 0 } = o;
  const col = mix(ORANGE, DEAD, dim), top = mix(TOP, DEAD, dim), eye = dim < 0.25 ? '#3a3340' : '#111';
  const sx = (cx, w) => (dir > 0 ? cx : 11 - cx - w);
  const P = (cx, cy, w, h, cc = col) => rect(wx - 5.5 + sx(cx, w), wy - 11 + cy, w, h, cc);
  let by = 0, legH = 3, eyeH = 1.4, bodyH = 8;
  if (pose === 'curl') { by = 3; legH = 0.6; bodyH = 7; }
  if (pose === 'lie') { by = 5; legH = 0; bodyH = 6; eyeH = 0.4; }
  if (pose === 'jump') legH = 3.6;
  by += squash;
  P(1, by, 9, bodyH); P(1, by, 9, 1, top);
  P(0, by + 3, 1, 2);
  if (pose === 'reach') P(10, by + 3.5, 5, 1.6); else if (pose === 'hang') P(10, by - 2, 1, 4); else P(10, by + 3, 1, 2);
  if (legH > 0) for (const lx of [1, 3, 7, 9]) {
    if (lx === 9 && flick && (Math.floor(t * 17) % 7 < 2)) { P(lx + 0.6, by + bodyH + 0.5, 1, legH * 0.6, '#7fd4ff'); continue; }
    const kick = pose === 'jump' ? (lx < 5 ? -0.5 : 0.5) : 0;
    P(lx + kick, by + bodyH, 1, legH);
  }
  const blink = (t % 3.3) < 0.12 || pose === 'lie';
  const eh = blink ? 0.4 : eyeH, ey = by + 3 - eyeUp + (blink ? 0.6 : 0);
  P(2, ey, 1, eh, eye); P(8, ey, 1, eh, eye);
}
function glowPx(wx, wy, k, col = '255,170,120') {
  if (k <= 0.01) return;
  const [x, y] = [LW / 2 + (wx - CX) * Z, LH / 2 + (wy - 6 - CY) * Z], r = (10 + 14 * k) * Z;
  lg.save(); lg.globalCompositeOperation = 'lighter';
  const gr = lg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${0.45 * k})`); gr.addColorStop(1, `rgba(${col},0)`);
  lg.fillStyle = gr; lg.fillRect(x - r, y - r, 2 * r, 2 * r); lg.restore();
}

// ---- Clawd with depth (full resolution): each sprite cell extruded into a block, lit from the upper right
function clawd3D(X, Y, cell, o = {}) {
  const { depth = 1, glow = 1, dir = 1, pose = 'stand', t = 0, eyeUp = 0, flick = false, dim = 1 } = o;
  const dx = cell * 0.85 * depth, dy = -cell * 0.7 * depth;
  const face = mix(ORANGE, DEAD, dim), topc = mix([245, 190, 160], DEAD, dim), side = mix([150, 84, 62], DEAD, dim);
  if (glow > 0.01) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const r = cell * 16, gr = g.createRadialGradient(X, Y - cell * 6, 0, X, Y - cell * 6, r);
    gr.addColorStop(0, `rgba(255,170,110,${0.32 * glow})`); gr.addColorStop(0.4, `rgba(255,130,80,${0.12 * glow})`); gr.addColorStop(1, 'rgba(255,120,80,0)');
    g.fillStyle = gr; g.fillRect(X - r, Y - cell * 6 - r, 2 * r, 2 * r); g.restore();
  }
  const cells = [];
  const sx = (cx, w) => (dir > 0 ? cx : 11 - cx - w);
  const add = (cx, cy, w, h, kind = 'body') => cells.push([sx(cx, w), cy, w, h, kind]);
  const lift = pose === 'hang' ? -1 : 0;
  add(1, 0, 9, 8); add(0, 3, 1, 2);
  if (pose === 'hang') add(10, -2, 1, 4); else if (pose === 'reach') add(10, 3.5, 5, 1.6); else add(10, 3, 1, 2);
  for (const lx of [1, 3, 7, 9]) { if (lx === 9 && flick && (Math.floor(t * 17) % 7 < 2)) continue; add(lx, 8, 1, pose === 'hang' ? 3.4 : 3); }
  const x0 = X - 5.5 * cell, y0 = Y - 11 * cell + lift * cell;
  // sides and tops first (back to front: right-most and top-most last is fine for these convex blocks)
  for (const [cx, cy, w, h] of cells) {
    const L = x0 + cx * cell, T = y0 + cy * cell, R = L + w * cell, Bt = T + h * cell;
    g.fillStyle = side; g.beginPath(); g.moveTo(R, T); g.lineTo(R + dx, T + dy); g.lineTo(R + dx, Bt + dy); g.lineTo(R, Bt); g.closePath(); g.fill();
    g.fillStyle = topc; g.beginPath(); g.moveTo(L, T); g.lineTo(L + dx, T + dy); g.lineTo(R + dx, T + dy); g.lineTo(R, T); g.closePath(); g.fill();
  }
  for (const [cx, cy, w, h] of cells) {
    const L = x0 + cx * cell, T = y0 + cy * cell, gr = g.createLinearGradient(L, T, L, T + h * cell);
    gr.addColorStop(0, face); gr.addColorStop(1, mix([170, 98, 72], DEAD, dim));
    g.fillStyle = gr; g.fillRect(L, T, w * cell + 0.5, h * cell + 0.5);
  }
  const blink = (t % 3.3) < 0.12;
  g.fillStyle = '#111';
  for (const ex of [2, 8]) { const L = x0 + sx(ex, 1) * cell; g.fillRect(L, y0 + (3 - eyeUp + (blink ? 0.6 : 0)) * cell, cell, (blink ? 0.4 : 1.4) * cell); }
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ex of [2, 8]) { const L = x0 + sx(ex, 1) * cell; if (!blink) g.fillRect(L + cell * 0.55, y0 + (3.1 - eyeUp) * cell, cell * 0.35, cell * 0.35); }
}

// ---- a bug (the arcade gnat) ------------------------------------------------------------------------------
function gnat(wx, wy, t) {
  const up = Math.floor(t * 20) % 2;
  rect(wx - 2, wy - 1, 4, 2, '#7bd35a'); rect(wx - 3, wy - 1, 1, 1, '#c6ff9a');
  rect(wx - 2, wy - 2 - up, 2, 1, '#d8f5ff'); rect(wx + 1, wy - 2 - up, 2, 1, '#d8f5ff');
}

// ---- the arcade set ------------------------------------------------------------------------------------
function arcade(t, o = {}) {
  const { warmth = 0, gone = -1, crackK = 0, staticK = 0 } = o;
  lg.fillStyle = mix([40, 26, 46], [6, 5, 12], warmth * 0.6); lg.fillRect(0, 0, LW, LH);
  // far grid of the screen, faint
  lg.fillStyle = `rgba(90,70,140,${0.10 + 0.08 * warmth})`;
  for (let gx = Math.floor((CX - 200) / 20) * 20; gx < CX + 200; gx += 20) lg.fillRect(LX(gx), 0, 1, LH);
  for (let gy = Math.floor((CY - 120) / 20) * 20; gy < CY + 120; gy += 20) lg.fillRect(0, LY(gy), LW, 1);
  // painted stars (flat dots) in the upper screen
  const r = rng(11);
  for (let i = 0; i < 160; i++) { const sx = r() * 340 - 10, sy = TOPY - 40 + r() * 330, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i); if (sy > -60) continue; rect(sx, sy, 1, 1, `rgba(200,200,255,${0.25 + 0.5 * tw * r()})`); }
  // the glow line at the top
  const gl = 0.6 + 0.2 * Math.sin(t * 1.7);
  for (let k = 0; k < 10; k++) rect(-20, TOPY - k * 2, 360, 2, `rgba(255,214,140,${(0.24 - k * 0.022) * gl * (1 - crackK)})`);
  rect(-20, TOPY, 360, 2, `rgba(255,236,190,${0.9 * gl})`);
  // platforms
  PL.forEach((p, k) => {
    if (k === gone) return;
    const edge = k % 3 === 0 ? '#ff4fa3' : k % 3 === 1 ? '#3fe0ff' : '#ffd23f';
    rect(p.x - p.w / 2, p.y, p.w, 3, '#1e1a2e'); rect(p.x - p.w / 2, p.y, p.w, 1, edge);
    rect(p.x - p.w / 2, p.y + 3, 2, 2, '#1e1a2e'); rect(p.x + p.w / 2 - 2, p.y + 3, 2, 2, '#1e1a2e');
  });
  // the dead-pixel floor
  rect(-20, 0, 360, 60, '#0b0a10');
  for (const [x, y, col] of PILE) rect(x, y, 1, 1, col);
  if (staticK > 0) { const rs = rng(Math.floor(t * 24)); lg.fillStyle = `rgba(200,200,220,${0.10 * staticK})`; for (let i = 0; i < 900 * staticK; i++) lg.fillRect(Math.floor(rs() * LW), Math.floor(rs() * LH), 1, 1 + (rs() < 0.1 ? 3 : 0)); }
}

// ---- space (full resolution) -------------------------------------------------------------------------------
function planet(name, x, y, r, light = [-0.6, -0.5], rings = false, spin = 0) {
  const im = IMG[name];
  const drawRing = (front) => {
    if (!RING || !rings) return;
    g.save(); g.translate(x, y); g.rotate(-0.38); g.scale(1, 0.26);
    for (let i = 0; i < 256; i += 2) {
      const [cr, cg, cb, ca] = RING[i]; if (ca < 0.03) continue;
      const rr = r * (1.24 + (i / 255) * (2.33 - 1.24));
      g.strokeStyle = `rgba(${cr},${cg},${cb},${ca * 0.85})`; g.lineWidth = r * 0.012 / 0.26 * 0.5;
      g.beginPath(); g.arc(0, 0, rr, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI); g.stroke();
    }
    g.restore();
  };
  drawRing(false);
  g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
  if (im) { const off = (spin % 1) * im.width; g.drawImage(im, off, 0, im.width / 2, im.height, x - r, y - r, 2 * r, 2 * r); if (off > im.width / 2) g.drawImage(im, off - im.width, 0, im.width / 2, im.height, x - r, y - r, 2 * r, 2 * r); }
  const lx = x + light[0] * r * 0.9, ly = y + light[1] * r * 0.9, sh = g.createRadialGradient(lx, ly, r * 0.1, x - light[0] * r * 0.2, y - light[1] * r * 0.2, r * 1.5);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(0,0,0,0.25)'); sh.addColorStop(1, 'rgba(0,0,0,0.92)');
  g.fillStyle = sh; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; const halo = g.createRadialGradient(x, y, r * 0.96, x, y, r * 1.12);
  halo.addColorStop(0, 'rgba(160,190,255,0.20)'); halo.addColorStop(1, 'rgba(160,190,255,0)'); g.fillStyle = halo; g.beginPath(); g.arc(x, y, r * 1.12, 0, 7); g.fill(); g.restore();
  drawRing(true);
}
function space(t, o = {}) {
  const { pan = 0, zoom = 1 } = o;
  g.fillStyle = '#020309'; g.fillRect(0, 0, W, H);
  if (IMG.sky) { const sw = IMG.sky.width * 0.42 / zoom, sh = sw * H / W; g.drawImage(IMG.sky, IMG.sky.width * (0.30 + pan * 0.05), IMG.sky.height * 0.24, sw, sh, 0, 0, W, H); }
  const r = rng(21); g.fillStyle = '#fff';
  for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H, s = r() < 0.06 ? 2.4 : 1.2, tw = 0.6 + 0.4 * Math.sin(t * 2 + i); g.globalAlpha = (0.3 + 0.7 * r()) * tw; g.fillRect(x - pan * 60 * (0.3 + r()), y, s, s); }
  g.globalAlpha = 1;
  planet('jupiter', 360 - pan * 120, 300, 230 * zoom, [-0.55, -0.45], false, t * 0.004);
  planet('saturn', 1560 - pan * 200, 260, 120 * zoom, [-0.7, -0.3], true, t * 0.003);
  planet('earth', 1250 - pan * 260, 840, 52 * zoom, [-0.7, -0.5], false, t * 0.01);
  planet('neptune', 760 - pan * 160, 130, 34 * zoom, [-0.6, -0.4], false, t * 0.005);
  planet('mars', 1720 - pan * 300, 720, 22 * zoom, [-0.7, -0.4], false, t * 0.006);
}

// ---- composite: the pixel buffer up to full size, plus the screen's scanlines -----------------------------
function present(alpha = 1, scan = 1) {
  g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = alpha; g.drawImage(lb, 0, 0, W, H); g.restore();
  if (scan > 0) { g.fillStyle = `rgba(0,0,0,${0.16 * scan * alpha})`; for (let y = 0; y < H; y += SC) g.fillRect(0, y + SC - 2, W, 2); }
}
function vignette(k = 0.55) {
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
function grain(t, k = 0.035) { const r = rng(Math.floor(t * 30) + 99); g.fillStyle = `rgba(255,255,255,${k})`; for (let i = 0; i < 500; i++) g.fillRect(r() * W, r() * H, 2, 2); }
const caption = (text, a, size = 64, y = H * 0.5, col = '#ffe7c7') => {
  if (a <= 0) return; g.save(); g.globalAlpha = a; g.font = `bold ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,150,90,0.6)'; g.shadowBlur = 30; g.fillStyle = col; g.fillText(text, W / 2, y); g.restore();
};

// ---- Clawd's climbs: hop from platform to platform, then a fall --------------------------------------------
const CLIMBS = [
  { t0: B.c1, dt: 1.3, ks: [0, 1, 2, 3, 4, 5], fall: B.hit1, land: B.land1 },
  { t0: B.c2, dt: 0.95, ks: [0, 1, 2, 3, 4, 5, 6, 7], fall: B.hit2, land: B.land2 },
  { t0: B.c3, dt: 0.62, ks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], fall: B.crumble, land: B.land3 },
];
function climbPos(t) {
  let pos = { x: 160, y: 0, pose: 'stand', dir: 1 };
  for (const C of CLIMBS) {
    if (t < C.t0) break;
    if (t >= C.land) { pos = { x: STAND(C.ks[Math.min(C.ks.length - 1, Math.floor((C.fall - C.t0) / C.dt))]).x, y: 0, pose: 'stand', dir: 1, landed: C.land }; continue; }
    if (t >= C.fall) {                                    // falling: from where it was, down to the floor
      const i = Math.min(C.ks.length - 1, Math.floor((C.fall - C.t0) / C.dt)), p = STAND(C.ks[i]), u = (t - C.fall) / (C.land - C.fall);
      return { x: p.x + Math.sin(u * 3) * 6, y: p.y * (1 - u * u), pose: Math.floor(t * 8) % 2 ? 'jump' : 'curl', dir: Math.floor(t * 6) % 2 ? 1 : -1, falling: true };
    }
    const f = (t - C.t0) / C.dt, i = Math.floor(f), u = f - i;
    if (i >= C.ks.length) { const p = STAND(C.ks[C.ks.length - 1]); return { x: p.x, y: p.y, pose: 'stand', dir: 1 }; }
    const a = STAND(i === 0 ? -1 : C.ks[i - 1]), b = STAND(C.ks[i]), hop = clamp((u - 0.35) / 0.65, 0, 1);
    return { x: lerp(a.x, b.x, ease(hop)), y: lerp(a.y, b.y, hop) - Math.sin(hop * Math.PI) * 18, pose: hop > 0 && hop < 1 ? 'jump' : 'stand', dir: b.x >= a.x ? 1 : -1 };
  }
  return pos;
}
const camFollow = (t, f, lag = 0.35) => { let s = 0; for (let k = 0; k < 6; k++) s += f(t - lag * k / 5).y; return s / 6; };

// ---- the frame ------------------------------------------------------------------------------------------------
function frame(t) {
  const sc = sceneAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (sc === 'end') return endScene(t);
  if (sc === 'break' || sc === 'last') return breakScene(t, sc);

  // ---- scenes 1-7: the arcade ----
  let warmth = 0, staticK = 0, gone = -1;
  const P0 = { x: 160, y: 0 };
  if (sc === 'bottom') {
    const up = seg(t, B.tiltUp, B.tiltUp + 2.2) * (1 - seg(t, B.tiltDown, B.tiltDown + 2.4));
    Z = 2; CX = 160; CY = lerp(-30, TOPY + 70, up);
    if (up > 0.6) Z = 1;
    arcade(t, {});
    clawdPx(160, 0, { t, eyeUp: seg(t, B.lookUp, B.lookUp + 0.6) * 1.2, flick: true, dim: 0.85 });
    glowPx(160, 0, 0.25);
  } else if (sc === 'trying' || sc === 'again') {
    const p = climbPos(t);
    if (t >= B.crumble) gone = 11;
    Z = 2; CX = 160; CY = Math.min(-30, camFollow(t, climbPos) - 20);
    arcade(t, { gone });
    // crumbling platform bits
    if (t >= B.crumble && t < B.crumble + 3) { const u = t - B.crumble, pp = PL[11], r = rng(3); for (let i = 0; i < 14; i++) rect(pp.x - pp.w / 2 + r() * pp.w, pp.y + u * u * 60 * (0.6 + r()), 2, 2, i % 3 ? '#1e1a2e' : '#ffd23f'); }
    // the bugs that knock Clawd off
    for (const [tb, th] of [[B.bug1, B.hit1], [B.hit2 - 1.2, B.hit2]]) if (t > tb && t < th + 1.2) { const q = climbPos(th - 0.01), u = (t - tb) / (th - tb); gnat(lerp(q.x - 120, q.x, Math.min(1, u)) + (u > 1 ? (u - 1) * 90 : 0), q.y - 6 + Math.sin(t * 9) * 3, t); }
    const smile = t > B.smile1 && t < B.hit1 ? 1 : 0;
    clawdPx(p.x, p.y, { t, pose: p.pose, dir: p.dir, flick: true, eyeUp: smile ? 0.6 : 0.2 });
    glowPx(p.x, p.y, 0.25 + smile * 0.3);
    // landing dust
    for (const tl of [B.land1, B.land2, B.land3]) if (t > tl && t < tl + 0.8) { const u = t - tl, r = rng(Math.round(tl)); for (let i = 0; i < 16; i++) rect(p.x + (r() - 0.5) * 30 * u * 2, -2 - r() * 10 * (1 - u), 1, 1, `rgba(150,150,170,${1 - u / 0.8})`); }
    if (t > B.land3) { staticK = seg(t, B.land3, B.land3 + 0.8) * 0.4; }
    if (t > B.land3) clawdPx(p.x, 0, { t, pose: 'lie', flick: true, dim: 1 - seg(t, B.land3, B.land3 + 0.6) * 0.4 });
  } else if (sc === 'lowest') {
    const k = seg(t, B.dimOut, B.dimOut + 6);
    Z = Math.round(lerp(3, 4, seg(t, SCN.lowest[0], SCN.lowest[1]))); CX = STAND(11).x; CY = -8;
    staticK = 0.4 + 0.5 * Math.sin(Math.PI * clamp((t - SCN.lowest[0]) / 10, 0, 1));
    arcade(t, { staticK });
    clawdPx(CLIMBS[2].ks.length ? STAND(11).x : 160, 0, { t, pose: 'curl', flick: true, dim: lerp(0.6, 0.14, k) });
    glowPx(STAND(11).x, 0, 0.18 * (1 - k));
    staticK = 0;
  } else if (sc === 'light' || sc === 'together') {
    const ourX = STAND(11).x;
    const pull = seg(t, B.reveal, B.reveal + 6);
    Z = pull > 0.5 ? 1 : sc === 'together' ? 1 : 3; CX = lerp(ourX, 160, pull); CY = lerp(-8, -40, pull);
    if (sc === 'together') { Z = 1; CX = 160; CY = -40; }
    warmth = sc === 'together' ? seg(t, B.take, B.take + 8) : 0;
    arcade(t, { warmth });
    // the others: dim, then each lights up; in 'together' they gather round
    const near = OTHERS[3];
    OTHERS.forEach((o) => {
      const blipK = t > o.lit ? 0.12 + 0.08 * Math.sin((t - o.lit) * 6) : 0;
      const isNear = o === near, firstBlip = isNear && t > B.blip;
      let dim = 0.16, glow = Math.max(blipK, firstBlip ? 0.22 : 0), x = o.x, pose = 'curl', dir = o.dir;
      if (sc === 'together') {
        const lightT = isNear ? B.take : B.spread + o.i * 0.45, on = seg(t, lightT, lightT + 0.8);
        dim = lerp(0.16, 1, on); glow = lerp(glow, 0.7, on); pose = on > 0.5 ? 'stand' : 'curl';
        const gather = seg(t, lightT + 0.6, lightT + 3.2);
        x = lerp(o.x, 160 + (o.i - 6) * 13, gather); dir = x < 160 ? 1 : -1;
      }
      clawdPx(x, 0, { t: t + o.i, pose, dim, dir }); glowPx(x, 0, glow);
    });
    // ours
    let x = ourX, pose = 'curl', dim = 0.18, eyeUp = 0;
    if (t > B.headUp) { pose = 'lie'; dim = 0.3; eyeUp = 0.8; }
    if (sc === 'together') {
      const walk = seg(t, B.rise + 0.6, B.offer - 0.3);
      pose = t < B.rise ? 'lie' : t < B.offer ? 'stand' : t < B.take + 1.2 ? 'reach' : 'stand';
      x = lerp(ourX, near.x - 13, walk); dim = lerp(0.35, 1, seg(t, B.take, B.take + 1));
      if (t > B.spread) x = lerp(near.x - 13, 160 - 13 * 0.5, seg(t, B.spread + 1, B.spread + 4));
    }
    clawdPx(x, 0, { t, pose, dim, eyeUp, flick: true, dir: 1 });
    glowPx(x, 0, sc === 'together' ? lerp(0.15, 0.85, seg(t, B.take, B.take + 1.2)) : 0.08);
  } else if (sc === 'climb') {
    // the living ladder: a column of Clawds that climbs platform by platform
    const N = 11, u = clamp((t - B.stack) / (B.top - B.stack), 0, 1), k = u * 12;
    const kb = Math.floor(k), fr = k - kb, a = STAND(kb - 1), b = STAND(Math.min(12, kb));
    const bx = lerp(a.x, b.x, ease(fr)), byy = lerp(a.y, b.y, ease(fr));
    const build = seg(t, B.stack, B.stack + 3);
    Z = 1; CX = 160; CY = clamp(byy - 50, TOPY + 80, -40);
    arcade(t, { warmth: 1, gone: t > B.gap && t < B.gap + 3.5 ? Math.min(12, kb + 1) : -1 });
    const bridging = t > B.bridge && t < B.bridge + 2.5;
    for (let i = 0; i < N; i++) {
      const vis = clamp(build * N - i, 0, 1); if (vis <= 0) continue;
      let x = bx + Math.sin(t * 2 + i) * 0.6, y = byy - i * 10.5;
      if (bridging && i >= N - 4) { const j = i - (N - 5); x = bx + j * 11 * (b.x > a.x ? -1 : 1); y = byy - (N - 5) * 10.5; }
      let pose = i === 0 ? 'stand' : 'hang';
      if (t > B.slip && t < B.catch + 0.8 && i === 6) { const s = seg(t, B.slip, B.slip + 0.3) * (1 - seg(t, B.catch, B.catch + 0.6)); x += -14 * s; y += 6 * s; pose = 'jump'; }
      if (t > B.slip + 0.3 && t < B.catch + 0.6 && (i === 5 || i === 7)) pose = 'reach';
      clawdPx(x, y, { t: t + i, pose, dir: i % 2 ? -1 : 1, flick: i === 0, eyeUp: 1 });
      glowPx(x, y, 0.6);
    }
    if (t > B.slip - 0.6 && t < B.slip + 0.6) gnat(lerp(bx - 90, bx - 10, seg(t, B.slip - 0.6, B.slip)) - (t > B.slip ? (t - B.slip) * 150 : 0), byy - 6 * 10.5 - 4, t);
  }
  present(1, 1);
  if (sc === 'bottom') caption('CLAWD', seg(t, B.title, B.title + 1) * (1 - seg(t, B.title + 3, B.title + 4.2)), 120, H * 0.36);
  if (sc === 'bottom') caption('coming up', seg(t, B.title + 0.6, B.title + 1.6) * (1 - seg(t, B.title + 3, B.title + 4.2)), 48, H * 0.47, '#ffc79a');
  vignette(sc === 'lowest' ? 0.8 : 0.55);
  grain(t);
  // fades at the act joins
  const fin = (a, d = 0.6) => clamp(1 - Math.abs(t - a) / d, 0, 1);
  const blackK = Math.max(fin(SCN.lowest[0], 0.5), fin(SCN.light[0], 0.8) * 0.8, t < 0.8 ? 1 - t / 0.8 : 0);
  if (blackK > 0) { g.fillStyle = `rgba(0,0,0,${blackK})`; g.fillRect(0, 0, W, H); }
}

// ---- scenes 8-9: the top cracks open; Clawds cross into space and turn solid ---------------------------------
const crackPts = (() => { const r = rng(77), pts = []; for (let x = -20; x <= 340; x += 6) pts.push([x, TOPY - 2 + (r() - 0.5) * 8]); return pts; })();
function breakScene(t, sc) {
  const crackK = seg(t, B.crack, B.open), openK = seg(t, B.open, B.open + 2.5);
  // before it opens the line sits high in frame; as it opens the camera tilts up into the space beyond
  Z = sc === 'break' ? 2 : 1; CX = 160; CY = sc === 'break' ? lerp(TOPY + 26, TOPY - 10, seg(t, B.open, B.pour + 3)) : lerp(TOPY + 40, TOPY - 10, seg(t, B.pulled, B.solid + 1.5));
  arcade(t, { warmth: 1, crackK: openK });
  // the column of Clawds below the top: the last 'pour' crossing one by one; ours stays at the base
  const N = 11, topIdx = (tt) => N - 1 - Math.floor(clamp((tt - B.pour) / 0.65, 0, N - 1));
  const baseY = TOPY + 2 + (N - 1) * 10.5;            // the column's base, so its top touches the line
  const remain = sc === 'break' ? topIdx(t) : 0;
  for (let i = 0; i <= remain; i++) {
    const y = baseY - i * 10.5, pushing = i === N - 1 && t > B.push && t < B.open ? Math.abs(Math.sin((t - B.push) * 5)) * 1.5 : 0;
    const dx = sc === 'last' ? 0 : Math.sin(t * 2 + i) * 0.6;
    if (sc === 'last' && i === 0) continue;
    clawdPx(160 + dx, y - pushing, { t: t + i, pose: i === 0 ? 'stand' : 'hang', dir: i % 2 ? -1 : 1, flick: i === 0, eyeUp: 1 });
    glowPx(160, y, 0.6);
  }
  // ours in the last scene: alone on the column's base spot, jumps, then is pulled up
  let ours = null;
  if (sc === 'last') {
    const jump = t > B.alone + 1.2 && t < B.alone + 2.2 ? Math.sin(((t - B.alone - 1.2) / 1) * Math.PI) * 12 : 0;
    const pulled = seg(t, B.pulled, B.solid + 0.4), y = lerp(baseY, TOPY - 30, pulled) - jump;
    ours = { x: 160, y, pose: t > B.grab ? 'hang' : jump > 0 ? 'jump' : 'stand' };
    if (y > TOPY + 4) { clawdPx(160, y, { t, pose: ours.pose, flick: true, eyeUp: 1.2 }); glowPx(160, y, 0.5); }
  }
  present(1, 1);
  // space through the crack
  if (crackK > 0) {
    g.save(); g.beginPath();
    const pts = crackPts.map(([x, y]) => toFull(x, y));
    const depth = openK * H;
    g.moveTo(pts[0][0], pts[0][1] - depth); for (const [x, y] of pts) g.lineTo(x, y - (openK < 1 ? depth * (0.5 + 0.5 * Math.sin(x * 0.01)) * 0 : 0));
    g.lineTo(pts[pts.length - 1][0], -H); g.lineTo(pts[0][0], -H); g.closePath();
    if (openK > 0) { g.clip(); g.globalAlpha = openK; space(t, { pan: 0.4, zoom: 0.8 }); g.globalAlpha = 1; }
    g.restore();
    // the crack itself: a bright jagged line, growing from the middle out
    g.save(); g.strokeStyle = `rgba(255,248,220,${0.9 * (1 - openK * 0.6)})`; g.lineWidth = 4 + 6 * (1 - openK); g.shadowColor = '#ffd9a0'; g.shadowBlur = 40;
    g.beginPath(); const span = crackK * (pts.length / 2);
    pts.forEach(([x, y], i) => { if (Math.abs(i - pts.length / 2) < span) { if (Math.abs(i - pts.length / 2) >= span - 1) g.moveTo(x, y); g.lineTo(x, y); } });
    g.stroke(); g.restore();
  }
  // the Clawds that have crossed: solid, floating up into space
  const cell = Z * SC;
  if (sc === 'break') for (let i = N - 1; i > remain; i--) {
    const tc = B.pour + (N - 1 - i) * 0.65, u = t - tc, [X, Y] = toFull(160 + Math.sin(i * 2.1) * 30 * Math.min(1, u), TOPY - 4 - u * 22);
    clawd3D(X + Math.sin(i * 1.7) * u * 60, Y, cell * (1 - Math.min(0.4, u * 0.04)), { depth: seg(u, 0, 0.6), glow: 0.9, dir: i % 2 ? -1 : 1, pose: 'hang', t: t + i, eyeUp: 1 });
  }
  if (sc === 'last') {
    // the chain of solid Clawds reaching down through the crack
    const reach = seg(t, B.chain, B.grab), pull = seg(t, B.pulled, B.solid + 0.4), n = 9;
    for (let j = 0; j < n; j++) {
      const wy = TOPY - 6 + j * 10.5 * reach - pull * 100, [X, Y] = toFull(160, wy + 11);
      if (j / n <= reach + 0.01) clawd3D(X, Y, cell, { depth: 1, glow: 0.8, pose: 'hang', dir: j % 2 ? 1 : -1, t: t + j, eyeUp: 0.6 });
    }
    if (ours && ours.y <= TOPY + 4) {
      const [X, Y] = toFull(160, ours.y);
      clawd3D(X, Y, cell, { depth: seg(t, B.solid - 0.6, B.solid + 0.6), glow: 1, pose: 'hang', t, eyeUp: 1, flick: t < B.solid });
    }
  }
  vignette(0.5); grain(t, 0.025);
  if (sc === 'last' && t > SCN.last[1] - 0.8) { g.fillStyle = `rgba(255,240,220,${seg(t, SCN.last[1] - 0.8, SCN.last[1])})`; g.fillRect(0, 0, W, H); }
}

// ---- scene 10: the constellation of Clawds among the planets -----------------------------------------------
const CONST = (() => { const r = rng(404); return Array.from({ length: 30 }, (_, i) => ({ x: 640 + r() * 900, y: 400 + r() * 380, s: 2.6 + r() * 3.4, ph: r() * 6, dir: r() < 0.5 ? 1 : -1 })); })();
function endScene(t) {
  const u = t - SCN.end[0];
  space(t, { pan: 0.3 + u * 0.01, zoom: 1 });
  // the old flat screen, far behind, small
  const sx = 230, sy = 760, sw = 130, sh = 78;
  g.save(); g.fillStyle = '#05040a'; g.fillRect(sx - 4, sy - 4, sw + 8, sh + 8);
  g.fillStyle = 'rgba(255,210,140,0.85)'; g.fillRect(sx, sy, sw, 3); g.fillStyle = '#1b1528'; g.fillRect(sx, sy + 3, sw, sh - 3);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,110,150,${0.3 + 0.2 * Math.sin(i * 3.1)})`; g.fillRect(sx + (i * 37) % sw, sy + sh - 6 - (i % 4) * 2, 3, 3); }
  g.restore();
  for (const s of CONST) {
    const bob = Math.sin(t * 0.9 + s.ph) * 8;
    clawd3D(s.x + Math.sin(t * 0.3 + s.ph) * 10, s.y + bob, s.s, { depth: 1, glow: 0.7, dir: s.dir, pose: 'hang', t: t + s.ph, eyeUp: 0.5 });
  }
  // ours, in the foreground: looks back at the screen, then forward
  const look = seg(t, B.lookBack, B.lookBack + 0.8) * (1 - seg(t, B.lookBack + 3, B.lookBack + 3.8));
  clawd3D(1500, 900 + Math.sin(t * 1.1) * 6, 13, { depth: 1, glow: 1, dir: look > 0.5 ? -1 : 1, pose: 'stand', t, eyeUp: 0.3 });
  // fine lines joining the constellation
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(255,170,110,${0.10 * seg(t, B.wide, B.wide + 3)})`; g.lineWidth = 1.5;
  g.beginPath(); for (let i = 1; i < CONST.length; i++) { const a = CONST[i - 1], b = CONST[i]; g.moveTo(a.x, a.y - a.s * 6); g.lineTo(b.x, b.y - b.s * 6); } g.stroke(); g.restore();
  vignette(0.45); grain(t, 0.02);
  if (u < 1.2) { g.fillStyle = `rgba(255,240,220,${1 - u / 1.2})`; g.fillRect(0, 0, W, H); }
  caption('No one comes up alone.', seg(t, B.endTitle, B.endTitle + 1.6), 78, H * 0.16);
  if (t > B.fadeOut) { g.fillStyle = `rgba(0,0,0,${seg(t, B.fadeOut, DURATION)})`; g.fillRect(0, 0, W, H); }
}

ready.then(() => {
  window.DURATION = DURATION; window.FPS = FPS;
  window.renderFrame = (i) => frame(i / FPS);
  if (!new URLSearchParams(location.search).has('render')) { const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
  window.ready = true;
});
