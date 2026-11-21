// 从 scripts/_dg-stats.md 的五普/六普/七普表算出四个时代的 grow.pop / grow.jobs 倍率
import fs from 'node:fs';

const md = fs.readFileSync('scripts/_dg-stats.md', 'utf8');
const sec = md.slice(md.indexOf('## 1.'), md.indexOf('## 2.'));
const rows = [];
for (const line of sec.split('\n')) {
  const m = /^\|\s*([^|]+?)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/.exec(line);
  if (!m) continue;
  const nm = m[1].replace(/[（(].*?[)）]/g, '').replace(/街道|镇|园区|新区/g, '').trim();
  rows.push({ nm, p00: +m[2].replace(/,/g, ''), p10: +m[3].replace(/,/g, ''), p20: +m[4].replace(/,/g, '') });
}
console.log('rows', rows.length);

const ID = {
  莞城: 'guancheng', 南城: 'nancheng', 东城: 'dongcheng', 万江: 'wanjiang', 石碣: 'shijie', 石龙: 'shilong',
  茶山: 'chashan', 石排: 'shipai', 企石: 'qishi', 横沥: 'hengli', 桥头: 'qiaotou', 谢岗: 'xiegang',
  东坑: 'dongkeng', 常平: 'changping', 寮步: 'liaobu', 樟木头: 'zhangmutou', 大朗: 'dalang', 黄江: 'huangjiang',
  清溪: 'qingxi', 塘厦: 'tangxia', 凤岗: 'fenggang', 大岭山: 'dalingshan', 长安: 'changan', 虎门: 'humen',
  厚街: 'houjie', 沙田: 'shatian', 道滘: 'daojiao', 洪梅: 'hongmei', 麻涌: 'machong', 望牛墩: 'wangniudun',
  中堂: 'zhongtang', 高埗: 'gaobu', 松山湖: 'songshanhu',
};
const miss = rows.filter((r) => !ID[r.nm]).map((r) => r.nm);
console.log('unmapped', miss.join(','));

// 时代覆盖：e1 2000-2007(7/10 的 00→10 段)、e2 2008-2013(3/10 的 00→10 + 3/10 的 10→20)
//           e3 2014-2018(5/10 的 10→20)、e4 2019-(5/10 的 10→20)
const pow = (x, k) => Math.pow(Math.max(x, 1e-6), k);
function raw() {
  const out = { e1: {}, e2: {}, e3: {}, e4: {} };
  for (const r of rows) {
    const id = ID[r.nm]; if (!id) continue;
    const r10 = r.p10 / r.p00, r20 = r.p20 / r.p10;
    out.e1[id] = pow(r10, 0.7);
    out.e2[id] = pow(r10, 0.3) * pow(r20, 0.3);
    out.e3[id] = pow(r20, 0.5);
    out.e4[id] = pow(r20, 0.5);
  }
  return out;
}
function norm(m) {
  const ids = Object.keys(m);
  let s = 0; for (const id of ids) s += Math.log(m[id]);
  const g = Math.exp(s / ids.length);
  const out = {}; for (const id of ids) out[id] = +(m[id] / g).toFixed(3);
  return out;
}
const R = raw();
for (const k of Object.keys(R)) {
  const n = norm(R[k]);
  const top = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([i, v]) => i + ':' + v).join(' ');
  const bot = Object.entries(n).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([i, v]) => i + ':' + v).join(' ');
  console.log(k, '\n  top', top, '\n  bot', bot);
}
fs.writeFileSync('tools/_eras-grow.json', JSON.stringify({ e1: norm(R.e1), e2: norm(R.e2), e3: norm(R.e3), e4: norm(R.e4) }, null, 0));
console.log('wrote tools/_eras-grow.json');