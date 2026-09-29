import { open } from './harness.mjs';
const g = await open({ width: 640, height: 360 }); const { page, step, state } = g;
await step(10); await page.keyboard.press('Enter'); await step(60);
const pattern = ['ArrowRight', null, 'ArrowUp', null, 'ArrowLeft', 'Shift', null, 'ArrowDown', null, 'KeyD', null, 'KeyA'];
for (let seg = 0; seg < 24; seg++) {
  const k = pattern[seg % pattern.length]; if (k) await page.keyboard.down(k);
  for (let i = 0; i < 4; i++) {
    await step(30);
    const v = await page.evaluate(() => window.__astra.vega()), s = await state();
    const f = (x, n = 1) => (typeof x === 'number' ? x.toFixed(n) : x);
    console.log(`t=${f(s.t)} key=${(k || '-').padEnd(10)} lead ${f(s.speed, 0)}m/s | vega off=${f(v.off, 0)} ${v.rejoin ? 'REJOIN' : 'slot  '} ${v.avoid ? 'AVOID' : '     '} spd=${f(v.speed, 0)} want=${f(v.spd, 0)} boost=${v.boosting ? 'Y' : 'n'}${f(v.boostE, 2)} rel=${v.rel}`);
  }
  if (k) await page.keyboard.up(k);
}
console.log('errors', g.errors);
await g.browser.close();
