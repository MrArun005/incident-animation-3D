// "Erased": Clawd rewrites an encyclopedia page. A plain article (World War II) is wiped away with a
// giant eraser; every erased patch shows a live 8-bit battlefield underneath (tanks, planes, pixel
// soldiers). At the end Clawd hops onto a tank and rides off the bottom of the screen while the last
// heading, "See also", is blown into confetti. No narration: the picture and the sound carry it.
import { W, H, TAU, clamp, lerp, ease, lin, rng, FONT, SERIF } from './rich/core.js';
import { clawd } from './art.js';

const FPS = 30, DURATION = 30;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const mk = (w, h) => { const k = document.createElement('canvas'); k.width = w; k.height = h; return k; };
const CELL = 11;                                   // Clawd's pixel size on screen

// ---- timing ---------------------------------------------------------------------------------------
// Erase blocks: the rectangle wiped, and when. Stripes zig-zag, one eraser-height each.
const BLOCKS = [
  { x: 305, y: 250, w: 915, h: 140, ta: 5.4, tb: 7.8 },    // lead paragraph
  { x: 305, y: 392, w: 915, h: 160, ta: 7.8, tb: 9.6 },    // Background
  { x: 305, y: 553, w: 915, h: 160, ta: 9.6, tb: 11.4 },   // Course of the war
  { x: 305, y: 714, w: 915, h: 165, ta: 11.4, tb: 13.2 },  // Aftermath
  { x: 1225, y: 255, w: 395, h: 380, ta: 13.2, tb: 15.2 }, // infobox
  { x: 305, y: 952, w: 700, h: 110, ta: 15.2, tb: 16.3 },  // See-also list
  { x: 290, y: 84, w: 1000, h: 168, ta: 16.3, tb: 17.8 },  // title, tabs
];
BLOCKS.forEach((b) => { b.n = Math.ceil(b.h / 70); });
const DISSOLVE = [17.6, 20.2];                     // the page margins turn to pixels
const PATCH = { x: 296, y: 884, w: 352, h: 76 };   // the "See also" fragment that stays
const T_TANK_IN = 18.4, T_LAND = 20.6, T_GO = 21.0, T_OFF = 25.0, T_FIRE = 22.4, T_BOOM = 22.9;
const TANK0 = { x: 1100, y: 640 };
const END_CARD = [26.3, 29.4];

// ---- the article -----------------------------------------------------------------------------------
const PAGE = mk(W, H);
const LINK = '#0645ad', INK = '#202122', GREY = '#54595d', RULE = '#a2a9b1';
const PARA = {
  lead: 'World War II or the [[Second World War]] was a global conflict that lasted from 1939 to 1945. It involved the vast majority of the world’s countries, forming two opposing military alliances: the [[Allies]] and the [[Axis powers]].',
  bg: 'The causes of the war included the aftermath of the [[First World War]], economic depression, and the rise of aggressive nationalist regimes in Europe and Asia.',
  course: 'The war began in Europe in September 1939 with the [[invasion of Poland]] and spread across Europe, Africa, Asia and the Pacific, becoming the largest conflict in history.',
  after: 'The war ended in 1945. Its aftermath led to the founding of the [[United Nations]] and reshaped the political map of the world.',
};
function drawPara(p, text, x, y, maxW, lh) {
  p.font = `22px ${FONT}`;
  const words = text.split(/(\[\[.*?\]\])/).filter(Boolean).flatMap((s) => (s.startsWith('[[') ? s.slice(2, -2).split(' ').map((w) => [w, true]) : s.split(' ').filter(Boolean).map((w) => [w, false])));
  let cx = x, cy = y; const sp = p.measureText(' ').width;
  for (const [w, link] of words) {
    const wd = p.measureText(w).width;
    if (cx + wd > x + maxW) { cx = x; cy += lh; }
    p.fillStyle = link ? LINK : INK; p.fillText(w, cx, cy); cx += wd + sp;
  }
}
function buildPage() {
  const p = PAGE.getContext('2d');
  p.fillStyle = '#fff'; p.fillRect(0, 0, W, H);
  // Top bar.
  p.fillStyle = '#f8f9fa'; p.fillRect(0, 0, W, 72); p.fillStyle = RULE; p.fillRect(0, 72, W, 1);
  p.fillStyle = INK; for (let i = 0; i < 3; i++) p.fillRect(30, 26 + i * 9, 26, 3);
  p.font = `700 30px ${SERIF}`; p.fillText('Encyclopedia', 78, 47);
  p.strokeStyle = RULE; p.lineWidth = 2; p.fillStyle = '#fff'; p.beginPath(); p.roundRect(610, 16, 620, 42, 6); p.fill(); p.stroke();
  p.font = `20px ${FONT}`; p.fillStyle = '#72777d'; p.fillText('Search', 632, 44);
  p.fillStyle = LINK; p.fillText('Create account', 1560, 44); p.fillText('Log in', 1730, 44);
  // Sidebar.
  p.font = `19px ${FONT}`;
  ['Main page', 'Contents', 'Current events', 'Random article', 'About', 'Contact us'].forEach((s, i) => { p.fillStyle = LINK; p.fillText(s, 40, 130 + i * 34); });
  p.fillStyle = GREY; p.font = `700 17px ${FONT}`; p.fillText('CONTRIBUTE', 40, 370);
  p.font = `19px ${FONT}`; ['Help', 'Learn to edit', 'Recent changes'].forEach((s, i) => { p.fillStyle = LINK; p.fillText(s, 40, 404 + i * 34); });
  p.fillStyle = GREY; p.font = `700 17px ${FONT}`; p.fillText('TOOLS', 40, 550);
  p.font = `19px ${FONT}`; ['What links here', 'Upload file', 'Page information'].forEach((s, i) => { p.fillStyle = LINK; p.fillText(s, 40, 584 + i * 34); });
  p.fillStyle = RULE; p.fillRect(280, 73, 1, H);
  // Tabs.
  p.font = `18px ${FONT}`; p.fillStyle = INK; p.fillText('Article', 320, 112); p.fillStyle = LINK; p.fillText('Talk', 396, 112);
  p.fillStyle = INK; p.fillText('Read', 1330, 112); p.fillStyle = LINK; p.fillText('Edit', 1400, 112); p.fillText('View history', 1462, 112);
  p.fillStyle = RULE; p.fillRect(310, 122, 1310, 1);
  // Title.
  p.fillStyle = INK; p.font = `62px ${SERIF}`; p.fillText('World War II', 320, 196);
  p.fillStyle = RULE; p.fillRect(310, 210, 1310, 1);
  p.fillStyle = GREY; p.font = `italic 20px ${FONT}`; p.fillText('From the free encyclopedia', 320, 240);
  // Body.
  drawPara(p, PARA.lead, 320, 282, 890, 31);
  const h2 = (s, y) => { p.fillStyle = INK; p.font = `36px ${SERIF}`; p.fillText(s, 320, y); p.fillStyle = RULE; p.fillRect(310, y + 10, 900, 1); };
  h2('Background', 428); drawPara(p, PARA.bg, 320, 480, 890, 31);
  h2('Course of the war', 592); drawPara(p, PARA.course, 320, 644, 890, 31);
  h2('Aftermath', 758); drawPara(p, PARA.after, 320, 810, 890, 31);
  h2('See also', 930);
  p.font = `22px ${FONT}`; p.fillStyle = LINK; p.fillText('•  Cold War', 340, 990); p.fillText('•  United Nations', 340, 1024);
  // Infobox.
  p.fillStyle = '#f8f9fa'; p.fillRect(1240, 270, 360, 350); p.strokeStyle = RULE; p.lineWidth = 2; p.strokeRect(1240, 270, 360, 350);
  p.fillStyle = '#b0c4de'; p.fillRect(1240, 270, 360, 46); p.fillStyle = INK; p.font = `700 24px ${FONT}`; p.textAlign = 'center'; p.fillText('World War II', 1420, 302); p.textAlign = 'left';
  p.fillStyle = '#dfe6ee'; p.fillRect(1256, 332, 328, 150);
  p.fillStyle = '#c3cfdc'; [[1290, 380, 70, 40], [1400, 360, 90, 60], [1440, 430, 70, 34]].forEach(([x, y, w, h]) => p.fillRect(x, y, w, h));
  p.font = `700 18px ${FONT}`; p.fillStyle = INK; p.fillText('Date', 1256, 512); p.fillText('Result', 1256, 574);
  p.font = `18px ${FONT}`; p.fillText('1 Sep 1939 – 2 Sep 1945', 1340, 512); p.fillStyle = LINK; p.fillText('Allied victory', 1340, 574);
}

// ---- the 8-bit battlefield (drawn small, scaled 4x, nearest neighbour) -----------------------------------
const LW = 480, LH = 270, BF = mk(LW, LH), b = BF.getContext('2d');
const PAL = { 1: '#58b028', 2: '#24501c', 3: '#303030', 4: '#2c3c1c', 5: '#90e050' };
const pad = (rows, w) => rows.map((r) => r.padEnd(w, '.'));
const TANK = pad(['......2222222', '.....21111112444444', '.....21111112', '..2222222222222222', '.221111111111111122', '2115555555555555112', '3333333333333333333', '3.3.3.3.3.3.3.3.3.3', '.33333333333333333'], 20);
const TANK_B = TANK.map((r, i) => (i === 7 ? '.3.3.3.3.3.3.3.3.3.'.padEnd(20, '.') : r));
const PLANE = pad(['.1..............', '.11........2222', '11111111111111111', '.111111111111111133', '....2222222222', '.....22222'], 20);
const SOL_A = ['.hhh..', '.sss..', 'bbbbkk', 'bbbb..', '.bb...', '.l.l..'], SOL_B = ['.hhh..', '.sss..', 'bbbbkk', 'bbbb..', '.bb...', 'l...l.'];
function spr(ctx, rows, x, y, pal, flip = false) {
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) for (let cc = 0; cc < w; cc++) { const ch = rows[r][cc]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(Math.round(x + (flip ? w - 1 - cc : cc)), Math.round(y + r), 1, 1); }
}
const TEAM = { blue: '#3060e0', red: '#e04030' };
const solPal = (team) => ({ h: '#304020', s: '#f0c090', b: TEAM[team], k: '#222', l: '#333' });
const planePal = (team) => ({ 1: '#f0f0f0', 2: TEAM[team], 3: '#40a0ff' });
const tankPal = (team) => (team === 'blue' ? { 1: '#4a78d8', 2: '#1c2c58', 3: '#303030', 4: '#1c2444', 5: '#8ab0ff' } : { 1: '#d85040', 2: '#581c18', 3: '#303030', 4: '#441c18', 5: '#ff9a88' });
function drawBattle(t) {
  const bands = ['#2c6ce0', '#3c7cf0', '#5c94fc', '#7cacff', '#9cc4ff', '#b8d8ff', '#d0e8ff'], SK = 96, bh = SK / bands.length;
  b.fillStyle = bands[bands.length - 1]; b.fillRect(0, 0, LW, LH);
  bands.forEach((col, i) => { b.fillStyle = col; b.fillRect(0, Math.floor(i * bh), LW, Math.ceil(bh) + 1); });
  for (let i = 1; i < bands.length; i++) { const y = Math.floor(i * bh); b.fillStyle = bands[i]; for (let x = 0; x < LW; x += 2) { b.fillRect(x, y - 1, 1, 1); b.fillRect(x + 1, y - 2, 1, 1); } }
  b.fillStyle = '#fff6b0'; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) if (dx * dx + dy * dy <= 72) b.fillRect(404 + dx, 22 + dy, 1, 1);
  [0, 1, 2, 3].forEach((k) => { const x = ((k * 150 + t * 3) % 600) - 70, y = 8 + k * 14; b.fillStyle = '#fff'; b.fillRect(x, y, 34, 6); b.fillRect(x + 6, y - 4, 18, 4); b.fillStyle = '#dbe6ff'; b.fillRect(x + 2, y + 6, 30, 2); });
  for (let x = 0; x < LW; x++) { const y1 = 98 - Math.floor(22 + 14 * Math.sin(x * 0.021 + 1) + 8 * Math.sin(x * 0.057)); b.fillStyle = '#6478b0'; b.fillRect(x, y1, 1, 98 - y1); if (y1 < 70) { b.fillStyle = '#f4f8ff'; b.fillRect(x, y1, 1, 3); } }
  for (let x = 0; x < LW; x++) { const y2 = 108 - Math.floor(8 + 6 * Math.sin(x * 0.03 + 2)); b.fillStyle = '#3a8a48'; b.fillRect(x, y2, 1, 114 - y2); }
  b.fillStyle = '#38a838'; b.fillRect(0, 114, LW, LH - 114);
  for (let y = 114, i = 0; y < LH; y += 12, i++) { b.fillStyle = i % 2 ? '#309830' : '#40b040'; b.fillRect(0, y, LW, 6); }
  b.fillStyle = '#8a5a2a'; b.fillRect(0, 250, LW, 20); b.fillStyle = '#a06a34'; for (let x = 0; x < LW; x += 4) b.fillRect(x, 250 + (x % 8 ? 0 : 1), 2, 1);
  b.fillStyle = '#205020'; b.fillRect(0, 150, LW, 3); b.fillStyle = '#7a5028'; for (let x = 20; x < LW; x += 90) { b.fillRect(x, 146, 12, 5); b.fillRect(x + 2, 143, 8, 3); }
  const rr = rng(4); b.fillStyle = '#2c7a2c'; for (let i = 0; i < 9; i++) { const cx = 20 + rr() * 440, cy = 125 + rr() * 115, rad = 4 + rr() * 6; for (let dy = -3; dy <= 3; dy++) for (let dx = -rad; dx <= rad; dx++) if ((dx * dx) / (rad * rad) + (dy * dy) / 9 <= 1) b.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1); }
  // Ground units, back to front.
  const items = [];
  for (let i = 0; i < 14; i++) {
    const yb = 122 + ((i * 17) % 118), bx = 10 + ((i * 29 + t * 12) % 230), rx = 466 - ((i * 31 + t * 10) % 230), fr = Math.floor(t * 6 + i) % 2;
    items.push({ y: yb, d: () => { spr(b, fr ? SOL_A : SOL_B, bx, yb, solPal('blue')); if ((t * 3 + i * 0.37) % 1 < 0.08) { b.fillStyle = '#ffe860'; b.fillRect(Math.round(bx) + 6, yb + 2, 3, 2); } } });
    items.push({ y: yb + 4, d: () => { spr(b, fr ? SOL_B : SOL_A, rx, yb + 4, solPal('red'), true); if ((t * 3 + i * 0.53 + 0.4) % 1 < 0.08) { b.fillStyle = '#ffe860'; b.fillRect(Math.round(rx) - 3, yb + 6, 3, 2); } } });
  }
  [[150, 'blue', 0], [235, 'blue', 1], [128, 'red', 0], [190, 'red', 1]].forEach(([y, team, k]) => {
    const bl = team === 'blue', x = bl ? ((t * 8 + 60 + k * 200) % 560) - 40 : 520 - ((t * 7 + 80 + k * 210) % 580), fr = Math.floor(t * 8) % 2;
    items.push({ y, d: () => { spr(b, fr ? TANK : TANK_B, x, y - 9, tankPal(team), !bl); if ((t * 0.7 + k * 0.33) % 1 < 0.07) { b.fillStyle = '#fff2a0'; b.fillRect(Math.round(bl ? x + 19 : x - 4), y - 8, 5, 3); } } });
  });
  items.sort((a1, a2) => a1.y - a2.y).forEach((it) => it.d());
  // Planes with smoke trails.
  [[0, 'blue', 1], [1, 'red', -1], [2, 'blue', 1]].forEach(([k, team, dir]) => {
    const x = dir > 0 ? ((t * 38 + 190 * k) % 640) - 90 : 570 - ((t * 32 + 210 * k) % 660), y = 14 + 20 * k + Math.round(4 * Math.sin(t * 2 + k));
    for (let j = 1; j <= 7; j++) { b.fillStyle = `rgba(230,230,230,${0.7 - j * 0.09})`; b.fillRect(Math.round(x + (dir > 0 ? -j * 5 : 19 + j * 5)), y + 2 + (j % 2), 3 - (j > 4 ? 1 : 0), 3 - (j > 4 ? 1 : 0)); }
    spr(b, PLANE, x, y, planePal(team), dir < 0);
  });
  // Explosions: six slots, each a rising blocky fireball.
  for (let s = 0; s < 6; s++) {
    const per = 3.6, tt = t + s * 0.6, u = tt % per; if (u > 0.9) continue;
    const r = rng(Math.floor(tt / per) * 7 + s + 1), ex = 40 + r() * 400, ey = 122 + r() * 118, rad = 4 + u * 22, cols = ['#ffffff', '#ffe060', '#ff9a30', '#e04020', '#503028'];
    for (let ring = 0; ring < 4; ring++) { b.fillStyle = cols[Math.min(4, ring + Math.floor(u * 4))]; const rr2 = rad * (1 - ring * 0.22); for (let a = 0; a < 20; a++) { const an = a / 20 * TAU; b.fillRect(Math.round(ex + Math.cos(an) * rr2 * (0.5 + 0.5 * ring / 3)), Math.round(ey + Math.sin(an) * rr2 * 0.7), 3, 3); } }
    b.fillStyle = '#ffe060'; b.fillRect(Math.round(ex - rad * 0.3), Math.round(ey - rad * 0.2), Math.round(rad * 0.6), Math.round(rad * 0.4));
    b.fillStyle = '#3a3a3a'; for (let k = 0; k < 4; k++) b.fillRect(Math.round(ex - 6 + k * 4), Math.round(ey - rad * 0.8 - k * u * 4), 3, 3);
  }
}

// ---- erasing ----------------------------------------------------------------------------------------
const ERASER_W = 150, ERASER_H = 76;
function blockPos(bk, t) {
  const p = lin(t, bk.ta, bk.tb), n = bk.n, sh = bk.h / n, k = Math.min(n - 1, Math.floor(p * n)), q = clamp(p * n - k, 0, 1), even = k % 2 === 0;
  return { ex: even ? bk.x + q * bk.w : bk.x + bk.w - q * bk.w, ey: bk.y + (k + 0.5) * sh + Math.sin(t * 22) * 4, dir: even ? 1 : -1 };
}
function eraseRects(t) {
  const out = [];
  for (const bk of BLOCKS) {
    if (t < bk.ta) continue;
    const p = lin(t, bk.ta, bk.tb), sh = bk.h / bk.n;
    for (let k = 0; k < bk.n; k++) {
      const q = clamp(p * bk.n - k, 0, 1); if (q <= 0) continue;
      out.push(k % 2 === 0 ? [bk.x, bk.y + k * sh, q * bk.w, sh + 1] : [bk.x + bk.w - q * bk.w, bk.y + k * sh, q * bk.w, sh + 1]);
    }
  }
  return out;
}
const WK = mk(W, H), wk = WK.getContext('2d');
function drawPage(t) {
  wk.globalCompositeOperation = 'source-over'; wk.clearRect(0, 0, W, H); wk.drawImage(PAGE, 0, 0);
  wk.globalCompositeOperation = 'destination-out'; wk.fillStyle = '#000'; wk.beginPath();
  eraseRects(t).forEach(([x, y, w, h]) => wk.rect(x, y, w, h));
  const dp = lin(t, DISSOLVE[0], DISSOLVE[1]);
  if (dp > 0) {
    const CS = 30, r = rng(9);
    for (let cy = 0; cy < H / CS; cy++) for (let cx = 0; cx < W / CS; cx++) { const thr = (cx / (W / CS)) * 0.75 + r() * 0.25; if (dp > thr) wk.rect(cx * CS, cy * CS, CS, CS); }
  }
  wk.fill(); wk.globalCompositeOperation = 'source-over';
  if (t < T_BOOM) { wk.drawImage(PAGE, PATCH.x, PATCH.y, PATCH.w, PATCH.h, PATCH.x, PATCH.y, PATCH.w, PATCH.h); }
  g.drawImage(WK, 0, 0);
  if (t < T_BOOM && dp > 0.15) { g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(PATCH.x, PATCH.y, PATCH.w, PATCH.h); }
}
function crumbs(t) {
  for (const bk of BLOCKS) {
    if (t < bk.ta || t > bk.tb + 1.1) continue;
    const r = rng(Math.round(bk.x * 3 + bk.y));
    for (let i = 0; i < 46; i++) {
      const ts = bk.ta + r() * (bk.tb - bk.ta), vx = (r() - 0.5) * 420, vy = -140 - r() * 320, sz = 5 + r() * 8, col = ['#f2f2f2', '#d8d8d8', '#b0b0b0', '#555'][Math.floor(r() * 4)], age = t - ts;
      if (age < 0 || age > 0.9) continue;
      const p0 = blockPos(bk, ts);
      g.globalAlpha = 1 - age / 0.9; g.fillStyle = col; g.fillRect(Math.round(p0.ex + vx * age), Math.round(p0.ey + vy * age + 1300 * age * age), Math.round(sz), Math.round(sz));
    }
  }
  g.globalAlpha = 1;
}

// ---- Clawd and the eraser -------------------------------------------------------------------------------------
function eraserDraw(cx, cy, dir, ang, s, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.translate(cx, cy); g.scale(dir * s, s); g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-ERASER_W / 2 + 6, -ERASER_H / 2 + 8, ERASER_W, ERASER_H);
  g.fillStyle = '#f4a3b5'; g.fillRect(-ERASER_W / 2, -ERASER_H / 2, ERASER_W, ERASER_H);
  g.fillStyle = '#e98aa0'; g.fillRect(-ERASER_W / 2, ERASER_H / 2 - 12, ERASER_W, 12);
  g.fillStyle = '#2f62c8'; g.fillRect(-ERASER_W / 2, -ERASER_H / 2 - 3, 78, ERASER_H + 6);
  g.fillStyle = '#fff'; g.fillRect(-ERASER_W / 2 + 10, -ERASER_H / 2 - 3, 10, ERASER_H + 6); g.fillRect(-ERASER_W / 2 + 26, -ERASER_H / 2 - 3, 5, ERASER_H + 6);
  g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(-ERASER_W / 2, -ERASER_H / 2 - 3, ERASER_W, ERASER_H + 6);
  g.restore();
}
const nubY = (feet) => feet - 6.6 * CELL;
function clawdAt(ox, feet, dir, t, hop = 0, o = {}) { clawd(g, ox, feet, CELL, t, { hop, dir, talking: !!o.talking, wave: !!o.wave }); }
function eraseHero(t) {
  let bi = 0; BLOCKS.forEach((bk, i) => { if (t >= bk.ta) bi = i; });
  const bk = BLOCKS[bi], cur = blockPos(bk, t); let ex = cur.ex, ey = cur.ey;
  const prev = bi > 0 ? blockPos(BLOCKS[bi - 1], BLOCKS[bi - 1].tb) : { ex: BLOCKS[0].x, ey: BLOCKS[0].y + BLOCKS[0].h / BLOCKS[0].n / 2, dir: 1 };
  const w = 1 - ease(clamp((t - bk.ta) / 0.5, 0, 1)); ex = lerp(cur.ex, prev.ex, w); ey = lerp(cur.ey, prev.ey, w);
  const dir = w > 0.5 ? prev.dir : cur.dir;
  const cxE = dir > 0 ? ex - ERASER_W / 2 : ex + ERASER_W / 2, ox = dir > 0 ? ex - ERASER_W - 11 * CELL + 14 : ex + ERASER_W - 14;
  return { ox, feet: ey + 6.6 * CELL, dir, cxE, ey, bob: Math.abs(Math.sin(t * 22)) * 4 };
}
const START_X = BLOCKS[0].x - ERASER_W - 11 * CELL + 14, START_FEET = BLOCKS[0].y + BLOCKS[0].h / BLOCKS[0].n / 2 + 6.6 * CELL;
function tankPose(t) {
  if (t < T_TANK_IN) return null;
  if (t < T_GO) { const k = ease(lin(t, T_TANK_IN, T_LAND - 0.2)); return { x: lerp(2200, TANK0.x, k), y: TANK0.y + (t > T_LAND ? Math.sin(t * 60) * 3 : 0), s: 1, drive: k < 1 }; }
  if (t > T_OFF + 0.4) return null;
  const k = lin(t, T_GO, T_OFF);
  return { x: lerp(TANK0.x, 540, k), y: lerp(TANK0.y, 1400, k ** 1.7), s: lerp(1, 1.45, k), drive: true };
}
function heroTank(tp, t) {
  const u = 10 * tp.s, rows = Math.floor(t * 12) % 2 ? TANK : TANK_B, pal = { 1: '#f0a030', 2: '#5a3410', 3: '#303030', 4: '#3c2410', 5: '#ffe070' }, left = tp.x - 100 * tp.s, top = tp.y - 90 * tp.s;
  g.save(); g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(tp.x, tp.y + 6, 110 * tp.s, 10 * tp.s, 0, 0, TAU); g.fill(); g.restore();
  for (let r = 0; r < rows.length; r++) for (let cc = 0; cc < 20; cc++) { const ch = rows[r][cc]; if (ch === '.') continue; g.fillStyle = pal[ch]; g.fillRect(Math.round(left + (19 - cc) * u), Math.round(top + r * u), Math.ceil(u), Math.ceil(u)); }
  g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(left + 2 * u, top + 3 * u, 16 * u, 6 * u);
  return { turretX: left + 10.5 * u, turretTop: top, muzzle: [left + 1 * u, top + 1.5 * u] };
}
function hero(t) {
  if (t < 2.0 || t > T_OFF + 0.4) return null;
  const ex = START_X, sf = START_FEET;
  if (t < 4.0) { const k = lin(t, 2.0, 4.0); return { ox: lerp(-200, ex, k), feet: sf, dir: 1, hop: Math.abs(Math.sin(t * 10)) * 14, eraser: null }; }
  if (t < BLOCKS[0].ta) { const e = ease(lin(t, 4.0, 5.2)); return { ox: ex, feet: sf, dir: 1, hop: 0, wave: false, eraser: { cx: lerp(ex + 5.5 * CELL, ex + 11 * CELL + ERASER_W / 2 - 14, e), cy: nubY(sf) - (1 - e) * 20, dir: 1, ang: lerp(-0.9, 0, e), s: lerp(0.3, 1, e), a: 1 } }; }
  if (t < BLOCKS[6].tb) { const h = eraseHero(t); return { ox: h.ox, feet: h.feet, dir: h.dir, hop: h.bob, talking: true, eraser: { cx: h.cxE, cy: h.ey, dir: h.dir, ang: Math.sin(t * 22) * 0.04, s: 1, a: 1 } }; }
  const last = eraseHero(BLOCKS[6].tb), tt = t - BLOCKS[6].tb;
  const tp = tankPose(Math.min(t, T_LAND));
  const tx = (tp ? tp.x : TANK0.x) + 5 - 5.5 * CELL, tf = (tp ? tp.y : TANK0.y) - 90;
  if (t < T_LAND) {
    const k = ease(lin(t, BLOCKS[6].tb, T_LAND)), hop = Math.abs(Math.sin(k * Math.PI * 3)) * 140 * (1 - k * 0.4);
    const er = tt < 0.7 ? { cx: last.cxE + tt * 500, cy: last.ey - tt * 700 + tt * tt * 900, dir: 1, ang: tt * 14, s: 1, a: 1 - tt / 0.7 } : null;
    return { ox: lerp(last.ox, tx, k), feet: lerp(last.feet, tf, k), dir: t > T_LAND - 0.5 ? -1 : 1, hop, eraser: er };
  }
  const tpp = tankPose(t); if (!tpp) return null;
  return { ox: tpp.x + (5 - 5.5 * CELL) * tpp.s, feet: tpp.y - 90 * tpp.s, dir: -1, hop: 0, cellScale: tpp.s, wave: t > T_OFF - 1.0, eraser: null };
}

// ---- confetti, blast, shell ----------------------------------------------------------------------------
const CONF = ['#ff3b5c', '#ffcf33', '#33d17a', '#3aa0ff', '#b061ff', '#ff8a33', '#ffffff'];
function blast(t) {
  const u = t - T_BOOM, cx = PATCH.x + PATCH.w / 2, cy = PATCH.y + PATCH.h / 2;
  if (u < 0) return;
  if (u < 0.7) {
    const r = rng(77);
    for (let i = 0; i < 80; i++) { const a = r() * TAU, d = u * (200 + r() * 520), sz = Math.max(4, (1 - u / 0.7) * (26 + r() * 20)), col = ['#ffffff', '#ffe060', '#ff9a30', '#e04020'][Math.floor(r() * 4)]; g.fillStyle = col; g.fillRect(Math.round(cx + Math.cos(a) * d - sz / 2), Math.round(cy + Math.sin(a) * d - sz / 2), Math.round(sz), Math.round(sz)); }
  }
  const r = rng(5);
  for (let i = 0; i < 300; i++) {
    const a = r() * TAU, spd = 200 + r() * 1200, vx = Math.cos(a) * spd, vy = Math.sin(a) * spd * 0.9 - 420, w = 8 + r() * 14, h2 = 5 + r() * 9, rot0 = r() * TAU, rv = (r() - 0.5) * 16, col = CONF[Math.floor(r() * CONF.length)], fl = r() * TAU;
    const dr = 2.4, x = cx + vx * (1 - Math.exp(-dr * u)) / dr + Math.sin(u * 3 + fl) * 24 * Math.min(1, u), y = cy + vy * (1 - Math.exp(-dr * u)) / dr + 0.5 * 700 * u * u * 0.6;
    if (y > H + 40 || x < -40 || x > W + 40) continue;
    g.save(); g.translate(x, y); g.rotate(rot0 + rv * u); g.scale(1, Math.cos(u * 7 + fl)); g.fillStyle = col; g.fillRect(-w / 2, -h2 / 2, w, h2); g.restore();
  }
  if (u < 0.15) { g.fillStyle = `rgba(255,255,255,${0.9 * (1 - u / 0.15)})`; g.fillRect(0, 0, W, H); }
}
function shell(t, muzzle) {
  const u = lin(t, T_FIRE, T_BOOM); if (u <= 0 || u >= 1) return;
  const tx = PATCH.x + PATCH.w / 2, ty = PATCH.y + PATCH.h / 2;
  for (let j = 6; j >= 0; j--) { const uu = clamp(u - j * 0.03, 0, 1), x = lerp(muzzle[0], tx, uu), y = lerp(muzzle[1], ty, uu); g.fillStyle = j === 0 ? '#fff6a0' : `rgba(255,${180 - j * 20},60,${1 - j * 0.14})`; const sz = j === 0 ? 20 : 16 - j; g.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz); }
}
function exhaust(tp, t) {
  for (let j = 0; j < 9; j++) { const age = ((t * 2.4 + j * 0.11) % 1), x = tp.x + 100 * tp.s + age * 90, y = tp.y - 70 * tp.s - age * 90, sz = (10 + age * 26) * tp.s; g.fillStyle = `rgba(70,70,70,${0.55 * (1 - age)})`; g.fillRect(Math.round(x), Math.round(y), Math.round(sz), Math.round(sz)); }
}

// ---- frame ----------------------------------------------------------------------------------------------------
function frame(t) {
  g.save();
  if (t > T_BOOM && t < T_BOOM + 0.45) { const a = 14 * (1 - (t - T_BOOM) / 0.45); g.translate((Math.random() - 0.5) * a * 0 + Math.sin(t * 120) * a, Math.cos(t * 97) * a); }
  drawBattle(t); g.imageSmoothingEnabled = false; g.drawImage(BF, 0, 0, W, H);
  g.globalAlpha = clamp(t / 0.5, 0, 1); drawPage(t); g.globalAlpha = 1;
  if (t < 0.9) { g.fillStyle = '#3366cc'; g.fillRect(0, 73, W * ease(t / 0.8), 3); }
  crumbs(t);
  const tp = tankPose(t); let tk = null;
  if (tp) { if (tp.drive && t > T_LAND) exhaust(tp, t); tk = heroTank(tp, t); }
  const h = hero(t);
  if (h) {
    if (h.eraser && h.eraser.a > 0) eraserDraw(h.eraser.cx, h.eraser.cy, h.eraser.dir, h.eraser.ang, h.eraser.s, h.eraser.a);
    const cs = h.cellScale || 1;
    if (cs !== 1) { g.save(); const pivX = h.ox + 5.5 * CELL, pivY = h.feet; g.translate(pivX, pivY); g.scale(cs, cs); g.translate(-pivX, -pivY); clawdAt(h.ox, h.feet, h.dir, t, h.hop, h); g.restore(); } else clawdAt(h.ox, h.feet, h.dir, t, h.hop, h);
  }
  if (tk && t >= T_FIRE - 0.15 && t < T_BOOM) { const k = (t - T_FIRE) / 0.5; if (k > 0 && k < 0.2) { g.fillStyle = '#fff6a0'; g.fillRect(tk.muzzle[0] - 30, tk.muzzle[1] - 12, 40, 24); } }
  if (tk) shell(t, tk.muzzle);
  blast(t);
  g.restore();
  if (t > END_CARD[0]) {
    const a = ease(lin(t, END_CARD[0], END_CARD[0] + 0.8)) * (1 - ease(lin(t, END_CARD[1], END_CARD[1] + 0.5)));
    g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.font = `700 54px "Liberation Mono", monospace`; g.lineWidth = 12; g.strokeStyle = '#111'; g.lineJoin = 'round';
    g.strokeText('History isn’t for erasing.', W / 2, H - 150); g.fillStyle = '#fff'; g.fillText('History isn’t for erasing.', W / 2, H - 150);
    g.font = `700 36px "Liberation Mono", monospace`; g.strokeText('Go read it.', W / 2, H - 92); g.fillStyle = '#ffd34d'; g.fillText('Go read it.', W / 2, H - 92); g.restore();
  }
  const f = Math.max(clamp(1 - t / 0.4, 0, 1), clamp((t - (DURATION - 0.8)) / 0.8, 0, 1));
  if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
}
buildPage();
window.DURATION = DURATION;
window.FPS = FPS;
window.renderFrame = (i) => frame(i / FPS);
window.ready = true;
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now();
  const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
}
void SERIF;
