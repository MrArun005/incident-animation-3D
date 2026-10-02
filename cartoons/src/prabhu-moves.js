// Every dance step of the Prabhu Deva video as a function of the beat: pose = MOVES[name](beat).
// The iconic ones are named for the songs they come from (Mukkala Muqabla, Urvasi Urvasi); the rest are his
// vocabulary: rubber legs, the moonwalk, isolations. Shared by src/prabhu.js and the character sheet.
import { P } from './prabhu-char.js';
const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
export const blendPose = (a, b, u) => {
  const o = {}; for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u);
  return o;
};

export const MOVES = {
  groove: (b) => { const d = 0.5 + 0.5 * Math.cos(TAU * b), s = Math.sin(Math.PI * b);
    return P({ y: 0.018 * d, lean: 0.07 * s, head: -0.05 * s, x: 0.02 * s, la: [-0.35 - 0.35 * s, -1.1], ra: [0.35 - 0.35 * s, 1.1], ll: [-0.06 - 0.04 * s, 0.05 * d], rl: [0.06 - 0.04 * s, -0.05 * d] }); },
  rubber: (b) => { const k = Math.sin(TAU * b), f = Math.sin(2 * TAU * b);
    return P({ y: 0.025 * Math.abs(k), head: 0.06 * k, la: [-1.5 - 0.1 * k, -0.5 + 0.5 * f], ra: [1.5 - 0.1 * k, 0.5 - 0.5 * f], ll: [-0.05 + 0.24 * k, -0.48 * k], rl: [0.05 - 0.24 * k, 0.48 * k], lf: -1.35 + 0.4 * k, rf: 1.35 + 0.4 * k, hat: 0.08 * k }); },
  point: (b) => { const up = Math.floor(b) % 2 === 0, u = b % 1, hit = Math.exp(-u * 6);
    return P({ x: (up ? 0.03 : -0.03) * (1 - hit), lean: up ? 0.08 : -0.06, head: up ? -0.2 : 0.15,
      ra: up ? [2.55, -0.05] : [-0.55, -0.1], la: [-0.55, 2.0], ll: [-0.1, 0], rl: [0.1 + 0.1 * hit, -0.2 * hit], y: 0.01 * hit }); },
  kick: (b) => { const side = Math.floor(b) % 2, u = b % 1, k = Math.sin(Math.PI * u), m = side ? 1 : -1;
    const kickL = [m * 0.95 * k + (side ? 0.05 : -0.05), -m * 0.35 * k];
    return P({ y: -0.035 * k, lean: -0.08 * m * k, la: [-1.2 + 0.5 * m * k, -0.6], ra: [1.2 + 0.5 * m * k, 0.6], ll: side ? [-0.06, 0] : kickL, rl: side ? kickL : [0.06, 0], lf: side ? -1.35 : -1.35 - 0.6 * k, rf: side ? 1.35 + 0.6 * k : 1.35 }); },
  spin: (b) => { const u = clamp((b % 2) / 1.4, 0, 1), sp = Math.cos(Math.PI * 2 * ease(u)), out = Math.sin(Math.PI * u);
    return P({ sx: sp, y: -0.02 * out, la: [-0.45 - out * 0.9, 2.1 - out * 1.3], ra: [0.45 + out * 0.9, -2.1 + out * 1.3], ll: [-0.03, 0], rl: [0.12 * out, -0.5 * out], rf: 1.35 + out }); },
  hatTip: (b) => { const s = Math.sin(Math.PI * b), pop = Math.max(0, Math.sin(TAU * b));
    return P({ lean: 0.1 + 0.03 * s, head: -0.12, hat: -0.18, x: 0.02 * s, ra: [2.45, 1.45], la: [-0.4 - 0.2 * pop, -0.3], ll: [-0.06, 0], rl: [0.06 + 0.2 * pop, -0.45 * pop], rf: 1.35 + 0.5 * pop, y: 0.01 * pop }); },
  nataraja: (b) => { const br = Math.sin(TAU * b / 4), sw = Math.sin(TAU * b / 2);
    return P({ lean: -0.05 + 0.02 * br, head: 0.12, x: 0.01 * sw, rl: [0.04, 0], ll: [1.15 + 0.05 * sw, -1.75], lf: 0.4, rf: 1.4,
      ra: [1.35, 1.75 + 0.05 * br], la: [-1.45, 2.35 + 0.05 * br], y: 0.005 * br }); },
  glide: (b, dirn = 1) => { const k = Math.sin(TAU * b);
    return P({ lean: -0.06 * dirn, x: 0, head: 0.05 * dirn, la: [-0.5 - 0.3 * k, -0.6], ra: [0.5 - 0.3 * k, 0.6], ll: [-0.05 - 0.12 * Math.max(0, k), 0.5 * Math.max(0, k)], rl: [0.05 + 0.12 * Math.max(0, -k), -0.5 * Math.max(0, -k)], lf: -1.35 - 0.4 * Math.max(0, k), rf: 1.35 + 0.4 * Math.max(0, -k), y: 0.01 * Math.abs(k) }); },
  // the moonwalk: he faces left and glides right; the straight leg slides flat, the other knee bends with the heel up
  moonwalk: (b) => { const ph = (2 * b) % 2, sw = ease(clamp(ph < 1 ? ph : 2 - ph, 0, 1)), A = [[-0.22, 0.6], [0.06, 0]], legA = blendPose({ v: A[0] }, { v: A[1] }, sw).v, legB = blendPose({ v: A[1] }, { v: A[0] }, sw).v;
    return P({ lean: -0.07, head: -0.25, x: 0, la: [-0.25 + 0.15 * Math.sin(Math.PI * 2 * b), -0.4], ra: [0.35 - 0.15 * Math.sin(Math.PI * 2 * b), 0.5], ll: legA, rl: legB, lf: lerp(-0.9, -1.5, sw), rf: lerp(-1.5, -0.9, sw), y: 0.008 * Math.sin(Math.PI * 4 * b) }); },
  // Mukkala Muqabla: wrists crossed and swinging, knees knocking in and out, the head pecking on the off-beat
  mukkala: (b, inv = 0) => { const s = Math.sin(Math.PI * b), k = Math.sin(TAU * b), peck = Math.sin(TAU * b * 2) > 0.6 ? 0.025 : 0;
    return P({ inv, x: 0.03 * s + peck * 0.4, lean: -0.05 * s, head: 0.12 * s, hat: 0.1 * s, la: [-0.25 + 0.45 * s, 2.55], ra: [0.25 + 0.45 * s, -2.55], ll: [-0.05 + 0.2 * k, -0.42 * k], rl: [0.05 - 0.2 * k, 0.42 * k], lf: -1.35 + 0.5 * k, rf: 1.35 + 0.5 * k, y: 0.02 * Math.abs(k) }); },
  mukkalaInv: (b) => MOVES.mukkala(b, 1),
  // the comedy one: a hand round the back for a good scratch, the other hand scratching his head, a knee pop
  scratch: (b) => { const sc = Math.sin(TAU * b * 6) * 0.12, pop = Math.max(0, Math.sin(Math.PI * b));
    return P({ lean: 0.1, head: 0.25, sx: 0.82, x: -0.02 * pop, ra: [0.75, -2.25 + sc], la: [-2.6, -1.9 + sc * 0.6], ll: [-0.06, 0], rl: [0.08 + 0.18 * pop, -0.4 * pop], rf: 1.35 + 0.5 * pop, y: 0.01 * pop }); },
  shrug: (b) => { const u = Math.sin(Math.PI * clamp(b % 1.5 / 1.5, 0, 1));
    return P({ head: 0.18 * u, y: -0.012 * u, la: [-0.95 - 0.2 * u, -1.25], ra: [0.95 + 0.2 * u, 1.25], ll: [-0.08, 0], rl: [0.08, 0] }); },
  robot: (b) => { const POS = [[[-1.57, 0], [1.57, 1.57]], [[-1.57, -1.57], [1.57, 0]], [[-0.2, -1.57], [0.2, 1.57]], [[-1.57, -1.57], [0.2, 0]]];
    const i = Math.floor(b * 2) % 4, j = (i + 3) % 4, u = clamp((b * 2 % 1) / 0.25, 0, 1), cur = blendPose({ a: POS[j] }, { a: POS[i] }, u).a;
    return P({ la: cur[0], ra: cur[1], head: [0, 0.3, 0, -0.3][i] * u, ll: [-0.08, 0], rl: [0.08, 0], y: 0.01 * (1 - u) }); },
  thumka: (b) => { const h = Math.sin(TAU * b), j = Math.sin(TAU * b * 2);
    return P({ x: 0.04 * h, lean: -0.1 * h, head: 0.1 * h, la: [-2.7, -1.6], ra: [0.55, 1.9], ll: [-0.05 - 0.03 * h, 0.05 * j], rl: [0.05 - 0.03 * h, -0.05 * j], y: 0.01 * Math.abs(j) }); },
  bhangra: (b) => { const side = Math.floor(b) % 2, u = b % 1, lift = Math.sin(Math.PI * u), pump = Math.abs(Math.sin(TAU * b));
    const up = [side ? -0.6 * lift - 0.05 : -0.05, side ? 1.3 * lift : 0], up2 = [side ? 0.05 : 0.6 * lift + 0.05, side ? 0 : -1.3 * lift];
    return P({ y: -0.02 * lift, head: -0.1, la: [-2.55 - 0.15 * pump, -0.3], ra: [2.55 + 0.15 * pump, 0.3], ll: up, rl: up2, lf: -1.35 - 0.4 * lift * side, rf: 1.35 + 0.4 * lift * (1 - side) }); },
  wave: (b) => { const f = TAU * b;
    return P({ head: 0.1 * Math.sin(f), la: [-1.57 + 0.3 * Math.sin(f), 0.6 * Math.sin(f - 1.2)], ra: [1.57 + 0.3 * Math.sin(f - 2.4), 0.6 * Math.sin(f - 3.6)], ll: [-0.08, 0.05 * Math.sin(f)], rl: [0.08, -0.05 * Math.sin(f)], y: 0.01 * (1 + Math.cos(f)) }); },
  toe: (b) => { const up = seg(b % 3, 0.2, 0.6) * (1 - seg(b % 3, 2.2, 2.7));
    return P({ y: -0.06 * up, lf: lerp(-1.35, -0.25, up), rf: lerp(1.35, 0.25, up), ll: [-0.03, 0], rl: [0.03, 0], la: [-0.25, -0.2], ra: [0.25, 0.2], head: -0.2 * up, hat: -0.1 * up, lean: 0.02 }); },
  lean: (b) => { const u = seg(b % 3, 0.3, 1.0) * (1 - seg(b % 3, 2.3, 2.9));
    return P({ lean: 0.32 * u, head: -0.2 * u, la: [-0.15 + 0.2 * u, -0.1], ra: [0.15 + 0.3 * u, 0.1], ll: [-0.04, 0], rl: [0.04, 0], x: 0.01 * u }); },
  // Urvasi Urvasi: the "take it easy" hand, palm patting the air down and out, the hips swaying with it
  urvasiEasy: (b) => { const s = Math.sin(Math.PI * b), pat = Math.max(0, Math.sin(TAU * b)), side = Math.floor(b) % 2 ? 1 : -1;
    return P({ x: 0.035 * s, lean: -0.08 * s, head: 0.15 * s, face: 2 * (pat > 0.9 ? 1 : 0),
      ra: side > 0 ? [1.2 + 0.2 * pat, 0.5 - 0.3 * pat] : [0.3, 0.15], la: side < 0 ? [-1.2 - 0.2 * pat, -0.5 + 0.3 * pat] : [-0.3, -0.15],
      ll: [-0.06 - 0.04 * s, 0.08 * pat], rl: [0.06 - 0.04 * s, -0.08 * pat], y: 0.012 * pat }); },
  // Urvasi's shoulder isolations: one shoulder pops up on each beat, the head slides the other way
  shoulders: (b) => { const u = b % 1, side = Math.floor(b) % 2, pop = Math.exp(-u * 7) * 0.035;
    return P({ shL: side ? pop : 0, shR: side ? 0 : pop, headX: (side ? -1 : 1) * 0.012 * Math.exp(-u * 5), la: [-0.35, -0.9], ra: [0.35, 0.9], ll: [-0.07, 0], rl: [0.07, 0], y: 0.006 * (1 - u) }); },
  // rapid foot taps: the feet flicking out and back on every half beat, the arms loose
  taps: (b) => { const h = (b * 2) % 1, side = Math.floor(b * 2) % 2, t = Math.sin(Math.PI * h);
    return P({ y: -0.01 * t, head: 0.05 * (side ? 1 : -1), la: [-0.6 + 0.2 * t, -1.0], ra: [0.6 - 0.2 * t, 1.0],
      ll: side ? [-0.06 - 0.35 * t, 0.3 * t] : [-0.06, 0], rl: side ? [0.06, 0] : [0.06 + 0.35 * t, -0.3 * t], lf: side ? -1.35 - 0.7 * t : -1.35, rf: side ? 1.35 : 1.35 + 0.7 * t }); },
  // the neck slide: hands framing the face, the head gliding side to side (the Bharatanatyam attami)
  neck: (b) => { const s = Math.sin(TAU * b / 2);
    return P({ headX: 0.02 * s, face: 1, la: [-2.2, 2.3], ra: [2.2, -2.3], ll: [-0.12, 0.25], rl: [0.12, -0.25], lf: -1.5, rf: 1.5, y: 0.03 }); },
  final: (b) => P({ lean: 0.05, head: -0.15, ra: [2.75, 0.05], la: [-0.7, -0.4], ll: [-0.12, 0], rl: [0.16, -0.3], rf: 1.6, hat: -0.1 }),
};
