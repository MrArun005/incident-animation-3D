// Stills of the new renderer in a real flight: the title, the opening wingtip pass (chase view and a
// dragged side view), a boost, and a look back at Vega.   node tools/shots.mjs [prefix]
import { open } from './harness.mjs';
const SP = '/tmp/claude-0/-home-user-3D-Game/a8e029d3-2f16-59c3-b012-4582e92c4956/scratchpad';
const pre = process.argv[2] || 'shot';
const g = await open({ width: 1600, height: 900 });
const { page, step, state } = g;
const shot = async (n) => { await page.screenshot({ path: `${SP}/${pre}-${n}.png` }); console.log('shot', n, JSON.stringify((await state()).pos)); };
await step(40); await shot('title');
await page.keyboard.press('Enter');
await step(60 * 3); await shot('cruise');
// the opening rock: 330 m out, on the left
let s = await state();
while (s.pos[2] > -318) { await step(10); s = await state(); }
await shot('pass-chase');
await step(12); await shot('pass-chase2');
// look at it from the side while it goes by
await page.mouse.move(800, 450); await page.mouse.down();
for (let i = 0; i < 14; i++) { await page.mouse.move(800 - i * 26, 440 - i * 3); await step(1); }
await shot('pass-side');
await page.mouse.up(); await step(90);
await page.keyboard.down('Shift'); await step(100); await shot('boost'); await page.keyboard.up('Shift');
await step(120);
await page.mouse.move(1100, 450); await page.mouse.down();
for (let i = 0; i < 16; i++) { await page.mouse.move(1100 + i * 30, 450 - i * 4); await step(1); }
await shot('vega');
await page.mouse.up();
console.log(JSON.stringify(await page.evaluate(() => window.__astra.info())));
console.log('events', JSON.stringify((await page.evaluate(() => window.__astra.events(0))).filter((e) => e.type === 'pass' || e.type === 'hit')));
console.log('errors:', g.errors.length ? g.errors.slice(0, 8) : 'none');
await g.browser.close();
