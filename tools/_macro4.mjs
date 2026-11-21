// 逐年反解 prod，使模拟名义 GDP 命中真实锚点（年内线性插值真实 GDP）
const INFL = { 2000:0.004,2001:0.007,2002:-0.008,2003:0.012,2004:0.039,2005:0.018,2006:0.015,2007:0.048,2008:0.059,2009:-0.007,2010:0.033,2011:0.054,2012:0.026,2013:0.026,2014:0.02,2015:0.014,2016:0.02,2017:0.016,2018:0.021,2019:0.029,2020:0.025,2021:0.009,2022:0.02,2023:0.002,2024:0.002 };
const POP = [[2000,6.44e6],[2005,7.2e6],[2010,8.22e6],[2015,8.9e6],[2020,10.47e6],[2030,11.2e6],[2045,11.8e6],[2070,12.2e6],[2300,12.4e6]];
const JR = [[2000,0.62],[2010,0.63],[2020,0.64],[2030,0.645]];
const REAL = [[2000,890],[2005,2182],[2010,4278],[2015,6275],[2020,9650],[2021,10855],[2024,12200]];
function interp(arr, x) { if (x <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (x <= arr[i][0]) { const a = arr[i-1], b = arr[i]; return a[1] + (b[1]-a[1]) * (x-a[0])/(b[0]-a[0]); } return arr[arr.length-1][1]; }
const gdp = (y) => interp(REAL, y) * 10000; // 万元
const K = gdp(2000) / (interp(POP, 2000) * interp(JR, 2000));
let price = 1;
const curve = [];
let pi = 1;
for (let y = 2001; y <= 2024; y++) {
  price *= 1 + (INFL[y] != null ? INFL[y] : 0.02);
  const jobs = interp(POP, y) * interp(JR, y);
  // 需要 pi(y)：gdp(y) = K*jobs*pi*price
  const needPi = gdp(y) / (K * jobs * price);
  const g = needPi / pi - 1;
  curve.push([y, +g.toFixed(4)]);
  pi = needPi;
}
console.log(JSON.stringify(curve));
// 未来段：2025-2030 逐步降到 3.5%
for (let y = 2025; y <= 2035; y++) curve.push([y, 0.04]);
console.log('2020 模拟', Math.round(K * interp(POP,2020) * interp(JR,2020) * 1 * 1));
// 校验：重放
let pi2 = 1, p2 = 1, out = { 2000: Math.round(gdp(2000)/10000) };
for (let y = 2001; y <= 2024; y++) { pi2 *= 1 + curve[y - 2001][1]; p2 *= 1 + (INFL[y] != null ? INFL[y] : 0.02); out[y] = Math.round(K * interp(POP,y) * interp(JR,y) * pi2 * p2 / 10000); }
const bad = Object.entries(out).filter(([y, v]) => Math.abs(v / gdp(+y) * 10000 - 1) > 0.02);
console.log('重放偏差>2% 的年份', bad.length);
console.log([2000,2005,2010,2015,2020,2021,2024].map((y) => y + ':' + out[y]).join(' '));