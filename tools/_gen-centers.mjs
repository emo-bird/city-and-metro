// 按 2000 年五普的各镇街常住人口重写 centers（位置用各片区的格质心，密度按高斯尺度反推）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

// [id, 五普常住万人, 岗位/人口比, 格数, 质心x, 质心y]
const T = [
  ['guancheng', 14.0, 0.55, 195, 102.8, 55.8],
  ['dongcheng', 33.06, 0.55, 1354, 118.4, 61.3],
  ['nancheng', 19.44, 0.55, 797, 93.1, 82.5],
  ['wanjiang', 15.64, 0.55, 766, 80.4, 54.3],
  ['shilong', 12.9, 0.72, 222, 146.5, 26.5],
  ['humen', 57.75, 0.62, 2414, 75.3, 160.1],
  ['changan', 59.47, 0.72, 1501, 106.7, 169.2],
  ['changping', 36.18, 0.62, 1652, 210.1, 88.3],
  ['houjie', 36.82, 0.72, 1556, 72.5, 109.0],
  ['shijie', 20.56, 0.72, 564, 118.1, 27.9],
  ['zhangmutou', 13.16, 0.62, 818, 238.1, 112.6],
  ['tangxia', 31.5, 0.72, 1791, 235.5, 163.2],
  ['fenggang', 30.41, 0.72, 939, 265.2, 194.6],
  ['qingxi', 28.11, 0.72, 972, 265.9, 148.9],
  ['dalang', 25.33, 0.72, 1246, 175.2, 112.7],
  ['zhongtang', 11.66, 0.72, 932, 66.5, 30.2],
  ['liaobu', 24.65, 0.72, 1011, 145.0, 73.1],
  ['dalingshan', 17.58, 0.72, 1150, 131.4, 115.0],
  ['huangjiang', 16.38, 0.72, 744, 201.7, 129.1],
  ['chashan', 16.38, 0.72, 759, 152.0, 46.3],
  ['gaobu', 13.0, 0.72, 554, 94.8, 31.0],
  ['dongkeng', 10.34, 0.72, 386, 176.6, 75.7],
  ['qiaotou', 11.93, 0.72, 889, 238.3, 65.4],
  ['hengli', 13.39, 0.72, 758, 192.8, 61.1],
  ['machong', 9.65, 0.7, 1435, 24.2, 59.8],
  ['shatian', 9.78, 0.7, 1691, 38.2, 122.2],
  ['daojiao', 10.61, 0.72, 864, 59.7, 79.4],
  ['shipai', 11.46, 0.72, 800, 181.1, 35.2],
  ['qishi', 10.74, 0.72, 916, 220.9, 44.6],
  ['wangniudun', 6.61, 0.42, 506, 53.2, 54.7],
  ['hongmei', 3.92, 0.42, 525, 40.6, 84.0],
  ['xiegang', 8.23, 0.42, 953, 265.1, 87.6],
  ['songshanhu', 1.5, 0.8, 917, 155.2, 112.2],
  ['shengtaiyuan', 0.6, 0.5, 356, 166.4, 53.5],
];

const rows = T.map(([id, wan, jr, cells, cx, cy]) => {
  // 高斯尺度：每格 250 m，ct.r*4 格是衰减半径 → 面积 π(r)² km²
  const r = Math.max(0.7, Math.min(1.7, 0.5 + 0.03 * Math.sqrt(cells)));
  const S = Math.PI * r * r;
  const pop = Math.round((wan * 1e4) / S);
  const jobs = Math.round((wan * 1e4 * jr) / S);
  return '      { x: ' + cx + ', y: ' + cy + ', pop: ' + pop + ', jobs: ' + jobs + ', r: ' + r.toFixed(2) + ' },';
});

const i = s.indexOf('    centers: [');
const j = s.indexOf('    ],', i);
if (i < 0 || j < 0) throw new Error('未找到 centers 块');
const head = s.slice(0, i);
const tail = s.slice(j);
s = head + '    // 2000 年五普各镇街常住人口（万人）→ 峰值密度；位置取片区格质心，r 由片区面积定\n    centers: [\n' + rows.join('\n') + '\n' + tail;
await writeFile(p, s);
console.log('centers 已按五普重写', rows.length, '条（合计', T.reduce((a, b) => a + b[1], 0).toFixed(1), '万）');