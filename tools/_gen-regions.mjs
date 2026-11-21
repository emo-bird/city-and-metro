// 重写 js/data_dg.js 的片区块：东莞 32 镇街 + 园区按 OSM 镇界与史实开放年；市外只按市；保护地按 OSM 保护区。
// 临时生成脚本，不进发布。
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const gsrc = await readFile('js/geo_dg.js', 'utf8');
const sb = { window: { CM: {} }, console }; vm.createContext(sb); vm.runInContext(gsrc, sb);
const G = sb.window.CM.GEOS.dg;
const NAMES = new Set(G.names);
const RES = new Set((G.reserves || []).map((r) => G.names[r[0]]));
const PARK = new Set((G.parks || []).map((r) => G.names[r[0]]));

// [id, 名称, 用地, 开放年, admin 名（null=不用 admin）]
const TOWNS = [
  ['guancheng', '莞城街道', 'cbd', 1990, '莞城街道'],
  ['dongcheng', '东城街道', 'cbd', 1992, '东城街道'],
  ['nancheng', '南城街道', 'cbd', 1992, '南城街道'],
  ['wanjiang', '万江街道', 'cbd', 1995, '万江街道'],
  ['shilong', '石龙镇', 'resind', 1990, '石龙镇'],
  ['humen', '虎门镇', 'port', 1990, '虎门镇'],
  ['changan', '长安镇', 'ind', 1990, '长安镇'],
  ['changping', '常平镇', 'resind', 1990, '常平镇'],
  ['houjie', '厚街镇', 'resind', 1992, '厚街镇'],
  ['shijie', '石碣镇', 'resind', 1995, '石碣镇'],
  ['zhangmutou', '樟木头镇', 'resind', 1995, '樟木头镇'],
  ['tangxia', '塘厦镇', 'resind', 1995, '塘厦镇'],
  ['fenggang', '凤岗镇', 'resind', 1995, '凤岗镇'],
  ['qingxi', '清溪镇', 'resind', 1995, '清溪镇'],
  ['dalang', '大朗镇', 'resind', 1995, '大朗镇'],
  ['zhongtang', '中堂镇', 'resind', 1995, '中堂镇'],
  ['liaobu', '寮步镇', 'resind', 2001, '寮步镇'],
  ['dalingshan', '大岭山镇', 'resind', 2001, '大岭山镇'],
  ['huangjiang', '黄江镇', 'resind', 2001, '黄江镇'],
  ['chashan', '茶山镇', 'resind', 2001, '茶山镇'],
  ['gaobu', '高埗镇', 'resind', 2001, '高埗镇'],
  ['dongkeng', '东坑镇', 'resind', 2001, '东坑镇'],
  ['qiaotou', '桥头镇', 'resind', 2001, '桥头镇'],
  ['hengli', '横沥镇', 'resind', 2001, '横沥镇'],
  ['machong', '麻涌镇', 'port', 2001, '麻涌镇'],
  ['shatian', '沙田镇', 'port', 2003, '沙田镇'],
  ['daojiao', '道滘镇', 'resind', 2005, '道滘镇'],
  ['shipai', '石排镇', 'resind', 2005, '石排镇'],
  ['qishi', '企石镇', 'resind', 2005, '企石镇'],
  ['wangniudun', '望牛墩镇', 'resind', 2013, '望牛墩镇'],
  ['hongmei', '洪梅镇', 'resind', 2013, '洪梅镇'],
  ['xiegang', '谢岗镇', 'resind', 2013, '谢岗镇'],
  ['songshanhu', '松山湖园区', 'campus', 2001, '松山湖园区'],
  ['shengtaiyuan', '东莞生态园', 'expo', 2005, '东莞生态园'],
];
const miss = TOWNS.filter((t) => t[4] && !NAMES.has(t[4]));
if (miss.length) console.log('⚠ admin 名不在 geo 里：', miss.map((t) => t[1] + '/' + t[4]).join(', '));

const S = (v) => "'" + v + "'";
const lines = [];
lines.push('  // 片区（v3.2）：东莞 32 镇街 + 园区按 OSM 镇界划分，开放年按史实（老镇 1990–1995 开局即成熟，');
lines.push('  // 二线镇 2001–2005，水乡与银瓶三镇 2013）；市外只按市区分（广州市/深圳市/惠州市/中山市），不再逐区。');
lines.push('  // 保护区用引擎的「嵌在区里的风景区」（geo.reserve / geo.park，city.js:583），只圈真正的保护地，不整镇封闭。');
lines.push('  const REG = [');
if (RES.has('银瓶山郊野公园清溪片')) lines.push("    { id: 'yinpingshan', name: '银瓶山郊野公园', geo: { reserve: '银瓶山郊野公园清溪片' }, open: 2000, plan: 'res', scenic: true, empty: true },");
if (PARK.has('佛灵湖郊野公园')) lines.push("    { id: 'folinghu', name: '佛灵湖郊野公园', geo: { park: '佛灵湖郊野公园' }, open: 2000, plan: 'res', scenic: true, empty: true },");
for (const [id, nm, plan, open, admin] of TOWNS) {
  if (admin && !NAMES.has(admin)) continue;
  lines.push(`    { id: '${id}', name: '${nm}', geo: { admin: '${admin}' }, open: ${open}, plan: '${plan}' },`);
}
lines.push('    // 市外（v3.2 引擎机制 passOnly）：只区分哪个市，线路可以穿过，不能设站');
const OUT = [['gz_out', '广州市', '广州市（市外）', 'mix'], ['sz_out', '深圳市', '深圳市（市外）', 'ind'], ['hz_out', '惠州市', '惠州市（市外）', 'res'], ['zs_out', '中山市', '中山市（市外）', 'res']];
for (const [id, admin, nm, plan] of OUT) {
  if (!NAMES.has(admin)) { console.log('⚠ 缺市级边界：' + admin); continue; }
  lines.push(`    { id: '${id}', name: '${nm}', geo: { admin: '${admin}' }, open: 1990, plan: '${plan}', passOnly: true, lockNote: '不属于东莞市的建设范围：线路可以穿过，不能设站' },`);
}
lines.push('  ];');
lines.push('  const regions = REG;');
const block = lines.join('\n');

let s = await readFile('js/data_dg.js', 'utf8');
const start = s.indexOf('  const REG = [');
const endMark = '  const growAll = {};';
const end = s.indexOf(endMark);
if (start < 0 || end < 0) throw new Error('找不到片区块');
s = s.slice(0, start) + block + '\n' + s.slice(end);
// 历史城区只留莞城
s = s.replace("regions: ['dg3', 'dg4', 'dg5'], guards:", "regions: ['guancheng'], guards:");
await writeFile('js/data_dg.js', s);
console.log('片区已重写，条数', REGCOUNT());
function REGCOUNT() { return block.split('\n    { id:').length - 1; }