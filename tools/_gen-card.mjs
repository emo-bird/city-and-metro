// 把地图卡片上残留的「占位」文案换成真实描述（纯数据）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const OLD_HEAD = "    id: 'dg', name: '东莞', title: '东莞', sub: '占位地图 · 地理与区域已就绪',\n    region: '中国内地', tagline: '珠江口东岸', difficulty: 2, tags: ['占位'],";
const NEW_HEAD = "    id: 'dg', name: '东莞', title: '东莞 · 2000', sub: '真实地理 · 2000 年起 · 世界工厂与镇域网络',\n    region: '中国内地', tagline: '珠江口东岸', difficulty: 3, tags: ['镇域网络', '世界工厂', '湾区东岸'],";
if (!s.includes(OLD_HEAD)) throw new Error('未找到卡片头部');
s = s.replace(OLD_HEAD, NEW_HEAD);

const OLD_INTRO = "    intro: '占位地图：地理数据与行政区域来自 OpenStreetMap，年代、地标、设施、任务尚未填写。当前用途是检查地图数据能否正确载入与显示。',";
const NEW_INTRO = "    intro: '2000 年的东莞是一座「镇镇点火」的世界工厂：644 万常住人口里七成六是外来工，厂房沿广深公路铺满 32 个镇街，没有一个真正意义上的市中心。此后二十年，双转移与金融危机洗掉低端产线，松山湖接住华为，虎门通了高铁，滨海湾在滩涂上填海，2021 年 GDP 破万亿。',";
if (!s.includes(OLD_INTRO)) throw new Error('未找到 intro');
s = s.replace(OLD_INTRO, NEW_INTRO);

const OLD_FEAT = "    features: [['map', '真实地理', '东江、珠江口、道路、铁路与地名来自 OpenStreetMap'], ['building', '按镇街分区', '区域按行政边界切分，东莞 32 镇街 + 图内广深惠中部分']],\n    highlights: [[1990, '占位']],";
const NEW_FEAT = [
  "    features: [",
  "      ['map', '真实地理', '东江、珠江口、道路与铁路来自 OpenStreetMap；山体与保护区不可开发'],",
  "      ['factory', '世界工厂', '32 镇街按 2000 年五普人口开放，工业带沿广深公路铺开'],",
  "      ['train', '镇际铁路', '广深、穗深、莞惠、广深港、京港在图上按真实走向铺设，图外不设站'],",
  "      ['building', '时代四段', '世界工厂 → 双转移阵痛 → 松山湖与手机 → 湾区都市'],",
  "      ['coin', '万亿之城', '名义 GDP 按统计公报标定：2000 年 831 亿 → 2021 年 10855 亿'],",
  "      ['car', '私家车之城', '机动车 2000–2024 增长 28 倍，治堵与接驳贯穿四个时代'],",
  "    ],",
  "    highlights: [[2000, '世界工厂'], [2008, '双转移'], [2014, '松山湖与手机'], [2019, '湾区都市'], [2021, '万亿之城']],",
].join('\n');
if (!s.includes(OLD_FEAT)) throw new Error('未找到 features');
s = s.replace(OLD_FEAT, NEW_FEAT);

const OLD_DESC = "    desc: '占位地图：地理与行政区域来自 OpenStreetMap，其余城市数据尚未填写。',\n    facts: [['范围', '约 80 km × 60 km'], ['起始', '1990 年'], ['人口', '占位'], ['货币', '人民币'], ['模式', '经营挑战 / 自由建造']],";
const NEW_DESC = "    desc: '从三来一补的镇域工业带，到松山湖与滨海湾双核的湾区城市。',\n    facts: [['范围', '约 80 km × 60 km'], ['起始', '2000 年'], ['人口', '约 644 万'], ['货币', '人民币'], ['模式', '经营挑战 / 自由建造']],";
if (!s.includes(OLD_DESC)) throw new Error('未找到 desc/facts');
s = s.replace(OLD_DESC, NEW_DESC);

await writeFile(p, s);
console.log('卡片文案已更新');