import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');

// ---------- 1. 地标体量收敛：占用道路的超大广场/校园/园区缩到核心区体量 ----------
const KEEP_BIG = new Set(['rail', 'station2', 'bridge', 'airport', 'terminal']);
const MAXW = 420, MAXD = 320;
let shrunk = [];
s = s.replace(/\{ id: '(dgl\d+)', name: '([^']+)', x: (-?[\d.]+), y: (-?[\d.]+), w: (\d+), d: (\d+)([^}]*?)kind: '(\w+)' \}/g,
  (m, id, name, x, y, w, d, mid, kind) => {
    if (KEEP_BIG.has(kind)) return m;
    const nw = Math.min(+w, MAXW), nd = Math.min(+d, MAXD);
    if (nw === +w && nd === +d) return m;
    shrunk.push(id + ' ' + name + ' ' + w + '×' + d + '→' + nw + '×' + nd);
    return `{ id: '${id}', name: '${name}', x: ${x}, y: ${y}, w: ${nw}, d: ${nd}${mid}kind: '${kind}' }`;
  });

// ---------- 2. 缺设施的地标补设施 ----------
const FAC_KINDS = new Set(['campus', 'hospital', 'mall', 'expo', 'stadium', 'museum', 'garden', 'themepark', 'cluster', 'gallery', 'opera', 'library', 'port', 'temple', 'traditional', 'skyscraper', 'tower', 'pagoda', 'park']);
const lmUsed = new Set([...s.matchAll(/lm: '(\w+)'/g)].map((m) => m[1]));
const landRegex = /\{ id: '(dgl\d+)', name: '([^']+)', x: (-?[\d.]+), y: (-?[\d.]+), w: (\d+), d: (\d+)([^}]*?)year: (\d+), kind: '(\w+)' \}/g;
const add = [];
let maxPax = 0;
for (const m of s.matchAll(/id: '(dg\w*?)p(\d+)'/g)) maxPax = Math.max(maxPax, +m[2]);
for (const m of s.matchAll(/id: '(dgpf)(\d+)'/g)) maxPax = Math.max(maxPax, +m[2]);
for (const m of s.matchAll(/\{ id: '(dgpf\d+)'/g)) maxPax = Math.max(maxPax, 0);
let seq = 0;
for (const m of s.matchAll(landRegex)) {
  const [, id, name, x, y, w, d, mid, year, kind] = m;
  if (!FAC_KINDS.has(kind)) continue;
  if (lmUsed.has(id)) continue;
  const y0 = +year;
  let t = 'mall', base = 0.6;
  if (kind === 'campus' || kind === 'library') { t = 'campus'; base = 0.9; }
  else if (kind === 'hospital') t = 'hosp';
  else if (kind === 'expo' || kind === 'gallery') { t = 'expo'; base = 0.8; }
  else if (kind === 'stadium') { t = 'stad'; base = 1.4; }
  else if (kind === 'museum' || kind === 'traditional' || kind === 'temple' || kind === 'opera') { t = 'tour'; base = 0.5; }
  else if (kind === 'port') { t = 'port'; base = 1.2; }
  else if (kind === 'garden' || kind === 'themepark' || kind === 'park' || kind === 'cluster') { t = 'park'; base = 0.7; }
  else if (kind === 'skyscraper' || kind === 'tower') { t = 'office'; base = 0.6; }
  seq++;
  const fid = 'dgpn' + String(seq).padStart(2, '0');
  add.push(`    { id: '${fid}', n: '${name}', t: '${t}', lm: '${id}', pax: [[${y0}, ${(base * 0.35).toFixed(2)}], [${y0 + 6}, ${base.toFixed(2)}], [${Math.max(y0 + 12, 2025)}, ${(base * 1.6).toFixed(2)}]] },`);
}

// ---------- 3. 与背景交通车站并流的接驳口：提升该站客流 ----------
const BOOST = ['中堂', '长安', '麻涌', '东莞南', '虎门'];
let boosted = [];
s = s.replace(/(\{ id: 'dg\w+', n: '([^']+)', t: 'rail', lm: '(\w+)', pax: )(\[\[[\s\S]*?\]\])( \},)/g, (m, head, n, lm, curve, tail) => {
  if (!BOOST.includes(n)) return m;
  let arr;
  try { arr = JSON.parse(curve); } catch { return m; }
  const out = arr.map(([y, v]) => [y, +(v * 1.35).toFixed(3)]);
  boosted.push(n + ' ' + arr.length + ' 点');
  return head + JSON.stringify(out).replace(/"/g, '').replace(/,/g, ', ') + tail;
});

// ---------- 4. 滨海湾新区：填海 + 片区 + 区名 ----------
const POLY = '[[62,176],[74,169],[90,168],[104,174],[112,186],[104,197],[88,201],[72,195],[62,187]]';
if (!s.includes("id: 'binhaiwan'")) {
  s = s.replace("    { id: 'humen', name: '虎门镇'",
    `    // 滨海湾新区：交椅湾、沙角、威远岛一带向海要地，2017 年挂牌，2019 年后成片填海\n    { id: 'binhaiwan', name: '滨海湾新区', poly: ${POLY}, open: 2017, plan: 'waterfront' },\n    { id: 'humen', name: '虎门镇'`);
}
if (!s.includes('DATA.reclaim')) {
  s = s.replace('  DATA.landmarks',
    `  // 滨海湾新区填海（v2.9.6）：只吞并 2010 年后仍在水里的格，2020 年起成陆\n  DATA.reclaim = [\n    { name: '滨海湾新区（填海）', year: 2010, poly: ${POLY} },\n  ];\n\n  DATA.landmarks`);
}
if (!s.includes("['滨海湾新区', ['滨海湾新区']]")) {
  s = s.replace("    districtLabels: [\n", "    districtLabels: [\n      ['滨海湾新区', ['滨海湾新区']],\n");
}
if (add.length) {
  const at = s.indexOf('  DATA.facilities = [');
  if (at < 0) throw new Error('facilities 区块未找到');
  const close = s.indexOf('\n  ];', at);
  s = s.slice(0, close) + '\n' + add.join('\n') + s.slice(close);
}
fs.writeFileSync(f, s);
console.log('缩小地标 ' + shrunk.length + '：' + shrunk.slice(0, 8).join(' / '));
console.log('新增设施 ' + add.length);
console.log('提升客流 ' + boosted.length + '：' + boosted.join(' / '));
console.log('滨海湾片区 ' + (s.includes("id: 'binhaiwan'") ? 'ok' : 'missing') + '，reclaim ' + (s.includes('DATA.reclaim') ? 'ok' : 'missing'));