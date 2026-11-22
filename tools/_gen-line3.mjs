// 第 27 轮：写入 3 号线一期（20 站）与 1 号线二期（5 站）的站点地名，供玩家建站时自动命名；
// 同时往第一个（也是唯一还空着的）未来时代 dg-e5 里加推演任务。
// 站名来源：滨海湾新区管委会 2022-04-13 通稿（18 站官方名单）+ 维基/百度站表补 广东医大、东坑东；
// 1 号线二期：2018 年发改口径 11.26 km，站点为东环路、康乐街路口、大盛村（+既有东莞西站/黄埔新港）。
import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');

const PLACES = [
  // 3 号线一期：交椅湾 → 东莞东
  ['交椅湾', 83.9, 187.5],
  ['交椅湾北', 85.5, 181.0],
  ['长安建安路', 96.0, 175.0],
  ['长安金沙', 105.5, 171.7],
  ['长安乌沙村', 112.0, 170.0],
  ['长安步行街', 114.5, 164.0],
  ['长安汽车总站', 117.0, 157.0],
  ['海悦花园', 124.0, 148.0],
  ['松山湖企业总部', 137.0, 138.0],
  ['金多港', 146.0, 130.0],
  ['松山湖大学城', 150.0, 122.0],
  ['广东医大', 150.0, 114.0],
  ['松山湖站', 155.0, 110.0],
  ['松山湖北站', 159.7, 92.4],
  ['东坑', 176.6, 75.7],
  ['东坑东', 185.0, 78.0],
  ['常平北环路', 197.0, 82.0],
  ['常平北', 201.0, 85.0],
  ['常平火车站', 203.9, 80.9],
  ['东莞东站', 217.6, 88.5],
  // 1 号线二期：东莞西 → 麻涌 → 黄埔新港（图外）
  ['麻涌东', 28.0, 64.0],
  ['麻涌东环路', 22.0, 68.0],
  ['麻二村', 17.0, 72.0],
  ['大盛村', 11.0, 77.0],
  ['黄埔新港', -16.3, 35.4],
];

const extraSrc = PLACES.map(function (p) {
  return `        [${JSON.stringify(p[0])}, ${p[1]}, ${p[2]}, 0]`;
}).join(',\n');

const MARK = '    places: (G.places || []).map(function (p) { return [p[0], p[1], p[2], p[3]]; }),';
const START = '    // ===== 规划线路站点地名（第 27 轮：3 号线一期 / 1 号线二期，供建站自动命名）=====';
const REPL = [
  START,
  '    // 3 号线一期（交椅湾—东莞东，51.5 km / 20 站，发改基础〔2022〕427 号已批、未开工）',
  '    // 站名按滨海湾新区管委会 2022-04-13 通稿的 18 站，加维基站表补的 广东医大、东坑东；坐标为沿走向的估算。',
  '    // 1 号线二期（东莞西—黄埔新港，约 11.26 km，未获建设规划批复），站名为东环路、康乐街路口、大盛村。',
  '    places: (G.places || []).map(function (p) { return [p[0], p[1], p[2], p[3]]; }).concat([',
  extraSrc,
  '    ]),',
].join('\n');

if (s.indexOf(START) >= 0) {
  // 幂等：已经写过就只替换 EXTRA 段
  const a = s.indexOf(START);
  const b = s.indexOf('    ]),', s.indexOf('.concat([', a)) + '    ]),'.length;
  s = s.slice(0, a) + REPL + s.slice(b);
} else {
  if (s.indexOf(MARK) < 0) throw new Error('未找到 places 行');
  s = s.replace(MARK, REPL);
}

// ---------- 推演任务：3 号线一期分三段、1 号线二期一条 ----------
const A = (name, x, y, r) => `{ name: '${name}', x: ${x}, y: ${y}, r: ${r} }`;
const GOALS = [
  {
    id: 'dg-g23', from: 2033, months: 60, reward: 380000, title: '推演：3 号线一期（交椅湾—长安）',
    desc: '3 号线一期 2022 年获国家批复却一直没有开工，滨海湾与长安之间仍靠镇道与穗深城际。若将来真的要修，最先动的一定是这一段。把交椅湾与长安汽车总站连起来。',
    anchors: [A('交椅湾', 83.9, 187.5, 4), A('长安汽车总站', 117.0, 157.0, 4)],
  },
  {
    id: 'dg-g24', from: 2035, months: 72, reward: 430000, title: '推演：3 号线一期（松山湖—东莞东）',
    desc: '3 号线一期东段串起松山湖、东坑与常平：松山湖北站接莞惠城际，常平火车站接广深铁路，东莞东站接京九铁路。把松山湖与东莞东站连起来。',
    anchors: [A('松山湖站', 155.0, 110.0, 4), A('东莞东站', 217.6, 88.5, 4)],
  },
  {
    id: 'dg-g25', from: 2033, months: 60, reward: 360000, title: '推演：1 号线二期接黄埔新港',
    desc: '1 号线二期从东莞西站向西北跨过东江，在麻涌设东环路、康乐街路口、大盛村三站后接广州黄埔新港（换乘 5 号线、17 号线）。这条线至今未获批复，长度按 2018 年发改口径 11.26 km 推算。把东莞西站与麻涌的站点连起来。',
    anchors: [A('东莞西站', 49.2, 70.1, 4), A('麻二村', 17.0, 72.0, 3)],
  },
];

const mkGoal = g => `{ id: '${g.id}', from: ${g.from}, type: 'connect', months: ${g.months}, reward: ${g.reward}, title: '${g.title}', desc: '${g.desc}', anchors: [${g.anchors.join(', ')}] }`;

// 找 dg-e5 块，插到它的 goals 数组末尾
const idAt = s.indexOf("id: 'dg-e5',");
if (idAt < 0) throw new Error('未找到 dg-e5');
const at = s.lastIndexOf('{', idAt);
if (at < 0) throw new Error('dg-e5 块起点未找到');
let depth = 0, i = at, end = -1;
for (; i < s.length; i++) {
  const ch = s[i];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  else if (ch === "'") { i++; while (i < s.length && !(s[i] === "'" && s[i - 1] !== '\\')) i++; }
}
if (end < 0) throw new Error('dg-e5 块未闭合');
let block = s.slice(at, end + 1);

const add = GOALS.filter(g => block.indexOf(`'${g.id}'`) < 0);
if (add.length) {
  const gi = block.indexOf('goals: [');
  if (gi < 0) throw new Error('dg-e5 没有 goals 数组');
  let d2 = 0, j = gi + 'goals: '.length, gend = -1;
  for (; j < block.length; j++) {
    const ch = block[j];
    if (ch === '[') d2++;
    else if (ch === ']') { d2--; if (d2 === 0) { gend = j; break; } }
    else if (ch === "'") { j++; while (j < block.length && !(block[j] === "'" && block[j - 1] !== '\\')) j++; }
  }
  if (gend < 0) throw new Error('goals 数组未闭合');
  // 去掉尾部的逗号，否则拼出 `},,` → 稀疏数组 → 引擎读到 undefined 目标
  const inner = block.slice(gi + 'goals: ['.length, gend).replace(/\s+$/, '').replace(/,\s*$/, '');
  const merged = inner + ',\n      ' + add.map(mkGoal).join(',\n      ') + '\n    ';
  block = block.slice(0, gi + 'goals: ['.length) + merged + block.slice(gend);
  s = s.slice(0, at) + block + s.slice(end + 1);
}

fs.writeFileSync(f, s);
console.log('places +%d 条, goals +%d 条', PLACES.length, add.length);