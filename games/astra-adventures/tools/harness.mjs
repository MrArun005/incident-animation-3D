// Shared test harness: opens the game in headless Chromium with WebGL (SwiftShader), serves three.js r128
// from the local npm copy in place of the CDN, and runs it in manual mode so frames advance only on step().
import { chromium } from '/home/user/incident-animation-3d/cartoons/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THREE_LOCAL = '/tmp/three128/package/build/three.min.js';
export async function open({ width = 1280, height = 720, manual = true, storage = {} } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width, height }, ignoreHTTPSErrors: true, deviceScaleFactor: 1 });
  const errors = [];
  // Google Fonts are flaky from inside this sandbox; serve the same CSS and font files from a local cache.
  const FC = '/tmp/claude-0/fontcache';
  if (fs.existsSync(FC + '/css1.css')) {
    await ctx.route('https://fonts.googleapis.com/**', (r) => { const u = r.request().url(); const css = u.includes('Big+Shoulders') ? 'css1.css' : 'css2.css'; r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(`${FC}/${css}`) }); });
    await ctx.route('https://fonts.gstatic.com/**', (r) => { const f = `${FC}/${r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')}`; if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }); else r.abort(); });
  }
  await ctx.route('**/three.js/r128/three.min.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(THREE_LOCAL) }));
  await ctx.addInitScript(([manual, storage]) => { if (manual) window.__ASTRA_MANUAL = true; try { for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v); } catch (e) {} }, [manual, storage]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + path.join(DIR, 'index.html'));
  await page.waitForFunction(() => window.__astra && document.fonts.status === 'loaded', null, { timeout: 30000 }).catch(() => {});
  // Only the last frame of a batch is drawn: SwiftShader takes ~0.1 s a frame, and queued frames back up.
  const step = (n = 1, dt = 1 / 60, drawAll = false) => page.evaluate(([n, dt, all]) => { for (let i = 0; i < n; i++) window.__astra.step(dt, all || i === n - 1); }, [n, dt, drawAll]);
  const state = () => page.evaluate(() => window.__astra.state());
  return { browser, ctx, page, errors, step, state };
}
