// Trailer for "Clawd vs The Bugs": motion graphics built around real gameplay. The footage is the
// actual game, played by a seeded bot (tools/capture-game.mjs) and stepped frame by frame, so the
// HUD graphics here are driven by the game's own numbers (score, bugs on screen, combo, boss health,
// power-up timers). Cut on the beat of a 128 BPM track (tools/audio-gametrailer.mjs).
import { W, H, TAU, clamp, lerp, ease, lin, rng } from './rich/core.js';

const FPS = 30, DURATION = 45, BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const INK = '#0f0d16', PANEL = '#1a1626', LINE = '#3a3252', ORANGE = '#cc7f61', ORANGE_HI = '#e8a688', CREAM = '#f3ecdf', DIM = '#9086a6', BOLT = '#ffe08a', TEAL = '#4fd1c5', VIOLET = '#a78bfa', PINK = '#f472b6', RED = '#f87171', BLUE = '#7cd0ff', HOT = '#ff5c7a';
const SANS = '"Liberation Sans", Arial, sans-serif', MONO = '"Liberation Mono", "DejaVu Sans Mono", monospace';

// Scene boundaries fall on bar lines.
const SC = { hook: 0, title: BAR * 2, play: BAR * 4, power: BAR * 8, boss: BAR * 12, rush: BAR * 17, cta: BAR * 20 };

// ---- recorded gameplay ----------------------------------------------------------------------------------
const G = {};
await Promise.all(['waves', 'power', 'boss', 'rush', 'mid'].map(async (n) => {
  const clip = await (await fetch(`assets/gameplay/${n}/clip.json`)).json();
  const imgs = await Promise.all(Array.from({ length: clip.frames }, (_, i) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = `assets/gameplay/${n}/${String(i).padStart(4, '0')}.png`; })));
  G[n] = { meta: clip.meta, imgs, events: clip.events, frames: clip.frames };
}));
// The frame in which SEGFAULT dies, so the boss scene can time-warp to land it on a beat.
let bossDeath = G.boss.frames - 1; for (let i = 1; i < G.boss.meta.length; i++) if (G.boss.meta[i - 1].boss && !G.boss.meta[i].boss) { bossDeath = i; break; }
const BOSS_HIT = SC.boss + 6.6 * BEAT;                 // the moment (seconds) the boss dies on screen
const BOSS_RATE = clamp(bossDeath / 30 / (BOSS_HIT - (SC.boss + 0.4)), 0.7, 2.6);
const frameAt = (clip, sec) => { const k = G[clip], i = clamp(Math.floor(sec * 30), 0, k.frames - 1); return { img: k.imgs[i], m: k.meta[i], i }; };

// ---- helpers -----------------------------------------------------------------------------------------------
const pr = (t, a, d) => clamp((t - a) / d, 0, 1);
const EXPO = (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * clamp(k, 0, 1)));
const BACK = (k) => { k = clamp(k, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const OUTQ = (k) => 1 - (1 - clamp(k, 0, 1)) ** 4;
function txt(s, x, y, o = {}) {
  const { size = 48, col = CREAM, w = 800, font = SANS, al = 'left', a = 1, track = 0 } = o;
  g.save(); g.globalAlpha *= a; g.font = `${w} ${size}px ${font}`; g.textAlign = al; g.textBaseline = 'alphabetic'; g.letterSpacing = track + 'px'; g.fillStyle = col; g.fillText(s, x, y); g.restore();
}
function outline(s, x, y, o = {}) {
  const { size = 200, col = CREAM, w = 800, al = 'left', a = 1, lw = 3 } = o;
  g.save(); g.globalAlpha *= a; g.font = `${w} ${size}px ${SANS}`; g.textAlign = al; g.lineWidth = lw; g.strokeStyle = col; g.lineJoin = 'round'; g.strokeText(s, x, y); g.restore();
}
// Text that slides up out of a mask line.
function rise(s, x, y, t, t0, o = {}) {
  const size = o.size || 48, k = EXPO(pr(t, t0, o.dur || 0.55)); if (k <= 0) return;
  g.save(); g.beginPath(); g.rect(0, y - size * 1.02, W, size * 1.32); g.clip(); txt(s, x, y + (1 - k) * size * 1.2, o); g.restore();
}
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function tag(s, x, y, o = {}) { txt(s, x, y, { font: MONO, size: 22, w: 700, col: o.col || DIM, track: 3, al: o.al || 'left', a: o.a ?? 1 }); }

// Pixel art copied from the game.
const CPAL = { o: ORANGE, h: ORANGE_HI, e: '#1a0f0a' };
const CLAWD = ['.hhhhhhhhh.', '.ooooooooo.', '.ooooooooo.', 'ooeoooooeoo', 'ooeoooooeoo', '.ooooooooo.', '.ooooooooo.', '.ooooooooo.', '.o.o...o.o.', '.o.o...o.o.', '.o.o...o.o.'];
const GNAT = { pal: { a: TEAL, b: '#fff' }, rows: ['..a...a..', '...a.a...', '..aaaaa..', '.aabaabaa', 'aaaaaaaaa', '.a.aaa.a.', 'a...a...a'] };
const BEETLE = { pal: { d: VIOLET, c: '#ddd3ff', b: '#fff' }, rows: ['..c.....c..', '...c...c...', '..ddddddd..', '.ddddddddd.', 'ddbdddddbdd', 'ddddcccdddd', '.ddddddddd.', '..d.d.d.d..', '.d.......d.'] };
const SPIDER = { pal: { p: PINK, b: '#fff' }, rows: ['..p.....p..', '...p...p...', 'p...ppp...p', '.p.ppppp.p.', '..ppbpbpp..', '.p.ppppp.p.', 'p...ppp...p', 'p.........p'] };
function rows(rs, pal, x, y, s, a = 1) { g.save(); g.globalAlpha *= a; rs.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; g.fillStyle = pal[ch]; g.fillRect(Math.round(x + i * s), Math.round(y + j * s), Math.ceil(s), Math.ceil(s)); })); g.restore(); }
const BUGS = [GNAT, BEETLE, SPIDER];

// Backdrop: ink, a breathing dot grid and two slow glows.
function backdrop(t, tint = 0) {
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  for (const [x, y, r, col, sp] of [[300, 260, 620, 'rgba(204,127,97,0.13)', 0.13], [1650, 820, 720, 'rgba(120,96,220,0.13)', 0.09]]) {
    const cx = x + Math.sin(t * sp * 2) * 120, cy = y + Math.cos(t * sp * 2.3) * 90, gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const beat = Math.exp(-(t % BEAT) * 7);
  for (let gy = 30; gy < H; gy += 60) for (let gx = 30; gx < W; gx += 60) { const d = Math.hypot(gx - W / 2, gy - H / 2) / 1100, a = 0.07 + 0.07 * Math.max(0, Math.sin(t * 1.6 - d * 7)) + 0.09 * beat * (1 - d); g.fillStyle = `rgba(243,236,223,${a})`; g.fillRect(gx - 1.5, gy - 1.5, 3, 3); }
  if (tint) { g.fillStyle = `rgba(248,113,113,${tint})`; g.fillRect(0, 0, W, H); }
}
// A sweep of colour to cover a cut. `mid` is the moment the scenes swap.
function wipe(t, mid, d = 0.42, col = ORANGE) {
  const a = ease(pr(t, mid - d, d)), b = ease(pr(t, mid, d)); if (a <= 0 || b >= 1) return;
  g.save(); g.fillStyle = col;
  if (t < mid) g.fillRect(0, 0, W * a, H); else g.fillRect(W * b, 0, W * (1 - b), H);
  g.fillStyle = 'rgba(15,13,22,0.35)'; const ex = t < mid ? W * a : W * b; g.fillRect(ex - 14, 0, 14, H); g.restore();
}
// A gameplay frame in a framed panel. Returns the frame (image + the game's own numbers).
function panel(clip, sec, cx, cy, s, o = {}) {
  const f = frameAt(clip, sec), w = 240 * s, h = 360 * s;
  g.save(); g.translate(cx, cy); g.rotate(o.rot || 0); g.globalAlpha *= o.a ?? 1;
  if (o.glow !== false) { const gr = g.createRadialGradient(0, 0, h * 0.15, 0, 0, h * 0.8); gr.addColorStop(0, `rgba(204,127,97,${o.glowA ?? 0.3})`); gr.addColorStop(1, 'rgba(204,127,97,0)'); g.fillStyle = gr; g.fillRect(-h, -h, h * 2, h * 2); }
  g.fillStyle = '#000'; g.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
  g.imageSmoothingEnabled = false; g.drawImage(f.img, -w / 2, -h / 2, w, h);
  g.strokeStyle = o.border || ORANGE; g.lineWidth = 4; g.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
  g.restore(); return f;
}
const shakeAt = (t, list) => { let s = 0; for (const [t0, amp] of list) if (t >= t0 && t < t0 + 0.5) s += amp * (1 - (t - t0) / 0.5); return s; };
const digits = (n, len = 6) => String(Math.round(n)).padStart(len, '0');

// ---- scene 1: the hook -----------------------------------------------------------------------------------------
const SWARM = (() => { const r = rng(4); return Array.from({ length: 80 }, () => ({ k: Math.floor(r() * 3), x: r() * W, s: 3 + r() * 5, sp: 90 + r() * 240, ph: r() * 6, t0: 0.3 + r() * 2.9 })); })();
function sHook(t) {
  backdrop(t, 0.05 * pr(t, 2.4, 1.2));
  for (const b of SWARM) { const u = t - b.t0; if (u < 0) continue; const y = -60 + u * b.sp, d = BUGS[b.k]; if (y > H + 60) continue; rows(d.rows, d.pal, b.x + Math.sin(u * 2 + b.ph) * 40, y, b.s, 0.55); }
  const flick = t > 2.9 && Math.sin(t * 90) > 0.2 ? 0 : 1;
  rise('EVERY CODEBASE', W / 2, 500, t, 0.35, { size: 132, al: 'center', w: 800, track: 4 });
  rise('HAS', W / 2 - 430, 760, t, 1.0, { size: 230, al: 'center', w: 800 });
  rise('BUGS.', W / 2 + 250, 760, t, 1.15, { size: 230, al: 'center', w: 800, col: ORANGE, a: flick });
  tag('SOMEONE HAS TO DEAL WITH THEM', W / 2, 850, { al: 'center', a: pr(t, 2.0, 0.5) });
  if (t > 3.3) { // datamosh: horizontal slices slide sideways
    const r = rng(Math.floor(t * 30)), n = 9; for (let i = 0; i < n; i++) { const y = r() * H, h = 20 + r() * 90, off = (r() - 0.5) * 260 * pr(t, 3.3, 0.45); g.drawImage(c, 0, y, W, h, off, y, W, h); }
  }
}

// ---- scene 2: title -------------------------------------------------------------------------------------------------
const CLAWD_PX = (() => { const r = rng(9), out = []; CLAWD.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') out.push({ i, j, ch, d: r() * 0.6, sx: (r() < 0.5 ? -1 : 1) * (W * 0.6 + r() * 500), sy: (r() - 0.5) * H * 1.6 }); })); return out; })();
function sTitle(t) {
  const u = t - SC.title;
  backdrop(t);
  const S = 17, x0 = W / 2 - 11 * S / 2, y0 = 130;
  for (const p of CLAWD_PX) { const k = EXPO(pr(u, 0.05 + p.d, 0.7)); g.fillStyle = CPAL[p.ch]; g.fillRect(Math.round(lerp(x0 + p.sx, x0 + p.i * S, k)), Math.round(lerp(y0 + p.sy, y0 + p.j * S, k)), S + 1, S + 1); }
  // Clawd fires; the bolt leaves the top of the frame.
  const fire = SC.title + BEAT * 3.0;
  const bk = pr(t, fire, 0.4);
  if (bk > 0 && bk < 1) { g.fillStyle = BOLT; g.fillRect(W / 2 - 6, y0 - bk * (y0 + 200), 12, 44); g.fillStyle = 'rgba(255,224,138,0.25)'; g.fillRect(W / 2 - 12, y0 - bk * (y0 + 200) + 30, 24, 400 * bk); }
  const hit = fire + 0.25, tk = BACK(pr(t, hit, 0.5));
  if (t > hit) {
    const dy = (1 - tk) * -560;
    txt('CLAWD', W / 2, 660 + dy, { size: 300, al: 'center', col: ORANGE, w: 800, track: 6 });
    const rk = pr(t, hit + 0.08, 0.6); if (rk < 1) { g.save(); g.strokeStyle = `rgba(243,236,223,${0.7 * (1 - rk)})`; g.lineWidth = 8 * (1 - rk) + 1; g.beginPath(); g.ellipse(W / 2, 560, 200 + rk * 1100, 60 + rk * 300, 0, 0, TAU); g.stroke(); g.restore(); }
  }
  rise('vs THE BUGS', W / 2, 800, t, hit + 0.45, { size: 116, al: 'center', col: CREAM, w: 800, track: 10 });
  tag('A PIXEL ARCADE SHOOTER  ·  PLAYS IN YOUR BROWSER', W / 2, 890, { al: 'center', a: EXPO(pr(t, hit + 1.0, 0.5)) });
  // Little bugs peek in from the sides and get shot.
  for (let i = 0; i < 3; i++) { const b0 = hit + 0.9 + i * 0.35, k = pr(t, b0, 0.35), d = BUGS[i]; if (k > 0 && k < 1) rows(d.rows, d.pal, lerp(i % 2 ? W + 40 : -140, i % 2 ? W - 240 : 120, EXPO(k)), 210 + i * 120, 8, 1 - Math.max(0, k - 0.8) * 5); }
}

// ---- scene 3: gameplay, with live HUD graphics --------------------------------------------------------------
function hudRight(f, u, x0) {
  const m = f.m, k = OUTQ(pr(u, 0.5, 0.6)); g.save(); g.globalAlpha *= k; g.translate((1 - k) * 60, 0);
  tag('SCORE', x0, 260); txt(digits(m.score), x0, 380, { font: MONO, size: 132, w: 700, col: CREAM });
  // bugs on screen: ring
  tag('BUGS ON SCREEN', x0, 500); const cx = x0 + 78, cy = 610, fill = clamp(m.nEn / 12, 0, 1);
  g.lineWidth = 16; g.strokeStyle = LINE; g.beginPath(); g.arc(cx, cy, 64, 0, TAU); g.stroke();
  g.strokeStyle = TEAL; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, 64, -Math.PI / 2, -Math.PI / 2 + TAU * fill); g.stroke();
  txt(String(m.nEn), cx, cy + 22, { size: 60, font: MONO, w: 700, al: 'center' });
  txt('WAVE ' + m.wave, x0 + 190, 604, { size: 54, w: 800 }); tag('LIVES', x0 + 190, 650);
  for (let i = 0; i < 3; i++) rows(CLAWD, CPAL, x0 + 190 + i * 62, 664, 4, i < m.lives ? 1 : 0.18);
  tag('COMBO', x0, 790); for (let i = 0; i < 4; i++) { const on = i < m.mult; rrect(x0 + i * 86, 812, 74, 20, 4); g.fillStyle = on ? BOLT : LINE; g.fill(); }
  txt('x' + m.mult, x0 + 4 * 86 + 10, 832, { size: 44, font: MONO, w: 700, col: m.mult > 1 ? BOLT : DIM });
  g.restore();
}
function sPlay(t) {
  const u = t - SC.play; backdrop(t);
  const pk = OUTQ(pr(u, 0.15, 0.7)), f = panel('mid', 0.5 + u, W / 2, H / 2 + (1 - pk) * 60, 2, { a: pk });
  hudRight(f, u, 1290);
  // left: kinetic verbs
  rise('SQUASH', 110, 360, t, SC.play + 0.5, { size: 132, col: CREAM });
  rise('DODGE', 110, 500, t, SC.play + BEAT * 2 + 0.05, { size: 132, col: CREAM });
  rise('REPEAT.', 110, 640, t, SC.play + BEAT * 3 + 0.05, { size: 132, col: ORANGE });
  // bug roster card
  const ck = BACK(pr(u, BEAT * 5, 0.5)); if (ck > 0) {
    g.save(); g.translate(-(1 - ck) * 500, 0); rrect(110, 720, 560, 200, 10); g.fillStyle = PANEL; g.fill(); g.strokeStyle = LINE; g.lineWidth = 3; g.stroke();
    BUGS.forEach((d, i) => { const bx = 150 + i * 176; rows(d.rows, d.pal, bx, 748 + (i === 0 ? 12 : 0), 6); tag(['GNAT', 'BEETLE', 'SPIDER'][i], bx, 840); txt(['1 HP', '2 HP', '3 HP'][i], bx, 872, { size: 26, w: 700, col: CREAM }); if (i === 2) tag('SHOOTS BACK', bx, 902, { col: HOT }); });
    g.restore();
  }
  // Clawd tracker
  const px = W / 2 - 240 + f.m.px * 2, py = H / 2 - 360 + 330 * 2, tk = pr(u, 1.0, 0.4);
  if (tk > 0) { g.save(); g.globalAlpha *= tk; g.strokeStyle = ORANGE; g.lineWidth = 4; const s = 34; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(px + dx * s, py + dy * (s - 14)); g.lineTo(px + dx * s, py + dy * s); g.lineTo(px + dx * (s - 14), py + dy * s); g.stroke(); } tag('CLAWD', px, py - 46, { al: 'center', col: ORANGE_HI }); g.restore(); }
}

// ---- scene 4: power-ups --------------------------------------------------------------------------------------------------
const POWERS = [
  { k: 'S', name: 'SPREAD SHOT', line: 'Three bolts in a fan', col: BOLT },
  { k: 'R', name: 'RAPID FIRE', line: 'Twice the trigger speed', col: '#ff9a5c' },
  { k: 'H', name: 'SHIELD', line: 'Absorbs one hit', col: BLUE },
  { k: 'B', name: 'BOMB', line: 'Wipes the screen', col: PINK },
];
function powerIcon(kind, cx, cy, t, col) {
  g.save(); g.translate(cx, cy);
  if (kind === 'S') { for (const a of [-0.5, 0, 0.5]) { const ph = (t * 1.8) % 1; g.save(); g.rotate(a); g.fillStyle = col; g.fillRect(-4, -20 - ph * 60, 8, 28); g.restore(); } rows(CLAWD, CPAL, -22, 20, 4); }
  if (kind === 'R') { for (let i = 0; i < 5; i++) { const ph = ((t * 3 + i * 0.2) % 1); g.fillStyle = col; g.globalAlpha = 1 - ph; g.fillRect(-4, 20 - ph * 110, 8, 22); } g.globalAlpha = 1; rows(CLAWD, CPAL, -22, 30, 4); }
  if (kind === 'H') { rows(CLAWD, CPAL, -22, -14, 4); const pl = 1 + 0.06 * Math.sin(t * 6); g.strokeStyle = col; g.lineWidth = 5; g.strokeRect(-40 * pl, -34 * pl, 80 * pl, 80 * pl); }
  if (kind === 'B') { const ph = (t * 0.9) % 1; for (let i = 0; i < 3; i++) { const k = clamp(ph - i * 0.12, 0, 1); g.strokeStyle = col; g.globalAlpha = 1 - k; g.lineWidth = 6 * (1 - k) + 1; g.beginPath(); g.arc(0, 0, 8 + k * 60, 0, TAU); g.stroke(); } g.globalAlpha = 1; g.fillStyle = col; g.fillRect(-9, -9, 18, 18); }
  g.restore();
}
function sPower(t) {
  const u = t - SC.power; backdrop(t);
  const pk = OUTQ(pr(u, 0.1, 0.7)), f = panel('power', u, 560, H / 2 + (1 - pk) * 50, 2, { a: pk });
  rise('POWER UP', 1030, 190, t, SC.power + 0.3, { size: 104, col: CREAM });
  tag('FOUR PICK-UPS DROP FROM THE BUGS', 1034, 240, { a: pr(u, 0.7, 0.4) });
  POWERS.forEach((p, i) => {
    const x = 1030 + (i % 2) * 400, y = 300 + Math.floor(i / 2) * 330, k = BACK(pr(u, BEAT * (1.4 + i * 1.0), 0.5)); if (k <= 0) return;
    const active = (p.k === 'S' && f.m.spread > 0) || (p.k === 'R' && f.m.rapid > 0) || (p.k === 'H' && f.m.shield) || (p.k === 'B' && u > 6.3);
    g.save(); g.translate(x + 180, y + 140); g.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); g.translate(-180, -140); g.globalAlpha *= clamp(k, 0, 1);
    rrect(0, 0, 360, 290, 12); g.fillStyle = PANEL; g.fill(); g.lineWidth = active ? 5 : 3; g.strokeStyle = active ? p.col : LINE; g.stroke();
    if (active) { rrect(0, 0, 360, 290, 12); g.fillStyle = p.col + '22'; g.fill(); }
    g.save(); g.beginPath(); g.rect(0, 0, 360, 190); g.clip(); powerIcon(p.k, 180, 105, t + i, p.col); g.restore();
    rrect(18, 200, 44, 44, 6); g.fillStyle = p.col; g.fill(); txt(p.k, 40, 234, { font: MONO, size: 32, w: 700, col: INK, al: 'center' });
    txt(p.name, 76, 232, { size: 30, w: 800 }); txt(p.line, 18, 272, { size: 24, w: 400, col: DIM });
    g.restore();
  });
  // Timers for the two timed pick-ups, straight from the game's numbers.
  const bx = 1030, by = 1000; tag('ACTIVE', bx, by - 10);
  [['S', f.m.spread, BOLT], ['R', f.m.rapid, '#ff9a5c']].forEach(([k, v, col], i) => { const x = bx + 130 + i * 300; txt(k, x, by - 6, { font: MONO, size: 28, w: 700, col }); rrect(x + 36, by - 28, 200, 16, 4); g.fillStyle = LINE; g.fill(); rrect(x + 36, by - 28, 200 * clamp(v / 12, 0, 1), 16, 4); g.fillStyle = col; g.fill(); });
}

// ---- scene 5: the boss ---------------------------------------------------------------------------------------------------------
function sBoss(t) {
  const u = t - SC.boss, sec = Math.max(0, u - 0.4) * BOSS_RATE + (u < 0.4 ? 0 : 0);
  const sh = shakeAt(t, [[BOSS_HIT, 22]]), boom = pr(t, BOSS_HIT, 0.5);
  backdrop(t, 0.10 * (1 - pr(u, 0, 1.6)));
  g.save(); g.translate(Math.sin(t * 90) * sh, Math.cos(t * 77) * sh);
  // outline marquee behind the panel
  for (let r = 0; r < 4; r++) { const dir = r % 2 ? 1 : -1, x = ((t * 140 * dir) % 1500) - (dir > 0 ? 1500 : 0); for (let k = -1; k < 3; k++) outline('SEGFAULT', x + k * 1500, 250 + r * 240, { size: 260, col: r === 1 ? RED : LINE, a: r === 1 ? 0.55 : 0.8, lw: 3 }); }
  const s = 3 + 0.03 * Math.exp(-(t % BEAT) * 8), f = panel('boss', sec, W / 2, H / 2, s, { glowA: 0.4 });
  g.restore();
  // boss health bar across the top
  const bm = f.m.boss, hp = bm ? bm.hp / bm.max : 0, bk = OUTQ(pr(u, 0.5, 0.8));
  g.save(); g.globalAlpha *= bk; tag('BOSS  ·  SEGFAULT', 130, 78, { col: RED });
  rrect(130, 96, 1660, 26, 6); g.fillStyle = LINE; g.fill(); rrect(130, 96, 1660 * hp, 26, 6); g.fillStyle = RED; g.fill(); g.restore();
  // left / right readouts
  txt(digits(f.m.score), 110, 900, { font: MONO, size: 84, w: 700, a: bk }); tag('SCORE', 110, 830, { a: bk });
  tag('WAVE 5', 1810, 830, { al: 'right', a: bk }); [['SPREAD', f.m.spread, BOLT], ['RAPID', f.m.rapid, '#ff9a5c']].forEach(([n, v, col], i) => { const y = 880 + i * 44; tag(n, 1810 - 300, y, { col }); rrect(1810 - 190, y - 20, 190, 14, 4); g.fillStyle = LINE; g.fill(); rrect(1810 - 190, y - 20, 190 * clamp(v / 12, 0, 1), 14, 4); g.fillStyle = col; g.fill(); });
  // intro banner
  const ik = pr(u, 0.1, 0.4), ik2 = pr(u, BEAT * 3.5, 0.3); if (ik > 0 && ik2 < 1) { g.save(); g.globalAlpha *= (1 - ik2); const bw = 900 * EXPO(ik); g.fillStyle = RED; g.fillRect(W / 2 - bw / 2, 470, bw, 130); g.fillStyle = INK; txt('BOSS INCOMING', W / 2, 565, { size: 84, al: 'center', w: 800, col: INK, a: EXPO(pr(u, 0.25, 0.3)) }); g.restore(); }
  // defeat
  if (boom > 0) {
    if (t < BOSS_HIT + 0.18) { g.fillStyle = `rgba(255,255,255,${0.9 * (1 - (t - BOSS_HIT) / 0.18)})`; g.fillRect(0, 0, W, H); }
    const gone = 1 - pr(t, BOSS_HIT + 2.6, 0.4), k = BACK(pr(t, BOSS_HIT + 0.15, 0.5)); g.save(); g.globalAlpha *= gone; g.translate(W / 2, 470); g.rotate(-0.06); g.scale(k, k); g.fillStyle = BOLT; g.fillRect(-520, -90, 1040, 180); g.fillStyle = INK; txt('SEGFAULT FIXED', 0, 30, { size: 108, al: 'center', w: 800, col: INK }); g.restore();
    txt('+' + Math.round(1000 * Math.min(1, pr(t, BOSS_HIT + 0.3, 0.8))), W / 2, 640, { size: 84, font: MONO, w: 700, al: 'center', col: BOLT, a: pr(t, BOSS_HIT + 0.3, 0.3) * (1 - pr(t, BOSS_HIT + 2.6, 0.4)) });
  }
}

// ---- scene 6: keep going ---------------------------------------------------------------------------------------------------------
function sRush(t) {
  const u = t - SC.rush; backdrop(t);
  const drift = Math.sin(u * 0.9) * 26;
  panel('mid', 4 + u, 300, 560 + drift, 1.6, { rot: -0.09, a: 0.9, glow: false });
  panel('power', 3 + u, 1620, 520 - drift, 1.6, { rot: 0.09, a: 0.9, glow: false });
  panel('rush', u, W / 2, H / 2, 2.4, { glowA: 0.45 });
  const words = [['ENDLESS', 'WAVES', TEAL], ['CHAIN', 'COMBOS  x4', BOLT], ['A BOSS', 'EVERY FIFTH', RED], ['BEAT YOUR', 'BEST SCORE', ORANGE]];
  words.forEach(([a, b, col], i) => {
    const t0 = SC.rush + i * BEAT * 3 - 0.02, k = pr(t, t0, 0.32), out = pr(t, t0 + BEAT * 3 - 0.3, 0.25); if (k <= 0 || out >= 1) return;
    g.save(); g.globalAlpha *= 1 - out; const right = i % 2 === 1, x = right ? W - 90 : 90, al = right ? 'right' : 'left', dx = (1 - EXPO(k)) * (right ? 400 : -400);
    g.fillStyle = 'rgba(15,13,22,0.72)'; g.fillRect(right ? x - 720 + dx : x - 30 + dx, 640, 750, 250);
    txt(a, x + dx, 740, { size: 96, al, w: 800, col: CREAM }); txt(b, x + dx, 860, { size: 110, al, w: 800, col }); g.restore();
  });
}

// ---- scene 7: call to action -----------------------------------------------------------------------------------------------------
function sCta(t) {
  const u = t - SC.cta; backdrop(t);
  const S = 15, bob = Math.sin(u * 3) * 6, ck = EXPO(pr(u, 0.1, 0.7));
  rows(CLAWD, CPAL, W / 2 - 11 * S / 2, 150 + bob + (1 - ck) * 300, S, ck);
  rise('CLAWD', W / 2, 560, t, SC.cta + 0.3, { size: 250, al: 'center', col: ORANGE, w: 800, track: 6 });
  rise('vs THE BUGS', W / 2, 670, t, SC.cta + 0.55, { size: 100, al: 'center', col: CREAM, w: 800, track: 10 });
  rise('PLAY IT IN YOUR BROWSER', W / 2, 800, t, SC.cta + BEAT * 3, { size: 60, al: 'center', w: 800, col: BOLT, track: 4 });
  // input chips
  ['MOUSE', 'KEYBOARD', 'TOUCH'].forEach((n, i) => {
    const k = BACK(pr(u, BEAT * 5 + i * 0.16, 0.4)); if (k <= 0) return; const x = W / 2 - 400 + i * 270, y = 850; g.save(); g.translate(x + 120, y + 30); g.scale(k, k); g.translate(-120, -30);
    rrect(0, 0, 240, 60, 30); g.fillStyle = PANEL; g.fill(); g.strokeStyle = LINE; g.lineWidth = 3; g.stroke(); tag(n, 120, 38, { al: 'center', col: CREAM }); g.restore();
  });
  tag('NO INSTALL  ·  EVERY PIXEL AND SOUND MADE IN CODE', W / 2, 990, { al: 'center', a: pr(u, BEAT * 7, 0.6) });
}

// ---- persistent chrome, then the cut ---------------------------------------------------------------------------------------
function chrome(t) {
  if (t < SC.play - 0.2 || t > SC.cta - 0.3) return;
  g.save(); g.globalAlpha *= 0.85; tag('CLAWD vs THE BUGS', 60, 1030, { col: DIM }); g.restore();
  g.fillStyle = LINE; g.fillRect(0, H - 6, W, 6); g.fillStyle = ORANGE; g.fillRect(0, H - 6, W * (t / DURATION), 6);
}
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true;
  const sh = shakeAt(t, [[SC.title, 14], [SC.title + BEAT * 3.25, 20], [SC.play, 8]]);
  g.save(); if (sh) g.translate(Math.sin(t * 111) * sh, Math.cos(t * 97) * sh);
  if (t < SC.title) sHook(t); else if (t < SC.play) sTitle(t); else if (t < SC.power) sPlay(t); else if (t < SC.boss) sPower(t); else if (t < SC.rush) sBoss(t); else if (t < SC.cta) sRush(t); else sCta(t);
  g.restore(); chrome(t);
  // cuts: a white flash into the title, colour wipes elsewhere
  if (t > SC.title - 0.05 && t < SC.title + 0.25) { g.fillStyle = `rgba(255,255,255,${1 - (t - SC.title + 0.05) / 0.3})`; g.fillRect(0, 0, W, H); }
  wipe(t, SC.play, 0.36, ORANGE); wipe(t, SC.power, 0.36, VIOLET); wipe(t, SC.boss, 0.36, RED); wipe(t, SC.rush, 0.36, TEAL); wipe(t, SC.cta, 0.36, ORANGE);
  const f = Math.max(clamp(1 - t / 0.35, 0, 1), clamp((t - (DURATION - 1.2)) / 1.2, 0, 1));
  if (f > 0) { g.fillStyle = `rgba(15,13,22,${f})`; g.fillRect(0, 0, W, H); }
}
window.DURATION = DURATION;
window.FPS = FPS;
window.renderFrame = (i) => frame(i / FPS);
window.ready = true;
window.__trailer = { SC, BOSS_HIT, BOSS_RATE, bossDeath };
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now();
  const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
}
