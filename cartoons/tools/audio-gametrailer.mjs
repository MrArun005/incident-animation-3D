// Soundtrack for the "Clawd vs The Bugs" trailer: 128 BPM, A minor, 24 bars, cut to the same bar
// lines as the picture (src/gametrailer.js). A tense build, an impact on the title, a driving groove
// under the gameplay, a darker boss section with a snare roll into the kill, a rush, and a bright
// resolve. The game's own sound events (from the recorded clips) sit quietly under the footage.
//   node tools/audio-gametrailer.mjs -> out/cartoon-gametrailer.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studio } from './lib/studio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DUR = 45, BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
const st = studio(DUR);
const { SR, TAU, MUS, FX, DR, put, S, nz, n2, LP, BP, lpa, hz } = st;
const clip = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'gameplay', n, 'clip.json'), 'utf8'));
const SC = { hook: 0, title: BAR * 2, play: BAR * 4, power: BAR * 8, boss: BAR * 12, rush: BAR * 17, cta: BAR * 20 };
const BOSS = clip('boss'); let bossDeath = BOSS.frames - 1; for (let i = 1; i < BOSS.meta.length; i++) if (BOSS.meta[i - 1].boss && !BOSS.meta[i].boss) { bossDeath = i; break; }
const BOSS_HIT = SC.boss + 6.6 * BEAT, BOSS_RATE = Math.min(2.6, Math.max(0.7, bossDeath / 30 / (BOSS_HIT - (SC.boss + 0.4))));

// ---- voices --------------------------------------------------------------------------------------------------
function sq(t0, m, d, g = 0.05, duty = 0.5, pan = 0.5, buf = MUS, slide = 0) {
  const s = S(t0), n = S(d), f0 = hz(m); let ph = 0;
  for (let j = 0; j < n; j++) { const u = j / n, e = Math.min(1, j / 50) * (1 - u) ** 0.7; ph = (ph + f0 * (1 + slide * u) / SR) % 1; const v = (ph < duty ? 1 : -1) * g * e; put(buf, s + j, v * (1 - pan) * 2, v * pan * 2); }
}
function saw(t0, m, d, g = 0.08, fc = 900, pan = 0.5) {
  const s = S(t0), n = S(d), f0 = hz(m), lp = new LP(); let ph = 0;
  for (let j = 0; j < n; j++) { const u = j / n, e = Math.min(1, j / 80) * Math.min(1, (1 - u) * 6); ph = (ph + f0 / SR) % 1; const v = lp.run(ph * 2 - 1, lpa(fc * (1.6 - u))) * g * e; put(MUS, s + j, v * (1 - pan) * 2, v * pan * 2); }
}
function sub(t0, m, d, g = 0.2) { const s = S(t0), n = S(d), f = hz(m); for (let j = 0; j < n; j++) { const u = j / n; put(MUS, s + j, Math.sin(TAU * f * j / SR) * g * Math.min(1, j / 40) * (1 - u) ** 0.8); } }
function noiseHit(t0, d, g, fc, buf = DR, pan = 0.5) { const s = S(t0), n = S(d), lp = new LP(); for (let j = 0; j < n; j++) { const u = j / n, v = lp.run(n2(), lpa(fc)) * g * (1 - u) ** 2.2; put(buf, s + j, v * (1 - pan) * 2, v * pan * 2); } }
const kick = (t, g = 0.27) => { st.sweep(t, 165, 42, 0.14, g); sub(t, 33, 0.22, g * 0.7); };
const clap = (t, g = 0.2) => { for (let k = 0; k < 3; k++) noiseHit(t + k * 0.011, 0.11, g * (k === 2 ? 1 : 0.6), 3400); };
const hat = (t, g = 0.05, open = false) => noiseHit(t, open ? 0.13 : 0.03, g, 9500, DR, 0.6);
function riser(t0, d, g = 0.08, f0 = 300, f1 = 9000) { const s = S(t0), n = S(d), bp = new BP(f0, 1.2); for (let j = 0; j < n; j++) { const u = j / n; if (j % 32 === 0) bp.set(f0 * (f1 / f0) ** u, 1.2); put(FX, s + j, bp.run(n2()) * g * u ** 1.6 * 2); } }
function impact(t, g = 1) { for (let k = 0; k < 3; k++) sub(t, 28 - k * 3, 1.4, 0.32 * g); noiseHit(t, 1.6, 0.42 * g, 3000, FX); noiseHit(t, 0.4, 0.4 * g, 9000, FX); kick(t, 0.32 * g); }
function pad(t0, t1, notes, g = 0.03, fc = 900) { const s0 = S(t0), s1 = S(t1), ph = notes.map(() => [0, 0]), f = [new LP(), new LP()]; for (let i = s0; i < s1 && i < st.N; i++) { const t = (i - s0) / SR, e = Math.min(1, t / 0.5, (t1 - t0 - t) / 0.5); let l = 0, r = 0; notes.forEach((m, j) => { const fr = hz(m); ph[j][0] = (ph[j][0] + fr * 0.996 / SR) % 1; ph[j][1] = (ph[j][1] + fr * 1.004 / SR) % 1; l += ph[j][0] * 2 - 1; r += ph[j][1] * 2 - 1; }); put(MUS, i, f[0].run(l, lpa(fc)) * g * e / notes.length * 2.4, f[1].run(r, lpa(fc)) * g * e / notes.length * 2.4); } }

// ---- harmony: Am F C G, one chord per bar -----------------------------------------------------------------------------
const PROG = [{ b: 33, ch: [57, 60, 64, 69] }, { b: 29, ch: [53, 57, 60, 65] }, { b: 36, ch: [55, 60, 64, 67] }, { b: 31, ch: [55, 59, 62, 67] }];
const chordOf = (bar) => PROG[bar % 4];

// ---- hook (bars 0-1): a bug infestation and a rising tension ----------------------------------------------------------
sub(0.2, 33, BAR * 2 - 0.4, 0.09); pad(0.3, SC.title, [45, 52, 57], 0.035, 500);
for (let t = 0.6; t < SC.title - 0.4; t += 0.19 + nz() * 0.1) sq(t, 84 + Math.floor(nz() * 14), 0.03, 0.02, 0.125, nz(), FX);
for (let k = 0; k < 9; k++) st.tone(2.4 + k * 0.1, 900 + k * 130, 0.06, 0.03, nz());
riser(SC.title - BAR, BAR, 0.11, 300, 9500); st.sweep(SC.title - BAR, 120, 900, BAR, 0.05);
for (let k = 0; k < 6; k++) noiseHit(SC.title - 0.9 + k * 0.15, 0.06, 0.1, 6000, FX);      // glitch stutter
// ---- title (bars 2-3): impact, Clawd fires, the word slams ---------------------------------------------------------
impact(SC.title, 1);
for (let b = 2; b < 4; b++) { const t0 = b * BAR, c = chordOf(b - 2); pad(t0, t0 + BAR, c.ch, 0.03, 1100); for (let k = 0; k < 8; k++) saw(t0 + k * BEAT / 2, c.b + 12, BEAT / 2 * 0.8, 0.07, 600); hat(t0 + BEAT * 1.5); hat(t0 + BEAT * 3.5); }
const FIRE = SC.title + BEAT * 3;
st.sweep(FIRE, 1800, 500, 0.3, 0.08); sq(FIRE, 96, 0.12, 0.05, 0.25, 0.5, FX, -0.5);
impact(FIRE + 0.25, 1.15); kick(FIRE + 0.25, 0.3);
[[1.05, 76], [1.4, 79], [1.75, 83]].forEach(([d, m]) => sq(FIRE + d, m, 0.16, 0.05, 0.25, 0.5, FX));
riser(SC.play - BEAT * 2, BEAT * 2, 0.09, 500, 10000);

// ---- the groove (bars 4-24) --------------------------------------------------------------------------------------------------------
const sect = (bar) => (bar < 8 ? 'play' : bar < 12 ? 'power' : bar < 17 ? 'boss' : bar < 20 ? 'rush' : 'cta');
for (let bar = 4; bar < 24; bar++) {
  const t0 = bar * BAR, c = chordOf(bar), s = sect(bar), heavy = s === 'boss', last = bar === 23;
  if (bar === SC.play / BAR || bar === SC.power / BAR || bar === SC.boss / BAR || bar === SC.rush / BAR || bar === SC.cta / BAR) impact(t0, bar === SC.cta / BAR ? 0.7 : 0.85);
  // drums
  if (s !== 'cta' || bar < 23) for (let k = 0; k < 4; k++) kick(t0 + k * BEAT, heavy ? 0.3 : 0.26);
  clap(t0 + BEAT, heavy ? 0.24 : 0.18); clap(t0 + BEAT * 3, heavy ? 0.24 : 0.18);
  for (let k = 0; k < 8; k++) hat(t0 + k * BEAT / 2 + BEAT / 4, 0.05 + (k % 2 ? 0.02 : 0), k === 7);
  if (heavy || s === 'rush') for (let k = 0; k < 16; k++) hat(t0 + k * BEAT / 4, 0.035);
  // bass: off-beat 8ths (a sawtooth with a filter that opens on the rush)
  for (let k = 0; k < 8; k++) { const t = t0 + k * BEAT / 2 + (k % 2 ? 0 : 0); saw(t, c.b + (heavy && k % 4 === 3 ? 12 : 0) + (k === 7 ? 7 : 0), BEAT / 2 * 0.85, heavy ? 0.13 : 0.1, heavy ? 1500 : 800); }
  sub(t0, c.b, BEAT * 3.6, 0.14);
  // arpeggio: 16ths, more insistent in later sections
  const arpOn = bar >= 6 && !(last);
  if (arpOn) for (let k = 0; k < 16; k++) { const m = c.ch[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]] + 12; sq(t0 + k * BEAT / 4, m, BEAT / 4 * 0.75, s === 'rush' ? 0.032 : 0.024, 0.25, 0.3 + (k % 4) * 0.13); }
  pad(t0, t0 + BAR, c.ch, s === 'cta' ? 0.045 : 0.028, s === 'rush' ? 2200 : 1100);
  // melodic hook every other bar from the play section on
  if (bar >= 8 && s !== 'boss' && bar % 2 === 0 || s === 'cta') { const mel = { 0: [81, 0, 79, 0, 76, 0, 74, 76], 1: [77, 0, 76, 0, 72, 0, 69, 72] }[bar % 2 ? 1 : 0]; mel.forEach((m, k) => { if (m) sq(t0 + k * BEAT / 2, m + (bar % 4 >= 2 ? -2 : 0), BEAT / 2 * 0.9, 0.04, 0.5, 0.65); }); }
}
// section fills and risers
for (const b of [7, 11, 16, 19]) { const t0 = b * BAR; riser(t0 + BAR - BEAT * 2, BEAT * 2, 0.08, 400, 9500); for (let k = 0; k < 8; k++) clap(t0 + BAR - BEAT * 2 + k * BEAT / 4, 0.05 + k * 0.02); }
// boss: a dark pedal under the fight, a snare roll into the kill, then a bright stab
for (let k = 0; k < 24; k++) { const t = BOSS_HIT - BEAT * 3 + k * BEAT / 8; if (t < BOSS_HIT) clap(t, 0.05 + k * 0.012); }
st.sweep(BOSS_HIT - 0.5, 900, 80, 0.5, 0.08);
impact(BOSS_HIT, 1.25);
[0, 4, 7, 12].forEach((d, i) => sq(BOSS_HIT + 0.05 + i * 0.07, 69 + d + 12, 0.35, 0.05, 0.25, 0.5, FX));
st.beadSpill(BOSS_HIT + 0.15, 1.4, 0.05); st.shimmer(BOSS_HIT + 0.3, 0.05, 84);
// power-up pickups get a little jingle in the power section, on the tile pops
for (let i = 0; i < 4; i++) { const t = SC.power + BEAT * (1.4 + i) + 0.05; [72, 76, 79, 84].forEach((m, k) => sq(t + k * 0.05, m + i, 0.09, 0.035, 0.25, 0.3 + i * 0.13, FX)); st.whoosh(t - 0.15, 0.25, 0.04, 500, 3000); }
// text slams: a tick and whoosh with each kinetic word
[SC.play + 0.5, SC.play + BEAT * 2 + 0.05, SC.play + BEAT * 3 + 0.05, SC.play + BEAT * 5].forEach((t) => { st.whoosh(t - 0.12, 0.3, 0.05, 400, 3400); st.thud(t + 0.1, 0.12); });
for (let i = 0; i < 4; i++) { const t = SC.rush + i * BEAT * 3 - 0.02; st.whoosh(t - 0.05, 0.25, 0.06, 300, 4000); st.thud(t + 0.08, 0.2); }
[0.35, 1.0, 1.15].forEach((d) => st.whoosh(d - 0.1, 0.3, 0.05, 400, 3000));
[SC.cta + 0.3, SC.cta + 0.55, SC.cta + BEAT * 3].forEach((t) => { st.whoosh(t - 0.1, 0.3, 0.05, 400, 3000); st.thud(t + 0.1, 0.12); });
// the ending chord, then quiet
pad(SC.cta + BAR * 3, DUR, [45, 52, 57, 60, 64, 69], 0.06, 1500); st.shimmer(SC.cta + BAR * 3, 0.05, 81); sub(SC.cta + BAR * 3, 33, 4, 0.16);

// ---- the game's own sounds, quietly under the footage ---------------------------------------------------------------------------
function gameSfx(clipName, mapT, tmax) {
  const c = clip(clipName); let n = 0;
  for (const [f, k] of c.events) {
    const t = mapT(f / 30); if (t == null || t < 0 || t > tmax) continue;
    if (k === 'shoot') { if (n++ % 3 === 0) sq(t, 88 - (n % 5), 0.04, 0.008, 0.5, 0.5, FX, -0.5); }
    else if (k === 'boom') { noiseHit(t, 0.16, 0.06, 2200, FX); sq(t, 50, 0.1, 0.03, 0.5, 0.5, FX, -0.6); }
    else if (k === 'pick') [72, 79, 84].forEach((m, i) => sq(t + i * 0.05, m, 0.06, 0.03, 0.25, 0.5, FX));
    else if (k === 'hurt') { st.sweep(t, 500, 80, 0.3, 0.05); }
  }
}
gameSfx('mid', (s) => SC.play + (s - 0.5), SC.power);
gameSfx('power', (s) => SC.power + s, SC.boss);
gameSfx('boss', (s) => SC.boss + 0.4 + s / BOSS_RATE, SC.rush);
gameSfx('rush', (s) => SC.rush + s, SC.cta);

// Silent "voice" track: the mix wants one, this film has none.
const vo = Buffer.alloc(44 + 2 * 8000 * DUR);
vo.write('RIFF', 0); vo.writeUInt32LE(vo.length - 8, 4); vo.write('WAVE', 8); vo.write('fmt ', 12); vo.writeUInt32LE(16, 16); vo.writeUInt16LE(1, 20); vo.writeUInt16LE(1, 22); vo.writeUInt32LE(8000, 24); vo.writeUInt32LE(16000, 28); vo.writeUInt16LE(2, 32); vo.writeUInt16LE(16, 34); vo.write('data', 36); vo.writeUInt32LE(vo.length - 44, 40);
fs.writeFileSync(path.join(ROOT, 'out', 'gametrailer-silence.wav'), vo);
const { peak, clip: cl } = st.mixdown(path.join(ROOT, 'out', 'gametrailer-silence.wav'), path.join(ROOT, 'out', 'cartoon-gametrailer.wav'), { musRev: 0.2, drRev: 0.08 });
console.log(`wrote out/cartoon-gametrailer.wav, ${DUR}s, peak ${peak.toFixed(2)}, ${cl} samples > 0.95, BOSS_RATE ${BOSS_RATE.toFixed(2)}`);
// Trim the master: the mix above is written hot, and a trailer should still sit with the other films.
{ const f = path.join(ROOT, 'out', 'cartoon-gametrailer.wav'), b = fs.readFileSync(f); for (let o = 44; o + 1 < b.length; o += 2) b.writeInt16LE(Math.round(b.readInt16LE(o) * 0.6), o); fs.writeFileSync(f, b); }
