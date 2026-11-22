// 给 en.js 补东莞地图卡片的英文（引擎按中文原文查表，缺了就回落中文）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/locales/en.js';
let s = await readFile(p, 'utf8');

const ADD = {
  '东莞': 'Dongguan',
  '东莞 · 2000': 'Dongguan · 2000',
  '真实地理 · 2000 年起 · 世界工厂与镇域网络': 'Real geography · from 2000 · world factory and township network',
  '珠江口东岸': 'East bank of the Pearl River estuary',
  '镇域网络': 'Township network',
  '世界工厂': 'World factory',
  '湾区东岸': 'East bank of the Bay Area',
  '从三来一补的镇域工业带，到松山湖与滨海湾双核的湾区城市。': 'From a belt of processing-industry townships to a Bay Area city anchored by Songshan Lake and Binhaiwan Bay.',
  '真实地理': 'Real geography',
  '东江、珠江口、道路与铁路来自 OpenStreetMap；山体与保护区不可开发': 'The Dongjiang, the Pearl River estuary, roads and railways come from OpenStreetMap; hills and protected areas cannot be developed',
  '32 镇街按 2000 年五普人口开放，工业带沿广深公路铺开': 'The 32 townships open by their year-2000 census population, with factory belts spreading along the Guangzhou–Shenzhen highway',
  '镇际铁路': 'Inter-town railways',
  '广深、穗深、莞惠、广深港、京港在图上按真实走向铺设，图外不设站': 'Guangzhou–Shenzhen, Suishen, Guanhui, Guangzhou–Shenzhen–Hong Kong and Beijing–Hong Kong lines follow their real alignments, running off-map without stations',
  '时代四段': 'Four eras',
  '世界工厂 → 双转移阵痛 → 松山湖与手机 → 湾区都市': 'World factory → double transfer → Songshan Lake and smartphones → Bay Area metropolis',
  '万亿之城': 'Trillion-yuan city',
  '名义 GDP 按统计公报标定：2000 年 831 亿 → 2021 年 10855 亿': 'Nominal GDP calibrated to official statistics: 83.1 bn in 2000 → 1085.5 bn in 2021',
  '私家车之城': 'City of private cars',
  '机动车 2000–2024 增长 28 倍，治堵与接驳贯穿四个时代': 'Motor vehicles grew 28-fold from 2000 to 2024; congestion relief and feeder links span all four eras',
  '世界工厂': 'World factory',
  '双转移': 'Double transfer',
  '松山湖与手机': 'Songshan Lake and smartphones',
  '湾区都市': 'Bay Area metropolis',
  '万亿之城': 'Trillion-yuan city',
  '约 80 km × 60 km': 'About 80 km × 60 km',
  '约 644 万': 'About 6.44 million',
  '2000 年的东莞是一座「镇镇点火」的世界工厂：644 万常住人口里七成六是外来工，厂房沿广深公路铺满 32 个镇街，没有一个真正意义上的市中心。此后二十年，双转移与金融危机洗掉低端产线，松山湖接住华为，虎门通了高铁，滨海湾在滩涂上填海，2021 年 GDP 破万亿。': 'In 2000 Dongguan was a world factory of thirty-two ignited townships: of 6.44 million residents, 76% were migrant workers, factories lined the Guangzhou–Shenzhen highway, and no real city centre existed. Over the next two decades the double-transfer policy and the financial crisis cleared out low-end lines, Songshan Lake took in Huawei, Humen gained a high-speed station, Binhaiwan reclaimed land from the tidal flats, and GDP passed one trillion yuan in 2021.',
};
// '世界工厂' / '万亿之城' 在 tags 与 highlights 里重复出现，只需一条

let added = 0;
const body = Object.entries(ADD).map(([k, v]) => {
  const line = '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',';
  if (s.includes(JSON.stringify(k) + ':')) return null;
  added++;
  return line;
}).filter(Boolean).join('\n');

const close = '\n});';
const i = s.lastIndexOf(close);
if (i < 0) throw new Error('未找到 en.js 结尾');
s = s.slice(0, i) + '\n' + body + s.slice(i);
await writeFile(p, s);
console.log('en.js 新增 ' + added + ' 条');