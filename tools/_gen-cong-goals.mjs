import fs from 'node:fs';

const P = 'js/data_dg.js';
let s = fs.readFileSync(P, 'utf8');

// 依据 scripts/_dg-congestion.md 的调研：加 6 条治堵任务（zoneCong，按片区写地点，发布时解析为该片区最忙的交通小区）
// + 1 条覆盖任务（regionCov）。reward 为「基准年货币」，引擎发布时乘当年 costIndex，
// 这里按「到手金额 = 当年名义值」反推（见 docs/东莞调研·历史与时代参数.md 第 7 节）。
const G = [
  // e2（2008–2013）
  `{ id: 'dg-g9', from: 2012, type: 'zoneCong', region: 'changan', drop: 0.10, months: 36, reward: 141000, title: '压住长安迎宾路的车流', desc: '长安迎宾路与霄边大街是全市最早饱和的路段：2010 年代长安的跨市通勤里，小汽车与摩托车占了绝大多数，早晚高峰双向都排队。让长安片区工作日早高峰的拥堵指数下降 0.10。', anchorAfter: 'dg-g4' }`,
  // e3（2014–2018）
  `{ id: 'dg-g10', from: 2016, type: 'zoneCong', region: 'nancheng', drop: 0.12, months: 30, reward: 172000, title: '东莞大道与鸿福路口', desc: '南城的东莞大道—鸿福路口是全市饱和度最高的节点之一，高峰小时饱和度超过 1.0，进口道排队一路顶到下一个路口。让南城片区早高峰拥堵指数下降 0.12。', anchorAfter: 'dg-g6' }`,
  `{ id: 'dg-g11', from: 2017, type: 'zoneCong', region: 'dongcheng', drop: 0.10, months: 30, reward: 178000, title: '东纵路的早晚高峰', desc: '东城的东纵路串起老城与东城新区，沿街商业密集、路侧出入口多，早高峰东向西几乎停住，东莞的「5 公里内通勤」比例全市最低就在这一带。让东城片区早高峰拥堵指数下降 0.10。', anchorAfter: 'dg-g6' }`,
  // e4（2019–）
  `{ id: 'dg-g12', from: 2019, type: 'zoneCong', region: 'humen', drop: 0.12, months: 30, reward: 258000, title: '虎门的过江与镇内高峰', desc: '虎门大桥 2015 年一年堵了 112 天；莲峰北路 2019 年二季度拥堵 56 天、锦绣路晚高峰全市第一。2019 年 4 月南沙大桥通车后虎门大桥当天的车流少了 8.5%，但两桥合计流量仍在涨。让虎门片区早高峰拥堵指数下降 0.12。', anchorAfter: 'dg-g8' }`,
  `{ id: 'dg-g13', from: 2021, type: 'zoneCong', region: 'songshanhu', drop: 0.10, months: 30, reward: 258000, title: '松山湖大道的交织段', desc: '松山湖大道中医院段只有 200 米交织区，进出园区的车流在早高峰互相别车，园区内部通勤也越来越依赖小汽车。让松山湖片区早高峰拥堵指数下降 0.10。', anchorAfter: 'dg-g8' }`,
  `{ id: 'dg-g14', from: 2023, type: 'zoneCong', region: 'guancheng', drop: 0.10, months: 30, reward: 273000, title: '莞太路走廊', desc: '莞太路五个连续路口高峰实测约 8000 pcu/h、最大延误 103 秒，是莞城—南城之间最堵的一条走廊。让莞城片区早高峰拥堵指数下降 0.10。', anchorAfter: 'dg-g8' }`,
  `{ id: 'dg-g15', from: 2024, type: 'regionCov', regions: ['binhaiwan', 'changan'], areaName: '滨海湾与长安', target: 0.35, months: 48, reward: 248000, title: '滨海湾—长安的轨道覆盖', desc: '滨海湾新区 2017 年挂牌后填海地陆续出让，长安的 80 万人与新区的新岗位之间还没有轨道。让滨海湾与长安三成半的居民步行 15 分钟就能到地铁站。', anchorAfter: 'dg-g8' }`,
];

const byAnchor = new Map();
for (const g of G) {
  const m = g.match(/^\{ id: '([^']+)'.*anchorAfter: '([^']+)' \}$/);
  if (!m) throw new Error('行格式不对：' + g.slice(0, 40));
  const line = '        ' + g.replace(/, anchorAfter: '[^']+' \}$/, ' },');
  if (!byAnchor.has(m[2])) byAnchor.set(m[2], []);
  byAnchor.get(m[2]).push(line);
}

let added = 0;
for (const [anchorId, lines] of byAnchor) {
  const re = new RegExp(`(\\n        \\{ id: '${anchorId}',[^\\n]*\\n)`);
  const m = s.match(re);
  if (!m) throw new Error('找不到锚点 ' + anchorId);
  s = s.replace(re, m[1] + lines.join('\n') + '\n');
  added += lines.length;
}

fs.writeFileSync(P, s);
console.log('新增阶段目标 ' + added + ' 条');