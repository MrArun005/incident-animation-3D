// One-file player for "The World in 2076": three.js, the scene, both textures and the score inlined.
// The picture follows the audio clock, so it stays in sync on any frame rate.
//   node tools/build-world2076-html.mjs -> web/world2076.html   (needs out/world2076-audio.mp3)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p));
const uri = (p, type) => `data:${type};base64,${rd(p).toString('base64')}`;
let scene = rd('src/world2076.js').toString();
scene = scene.replace(/^await new Promise\(\(res, rej\) => \{ const s = document\.createElement\('script'\); s\.src = 'vendor\/three-r147\.js'.*$/m, '');
scene = scene.replace(/^export /gm, '');
scene = scene.replace('texL.load(`assets/comingup/${f}`', 'texL.load(TEX[f]');
scene = scene.replace(/^if \(!new URLSearchParams\(location\.search\)\.has\('render'\)\).*$/m, '');
const tex = `const TEX = { 'sky-2k.jpg': '${uri('assets/comingup/sky-2k.jpg', 'image/jpeg')}', 'planet-earth.jpg': '${uri('assets/comingup/planet-earth.jpg', 'image/jpeg')}' };\n`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The World in 2076</title>
<style>
html,body{margin:0;height:100%;background:#000;color:#fff;font-family:system-ui,sans-serif;overflow:hidden}
#c{position:absolute;inset:0;margin:auto;max-width:100vw;max-height:100vh;width:100vw;height:56.25vw;display:block}
#go{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:rgba(0,0,0,.6);cursor:pointer;z-index:2}
#go b{font-size:clamp(28px,6vw,64px);letter-spacing:.3em}#go span{opacity:.75;letter-spacing:.2em;font-size:14px}
#bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:12px;align-items:center;padding:10px 16px;background:linear-gradient(transparent,rgba(0,0,0,.7));opacity:0;transition:opacity .3s;z-index:1}
body:hover #bar,#bar.on{opacity:1}
#bar button{background:none;border:1px solid #fff6;color:#fff;border-radius:6px;padding:6px 12px;font-size:15px;cursor:pointer}
#bar input{flex:1}#t{font-variant-numeric:tabular-nums;font-size:13px;opacity:.8}
</style></head><body>
<canvas id="c" width="1920" height="1080"></canvas>
<div id="go"><b>2076</b><span>TAP TO PLAY · SOUND ON</span></div>
<div id="bar"><button id="pp">❚❚</button><input id="sk" type="range" min="0" max="25" step="0.01" value="0"><span id="t">0.0</span><button id="fs">⛶</button></div>
<script>window.AUDIO_B64 = '${rd('out/world2076-audio.mp3').toString('base64')}';</script>
<script>${rd('vendor/three-r147.js')}</script>
<script type="module">
${tex}${scene}
const go = document.getElementById('go'), pp = document.getElementById('pp'), sk = document.getElementById('sk'), tt = document.getElementById('t'), cv = document.getElementById('c');
const fit = () => { const k = Math.min(innerWidth / 1920, innerHeight / 1080); cv.style.width = 1920 * k + 'px'; cv.style.height = 1080 * k + 'px'; }; addEventListener('resize', fit); fit();
// The picture runs on its own clock; the score (Web Audio, decoded from inline bytes, so no media fetch is
// needed) follows it. If audio cannot start, the film still plays silently.
let ctx = null, buf = null, src = null, playing = false, base = 0, at = 0, drag = false;
const now = () => (playing ? base + (performance.now() - at) / 1000 : base);
async function initAudio() {
  if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bin = atob(window.AUDIO_B64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    buf = await ctx.decodeAudioData(u8.buffer); } catch (e) { console.warn('audio unavailable', e); }
}
function startAudio(t) { if (!ctx || !buf) return; try { stopAudio(); if (ctx.state === 'suspended') ctx.resume(); src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(0, Math.max(0, t)); } catch (e) {} }
function stopAudio() { if (src) { try { src.stop(); } catch (e) {} src = null; } }
function play(t = now()) { base = t; at = performance.now(); playing = true; startAudio(t); pp.textContent = '❚❚'; }
function pause() { base = now(); playing = false; stopAudio(); pp.textContent = '▶'; }
frame(1.6);
const loop = () => { let t = now();
  if (playing && t >= DURATION) { pause(); base = 0; t = 0; go.style.display = 'flex'; go.querySelector('span').textContent = 'TAP TO REPLAY'; }
  if (playing || drag) frame(Math.min(t, DURATION - 0.001)); if (!drag) sk.value = t; tt.textContent = t.toFixed(1) + ' / 25'; requestAnimationFrame(loop); }; loop();
go.onclick = async () => { go.style.display = 'none'; const c = initAudio(); if (ctx && ctx.state === 'suspended') ctx.resume(); play(0); await c; if (playing) startAudio(now()); };
pp.onclick = () => (playing ? pause() : play());
sk.oninput = () => { drag = true; base = +sk.value; at = performance.now(); frame(+sk.value); }; sk.onchange = () => { drag = false; if (playing) play(+sk.value); };
document.getElementById('fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); pp.onclick(); } });
document.getElementById('bar').addEventListener('touchstart', (e) => e.currentTarget.classList.add('on'));
</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'web', 'world2076.html'), html);
console.log(`wrote web/world2076.html (${(html.length / 1e6).toFixed(2)} MB)`);
// the claude.ai artifact variant: the host supplies the document skeleton, so drop ours; one dark look, safe-area aware
const art = html.replace(/^<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport"[^>]*>\n/, '')
  .replace('<style>\n', '<style>\n:root{--bg:#000;--fg:#fff;--line:#ffffff66;--scrim:rgba(0,0,0,.6);color-scheme:dark}\n')
  .replace('html,body{margin:0;height:100%;background:#000;color:#fff;', 'html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);')
  .replace('background:rgba(0,0,0,.6);cursor:pointer', 'background:var(--scrim);cursor:pointer')
  .replace('padding:10px 16px;background:', 'padding:10px 16px calc(10px + env(safe-area-inset-bottom, 0px));background:')
  .replace('border:1px solid #fff6;color:#fff;', 'border:1px solid var(--line);color:var(--fg);')
  .replace('#bar button{', '#bar button:focus-visible{outline:2px solid var(--fg)}#bar button{')
  .replace('</style></head><body>', '</style>').replace('</script></body></html>', '</script>');
fs.writeFileSync(path.join(ROOT, 'web', 'world2076.artifact.html'), art);
console.log('wrote web/world2076.artifact.html');
