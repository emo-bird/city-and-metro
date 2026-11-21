import fs from 'node:fs';
const P = { lon0: 113.5, lat0: 23.17, kx: 407.44, ky: 442.3 };
const W = 320, H = 240;
const gx = (lon) => +(((lon - P.lon0) * P.kx).toFixed(2));
const gy = (lat) => +(((P.lat0 - lat) * P.ky).toFixed(2));

const md = fs.readFileSync('scripts/_dg-poi.md', 'utf8');
const secOf = (line) => (line.match(/^## \d+\. (.+?)\s*$/) || [])[1];
let sec = '';
const rows = [];
for (const line of md.split(/\r?\n/)) {
  const s = secOf(line); if (s) { sec = s; continue; }
  if (!/^\|\s*\d+\s*\|/.test(line)) continue;
  const c = line.split('|').map((x) => x.trim());
  // c: ['', '#', 名称, 类别, 镇街/城市, 纬度, 经度, 年份, 规模, 备注, '']
  const name = c[2], cat = c[3], city = c[4], lat = parseFloat(c[5]), lon = parseFloat(c[6]);
  const year = /^\d{4}$/.test(c[7]) ? +c[7] : null;
  const size = (c[8].match(/(\d+)\s*×\s*(\d+)/) || []);
  if (!name || !isFinite(lat) || !isFinite(lon)) continue;
  rows.push({ sec, name, cat, city, lat, lon, year, w: size[1] ? +size[1] : 0, d: size[2] ? +size[2] : 0, note: c[9] || '' });
}

const KIND = { 医疗: 'hospital', 高校: 'campus', 商圈: 'mall', 商业: 'mall', 公园: 'garden', 景点: 'themepark', 会展: 'expo', 文体: 'stadium', 产业: 'cluster', 园区: 'cluster', 交通: 'station2' };
const FT = { 医疗: 'hosp', 高校: 'uni', 商圈: 'shop', 商业: 'shop', 公园: 'park', 景点: 'scenic', 会展: 'venue', 文体: 'stadium', 产业: 'cbd', 园区: 'cbd', 交通: null };
const PAX = { hosp: [0.25, 0.8], uni: [0.5, 2.2], shop: [0.6, 3.2], park: [0.4, 2.4], scenic: [0.3, 2.6], venue: [0.15, 1.1], stadium: [0.2, 1.4], cbd: [0.4, 2.0] };

function catOf(r) {
  const t = r.sec + ' ' + r.cat;
  if (/医疗|医院|卫生/.test(t)) return '医疗';
  if (/高校|大学|学院|教育/.test(t)) return '高校';
  if (/商圈|商业|购物|市场|商贸/.test(t)) return '商圈';
  if (/公园|绿地|湿地/.test(t)) return '公园';
  if (/景点|旅游|古村|古镇|文化|纪念/.test(t)) return '景点';
  if (/会展|展览/.test(t)) return '会展';
  if (/文体|体育|剧院|音乐|图书|博物/.test(t)) return '文体';
  if (/产业|园区|科学城|基地|工业|厂/.test(t)) return '产业';
  if (/交通|枢纽|港|站/.test(t)) return '交通';
  return '商业';
}

let src = fs.readFileSync('js/data_dg.js', 'utf8');
// 幂等：先清除上一次注入的 POI 地标/设施与标记行
src = src.split('\n').filter((l) => !/\{ id: 'dgp[f]?\d+',|\/\/ ===== 第 17 轮：子代理调研的真实设施/.test(l)).join('\n');
const existing = new Set();
for (const m of src.matchAll(/name: '([^']+)'/g)) existing.add(m[1]);
const takenId = new Set([...src.matchAll(/id: '(dg[a-z0-9_]+)'/g)].map((m) => m[1]));

const used = new Set();
const lm = [];
const fac = [];
let n = 0;
for (const r of rows) {
  if (existing.has(r.name)) continue;
  if ([...existing].some((e) => e.length > 3 && (e.includes(r.name) || r.name.includes(e)))) continue;
  const x = gx(r.lon), y = gy(r.lat);
  if (!(x > 1 && x < W - 1 && y > 1 && y < H - 1)) continue;
  const key = r.name;
  if (used.has(key)) continue;
  used.add(key);
  n += 1;
  let id = 'dgp' + n; while (takenId.has(id)) { n += 1; id = 'dgp' + n; }
  const cat = catOf(r);
  const kind = KIND[cat] || 'box';
  const w = Math.max(60, Math.min(1600, r.w || 140));
  const d = Math.max(60, Math.min(1600, r.d || 120));
  const year = r.year || (cat === '高校' ? 2003 : cat === '医疗' ? 1990 : cat === '公园' ? 1995 : cat === '景点' ? 1990 : 1998);
  lm.push(`    { id: '${id}', name: '${r.name}', x: ${x}, y: ${y}, w: ${w}, d: ${d}, year: ${year}, kind: '${kind}' },`);
  const t = FT[cat];
  const p = t && PAX[t];
  if (p && r.cat !== '镇街医院') {
    const y0 = Math.min(year, 2024);
    const base = Math.max(1980, y0 - 12);
    const c = `[[${base}, ${+(p[0] * 0.4).toFixed(2)}], [${y0}, ${p[0]}], [${Math.min(y0 + 8, 2030)}, ${+((p[0] + p[1]) / 2).toFixed(2)}], [2035, ${p[1]}]]`;
    fac.push(`{ id: 'dgpf${n}', n: '${r.name}', t: '${t}', lm: '${id}', pax: ${c} },`);
  }
}

// 插入：地标数组末尾、设施数组末尾
let out = src;
const mEnd = out.indexOf('\n  ];\n  DATA.facilities = [');
if (mEnd < 0) throw new Error('landmarks 末尾未找到');
out = out.slice(0, mEnd) + '\n    // ===== 第 17 轮：子代理调研的真实设施（OSM 实测点位）=====\n' + lm.join('\n') + out.slice(mEnd);
const fEnd = out.indexOf('\n  ];\n  DATA.bg = {');
if (fEnd < 0) throw new Error('facilities 末尾未找到');
out = out.slice(0, fEnd) + '\n' + fac.join('\n') + out.slice(fEnd);
// 幂等：先删旧块再插（这里用一次性写）
fs.writeFileSync('js/data_dg.js', out);
console.log('POI 行 ' + rows.length + ' → 新增地标 ' + lm.length + '、设施 ' + fac.length);