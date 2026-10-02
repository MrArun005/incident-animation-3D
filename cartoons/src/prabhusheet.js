// Character sheet for the Prabhu Deva tribute: the model in three outfits, his expressions, and the step
// library as key poses. One still (t ignored). Rendered with tools/render-gl.mjs --story prabhusheet --stills 0
import { drawPrabhu, drawHead, OUTFITS, P } from './prabhu-char.js';
import { MOVES } from './prabhu-moves.js';

const W = 2400, H = 1500, FPS = 30;
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');
const SANS = '"Liberation Sans", Arial, sans-serif', SERIF = '"Liberation Serif", serif', MONO = '"DejaVu Sans Mono", monospace';
const text = (s, x, y, font, col, align = 'left') => { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); };

function frame() {
  g.fillStyle = '#efe9dd'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,60,40,0.08)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  text('PRABHU DEVA', 60, 90, `bold 64px ${SERIF}`, '#2a2118'); text('character sheet · cartoon tribute model · v1', 62, 128, `italic 28px ${SERIF}`, '#7a6c58');
  // height ruler: eight heads
  const fh = 900, floor = 1080, x0 = 330;
  g.strokeStyle = '#b8ab95'; g.lineWidth = 1.5; for (let k = 0; k <= 8; k++) { const y = floor - k * fh / 8; g.beginPath(); g.moveTo(90, y); g.lineTo(560, y); g.stroke(); text(String(k), 70, y + 6, `18px ${MONO}`, '#9a8d78', 'right'); }
  text('8 heads tall, long limbs', 90, floor + 40, `20px ${SANS}`, '#7a6c58');
  drawPrabhu(g, P({}), OUTFITS.film94, x0, floor, fh, { lineW: 0.0035 });
  text('MAIN · 1994 film look', 200, floor + 75, `bold 24px ${SANS}`, '#2a2118');
  // the three outfits
  const outs = [['film94', 'cap'], ['bus94', 'bandana'], ['now', 'capBack']];
  outs.forEach(([k], i) => { const x = 760 + i * 290; drawPrabhu(g, MOVES.groove(0.5 + i * 0.3), OUTFITS[k], x, 760, 560, { lineW: 0.004 }); text(OUTFITS[k].name, x, 800, `bold 22px ${SANS}`, '#2a2118', 'center'); });
  text('OUTFITS', 640, 190, `bold 22px ${SANS}`, '#9a6b2f');
  // expressions
  text('EXPRESSIONS', 1500, 190, `bold 22px ${SANS}`, '#9a6b2f');
  [['grin', 0], ['focus', 1], ['wink', 2], ['oh!', 3]].forEach(([n, f], i) => {
    g.save(); g.translate(1580 + i * 210, 360); g.scale(1600, 1600); drawHead(g, [0, 0], 0, OUTFITS.film94, f, i === 3 ? 'none' : 'none', 0, 0.002, OUTFITS.film94.line); g.restore();
    text(n, 1580 + i * 210, 500, `20px ${SANS}`, '#5a4c3a', 'center'); });
  // a hat row
  [['cap', 'film94'], ['capBack', 'now'], ['bandana', 'bus94'], ['fedora', 'film94'], ['turban', 'film94']].forEach(([h, o], i) => {
    g.save(); g.translate(1560 + i * 165, 640); g.scale(1150, 1150); drawHead(g, [0, 0], 0, { ...OUTFITS[o], hatCol: h === 'fedora' ? '#1d1d24' : h === 'turban' ? '#e9dfc6' : OUTFITS[o].hatCol }, 0, h, 0, 0.0025, OUTFITS[o].line); g.restore();
    text(h, 1560 + i * 165, 760, `18px ${SANS}`, '#5a4c3a', 'center'); });
  // the step library
  text('STEP LIBRARY', 60, 1180, `bold 22px ${SANS}`, '#9a6b2f');
  const steps = [['mukkala', 0.5, 'Mukkala hook'], ['mukkalaInv', 0.5, 'invisible man'], ['urvasiEasy', 0.25, 'Urvasi "take it easy"'], ['shoulders', 0.05, 'shoulder pops'], ['taps', 0.25, 'foot taps'],
    ['rubber', 0.25, 'rubber legs'], ['moonwalk', 0.3, 'moonwalk'], ['neck', 0.5, 'neck slide'], ['scratch', 0.3, 'the scratch'], ['robot', 0.3, 'robot'], ['thumka', 0.25, 'thumka'], ['bhangra', 1.5, 'bhangra'],
    ['toe', 1.0, 'toe stand'], ['lean', 1.5, 'the lean'], ['nataraja', 0, 'Nataraja'], ['kick', 0.5, 'side kick']];
  steps.forEach(([m, b, name], i) => { const x = 110 + i * 142, fl = 1440; drawPrabhu(g, MOVES[m](b), OUTFITS.film94, x, fl - 40, 200, { lineW: 0.006 }); text(name, x, fl, `15px ${SANS}`, '#2a2118', 'center'); });
}
window.DURATION = 1; window.FPS = FPS;
window.renderFrame = () => frame();
frame();
window.ready = true;
