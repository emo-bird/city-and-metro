// 估算宏观曲线：给定期望的 2000 与 2021 名义 GDP（万元），反解 prod 曲线
const INFL_CN = [[2000,0.004],[2001,0.007],[2002,-0.008],[2003,0.012],[2004,0.039],[2005,0.018],[2006,0.015],[2007,0.048],[2008,0.059],[2009,-0.007],[2010,0.033],[2011,0.054],[2012,0.026],[2013,0.026],[2014,0.02],[2015,0.014],[2016,0.02],[2017,0.016],[2018,0.021],[2019,0.029],[2020,0.025]];
const POP = [[2000,6.44e6],[2005,7.2e6],[2010,8.22e6],[2015,8.9e6],[2020,10.47e6],[2030,11.2e6],[2045,11.8e6],[2070,12.2e6],[2300,12.4e6]];
const JR = [[2000,0.62],[2010,0.63],[2020,0.64],[2030,0.645]];
function interp(arr, x) { if (x <= arr[0][0]) return arr[0][1]; for (let i = 1; i < arr.length; i++) if (x <= arr[i][0]) { const a = arr[i-1], b = arr[i]; return a[1] + (b[1]-a[1]) * (x-a[0])/(b[0]-a[0]); } return arr[arr.length-1][1]; }
const prod = [[2000,0.088],[2004,0.105],[2008,0.095],[2012,0.082],[2016,0.068],[2020,0.052],[2025,0.045],[2035,0.035],[2060,0.025]];
const gdp0 = 8900000; // 万元 = 890 亿（2000 年东莞 GDP 888.69 亿）
const jobs0 = interp(POP, 2000) * interp(JR, 2000);
const K = gdp0 / jobs0;
let pi = 1, price = 1;
const out = [];
for (let y = 2001; y <= 2030; y++) {
  pi *= 1 + interp(prod, y);
  price *= 1 + interp(INFL_CN, y);
  const jobs = interp(POP, y) * interp(JR, y);
  out.push([y, +(K * jobs * pi * price / 10000).toFixed(0)]); // 亿元
}
console.log('K', K.toFixed(4));
console.log('2000 GDP 亿', (gdp0/10000).toFixed(0));
console.log(out.map(([y, v]) => y + ':' + v).join(' '));
const at = (y) => out.find((o) => o[0] === y)[1];
console.log('2010', at(2010), '真实 4278');
console.log('2020', at(2020), '真实 9650');
console.log('2021', at(2021), '真实 10855');
console.log('2024', at(2024), '真实约 12200');