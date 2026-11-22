// 用重力模型给「分镇街 OD」补走廊（调研查不到真实 OD，用人口×岗位/距离^1.2 估算）
import { readFile, writeFile } from 'node:fs/promises';

// [id, 2000 常住万人, 2020 常住万人, 2018 法人单位从业人员万人, 质心x, 质心y]
const T = [
  ['guancheng', 14.0, 17.4, 11.23, 102.8, 55.8], ['dongcheng', 33.06, 59.72, 36.49, 118.4, 61.3],
  ['nancheng', 19.44, 41.83, 29.10, 93.1, 82.5], ['wanjiang', 15.64, 32.89, 13.09, 80.4, 54.3],
  ['shilong', 12.9, 14.48, 5.61, 146.5, 26.5], ['humen', 57.75, 83.81, 37.55, 75.3, 160.1],
  ['changan', 59.47, 80.74, 50.27, 106.7, 169.2], ['changping', 36.18, 44.49, 23.70, 210.1, 88.3],
  ['houjie', 36.82, 55.0, 29.45, 72.5, 109.0], ['shijie', 20.56, 28.23, 14.17, 118.1, 27.9],
  ['zhangmutou', 13.16, 17.39, 8.53, 238.1, 112.6], ['tangxia', 31.5, 62.9, 38.18, 235.5, 163.2],
  ['fenggang', 30.41, 41.79, 20.07, 265.2, 194.6], ['qingxi', 28.11, 34.8, 23.84, 265.9, 148.9],
  ['dalang', 25.33, 55.68, 20.42, 175.2, 112.7], ['zhongtang', 11.66, 13.94, 6.60, 66.5, 30.2],
  ['liaobu', 24.65, 51.31, 24.58, 145.0, 73.1], ['dalingshan', 17.58, 28.67, 17.29, 131.4, 115.0],
  ['huangjiang', 16.38, 23.87, 14.30, 201.7, 129.1], ['chashan', 16.38, 20.23, 10.86, 152.0, 46.3],
  ['gaobu', 13.0, 16.99, 11.73, 94.8, 31.0], ['dongkeng', 10.34, 19.06, 10.55, 176.6, 75.7],
  ['qiaotou', 11.93, 18.45, 13.48, 238.3, 65.4], ['hengli', 13.39, 26.79, 14.46, 192.8, 61.1],
  ['machong', 9.65, 16.52, 6.64, 24.2, 59.8], ['shatian', 9.78, 20.44, 8.68, 38.2, 122.2],
  ['daojiao', 10.61, 14.29, 6.56, 59.7, 79.4], ['shipai', 11.46, 22.73, 11.78, 181.1, 35.2],
  ['qishi', 10.74, 16.6, 7.59, 220.9, 44.6], ['wangniudun', 6.61, 8.62, 3.52, 53.2, 54.7],
  ['hongmei', 3.92, 6.53, 3.13, 40.6, 84.0], ['xiegang', 8.23, 10.62, 5.92, 265.1, 87.6],
  ['songshanhu', 1.5, 12.08, 16.07, 155.2, 112.2], ['shengtaiyuan', 0.6, 2.0, 2.00, 166.4, 53.5],
  ['binhaiwan', 0.0, 3.0, 0.60, 97.5, 183.3],
];
const CN = {
  guancheng: '莞城街道', dongcheng: '东城街道', nancheng: '南城街道', wanjiang: '万江街道', shilong: '石龙镇',
  humen: '虎门镇', changan: '长安镇', changping: '常平镇', houjie: '厚街镇', shijie: '石碣镇',
  zhangmutou: '樟木头镇', tangxia: '塘厦镇', fenggang: '凤岗镇', qingxi: '清溪镇', dalang: '大朗镇',
  zhongtang: '中堂镇', liaobu: '寮步镇', dalingshan: '大岭山镇', huangjiang: '黄江镇', chashan: '茶山镇',
  gaobu: '高埗镇', dongkeng: '东坑镇', qiaotou: '桥头镇', hengli: '横沥镇', machong: '麻涌镇',
  shatian: '沙田镇', daojiao: '道滘镇', shipai: '石排镇', qishi: '企石镇', wangniudun: '望牛墩镇',
  hongmei: '洪梅镇', xiegang: '谢岗镇', songshanhu: '松山湖园区', shengtaiyuan: '东莞生态园', binhaiwan: '滨海湾新区',
};
// 各时代取的人口年与岗位缩放（岗位结构用 2018 四经普，按全市就业总量缩放）
const ERAS = [
  { id: 'dg-e1', popY: 2000, emp: 0.63 },
  { id: 'dg-e2', popY: 2010, emp: 0.66 },
  { id: 'dg-e3', popY: 2015, emp: 0.66 },
  { id: 'dg-e4', popY: 2020, emp: 0.683 },
  { id: 'dg-e5', popY: 2030, emp: 0.69 },
];
const popAt = (t, y) => {
  // 2000/2010/2015/2020 用普查；2030 按 2020→2030 趋势外推（全市 11.2e6 / 10.47e6）
  const f = y === 2000 ? 0 : y === 2010 ? 0.35 : y === 2015 ? 0.55 : y === 2020 ? 1 : 1.28;
  return t[1] + (t[2] - t[1]) * f;
};
const baseJobs = T.reduce((a, t) => a + t[3], 0);

function flows(era) {
  const pops = T.map(t => popAt(t, era.popY));
  const tot = pops.reduce((a, b) => a + b, 0);
  const kk = (tot * era.emp) / baseJobs;             // 把 2018 岗位结构缩放到当年总量
  const jobs = T.map(t => t[3] * kk);
  const out = [];
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const dx = T[i][4] - T[j][4], dy = T[i][5] - T[j][5];
    const d = Math.max(1.2, Math.hypot(dx, dy) * 0.25);   // 格 → km
    const f = (pops[i] * jobs[j] + pops[j] * jobs[i]) / Math.pow(d, 1.2);
    out.push({ a: T[i][0], b: T[j][0], d: d, f: f });
  }
  out.sort((x, y) => y.f - x.f);
  const top = out[0].f;
  return out.map(o => ({ a: o.a, b: o.b, d: o.d, f: 1 + 0.42 * (o.f / top) }));
}

const lines = [];
for (const era of ERAS) {
  const fl = flows(era).slice(0, 12);
  lines.push('### ' + era.id + '（' + era.popY + ' 年，就业率 ' + era.emp + '）');
  lines.push('| 走廊 | 直线距离 km | 强度 f |');
  lines.push('| --- | --- | --- |');
  for (const o of fl) lines.push('| ' + CN[o.a] + '—' + CN[o.b] + ' | ' + o.d.toFixed(1) + ' | ' + o.f.toFixed(2) + ' |');
  lines.push('');
}
await writeFile('tools/_grav-out.md', lines.join('\n') + '\n');

// 把模型走廊合并进数据：只补「现有数据里没有、且模型强度 ≥1.15」的对，每时代最多 10 对
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
let added = 0;
for (const era of ERAS) {
  const fl = flows(era).filter(o => o.f >= 1.15).slice(0, 6);
  const at = s.indexOf("id: '" + era.id + "'");
  if (at < 0) continue;
  const cStart = s.indexOf('corridors: [', at);
  const cEnd = s.indexOf(']', cStart);
  const block = s.slice(cStart, cEnd);
  const extra = [];
  for (const o of fl) {
    const has = new RegExp("a: '" + o.a + "', b: '" + o.b + "'").test(block) ||
                new RegExp("a: '" + o.b + "', b: '" + o.a + "'").test(block);
    if (has) continue;
    const n = (block.match(/\{ a:/g) || []).length + extra.length;
    if (n >= 10) break;
    extra.push('{ a: \'' + o.a + '\', b: \'' + o.b + '\', f: ' + o.f.toFixed(2) + ' }');
  }
  if (!extra.length) continue;
  const insertAt = block.lastIndexOf('}') + 1;
  const sep = block.slice(insertAt).trim().startsWith(']') && !block.slice(0, insertAt).trim().endsWith(',') ? ', ' : ', ';
  s = s.slice(0, cStart + insertAt) + sep + extra.join(', ') + s.slice(cStart + insertAt);
  added += extra.length;
}
await writeFile(p, s);
console.log('模型走廊表已写入 tools/_grav-out.md；数据新增', added, '对走廊');