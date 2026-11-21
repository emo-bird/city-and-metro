// 生成四个时代的 eras 块：grow.pop/jobs 由五普/六普/七普人口表推得，
// 产业结构与出行强度按 scripts/_dg-stats.md、scripts/_dg-history-2000-2025.md 与公开资料校正。
import fs from 'node:fs';

const grow = JSON.parse(fs.readFileSync('tools/_eras-grow.json', 'utf8'));

// 就业侧的产业倾斜（相对人口增长）：世界工厂→工业镇；腾笼换鸟→松山湖承接、水乡衰退；
// 智能终端→松山湖/大岭山/大朗研发岗位；湾区都市→滨海湾、南城、谢岗银瓶。
const JOB_TILT = {
  e1: { changan: 1.12, humen: 1.10, houjie: 1.08, tangxia: 1.08, fenggang: 1.06, qingxi: 1.06, dalang: 1.05, changping: 1.05, shijie: 1.04, gaobu: 1.04, dongkeng: 1.04, guancheng: 0.92, shilong: 0.96, wanjiang: 0.97, songshanhu: 1.30, nancheng: 1.05 },
  e2: { songshanhu: 1.35, liaobu: 1.15, nancheng: 1.15, dalang: 1.10, dalingshan: 1.06, songshan: 1.0, zhongtang: 0.92, wangniudun: 0.92, hongmei: 0.92, machong: 0.95, shilong: 0.95, guancheng: 0.94, xiegang: 1.02 },
  e3: { songshanhu: 1.85, dalingshan: 1.20, dalang: 1.20, liaobu: 1.10, humen: 1.06, changan: 1.08, tangxia: 1.04, nancheng: 1.10, binhaiwan: 1.25, guancheng: 0.95, shilong: 0.96, gaobu: 0.96 },
  e4: { binhaiwan: 1.80, songshanhu: 1.45, dalang: 1.12, nancheng: 1.15, dongcheng: 1.06, changan: 1.10, humen: 1.06, xiegang: 1.10, hongmei: 1.05, shatian: 1.08, machong: 1.06, guancheng: 0.94, shilong: 0.95 },
};
const EXTRA = { e3: { binhaiwan: 1.0 }, e4: { binhaiwan: 1.0 } };  // 填海新区在 2017 后才有片区

function norm(m) {
  const ids = Object.keys(m);
  let s = 0; for (const id of ids) s += Math.log(m[id]);
  const g = Math.exp(s / ids.length);
  const out = {}; for (const id of ids) out[id] = +(m[id] / g).toFixed(3);
  return out;
}
function jobsOf(era) {
  const pop = grow[era], tilt = JOB_TILT[era] || {}, m = {};
  for (const id in pop) m[id] = pop[id] * (tilt[id] || 1);
  // 滨海湾新区是填海新地（2017 设），人口普查里没有，按时代单独给岗位增长
  if (era === 'e3') m.binhaiwan = 1.25;
  if (era === 'e4') m.binhaiwan = 1.9;
  for (const id in EXTRA[era] || {}) m[id] = (m[id] || 1) * EXTRA[era][id];
  return norm(m);
}

// 只保留偏离中位明显的条目，避免把 33 个区全写进数据文件
function top(map, hi, lo) {
  const e = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const out = {};
  for (const [id, v] of e) if (v >= hi) out[id] = v;
  for (const [id, v] of e.slice().reverse()) if (v <= lo) out[id] = v;
  return out;
}
const fmt = (o) => '{ ' + Object.entries(o).map(([k, v]) => k + ': ' + v).join(', ') + ' }';

const ERAS = [
  {
    id: 'dg-e1', from: 2000, name: '世界工厂', tag: '三来一补',
    summary: '外资厂沿广深公路与铁路铺开，镇镇有工业区；人口以暂住的外来工为主，多数住在厂区宿舍，"厂住一体"让通勤距离很短，上学、就医、购物都压在镇内。',
    demand: { hw: 1.00, sc: 0.96, sh: 0.90, md: 0.90, lz: 0.86, decayHW: 0.62, decayHO: 0.76, hub: 0.95 },
    corridors: [
      ['humen', 'changan', 1.28], ['houjie', 'humen', 1.22], ['changan', 'dalingshan', 1.12],
      ['changping', 'zhangmutou', 1.18], ['shilong', 'shijie', 1.15], ['guancheng', 'nancheng', 1.12],
    ],
  },
  {
    id: 'dg-e2', from: 2008, name: '双转移阵痛', tag: '腾笼换鸟',
    summary: '金融危机后一批中小企业倒闭，劳动密集环节转向内陆；松山湖、寮步开始承接研发与总部，厂住分离增加，跨镇通勤变长，水乡片的造纸与服装厂外迁。',
    demand: { hw: 1.04, sc: 1.26, sh: 1.12, md: 0.95, lz: 0.95, decayHW: 0.82, decayHO: 0.86, hub: 1.00 },
        relocate: { jobs: { zhongtang: -0.0015, wangniudun: -0.0015, shilong: -0.0012, songshanhu: 0.0022, liaobu: 0.0012 } },
    corridors: [
      ['songshanhu', 'liaobu', 1.30], ['songshanhu', 'dalang', 1.25], ['songshanhu', 'dalingshan', 1.18],
      ['humen', 'changan', 1.20], ['nancheng', 'dongcheng', 1.14], ['zhongtang', 'wangniudun', 1.10],
    ],
  },
  {
    id: 'dg-e3', from: 2014, name: '松山湖与手机', tag: '智能终端',
    summary: '华为终端与一批手机供应链迁入松山湖、大岭山、大朗，研发岗位取代流水线；2 号线把东莞站与虎门站连起来，万达、万科广场进镇，购物与休闲出行明显变多。',
    demand: { hw: 1.10, sc: 1.50, sh: 1.26, md: 1.02, lz: 1.15, decayHW: 0.94, decayHO: 0.95, hub: 1.05 },
        relocate: { jobs: { guancheng: -0.0012, shilong: -0.0008, songshanhu: 0.0024, dalingshan: 0.0008, nancheng: 0.0008 } },
    corridors: [
      ['songshanhu', 'dalang', 1.40], ['songshanhu', 'dalingshan', 1.26], ['songshanhu', 'liaobu', 1.24],
      ['songshanhu', 'nancheng', 1.16], ['humen', 'changan', 1.16], ['tangxia', 'fenggang', 1.14],
    ],
  },
  {
    id: 'dg-e4', from: 2019, name: '湾区都市', tag: '湾区横轴',
    summary: '穗深城际与南沙大桥把东莞拉进广深半小时圈；滨海湾新区向海要地，深莞跨市通勤超过 24 万人，松山湖与中心城区形成双核，休闲与跨市出行继续增长，但网购分流了一部分购物出行。',
    demand: { hw: 1.16, sc: 1.44, sh: 1.38, md: 1.08, lz: 1.35, decayHW: 1.08, decayHO: 1.06, hub: 1.12 },
        relocate: { jobs: { guancheng: -0.0008, binhaiwan: 0.0026, changan: 0.0006, songshanhu: 0.0012, nancheng: 0.0006 } },
    corridors: [
      ['binhaiwan', 'changan', 1.34], ['binhaiwan', 'humen', 1.28], ['songshanhu', 'dalang', 1.34],
      ['songshanhu', 'nancheng', 1.20], ['tangxia', 'fenggang', 1.28], ['changan', 'humen', 1.18],
    ],
  },
];

const lines = [];
lines.push('    eras: [');
for (const e of ERAS) {
  const key = e.id.replace('dg-', '');
  const pop = norm(grow[key]), jobs = jobsOf(key);
  const popHi = Object.values(pop).filter((v) => v >= 1.02).length ? 1.02 : 1.02;
  lines.push(`      // ${e.name}（${e.from}–${e.id === 'dg-e1' ? 2007 : e.id === 'dg-e2' ? 2013 : e.id === 'dg-e3' ? 2018 : ' '}）：${e.tag}`);
  lines.push(`      { id: '${e.id}', from: ${e.from}, name: '${e.name}', tag: '${e.tag}',`);
  lines.push(`        summary: '${e.summary}',`);
  lines.push('        grow: {');
  lines.push(`          pop: ${fmt(top(pop, popHi, 0.98))},`);
  lines.push(`          jobs: ${fmt(top(jobs, 1.03, 0.97))},`);
  lines.push('        },');
  lines.push(`        demand: { hw: ${e.demand.hw}, sc: ${e.demand.sc}, sh: ${e.demand.sh}, md: ${e.demand.md}, lz: ${e.demand.lz}, decayHW: ${e.demand.decayHW}, decayHO: ${e.demand.decayHO}, hub: ${e.demand.hub} },`);
  if (e.relocate) {
    const part = (o) => '{ ' + Object.entries(o || {}).map(([k, v]) => k + ': ' + v).join(', ') + ' }';
    const r = e.relocate, bits = [];
    if (r.pop) bits.push('pop: ' + part(r.pop));
    if (r.jobs) bits.push('jobs: ' + part(r.jobs));
    lines.push('        relocate: { ' + bits.join(', ') + ' },');
  }
  lines.push(`        corridors: [${e.corridors.map(([a, b, f]) => `{ a: '${a}', b: '${b}', f: ${f} }`).join(', ')}], },`);
}
lines.push('    ]');
const block = lines.join('\n');

const file = 'js/data_dg.js';
const src = fs.readFileSync(file, 'utf8');
const i = src.indexOf('    eras: [');
if (i < 0) throw new Error('eras 块定位失败');
let j = i, depth = 0;
for (; j < src.length; j++) {
  const ch = src[j];
  if (ch === '[') depth++;
  else if (ch === ']') { depth--; if (depth === 0) { j++; break; } }
}
if (depth !== 0) throw new Error('eras 数组未闭合');
const out = src.slice(0, i) + block.replace(/\n$/, '') + src.slice(j);
fs.writeFileSync(file, out);
console.log(block);
console.log('\n---- 汇总 ----');
for (const e of ERAS) {
  const pop = norm(grow[e.id.replace('dg-', '')]);
  console.log(e.id, 'pop均1·最大', Math.max(...Object.values(pop)).toFixed(2), '最小', Math.min(...Object.values(pop)).toFixed(2));
}