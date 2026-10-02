// "Prabhu Deva: the dance through time". A gallery of twenty square panels, each painted in an Indian art
// style of its age, from the Bhimbetka rock shelters to a phone reel. One dancer (a cartoon tribute to
// Prabhu Deva) dances in each panel and slides into the next, and the moment he crosses the frame he is
// redrawn in that panel's style: ochre stick figure, carved seal, Chola bronze, Warli, shadow puppet, neon,
// phone LCD pixels... Wordless; the score is tools/audio-prabhu.mjs, on the beat grid in
// stories/prabhu.beats.json (120 bpm, 3 s a panel). 1920x1080, 30 fps.
import B from '../stories/prabhu.beats.json' with { type: 'json' };
import { L, P, joints, drawPrabhu, OUTFITS, mono, footDrop } from './prabhu-char.js';
import { MOVES, blendPose } from './prabhu-moves.js';
import { drawRig, toSpark, blendSpark, sampleClip, rigPoints } from './prabhu-rig.js';
import MC from '../stories/prabhu-mocap.json' with { type: 'json' };

const W = 1920, H = 1080, FPS = 30, DURATION = B.duration, BEAT = 60 / B.bpm;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const SANS = '"Liberation Sans", "FreeSans", Arial, sans-serif', SERIF = '"Liberation Serif", "FreeSerif", serif', MONO = '"DejaVu Sans Mono", monospace', INDIC = '"FreeSans", "FreeSerif", sans-serif';
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const TAU = Math.PI * 2;
const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };

// ---- layout ------------------------------------------------------------------------------------------------
const PS = 720, PITCH = 780, N = B.panels.length;
const T0 = B.intro, TP = B.panelBeats * BEAT, TEND = T0 + N * TP, PB = B.panelBeats;
const panelX = (k) => k * PITCH;                    // world x of a panel's centre; panels centred on world y 0

// ---- the dancer: one model (src/prabhu-char.js), his steps in src/prabhu-moves.js ------------------------------------
// A panel's palette recolours the outfit; the face, hair and cut stay his everywhere.
const darken = (hex, k = 0.78) => { const n = parseInt(hex.slice(1), 16); const c = (v) => Math.round(v * k).toString(16).padStart(2, '0'); return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`; };
const PAL = { hero: OUTFITS.film94, mono };
function toOutfit(pal, hat) {
  if (pal.mono) return { ...pal, hat: 'none' };
  if (pal.skinShade) return { ...pal, hat: hat === 'none' ? 'none' : hat };
  const hex = (c) => (c && c[0] === '#' && c.length === 7 ? c : '#808080');
  return { ...OUTFITS.film94, skin: pal.skin, skinShade: darken(hex(pal.skin)), hair: pal.hair, shirt: pal.shirt, shirtShade: darken(hex(pal.shirt), 0.85), shirt2: null,
    pants: pal.pants, pantsShade: darken(hex(pal.pants), 1.25 > 1 ? 0.7 : 0.7), shoes: pal.shoes, sole: darken(hex(pal.shoes), 0.8), hatCol: pal.hat, band: pal.band, hat, sleeve: pal.sleeve || 'long', open: false, tee: null, line: pal.line || '#140c08' };
}
function flatFigure(gc, sp, pal, fx, floor, fh, hat = 'none', face = true) {
  return drawRig(gc, sp, toOutfit(pal, hat), fx, floor, fh, { face: face ? undefined : -1 });
}
// The skeleton as strokes (rock art, neon): returns nothing; fills/strokes on gc.
function stickFigure(gc, p, fx, floor, fh, col, w, opts = {}) {
  const J = joints(p), lowest = Math.max(J.ll[2][1], J.rl[2][1]) + L.foot, py = floor - lowest * fh - p.y * fh;
  gc.save(); gc.translate(fx, py); gc.scale(fh * p.sx, fh); gc.lineCap = 'round'; gc.lineJoin = 'round';
  const path = () => {
    gc.beginPath();
    for (const limb of [J.ll, J.rl, J.la, J.ra]) { gc.moveTo(...limb[0]); gc.lineTo(...limb[1]); gc.lineTo(...limb[2]); }
    gc.moveTo(J.la[0][0], J.la[0][1]); gc.lineTo(J.ra[0][0], J.ra[0][1]);
    gc.moveTo(J.ll[0][0], J.ll[0][1]); gc.lineTo(J.rl[0][0], J.rl[0][1]);
    gc.moveTo(...J.pel); gc.lineTo(...J.neck);
    gc.moveTo(J.head[0] + L.head * 0.85, J.head[1]); gc.ellipse(J.head[0], J.head[1], L.head * 0.85, L.head, 0, 0, TAU);
    if (opts.hat) { gc.moveTo(J.head[0] - 0.1, J.head[1] - 0.06); gc.lineTo(J.head[0] + 0.1, J.head[1] - 0.075); }
  };
  if (opts.glow) { gc.shadowColor = col; gc.shadowBlur = 28; gc.strokeStyle = col; gc.lineWidth = w * 2.2 / fh; path(); gc.stroke(); gc.shadowBlur = 12; gc.lineWidth = w * 1.1 / fh; path(); gc.stroke(); gc.shadowBlur = 0; gc.strokeStyle = opts.core || '#fff'; gc.lineWidth = w * 0.45 / fh; path(); gc.stroke(); }
  else { gc.strokeStyle = col; gc.lineWidth = w / fh; path(); gc.stroke(); if (opts.headFill) { gc.fillStyle = col; gc.beginPath(); gc.ellipse(J.head[0], J.head[1], L.head * 0.85, L.head, 0, 0, TAU); gc.fill(); } }
  gc.restore();
}
// Warli: two triangles meeting at the waist, a round head, line limbs.
function warliFigure(gc, p, fx, floor, fh, col) {
  const J = joints(p), lowest = Math.max(J.ll[2][1], J.rl[2][1]) + L.foot, py = floor - lowest * fh - p.y * fh;
  gc.save(); gc.translate(fx, py); gc.scale(fh * p.sx, fh); gc.lineCap = 'round'; gc.fillStyle = gc.strokeStyle = col; gc.lineWidth = 0.022;
  const waist = [J.pel[0] + J.td[0] * 0.13, J.pel[1] + J.td[1] * 0.13];
  gc.beginPath(); gc.moveTo(...J.la[0]); gc.lineTo(...J.ra[0]); gc.lineTo(...waist); gc.closePath(); gc.fill();
  gc.beginPath(); gc.moveTo(J.ll[0][0] - 0.03, J.ll[0][1] + 0.01); gc.lineTo(J.rl[0][0] + 0.03, J.rl[0][1] + 0.01); gc.lineTo(...waist); gc.closePath(); gc.fill();
  gc.beginPath(); for (const limb of [J.ll, J.rl, J.la, J.ra]) { gc.moveTo(...limb[0]); gc.lineTo(...limb[1]); gc.lineTo(...limb[2]); } gc.moveTo(...J.neck); gc.lineTo(J.head[0], J.head[1]); gc.stroke();
  gc.beginPath(); gc.arc(J.head[0], J.head[1] - 0.01, 0.055, 0, TAU); gc.fill();
  gc.restore();
}

// ---- panels -------------------------------------------------------------------------------------------------------
// Each: label, bg(g, r) static painting (cached), fg(g, t) live overlay, fig: how the dancer is drawn.
const F1 = mk(PS, PS), f1 = F1.getContext('2d', { willReadFrequently: true }), F2 = mk(PS, PS), f2 = F2.getContext('2d');
const noise = (gc, n, r, cols, size = [1, 3], alpha = [0.05, 0.2], area = [0, 0, PS, PS]) => { for (let i = 0; i < n; i++) { gc.globalAlpha = lerp(alpha[0], alpha[1], r()); gc.fillStyle = cols[Math.floor(r() * cols.length)]; const s = lerp(size[0], size[1], r()); gc.beginPath(); gc.arc(area[0] + r() * area[2], area[1] + r() * area[3], s, 0, TAU); gc.fill(); } gc.globalAlpha = 1; };
const text = (gc, s, x, y, font, col, align = 'center', base = 'middle') => { gc.font = font; gc.fillStyle = col; gc.textAlign = align; gc.textBaseline = base; gc.fillText(s, x, y); };
const spaced = (gc, s, x, y, font, col, sp) => { gc.font = font; const ws = [...s].map((ch) => gc.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (s.length - 1); let xx = x - tot / 2; gc.fillStyle = col; gc.textAlign = 'left'; gc.textBaseline = 'middle'; [...s].forEach((ch, i) => { gc.fillText(ch, xx, y); xx += ws[i] + sp; }); };
const rect = (gc, x, y, w, h, col) => { gc.fillStyle = col; gc.fillRect(x, y, w, h); };

const PANELS = {
  rock: { name: 'ROCK ART', where: 'Bhimbetka · c. 8000 BC', move: 'groove',
    bg(gc, r) {
      const gr = gc.createRadialGradient(360, 340, 60, 360, 360, 520); gr.addColorStop(0, '#b0784a'); gr.addColorStop(1, '#6e4426'); gc.fillStyle = gr; gc.fillRect(0, 0, PS, PS);
      noise(gc, 900, r, ['#5b371f', '#c58d5b', '#8a5634', '#d9a774'], [4, 40], [0.04, 0.14]);
      gc.strokeStyle = 'rgba(50,28,14,0.45)'; gc.lineWidth = 2; for (let i = 0; i < 9; i++) { gc.beginPath(); let x = r() * PS, y = r() * PS; gc.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 90; y += r() * 60; gc.lineTo(x, y); } gc.stroke(); }
      gc.strokeStyle = gc.fillStyle = 'rgba(150,40,20,0.75)'; gc.lineWidth = 5; gc.lineCap = 'round';
      const hunter = (x, y, s) => { gc.beginPath(); gc.moveTo(x, y); gc.lineTo(x, y - 40 * s); gc.moveTo(x, y); gc.lineTo(x - 12 * s, y + 26 * s); gc.moveTo(x, y); gc.lineTo(x + 12 * s, y + 26 * s); gc.moveTo(x - 16 * s, y - 30 * s); gc.lineTo(x + 18 * s, y - 34 * s); gc.stroke(); gc.beginPath(); gc.arc(x, y - 48 * s, 7 * s, 0, TAU); gc.fill(); gc.beginPath(); gc.arc(x + 22 * s, y - 32 * s, 18 * s, -1.2, 1.2); gc.stroke(); };
      hunter(90, 170, 1); hunter(150, 180, 0.9); hunter(620, 160, 1.1);
      gc.beginPath(); gc.ellipse(560, 560, 60, 26, 0, 0, TAU); gc.fill(); for (const lx of [520, 540, 580, 600]) { gc.beginPath(); gc.moveTo(lx, 575); gc.lineTo(lx, 615); gc.stroke(); } gc.beginPath(); gc.moveTo(612, 548); gc.lineTo(640, 520); gc.lineTo(650, 500); gc.moveTo(632, 528); gc.lineTo(660, 520); gc.stroke();
      for (const [x, y] of [[90, 600], [140, 630]]) { gc.globalAlpha = 0.5; gc.beginPath(); gc.ellipse(x, y, 16, 20, 0, 0, TAU); gc.fill(); for (let f = 0; f < 5; f++) { gc.beginPath(); gc.ellipse(x - 16 + f * 8, y - 28, 4, 12, (f - 2) * 0.2, 0, TAU); gc.fill(); } gc.globalAlpha = 1; }
    },
    fig(gc, p, fx, floor, fh) { rockPaint(gc, p, fx, floor, fh, '#9e2c16'); } },

  seal: { name: 'INDUS SEAL', where: 'Mohenjo-daro · 2500 BC', move: 'point',
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#2b2622'); noise(gc, 400, r, ['#3a332d', '#1d1915'], [3, 12], [0.2, 0.5]);
      const m = 50; gc.fillStyle = '#cfc4ae'; gc.beginPath(); gc.roundRect(m, m, PS - 2 * m, PS - 2 * m, 40); gc.fill();
      noise(gc, 1400, r, ['#b9ad95', '#ddd3bf', '#a89c84'], [1, 6], [0.15, 0.4], [m, m, PS - 2 * m, PS - 2 * m]);
      gc.strokeStyle = 'rgba(80,68,52,0.6)'; gc.lineWidth = 5; gc.beginPath(); gc.roundRect(m + 22, m + 22, PS - 2 * m - 44, PS - 2 * m - 44, 26); gc.stroke();
      gc.strokeStyle = 'rgba(70,58,44,0.85)'; gc.lineWidth = 9; gc.lineCap = 'round';
      const glyph = (x, y, k) => { gc.beginPath(); const s = 24; if (k === 0) { gc.moveTo(x, y - s); gc.lineTo(x, y + s); } else if (k === 1) { gc.moveTo(x - s * 0.6, y - s); gc.lineTo(x - s * 0.6, y + s * 0.4); gc.quadraticCurveTo(x, y + s * 1.3, x + s * 0.6, y + s * 0.4); gc.lineTo(x + s * 0.6, y - s); } else if (k === 2) { gc.moveTo(x, y - s); gc.lineTo(x, y + s); gc.moveTo(x - s * 0.6, y - s * 0.3); gc.lineTo(x, y); gc.lineTo(x + s * 0.6, y - s * 0.3); } else if (k === 3) { gc.ellipse(x, y, s * 0.6, s, 0, 0, TAU); gc.moveTo(x - s * 0.6, y); gc.lineTo(x + s * 0.6, y); } else { gc.moveTo(x - s * 0.6, y - s); gc.lineTo(x + s * 0.6, y + s); gc.moveTo(x + s * 0.6, y - s); gc.lineTo(x - s * 0.6, y + s); } gc.stroke(); };
      [1, 0, 0, 2, 3, 4, 0, 1].forEach((k, i) => glyph(150 + i * 60, 150, k));
    },
    fig(gc, p, fx, floor, fh, hat) { emboss(gc, p, fx, floor, fh, '#c3b79f', 'rgba(60,50,38,0.9)', 'rgba(245,238,224,0.85)', 'none'); } , floor: 0.86, fh: 0.5 },

  nataraja: { name: 'CHOLA BRONZE', where: 'Thanjavur · c. 1000 AD', move: 'nataraja',
    bg(gc, r) {
      const gr = gc.createRadialGradient(360, 340, 40, 360, 360, 520); gr.addColorStop(0, '#5a1a14'); gr.addColorStop(1, '#170606'); gc.fillStyle = gr; gc.fillRect(0, 0, PS, PS);
      gc.fillStyle = '#6b4a22'; gc.beginPath(); gc.ellipse(360, 618, 220, 34, 0, 0, TAU); gc.fill(); gc.fillStyle = '#9c7032';
      for (let i = 0; i < 14; i++) { const a = Math.PI + (i / 13) * Math.PI; gc.beginPath(); gc.ellipse(360 + Math.cos(a) * 190, 612 + Math.sin(a) * 30, 26, 14, a, 0, TAU); gc.fill(); }
      gc.fillStyle = '#4b3216'; gc.fillRect(150, 620, 420, 40); gc.fillStyle = '#8a6430'; gc.fillRect(150, 620, 420, 8);
    },
    fg(gc, t) {
      // the ring of fire (prabha), flames flicker
      const cx = 360, cy = 360, R = 250;
      gc.strokeStyle = '#a7782f'; gc.lineWidth = 16; gc.beginPath(); gc.arc(cx, cy + 30, R, Math.PI * 0.92, Math.PI * 2.08); gc.stroke();
      gc.strokeStyle = '#e0b356'; gc.lineWidth = 4; gc.beginPath(); gc.arc(cx, cy + 30, R - 6, Math.PI * 0.92, Math.PI * 2.08); gc.stroke();
      for (let i = 0; i <= 34; i++) { const a = Math.PI * 0.92 + (i / 34) * Math.PI * 1.16, fl = 1 + 0.25 * Math.sin(t * 9 + i * 1.7); const x = cx + Math.cos(a) * (R + 10), y = cy + 30 + Math.sin(a) * (R + 10);
        gc.save(); gc.translate(x, y); gc.rotate(a + Math.PI / 2); const gr = gc.createLinearGradient(0, 0, 0, -44 * fl); gr.addColorStop(0, '#c98a2c'); gr.addColorStop(1, 'rgba(255,214,120,0.0)'); gc.fillStyle = gr; gc.beginPath(); gc.moveTo(-9, 0); gc.quadraticCurveTo(-6, -24 * fl, 0, -44 * fl); gc.quadraticCurveTo(6, -24 * fl, 9, 0); gc.fill(); gc.restore(); }
    },
    fig(gc, p, fx, floor, fh) { bronze(gc, p, fx, floor, fh); }, floor: 0.84, fh: 0.5 },

  relief: { name: 'TEMPLE FRIEZE', where: 'Hampi · c. 1520', move: 'kick',
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#b99b74'); noise(gc, 2200, r, ['#a5875f', '#cdb089', '#977a55'], [1, 5], [0.2, 0.5]);
      gc.strokeStyle = 'rgba(90,70,45,0.55)'; gc.lineWidth = 3; for (let y = 0; y < PS; y += 120) { gc.beginPath(); gc.moveTo(0, y); gc.lineTo(PS, y); gc.stroke(); for (let x = (y / 120) % 2 ? 0 : 90; x < PS; x += 180) { gc.beginPath(); gc.moveTo(x, y); gc.lineTo(x, y + 120); gc.stroke(); } }
      const band = (y, h) => { rect(gc, 0, y, PS, h, '#a88a62'); gc.fillStyle = 'rgba(70,52,30,0.5)'; gc.fillRect(0, y + h - 6, PS, 6); gc.fillStyle = 'rgba(235,215,180,0.35)'; gc.fillRect(0, y, PS, 4);
        for (let x = 30; x < PS; x += 60) { gc.fillStyle = 'rgba(70,52,30,0.45)'; gc.beginPath(); gc.arc(x + 3, y + h / 2 + 3, h * 0.32, 0, TAU); gc.fill(); gc.fillStyle = '#c7a97f'; gc.beginPath(); gc.arc(x, y + h / 2, h * 0.32, 0, TAU); gc.fill(); gc.fillStyle = 'rgba(70,52,30,0.4)'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; gc.beginPath(); gc.arc(x + Math.cos(a) * h * 0.18, y + h / 2 + Math.sin(a) * h * 0.18, 3, 0, TAU); gc.fill(); } } };
      band(0, 70); band(PS - 80, 80);
      for (const x of [0, PS - 70]) { rect(gc, x, 70, 70, PS - 150, '#a88a62'); gc.fillStyle = 'rgba(70,52,30,0.45)'; for (let y = 100; y < PS - 100; y += 70) gc.fillRect(x + 12, y, 46, 8); gc.fillStyle = 'rgba(235,215,180,0.3)'; gc.fillRect(x + (x ? 0 : 64), 70, 6, PS - 150); }
    },
    fig(gc, p, fx, floor, fh) { emboss(gc, p, fx, floor, fh, '#b0916a', 'rgba(70,50,28,0.85)', 'rgba(240,222,190,0.7)', 'none'); }, floor: 0.86, fh: 0.54 },

  mughal: { name: 'MUGHAL MINIATURE', where: 'Agra · c. 1620', move: 'hatTip', hat: 'turban',
    pal: { skin: '#b07a52', hair: '#2a1a10', shirt: '#f2ecdc', pants: '#b8372f', shoes: '#c9a227', hat: '#e9dfc6', band: '#c9a227', plume: '#fff', sleeve: 'long', line: '#3a2a1a' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#b3463a'); gc.strokeStyle = '#d9b44a'; gc.lineWidth = 3;
      for (let i = 0; i < 70; i++) { const side = i % 4, u = r(); const x = side < 2 ? u * PS : side === 2 ? 22 : PS - 22, y = side < 2 ? (side ? PS - 22 : 22) : u * PS; gc.beginPath(); gc.arc(x, y, 8, 0, TAU); gc.stroke(); gc.fillStyle = '#e8c97a'; gc.beginPath(); gc.arc(x, y, 3, 0, TAU); gc.fill(); }
      rect(gc, 46, 46, PS - 92, PS - 92, '#d9b44a'); rect(gc, 54, 54, PS - 108, PS - 108, '#1f3f6b'); rect(gc, 60, 60, PS - 120, PS - 120, '#d9b44a');
      const sky = gc.createLinearGradient(0, 64, 0, 260); sky.addColorStop(0, '#2c5b9a'); sky.addColorStop(1, '#e9d8a6'); gc.fillStyle = sky; gc.fillRect(64, 64, PS - 128, 200);
      rect(gc, 64, 264, PS - 128, PS - 328, '#8fa86a'); noise(gc, 300, r, ['#6f8a4e', '#a9c27f'], [2, 5], [0.3, 0.6], [64, 264, PS - 128, PS - 328]);
      gc.fillStyle = '#f2e8cf'; for (const [x, y] of [[150, 110], [520, 130], [380, 90]]) { for (let k = 0; k < 4; k++) { gc.beginPath(); gc.arc(x + k * 18, y + Math.sin(k) * 6, 14, 0, TAU); gc.fill(); } }
      for (const x of [120, 600]) { gc.fillStyle = '#2f5a2c'; gc.beginPath(); gc.moveTo(x, 200); gc.quadraticCurveTo(x + 34, 380, x, 560); gc.quadraticCurveTo(x - 34, 380, x, 200); gc.fill(); }
      rect(gc, 300, 264, 120, PS - 328, '#7fb0c8'); gc.strokeStyle = '#e8f2f4'; gc.lineWidth = 2; for (let y = 290; y < PS - 70; y += 26) { gc.beginPath(); gc.moveTo(310, y); gc.quadraticCurveTo(360, y - 6, 410, y); gc.stroke(); }
      for (let i = 0; i < 26; i++) { const x = 80 + r() * (PS - 160), y = 280 + r() * 360; if (x > 290 && x < 430) continue; gc.fillStyle = ['#e85a5a', '#f6d04d', '#f2f2f2'][i % 3]; for (let k = 0; k < 5; k++) { gc.beginPath(); gc.arc(x + Math.cos(k * 1.26) * 5, y + Math.sin(k * 1.26) * 5, 3.5, 0, TAU); gc.fill(); } }
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, hat, 2.5, '#3a2a1a'); }, floor: 0.84, fh: 0.5 },

  tanjore: { name: 'TANJORE PAINTING', where: 'Thanjavur · c. 1780', move: 'point',
    pal: { skin: '#9a6440', hair: '#170f0a', shirt: '#2f7d4f', pants: '#d9b33a', shoes: '#c62f2f', hat: '#d9b33a', sleeve: 'short', line: '#5a3a10' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#9e1f22'); const gold = (x, y, w, h) => { const gr = gc.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#8a6516'); gr.addColorStop(0.5, '#f6dc7a'); gr.addColorStop(1, '#9c741c'); gc.fillStyle = gr; gc.fillRect(x, y, w, h); };
      gold(0, 0, PS, 40); gold(0, PS - 40, PS, 40); gold(0, 0, 40, PS); gold(PS - 40, 0, 40, PS);
      gold(70, 120, 46, PS - 170); gold(PS - 116, 120, 46, PS - 170);
      gc.save(); gc.beginPath(); gc.moveTo(70, 160); gc.quadraticCurveTo(70, 70, 360, 70); gc.quadraticCurveTo(PS - 70, 70, PS - 70, 160); gc.lineTo(PS - 116, 160); gc.quadraticCurveTo(PS - 116, 116, 360, 116); gc.quadraticCurveTo(116, 116, 116, 160); gc.closePath(); gc.clip(); gold(60, 60, PS - 120, 110); gc.restore();
      const gem = (x, y, c2) => { gc.fillStyle = '#5a3a10'; gc.beginPath(); gc.arc(x, y, 9, 0, TAU); gc.fill(); gc.fillStyle = c2; gc.beginPath(); gc.arc(x, y, 6, 0, TAU); gc.fill(); gc.fillStyle = 'rgba(255,255,255,0.7)'; gc.beginPath(); gc.arc(x - 2, y - 2, 2, 0, TAU); gc.fill(); };
      for (let y = 150; y < PS - 60; y += 44) { gem(93, y, y % 88 ? '#d42a3a' : '#1f9a56'); gem(PS - 93, y, y % 88 ? '#1f9a56' : '#d42a3a'); }
      for (let x = 30; x < PS; x += 40) { gem(x, 20, '#d42a3a'); gem(x, PS - 20, '#1f9a56'); }
      gc.fillStyle = 'rgba(255,220,140,0.15)'; gc.beginPath(); gc.ellipse(360, 330, 150, 230, 0, 0, TAU); gc.fill();
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, 'none', 3, '#5a3a10'); necklace(gc, p, fx, floor, fh); }, floor: 0.86, fh: 0.5 },

  warli: { name: 'WARLI', where: 'Maharashtra · folk', move: 'rubber',
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#8b3f24'); noise(gc, 1500, r, ['#7a3420', '#9c4c2c', '#6c2d1b'], [2, 12], [0.15, 0.35]);
      gc.fillStyle = gc.strokeStyle = '#f2ebdc'; gc.lineWidth = 4;
      gc.beginPath(); gc.arc(600, 110, 40, 0, TAU); gc.fill(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; gc.beginPath(); gc.moveTo(600 + Math.cos(a) * 50, 110 + Math.sin(a) * 50); gc.lineTo(600 + Math.cos(a) * 66, 110 + Math.sin(a) * 66); gc.stroke(); }
      for (const [x, y] of [[90, 140], [170, 150]]) { gc.beginPath(); gc.moveTo(x - 40, y + 40); gc.lineTo(x, y - 10); gc.lineTo(x + 40, y + 40); gc.closePath(); gc.stroke(); gc.strokeRect(x - 30, y + 40, 60, 40); }
      for (const x of [60, 650]) { gc.beginPath(); gc.moveTo(x, PS - 60); gc.lineTo(x, PS - 200); gc.stroke(); for (let k = 0; k < 7; k++) { gc.beginPath(); gc.moveTo(x, PS - 80 - k * 18); gc.lineTo(x - 26, PS - 96 - k * 18); gc.moveTo(x, PS - 80 - k * 18); gc.lineTo(x + 26, PS - 96 - k * 18); gc.stroke(); } }
      for (let i = 0; i < 40; i++) { gc.beginPath(); gc.arc(30 + i * 17, PS - 40, 3, 0, TAU); gc.fill(); }
    },
    fg(gc, t) {
      // the tarpa circle dance turning behind him
      const n = 16; for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 0.6, x = 360 + Math.cos(a) * 250, y = 200 + Math.sin(a) * 50, s = 0.55 + 0.25 * (Math.sin(a) + 1) / 2;
        warliFigure(gc, MOVES.groove(t * 2 + i * 0.5), x, y + 40 * s, 120 * s, `rgba(242,235,220,${0.55 + 0.4 * (Math.sin(a) + 1) / 2})`); }
    },
    fig(gc, p, fx, floor, fh) { rockPaint(gc, p, fx, floor, fh, '#f6efe2', 0.12); }, floor: 0.88, fh: 0.5 },

  madhubani: { name: 'MADHUBANI', where: 'Mithila, Bihar · folk', move: 'groove',
    pal: { skin: '#e3a34a', hair: '#141414', shirt: '#d8302f', pants: '#1d5fa8', shoes: '#141414', hat: '#141414', sleeve: 'short', line: '#141414' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#f3e6c8'); gc.strokeStyle = '#141414';
      gc.lineWidth = 5; gc.strokeRect(20, 20, PS - 40, PS - 40); gc.strokeRect(58, 58, PS - 116, PS - 116);
      for (let i = 0; i < 24; i++) for (let side = 0; side < 4; side++) { const u = 20 + i * ((PS - 40) / 24); gc.fillStyle = (i + side) % 2 ? '#d8302f' : '#f2b62c'; gc.beginPath(); if (side === 0) { gc.moveTo(u, 22); gc.lineTo(u + (PS - 40) / 48, 56); gc.lineTo(u + (PS - 40) / 24, 22); } else if (side === 1) { gc.moveTo(u, PS - 22); gc.lineTo(u + (PS - 40) / 48, PS - 56); gc.lineTo(u + (PS - 40) / 24, PS - 22); } else if (side === 2) { gc.moveTo(22, u); gc.lineTo(56, u + (PS - 40) / 48); gc.lineTo(22, u + (PS - 40) / 24); } else { gc.moveTo(PS - 22, u); gc.lineTo(PS - 56, u + (PS - 40) / 48); gc.lineTo(PS - 22, u + (PS - 40) / 24); } gc.fill(); gc.lineWidth = 2; gc.stroke(); }
      const fish = (x, y, s, f) => { gc.save(); gc.translate(x, y); gc.scale(s * f, s); gc.fillStyle = '#2d8a4a'; gc.lineWidth = 3; gc.beginPath(); gc.ellipse(0, 0, 50, 20, 0, 0, TAU); gc.fill(); gc.stroke(); gc.beginPath(); gc.moveTo(48, 0); gc.lineTo(76, -18); gc.lineTo(76, 18); gc.closePath(); gc.fillStyle = '#d8302f'; gc.fill(); gc.stroke(); for (let k = -30; k < 40; k += 12) { gc.beginPath(); gc.arc(k, 0, 6, -1.2, 1.2); gc.stroke(); } gc.fillStyle = '#141414'; gc.beginPath(); gc.arc(-34, -4, 4, 0, TAU); gc.fill(); gc.restore(); };
      fish(160, 150, 1, 1); fish(560, 150, 1, -1);
      gc.fillStyle = '#f2b62c'; gc.beginPath(); gc.arc(360, 130, 40, 0, TAU); gc.fill(); gc.lineWidth = 4; gc.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; gc.beginPath(); gc.moveTo(360 + Math.cos(a) * 46, 130 + Math.sin(a) * 46); gc.lineTo(360 + Math.cos(a) * 64, 130 + Math.sin(a) * 64); gc.stroke(); }
      for (const [x, y] of [[110, 560], [610, 560]]) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; gc.fillStyle = k % 2 ? '#d8302f' : '#f2b62c'; gc.beginPath(); gc.ellipse(x + Math.cos(a) * 22, y + Math.sin(a) * 22, 16, 8, a, 0, TAU); gc.fill(); gc.lineWidth = 2; gc.stroke(); } }
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, 'none', 6, '#141414', '#f3e6c8', 3); }, floor: 0.84, fh: 0.5 },

  puppet: { name: 'SHADOW PUPPET', where: 'Tholu Bommalata · Andhra', move: 'kick',
    pal: { skin: '#c4472a', hair: '#2a120a', shirt: '#1f8a5a', pants: '#d8a227', shoes: '#c4472a', hat: '#2a120a', sleeve: 'long', line: '#2a120a', face: false },
    bg(gc, r) {
      const gr = gc.createRadialGradient(360, 380, 20, 360, 380, 470); gr.addColorStop(0, '#fff1c4'); gr.addColorStop(0.5, '#f0a54a'); gr.addColorStop(1, '#5a250c'); gc.fillStyle = gr; gc.fillRect(0, 0, PS, PS);
      rect(gc, 0, 0, PS, 30, '#2a120a'); rect(gc, 0, PS - 50, PS, 50, '#2a120a'); rect(gc, 0, 0, 24, PS, '#2a120a'); rect(gc, PS - 24, 0, 24, PS, '#2a120a');
      gc.strokeStyle = 'rgba(90,40,10,0.15)'; gc.lineWidth = 1; for (let x = 24; x < PS; x += 6) { gc.beginPath(); gc.moveTo(x, 30); gc.lineTo(x, PS - 50); gc.stroke(); }
    },
    fig(gc, p, fx, floor, fh, hat, pal) { puppet(gc, p, fx, floor, fh, pal); }, floor: 0.82, fh: 0.52 },

  kalighat: { name: 'KALIGHAT PAT', where: 'Calcutta · c. 1870', move: 'hatTip',
    pal: { skin: '#e9c9a0', hair: '#111', shirt: '#f6f1e6', pants: '#2c4a8a', shoes: '#111', hat: '#111', sleeve: 'long', line: '#111' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#efe5cf'); noise(gc, 60, r, ['#d9c7a3', '#e6d6b6'], [20, 80], [0.15, 0.3]);
      // the Kalighat cat with a fish
      gc.save(); gc.translate(560, 560); gc.fillStyle = '#e8d6b4'; gc.strokeStyle = '#111'; gc.lineWidth = 6; gc.beginPath(); gc.ellipse(0, 0, 70, 56, 0, 0, TAU); gc.fill(); gc.stroke(); gc.beginPath(); gc.arc(-40, -60, 38, 0, TAU); gc.fill(); gc.stroke();
      gc.beginPath(); gc.moveTo(-70, -84); gc.lineTo(-64, -118); gc.lineTo(-46, -94); gc.moveTo(-28, -96); gc.lineTo(-14, -118); gc.lineTo(-6, -82); gc.stroke(); gc.fillStyle = '#111'; gc.beginPath(); gc.arc(-52, -64, 5, 0, TAU); gc.arc(-28, -64, 5, 0, TAU); gc.fill();
      gc.strokeStyle = '#c0392b'; gc.lineWidth = 8; gc.beginPath(); gc.moveTo(-60, -40); gc.lineTo(-10, -30); gc.stroke(); gc.restore();
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, 'none', 6, '#111'); }, floor: 0.86, fh: 0.52 },

  silent: { name: 'SILENT CINEMA', where: 'Bombay · 1913', move: 'groove', hat: 'fedora',
    pal: { skin: '#9a9a9a', hair: '#1a1a1a', shirt: '#d8d8d8', pants: '#2a2a2a', shoes: '#111', hat: '#1e1e1e', band: '#d8d8d8', sleeve: 'long', line: '#111' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#0c0c0c'); const m = 40; const gr = gc.createRadialGradient(360, 340, 40, 360, 360, 420); gr.addColorStop(0, '#cfcab8'); gr.addColorStop(1, '#4a4740'); gc.fillStyle = gr; gc.fillRect(m, m + 30, PS - 2 * m, PS - 2 * m - 60);
      for (const x of [110, 610]) { rect(gc, x - 28, 120, 56, 480, '#8d8a80'); rect(gc, x - 36, 110, 72, 24, '#6f6c63'); rect(gc, x - 36, 590, 72, 24, '#6f6c63'); for (let k = -18; k <= 18; k += 12) rect(gc, x + k, 140, 4, 440, 'rgba(60,58,52,0.5)'); }
      gc.fillStyle = '#5a574e'; gc.beginPath(); gc.moveTo(m, m + 30); gc.quadraticCurveTo(200, 160, 360, m + 40); gc.quadraticCurveTo(520, 160, PS - m, m + 30); gc.lineTo(PS - m, m + 30); gc.fill();
      for (let y = 0; y < PS; y += 60) { rect(gc, 8, y + 14, 18, 30, '#e8e8e8'); rect(gc, PS - 26, y + 14, 18, 30, '#e8e8e8'); }
    },
    fg(gc, t) {
      const r = rng(Math.floor(t * 24)); noise(gc, 160, r, ['#fff', '#000'], [0.6, 2], [0.2, 0.6], [40, 70, PS - 80, PS - 140]);
      gc.strokeStyle = 'rgba(255,255,255,0.35)'; gc.lineWidth = 1.5; for (let k = 0; k < 2; k++) { const x = 60 + r() * 600; gc.beginPath(); gc.moveTo(x, 70); gc.lineTo(x + (r() - 0.5) * 8, PS - 70); gc.stroke(); }
      gc.fillStyle = `rgba(0,0,0,${0.12 + 0.12 * r()})`; gc.fillRect(40, 70, PS - 80, PS - 140);
    },
    fig(gc, p, fx, floor, fh, hat, pal) { flatFigure(gc, p, pal, fx, floor, fh, hat); }, floor: 0.84, fh: 0.5 },

  poster: { name: 'FILM POSTER', where: 'Madras · 1994', move: 'rubber', hat: 'cap',
    pal: { skin: '#9a5e3a', hair: '#130d09', shirt: '#ffffff', pants: '#16161c', shoes: '#ffffff', hat: '#d8262b', sleeve: 'long', line: '#130d09' },
    bg(gc, r) {
      const gr = gc.createLinearGradient(0, 0, 0, PS); gr.addColorStop(0, '#ffd23a'); gr.addColorStop(0.55, '#ff7a1a'); gr.addColorStop(1, '#b3121c'); gc.fillStyle = gr; gc.fillRect(0, 0, PS, PS);
      gc.fillStyle = 'rgba(255,255,220,0.25)'; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; gc.beginPath(); gc.moveTo(360, 420); gc.lineTo(360 + Math.cos(a) * 900, 420 + Math.sin(a) * 900); gc.lineTo(360 + Math.cos(a + 0.12) * 900, 420 + Math.sin(a + 0.12) * 900); gc.fill(); }
      gc.save(); gc.font = `bold 92px ${SANS}`; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.lineJoin = 'round'; gc.lineWidth = 16; gc.strokeStyle = '#3a0a0a'; gc.strokeText('DANCE STORM', 360, 90); const tg = gc.createLinearGradient(0, 50, 0, 130); tg.addColorStop(0, '#fff6a8'); tg.addColorStop(1, '#ffb21a'); gc.fillStyle = tg; gc.fillText('DANCE STORM', 360, 90); gc.restore();
      text(gc, 'நடனப் புயல்', 360, 162, `bold 46px ${INDIC}`, '#fff7e0');
      rect(gc, 0, PS - 70, PS, 70, '#2a0606'); text(gc, 'NOW SHOWING · 70MM · EASTMAN COLOUR', 360, PS - 35, `bold 26px ${SANS}`, '#ffd23a');
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, hat, 4, '#2a0606'); highlight(gc, p, fx, floor, fh); }, floor: 0.88, fh: 0.58 },

  tv: { name: 'TELEVISION', where: 'Sunday evening · 1986', move: 'point',
    pal: { skin: '#8a5a3c', hair: '#18110d', shirt: '#f3efe6', pants: '#1d1d24', shoes: '#f1f1f1', hat: '#1d1d24', sleeve: 'long', line: '#0d0d0d' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#d8c79a'); gc.fillStyle = '#c4ae7a'; for (let y = 0; y < PS; y += 60) for (let x = (y / 60) % 2 ? 30 : 0; x < PS; x += 60) { gc.beginPath(); gc.arc(x, y, 12, 0, TAU); gc.fill(); }
      gc.strokeStyle = '#333'; gc.lineWidth = 5; gc.beginPath(); gc.moveTo(330, 120); gc.lineTo(250, 30); gc.moveTo(390, 120); gc.lineTo(470, 26); gc.stroke();
      const wood = gc.createLinearGradient(0, 120, 0, 620); wood.addColorStop(0, '#7a4a24'); wood.addColorStop(1, '#4e2c12'); gc.fillStyle = wood; gc.beginPath(); gc.roundRect(80, 120, 560, 470, 30); gc.fill();
      gc.fillStyle = '#2a2a2a'; gc.beginPath(); gc.roundRect(110, 150, 400, 330, 40); gc.fill();
      for (const y of [190, 260]) { gc.fillStyle = '#c9c0a8'; gc.beginPath(); gc.arc(575, y, 24, 0, TAU); gc.fill(); gc.fillStyle = '#555'; gc.fillRect(572, y - 18, 6, 18); }
      for (let y = 330; y < 460; y += 12) rect(gc, 545, y, 60, 5, '#2e1a0b');
      rect(gc, 130, 590, 40, 70, '#3a2210'); rect(gc, 550, 590, 40, 70, '#3a2210');
    },
    clip: [122, 162, 376, 306],
    fg(gc, t) {
      gc.save(); gc.beginPath(); gc.roundRect(122, 162, 376, 306, 30); gc.clip();
      gc.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 162; y < 470; y += 4) gc.fillRect(122, y, 376, 2);
      const yb = 162 + ((t * 60) % 360); gc.fillStyle = 'rgba(255,255,255,0.06)'; gc.fillRect(122, yb, 376, 40);
      const gl = gc.createRadialGradient(260, 260, 20, 310, 315, 260); gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(1, 'rgba(0,0,0,0.35)'); gc.fillStyle = gl; gc.fillRect(122, 162, 376, 306); gc.restore();
    },
    screenBg(gc) { const gr = gc.createLinearGradient(0, 162, 0, 468); gr.addColorStop(0, '#4a6a8a'); gr.addColorStop(1, '#2a3a4a'); gc.fillStyle = gr; gc.fillRect(122, 162, 376, 306); rect(gc, 122, 420, 376, 48, '#3c4a30'); },
    fig(gc, p, fx, floor, fh, hat, pal) { gc.save(); gc.filter = 'saturate(0.6) contrast(1.1)'; flatFigure(gc, p, pal, fx, floor, fh, hat); gc.restore(); }, floor: 0.6, fh: 0.33, fx: 310 },

  cassette: { name: 'CASSETTE', where: 'side A · 1996', move: 'spin', hat: 'cap',
    pal: { skin: '#8a5a3c', hair: '#18110d', shirt: '#2a6dd9', pants: '#f2f2f2', shoes: '#ffcf33', hat: '#ffcf33', sleeve: 'short', line: '#111' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#f4f1e8'); const cols = ['#e63946', '#f4a261', '#f6d55c', '#2a9d8f', '#3a6ea5'];
      cols.forEach((col, i) => { gc.fillStyle = col; gc.beginPath(); gc.moveTo(0, 60 + i * 34); gc.lineTo(PS, -100 + i * 34); gc.lineTo(PS, -66 + i * 34); gc.lineTo(0, 94 + i * 34); gc.fill(); });
      rect(gc, 0, PS - 150, PS, 150, '#141414'); text(gc, 'SIDE A', 50, PS - 118, `bold 30px ${SANS}`, '#f6d55c', 'left');
      ['1. Rubber Legs', '2. Dance Storm', '3. Chennai Nights', '4. Step by Step'].forEach((s, i) => text(gc, s, 50 + (i % 2) * 330, PS - 70 + Math.floor(i / 2) * 36, `24px ${MONO}`, '#e8e8e8', 'left'));
      text(gc, 'HI-FI STEREO · 60', PS - 40, PS - 118, `bold 22px ${SANS}`, '#e8e8e8', 'right');
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, hat, 4, '#111'); }, floor: 0.78, fh: 0.5 },

  truck: { name: 'TRUCK ART', where: 'National Highway · 2000', move: 'kick', hat: 'cap',
    pal: { skin: '#8a5a3c', hair: '#18110d', shirt: '#ff2e7e', pants: '#1a1a8a', shoes: '#ffe000', hat: '#00a86b', sleeve: 'short', line: '#111' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#ffe23a'); rect(gc, 30, 30, PS - 60, PS - 60, '#e8202a'); rect(gc, 50, 50, PS - 100, PS - 100, '#1f9e4f'); rect(gc, 62, 62, PS - 124, PS - 124, '#fff4d0');
      for (let i = 0; i < 18; i++) { const x = 70 + i * 34; for (const y of [40, PS - 40]) { gc.fillStyle = ['#ff2e7e', '#2a5bd7', '#fff'][i % 3]; gc.beginPath(); gc.arc(x, y, 9, 0, TAU); gc.fill(); } }
      const flower = (x, y, s) => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; gc.fillStyle = k % 2 ? '#ff2e7e' : '#2a5bd7'; gc.beginPath(); gc.ellipse(x + Math.cos(a) * 16 * s, y + Math.sin(a) * 16 * s, 12 * s, 6 * s, a, 0, TAU); gc.fill(); } gc.fillStyle = '#ffe000'; gc.beginPath(); gc.arc(x, y, 7 * s, 0, TAU); gc.fill(); };
      [[110, 110], [610, 110], [110, 520], [610, 520]].forEach(([x, y]) => flower(x, y, 1.4));
      // the painted eyes
      for (const x of [270, 450]) { gc.fillStyle = '#fff'; gc.beginPath(); gc.ellipse(x, 120, 50, 24, 0, 0, TAU); gc.fill(); gc.strokeStyle = '#111'; gc.lineWidth = 4; gc.stroke(); gc.fillStyle = '#111'; gc.beginPath(); gc.arc(x, 120, 14, 0, TAU); gc.fill(); gc.strokeStyle = '#111'; gc.lineWidth = 6; gc.beginPath(); gc.arc(x, 132, 62, -2.4, -0.7); gc.stroke(); }
      gc.save(); gc.font = `bold 50px ${SANS}`; gc.textAlign = 'center'; gc.lineWidth = 8; gc.strokeStyle = '#111'; gc.strokeText('HORN OK PLEASE', 360, 620); gc.fillStyle = '#e8202a'; gc.fillText('HORN OK PLEASE', 360, 620); gc.restore();
    },
    fg(gc, t) { for (let i = 0; i < 12; i++) { const x = 80 + i * 52, sw = Math.sin(t * 5 + i) * 0.25; gc.save(); gc.translate(x, 62); gc.rotate(sw); gc.strokeStyle = '#111'; gc.lineWidth = 2; gc.beginPath(); gc.moveTo(0, 0); gc.lineTo(0, 30); gc.stroke(); gc.fillStyle = ['#ff2e7e', '#ffe000', '#2a5bd7', '#00a86b'][i % 4]; gc.beginPath(); gc.moveTo(-8, 30); gc.lineTo(8, 30); gc.lineTo(0, 56); gc.fill(); gc.restore(); } },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, hat, 5, '#111'); }, floor: 0.8, fh: 0.48 },

  neon: { name: 'NEON', where: 'Mumbai · 2005', move: 'rubber',
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#140f1a'); for (let y = 0; y < PS; y += 30) for (let x = (y / 30) % 2 ? -30 : 0; x < PS; x += 60) { gc.fillStyle = `rgb(${38 + r() * 14},${24 + r() * 10},${34 + r() * 12})`; gc.fillRect(x + 2, y + 2, 56, 26); }
      const fl = gc.createLinearGradient(0, PS - 120, 0, PS); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,0.6)'); gc.fillStyle = fl; gc.fillRect(0, PS - 120, PS, 120);
    },
    fg(gc, t) {
      const on = Math.sin(t * 13) > -0.9 || Math.sin(t * 3.1) > 0.5;
      gc.save(); gc.textAlign = 'center'; gc.textBaseline = 'middle';
      gc.font = `bold 110px ${INDIC}`; gc.shadowColor = '#ff3fa4'; gc.shadowBlur = 30; gc.fillStyle = on ? '#ff8fd0' : '#5a2244'; gc.fillText('नाच', 220, 120);
      gc.font = `bold 64px ${SANS}`; gc.shadowColor = '#3fe6ff'; gc.fillStyle = '#b8f6ff'; gc.fillText('DANCE', 520, 130); gc.restore();
      gc.strokeStyle = 'rgba(63,230,255,0.6)'; gc.shadowColor = '#3fe6ff'; gc.shadowBlur = 16; gc.lineWidth = 5; gc.strokeRect(40, 40, PS - 80, PS - 80); gc.shadowBlur = 0;
    },
    fig(gc, p, fx, floor, fh) { neonBody(gc, p, fx, floor, fh, '#ffd23f', '#fff7d6'); }, floor: 0.86, fh: 0.52 },

  popart: { name: 'POP ART', where: 'silkscreen · 2008', move: 'spin', hat: 'fedora',
    pal: { skin: '#ffd23a', hair: '#111', shirt: '#ff3d7f', pants: '#1a3cff', shoes: '#111', hat: '#111', band: '#ff3d7f', sleeve: 'long', line: '#111' },
    bg(gc, r) {
      [['#ff7ab6', 0, 0], ['#3fe0d0', 360, 0], ['#ffe14d', 0, 360], ['#ff8c3a', 360, 360]].forEach(([col, x, y]) => { rect(gc, x, y, 360, 360, col); gc.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = y + 8; yy < y + 360; yy += 16) for (let xx = x + ((yy / 16) % 2 ? 8 : 0) + 4; xx < x + 360; xx += 16) { gc.beginPath(); gc.arc(xx, yy, 4, 0, TAU); gc.fill(); } });
      gc.save(); gc.translate(560, 130); gc.rotate(-0.12); gc.fillStyle = '#fff'; gc.strokeStyle = '#111'; gc.lineWidth = 5; gc.beginPath(); gc.ellipse(0, 0, 130, 60, 0, 0, TAU); gc.fill(); gc.stroke(); gc.beginPath(); gc.moveTo(-60, 46); gc.lineTo(-90, 100); gc.lineTo(-20, 56); gc.fill(); gc.stroke(); text(gc, 'WOW!', 0, 2, `bold 58px ${SANS}`, '#e8202a'); gc.restore();
    },
    fig(gc, p, fx, floor, fh, hat, pal) { outlined(gc, p, fx, floor, fh, pal, hat, 6, '#111', null, 0, true); }, floor: 0.88, fh: 0.56 },

  lcd: { name: 'MOBILE PHONE', where: 'monochrome LCD · 2003', move: 'groove',
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#a7c44a'); gc.fillStyle = 'rgba(60,80,20,0.08)'; for (let x = 0; x < PS; x += 12) gc.fillRect(x, 0, 1, PS); for (let y = 0; y < PS; y += 12) gc.fillRect(0, y, PS, 1);
      const px = (x, y, w, h) => { gc.fillStyle = '#2b3a10'; gc.fillRect(x * 12, y * 12, w * 12 - 1, h * 12 - 1); };
      for (let i = 0; i < 5; i++) px(3 + i * 2, 6 - i, 1, i + 1);
      px(50, 2, 6, 4); px(56, 3, 1, 2); px(51, 3, 1, 2); px(53, 3, 1, 2);
      text(gc, '12:45', 360, 52, `bold 44px ${MONO}`, '#2b3a10');
      for (let x = 2; x < 58; x++) { px(x, 55, 1, 1); }
      text(gc, 'Menu', 120, PS - 24, `bold 32px ${MONO}`, '#2b3a10'); text(gc, 'Dance', PS - 130, PS - 24, `bold 32px ${MONO}`, '#2b3a10');
    },
    fg(gc, t) { // a snake running round the top
      const len = 14, head = Math.floor(t * 14); for (let k = 0; k < len; k++) { const i = (head - k + 400) % 100, x = 4 + (i < 50 ? i : 99 - i), y = i < 50 ? 9 : 10; gc.fillStyle = '#2b3a10'; gc.fillRect(x * 12 % PS, y * 12, 11, 11); } },
    fig(gc, p, fx, floor, fh, hat) { pixels(gc, p, fx, floor, fh, 12, '#2b3a10', 'cap'); }, floor: 0.88, fh: 0.56 },

  lowpoly: { name: 'LOW POLY', where: 'video game · 2015', move: 'point', hat: 'cap',
    pal: { skin: '#a86c47', hair: '#1a120c', shirt: '#ff6b35', pants: '#2b2d42', shoes: '#ffffff', hat: '#2b2d42', sleeve: 'short', line: '#111' },
    bg(gc, r) {
      const sky = gc.createLinearGradient(0, 0, 0, 380); sky.addColorStop(0, '#3fa7f5'); sky.addColorStop(1, '#bfe6ff'); gc.fillStyle = sky; gc.fillRect(0, 0, PS, 380);
      for (let i = 0; i < 9; i++) { const x = i * 100 - 40, h = 120 + r() * 120; gc.fillStyle = i % 2 ? '#6a8caf' : '#55789c'; gc.beginPath(); gc.moveTo(x, 380); gc.lineTo(x + 60, 380 - h); gc.lineTo(x + 140, 380); gc.fill(); gc.fillStyle = 'rgba(255,255,255,0.5)'; gc.beginPath(); gc.moveTo(x + 60, 380 - h); gc.lineTo(x + 75, 380 - h + 40); gc.lineTo(x + 45, 380 - h + 40); gc.fill(); }
      const gr = gc.createLinearGradient(0, 380, 0, PS); gr.addColorStop(0, '#5fbf5a'); gr.addColorStop(1, '#2f8a3a'); gc.fillStyle = gr; gc.fillRect(0, 380, PS, PS - 380);
      gc.fillStyle = '#4a4a55'; gc.beginPath(); gc.moveTo(340, 380); gc.lineTo(380, 380); gc.lineTo(620, PS); gc.lineTo(100, PS); gc.fill();
      gc.fillStyle = '#f5d33a'; for (let k = 0; k < 6; k++) { const u = k / 6, u2 = (k + 0.5) / 6, y1 = 380 + u * u * 340, y2 = 380 + u2 * u2 * 340; gc.beginPath(); gc.moveTo(360 - 2 - u * 6, y1); gc.lineTo(360 + 2 + u * 6, y1); gc.lineTo(360 + 2 + u2 * 6, y2); gc.lineTo(360 - 2 - u2 * 6, y2); gc.fill(); }
      rect(gc, 0, 0, PS, 60, 'rgba(0,0,0,0.35)'); text(gc, 'SCORE 004270', 30, 30, `bold 30px ${MONO}`, '#fff', 'left'); text(gc, 'COMBO x12', PS - 30, 30, `bold 30px ${MONO}`, '#ffd23a', 'right');
    },
    fig(gc, p, fx, floor, fh, hat, pal) { lowpoly(gc, p, fx, floor, fh, pal, hat); }, floor: 0.9, fh: 0.54 },

  reel: { name: 'REEL', where: 'phone screen · 2024', move: 'rubber', hat: 'cap',
    pal: { skin: '#8a5a3c', hair: '#18110d', shirt: '#121212', pants: '#121212', shoes: '#f1f1f1', hat: '#f1f1f1', sleeve: 'short', line: '#111' },
    bg(gc, r) {
      rect(gc, 0, 0, PS, PS, '#ece6da'); gc.fillStyle = '#111'; gc.beginPath(); gc.roundRect(170, 10, 380, 700, 54); gc.fill();
      const gr = gc.createLinearGradient(0, 30, 0, 690); gr.addColorStop(0, '#5b2a86'); gr.addColorStop(0.6, '#d2456b'); gr.addColorStop(1, '#f39a4a'); gc.fillStyle = gr; gc.beginPath(); gc.roundRect(186, 26, 348, 668, 42); gc.fill();
      rect(gc, 320, 40, 80, 18, '#111');
      text(gc, 'Reels', 210, 86, `bold 26px ${SANS}`, '#fff', 'left');
      text(gc, '#DanceStorm', 210, 618, `bold 22px ${SANS}`, '#fff', 'left'); text(gc, '♫ original audio', 210, 648, `18px ${SANS}`, 'rgba(255,255,255,0.85)', 'left');
      gc.strokeStyle = '#fff'; gc.lineWidth = 3; gc.beginPath(); gc.arc(500, 470, 12, 0, TAU); gc.stroke(); gc.beginPath(); gc.moveTo(488, 540); gc.lineTo(512, 552); gc.lineTo(488, 564); gc.stroke();
    },
    clip: [186, 26, 348, 668],
    fg(gc, t, lt) {
      const likes = Math.floor(1200 + Math.max(0, lt) * 31337);
      gc.fillStyle = '#ff2d55'; heart(gc, 500, 400, 18); text(gc, likes >= 1e6 ? (likes / 1e6).toFixed(1) + 'M' : (likes / 1000).toFixed(1) + 'K', 500, 432, `bold 18px ${SANS}`, '#fff');
      for (let i = 0; i < 9; i++) { const u = ((t * 0.5 + i / 9) % 1), x = 500 - u * 40 + Math.sin(u * 9 + i) * 14, y = 390 - u * 300; gc.globalAlpha = 1 - u; gc.fillStyle = ['#ff2d55', '#ff8fb1', '#fff'][i % 3]; heart(gc, x, y, 10 + 6 * (1 - u)); } gc.globalAlpha = 1;
    },
    fig(gc, p, fx, floor, fh, hat, pal) { gc.save(); gc.shadowColor = 'rgba(0,0,0,0.35)'; gc.shadowBlur = 20; gc.shadowOffsetY = 10; flatFigure(gc, p, pal, fx, floor, fh, hat); gc.restore(); }, floor: 0.86, fh: 0.5 },
};
function heart(gc, x, y, s) { gc.beginPath(); gc.moveTo(x, y + s * 0.9); gc.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); gc.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); gc.fill(); }

// ---- figure renderers per style ----------------------------------------------------------------------------------
function emboss(gc, p, fx, floor, fh, base, dark, light, hat) {
  flatFigure(gc, p, PAL.mono(dark), fx + 5, floor + 5, fh, hat, false);
  flatFigure(gc, p, PAL.mono(light), fx - 3, floor - 3, fh, hat, false);
  flatFigure(gc, p, PAL.mono(base), fx, floor, fh, hat, false);
}
function bronze(gc, p, fx, floor, fh) {
  f1.clearRect(0, 0, PS, PS);
  flatFigure(f1, p, { skin: '#6b4318', hair: '#3a230b', shirt: '#8a5a22', pants: '#7a4c1c', shoes: '#5a3612', hat: '#5a3612', sleeve: 'short', line: '#2a1606' }, fx, floor, fh, 'none', false);
  f1.globalCompositeOperation = 'source-atop'; const gr = f1.createLinearGradient(fx - fh * 0.3, 0, fx + fh * 0.3, 0); gr.addColorStop(0, 'rgba(255,220,140,0.55)'); gr.addColorStop(0.45, 'rgba(255,240,190,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); f1.fillStyle = gr; f1.fillRect(0, 0, PS, PS); f1.globalCompositeOperation = 'source-over';
  gc.save(); gc.shadowColor = 'rgba(255,170,60,0.45)'; gc.shadowBlur = 24; gc.drawImage(F1, 0, 0); gc.restore();
}
// Outline by stamping a solid silhouette round the figure; `gap` paints a second, inner ring (Madhubani's double line).
function outlined(gc, p, fx, floor, fh, pal, hat, r, lineCol, gapCol = null, gap = 0, halftone = false) {
  f1.clearRect(0, 0, PS, PS); flatFigure(f1, p, pal, fx, floor, fh, hat);
  if (halftone) { f1.globalCompositeOperation = 'source-atop'; f1.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < PS; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < PS; x += 10) { f1.beginPath(); f1.arc(x, y, 2.6, 0, TAU); f1.fill(); } f1.globalCompositeOperation = 'source-over'; }
  f2.clearRect(0, 0, PS, PS); f2.drawImage(F1, 0, 0); f2.globalCompositeOperation = 'source-in'; f2.fillStyle = lineCol; f2.fillRect(0, 0, PS, PS); f2.globalCompositeOperation = 'source-over';
  const ring = (rr) => { for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; gc.drawImage(F2, Math.cos(a) * rr, Math.sin(a) * rr); } };
  ring(r);
  if (gapCol) { f2.globalCompositeOperation = 'source-in'; f2.fillStyle = gapCol; f2.fillRect(0, 0, PS, PS); f2.globalCompositeOperation = 'source-over'; ring(r - gap); f2.globalCompositeOperation = 'source-in'; f2.fillStyle = lineCol; f2.fillRect(0, 0, PS, PS); f2.globalCompositeOperation = 'source-over'; ring(Math.max(1, r - gap - 2)); }
  gc.drawImage(F1, 0, 0);
}
function highlight(gc, p, fx, floor, fh) {
  // a painted rim light on the hand-painted poster
  f2.clearRect(0, 0, PS, PS); flatFigure(f2, p, PAL.mono('#fff2b0'), fx, floor, fh, 'cap', false);
  f2.globalCompositeOperation = 'destination-out'; f2.drawImage(F2, -6, 3); f2.globalCompositeOperation = 'source-over';
  gc.save(); gc.globalAlpha = 0.65; gc.drawImage(F2, 0, 0); gc.restore();
}
function necklace(gc, sp, fx, floor, fh) {
  const Q = rigPoints(sp, fx, floor, fh), s0 = fh / 7.65;
  gc.save(); gc.strokeStyle = '#f6dc7a'; gc.lineWidth = s0 * 0.09; gc.beginPath(); gc.arc(Q.neck[0], Q.neck[1] + s0 * 0.25, s0 * 0.33, 0.3, Math.PI - 0.3); gc.stroke();
  gc.fillStyle = '#d42a3a'; gc.beginPath(); gc.arc(Q.neck[0], Q.neck[1] + s0 * 0.6, s0 * 0.09, 0, TAU); gc.fill(); gc.restore();
}
function puppet(gc, p, fx, floor, fh, pal) {
  f1.clearRect(0, 0, PS, PS); flatFigure(f1, p, pal, fx, floor, fh, 'none', false);
  f1.globalCompositeOperation = 'destination-out'; for (let y = 0; y < PS; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < PS; x += 16) { f1.beginPath(); f1.arc(x, y, 2.4, 0, TAU); f1.fill(); } f1.globalCompositeOperation = 'source-over';
  const Q = rigPoints(p, fx, floor, fh);
  gc.save(); gc.globalAlpha = 0.88; gc.shadowColor = 'rgba(255,200,90,0.8)'; gc.shadowBlur = 16; gc.drawImage(F1, 0, 0); gc.restore();
  gc.fillStyle = '#2a120a'; for (const pt of [Q.eL, Q.eR, Q.kL, Q.kR]) { gc.beginPath(); gc.arc(pt[0], pt[1], 5, 0, TAU); gc.fill(); }
}
// His whole body as paint on rock or mud: a flat silhouette in one pigment, worn away in specks
function rockPaint(gc, p, fx, floor, fh, col, wear = 0.2) {
  f1.clearRect(0, 0, PS, PS); flatFigure(f1, p, PAL.mono(col), fx, floor, fh, 'none', false);
  f1.globalCompositeOperation = 'destination-out'; const r = rng(7);
  for (let i = 0; i < 900; i++) { f1.globalAlpha = r() * wear * 2.5; f1.beginPath(); f1.arc(r() * PS, r() * PS, 1 + r() * 3.5, 0, TAU); f1.fill(); }
  f1.globalAlpha = 1; f1.globalCompositeOperation = 'source-over';
  gc.save(); gc.globalAlpha = 0.92; gc.drawImage(F1, 0, 0); gc.restore();
}
// His whole body as a neon tube: the silhouette's rim glowing, a hot core, dark inside
function neonBody(gc, p, fx, floor, fh, col, core) {
  f2.clearRect(0, 0, PS, PS); flatFigure(f2, p, PAL.mono('#000'), fx, floor, fh, 'cap', false);
  const tint = (c) => { f1.clearRect(0, 0, PS, PS); f1.drawImage(F2, 0, 0); f1.globalCompositeOperation = 'source-in'; f1.fillStyle = c; f1.fillRect(0, 0, PS, PS); f1.globalCompositeOperation = 'source-over'; };
  const ring = (rr) => { for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; gc.drawImage(F1, Math.cos(a) * rr, Math.sin(a) * rr); } };
  gc.save(); tint(col); gc.shadowColor = col; gc.shadowBlur = 22; ring(5); gc.shadowBlur = 0; tint(core); ring(2.5); tint('#1a1220'); gc.drawImage(F1, 0, 0); gc.restore();
}
function pixels(gc, p, fx, floor, fh, cell, col, hat) {
  f1.clearRect(0, 0, PS, PS); flatFigure(f1, p, PAL.mono('#000'), fx, floor, fh, hat, false);
  const d = f1.getImageData(0, 0, PS, PS).data; gc.fillStyle = col;
  for (let y = cell / 2; y < PS; y += cell) for (let x = cell / 2; x < PS; x += cell) if (d[(Math.floor(y) * PS + Math.floor(x)) * 4 + 3] > 110) gc.fillRect(x - cell / 2, y - cell / 2, cell - 1, cell - 1);
}
function lowpoly(gc, p, fx, floor, fh, pal, hat) {
  f1.clearRect(0, 0, PS, PS); flatFigure(f1, p, pal, fx, floor, fh, hat);
  f1.globalCompositeOperation = 'source-atop'; const r = rng(9), s = 34;
  for (let y = -s; y < PS + s; y += s) for (let x = -s; x < PS + s; x += s) for (let tri = 0; tri < 2; tri++) {
    const v = r(); f1.fillStyle = v < 0.5 ? `rgba(255,255,255,${0.05 + v * 0.18})` : `rgba(0,0,0,${(v - 0.5) * 0.35})`; f1.beginPath();
    const ox = fx % s; if (tri) { f1.moveTo(x + ox, y); f1.lineTo(x + ox + s, y); f1.lineTo(x + ox, y + s); } else { f1.moveTo(x + ox + s, y); f1.lineTo(x + ox + s, y + s); f1.lineTo(x + ox, y + s); } f1.fill(); }
  f1.globalCompositeOperation = 'source-over';
  gc.save(); gc.shadowColor = 'rgba(0,0,0,0.3)'; gc.shadowBlur = 0; gc.shadowOffsetX = 14; gc.shadowOffsetY = 6; gc.drawImage(F1, 0, 0); gc.restore();
}

// ---- caches -------------------------------------------------------------------------------------------------------
const LIST = B.panels.map((id, k) => ({ id, k, ...PANELS[id] }));
for (const P_ of LIST) {
  P_.cache = mk(PS, PS); const gc = P_.cache.getContext('2d'); P_.bg(gc, rng(100 + P_.k)); if (P_.screenBg) P_.screenBg(gc);
  P_.thumb = mk(PS, PS); const tg = P_.thumb.getContext('2d'); tg.drawImage(P_.cache, 0, 0); if (P_.fg) P_.fg(tg, 1.3, 0);
  drawFigureIn(tg, P_, toSpark(MOVES[P_.move](0.3)), P_.fx || PS / 2);
}
function drawFigureIn(gc, P_, pose, fx) {
  gc.save(); if (P_.clip) { gc.beginPath(); gc.roundRect(P_.clip[0], P_.clip[1], P_.clip[2], P_.clip[3], 24); gc.clip(); }
  P_.fig(gc, pose, fx, (P_.floor || 0.86) * PS, (P_.fh || 0.52) * PS, P_.hat || 'none', P_.pal || PAL.hero); gc.restore();
}
// the panels' drop shadow, blurred once (a per-frame shadowBlur is slow on phones)
const SHADOW = mk(PS + 180, PS + 180); { const sg = SHADOW.getContext('2d'); sg.shadowColor = 'rgba(60,45,25,0.30)'; sg.shadowBlur = 34; sg.shadowOffsetX = 10000; sg.shadowOffsetY = 14; sg.fillStyle = '#000'; sg.fillRect(90 - 10000, 90, PS, PS); }
const wall = mk(W, H); { const wg = wall.getContext('2d'); wg.fillStyle = '#ebe5d8'; wg.fillRect(0, 0, W, H); noise(wg, 9000, rng(3), ['#d9d1c0', '#f6f1e6'], [0.5, 2], [0.15, 0.4], [0, 0, W, H]); }

// ---- choreography ---------------------------------------------------------------------------------------------------
// The camera never stops: it glides along the wall, slower as a panel passes the centre and faster between
// them, and he dances the whole way, crossing a border every PB beats (panel k owns beats PB*k..PB*(k+1)). Each panel gets its own pair of moves; at five borders he moonwalks across instead.
const DANCE = {
  rock: [['groove', 4], ['shrug', 4]], seal: [['point', 4], ['robot', 4]], nataraja: [['nataraja', 8]], relief: [['kick', 4], ['thumka', 4]],
  mughal: [['hatTip', 4], ['neck', 4]], tanjore: [['point', 4], ['toe', 4]], warli: [['rubber', 4], ['bhangra', 4]], madhubani: [['thumka', 4], ['taps', 4]],
  puppet: [['robot', 4], ['kick', 4]], kalighat: [['scratch', 4], ['shrug', 4]], silent: [['lean', 4], ['groove', 4]], poster: [['mukkala', 4], ['mukkalaInv', 4]],
  tv: [['urvasiEasy', 4], ['shoulders', 4]], cassette: [['spin', 4], ['taps', 4]], truck: [['bhangra', 4], ['kick', 4]], neon: [['rubber', 4], ['neck', 4]],
  popart: [['spin', 4], ['scratch', 4]], lcd: [['robot', 4], ['shoulders', 4]], lowpoly: [['kick', 4], ['urvasiEasy', 4]], reel: [['mukkala', 8], ['mukkalaInv', 4], ['final', 99]],
};
const MOONWALK = [2, 5, 9, 12, 16, 19];             // the borders he moonwalks over (into these panels)
const SEGS = (() => {
  const raw = []; B.panels.forEach((id, k) => { let b = PB * k; for (const [m, n] of DANCE[id]) { raw.push([b, b + n, m]); b += n; } });
  let out = raw;
  for (const k of MOONWALK) { const a = PB * k - 1.5, z = PB * k + 1.5, next = [];
    for (const [s0, s1, m] of out) { if (s1 <= a || s0 >= z) next.push([s0, s1, m]); else { if (s0 < a) next.push([s0, a, m]); if (s1 > z) next.push([z, s1, m, s0]); } }
    next.push([a, z, 'moonwalk']); out = next.sort((p, q) => p[0] - q[0]); }
  return out;                                        // [start, end, move, (phase origin)]
})();
const XF = 0.4;                                      // beats of cross-fade between moves
function poseAt(gb) {
  let i = SEGS.findIndex(([s0, s1]) => gb >= s0 && gb < s1); if (i < 0) i = gb < 0 ? 0 : SEGS.length - 1;
  const [s0, , m, o] = SEGS[i], cur = MOVES[m](gb - (o ?? s0));
  if (i > 0 && gb - s0 < XF) { const [p0, , pm, po] = SEGS[i - 1]; return blendPose(MOVES[pm](gb - (po ?? p0)), cur, ease((gb - s0) / XF)); }
  return cur;
}
// camera x in panel pitches, u = (t - T0) / TP: at rest on panel 0, then cruising, at rest on the last panel at TEND
const SPEED = 0.4;
function camU(u) {
  const herm = (s, p0, m0, p1, m1) => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1; };
  if (u <= 0) return 0;
  if (u < 1) return herm(u, 0, 0, 0.5, 1 + SPEED);
  if (u < N - 1) { const w = u - 0.5; return w - SPEED * Math.sin(TAU * w) / TAU; }
  if (u < N) return herm(u - (N - 1), N - 1.5, 1 + SPEED, N - 1, 0);
  return N - 1;
}
function camera(t) {
  if (t < T0) return { x: panelX(0), s: 1 };
  const x = camU((t - T0) / TP) * PITCH;
  const z = seg(t, TEND + 0.6, TEND + 4.4);
  return { x: lerp(x, panelX((N - 1) / 2), z), s: lerp(1, (W * 0.94) / (N * PITCH), z ** 0.7) };
}
// The shots in the song (B.hits, video seconds): on each one he fires a finger gun, the arm snapping out and
// kicking up with the recoil, alternating hands; a BANG! flash at the fingertip and a jolt of the camera.
const HITS = B.hits || [];
function shotAt(t) {
  let best = null; HITS.forEach((h, i) => { const d = t - h; if (d > -0.12 && d < 0.45 && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, i, h }; });
  return best;
}
function shoot(pose, t) {
  const s = shotAt(t); if (!s) return { pose, shot: null };
  const w = s.d < 0 ? ease(1 + s.d / 0.12) : 1 - ease(clamp((s.d - 0.18) / 0.27, 0, 1));   // in fast, hold, let go
  const kick = s.d < 0 ? 0 : Math.exp(-s.d * 14) * 0.45, right = s.i % 2 === 0;
  const aim = right ? { ra: [1.55 - kick, -0.05 - kick * 0.6] } : { la: [-1.55 + kick, 0.05 + kick * 0.6] };
  const target = { ...pose, ...aim, lean: pose.lean + (right ? -1 : 1) * 0.05 * kick, head: right ? 0.18 : -0.18, face: 1 };
  if (w > 0.3) target[right ? 'hR' : 'hL'] = 'point';
  return { pose: blendPose(pose, target, w), shot: { right, k: s.d < 0 ? 0 : Math.max(0, 1 - s.d / 0.22), d: s.d } };
}
// The captured Mukkala routine (stories/prabhu-mocap.json): clip time t + offset = song time, so each clip plays
// exactly where it happens in the song. Clip B's legs leave the frame after 4.5 s; from there only its upper
// body is used and the legs come from the procedural dance.
const SONG0 = (B.song && B.song.offset) || 0;
const CLIPS = Object.entries(MC).filter(([, c]) => c && c.frames).map(([k, c]) => {
  const [m, sec] = c.offset.split(':').map(Number), base = m * 60 + sec - SONG0;
  return { k, c, t0: base + c.frames[0].t, t1: base + c.frames[c.frames.length - 1].t, base, legsUntil: k === 'B' ? base + 4.5 : Infinity };
});
function captured(t, proc) {
  for (const C of CLIPS) {
    if (t < C.t0 - 0.35 || t > C.t1 + 0.35) continue;
    const f = sampleClip(C.c.frames, t - C.base);
    let cap = { ...proc, tl: f.tl, st: f.st, pt: f.pt, ht: f.ht, hx: f.hx, aL: f.aL, aR: f.aR, lL: f.lL, lR: f.lR, fL: f.fL, fR: f.fR, hs: 0, y: 0, sx: 1, inv: 0, hL: 'open', hR: 'open' };
    if (t > C.legsUntil) { const u = clamp((t - C.legsUntil) / 0.4, 0, 1); const legs = blendSpark({ lL: f.lL, lR: f.lR, pt: f.pt }, { lL: proc.lL, lR: proc.lR, pt: proc.pt }, u); cap = { ...cap, ...legs, fL: proc.fL, fR: proc.fR }; }
    const w = ease(clamp((t - (C.t0 - 0.35)) / 0.35, 0, 1)) * ease(clamp(((C.t1 + 0.35) - t) / 0.35, 0, 1));
    return { sp: blendSpark(proc, cap, w), on: w > 0.5 };
  }
  return null;
}
function dancer(t) {
  const gb = (t - T0) / BEAT, base = t < T0 ? MOVES.groove(0) : poseAt(gb), sh = shoot(base, t);
  let sp = toSpark(sh.pose), shot = sh.shot;
  const cap = captured(t, toSpark(base));
  if (cap) { sp = cap.sp; if (shot && cap.on) shot = { ...shot, right: null }; }   // during the routine the shot lands on whichever hand is out
  if (t < T0) return { wx: panelX(0), pose: sp, shot };
  const x = camU((t - T0) / TP) * PITCH;
  return { wx: x + Math.sin(gb * Math.PI / 6) * 14, pose: sp, shot };
}
// the BANG! at the fingertip, in panel-local px
function bang(gc, P_, pose, fx, shot) {
  if (!shot || shot.k <= 0) return;
  const fh = (P_.fh || 0.52) * PS, floor = (P_.floor || 0.86) * PS, Q = rigPoints(pose, fx, floor, fh);
  let right = shot.right;
  if (right === null) right = Math.abs(Q.wR[0] - Q.shR[0]) >= Math.abs(Q.wL[0] - Q.shL[0]);
  const hx = right ? Q.wR[0] : Q.wL[0], hy = right ? Q.wR[1] : Q.wL[1], ex = right ? Q.eR : Q.eL;
  const dx = hx - ex[0], dy = hy - ex[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
  const cx = hx + ux * 40, cy = hy + uy * 40, R0 = 26 + 44 * (1 - shot.k), k = shot.k;
  gc.save(); gc.globalAlpha = Math.min(1, k * 1.6);
  gc.fillStyle = '#ffe14d'; gc.strokeStyle = '#1a1206'; gc.lineWidth = 4; gc.beginPath();
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + 0.2, r = i % 2 ? R0 * 0.55 : R0; gc.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  gc.closePath(); gc.fill(); gc.stroke();
  gc.fillStyle = '#ff4a2b'; gc.beginPath(); gc.arc(cx, cy, R0 * 0.35, 0, TAU); gc.fill();
  if (shot.d > 0.02) { gc.font = `bold ${Math.round(30 + 10 * (1 - k))}px ${SANS}`; gc.textAlign = 'center'; gc.textBaseline = 'middle'; gc.lineWidth = 6; gc.strokeText('BANG!', cx + ux * 70, cy + uy * 20 - 40); gc.fillStyle = '#fff'; gc.fillText('BANG!', cx + ux * 70, cy + uy * 20 - 40); }
  gc.restore();
}

// ---- drawing --------------------------------------------------------------------------------------------------------
const YC = H / 2 - 36;
function drawGallery(t, cam, dn, opts = {}) {
  g.save(); g.translate(W / 2, YC); g.scale(cam.s, cam.s); g.translate(-cam.x, 0);
  const halfW = W / 2 / cam.s;
  for (const P_ of LIST) {
    const cx = panelX(P_.k); if (cx + PS / 2 < cam.x - halfW - 20 || cx - PS / 2 > cam.x + halfW + 20) continue;
    const x0 = cx - PS / 2, y0 = -PS / 2;
    g.drawImage(SHADOW, x0 - 90, y0 - 90);
    const showThumb = opts.thumbs ? opts.thumbs(P_.k) : 0;
    g.drawImage(P_.cache, x0, y0);
    g.save(); g.translate(x0, y0); g.beginPath(); g.rect(0, 0, PS, PS); g.clip();
    if (P_.fg) P_.fg(g, t, t - (T0 + P_.k * TP));
    if (showThumb > 0) { g.globalAlpha = showThumb; g.drawImage(P_.thumb, 0, 0); g.globalAlpha = 1; }
    // the dancer, in this panel's style, wherever he overlaps it
    if (dn && Math.abs(dn.wx - cx) < PS * 0.95) { const fxl = dn.wx - x0 + (P_.fx ? P_.fx - PS / 2 : 0); drawFigureIn(g, P_, dn.pose, fxl); bang(g, P_, dn.pose, fxl, dn.shot); }
    g.restore();
    // label
    if (cam.s > 0.45) {
      const a = clamp((cam.s - 0.45) / 0.25, 0, 1); g.globalAlpha = a;
      text(g, String(P_.k + 1).padStart(2, '0'), x0, PS / 2 + 40, `bold 20px ${MONO}`, '#9a8f7c', 'left');
      text(g, P_.name, x0 + 44, PS / 2 + 40, `bold 22px ${SANS}`, '#3a342a', 'left');
      text(g, P_.where, x0 + PS, PS / 2 + 40, `italic 20px ${SERIF}`, '#7d725f', 'right');
      g.globalAlpha = 1;
    }
  }
  g.restore();
}
function title(a, y, big = 96, sub = 'the dance through time', sub2 = 'Bhimbetka 8000 BC  →  Reels 2024') {
  if (a <= 0) return; g.globalAlpha = a;
  spaced(g, 'PRABHU DEVA', W / 2, y, `${big}px ${SERIF}`, '#2e2820', big * 0.22);
  text(g, sub, W / 2, y + big * 0.85, `italic ${big * 0.36}px ${SERIF}`, '#6d6252');
  text(g, sub2, W / 2, y + big * 1.35, `${big * 0.22}px ${MONO}`, '#9a8f7c');
  g.globalAlpha = 1;
}
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(wall, 0, 0);
  const sh0 = t < T0 ? shotAt(t) : null;
  if (sh0 && sh0.d > 0) { const j = Math.exp(-sh0.d * 18) * 10; g.translate(Math.sin(t * 97) * j, Math.cos(t * 83) * j * 0.6); }
  if (t < T0) {
    // the opening: title, then the twenty panels laid out small, then a zoom into the first
    const zoom = seg(t, 3.3, T0), ts = 0.19, GY = 580;
    const gridS = lerp(ts, 1, zoom ** 1.6);
    if (zoom <= 0) {
      title(seg(t, 0.2, 1.2), 300, 112);
      const cols = 10, sz = PS * ts, gap = 20, gw = cols * sz + (cols - 1) * gap, x0 = (W - gw) / 2, y0 = GY;
      LIST.forEach((P_, i) => { const a = seg(t, 0.8 + i * 0.09, 1.1 + i * 0.09); if (a <= 0) return; const x = x0 + (i % cols) * (sz + gap), y = y0 + Math.floor(i / cols) * (sz + gap) + (1 - a) * 20;
        g.globalAlpha = a; g.save(); g.shadowColor = 'rgba(60,45,25,0.25)'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.drawImage(P_.thumb, x, y, sz, sz); g.restore(); g.globalAlpha = 1; });
    } else {
      // fly from the first thumbnail's place to the first panel
      const cols = 10, sz = PS * ts, gap = 20, gw = cols * sz + (cols - 1) * gap, tx = (W - gw) / 2 + sz / 2, ty = GY + sz / 2;
      const cx = lerp(tx, W / 2, ease(zoom)), cy = lerp(ty, YC, ease(zoom));
      title(1 - zoom * 2, 300, 112);
      LIST.forEach((P_, i) => { if (i === 0) return; const x = (W - gw) / 2 + (i % cols) * (sz + gap), y = GY + Math.floor(i / cols) * (sz + gap); g.globalAlpha = 1 - zoom; g.drawImage(P_.thumb, x, y, sz, sz); });
      g.globalAlpha = 1;
      g.save(); g.translate(cx, cy); g.scale(gridS, gridS); g.drawImage(zoom > 0.6 ? LIST[0].cache : LIST[0].thumb, -PS / 2, -PS / 2); g.restore();
      if (zoom > 0.6) { const dn0 = dancer(t); g.save(); g.translate(cx, cy); g.scale(gridS, gridS); g.translate(-PS / 2, -PS / 2); drawFigureIn(g, LIST[0], dn0.pose, PS / 2); bang(g, LIST[0], dn0.pose, PS / 2, dn0.shot); g.restore(); }
    }
    g.globalAlpha = 1 - seg(t, 0, 0.5); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    return;
  }
  const cam = camera(t), dn = dancer(t);
  if (dn.shot && dn.shot.d > 0) { const j = Math.exp(-dn.shot.d * 18) * 9; cam.x += Math.sin(t * 97) * j; g.translate(0, Math.cos(t * 83) * j * 0.6); }
  const outro = seg(t, TEND + 0.8, TEND + 3.0);
  drawGallery(t, cam, dn, { thumbs: (k) => (k === N - 1 ? 0 : outro) });
  if (t > TEND + 3.6) {
    const a = seg(t, TEND + 3.6, TEND + 4.8) * (1 - seg(t, DURATION - 1.0, DURATION - 0.2));
    title(a, 180, 92, 'the dance goes on', 'a cartoon tribute · twenty panels · one dancer');
  }
  const fade = seg(t, DURATION - 0.9, DURATION); if (fade > 0) { g.globalAlpha = fade; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}

window.DURATION = DURATION; window.FPS = FPS;
window.renderFrame = (i) => frame(i / FPS);
if (!new URLSearchParams(location.search).has('render')) { const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
window.ready = true;
