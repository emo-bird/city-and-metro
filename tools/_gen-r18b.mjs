import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');
const KEEP = new Set(['rail', 'station2', 'bridge', 'arch', 'airport', 'terminal']);
const MAXW = 360, MAXD = 280;
let n = 0;
s = s.replace(/\{ id: '(dgl\d+)', name: '([^']+)', x: (-?[\d.]+), y: (-?[\d.]+), w: (\d+), d: (\d+)([^}]*?)kind: '(\w+)' \}/g,
  (m, id, name, x, y, w, d, mid, kind) => {
    if (KEEP.has(kind)) return m;
    const nw = Math.min(+w, MAXW), nd = Math.min(+d, MAXD);
    if (nw === +w && nd === +d) return m;
    n++;
    return `{ id: '${id}', name: '${name}', x: ${x}, y: ${y}, w: ${nw}, d: ${nd}${mid}kind: '${kind}' }`;
  });
fs.writeFileSync(f, s);
console.log('二次收敛地标 ' + n + ' 座（上限 360×280 m）');