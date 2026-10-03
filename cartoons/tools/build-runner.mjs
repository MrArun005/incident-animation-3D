// Builds a one-file HTML player for a canvas story: the scene module (and the local modules it imports) and
// its beats inlined, the soundtrack as a data: URI, play / scrub / fullscreen controls that work on a phone.
//   node tools/build-runner.mjs --story prabhu [--audio out/prabhu-song.m4a] [--out web/prabhu-song.html]
// Each imported module is wrapped in its own function scope, so helpers with the same names do not collide.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const STORY = opt('story', 'prabhu');
const beats = fs.readFileSync(path.join(ROOT, 'stories', `${opt('beats', STORY)}.beats.json`), 'utf8');   // --beats: share another story's beat grid

// Every local module is wrapped once, in import order, at the top level of the page script: its exports are
// destructured into the top level (so a later module or the scene sees them), its own helpers stay inside it.
const done = new Set(), mods = [];
const modId = (file) => '__' + path.basename(file, '.js').replace(/\W/g, '_');
function inline(file) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/^import B from .*$/m, `const B = ${beats.trim()};`);
  src = src.replace(/^import (\w+) from '(\.\.\/stories\/[^']+\.json)' with \{ type: 'json' \};$/gm, (_, n, rel) => `const ${n} = ${fs.readFileSync(path.join(path.dirname(file), rel), 'utf8').trim()};`);
  return src.replace(/^import \{([^}]+)\} from '(\.\/[^']+)';$/gm, (_, names, rel) => {
    const dep = path.join(path.dirname(file), rel);
    if (!done.has(dep)) { done.add(dep); const body = inline(dep); const ex = [...body.matchAll(/^export (?:const|function|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
      mods.push(`const ${modId(dep)} = (() => {\n${body.replace(/^export /gm, '')}\nreturn { ${ex.join(', ')} };\n})();\nconst { ${ex.join(', ')} } = ${modId(dep)};\n`); }
    // renamed imports (X as Y) become local aliases of the module's export
    return names.split(',').map((n) => n.trim().split(/\s+as\s+/)).filter((x) => x.length === 2).map(([x, y]) => `const ${y} = ${modId(dep)}.${x};`).join('\n');
  });
}
let scene = inline(path.join(ROOT, 'src', `${STORY}.js`));
scene = mods.join('') + scene;
// the page drives the clock itself: drop the scene's own preview loop
scene = scene.replace(/^if \(!new URLSearchParams\(location\.search\)\.has\('render'\)\).*$/m, '');
const audioFile = opt('audio', path.join('out', `${STORY}-audio.m4a`));
const audio = fs.readFileSync(path.join(ROOT, audioFile)).toString('base64');
const tpl = fs.readFileSync(path.join(ROOT, 'web', `${STORY}.template.html`), 'utf8');
const html = tpl.replace('__SCENE__', () => scene).replace('__AUDIO__', () => audio);
const out = path.join(ROOT, opt('out', path.join('web', `${STORY}.html`)));
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(ROOT, out)} (${(html.length / 1e6).toFixed(2)} MB)`);
