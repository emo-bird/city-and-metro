import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');
// 设施类型必须落在 js/facility.js 的 TYPES 里（rail/air/port/uni/hosp/shop/cbd/scenic/park/stadium/venue）
const MAP = {
  tour: 'scenic', expo: 'venue', campus: 'uni', stad: 'stadium', office: 'cbd', mall: 'shop', ferry: 'port',
};
let n = 0;
s = s.replace(/t: '(\w+)'/g, (m, t) => {
  if (!MAP[t]) return m;
  n++;
  return "t: '" + MAP[t] + "'";
});
fs.writeFileSync(f, s);
console.log('映射设施类型 ' + n + ' 处');
const c = {};
[...s.matchAll(/t: '(\w+)'/g)].map((x) => x[1]).forEach((t) => (c[t] = (c[t] || 0) + 1));
console.log(JSON.stringify(c));