// "The Lord of the South": Aihole, 634 CE. The court poet Ravikirti dictates the
// Aihole inscription while his apprentice Ganga carves it, and the story comes
// alive: Harsha of the north marches south with his elephants, and the young
// Chalukya king Pulakeshin II stops him at the Narmada. The inscription's own pun:
// Harsha lost his harsha (joy). Rich engine; beats in stories/pulakeshi.beats.json.
import * as C from './rich/core.js';
import * as Pp from './rich/people.js';
import * as Wd from './pulakeshi/world.js';
import B from '../stories/pulakeshi.beats.json' with { type: 'json' };
import timing from '../stories/pulakeshi.timing.json' with { type: 'json' };

const { W, H, TAU, lerp, seg, lin, clamp, fade, win, ease, easeOut, setCam, layer, toScreen, rng, cam } = C;
const { person, P } = Pp;
const FPS = 30, DURATION = B.duration;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const VO = Object.fromEntries(timing.lines.map((l) => [l.id, l]));
const talking = (id, t) => { const l = VO[id]; return l && t > l.t0 && t < l.t0 + l.dur; };
const mouthFor = (ids, t, rest = 'smile') => ([].concat(ids).some((id) => talking(id, t)) ? (Math.sin(t * 23) > -0.2 ? 'open' : 'o') : rest);

// ---- the cast -----------------------------------------------------------------------------------------------------
const GANGA = { ...Pp.SIYA, skin: '#b87649', skirt: '#2f6f5a', trim: '#e7ad3c', top: '#f0e4c8', topTrim: '#2f6f5a', ribbon: '#e7ad3c', bangles: 4, necklace: '#e2b33a' };
const RAVI = { ...Pp.BABA, skin: '#a86a44', hair: '#ece6da', beard: '#f2eee6', long: true, skirt: '#f2ead6', trim: '#c9a441', shawl: '#e2b33a', shawlPlain: true, band: null, bun: true, armband: null };
const PULA = { ...Pp.BABA, skin: '#9a5f38', crown: true, hairLong: true, beard: null, mustache: true, collar: '#e2b33a', shawl: '#b0302a', shawlPlain: true, skirt: '#f2e4c2', trim: '#b0302a', earrings: '#e2b33a', band: null, bun: false, armband: '#e2b33a' };
const HARSHA = { ...PULA, skin: '#b07a50', shawl: '#2f6f5a', trim: '#2f6f5a', skirt: '#f4f0e6', collar: '#e2b33a' };
const MONK = { ...Pp.BABA, skin: '#e0b98f', bald: true, beard: null, band: null, bun: false, long: true, top: '#c9772a', skirt: '#c9772a', trim: '#8a4a1a', shawl: '#a85a1f', shawlPlain: true, armband: null };
const soldier = (seed, side) => ({ ...Pp.crowdLook(seed), braid: false, bun: false, top: null, beard: '#1c130d', mustache: true, turban: side === 'south' ? ['#b0302a', '#e7ad3c', '#8a2a20'][seed % 3] : ['#f0ead8', '#2f6f5a', '#d9d0b8'][seed % 3], skirt: side === 'south' ? '#e8d6b0' : '#f2f0e8', trim: side === 'south' ? '#b0302a' : '#2f6f5a', shawl: null, bangles: 0, necklace: null });

// ---- shared bits -------------------------------------------------------------------------------------------------------
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
// The flashback look: warmer, a painted-paper texture, a soft frame.
function storyGrade(g, t) {
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.18; g.fillStyle = C.pattern(g, C.mudTile('#d8b890', 41), 2.2); g.fillRect(0, 0, W, H); g.restore();
  C.grade(g, t, { warm: 0.16, vignette: 0.55, tint: '#ffa860' });
}
function deccanSky(g, warm = 0) {
  C.sky(g, [[0, C.mix('#3f7fc4', '#5a4a8a', warm)], [0.45, C.mix('#a8cde6', '#e89a78', warm)], [0.8, C.mix('#f6e2bc', '#ffcf94', warm)]]);
}
function sitPose(o = {}) { return { ...P.stand(), drop: 38, ll: [1.4, -1.35], rl: [1.5, -1.4], ...o }; }

// The temple wall close-up: ashlar blocks, the panel, Ganga carving, Ravikirti dictating.
function templeWall(g, t, { reveal = 0.3, glowA = 0, zoom = 1, cx = 0, cy = -300, ganga = {}, ravi = {} } = {}) {
  setCam(cx, cy, zoom);
  deccanSky(g, 0.2);
  layer(g, 0.3, () => Wd.sandstone(g, -1400, -150, 2800, 360, 12, { col: '#c07a52' }));
  layer(g, 1, () => {
    // The wall: big sandstone blocks.
    const r = rng(4);
    for (let row = 0; row < 8; row++) for (let i = -8; i < 10; i++) {
      const bx = i * 180 + (row % 2) * 90, by = -row * 90, w = 176, h = 86;
      g.fillStyle = C.shade('#c9a47a', (r() - 0.5) * 0.12); g.fillRect(bx, by - h, w, h);
      g.fillStyle = 'rgba(255,235,200,0.18)'; g.fillRect(bx, by - h, w, 4); g.fillStyle = 'rgba(60,35,20,0.25)'; g.fillRect(bx, by - 5, w, 5);
    }
    g.fillStyle = 'rgba(60,35,20,0.35)'; for (let i = -8; i < 10; i++) g.fillRect(i * 180 - 2, -720, 4, 720);
    const q = g.createLinearGradient(0, -720, 0, 0); q.addColorStop(0, 'rgba(255,190,120,0.12)'); q.addColorStop(1, 'rgba(60,30,15,0.28)'); g.fillStyle = q; g.fillRect(-1600, -720, 3400, 720);
    // Ground and a small wooden stool.
    g.fillStyle = C.pattern(g, C.mudTile('#b89068', 23), 1); g.fillRect(-1600, 0, 3400, 600);
    g.fillStyle = 'rgba(40,20,10,0.25)'; g.fillRect(-1600, 0, 3400, 18);
    Wd.inscription(g, -380, -560, 620, 330, { reveal, glow: glowA, rows: 8, cols: 18 });
    g.fillStyle = '#6a4424'; g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.fillRect(-300, -120, 170, 26); g.strokeRect(-300, -120, 170, 26); g.fillRect(-290, -94, 16, 94); g.fillRect(-156, -94, 16, 94);
    // Ganga on the stool, chisel and mallet.
    const strike = Math.abs(Math.sin(t * 7));
    const gp = ganga.pose || { ...P.stand({ ra: [2.2 - strike * 0.5, 0.2], la: [2.4, 0.4], eyes: 'look', look: [0.6, -0.6], head: -0.2 }), mouth: ganga.mouth || 'smile' };
    const gg = person(g, -215, -120, GANGA, gp, ganga.dir || 1, 1.9, t);
    if (!ganga.pose) {
      g.strokeStyle = '#8a8a92'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(gg.handB[0], gg.handB[1]); g.lineTo(gg.handB[0] + 34, gg.handB[1] - 26); g.stroke();
      g.fillStyle = '#6a4424'; g.save(); g.translate(gg.handF[0], gg.handF[1]); g.rotate(-0.6 + strike * 0.5); g.fillRect(-4, -40, 8, 44); g.fillRect(-16, -54, 32, 18); g.restore();
      const rr = rng(Math.floor(t * 14)); for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(240,225,200,${rr()})`; g.beginPath(); g.arc(gg.handB[0] + 34 + (rr() - 0.5) * 40, gg.handB[1] - 26 + (rr() - 0.5) * 30, 2 + rr() * 3, 0, TAU); g.fill(); }
    }
    // Ravikirti with a bundle of palm leaves.
    const rp = ravi.pose || P.stand({ la: [1.2, 0.9], ra: [0.9, 1.1], mouth: ravi.mouth || 'smile', eyes: ravi.eyes || 'open', look: [-0.5, 0.3] });
    const rv = person(g, 420, 0, RAVI, rp, -1, 1.75, t);
    if (!ravi.pose || ravi.leaves) { g.save(); g.translate((rv.handF[0] + rv.handB[0]) / 2, (rv.handF[1] + rv.handB[1]) / 2 - 6); g.rotate(-0.15); for (let i = 0; i < 4; i++) { g.fillStyle = C.shade('#d9b870', -i * 0.05); g.strokeStyle = '#6a4a20'; g.lineWidth = 2; g.beginPath(); g.roundRect(-70, -8 + i * 5, 140, 14, 6); g.fill(); g.stroke(); } g.restore(); }
  });
  C.motes(g, t, 40, '#fff0c8', 0.35);
}

// ---- scenes ---------------------------------------------------------------------------------------------------------------
const S = {
  open(g, t) {
    const k = seg(t, 0, 8.6);
    setCam(lerp(-120, 80, k), lerp(-40, -90, k), lerp(1.0, 1.12, k));
    C.sky(g, [[0, '#2a2f66'], [0.35, '#7a5a86'], [0.6, '#f0947a'], [0.78, '#ffd39c']]);
    const [sx, sy] = toScreen(-520, 20, 0.05);
    C.sunDisc(g, sx, sy - k * 50, 36); C.rays(g, sx, sy - k * 50, t, 0.07);
    layer(g, 0.1, () => { C.cloud(g, -500, -380, 900, 51, '#ffc9a0', '#6a4a7a', 0.8); C.cloud(g, 600, -430, 800, 52, '#ffc0a0', '#5e4577', 0.7); });
    layer(g, 0.25, () => { Wd.sandstone(g, -1500, 80, 1400, 260, 61, { col: '#9a6a7a' }); Wd.sandstone(g, -200, 90, 1700, 300, 62, { col: '#9a6a7a' }); });
    C.haze(g, 300, 720, '#ffcfa0', 0.45);
    layer(g, 0.5, () => {
      Wd.sandstone(g, -1400, 200, 1100, 330, 63, { col: '#c07a52' }); Wd.sandstone(g, 500, 210, 1100, 380, 64, { col: '#b8683f' });
      // The river valley and the temples of Aihole.
      g.fillStyle = '#c9a070'; g.fillRect(-2000, 200, 4000, 400);
      g.fillStyle = '#8fb0b0'; g.beginPath(); g.moveTo(-2000, 330); g.quadraticCurveTo(-400, 250, 400, 320); g.quadraticCurveTo(1100, 380, 2000, 300); g.lineTo(2000, 350); g.quadraticCurveTo(1100, 430, 400, 370); g.quadraticCurveTo(-400, 300, -2000, 380); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,220,170,0.4)'; g.fillRect(-2000, 330, 4000, 3);
      for (let i = 0; i < 9; i++) Wd.shikharaTemple(g, -900 + i * 190, 222 + (i % 3) * 8, 0.33 + (i % 2) * 0.06);
      for (let i = 0; i < 12; i++) Wd.boulder(g, -1300 + i * 230, 250, 50, 24, i, '#b8683f');
    });
    C.haze(g, 420, 760, '#ffcfa0', 0.25);
    layer(g, 0.85, () => {
      // Meguti hill, the temple on top.
      Wd.sandstone(g, 250, 420, 1100, 360, 70, { col: '#b25a36' });
      Wd.megutiTemple(g, 820, 150, 0.38);
      Wd.boulder(g, -300, 470, 180, 60, 5, '#a8552f'); Wd.boulder(g, 20, 480, 120, 44, 6, '#b8683f');
    });
    C.birds(g, t, -200, 250, 70, -10, 9, 1.1, '#2a1f33', 3);
    C.blurred(g, 5, (bg) => layer(bg, 1.35, () => { Wd.boulder(bg, -900, 740, 420, 150, 9, '#6a3020'); Wd.boulder(bg, 1100, 760, 380, 130, 10, '#6a3020'); }));
    C.motes(g, t, 40, '#ffe0b0', 0.4);
    C.grade(g, t, { warm: 0.12, vignette: 0.5 });
    C.text(g, 'THE LORD OF THE SOUTH', W / 2, 330, { size: 104, font: C.SERIF, weight: '700', col: '#fff3dc', a: win(t, 1.8, 8.0, 0.8), shadow: 0.75, spacing: 6 });
    C.text(g, 'Aihole, Karnataka  ·  634 CE', W / 2, 400, { size: 40, col: '#ffe6c4', a: win(t, 2.6, 8.0, 0.8), shadow: 0.8, weight: '400' });
  },
  temple(g, t) {
    const k = seg(t, 8.6, 16.9);
    templeWall(g, t, {
      reveal: lerp(0.25, 0.6, k), glowA: 0.9 * seg(t, B.glowUp, 17.6), zoom: lerp(1.1, 1.22, k), cx: lerp(40, 20, k), cy: -300,
      ganga: talking('ask', t) ? { pose: P.stand({ eyes: 'happy', mouth: mouthFor('ask', t), la: [0.3, 0.6], ra: [1.4, 0.9], look: [1, 0], head: -0.05 }), dir: 1 } : {},
      ravi: { mouth: mouthFor('listen', t), eyes: talking('listen', t) ? 'open' : 'happy' },
    });
    C.grade(g, t, { warm: 0.1, vignette: 0.45 });
  },
  dive(g, t) {
    // Into the glowing letters, and out into the story.
    const k = lin(t, 17.6, B.flash);
    templeWall(g, t, { reveal: 0.62, glowA: 1, zoom: lerp(1.22, 5.5, ease(k)), cx: lerp(20, -70, k), cy: lerp(-300, -400, k) });
    C.glow(g, W / 2, H / 2, 900, '#ffd27a', 0.7 * k);
    g.fillStyle = `rgba(255,236,190,${seg(t, 18.6, B.flash)})`; g.fillRect(0, 0, W, H);
    C.grade(g, t, { warm: 0.1, vignette: 0.45 });
  },
  harsha(g, t) {
    const lt = t - 19.6;
    const ex = lt * 150 - 300;
    setCam(ex + 120, -330, 0.95);
    C.sky(g, [[0, '#6a9ac8'], [0.5, '#d9c4a0'], [0.8, '#f2dcb0']]);
    layer(g, 0.1, () => { C.cloud(g, -300, -420, 900, 71, '#fff6e6', '#c9b8a8', 0.8); C.cloud(g, 800, -380, 700, 72, '#fff6e6', '#c9b8a8', 0.7); });
    layer(g, 0.3, () => {
      // Kannauj on the far bank of the Ganga: palaces, domes of trees.
      for (let i = -6; i < 10; i++) { const r = rng(i + 30), h = 120 + r() * 160; g.fillStyle = C.mix('#b89a80', '#d4c0a4', r()); g.fillRect(i * 200 - 60, -h - 60, 150, h); g.fillStyle = '#c9b090'; g.beginPath(); g.moveTo(i * 200 - 70, -h - 60); g.lineTo(i * 200 + 15, -h - 110); g.lineTo(i * 200 + 100, -h - 60); g.fill(); }
      g.fillStyle = '#9ab8b8'; g.fillRect(-2000, -60, 4000, 50);
    });
    C.haze(g, 200, 640, '#f0dcb4', 0.5);
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#c4a472', 55), 1); g.fillRect(cam.x - 1400, 0, 2800, 700);
      const dust = g.createLinearGradient(0, -200, 0, 100); dust.addColorStop(0, 'rgba(230,210,170,0)'); dust.addColorStop(1, 'rgba(230,210,170,0.45)');
      // A column of war elephants; Harsha on the lead one under a canopy.
      const cols = [['#2f6f5a', '#e7b33c'], ['#f0ead8', '#2f6f5a'], ['#2f6f5a', '#e7b33c'], ['#6a2f6a', '#e7b33c'], ['#2f6f5a', '#f0ead8']];
      for (let i = 4; i >= 1; i--) { const e = Wd.elephant(g, ex - i * 420, 40 - (i % 2) * 20, { s: 0.72 - i * 0.02, t, ph: t * 5 + i, cloth: cols[i][0], trim: cols[i][1] }); person(g, e.seat[0], e.seat[1] + 44, soldier(i + 3, 'north'), sitPose({ ra: [2.2, 0.3] }), 1, 0.9, t); Wd.spear(g, e.seat[0] + 20, e.seat[1] - 40, 150, 0.1); }
      const lead = Wd.elephant(g, ex, 60, { s: 0.8, t, ph: t * 5, cloth: '#2f6f5a', canopy: '#f0ead8' });
      person(g, lead.seat[0], lead.seat[1] + 46, HARSHA, sitPose({ mouth: 'smile', eyes: 'open', ra: [1.2, 0.6], look: [0.8, 0] }), 1, 1.0, t);
      for (let i = 0; i < 7; i++) { const sx = ex + 300 - i * 260, s = soldier(i + 11, 'north'); const r = person(g, sx, 200, s, P.walk(t * 7 + i), 1, 1.25, t); Wd.spear(g, r.handF[0], r.handF[1], 200, 0.08); }
      Wd.banner(g, ex + 380, 200, 320, '#2f6f5a', t, { w: 130 }); Wd.banner(g, ex - 900, 170, 300, '#f0ead8', t, { w: 120 });
      g.fillStyle = dust; g.fillRect(cam.x - 1400, -200, 2800, 300);
    });
    storyGrade(g, t);
    g.fillStyle = `rgba(255,236,190,${1 - fade(t, 19.6, 0.6)})`; g.fillRect(0, 0, W, H);
  },
  map(g, t) {
    Wd.mapIndia(g, W / 2 + 20, H / 2 + 10, 33, { north: fade(t, B.mapNorth, 0.6), arrow: seg(t, B.mapArrow, B.mapArrow + 1.6), south: fade(t, B.mapSouth, 0.6), narmada: fade(t, B.mapRiver, 0.5) });
    storyGrade(g, t);
  },
  narmada(g, t) {
    const push = seg(t, B.pushIn, B.pushIn + 1.4) * (1 - seg(t, 38.4, 39.8));
    setCam(lerp(0, 430, push), lerp(-260, -380, push), lerp(0.78, 1.55, push));
    riverScene(g, t, { charge: 0 });
    fact(g, 'The Narmada river, around 618 CE', t, B.capRiver, 2.8);
  },
  battle(g, t) {
    const face = seg(t, B.harshaFace, B.harshaFace + 1.6);
    setCam(lerp(lerp(-40, 60, seg(t, 40, 50)), -660, face), lerp(-260, -250, face), lerp(0.8, 1.75, face));
    riverScene(g, t, { charge: 1 });
    word(g, 'DHOOM!', W * 0.72, H * 0.3, t, B.drums, 88, '#ffe07a', 0.6);
  },
  joy(g, t) {
    // Harsha, close: the joy (a golden light at his heart) melts away.
    setCam(-660, -250, 1.9);
    riverScene(g, t, { charge: 1, still: true });
    const [hx, hy] = toScreen(HARSHA_AT[0], HARSHA_AT[1] - 60);
    const melt = seg(t, B.melt, B.melt + 2.2);
    C.glow(g, hx + 60, hy + 40, 180 * (1 - melt * 0.7), '#ffd27a', 0.8 * (1 - melt));
    if (melt > 0) { const r = rng(4); for (let i = 0; i < 14; i++) { const u = clamp(melt * 1.4 - r() * 0.4, 0, 1); g.fillStyle = `rgba(255,210,110,${0.9 * (1 - u)})`; g.beginPath(); g.ellipse(hx + 60 + (r() - 0.5) * 80, hy + 40 + u * 260, 6, 10, 0, 0, TAU); g.fill(); } }
    storyGrade(g, t);
  },
  laugh(g, t) {
    templeWall(g, t, {
      reveal: 0.75, zoom: 1.3, cx: 60, cy: -300,
      ganga: { pose: P.cheer(t * 9, { mouth: mouthFor('laugh', t, 'grin'), bob: 0 }), dir: 1 },
      ravi: { pose: P.stand({ ra: [1.9, 1.6], la: [0.3, 0.4], eyes: 'happy', mouth: 'grin' }), leaves: false },
    });
    g.fillStyle = `rgba(255,236,190,${1 - fade(t, 61.4, 0.4)})`; g.fillRect(0, 0, W, H);
    C.grade(g, t, { warm: 0.1, vignette: 0.45 });
  },
  lord(g, t) {
    const k = seg(t, 66, 70.8);
    setCam(lerp(-60, 60, k), lerp(-300, -340, k), lerp(0.85, 1.0, k));
    deccanSky(g, 0.25);
    layer(g, 0.2, () => Wd.sandstone(g, -1600, 60, 3200, 300, 81, { col: '#a07080' }));
    C.haze(g, 200, 600, '#ffd8b0', 0.4);
    layer(g, 0.7, () => { Wd.badamiCliff(g, 0, 20, 0.95); g.fillStyle = '#6aa0a8'; g.fillRect(-1600, 20, 3200, 120); g.fillStyle = 'rgba(255,230,190,0.35)'; for (let i = 0; i < 20; i++) g.fillRect(-1500 + i * 160 + Math.sin(t + i) * 10, 50 + (i % 4) * 20, 80, 3); });
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#c4a070', 57), 1); g.fillRect(-1600, 60, 3200, 700);
      // A stone platform; the king under a parasol; the crowd cheering.
      g.fillStyle = '#c9a47a'; g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.fillRect(-240, -40, 480, 100); g.strokeRect(-240, -40, 480, 100);
      g.fillRect(-280, 40, 560, 30); g.strokeRect(-280, 40, 560, 30);
      person(g, 0, -40, PULA, P.stand({ ra: [2.3, 0.2], la: [-0.2, 0.3], mouth: 'smile', eyes: 'open', look: [0.2, -0.2] }), 1, 1.55, t);
      g.strokeStyle = '#4a2e1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(-110, 60); g.lineTo(-110, -470); g.stroke();
      g.beginPath(); g.moveTo(-260, -470); g.quadraticCurveTo(-110, -560, 40, -470); g.closePath(); g.fillStyle = '#f0ead8'; g.fill(); g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.stroke();
      for (let i = 0; i < 12; i++) { const r = rng(i + 70), sx = (i < 6 ? -1400 : 380) + (i % 6) * 170, sd = i + 40; person(g, sx, 220 + (i % 2) * 40, { ...soldier(sd, 'south'), turban: r() < 0.5 ? '#b0302a' : null, hair: '#1c130d', bun: r() < 0.5 }, P.cheer(t * 7 + i, { bob: Math.abs(Math.sin(t * 7 + i)) * 10 }), i < 6 ? 1 : -1, 1.25, t); }
      Wd.banner(g, -600, 200, 360, '#b0302a', t, { boar: true, w: 140 }); Wd.banner(g, 640, 200, 360, '#b0302a', t, { boar: true, w: 140 });
      // Petals.
      const r = rng(9); for (let i = 0; i < 60; i++) { const u = (t * 0.25 + r()) % 1, px = -900 + r() * 1800 + Math.sin(t * 2 + i) * 40, py = -700 + u * 900; g.fillStyle = ['#ff8a3a', '#ffd23a', '#ffffff'][i % 3]; g.beginPath(); g.ellipse(px, py, 6, 3.5, t * 3 + i, 0, TAU); g.fill(); }
    });
    C.text(g, 'DAKSHINAPATHESHVARA', W / 2, 180, { size: 84, font: C.SERIF, weight: '700', col: '#ffe07a', a: win(t, B.capLord, 70.6, 0.5), shadow: 0.8, stroke: '#3a1a08', sw: 6, spacing: 4 });
    C.text(g, 'Lord of the South', W / 2, 250, { size: 44, font: C.SERIF, col: '#fff3dc', a: win(t, B.capLord + 0.4, 70.6, 0.5), shadow: 0.8 });
    storyGrade(g, t);
  },
  china(g, t) {
    const lt = t - 70.8, mx = lerp(-700, 150, lin(t, 70.8, B.write));
    setCam(mx + 220, -300, 1.1);
    deccanSky(g, 0.1);
    layer(g, 0.2, () => Wd.sandstone(g, -1800, 60, 3600, 280, 91, { col: '#a88070' }));
    C.haze(g, 200, 640, '#f0dcb4', 0.45);
    layer(g, 0.55, () => {
      // Chalukya soldiers drilling, war elephants in the distance.
      g.fillStyle = '#c4a070'; g.fillRect(-2000, 30, 4000, 300);
      for (let i = 0; i < 10; i++) { const r = person(g, -900 + i * 130, 120, soldier(i + 20, 'south'), P.stand({ ra: [1.6 + Math.sin(t * 4 + i) * 0.4, 0.1] }), 1, 0.9, t); Wd.spear(g, r.handF[0], r.handF[1], 150, 0.9 + Math.sin(t * 4 + i) * 0.35); }
      Wd.elephant(g, 700, 120, { s: 0.45, t, ph: t * 3, cloth: '#b0302a' }); Wd.elephant(g, 1100, 110, { s: 0.42, t, ph: t * 3 + 1, cloth: '#b0302a' });
    });
    layer(g, 1, () => {
      g.fillStyle = C.pattern(g, C.mudTile('#caa878', 58), 1); g.fillRect(cam.x - 1400, 0, 2800, 700);
      // Xuanzang: robes, a staff, his famous backpack frame of scrolls.
      const writing = t > B.write;
      const mp = writing ? P.stand({ la: [1.2, 1.1], ra: [1.1, 1.2], head: 0.3, eyes: 'look', look: [0.3, 0.9], mouth: 'smile' }) : P.walk(t * 6, { ra: [0.6, 0.6] });
      const m = person(g, mx, 20, MONK, mp, 1, 1.75, t);
      // Backpack frame with scrolls and a little canopy.
      const [bx, by] = [m.head[0] - 70, m.head[1] + 40];
      g.strokeStyle = '#6a4424'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by + 170); g.lineTo(bx, by - 120); g.moveTo(bx - 60, by + 170); g.lineTo(bx - 60, by - 120); g.stroke();
      for (let i = 0; i < 4; i++) { g.fillStyle = C.shade('#efe0bc', -i * 0.05); g.strokeStyle = '#2d1a10'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(bx - 70, by - 90 + i * 55, 80, 44, 10); g.fill(); g.stroke(); }
      g.beginPath(); g.moveTo(bx - 110, by - 120); g.quadraticCurveTo(bx - 30, by - 190, bx + 50, by - 120); g.closePath(); g.fillStyle = '#c9772a'; g.fill(); g.strokeStyle = '#2d1a10'; g.stroke();
      if (!writing) { g.strokeStyle = '#6a4424'; g.lineWidth = 6; g.beginPath(); g.moveTo(m.handF[0], m.handF[1] - 120); g.lineTo(m.handF[0] + 10, m.handF[1] + 120); g.stroke(); }
      else { g.save(); g.translate((m.handF[0] + m.handB[0]) / 2, (m.handF[1] + m.handB[1]) / 2); g.fillStyle = '#f4ead0'; g.strokeStyle = '#2d1a10'; g.lineWidth = 2.5; g.fillRect(-50, -34, 100, 68); g.strokeRect(-50, -34, 100, 68); g.fillStyle = '#2d1a10'; for (let i = 0; i < 5; i++) for (let j = 0; j < Math.min(6, Math.floor((t - B.write) * 6) - i * 6); j++) g.fillRect(34 - i * 16, -26 + j * 10, 8, 6); g.restore(); }
    });
    fact(g, 'Xuanzang visited the Chalukya kingdom around 641 CE', t, B.capChina, 3.0);
    storyGrade(g, t);
    void lt;
  },
  name(g, t) {
    const roll = t > B.eyeRoll && t < B.bothLaugh, laughing = t > B.bothLaugh;
    templeWall(g, t, {
      reveal: lerp(0.9, 1, seg(t, 77.4, 82.5)), zoom: 1.25, cx: 40, cy: -300,
      ganga: roll ? { pose: P.stand({ eyes: 'closed', mouth: mouthFor('guruji', t, 'flat'), head: -0.3, la: [-0.3, 0.3], ra: [0.3, 0.3] }) } : laughing ? { pose: P.cheer(t * 9, { bob: 0 }) } : {},
      ravi: laughing ? { pose: P.stand({ ra: [1.9, 1.6], la: [0.3, 0.4], eyes: 'happy', mouth: 'grin' }) } : { pose: P.stand({ ra: [2.0, 1.9], la: [1.2, 0.9], mouth: mouthFor('name', t, 'grin'), eyes: talking('name', t) ? 'happy' : 'open', head: -0.2, look: [0, -0.8] }), leaves: true },
    });
    C.grade(g, t, { warm: 0.1, vignette: 0.45 });
  },
  epi(g, t) {
    const k = seg(t, 84.2, 89.6);
    setCam(lerp(-80, 180, k), lerp(-260, -330, k), lerp(0.9, 1.35, k));
    C.sky(g, [[0, '#4a6aa8'], [0.5, '#e9a67a'], [0.8, '#ffd8a0']]);
    const [sx, sy] = toScreen(-700, -60, 0.05); C.sunDisc(g, sx, sy, 40, '#fff0c8', '#ff9a50');
    layer(g, 0.3, () => Wd.sandstone(g, -1800, 80, 3600, 300, 101, { col: '#9a7080' }));
    C.haze(g, 260, 680, '#ffd0a0', 0.4);
    layer(g, 1, () => {
      Wd.sandstone(g, -900, 300, 1800, 260, 102, { col: '#a8552f' });
      Wd.megutiTemple(g, 0, 60, 0.95, { col: '#b8966a' });
      g.fillStyle = 'rgba(40,20,10,0.25)'; g.fillRect(-2000, 300, 4000, 400);
    });
    C.birds(g, t, -300, 200, 50, -6, 7, 1, '#2a1f33', 7);
    C.grade(g, t, { warm: 0.14, vignette: 0.5, tint: '#ff9a50' });
    C.text(g, 'The Aihole inscription still stands on the Meguti temple, almost 1,400 years later.', W / 2, 150, { size: 44, col: '#fff3dc', a: win(t, B.cap1, B.endCard, 0.4), shadow: 0.9 });
    C.text(g, 'It is one of the oldest dated records to name the poet Kalidasa.', W / 2, 215, { size: 40, col: '#ffe0b0', a: win(t, B.cap2, B.endCard, 0.4), shadow: 0.9, weight: '400' });
    const card = seg(t, B.endCard, B.endCard + 0.6);
    if (card > 0) {
      g.fillStyle = `rgba(15,8,4,${0.72 * card})`; g.fillRect(0, 0, W, H);
      C.text(g, 'THE LORD OF THE SOUTH', W / 2, H / 2 - 10, { size: 96, font: C.SERIF, col: '#fff3dc', a: card, shadow: 0.8, spacing: 6 });
      C.text(g, 'Pulakeshin II (Immadi Pulakeshi)  ·  Chalukyas of Badami  ·  ruled c. 610–642 CE', W / 2, H / 2 + 70, { size: 34, col: '#e8d2b0', a: card, shadow: 0.8, weight: '400' });
    }
  },
};

let HARSHA_AT = [0, 0];
// The river standoff and the battle: Harsha's army on the left (north) bank, Pulakeshin's on the right.
function riverScene(g, t, { charge = 0, still = false } = {}) {
  const RX0 = -380, RX1 = 380, WY = 40;
  deccanSky(g, 0.12);
  layer(g, 0.12, () => { C.cloud(g, -500, -440, 900, 91, '#fff6e6', '#c9b8a8', 0.8); C.cloud(g, 700, -380, 800, 92, '#fff6e6', '#c9b8a8', 0.7); });
  layer(g, 0.3, () => { Wd.sandstone(g, -1800, 20, 1500, 240, 93, { col: '#b09090' }); Wd.sandstone(g, 300, 30, 1600, 280, 94, { col: '#b09090' }); });
  C.haze(g, 200, 700, '#f0dcb4', 0.45);
  layer(g, 1, () => {
    // Banks and the river between them, flowing toward the viewer.
    g.fillStyle = C.pattern(g, C.mudTile('#c9a878', 61), 1); g.fillRect(-3000, 0, 3000 + RX0, 900); g.fillRect(RX1, 0, 3000, 900);
    g.fillStyle = 'rgba(60,30,10,0.2)'; g.fillRect(-3000, 0, 6000, 16);
    const wq = g.createLinearGradient(0, WY, 0, 700); wq.addColorStop(0, '#7aaab0'); wq.addColorStop(1, '#3a6a74');
    g.fillStyle = '#9a7a54'; g.beginPath(); g.moveTo(RX0, 0); g.lineTo(RX0 + 60, 700); g.lineTo(RX0 - 80, 700); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(RX1, 0); g.lineTo(RX1 - 60, 700); g.lineTo(RX1 + 80, 700); g.closePath(); g.fill();
    g.fillStyle = wq; g.beginPath(); g.moveTo(RX0 + 10, WY); g.lineTo(RX1 - 10, WY); g.lineTo(RX1 - 60, 700); g.lineTo(RX0 + 60, 700); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 3;
    for (let i = 0; i < 22; i++) { const y = WY + ((i * 53 + t * 90) % 660), x = lerp(RX0 + 40, RX1 - 40, (i * 0.37) % 1); g.beginPath(); g.moveTo(x - 30, y); g.quadraticCurveTo(x, y + 6, x + 30, y); g.stroke(); }
    // Harsha's side (north): elephants, soldiers, green banners.
    // Harsha on his elephant, on the bank; three of his elephants charge into the river.
    const harsh = Wd.elephant(g, -700, 70, { s: 0.72, t, ph: 0, pose: 'stand', trunk: charge && t > B.falls[0] ? 0.5 : 0, cloth: '#2f6f5a', canopy: '#f0ead8' });
    const hp = person(g, harsh.seat[0], harsh.seat[1] + 42, HARSHA, sitPose({ mouth: t > B.harshaFace ? 'frown' : charge ? 'shout' : 'smile', eyes: t > B.harshaFace ? 'sad' : charge ? 'angry' : 'open', ra: charge && t < B.falls[0] ? [2.3, 0.2] : [1.0, 0.8], look: [0.9, 0] }), 1, 1.12, t);
    HARSHA_AT = hp.hip;
    const eKeys = [[-1350, 20, 0.6], [-1100, 120, 0.66], [-880, 30, 0.62]], dest = [-230, -40, 150];
    eKeys.forEach(([x0, y0, s], i) => {
      const fallT = B.falls[i];
      let x = x0, y = y0, pose = 'stand', trunk = 0, dir = 1, sink = 0;
      if (charge) {
        const go = seg(t, B.charge + i * 0.3, B.charge + 3.5 + i * 0.3);
        x = lerp(x0, dest[i], go); pose = go > 0 && go < 1 ? 'walk' : 'stand'; trunk = go > 0 ? 0.6 : 0;
        if (t > fallT) { pose = 'kneel'; trunk = 1; sink = seg(t, fallT, fallT + 0.6) * 50; }
        if (t > B.retreat + i * 0.4 && !still) { const back = seg(t, B.retreat + i * 0.4, B.retreat + 3 + i * 0.4); x = lerp(x, x0 - 300, back); dir = back > 0.02 ? -1 : 1; pose = back > 0 && back < 1 ? 'walk' : pose; sink *= 1 - back; trunk = 1; }
        if (still) { x = dest[i]; pose = 'kneel'; trunk = 1; sink = 50; }
      }
      const inRiver = x > RX0 - 40, wl = y + sink - 55;          // the water line on its legs
      if (inRiver) { g.save(); g.beginPath(); g.rect(-4000, -3000, 8000, 3000 + wl); g.clip(); }
      const e = Wd.elephant(g, x, y + sink, { s, t, ph: t * 7 + i, pose, trunk, dir, cloth: ['#6a2f6a', '#2f6f5a', '#f0ead8'][i] });
      person(g, e.seat[0], e.seat[1] + 40, soldier(i + 5, 'north'), sitPose({ ra: [2.2, 0.3], eyes: t > fallT ? 'wide' : 'open', mouth: t > fallT ? 'shout' : 'flat' }), dir, 0.95, t);
      if (inRiver) {
        g.restore();
        const w0 = x - 210 * s, w1 = x + 260 * s;
        g.fillStyle = 'rgba(95,155,165,0.9)'; g.beginPath(); g.ellipse((w0 + w1) / 2, wl + 8, (w1 - w0) / 2, 26, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(240,250,255,0.85)'; g.lineWidth = 4; g.beginPath(); g.ellipse((w0 + w1) / 2, wl, (w1 - w0) / 2 * (0.9 + Math.sin(t * 6 + i) * 0.05), 12, 0, Math.PI, TAU); g.stroke();
      }
      if (charge && t > B.charge + 1.8 + i * 0.3 && t < fallT + 1.2) for (let k = 0; k < 8; k++) { const r = rng(i * 20 + k), u = ((t * 1.6 + r()) % 1); g.fillStyle = `rgba(230,245,250,${0.8 * (1 - u)})`; g.beginPath(); g.arc(x + 100 * s + (r() - 0.5) * 200, wl - u * 160 + u * u * 160, 6 + r() * 6, 0, TAU); g.fill(); }
    });
    // The water over the legs of anything in it.
    g.fillStyle = 'rgba(90,150,160,0.55)'; g.beginPath(); g.moveTo(RX0 + 10, 160); g.lineTo(RX1 - 10, 160); g.lineTo(RX1 - 60, 700); g.lineTo(RX0 + 60, 700); g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) { const sx = -1100 + i * 150, s = soldier(i + 30, 'north'); const r = person(g, sx, 250 + (i % 2) * 30, s, charge && t > B.retreat ? P.run(t * 12 + i, { eyes: 'wide', mouth: 'o' }) : P.stand({ ra: [1.5, 0.2] }), charge && t > B.retreat ? -1 : 1, 1.2, t); Wd.spear(g, r.handF[0], r.handF[1], 200, 0.4); }
    Wd.banner(g, -1400, 200, 380, '#2f6f5a', t, { w: 140 }); Wd.banner(g, -780, 220, 360, '#f0ead8', t, { w: 130 });
    // Pulakeshin's side (south): drums, a shield wall, the king on a white horse.
    const drumHit = charge && t > B.drums && Math.sin((t - B.drums) * 14) > 0.7;
    for (let i = 0; i < 2; i++) { const dx = 1250 + i * 150; g.beginPath(); g.ellipse(dx, 200, 50, 24, 0, 0, TAU); g.fillStyle = '#8a5a34'; g.fill(); g.strokeStyle = '#2d1a10'; g.lineWidth = 3; g.stroke(); g.fillRect(dx - 50, 200, 100, 50); g.strokeRect(dx - 50, 200, 100, 50); person(g, dx + 20, 260, soldier(i + 50, 'south'), P.stand({ ra: [drumHit ? 1.3 : 1.9, 0.3], la: [drumHit ? 1.9 : 1.3, 0.3], mouth: 'grin' }), -1, 1.1, t); }
    const advance = charge ? seg(t, B.charge + 0.5, B.charge + 2.5) * 70 : 0;
    for (let i = 0; i < 8; i++) {
      const sx = 470 + i * 110 - advance + (i % 2) * 20, sy = 180 + (i % 2) * 50, s = soldier(i + 60, 'south');
      const cheer = charge && t > B.retreat + 0.6;
      const r = person(g, sx, sy, s, cheer ? P.cheer(t * 8 + i, { bob: 0 }) : P.stand({ ra: [2.0, 0.1], la: [1.3, 0.4], eyes: 'angry', mouth: 'teeth' }), -1, 1.2, t);
      Wd.spear(g, r.handF[0], r.handF[1], 220, cheer ? -0.2 : -0.9);
      if (!cheer) Wd.shield(g, r.handB[0] - 10, r.handB[1] - 10, 40, ['#8a3a2a', '#6a4424'][i % 2]);
    }
    Wd.banner(g, 1100, 200, 400, '#b0302a', t, { boar: true, w: 150 }); Wd.banner(g, 560, 130, 380, '#b0302a', t, { boar: true, w: 140 });
    const raise = seg(t, B.pushIn + 0.5, VO.nostep.t0) * (1 - seg(t, 38.5, 39.5));
    const saddle = Wd.horse(g, 480, 60, { s: 1.0, dir: -1, ph: t * 3, rear: raise * 0.4 });
    const k = person(g, saddle[0], saddle[1] + 46, PULA, sitPose({ ra: [lerp(0.8, 2.6, raise), 0.2], la: [1.0, 0.8], mouth: mouthFor('nostep', t, charge && t > B.retreat ? 'grin' : 'flat'), eyes: charge && t > B.retreat ? 'happy' : 'angry', look: [0.8, 0] }), -1, 1.05, t);
    Wd.sword(g, k.handF[0], k.handF[1], 110, lerp(-1.4, -0.2, raise));
  });
  if (charge && t > B.drums) { C.motes(g, t, 30, '#fff0d0', 0.3); }
  storyGrade(g, t);
}

const ORDER = B.scenes.map(([id]) => id), START = B.scenes.map(([, t]) => t);
const IMPACTS = [[B.drums, 5], [B.charge + 1, 6], ...B.falls.map((f) => [f, 9])];
function frame(t) {
  let i = 0; while (i + 1 < ORDER.length && t >= START[i + 1]) i++;
  C.setShake(C.shakeFrom(t, IMPACTS));
  g.save(); S[ORDER[i]](g, t); g.restore();
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  subtitle(g, t);
  const dips = [8.6, 26.4, 30.4, 66.0, 70.8, 77.4, 84.2];
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
