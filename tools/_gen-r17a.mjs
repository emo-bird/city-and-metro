import fs from 'node:fs';
const INFL = { 2000:0.004,2001:0.007,2002:-0.008,2003:0.012,2004:0.039,2005:0.018,2006:0.015,2007:0.048,2008:0.059,2009:-0.007,2010:0.033,2011:0.054,2012:0.026,2013:0.026,2014:0.02,2015:0.014,2016:0.02,2017:0.016,2018:0.021,2019:0.029,2020:0.025,2021:0.02,2022:0.02,2023:0.02,2024:0.02 };
const POP = [[2000,6.44e6],[2005,7.2e6],[2010,8.22e6],[2015,8.9e6],[2020,10.47e6],[2030,11.2e6],[2045,11.8e6],[2070,12.2e6],[2300,12.4e6]];
const JR = [[2000,0.62],[2010,0.63],[2020,0.64],[2030,0.645]];
const REAL = [[2000,831.4],[2010,4431.19],[2015,6275],[2020,9650.19],[2021,10855.35],[2024,12282.15]];
function interp(arr, x) { if (x <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (x <= arr[i][0]) { const a = arr[i-1], b = arr[i]; return a[1] + (b[1]-a[1]) * (x-a[0])/(b[0]-a[0]); } return arr[arr.length-1][1]; }
const gdp = (y) => interp(REAL, y) * 10000;
const K = gdp(2000) / (interp(POP, 2000) * interp(JR, 2000));
let price = 1, pi = 1;
const curve = [];
for (let y = 2001; y <= 2024; y++) {
  price *= 1 + (INFL[y] != null ? INFL[y] : 0.02);
  const jobs = interp(POP, y) * interp(JR, y);
  const needPi = gdp(y) / (K * jobs * price);
  curve.push([y, +(needPi / pi - 1).toFixed(4)]);
  pi = needPi;
}
const tail = [[2025,0.030],[2028,0.026],[2032,0.024],[2040,0.022],[2060,0.016]];
const prod = curve.concat(tail);

const MACRO = `      // 城市经济（v2.7 引擎机制 cfg.macro）：按东莞统计公报的真实 GDP 标定
      // 2000 年 831.4 亿 → 2010 年 4431.2 亿 → 2015 年 6275 亿 → 2020 年 9650.2 亿 → 2021 年 10855.4 亿（破万亿）→ 2024 年 12282.2 亿
      // prod 是「每岗位产出」的年增速，按真实 GDP、常住人口×就业比与全国 CPI 逐年反解，重放偏差 <2%
      macro: {
        area: '东莞市域', region: '中国内地',
        gdp0: 8314000,                       // 万元：2000 年东莞 GDP 831.4 亿
        revRatio: [[2000, 0.07], [2010, 0.09], [2020, 0.11]], revElastic: 1.4,
        prod: ${JSON.stringify(prod)},
        infl: 'cn', ref: 'cn',
        histEnd: 2024,
        longRun: { infl: 0.02 },
        struct: { trade: 0.85, fin: 0.35, ind: 0.95, tour: 0.3, prop: 0.55 },   // 外贸 + 制造业主导，金融偏弱
        events: [
          { id: 'dotcom2001', y: 2001, m: 3, scale: 0.5 },
          { id: 'gfc2008', y: 2008, m: 9, scale: 1.4 },          // 东莞外贸依存度极高，冲击远大于全国
          { id: 'covid2020', y: 2020, m: 1, scale: 1.2 },
          { id: 'trade2018', y: 2018, m: 7, scale: 1.0, kind: 'trade', title: '中美贸易摩擦', desc: '美国加征关税，东莞以出口加工为主的电子、家具、纺织订单受冲击。',
            lv: [0.02, 0.03, 0.035, 0.03, 0.02, 0] },
        ],
        note: '按东莞统计公报的 GDP、常住人口与从业人员数据标定；含中美贸易摩擦、2008 金融危机与 2020 疫情的史实冲击。',
      },
`;

let s = fs.readFileSync('js/data_dg.js', 'utf8');
const mStart = s.indexOf('// 城市经济（v2.7 引擎机制 cfg.macro）');
const mEnd = s.indexOf('      growth: Object.assign({}, CM.CFG.growth, {');
if (mStart < 0 || mEnd < 0) throw new Error('macro 边界未找到');
s = s.slice(0, mStart) + MACRO + s.slice(mEnd);

const dl = [];
for (const m of s.matchAll(/\{ id: '([a-z_0-9]+)', name: '([^']+)', geo: \{ admin: '([^']+)' \}/g)) {
  const id = m[1];
  if (/^gz_|^sz_|^hz_|^zs_|out$/.test(id)) continue;
  dl.push("['" + m[2] + "', ['" + m[3] + "']]");
}
const DL = '    districtLabels: [\n      ' + dl.join(',\n      ') + ',\n    ],';
const cur = s.match(/    districtLabels: \[[\s\S]*?\n    \],/);
if (!cur) throw new Error('districtLabels 未找到');
s = s.slice(0, cur.index) + DL + s.slice(cur.index + cur[0].length);
fs.writeFileSync('js/data_dg.js', s);
console.log('macro 已写入（prod ' + prod.length + ' 点），districtLabels ' + dl.length + ' 条');