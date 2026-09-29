// Scores an autopilot variant on Hard: runs it headless (no recording) and grades the flight for a highlight
// video — close passes, knife edges, no hits.   node tools/lab/score.mjs tools/lab/pilot-X.mjs [seconds]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [, , file, secs = '80'] = process.argv;
const name = path.basename(file, '.mjs'), log = `/tmp/claude-0/lab/${name}.json`;
fs.mkdirSync('/tmp/claude-0/lab', { recursive: true });
try { fs.unlinkSync(log); } catch (e) {}
const t0 = Date.now();
let out = '';
try { out = execFileSync('node', [file, '--seconds', secs, '--hard', '--log', log], { encoding: 'utf8', timeout: 30 * 60 * 1000, maxBuffer: 1 << 26 }); }
catch (e) { console.log(JSON.stringify({ name, error: String(e.message).slice(0, 400), stdout: String(e.stdout || '').slice(-800) })); process.exit(1); }
const L = JSON.parse(fs.readFileSync(log, 'utf8'));
const ev = L.events, passes = ev.filter((e) => e.type === 'pass'), hits = ev.filter((e) => e.type === 'hit'), breaches = ev.filter((e) => e.type === 'breach');
const knife = passes.filter((p) => p.gap < 1.6).length, tight = passes.filter((p) => p.gap < 3).length;
const vega = L.frames.length ? 0 : 0;
const score = 100 * passes.length + 150 * knife + 60 * tight - 450 * hits.length - 3000 * breaches.length + L.final.score / 25;
console.log(JSON.stringify({ name, score: Math.round(score), passes: passes.length, knife, tight, hits: hits.length, breaches: breaches.length, gameScore: L.final.score, hull: L.final.hull,
  closest: L.final.closest, gaps: passes.map((p) => p.gap), hitTimes: hits.map((h) => h.t), seconds: +((Date.now() - t0) / 1000).toFixed(0), errors: /errors: \[\]/.test(out) ? 'none' : out.split('\n').filter((l) => l.startsWith('errors')).join(' ') }));
