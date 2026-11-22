// 按《补全结果》重做设施客流曲线（纯数据）
// 1) 修 pax 年份笔误（1888→1988 等）
// 2) 医院：按全市每千人口床位序列重塑曲线形状（2000 1.10 / 2005 1.72 / 2010 2.43 / 2015 3.33 / 2020 3.22）
// 3) 商圈：按商业面积（万㎡）×0.13 万人次/日 定 2022 年量级，整体等比缩放保留开业爬坡
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const interp = (pts, y) => {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) {
      const [y0, v0] = pts[i - 1], [y1, v1] = pts[i];
      return v0 + (v1 - v0) * (y - y0) / (y1 - y0 || 1);
    }
  }
  return pts[pts.length - 1][1];
};
const fmt = v => (Math.round(v * 1000) / 1000).toString();

// ---- 1) 年份笔误 ----
let yearFixed = 0;
s = s.replace(/\[(\d{4}), ([\d.]+)\]/g, (m, y, v) => {
  const n = +y;
  if (n >= 1800 && n < 1900) { yearFixed++; return '[' + (n + 100) + ', ' + v + ']'; }
  return m;
});

// ---- 2) 医院：床位序列 ----
const BEDS = [[2000, 1.10], [2005, 1.72], [2010, 2.43], [2015, 3.33], [2020, 3.22]];
const bedsIdx = y => interp(BEDS, y) / 1.10;   // 2000 = 1.00
const HOSP_YEARS = [2000, 2005, 2010, 2015, 2020, 2035];

// ---- 3) 商圈商业面积（万㎡，估算/官方，见 docs/东莞调研·补全结果.md A5） ----
const GFA = {
  '民盈·国贸城': 30, '汇一城': 12, '华南 MALL': 46, '星河城': 10, '东城万达广场': 16.9,
  '厚街万达广场': 12, '长安万达广场': 10, '虎门万达广场': 14.6, '虎门黄河时装城': 20,
  '虎门国际购物中心': 8, '中国大朗毛织贸易中心': 15, '大和国际购物中心': 6,
  '常平百花时代广场（百花购物中心）': 8, '天虹购物中心（塘厦店）': 6, '塘厦万科生活广场': 7,
  '东莞松山湖万象汇': 12, '滨湖万科里': 4, '首铸·万科广场': 8, '樟木头汇景城购物中心': 6,
  '洪梅中心广场商业区': 3, '厚街 W 广场': 5, '凤岗中心市场（沃尔玛凤岗店）': 4, '虎门国际布料市场': 12,
};
const TRIP_PER_M2 = 0.13; // 万人次/日 每万㎡ → 30 万㎡ ≈ 3.9 万人次/日（与旧值同量级）

let nHosp = 0, nShop = 0;
s = s.replace(/\{ id: '([^']+)', n: '([^']+)', t: '([^']+)', lm: '([^']+)', pax: (\[\[[^\]]*\](?:, \[[^\]]*\])*\])([^\n]*?)\}/g,
  (m, id, name, type, lm, paxJson, rest) => {
    let pts;
    try { pts = JSON.parse(paxJson.replace(/'/g, '"')); } catch { return m; }
    if (type === 'hosp') {
      const a2015 = interp(pts, 2015);
      if (!(a2015 > 0)) return m;
      const A = a2015 / bedsIdx(2015);
      const out = HOSP_YEARS.map(y => '[' + y + ', ' + fmt(A * bedsIdx(y)) + ']');
      nHosp++;
      return '{ id: \'' + id + '\', n: \'' + name + '\', t: \'' + type + '\', lm: \'' + lm + '\', pax: [' + out.join(', ') + ']' + rest + '}';
    }
    if (type === 'shop' && GFA[name]) {
      const cur2022 = interp(pts, 2022);
      const target = TRIP_PER_M2 * GFA[name];
      if (!(cur2022 > 0)) return m;
      const k = target / cur2022;
      const out = pts.map(([y, v]) => '[' + y + ', ' + fmt(v * k) + ']');
      nShop++;
      return '{ id: \'' + id + '\', n: \'' + name + '\', t: \'' + type + '\', lm: \'' + lm + '\', pax: [' + out.join(', ') + ']' + rest + '}';
    }
    return m;
  });

await writeFile(p, s);
console.log('年份笔误修正 ' + yearFixed + ' 处；医院曲线重塑 ' + nHosp + ' 条；商圈按面积重标 ' + nShop + ' 条');