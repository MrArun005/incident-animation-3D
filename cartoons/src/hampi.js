// "The City of Victory": Vijayanagara (Hampi), around 1520. Domingo Paes, a real
// Portuguese traveller who wrote the city was as big as Rome, is shown round by
// Kamala, a young flower seller: the bazaar where gems were sold in heaps, the
// stone chariot, the singing pillars (she bets him they sing), and the Mahanavami
// festival where King Krishnadevaraya accepts her garland. Rich engine.
import * as C from './rich/core.js';
import * as Pp from './rich/people.js';
import * as Hw from './hampi/world.js';
import * as Pw from './pulakeshi/world.js';
import * as Iw from './indus/world.js';
import B from '../stories/hampi.beats.json' with { type: 'json' };
import timing from '../stories/hampi.timing.json' with { type: 'json' };

const { W, H, TAU, lerp, seg, lin, clamp, fade, win, ease, easeOut, setCam, layer, toScreen, rng, cam } = C;
const { person, P } = Pp;
const FPS = 30, DURATION = B.duration;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const VO = Object.fromEntries(timing.lines.map((l) => [l.id, l]));
const talking = (id, t) => { const l = VO[id]; return l && t > l.t0 && t < l.t0 + l.dur; };
const mouthFor = (ids, t, rest = 'smile') => ([].concat(ids).some((id) => talking(id, t)) ? (Math.sin(t * 23) > -0.2 ? 'open' : 'o') : rest);

const PAES = { ...Pp.BABA, skin: '#e6c0a2', hair: '#5a3a22', beard: '#6a4428', mustache: true, bun: false, band: null, top: '#7a2a2a', topTrim: '#3a1414', sleeves: '#7a2a2a', skirt: '#3a2a4a', trim: '#2a1a30', legsCol: '#e8e0d0', shoes: '#2a1a10', hat: '#2a2226', hatBand: '#8a2a20', feather: '#f0ead8', buttons: '#e2b33a', ruff: true, shawl: null, armband: null, eye: '#3a5a7a' };
const KAMALA = { ...Pp.SIYA, skin: '#a8683f', long: true, skirt: '#2f7a4a', trim: '#e2b33a', top: '#d9442a', topTrim: '#e2b33a', flowers: true, ribbon: '#e2b33a', bangles: 6, necklace: '#e2b33a' };
const KING = { ...Pp.BABA, skin: '#9a603a', kulavi: '#f2ead8', beard: null, mustache: true, bun: false, band: null, long: true, skirt: '#f4f0e6', trim: '#e2b33a', top: '#f4f0e6', topTrim: '#e2b33a', collar: '#e2b33a', earrings: '#e2b33a', armband: '#e2b33a', shawl: null };
const townLook = (seed) => { const r = rng(seed * 7 + 1), L = Pp.crowdLook(seed); return { ...L, turban: !L.braid && r() < 0.6 ? ['#f0ead8', '#d9442a', '#e2b33a', '#2f6f7a'][seed % 4] : null, long: L.braid && r() < 0.7, flowers: L.braid && r() < 0.5, top: L.braid ? ['#d9442a', '#2f7a4a', '#8e3b6e', '#e2b33a'][seed % 4] : null }; };

// ---- shared bits (same as the other rich stories) ----------------------------------------------------------------------
function fact(g, text, t, t0, dur = 3.0) {
  const k = win(t, t0, t0 + dur, 0.35); if (k <= 0) return;
  g.save(); g.globalAlpha = k; g.font = `600 36px ${C.FONT}`;
  const w = g.measureText(text).width + 90, x = 60, y = 48 - (1 - easeOut(clamp((t - t0) / 0.35, 0, 1))) * 30;
  g.fillStyle = 'rgba(30,16,8,0.78)'; g.beginPath(); g.roundRect(x, y, w, 76, 16); g.fill();
  g.strokeStyle = 'rgba(231,173,60,0.9)'; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = '#e7ad3c'; g.save(); g.translate(x + 34, y + 38); g.rotate(Math.PI / 4); g.fillRect(-8, -8, 16, 16); g.restore();
  g.fillStyle = '#fff4e0'; g.textBaseline = 'middle'; g.fillText(text, x + 62, y + 40); g.restore();
}
function subtitle(g, t) {
  const l = timing.lines.find((x) => t > x.t0 - 0.05 && t < x.t0 + x.dur + 0.4);
  if (!l) return;
  C.text(g, l.text, W / 2, H - 60, { size: 40, col: '#ffffff', weight: '700', shadow: 0.9, a: win(t, l.t0 - 0.05, l.t0 + l.dur + 0.4, 0.12), stroke: 'rgba(20,10,5,0.85)', sw: 7 });
}
function word(g, s, x, y, t, t0, size = 90, col = '#ffe07a', dur = 0.8) {
  const u = t - t0; if (u < 0 || u > dur) return;
  const pop = 1 + 0.3 * Math.sin(clamp(u / 0.25, 0, 1) * Math.PI);
  g.save(); g.translate(x, y); g.rotate(-0.06); g.scale(pop, pop);
  C.text(g, s, 0, 0, { size, weight: '900', col, stroke: '#2d1a10', sw: size * 0.16, shadow: 0.4, a: u > dur - 0.15 ? (dur - u) / 0.15 : 1 });
  g.restore();
}
function hampiSky(g, warm = 0) { C.sky(g, [[0, C.mix('#3f7fc4', '#5a4a8a', warm)], [0.45, C.mix('#a8cde6', '#f09a70', warm)], [0.8, C.mix('#f6e2bc', '#ffcf94', warm)]]); }
function hills(g, t, tint = '#9a7a8a', key = 'far') {
  layer(g, 0.2, () => { for (let i = -3; i < 5; i++) Hw.boulderPile(g, i * 560, 120, 0.9, 200 + i, tint, key); });
}
function basket(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  for (let i = 0; i < 3; i++) { g.strokeStyle = ['#f2a33a', '#fbf8ee', '#e0602a'][i]; g.lineWidth = 9; g.beginPath(); g.arc(0, -26 + i * 3, 30 - i * 5, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
  g.beginPath(); g.moveTo(-40, -20); g.lineTo(40, -20); g.lineTo(30, 10); g.lineTo(-30, 10); g.closePath(); g.fillStyle = '#b88a4a'; g.fill(); g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.stroke();
  g.restore();
}
function garland(g, x, y, s = 1) {
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) { const a = Math.PI * 0.1 + (i / 25) * Math.PI * 0.8, px = x + Math.cos(a) * 40 * s, py = y + Math.sin(a) * 70 * s; g.fillStyle = i % 2 ? '#f2a33a' : '#fbf8ee'; g.beginPath(); g.arc(px, py, 7 * s, 0, TAU); g.fill(); g.strokeStyle = 'rgba(45,26,16,0.6)'; g.lineWidth = 1.2; g.stroke(); }
}
function notebook(g, x, y, s = 1, open = 0) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.2);
  g.fillStyle = '#6a3a1a'; g.fillRect(-34, -24, 68, 48); g.strokeStyle = '#2d1a10'; g.lineWidth = 2.5; g.strokeRect(-34, -24, 68, 48);
  if (open) { g.fillStyle = '#f2ead6'; g.fillRect(-30, -20, 60, 40); g.fillStyle = '#3a2a1a'; for (let i = 0; i < Math.min(6, Math.floor(open * 6)); i++) g.fillRect(-24, -14 + i * 6, 44 - (i % 3) * 8, 2); }
  g.restore();
}

// ---- scenes ------------------------------------------------------------------------------------------------------------------
const S = {
  open(g, t) {
    const k = seg(t, 0, 8);
    setCam(lerp(-100, 60, k), lerp(-60, -100, k), lerp(1.0, 1.12, k));
    C.sky(g, [[0, '#2a3a70'], [0.35, '#8a6a90'], [0.6, '#f0a07a'], [0.78, '#ffd8a0']]);
    const [sx, sy] = toScreen(380, 40, 0.05); C.sunDisc(g, sx, sy - k * 50, 36); C.rays(g, sx, sy - k * 50, t, 0.07);
    layer(g, 0.1, () => { C.cloud(g, -600, -380, 900, 111, '#ffc9a0', '#6a4a7a', 0.8); C.cloud(g, 600, -420, 800, 112, '#ffc0a0', '#5e4577', 0.7); });
    hills(g, t, '#9a7a8a', 'far');
    C.haze(g, 260, 700, '#ffcfa0', 0.5);
    layer(g, 0.5, () => {
      g.fillStyle = '#c9a070'; g.fillRect(-2400, 170, 4800, 400);
      Hw.gopuram(g, 180, 190, 0.62);
      Hw.colonnade(g, -900, 60, 190, { h: 110 }); Hw.colonnade(g, 320, 1200, 190, { h: 110 });
      for (let i = 0; i < 8; i++) Hw.banana(g, -1400 + i * 120, 200, 0.6, t);
      for (let i = 0; i < 5; i++) Iw.palm(g, 1300 + i * 160, 200, 260, t, { lean: (i % 2 - 0.5) * 0.2 });
      Hw.boulderPile(g, -1100, 200, 0.6, 7); Hw.boulderPile(g, 1450, 200, 0.7, 8);
    });
    // The Tungabhadra with coracles.
    const [, ry] = toScreen(0, 240, 0.7);
    Iw.river(g, ry, H, t, { top: '#f2b88a', bottom: '#2f5a6a', sunX: sx });
    layer(g, 0.8, () => { Hw.coracle(g, lerp(-420, -300, k), 400, 0.9, t); Hw.coracle(g, lerp(500, 400, k), 340, 0.7, t + 2); });
    C.birds(g, t, 200, 260, 60, -8, 9, 1.1, '#2a1f33', 12);
    C.blurred(g, 5, (bg) => layer(bg, 1.35, () => { Hw.boulderPile(bg, -1050, 880, 1.2, 9, '#6a4030', 'near'); Hw.boulderPile(bg, 1150, 900, 1.1, 10, '#6a4030', 'near'); }));
    C.motes(g, t, 40, '#ffe0b0', 0.4);
    C.grade(g, t, { warm: 0.12, vignette: 0.5 });
    C.text(g, 'THE CITY OF VICTORY', W / 2, 320, { size: 108, font: C.SERIF, weight: '700', col: '#fff3dc', a: win(t, 1.8, 7.6, 0.8), shadow: 0.75, spacing: 6 });
    C.text(g, 'Vijayanagara (Hampi)  ·  1520 CE', W / 2, 392, { size: 40, col: '#ffe6c4', a: win(t, 2.6, 7.6, 0.8), shadow: 0.8, weight: '400' });
  },
  gate(g, t) {
    const k = seg(t, 8, 16.2);
    setCam(lerp(-60, 60, k), -300, 1.1);
    hampiSky(g, 0.1);
    hills(g, t, '#a88a8a', 'far2');
    C.haze(g, 200, 640, '#f2dcb4', 0.45);
    layer(g, 0.5, () => { g.fillStyle = '#c4a070'; g.fillRect(-2400, 60, 4800, 500); Hw.gopuram(g, 150, 80, 0.5); Hw.colonnade(g, -1000, -60, 80, { h: 100 }); Hw.colonnade(g, 360, 1300, 80, { h: 100 }); });
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#c9a47a', 71), 1); g.fillRect(-2000, 0, 4000, 700);
      // The gateway: two massive stone jambs and a lintel.
      for (const gx of [-760, 560]) { g.fillStyle = '#b8987c'; g.fillRect(gx, -620, 200, 620); g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.strokeRect(gx, -620, 200, 620); for (let i = 0; i < 6; i++) { g.fillStyle = C.shade('#b8987c', (i % 2 ? -0.06 : 0.04)); g.fillRect(gx, -620 + i * 104, 200, 100); g.strokeRect(gx, -620 + i * 104, 200, 100); } }
      g.fillStyle = '#a88a70'; g.fillRect(-800, -700, 1600, 90); g.strokeRect(-800, -700, 1600, 90);
      // Paes walks in and stops, amazed.
      const px = lerp(-900, -300, ease(lin(t, 8, B.arrive)));
      const amazed = t > B.arrive;
      const pp = !amazed ? P.walk(t * 7, { mouth: 'smile' }) : t > B.follow ? P.walk(t * 7, { eyes: 'happy', mouth: 'grin' }) : P.shock({ mouth: mouthFor('rome', t, 'o'), eyes: 'wide', la: [-1.8, 0.3], ra: [1.8, 0.3] });
      const pr = person(g, t > B.follow ? lerp(-300, 400, lin(t, B.follow, 16.2)) : px, 20, PAES, pp, 1, 1.7, t);
      notebook(g, pr.handB[0], pr.handB[1], 0.8);
      // Kamala runs in with her basket of garlands, beckons, runs on.
      if (t > B.kamalaIn) {
        const kx = t < 13.4 ? lerp(900, 120, easeOut(lin(t, B.kamalaIn, 13.4))) : t < B.follow ? 120 : lerp(120, 900, lin(t, B.follow, 16.2));
        const kp = t < 13.4 ? P.run(t * 13, { mouth: 'grin' }) : t < B.follow ? P.wave(t * 9, { mouth: mouthFor('show', t, 'grin'), eyes: 'happy' }) : P.run(t * 13, { mouth: 'grin', eyes: 'happy' });
        const kr = person(g, kx, 30, KAMALA, kp, t < 13.4 ? -1 : t < B.follow ? -1 : 1, 1.8, t);
        basket(g, kr.handB[0], kr.handB[1] + 10, 0.9);
      }
    });
    C.motes(g, t, 35, '#fff0c8', 0.35);
    C.grade(g, t, { warm: 0.08, vignette: 0.42 });
  },
  bazaar(g, t) {
    const lt = t - 16.2, kx = lt * 170 - 200, px = kx - 260 - Math.max(0, Math.sin(lt * 0.8)) * 40;
    setCam(kx - 60, -330, 1.0);
    hampiSky(g, 0.08);
    layer(g, 0.25, () => { Hw.gopuram(g, 300, 60, 0.85); });
    C.haze(g, 200, 640, '#f2dcb4', 0.35);
    layer(g, 0.6, () => { Hw.colonnade(g, -2000, 4000, 20, { h: 150 }); for (let i = 0; i < 20; i++) person(g, -1500 + i * 280 + Math.sin(t + i) * 30, 30, townLook(i + 60), P.walk(t * 6 + i), i % 2 ? 1 : -1, 0.8, t); });
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#caa878', 73), 1); g.fillRect(cam.x - 1400, 0, 2800, 700);
      Hw.colonnade(g, cam.x - 1400 - (cam.x % 120), cam.x + 1400, -20, { h: 260 });
      // Festoons of flags and hanging cloths in the pavilions.
      const x0 = Math.floor((cam.x - 1400) / 120) * 120;
      for (let x = x0; x < cam.x + 1400; x += 120) {
        const cols = ['#d9442a', '#e2b33a', '#2f7a4a', '#f0ead8', '#8e3b6e'];
        for (let k = 0; k < 4; k++) { const fx = x + 30 + k * 26, fy = -300 + Math.sin((fx - x) / 120 * Math.PI) * 26; g.fillStyle = cols[(Math.abs(x / 120) + k) % 5]; g.beginPath(); g.moveTo(fx - 11, fy); g.lineTo(fx + 11, fy); g.lineTo(fx, fy + 26 + Math.sin(t * 4 + fx) * 3); g.closePath(); g.fill(); }
        g.strokeStyle = '#5a3a22'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 30, -300); g.quadraticCurveTo(x + 90, -272, x + 150, -300); g.stroke();
        if (Math.abs(x / 120) % 4 === 1) { g.fillStyle = ['#d9442a', '#2f7a4a', '#e2b33a'][Math.abs(x / 120) % 3]; g.fillRect(x + 50, -280, 70, 160 + Math.sin(t * 2 + x) * 4); g.fillStyle = 'rgba(255,230,160,0.5)'; g.fillRect(x + 50, -150, 70, 10); }
      }
      // Sellers on the plinth: gems, silk, horses.
      const r = rng(5);
      for (let i = -2; i < 14; i++) {
        const sx = i * 360;
        if (sx < cam.x - 1300 || sx > cam.x + 1300) continue;
        if (i % 3 === 0) { Hw.gemHeap(g, sx, -46, 1.3, t); person(g, sx - 110, -40, townLook(i + 3), { ...P.stand(), drop: 38, ll: [1.4, -1.4], rl: [1.5, -1.4], ra: [1.3, 0.6] }, 1, 1.25, t); }
        else if (i % 3 === 1) { for (let k = 0; k < 4; k++) { g.fillStyle = ['#d9442a', '#2f7a4a', '#e2b33a', '#8e3b6e'][(k + i) % 4]; g.fillRect(sx - 90 + k * 46, -150, 40, 110); g.strokeStyle = '#2d1a10'; g.lineWidth = 2; g.strokeRect(sx - 90 + k * 46, -150, 40, 110); } }
        else { const hs = Pw.horse(g, sx, 40, { s: 0.85, coat: ['#6a4428', '#e8e2d6', '#2a1a14'][i % 3], ph: t * 2 }); void hs; person(g, sx - 150, 60, townLook(i + 9), P.stand({ ra: [1.3, 0.3] }), 1, 1.3, t); }
        void r;
      }
      // An elephant passing the other way.
      const ex = 2600 - lt * 110;
      const e = Pw.elephant(g, ex, 140, { s: 0.7, dir: -1, t, ph: t * 5, cloth: '#d9442a', canopy: null });
      person(g, e.seat[0], e.seat[1] + 40, townLook(33), { ...P.stand(), drop: 38, ll: [1.4, -1.4], rl: [1.5, -1.4] }, -1, 0.95, t);
      // Kamala leading, Paes following and scribbling.
      const kr = person(g, kx, 200, KAMALA, t > 19.6 && t < 23 ? P.point({ mouth: mouthFor('gems', t, 'grin'), eyes: 'happy', ra: [1.6, 0.1] }) : P.walk(t * 8, { mouth: 'grin', eyes: 'happy' }), t > 19.6 && t < 23 ? -1 : 1, 1.75, t);
      basket(g, kr.handB[0], kr.handB[1] + 10, 0.9);
      const writing = t > B.write && t < 27.5;
      const pr = person(g, px, 220, PAES, writing ? P.stand({ la: [1.2, 1.1], ra: [1.1, 1.3], head: 0.3, mouth: mouthFor('believe', t, 'smile'), look: [0.3, 0.9] }) : P.walk(t * 7, { eyes: 'wide', mouth: 'o', look: [0, -0.5] }), 1, 1.65, t);
      notebook(g, (pr.handF[0] + pr.handB[0]) / 2, (pr.handF[1] + pr.handB[1]) / 2, 0.9, writing ? (t - B.write) / 2 : 0);
    });
    fact(g, 'Paes wrote that rubies and diamonds were sold openly in the bazaar', t, B.capGems, 3.0);
    C.motes(g, t, 30, '#fff0c8', 0.3);
    C.grade(g, t, { warm: 0.07, vignette: 0.4 });
  },
  chariot(g, t) {
    const k = seg(t, 29.6, 31.8);
    setCam(lerp(-120, -60, seg(t, 29.6, 39)), lerp(-120, -300, k), lerp(0.8, 1.12, k));
    hampiSky(g, 0.15);
    hills(g, t, '#a88a8a', 'far3');
    C.haze(g, 200, 640, '#f2dcb4', 0.4);
    layer(g, 0.6, () => { g.fillStyle = '#c4a47e'; g.fillRect(-2400, 40, 4800, 500); Hw.colonnade(g, -1500, 1500, 60, { h: 180 }); });
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#c9ad86', 74), 1); g.fillRect(-2400, 0, 4800, 700);
      Hw.stoneChariot(g, 60, 40, 1.05, t);
      const walk = lin(t, 29.8, 32.8);
      const kx = lerp(-1100, -560, ease(walk)), px = lerp(-1300, -720, ease(walk));
      const kr = person(g, kx, 90, KAMALA, walk < 1 ? P.walk(t * 8) : P.point({ ra: [1.9, 0.1], mouth: mouthFor('stone', t, 'grin'), eyes: 'happy' }), 1, 1.8, t);
      basket(g, kr.handB[0], kr.handB[1] + 10, 0.9);
      const touching = t > B.touch;
      const pr = person(g, touching ? lerp(px, -480, seg(t, B.touch - 0.8, B.touch)) : px, 90, PAES, touching ? P.reach({ ra: [1.6, 0.1], eyes: 'wide', mouth: 'o' }) : walk < 1 ? P.walk(t * 7, { eyes: 'wide', mouth: 'o' }) : P.stand({ eyes: 'wide', mouth: 'o', look: [0.5, -0.8], head: -0.3 }), 1, 1.7, t);
      notebook(g, pr.handB[0], pr.handB[1], 0.8);
    });
    fact(g, 'The stone chariot of the Vittala temple, carved in Krishnadevaraya’s time', t, B.capChariot, 3.2);
    C.motes(g, t, 30, '#fff0c8', 0.3);
    C.grade(g, t, { warm: 0.08, vignette: 0.4 });
  },
  pillars(g, t) {
    setCam(lerp(-40, 40, seg(t, 39, 54)), -330, lerp(1.1, 1.25, seg(t, 39, 54)));
    // Inside the hall: pillars in rows, light slanting in.
    const q = g.createLinearGradient(0, 0, 0, H); q.addColorStop(0, '#5a4636'); q.addColorStop(1, '#8a6a50'); g.fillStyle = q; g.fillRect(0, 0, W, H);
    layer(g, 0.5, () => { for (let i = -6; i < 8; i++) Hw.pillar(g, i * 260, 120, 560, { col: '#8a7058', w: 50 }); });
    C.rays(g, W * 0.15, -120, t, 0.08, '#ffd8a0', 5, 1600);
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#a8906e', 75), 1); g.fillRect(-2000, 0, 4000, 700);
      g.fillStyle = '#6a5440'; g.fillRect(-2000, -700, 4000, 80);
      const taps = B.taps, nTap = taps.filter((x) => t > x).length, lastTap = taps.filter((x) => t > x).pop() ?? -9;
      const ring = Math.max(0, 1 - (t - lastTap) / 0.6);
      Hw.musicalPillar(g, 60, 0, 620, ring, t);
      Hw.musicalPillar(g, 520, 0, 620, t > B.paesTap && t < B.paesTap + 0.3 ? 0.15 : 0, t);
      Hw.musicalPillar(g, -520, 0, 620, 0, t);
      // Notes floating up from the pillar, one per tap.
      taps.forEach((x, i) => { const u = t - x; if (u > 0 && u < 2.2) Hw.musicNote(g, 60 + (i - 2) * 60 + Math.sin(u * 3 + i) * 30, -300 - i * 40 - u * 160, 1.3, Math.min(1, u * 5) * (1 - u / 2.2), ['#ffe07a', '#ffd0a0', '#bfe8ff', '#ffc0e0', '#c8ffb0'][i]); });
      // Kamala taps; Paes scoffs, then gapes, then tries it himself.
      const tapping = t > taps[0] - 0.2 && t < taps[4] + 0.3;
      const strike = tapping ? Math.max(0, Math.cos((t - taps[0]) * TAU / 0.5)) : 0;
      const kp = tapping ? P.stand({ ra: [1.5 + strike * 0.4, 0.4], mouth: 'grin', eyes: 'happy', look: [1, 0] }) : t > B.giggle ? P.cheer(t * 9, { bob: 0, mouth: 'grin' }) : P.stand({ mouth: mouthFor('bet', t, 'grin'), eyes: talking('bet', t) ? 'happy' : 'open', ra: [1.2, 1.0] });
      const kr = person(g, -140, 20, KAMALA, kp, 1, 1.8, t);
      g.strokeStyle = '#6a4424'; g.lineWidth = 6; g.lineCap = 'round'; if (tapping) { g.beginPath(); g.moveTo(kr.handF[0], kr.handF[1]); g.lineTo(kr.handF[0] + 60, kr.handF[1] - 30); g.stroke(); }
      let pp;
      if (t < VO.cannot.t0) pp = P.stand({ la: [1.3, 1.9], ra: [1.3, 1.9], mouth: 'smile', eyes: 'open', look: [-1, 0] });
      else if (t < taps[0]) pp = P.stand({ la: [1.3, 1.9], ra: [1.3, 1.9], mouth: mouthFor('cannot', t, 'grin'), eyes: 'happy' });
      else if (t < B.paesTap - 0.4) pp = P.shock({ mouth: mouthFor('imposs', t, 'shout'), eyes: 'wide' });
      else if (t < B.giggle) pp = P.reach({ ra: [1.5, 0.3], eyes: 'angry', mouth: 'teeth' });
      else pp = P.stand({ mouth: 'frown', eyes: 'sad', ra: [0.6, 1.4], la: [0.2, 0.4] });
      const pr = person(g, t < B.paesTap - 0.4 ? 330 : lerp(330, 400, seg(t, B.paesTap - 0.4, B.paesTap)), 20, PAES, pp, -1, 1.7, t);
      notebook(g, pr.handB[0], pr.handB[1], 0.8);
    });
    word(g, 'CLUNK.', W * 0.7, H * 0.33, t, B.paesTap + 0.05, 70, '#d9d0c0', 0.8);
    fact(g, 'The Vittala temple’s pillars ring like instruments when tapped', t, B.capPillars, 3.2);
    C.motes(g, t, 50, '#ffe8c0', 0.45, 9, [0, 0, W * 0.6, H]);
    C.grade(g, t, { warm: 0.1, vignette: 0.5 });
  },
  festival(g, t) {
    const k = seg(t, 54, 68.2);
    setCam(lerp(-60, 60, k), lerp(-380, -420, k), lerp(0.72, 0.85, k));
    festivalSet(g, t, { kingUp: seg(t, B.kingUp, B.kingUp + 1.2) });
    layer(g, 1, () => {
      const kr = person(g, -520, 150, KAMALA, t > 59 && t < 61.6 ? P.point({ ra: [2.3, 0.1], mouth: mouthFor('king', t, 'grin'), eyes: 'happy', look: [0.6, -0.8] }) : P.stand({ mouth: 'grin', eyes: 'wide', look: [0.6, -0.8], head: -0.25 }), 1, 1.9, t);
      garland(g, kr.handB[0], kr.handB[1] - 20, 0.8);
      const writing = t > B.pen - 0.2;
      const pr = person(g, -760, 150, PAES, writing ? P.stand({ la: [1.2, 1.1], ra: [1.1, 1.3], head: 0.3, mouth: mouthFor('perfect', t, 'smile'), look: [0.3, 0.9] }) : P.stand({ eyes: 'wide', mouth: 'o', look: [0.7, -0.8], head: -0.25 }), 1, 1.75, t);
      notebook(g, (pr.handF[0] + pr.handB[0]) / 2, (pr.handF[1] + pr.handB[1]) / 2, 0.9, writing ? (t - B.pen) / 2.4 : 0);
    });
    fact(g, 'The Mahanavami festival, on the great stone platform', t, B.capFest, 3.0);
    C.grade(g, t, { warm: 0.12, vignette: 0.55, tint: '#ff9040' });
  },
  garland(g, t) {
    setCam(lerp(-200, -120, seg(t, 68.2, 78)), lerp(-260, -280, seg(t, 68.2, 78)), lerp(1.2, 1.32, seg(t, 68.2, 78)));
    festivalSet(g, t, { kingUp: 1, kingDown: seg(t, 68.2, B.take), close: true });
    layer(g, 1, () => {
      const up = t < B.take;
      const kr = person(g, -250, 30, KAMALA, up ? P.holdUp({ ra: [2.4, 0.2], eyes: 'happy', mouth: 'grin' }) : P.cheer(t * 8, { bob: 0 }), 1, 1.9, t);
      if (up) garland(g, kr.handF[0], kr.handF[1] - 30, 0.9);
      const pr = person(g, -620, 40, PAES, t > 73.5 ? P.stand({ la: [1.2, 1.1], ra: [1.1, 1.3], head: 0.2, mouth: 'grin', eyes: 'happy', look: [0.3, 0.9] }) : P.stand({ eyes: 'happy', mouth: 'grin', look: [0.8, -0.6] }), 1, 1.75, t);
      notebook(g, (pr.handF[0] + pr.handB[0]) / 2, (pr.handF[1] + pr.handB[1]) / 2, 0.9, t > 73.5 ? (t - 73.5) / 2 : 0);
    });
    fact(g, 'Krishnadevaraya was a poet too: he wrote in Telugu and Sanskrit', t, B.capPoet, 3.4);
    C.grade(g, t, { warm: 0.12, vignette: 0.55, tint: '#ff9040' });
  },
  epi(g, t) {
    const k = seg(t, 78, 88.6);
    setCam(lerp(-100, 100, k), lerp(-300, -340, k), lerp(0.85, 1.05, k));
    C.sky(g, [[0, '#4a5a98'], [0.5, '#e9a67a'], [0.8, '#ffd8a0']]);
    const [sx, sy] = toScreen(-500, -40, 0.05); C.sunDisc(g, sx, sy, 42, '#fff0c8', '#ff9a50'); C.rays(g, sx, sy, t, 0.07, '#ffb070');
    hills(g, t, '#8a6a7a', 'far4');
    C.haze(g, 240, 680, '#ffd0a0', 0.45);
    layer(g, 0.6, () => { g.fillStyle = '#b8966e'; g.fillRect(-2400, 40, 4800, 500); for (let i = -4; i < 6; i++) Hw.pillar(g, i * 300 + 60, 60, 120 + (i % 3) * 60, { col: '#a88a6e', w: 36 }); Hw.boulderPile(g, -1200, 60, 0.8, 21); Hw.boulderPile(g, 1300, 60, 0.9, 22); });
    layer(g, 1, () => { g.fillStyle = C.pattern(g, C.mudTile('#b89a72', 76), 1); g.fillRect(-2400, 0, 4800, 700); Hw.stoneChariot(g, 40, 40, 1.0, t); });
    C.birds(g, t, -300, 200, 50, -6, 7, 1, '#2a1f33', 7);
    C.grade(g, t, { warm: 0.16, vignette: 0.5, tint: '#ff9a50' });
    C.text(g, 'Vijayanagara fell in 1565.', W / 2, 150, { size: 50, col: '#fff3dc', a: win(t, B.cap1, B.endCard, 0.4), shadow: 0.9 });
    C.text(g, 'Its ruins at Hampi are now a UNESCO World Heritage Site.', W / 2, 215, { size: 42, col: '#ffe0b0', a: win(t, B.cap2, B.endCard, 0.4), shadow: 0.9, weight: '400' });
    C.text(g, 'The stone chariot still stands, and the pillars still ring.', W / 2, 275, { size: 42, col: '#ffe0b0', a: win(t, B.cap3, B.endCard, 0.4), shadow: 0.9, weight: '400' });
    const card = seg(t, B.endCard, B.endCard + 0.6);
    if (card > 0) {
      g.fillStyle = `rgba(15,8,4,${0.72 * card})`; g.fillRect(0, 0, W, H);
      C.text(g, 'THE CITY OF VICTORY', W / 2, H / 2 - 10, { size: 100, font: C.SERIF, col: '#fff3dc', a: card, shadow: 0.8, spacing: 6 });
      C.text(g, 'Krishnadevaraya  ·  Vijayanagara empire  ·  ruled 1509–1529', W / 2, H / 2 + 70, { size: 36, col: '#e8d2b0', a: card, shadow: 0.8, weight: '400' });
    }
  },
};

// The Mahanavami night: the great platform, lamps and torches, dancers, the king on top.
function festivalSet(g, t, { kingUp = 0, kingDown = 0, close = false } = {}) {
  C.sky(g, [[0, '#0e1236'], [0.5, '#3a2a5a'], [0.8, '#8a4a5a']]);
  const r = rng(3); for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,230,${0.3 + r() * 0.6})`; g.fillRect(r() * W, r() * H * 0.4, 2.2, 2.2); }
  g.fillStyle = '#f4f1dc'; g.beginPath(); g.arc(W * 0.8, 140, 40, 0, TAU); g.fill(); C.glow(g, W * 0.8, 140, 160, '#f4f1dc', 0.25);
  hills(g, t, '#3a2a40', 'night');
  g.fillStyle = 'rgba(12,10,40,0.62)'; g.fillRect(0, 0, W, H);
  layer(g, 1, () => {
    g.fillStyle = '#5a4030'; g.fillRect(-3000, 0, 6000, 900);
    Hw.dibba(g, 300, 0, 1.0);
    // A pavilion on top with the king.
    const topY = -330;
    for (const px of [120, 480]) { g.strokeStyle = '#8a5a2a'; g.lineWidth = 10; g.beginPath(); g.moveTo(px, topY); g.lineTo(px, topY - 300); g.stroke(); }
    g.beginPath(); g.moveTo(80, topY - 300); g.quadraticCurveTo(300, topY - 420, 520, topY - 300); g.closePath(); g.fillStyle = '#c0302a'; g.fill(); g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#e2b33a'; g.lineWidth = 6; g.beginPath(); g.moveTo(80, topY - 300); g.lineTo(520, topY - 300); g.stroke();
    if (kingUp > 0) {
      const ky = lerp(topY, lerp(topY, -10, kingDown), 1), kx = lerp(300, lerp(300, -60, kingDown), 1);
      g.save(); g.globalAlpha = kingUp;
      const takes = kingDown > 0.99 && t > B.take;
      const kr = person(g, close ? lerp(300, -40, kingDown) : 300, close ? lerp(topY, 20, kingDown) : topY, KING, takes ? (t > B.wear ? P.stand({ mouth: mouthFor('garland', t, 'grin'), eyes: 'happy', la: [0.2, 0.4], ra: [0.3, 0.5] }) : P.reach({ ra: [1.5, 0.4], mouth: mouthFor('garland', t, 'smile'), eyes: 'happy' })) : P.stand({ ra: [2.2, 0.5], la: [-0.2, 0.3], mouth: 'smile', eyes: 'open' }), -1, close ? 1.8 : 1.5, t);
      if (takes && t < B.wear) garland(g, kr.handF[0], kr.handF[1] - 20, 0.9);
      if (t > B.wear) garland(g, kr.head[0] - 4, kr.head[1] + 30, 1.0);
      g.restore();
      void kx; void ky;
    }
    // Lamps along the tiers, torches, dancers, the crowd.
    for (let i = 0; i < 12; i++) Hw.lamp(g, -350 + i * 115, -2, 1.2, t);
    for (let i = 0; i < 8; i++) Hw.lamp(g, -60 + i * 90, -222, 1.0, t);
    for (let i = 0; i < 5; i++) { const dx = -1100 + i * 150, spin = t * 6 + i; person(g, dx, 200 + (i % 2) * 30, { ...townLook(80 + i), long: true, flowers: true, top: '#d9442a', skirt: ['#2f7a4a', '#e2b33a', '#8e3b6e'][i % 3] }, P.stand({ la: [-2.2 + Math.sin(spin) * 0.4, 0.5], ra: [2.2 + Math.cos(spin) * 0.4, 0.5], mouth: 'grin', eyes: 'happy', bob: Math.abs(Math.sin(spin)) * 12 }), Math.sin(spin) > 0 ? 1 : -1, 1.25, t); }
    for (let i = 0; i < 14; i++) { const cx = -1500 + i * 230, cy = 420 + (i % 3) * 40; const rr = person(g, cx, cy, townLook(100 + i), P.cheer(t * 5 + i, { bob: Math.abs(Math.sin(t * 5 + i)) * 8 }), i % 2 ? 1 : -1, 1.3, t); if (i % 3 === 0) { g.strokeStyle = '#5a3a1e'; g.lineWidth = 6; g.beginPath(); g.moveTo(rr.handF[0], rr.handF[1]); g.lineTo(rr.handF[0] + 10, rr.handF[1] - 70); g.stroke(); C.glow(g, rr.handF[0] + 10, rr.handF[1] - 80, 70, '#ffb040', 0.6); g.fillStyle = '#ffd05a'; g.beginPath(); g.ellipse(rr.handF[0] + 10, rr.handF[1] - 84, 8, 16 + Math.sin(t * 13 + i) * 3, 0, 0, TAU); g.fill(); } }
    // Petals and sparks in the air.
    const rp = rng(8); for (let i = 0; i < 50; i++) { const u = (t * 0.2 + rp()) % 1, px = -1400 + rp() * 2800 + Math.sin(t * 2 + i) * 40, py = -900 + u * 1300; g.fillStyle = ['#ff8a3a', '#ffd23a', '#ffffff'][i % 3]; g.beginPath(); g.ellipse(px, py, 5, 3, t * 3 + i, 0, TAU); g.fill(); }
  });
  C.glow(g, W / 2, H * 0.55, 700, '#ff9a40', 0.18);
}

const ORDER = B.scenes.map(([id]) => id), START = B.scenes.map(([, t]) => t);
function frame(t) {
  let i = 0; while (i + 1 < ORDER.length && t >= START[i + 1]) i++;
  C.setShake([0, 0]);
  g.save(); S[ORDER[i]](g, t); g.restore();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  subtitle(g, t);
  const dips = [8.0, 16.2, 29.6, 39.0, 54.0, 78.0];
  let f = Math.max(1 - clamp(t / 0.8, 0, 1), clamp((t - (DURATION - 1.0)) / 1.0, 0, 1));
  for (const d of dips) f = Math.max(f, 1 - clamp(Math.abs(t - d) / 0.22, 0, 1));
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
