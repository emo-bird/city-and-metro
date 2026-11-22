// 用四经普（2018 年末）分镇街法人单位从业人员 重写 centers 的 jobs 峰值
// 2000 年岗位 ≈ 2018 年就业 × (2000 常住 / 2020 常住)（按人口规模折算起步份额）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

// 2018 年末法人单位从业人员（万人），来源 docs/东莞调研·补全结果.md A2-表4
const EMP18 = {
  东城: 36.49, 南城: 29.10, 万江: 13.09, 莞城: 11.23, 石碣: 14.17, 石龙: 5.61,
  茶山: 10.86, 石排: 11.78, 企石: 7.59, 横沥: 14.46, 桥头: 13.48, 谢岗: 5.92,
  东坑: 10.55, 常平: 23.70, 寮步: 24.58, 樟木头: 8.53, 大朗: 20.42, 黄江: 14.30,
  清溪: 23.84, 塘厦: 38.18, 凤岗: 20.07, 大岭山: 17.29, 长安: 50.27, 虎门: 37.55,
  厚街: 29.45, 沙田: 8.68, 道滘: 6.56, 洪梅: 3.13, 麻涌: 6.64, 望牛墩: 3.52,
  中堂: 6.60, 高埗: 11.73, 松山湖: 16.07, 生态园: 2.0,
};
// 2000 / 2020 常住（万人），来源 docs/东莞调研·镇街人口与经济底表.md（七普）
const POP = {
  莞城: [14.0, 17.40], 石龙: [12.9, 14.48], 虎门: [57.75, 83.81], 东城: [33.06, 59.72],
  万江: [15.64, 32.89], 南城: [19.44, 41.83], 中堂: [11.66, 20.73], 望牛墩: [6.61, 8.78],
  麻涌: [9.65, 16.53], 石碣: [20.56, 28.23], 高埗: [13.0, 20.09], 道滘: [10.61, 17.38],
  洪梅: [3.92, 6.53], 沙田: [9.78, 21.27], 厚街: [36.82, 55.08], 长安: [59.47, 80.74],
  寮步: [24.65, 51.31], 大岭山: [17.58, 27.28], 大朗: [25.33, 55.68], 黄江: [16.38, 23.29],
  樟木头: [13.16, 17.39], 清溪: [28.11, 34.43], 塘厦: [31.5, 62.90], 凤岗: [30.41, 42.12],
  谢岗: [8.23, 10.62], 常平: [36.18, 44.49], 桥头: [11.93, 20.73], 横沥: [13.39, 27.89],
  东坑: [10.34, 18.79], 企石: [10.74, 16.94], 石排: [11.46, 23.52], 茶山: [16.38, 21.93],
  松山湖: [1.5, 12.08], 生态园: [0.6, 3.0], // 生态园无独立人口，按功能区折算
};

// id → 中文名（取 data_dg 的 regions）
const reg = [...s.matchAll(/\{ id: '(\w+)', name: '([^']+)'/g)].map(m => [m[1], m[2]]);
const NAME = new Map(reg.map(([id, nm]) => [id, nm.replace(/（市外）$/, '').replace(/(街道|镇|园区|新区)$/, '')]));

// centers 行
const lines = [...s.matchAll(/^ {6}\{ x: ([\d.]+), y: ([\d.]+), pop: (\d+), jobs: (\d+), r: ([\d.]+) \},$/gm)];
if (lines.length !== 34) throw new Error('centers 行数异常: ' + lines.length);

// 片区 id 顺序与 _gen-centers.mjs 的 T 表一致：用 x/y 匹配
const T = [
  ['guancheng', 102.8, 55.8], ['dongcheng', 118.4, 61.3], ['nancheng', 93.1, 82.5], ['wanjiang', 80.4, 54.3],
  ['shilong', 146.5, 26.5], ['humen', 75.3, 160.1], ['changan', 106.7, 169.2], ['changping', 210.1, 88.3],
  ['houjie', 72.5, 109.0], ['shijie', 118.1, 27.9], ['zhangmutou', 238.1, 112.6], ['tangxia', 235.5, 163.2],
  ['fenggang', 265.2, 194.6], ['qingxi', 265.9, 148.9], ['dalang', 175.2, 112.7], ['zhongtang', 66.5, 30.2],
  ['liaobu', 145.0, 73.1], ['dalingshan', 131.4, 115.0], ['huangjiang', 201.7, 129.1], ['chashan', 152.0, 46.3],
  ['gaobu', 94.8, 31.0], ['dongkeng', 176.6, 75.7], ['qiaotou', 238.3, 65.4], ['hengli', 192.8, 61.1],
  ['machong', 24.2, 59.8], ['shatian', 38.2, 122.2], ['daojiao', 59.7, 79.4], ['shipai', 181.1, 35.2],
  ['qishi', 220.9, 44.6], ['wangniudun', 53.2, 54.7], ['hongmei', 40.6, 84.0], ['xiegang', 265.1, 87.6],
  ['songshanhu', 155.2, 112.2], ['shengtaiyuan', 166.4, 53.5],
];

const out = [];
const report = [];
for (let k = 0; k < 34; k++) {
  const m = lines[k];
  const x = +m[1], y = +m[2], pop = +m[3], r = +m[5];
  // 找最近的 T 项确定 id
  let best = null, bd = 1e9;
  for (const [id, tx, ty] of T) {
    const d = Math.hypot(tx - x, ty - y);
    if (d < bd) { bd = d; best = id; }
  }
  if (bd > 2) throw new Error('centers 第 ' + k + ' 行匹配不到片区: ' + x + ',' + y);
  const nm = NAME.get(best);
  const ALIAS = { 东莞生态园: '生态园' };
  const nm2 = ALIAS[nm] || nm;
  const emp = EMP18[nm2];
  const pp = POP[nm2];
  if (!emp || !pp) throw new Error('缺数据: ' + best + '/' + nm);
  const f = Math.min(0.85, Math.max(0.25, pp[0] / pp[1]));
  const S = Math.PI * r * r;
  const jobs = Math.round((emp * 1e4 * f) / S);
  out.push('      { x: ' + x + ', y: ' + y + ', pop: ' + pop + ', jobs: ' + jobs + ', r: ' + r + ' },');
  report.push([nm, emp, pp[0], pp[1], f.toFixed(2), jobs, (jobs * S / 1e4).toFixed(1)]);
}

const i0 = s.indexOf('    centers: [');
const j0 = s.indexOf('    ],', i0);
if (i0 < 0 || j0 < 0) throw new Error('未找到 centers 块');
s = s.slice(0, i0) +
  '    // 岗位：四经普（2018）分镇街从业人员 ×（2000 常住/2020 常住）起步折算，见 docs/东莞调研·补全结果.md\n' +
  '    centers: [\n' + out.join('\n') + '\n' + s.slice(j0);
await writeFile(p, s);
const tot = report.reduce((a, r) => a + +r[6], 0);
console.log('centers jobs 已重写：' + out.length + ' 条，折算 2000 年岗位合计 ' + tot.toFixed(0) + ' 万');
for (const r of report) console.log(r.join('\t'));