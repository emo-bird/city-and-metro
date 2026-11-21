// 反解：按真实东莞 GDP（亿元）标定 prod 曲线
const INFL_CN = { 2000:0.004,2001:0.007,2002:-0.008,2003:0.012,2004:0.039,2005:0.018,2006:0.015,2007:0.048,2008:0.059,2009:-0.007,2010:0.033,2011:0.054,2012:0.026,2013:0.026,2014:0.02,2015:0.014,2016:0.02,2017:0.016,2018:0.021,2019:0.029,2020:0.025,2021:0.009,2022:0.02,2023:0.002,2024:0.002 };
const POP = [[2000,6.44e6],[2005,7.2e6],[2010,8.22e6],[2015,8.9e6],[2020,10.47e6],[2030,11.2e6],[2045,11.8e6],[2070,12.2e6],[2300,12.4e6]];
const JR = [[2000,0.62],[2010,0.63],[2020,0.64],[2030,0.645]];
const GDP = { 2000:890, 2005:2182, 2010:4278, 2015:6275, 2020:9650, 2021:10855, 2024:12200 };
function interp(arr, x) { if (x <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (x <= arr[i][0]) { const a = arr[i-1], b = arr[i]; return a[1] + (b[1]-a[1]) * (x-a[0])/(b[0]-a[0]); } return arr[arr.length-1][1]; }
let price = 1, pi = 1;
const rows = [];
for (let y = 2001; y <= 2024; y++) {
  price *= 1 + (INFL_CN[y] != null ? INFL_CN[y] : 0.02);
  rows.push({ y, price, jobs: interp(POP, y) * interp(JR, y) });
}
// 2000 基准
const base = { price0: 1, jobs0: interp(POP, 2000) * interp(JR, 2000), gdp0: 890 };
// 需要的 prodIdx(y) = GDP(y)/GDP0 / (jobs(y)/jobs0) / (price(y)/price0)
const need = rows.filter((r) => GDP[r.y]).map((r) => {
  const ratio = (GDP[r.y] / base.gdp0) / (r.jobs / base.jobs0) / r.price;
  return { y: r.y, ratio };
});
console.log(need.map((n) => n.y + ':' + n.ratio.toFixed(3)).join(' '));
// 逐年同比 → prod 年增速
for (let i = 0; i < need.length; i++) {
  const a = i ? need[i-1] : { y: 2000, ratio: 1 };
  const span = need[i].y - a.y;
  const g = Math.pow(need[i].ratio / a.ratio, 1 / span) - 1;
  console.log(need[i].y, '窗口', a.y + '→' + need[i].y, '年均', (g * 100).toFixed(1) + '%');
}