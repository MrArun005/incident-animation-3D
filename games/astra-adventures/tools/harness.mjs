// Shared test harness: serves the game folder over a local HTTP server (the page fetches its models and
// textures by relative path, which a file:// page can't), opens it in headless Chromium with WebGL
// (SwiftShader), answers the CDN requests for three.js r147 from a local npm copy, and runs the game in
// manual mode so frames advance only on step().
import { chromium } from '/home/user/incident-animation-3d/cartoons/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE_LOCAL = '/tmp/three147/package';      // npm pack three@0.147.0 && tar xzf three-0.147.0.tgz
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };

function serve(root) {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

export async function open({ width = 1280, height = 720, manual = true, storage = {}, wait = true } = {}) {
  const server = await serve(DIR);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const close = browser.close.bind(browser);
  browser.close = async () => { await close(); server.close(); };
  const ctx = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
  const errors = [];
  // Google Fonts are flaky from inside this sandbox; serve the same CSS and font files from a local cache.
  const FC = '/tmp/claude-0/fontcache';
  if (fs.existsSync(FC + '/css1.css')) {
    await ctx.route('https://fonts.googleapis.com/**', (r) => { const u = r.request().url(); const css = u.includes('Big+Shoulders') ? 'css1.css' : 'css2.css'; r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(`${FC}/${css}`) }); });
    await ctx.route('https://fonts.gstatic.com/**', (r) => { const f = `${FC}/${r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')}`; if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }); else r.abort(); });
  }
  await ctx.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => {
    const rel = r.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.147.0/', '');
    const f = path.join(THREE_LOCAL, rel);
    if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else r.abort();
  });
  await ctx.addInitScript(([manual, storage]) => { if (manual) window.__ASTRA_MANUAL = true; try { for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v); } catch (e) {} }, [manual, storage]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  if (wait) await page.waitForFunction(() => window.__astra && window.__astra.ready && document.fonts.status === 'loaded', null, { timeout: 120000 });
  // Only the last frame of a batch is drawn: SwiftShader is slow, and queued frames back up.
  const step = (n = 1, dt = 1 / 60, drawAll = false) => page.evaluate(([n, dt, all]) => { for (let i = 0; i < n; i++) window.__astra.step(dt, all || i === n - 1); }, [n, dt, drawAll]);
  const tick = (n = 1, dt = 1 / 60) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__astra.step(dt, false); }, [n, dt]);   // advance without drawing
  const state = () => page.evaluate(() => window.__astra.state());
  page.setDefaultTimeout(180000);
  return { browser, ctx, page, errors, step, tick, state, server };
}
