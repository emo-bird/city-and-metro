import fs from 'node:fs';
const peaks = JSON.parse(fs.readFileSync('tools/osm-cache/dg-peaks.json', 'utf8'));
const P = { lon0: 113.5, lat0: 23.17, kx: 407.44, ky: 442.3 };
const gx = (lon) => (lon - P.lon0) * P.kx, gy = (lat) => (P.lat0 - lat) * P.ky;
const txt = fs.readFileSync('tools/_wild.txt', 'utf8');
const regions = [];
const parts = txt.split(/(?=\{ id: 'wild)/);
for (const block of parts) {
  const id = (block.match(/id: '(wild\d+)'/) || [])[1];
  if (!id) continue;
  const name = (block.match(/name: '([^']+)'/) || [])[1];
  const pi = block.indexOf('poly: ');
  const si = block.indexOf(', scenic: true');
  if (pi < 0 || si < 0) { console.log('skip', id, pi, si); continue; }
  const json = block.slice(pi + 6, si).trim();
  let rings;
  try { rings = JSON.parse(json); } catch (e) { console.log('bad json', id, json.slice(0, 60)); continue; }
  if (typeof rings[0][0] === 'number') rings = [rings];
  regions.push({ id, name, rings });
}
console.log('regions', regions.length, regions.map((r) => r.id + ':' + r.rings.length).join(' '));
function inRing(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
const inAny = (x, y, rings) => rings.some((r) => inRing(x, y, r));
const pts = peaks.map((p) => ({ ...p, x: gx(p.lon), y: gy(p.lat) }));
for (const r of regions) {
  const flat = r.rings.flat();
  const xs = flat.map((p) => p[0]), ys = flat.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const inside = pts.filter((p) => ['peak', 'hill', 'ridge', 'saddle'].includes(p.kind) && inAny(p.x, p.y, r.rings)).sort((a, b) => (b.ele || 0) - (a.ele || 0));
  const near = pts.filter((p) => ['peak', 'hill'].includes(p.kind)).map((p) => ({ ...p, d: Math.hypot(p.x - cx, p.y - cy) })).sort((a, b) => a.d - b.d);
  const loc = pts.filter((p) => p.kind === 'locality').map((p) => ({ ...p, d: Math.hypot(p.x - cx, p.y - cy) })).sort((a, b) => a.d - b.d);
  console.log(r.id, (r.name + '').padEnd(12), '内部峰', inside.length, inside.slice(0, 3).map((p) => `${p.name}(${p.ele || '?'})`).join(' '),
    '| 近峰', near.slice(0, 3).map((p) => `${p.name}(${p.ele || '?'},${p.d.toFixed(0)})`).join(' '),
    '| 近地名', loc.slice(0, 2).map((p) => `${p.name}(${p.d.toFixed(0)})`).join(' '));
}