// Renders a WebGL story (three.js, e.g. comingup3d) frame by frame in headless Chromium on SwiftShader.
// Frames land in out/<story>.frames/f00000.jpg so a run can be resumed or split across workers.
//   node tools/render-gl.mjs --story comingup3d --stills 3,22.8   -> out/still-comingup3d-*.jpg
//   node tools/render-gl.mjs --story comingup3d --range 0:1500     -> frames 0..1499 (skips ones on disk)
//   node tools/render-gl.mjs --story comingup3d --encode           -> out/cartoon-comingup3d.mp4 (+ wav if present)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import ffmpeg from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const STORY = opt('story', 'comingup3d');
const FR = path.join(OUT, `${STORY}.frames`);
fs.mkdirSync(FR, { recursive: true });

if (args.includes('--encode')) {
  const FPS = Number(opt('fps', 30)), name = `cartoon-${STORY}`, video = path.join(OUT, `${name}-video.mp4`);
  spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FR, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', video], { stdio: 'inherit' });
  const wav = path.join(OUT, `${name}.wav`), mp4 = path.join(OUT, `${name}.mp4`);
  if (fs.existsSync(wav)) spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  else fs.copyFileSync(video, mp4);
  console.log(`wrote ${path.relative(ROOT, mp4)}`);
  process.exit(0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => { console.error('[page error]', e.message); process.exit(1); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`[console ${m.type()}]`, m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render&story=${STORY}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const { DURATION, FPS } = await page.evaluate(() => ({ DURATION: window.DURATION, FPS: window.FPS }));
const grab = (i) => page.evaluate((i) => { window.renderFrame(i); return document.getElementById('c').toDataURL('image/jpeg', 0.94); }, i);
const save = (file, url) => { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64')); fs.renameSync(tmp, file); };

if (opt('stills')) {
  for (const s of opt('stills').split(',').map(Number)) { save(path.join(OUT, `still-${STORY}-${s}.jpg`), await grab(Math.round(s * FPS))); console.log(`still ${s}`); }
} else {
  const N = Math.round(DURATION * FPS), [a, b] = (opt('range', `0:${N}`)).split(':').map(Number);
  const t0 = Date.now(); let done = 0;
  for (let i = a; i < Math.min(b, N); i++) {
    const f = path.join(FR, `f${String(i).padStart(5, '0')}.jpg`);
    if (fs.existsSync(f)) continue;
    save(f, await grab(i)); done++;
    if (done % 50 === 0) console.log(`frame ${i} (${done} new, ${((Date.now() - t0) / done / 1000).toFixed(2)} s/frame)`);
  }
  console.log(`range ${a}:${b} done`);
}
await browser.close();
server.close();
