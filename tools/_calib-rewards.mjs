import fs from 'node:fs';

const P = 'js/data_dg.js';
let s = fs.readFileSync(P, 'utf8');

// 时代通胀校准：引擎发布任务时会把 reward 乘上当年的 costIndex（js/economy.js:1771），
// 所以数据里写的是「基准年货币」，实际到手 = reward × costIndex(发布年)。
// 这里先定「到手金额」（当年货币），再反推基准值，保证四个时代的奖励购买力一致。
const CI = { 2003: 1.564, 2004: 1.619, 2009: 1.923, 2010: 1.99, 2015: 2.363, 2016: 2.446, 2020: 2.807, 2022: 3.007 };
const NOMINAL = { 2003: 200000, 2004: 200000, 2009: 300000, 2010: 310000, 2015: 450000, 2016: 500000, 2020: 800000, 2022: 850000 };

const rows = [];
for (const [y, nom] of Object.entries(NOMINAL)) {
  const base = Math.round(nom / CI[y] / 1000) * 1000;
  rows.push({ y: +y, nominal: nom, ci: CI[y], base });
}

let n = 0;
for (const r of rows) {
  const re = new RegExp(`(\\{ id: 'dg-g\\d+', from: ${r.y}, type: 'connect', months: \\d+, reward: )(\\d+)`, 'g');
  s = s.replace(re, (m, p) => { n++; return p + r.base; });
}
if (!n) throw new Error('没有替换到目标奖励');

fs.writeFileSync(P, s);
console.log('校准后的基准奖励（到手金额 = 基准 × 当年 costIndex）：');
for (const r of rows) console.log(`  ${r.y} 年：基准 ${r.base} × ${r.ci} = ${Math.round(r.base * r.ci)}（目标 ${r.nominal}）`);