// 给 dg 的四个时代写入阶段目标（eras[].goals → Eras.goals() → 动态任务）
// 每个目标都用真实地名坐标作为锚点，来自 data_dg.js 的 places（OSM 地名）
import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');

const A = (name, x, y, r) => `{ name: '${name}', x: ${x}, y: ${y}, r: ${r} }`;

// 阶段目标：id 前缀 dg-g，from 为该目标出现的年份（Eras.goals 会用它和阶段窗口求交）
const GOALS = {
  'dg-e1': [
    { from: 2003, months: 48, reward: 40000, title: '虎门港接进线网',
      desc: '虎门港 2003 年对外开放，麻涌、沙田、沙角与长安的码头需要大批工人轮班进出，陆路却只有几条镇道。用地铁连接沙田与虎门。',
      anchors: [A('沙田镇', 46.1, 109.4, 4), A('虎门', 68.5, 135.7, 3)] },
    { from: 2004, months: 48, reward: 45000, title: '虎门—长安工业走廊',
      desc: '广深公路沿线是最密集的电子与服装厂带，虎门的服装厂与长安的五金电子厂之间每天有几万人往返，班车与摩托车挤满国道。用地铁连接虎门与长安。',
      anchors: [A('虎门', 68.5, 135.7, 3), A('长安镇', 121.2, 156.7, 4)] },
  ],
  'dg-e2': [
    { from: 2009, months: 48, reward: 45000, title: '松山湖接住转岗的人',
      desc: '金融危机后一批中小企业关门，劳动密集环节迁往内陆；松山湖与寮步开始承接研发与总部，原来的工人要在新的园区重新上班。用地铁连接松山湖与寮步。',
      anchors: [A('松山湖', 155.4, 108.3, 5), A('寮步镇', 151.7, 76.0, 4)] },
    { from: 2010, months: 48, reward: 40000, title: '水乡片的跨镇江通勤',
      desc: '中堂、望牛墩、洪梅的水乡居民到莞城上班要绕道或坐渡船；造纸与服装厂外迁后，留在原地的人更依赖跨镇公交。用地铁连接中堂与莞城。',
      anchors: [A('中堂镇', 61.7, 32.8, 4), A('莞城街道', 99.4, 56.9, 3)] },
  ],
  'dg-e3': [
    { from: 2015, months: 48, reward: 50000, title: '手机走廊',
      desc: '华为终端 2014 年在松山湖动工、2018 年迁入，大朗与寮步的配套厂跟着长起来，工程师与产线工人每天都在松山湖与周边镇之间往返。用地铁连接松山湖与大朗。',
      anchors: [A('松山湖', 155.4, 108.3, 5), A('大朗镇', 176.8, 97.5, 4)] },
    { from: 2016, months: 48, reward: 50000, title: '虎门高铁站的接驳',
      desc: '虎门站 2011 年通车后日均到发从三千人涨到两万多，厚街的会展与家具客户、虎门的服装客商都从这里进出。用地铁连接厚街与虎门站。',
      anchors: [A('厚街镇', 67.1, 102.3, 4), A('虎门', 68.5, 135.7, 3)] },
  ],
  'dg-e4': [
    { from: 2020, months: 60, reward: 60000, title: '滨海湾新区接入线网',
      desc: '滨海湾新区 2017 年挂牌，填海地上一片空地等着招商；深江铁路 2028 年要在交椅湾设站。用地铁把新区与长安连起来，先把骨架搭好。',
      anchors: [A('滨海湾新区', 97.5, 183.3, 5), A('长安镇', 121.2, 156.7, 4)] },
    { from: 2022, months: 60, reward: 60000, title: '双核之间的研发通勤',
      desc: '2021 年东莞 GDP 破万亿，松山湖的研发与南城的金融、总部形成两个核心，两地之间的通勤与商务往来快速增长。用地铁连接松山湖与南城。',
      anchors: [A('松山湖', 155.4, 108.3, 5), A('南城街道', 97.3, 65.8, 3)] },
  ],
};

const mkGoal = (g, id) => {
  const anchors = g.anchors.join(', ');
  return `{ id: '${id}', from: ${g.from}, type: 'connect', months: ${g.months}, reward: ${g.reward}, title: '${g.title}', desc: '${g.desc}', anchors: [${anchors}] }`;
};

// 用大括号配对找出每个 era 的块，在块尾插入 goals
let inserted = 0, seq = 0;
for (const key of Object.keys(GOALS)) {
  const at = s.indexOf(`{ id: '${key}',`);
  if (at < 0) throw new Error('未找到时代 ' + key);
  let depth = 0, i = at, end = -1;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    else if (ch === "'") { i++; while (i < s.length && !(s[i] === "'" && s[i - 1] !== '\\')) i++; }
  }
  if (end < 0) throw new Error('时代块未闭合 ' + key);
  const block = s.slice(at, end + 1);
  if (block.indexOf('goals:') >= 0) { console.log(key, '已有 goals，跳过'); continue; }
  const inner = block.slice(0, -1).replace(/\s+$/, '');   // 去掉块尾的 } 与空白
  const tail = inner.endsWith(',') ? '' : ',';
  const goals = GOALS[key].map((g) => '        ' + mkGoal(g, 'dg-g' + (++seq)) + ',').join('\n');
  const nb = inner + tail + '\n        goals: [\n' + goals + '\n        ],\n      }';
  s = s.slice(0, at) + nb + s.slice(end + 1);
  inserted++;
}
fs.writeFileSync(f, s);
console.log('写入 goals 的时代数:', inserted);
for (const key of Object.keys(GOALS)) {
  const at = s.indexOf(`{ id: '${key}',`);
  const seg = s.slice(at, at + 260);
  console.log(key, 'goals 存在:', seg.indexOf('goals:') >= 0 || s.slice(at, s.indexOf('},\n', at) + 1).indexOf('goals:') >= 0);
}
