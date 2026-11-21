// 生成 js/data_dg.js 的「车站 / 地标 / 设施 / 背景交通」整段（可重复执行）。临时工具，不进发布。
import { readFile, writeFile } from 'node:fs/promises';

const lines = JSON.parse(await readFile('tools/dg-bg-lines2.json', 'utf8'));

// 渡轮：虎门渡口（东岸）— 南沙渡口（西岸），1991 年通航，2019 年 5 月南沙大桥通车后停航
const FERRY = {
  id: 'dg-ferry', kind: 'ferry', name: '虎门—南沙汽车渡轮', speed: 14, head: 30, y0: [1991, 6], y1: [2019, 5],
  stops: [['虎门渡口', 64.6, 180.2], ['南沙渡口', 48.3, 180.2]],
};
const ALL = lines.concat([FERRY]);
// INMAP：图外站点去掉，只留走向（同深圳图：线路只超出边缘一点点）
const MAPW = 320, MAPH = 240;
for (const L of ALL) {
  if (!L.stops) continue;
  L.stops = L.stops.filter((p) => p[1] >= 0 && p[2] >= 0 && p[1] <= MAPW && p[2] <= MAPH);
}

// 车站：同名合并，取最早的开通年
const BIG = new Set(['东莞', '常平', '东莞东', '虎门', '东莞西', '东莞南', '长安', '樟木头', '深圳机场北', '平湖', '光明城', '常平南', '西平西', '虎门北', '虎门东']);
const station = new Map();
for (const L of lines) {
  for (const [nm, x, y] of L.stops) {
    const y0 = Array.isArray(L.y0) ? L.y0[0] : L.y0;
    const cur = station.get(nm);
    if (!cur) station.set(nm, { x, y, year: y0, hsr: !!L.hsr, kind: L.kind });
    else { if (y0 < cur.year) cur.year = y0; if (L.hsr) cur.hsr = true; }
  }
}

// 非铁路地标（位置按 OSM 与公开坐标核对；w/d 为米）
const POI = [
  ['可园', 'ke yuan', 103.9, 55.9, 130, 100, 1850, 'traditional'],
  ['鸦片战争博物馆', 'opium war museum', 69.3, 156.3, 190, 150, 1957, 'museum'],
  ['广东现代国际展览中心', 'guangdong modern international exhibition center', 63.8, 117.3, 420, 300, 2003, 'expo'],
  ['东莞玉兰大剧院', 'yulan grand theatre', 101.4, 66.0, 160, 140, 2005, 'opera'],
  ['东莞图书馆', 'dongguan library', 101.8, 66.6, 150, 130, 2005, 'library'],
  ['东莞篮球中心', 'dongguan basketball center', 155.6, 75.5, 210, 190, 2014, 'stadium'],
  ['民盈国贸中心', 'minying guomao center', 105.3, 66.2, 90, 90, 2021, 'skyscraper'],
  ['华为溪流背坡村', 'huawei ox horn campus', 154.8, 119.4, 340, 300, 2018, 'campus'],
];

const LAND = [], FAC = [];
let k = 0;
for (const [nm, s] of station) {
  const id = 'dgst' + (++k);
  const big = BIG.has(nm);
  const w = big ? 260 : 150, d = big ? 110 : 64;
  LAND.push(`    { id: '${id}', name: '${nm}', x: ${s.x}, y: ${s.y}, w: ${w}, d: ${d}, year: ${s.year}, kind: 'rail' },`);
  const pax = s.hsr
    ? `[[${s.year}, 0.6], [${s.year + 8}, 3.2], [2020, 6.5], [2025, 8.5]]`
    : (big ? `[[${s.year}, 0.2], [${s.year + 10}, 1.8], [2020, 4.5], [2025, 6.0]]`
      : `[[${s.year}, 0.05], [${s.year + 8}, 0.5], [2020, 1.2], [2025, 1.8]]`);
  FAC.push(`    { id: 'dgf${k}', n: '${nm}', t: 'rail', lm: '${id}', pax: ${pax} },`);
}
// 渡口
LAND.push(`    { id: 'dgst' + 90, name: '虎门渡口', x: 64.6, y: 180.2, w: 90, d: 60, year: 1991, kind: 'ferry' },`);
LAND.push(`    { id: 'dgst' + 91, name: '南沙渡口', x: 48.3, y: 180.2, w: 90, d: 60, year: 1991, kind: 'ferry' },`);
FAC.push(`    { id: 'dgf90', n: '虎门渡口', t: 'ferry', lm: 'dgst90', pax: [[1991, 0.6], [2000, 1.2], [2010, 0.8], [2019, 0.2]] },`);
FAC.push(`    { id: 'dgf91', n: '南沙渡口', t: 'ferry', lm: 'dgst91', pax: [[1991, 0.6], [2000, 1.2], [2010, 0.8], [2019, 0.2]] },`);
// 非铁路地标
let pk = 100;
for (const [nm, en, x, y, w, d, year, kind] of POI) {
  const id = 'dgl' + (++pk);
  LAND.push(`    { id: '${id}', name: '${nm}', x: ${x}, y: ${y}, w: ${w}, d: ${d}, year: ${year}, kind: '${kind}' },`);
}

const LINESRC = ALL.map((L) => {
  const y0 = Array.isArray(L.y0) ? `[${L.y0[0]}, ${L.y0[1]}]` : L.y0;
  const y1 = Array.isArray(L.y1) ? `, y1: [${L.y1[0]}, ${L.y1[1]}]` : '';
  const path = L.path ? `, path: ${JSON.stringify(L.path)}` : '';
  const hsr = L.hsr ? ', hsr: true' : '';
  return `      { id: ${JSON.stringify(L.id)}, kind: '${L.kind}', name: ${JSON.stringify(L.name)}, speed: ${L.speed}, head: ${L.head}, y0: ${y0}${y1}${hsr}, stops: ${JSON.stringify(L.stops)}${path} },`;
}).join('\n');

const block = `  // ===== 车站 / 地标 / 设施 / 背景交通（走向来自 OSM，站点按 1990–2025 仍在运营的客运站）=====
  DATA.landmarks = [
${LAND.join('\n')}
  ];
  DATA.facilities = [
${FAC.join('\n')}
  ];
  DATA.bg = {
    name: '城际铁路与渡轮',
    // 有 lines 的地图不走「全市比重」模式，但 eras.js 仍会读 share/speed/wait，必须给曲线（同 data_sy.js）
    share: [[1990, 0], [2060, 0]],
    speed: [[1990, 18], [2060, 30]],
    wait: [[1990, 15], [2060, 10]],
    maxShare: 0.45,
    waitCap: 12,
    // 平均单程票价（元）：普速与城际按里程分档，随年份上涨；渡轮 1991–2019
    fares: { rail: [[1911, 0.6], [1950, 1.2], [1990, 4], [2005, 9], [2020, 16]], ferry: [[1991, 3], [2000, 5], [2010, 8], [2019, 10]] },
    lines: [
${LINESRC}
    ],
  };
`;
await writeFile('tools/dg-bg2.txt', block);
console.log('车站', station.size, '地标', LAND.length, '设施', FAC.length, '线路', ALL.length);
console.log('片段长度', block.length);