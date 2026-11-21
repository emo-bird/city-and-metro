import fs from 'node:fs';
const d = fs.readFileSync('js/data_dg.js', 'utf8');
function dec(s, from) {
  const out = [];
  let i = from || 0, p = 0, q = 0;
  const rd = () => {
    let u = 0, sh = 0, c;
    do { c = s.charCodeAt(i++) - 63; u |= (c & 31) << sh; sh += 5; } while (c & 32);
    return u & 1 ? ~(u >> 1) : u >> 1;
  };
  while (i < s.length) { p += rd(); q += rd(); out.push(p / 64, q / 64); }
  return out;
}
// 找三条未来线
for (const id of ['dg_深惠城际', 'dg_深江铁路', 'dg_佛穗莞城际']) {
  const i = d.indexOf('{ id: "' + id + '"');
  const j = d.indexOf('\n', i);
  const line = d.slice(i, j);
  const m = /path: "((?:[^"\\]|\\.)*)"/.exec(line);
  if (!m) { console.log(id, 'no path'); continue; }
  const pts = dec(JSON.parse('"' + m[1] + '"'), 0);
  let len = 0;
  for (let k = 0; k + 3 < pts.length; k += 2) len += Math.hypot(pts[k + 2] - pts[k], pts[k + 3] - pts[k + 1]);
  console.log(id, 'points', pts.length / 2, 'len cells', len.toFixed(1), 'km', (len * 0.25).toFixed(1));
}