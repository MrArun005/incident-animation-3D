// MUQABLA: a rhythm game inside the Prabhu Deva gallery (src/prabhu.js). Arrows fall on the song's beat grid; every
// hit makes him do that move (← moonwalk, ↓ rubber legs, ↑ the Mukkala hook, → kick) in whatever era's style the
// gallery is in; BANG notes sit on the song's shots and fire his finger gun only if you hit them; a miss makes
// him stumble. A long combo turns on PRABHU MODE: a gold aura, the captured real routine in its two windows, the
// invisible man in the 1994 poster. The page (web/prabhugame.template.html) feeds input and the song's clock;
// ?story=prabhugame with ?render plays a seeded bot for stills and a demo video.
import { SCENE } from './prabhu.js';
import { MOVES } from './prabhu-moves.js';

const { frame, LIST, HOOK, HITS, T0, TEND, BEAT, N, DURATION, W, H, g } = SCENE;
const FPS = 30, PB = 8;
const SANS = '"Liberation Sans", "FreeSans", Arial, sans-serif', MONO = '"DejaVu Sans Mono", monospace';
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const TAU = Math.PI * 2;

// ---- the chart --------------------------------------------------------------------------------------------------------
const LANES = [{ key: '←', move: 'moonwalk', col: '#ff4fa3' }, { key: '↓', move: 'rubber', col: '#3fe0ff' }, { key: '↑', move: 'mukkala', col: '#ffd23f' }, { key: '→', move: 'kick', col: '#5ef08a' }];
const NOTES = (() => {
  const out = [], r = rng(1994);
  const bangs = HITS.map((h, i) => ({ t: h, i })).filter((b) => b.t >= 4 && b.t <= TEND);
  const nearBang = (t) => bangs.some((b) => Math.abs(b.t - t) < 0.22);
  let last = -1, rep = 0;
  for (let k = 0; k < N; k++) {
    const beats = k < 3 ? [0, 2, 4, 6] : k < 8 ? [0, 1, 2, 3, 4, 5, 6, 7] : k < 15 ? [0, 1, 2, 3, 3.5, 4, 5, 6, 7, 7.5] : [0, 1, 1.5, 2, 3, 3.5, 4, 5, 5.5, 6, 7, 7.5];
    for (const b of beats) {
      const t = T0 + (k * PB + b) * BEAT;
      if (t < T0 + 2 * BEAT || t > TEND - BEAT || nearBang(t)) continue;
      let lane = k === 11 && b % 2 === 0 ? 2 : Math.floor(r() * 4);           // the 1994 poster leans on the Mukkala hook
      if (lane === last && ++rep >= 2) { lane = (lane + 1 + Math.floor(r() * 3)) % 4; rep = 0; } else if (lane !== last) rep = 0;
      last = lane; out.push({ t, lane, j: null });
    }
  }
  for (const b of bangs) out.push({ t: b.t, lane: -1, bang: b.i, j: null });
  return out.sort((a, b) => a.t - b.t);
})();
const TOTAL = NOTES.length;

// ---- judging -------------------------------------------------------------------------------------------------------------
const WIN = [['PERFECT', 0.055, 300, '#ffe14d'], ['GREAT', 0.1, 200, '#5ef08a'], ['GOOD', 0.16, 100, '#3fe0ff']];
const MISS_AFTER = 0.2;
const S = { score: 0, combo: 0, maxCombo: 0, counts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 }, pts: 0, last: null, move: null, stumble: -9, flash: [-9, -9, -9, -9, -9], pm: false, pmAt: -9 };
function reset() {
  for (const n of NOTES) n.j = null;
  Object.assign(S, { score: 0, combo: 0, maxCombo: 0, counts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 }, pts: 0, last: null, move: null, stumble: -9, flash: [-9, -9, -9, -9, -9], pm: false, pmAt: -9 });
}
const mult = () => Math.min(4, 1 + Math.floor(S.combo / 10) * 0.5);
function judge(n, dt, t) {
  const w = WIN.find(([, win]) => Math.abs(dt) <= win);
  if (!w) return false;
  n.j = w[0]; n.dt = dt; S.counts[w[0]]++; S.pts += w[2];
  S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.score += Math.round(w[2] * mult());
  S.last = { kind: w[0], col: w[3], t, lane: n.lane };
  if (n.lane >= 0) S.move = { name: LANES[n.lane].move, t0: t };
  if (!S.pm && S.combo >= 20) { S.pm = true; S.pmAt = t; }
  return true;
}
function miss(n, t) {
  n.j = 'MISS'; S.counts.MISS++; S.combo = 0; S.stumble = t; S.last = { kind: 'MISS', col: '#9a8f7c', t, lane: n.lane };
  if (S.pm) S.pm = false;
}
// a press on a lane (-1: the any-key, which takes BANG notes) at song time t
function press(lane, t) {
  if (lane >= 0) S.flash[lane] = t; else S.flash[4] = t;
  let best = null;
  for (const n of NOTES) {
    if (n.j || n.t > t + 0.2) continue; if (n.t < t - MISS_AFTER) continue;
    const ok = n.lane === -1 ? true : n.lane === lane || lane === -1 && false;
    if (!ok) continue;
    if (!best || Math.abs(n.t - t) < Math.abs(best.t - t)) best = n;
  }
  if (best) judge(best, t - best.t, t);
}
function sweep(t) { for (const n of NOTES) if (!n.j && n.t < t - MISS_AFTER) miss(n, n.t + MISS_AFTER); }

// ---- the dancer, driven by the player -------------------------------------------------------------------------------------
HOOK.noOutro = true;
HOOK.capture = () => S.pm;                                   // the real routine is the reward
HOOK.shotOk = (i) => NOTES.some((n) => n.bang === i && n.j && n.j !== 'MISS');
HOOK.pose = (t, gb) => {
  if (t - S.stumble < 0.7) { const u = (t - S.stumble) / 0.7, p = MOVES.shrug(u * 1.5); return { ...p, face: 3, lean: 0.25 * Math.sin(u * 9) * (1 - u), y: 0.02 * Math.sin(u * Math.PI) }; }
  const pk = Math.floor((t - T0) / (PB * BEAT));
  if (S.pm && LIST[pk] && LIST[pk].id === 'poster') return MOVES.mukkalaInv(gb);
  if (S.move && t - S.move.t0 < 2 * BEAT) return MOVES[S.move.name]((t - S.move.t0) / BEAT + 0.25);
  return null;
};

// ---- the HUD ------------------------------------------------------------------------------------------------------------
const HX = W - 480, HW = 420, LW = HW / 4, HIT_Y = 930, SPEED = 560;
function arrow(gc, x, y, lane, col, s = 1, alpha = 1) {
  const rot = [Math.PI, Math.PI / 2, -Math.PI / 2, 0][lane];
  gc.save(); gc.globalAlpha = alpha; gc.translate(x, y); gc.rotate(rot); gc.scale(s, s);
  gc.beginPath(); gc.moveTo(34, 0); gc.lineTo(2, -32); gc.lineTo(2, -14); gc.lineTo(-30, -14); gc.lineTo(-30, 14); gc.lineTo(2, 14); gc.lineTo(2, 32); gc.closePath();
  gc.fillStyle = col; gc.fill(); gc.lineWidth = 5; gc.strokeStyle = '#140f0a'; gc.stroke(); gc.restore();
}
function txt(s, x, y, size, col, align = 'left', stroke = '#140f0a', weight = 'bold') {
  g.font = `${weight} ${size}px ${SANS}`; g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (stroke) { g.lineWidth = size * 0.16; g.strokeStyle = stroke; g.strokeText(s, x, y); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function hud(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  // PRABHU MODE aura
  if (S.pm) { const k = 0.55 + 0.45 * Math.sin(t * 6); g.save(); g.shadowColor = '#ffcf3a'; g.shadowBlur = 60; g.strokeStyle = `rgba(255,207,58,${0.5 + 0.4 * k})`; g.lineWidth = 14; g.strokeRect(7, 7, W - 14, H - 14); g.restore(); }
  // the highway
  g.save(); g.fillStyle = 'rgba(14,10,8,0.62)'; g.beginPath(); g.roundRect(HX - 10, 0, HW + 20, H, 0); g.fill();
  for (let i = 1; i < 4; i++) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(HX + i * LW - 1, 0, 2, H); }
  for (let i = 0; i < 4; i++) { const f = clamp(1 - (t - S.flash[i]) / 0.18, 0, 1); if (f > 0) { const gr = g.createLinearGradient(0, HIT_Y, 0, HIT_Y - 420); gr.addColorStop(0, LANES[i].col + 'aa'); gr.addColorStop(1, LANES[i].col + '00'); g.globalAlpha = f; g.fillStyle = gr; g.fillRect(HX + i * LW, HIT_Y - 420, LW, 420); g.globalAlpha = 1; } }
  // receptors
  for (let i = 0; i < 4; i++) arrow(g, HX + i * LW + LW / 2, HIT_Y, i, 'rgba(255,255,255,0.12)', 1.05 + 0.15 * clamp(1 - (t - S.flash[i]) / 0.12, 0, 1));
  for (let i = 0; i < 4; i++) { g.save(); g.globalAlpha = 0.55; arrow(g, HX + i * LW + LW / 2, HIT_Y, i, 'rgba(0,0,0,0)', 1.05); g.restore(); }
  // notes
  for (const n of NOTES) {
    const y = HIT_Y - (n.t - t) * SPEED; if (y < -60 || y > H + 60) continue;
    if (n.j && n.j !== 'MISS') continue;
    const a = n.j === 'MISS' ? 0.3 : 1;
    if (n.lane === -1) {
      g.save(); g.globalAlpha = a; g.fillStyle = '#ffe14d'; g.strokeStyle = '#140f0a'; g.lineWidth = 5; g.beginPath(); g.roundRect(HX + 6, y - 26, HW - 12, 52, 26); g.fill(); g.stroke();
      g.fillStyle = '#ff4a2b'; for (let s = 0; s < 2; s++) { const cx = s ? HX + HW - 40 : HX + 40; g.beginPath(); for (let i = 0; i < 16; i++) { const an = i / 16 * TAU, r = i % 2 ? 9 : 20; g.lineTo(cx + Math.cos(an) * r, y + Math.sin(an) * r); } g.closePath(); g.fill(); }
      g.restore(); txt('BANG', HX + HW / 2, y + 2, 32, '#140f0a', 'center', null);
    } else arrow(g, HX + n.lane * LW + LW / 2, y, n.lane, LANES[n.lane].col, 1, a);
  }
  // BANG flash on the any-key
  const fb = clamp(1 - (t - S.flash[4]) / 0.15, 0, 1); if (fb > 0) { g.fillStyle = `rgba(255,225,77,${0.25 * fb})`; g.fillRect(HX - 10, HIT_Y - 40, HW + 20, 80); }
  g.restore();
  // score, combo, the meter
  g.save(); g.fillStyle = 'rgba(14,10,8,0.62)'; g.beginPath(); g.roundRect(24, 24, 440, 150, 18); g.fill(); g.restore();
  txt('MUQABLA', 48, 58, 30, '#ffd23f', 'left', null);
  txt(String(S.score).padStart(7, '0'), 48, 104, 52, '#fff', 'left', null);
  txt(`×${mult().toFixed(1)}`, 440, 104, 34, mult() > 1 ? '#ffd23f' : '#9a8f7c', 'right', null);
  const m = clamp(S.combo / 20, 0, 1); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(48, 140, 392, 14);
  const gr = g.createLinearGradient(48, 0, 440, 0); gr.addColorStop(0, '#ff4fa3'); gr.addColorStop(1, '#ffd23f'); g.fillStyle = gr; g.fillRect(48, 140, 392 * (S.pm ? 1 : m), 14);
  txt(S.pm ? 'PRABHU MODE' : 'PRABHU-O-METER', 48, 166, 14, S.pm ? '#ffd23f' : '#c9bea8', 'left', null, 'bold');
  // judgement and combo, over the dancer
  if (S.last && t - S.last.t < 0.6) {
    const u = (t - S.last.t) / 0.6, sc = 1 + 0.35 * Math.exp(-u * 10);
    g.save(); g.globalAlpha = 1 - u * u; g.translate(W / 2 - 60, 72); g.scale(sc, sc); txt(S.last.kind === 'PERFECT' ? 'PERFECT!' : S.last.kind, 0, 0, 70, S.last.col, 'center'); g.restore();
  }
  if (S.combo >= 4 && t < TEND + 3) txt(`${S.combo} COMBO`, W / 2 + 260, 76, 34, '#fff', 'center');
  if (S.pm && t - S.pmAt < 2.2) { const u = (t - S.pmAt) / 2.2; g.save(); g.globalAlpha = Math.sin(Math.PI * u); txt('PRABHU MODE!', W / 2 - 60, H / 2, 120, '#ffd23f', 'center', '#3a1a00'); g.restore(); }
  // the era
  const k = clamp(Math.floor((t - T0) / (PB * BEAT)), 0, N - 1);
  if (t >= T0 && t < TEND) { g.save(); g.fillStyle = 'rgba(14,10,8,0.62)'; g.beginPath(); g.roundRect(24, H - 92, 560, 64, 16); g.fill(); g.restore(); txt(`ERA ${String(k + 1).padStart(2, '0')}/20`, 48, H - 60, 22, '#ffd23f', 'left', null); txt(LIST[k].name, 190, H - 60, 26, '#fff', 'left', null); }
  if (t < T0) { g.save(); g.globalAlpha = clamp((T0 - t) / 1.5, 0, 1) * clamp(t / 0.6, 0, 1); txt('← ↓ ↑ →  on the arrows   ·   SPACE (or any lane) on BANG', W / 2, H - 70, 30, '#fff', 'center'); g.restore(); }
  // the results
  if (t > TEND + 3.2) {
    const a = clamp((t - TEND - 3.2) / 0.8, 0, 1), acc = TOTAL ? S.pts / (300 * TOTAL) : 0;
    const rank = acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D';
    g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(14,10,8,0.86)'; g.beginPath(); g.roundRect(W / 2 - 430, 170, 860, 640, 30); g.fill();
    txt('YOU DANCED 10,000 YEARS', W / 2, 240, 40, '#ffd23f', 'center', null);
    txt(rank, W / 2 - 230, 470, 260, rank === 'S' ? '#ffd23f' : '#fff', 'center', null);
    txt(String(S.score).padStart(7, '0'), W / 2 + 170, 360, 72, '#fff', 'center', null);
    const rows = [['PERFECT', S.counts.PERFECT, '#ffe14d'], ['GREAT', S.counts.GREAT, '#5ef08a'], ['GOOD', S.counts.GOOD, '#3fe0ff'], ['MISS', S.counts.MISS, '#9a8f7c'], ['MAX COMBO', S.maxCombo, '#ff4fa3'], ['ACCURACY', `${(acc * 100).toFixed(1)}%`, '#fff']];
    rows.forEach(([n, v, c], i) => { txt(n, W / 2 + 20, 440 + i * 50, 28, c, 'left', null); txt(String(v), W / 2 + 330, 440 + i * 50, 28, '#fff', 'right', null); });
    txt('press ▶ to dance again', W / 2, 770, 26, '#c9bea8', 'center', null, 'normal');
    g.restore();
  }
}

// ---- the page's interface ------------------------------------------------------------------------------------------------
let lastT = -1;
function step(t) {
  if (t < lastT - 0.5) reset();                              // a restart
  lastT = t; sweep(t); frame(t); hud(t);
}
window.gameReset = () => { reset(); lastT = -1; };
window.gamePress = (lane, t) => press(lane, t);
window.gameFrame = (t) => step(t);
window.gameStats = () => ({ ...S, total: TOTAL });
// headless: a seeded bot plays (mostly well) so stills and a demo video show the game in motion
function bot(t) {
  reset(); const r = rng(7);
  for (const n of NOTES) { if (n.t > t) break; const roll = r(); const k = n.t - T0 > 20 && n.t - T0 < 23 ? 0.5 : 0.04;
    if (roll < k) miss(n, n.t + MISS_AFTER); else { if (n.lane >= 0) S.flash[n.lane] = n.t; else S.flash[4] = n.t; judge(n, (r() - 0.5) * 0.09, n.t); } }
  lastT = t; frame(t); hud(t);
}
window.DURATION = DURATION; window.FPS = FPS;
window.renderFrame = (i) => bot(i / FPS);
window.ready = true;
