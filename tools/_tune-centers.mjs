// 估算 centers + rural 在开局年份产生的「城区格」占比
// 引擎判据（js/city.js:107）：(p + jb) * densityScale > 2600，p/jb 是「每平方公里」密度，densityScale 默认 1
// 噪声按均值 1.0 估计（引擎 p *= 0.7+0.6*fbm，jb *= 0.65+0.7*hash）
const W = 320, H = 240, TH = 2600;
const rural = { pop: 90, jobs: 26 };
const centers = JSON.parse(process.argv[2] || 'null');
if (!centers) { console.log('usage: node _tune-centers.mjs "<json>" [scaleR] [scalePop]'); process.exit(0); }
const scaleR = +(process.argv[3] || 1), scalePop = +(process.argv[4] || 1);
let n = 0;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const cx = i + 0.5, cy = j + 0.5;
  let p = rural.pop, jb = rural.jobs;
  for (const ct of centers) {
    const d = Math.hypot(cx - ct[0], cy - ct[1]) / (Math.max(0.4, ct[4] * scaleR) * 4);
    const w = Math.exp(-d * d);
    p += ct[2] * scalePop * w; jb += ct[3] * scalePop * w;
  }
  if (p + jb > TH) n++;
}
console.log('城区格', n, '占比', (n / (W * H) * 100).toFixed(1) + '%');