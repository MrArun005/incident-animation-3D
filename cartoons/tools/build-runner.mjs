// Builds a one-file HTML player for a canvas story: the scene module and its beats inlined, the soundtrack as
// a data: URI, play / scrub / fullscreen controls that work on a phone.
//   node tools/build-runner.mjs --story prabhu   -> web/prabhu.html (needs out/prabhu-audio.m4a)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const STORY = opt('story', 'prabhu');
let scene = fs.readFileSync(path.join(ROOT, 'src', `${STORY}.js`), 'utf8');
const beats = fs.readFileSync(path.join(ROOT, 'stories', `${STORY}.beats.json`), 'utf8');
scene = scene.replace(/^import B from .*$/m, `const B = ${beats.trim()};`);
// the page drives the clock itself: drop the scene's own preview loop
scene = scene.replace(/^if \(!new URLSearchParams\(location\.search\)\.has\('render'\)\).*$/m, '');
const audio = fs.readFileSync(path.join(ROOT, 'out', `${STORY}-audio.m4a`)).toString('base64');
const tpl = fs.readFileSync(path.join(ROOT, 'web', `${STORY}.template.html`), 'utf8');
const html = tpl.replace('__SCENE__', () => scene).replace('__AUDIO__', () => audio);
const out = path.join(ROOT, 'web', `${STORY}.html`);
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(ROOT, out)} (${(html.length / 1e6).toFixed(2)} MB)`);
