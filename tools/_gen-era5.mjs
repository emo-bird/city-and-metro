// 按《东莞 2026–2035 轨交与城市》调研补：第 5 个时代、2026 之后的事件与阶段目标
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

// 从 start 处的 '[' 开始做括号配对，返回结束 ']' 之后的下标
function blockEnd(src, start) {
  let i = src.indexOf('[', start), d = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '[') d++;
    else if (c === ']') { d--; if (d === 0) return i + 1; }
  }
  throw new Error('括号不配对');
}

// ---------- 1) 修正两条已有未来线事件的年月 ----------
s = s.replace("{ y: 2026, m: 12, tag: '交通', title: '深惠城际凤岗站通车'", "{ y: 2026, m: 11, tag: '交通', title: '深惠城际凤岗站通车'");
s = s.replace("{ y: 2028, m: 5, tag: '交通', title: '深江铁路通车'", "{ y: 2028, m: 4, tag: '交通', title: '深江铁路通车'");

// ---------- 2) 追加 2027–2035 事件到 events 末尾 ----------
const NEW_EVENTS = [
  "{ y: 2027, m: 5, tag: '交通', title: '滨海湾站站房竣工', desc: '深江铁路东莞滨海湾站站房建成，2 台 6 线与地铁 2 号线地下共构——高铁站与地铁站上下叠在一起。' },",
  "{ y: 2028, m: 9, tag: '交通', title: '地铁 2 号线三期建成', desc: '虎门火车站至交椅湾 17.13 公里 9 站全地下线路建成，2 号线从虎门火车站直插滨海湾，与深江铁路枢纽接驳。' },",
  "{ y: 2029, m: 10, tag: '科技', title: '散裂中子源二期投用', desc: '中国散裂中子源二期建成，11 台中子谱仪投入使用，松山湖科学城成为大湾区大科学装置最密集的地方。' },",
  "{ y: 2030, m: 12, tag: '经济', title: '十五五收官：GDP 1.7 万亿', desc: '“十五五”规划目标收官，全市 GDP 超过 1.7 万亿元、规上工业总产值超过 3 万亿，中心城区人口逼近 240 万上限。' },",
  "{ y: 2032, m: 6, tag: '交通', title: '佛穗莞城际全线建成', desc: '广州 28 号线（佛穗莞城际）贯通，东莞段 8 站 36.7 公里全地下，莞城、万江、鸿福路第一次直连广州新塘与琶洲。' },",
  "{ y: 2035, m: 12, tag: '人口', title: '常住人口 1300 万、城镇化 95%', desc: '国土空间总体规划的终局目标：常住人口控制在 1300 万以内、城镇化率约 95%，松山湖与滨海湾两个副中心各承载 150–180 万人。' },",
];
const evStart = s.indexOf('  events: [');
const evEnd = blockEnd(s, evStart);
s = s.slice(0, evEnd - 1) + NEW_EVENTS.join('\n') + '    ' + s.slice(evEnd - 1);

// ---------- 3) 追加第 5 个时代 dg-e5 ----------
const ERA5 = [
  "    {",
  "      id: 'dg-e5', from: 2026, to: 2040, name: '湾区智造', tag: '松山湖科学城 · 滨海湾枢纽 · 万亿之后',",
  "      summary: '2 号线通到交椅湾、深江铁路把滨海湾接进国家高铁网，松山湖科学城的大科学装置开始出成果；跨市六条地铁延伸线仍卡在国家审批，佛穗莞城际让莞城第一次直连广州。城市重心从“镇镇点火”转向“一主两副”的三个极点。',",
  "      grow: {",
  "        pop: { binhaiwan: 1.30, songshanhu: 1.22, nancheng: 1.10, tangxia: 1.04, guancheng: 0.90, shilong: 0.92, gaobu: 0.95 },",
  "        jobs: { binhaiwan: 1.55, songshanhu: 1.45, nancheng: 1.18, dalang: 1.06, guancheng: 0.92, hongmei: 0.96 },",
  "      },",
  "      demand: { hw: 1.20, sc: 1.30, sh: 1.45, md: 1.15, lz: 1.50, decayHW: 1.16, decayHO: 1.10, hub: 1.30 },",
  "      corridors: [",
  "        { a: 'binhaiwan', b: 'changan', f: 1.40 }, { a: 'binhaiwan', b: 'humen', f: 1.32 },",
  "        { a: 'songshanhu', b: 'dalang', f: 1.30 }, { a: 'songshanhu', b: 'huangjiang', f: 1.20 },",
  "        { a: 'songshanhu', b: 'nancheng', f: 1.22 }, { a: 'tangxia', b: 'fenggang', f: 1.30 },",
  "        { a: 'changan', b: 'humen', f: 1.20 }, { a: 'guancheng', b: 'wanjiang', f: 1.14 },",
  "      ],",
  "      goals: [",
  "        { id: 'dg-g16', from: 2026, type: 'connect', reward: 320000, title: '接上深惠城际凤岗站',",
  "          desc: '深惠城际在雁田设凤岗站，2026 年 11 月开通。把地铁或公交接进凤岗站，让凤岗、雁田一带直连深圳平湖、前海方向。',",
  "          anchors: [{ name: '凤岗镇', x: 265.2, y: 194.6, r: 5 }, { name: '雁田', x: 262.0, y: 208.3, r: 3 }] },",
  "        { id: 'dg-g17', from: 2027, type: 'connect', reward: 350000, title: '滨海湾站枢纽接驳倒计时',",
  "          desc: '滨海湾站站房 2027 年 5 月竣工、深江铁路 2028 年 4 月通车、地铁 2 号线三期 2028 年 9 月建成——中间有半年“高铁到了、地铁没到”。先把地面接驳做到交椅湾与沙角半岛。',",
  "          anchors: [{ name: '交椅湾', x: 83.9, y: 187.5, r: 4 }, { name: '滨海湾新区', x: 97.5, y: 183.3, r: 5 }] },",
  "        { id: 'dg-g18', from: 2028, type: 'connect', reward: 380000, title: '2 号线三期直通滨海湾',",
  "          desc: '2 号线三期（虎门火车站—交椅湾，17.13 km、9 站全地下）2028 年 9 月建成，与深江铁路枢纽共构。把这条线接进既有线网，让虎门中心区与滨海湾连成一条轴。',",
  "          anchors: [{ name: '虎门火车站', x: 68.6, y: 135.6, r: 4 }, { name: '交椅湾', x: 83.9, y: 187.5, r: 4 }] },",
  "        { id: 'dg-g19', from: 2029, type: 'connect', reward: 360000, title: '松山湖科学城通勤',",
  "          desc: '散裂中子源二期 2029 年投用、阿秒激光设施同年验收，松山湖科学城的科研人口要跨镇通勤。把松山湖与周边镇连成一张通勤网。',",
  "          anchors: [{ name: '松山湖园区', x: 155.4, y: 108.3, r: 5 }, { name: '大朗镇', x: 176.8, y: 97.5, r: 4 }] },",
  "        { id: 'dg-g20', from: 2030, type: 'zoneCong', region: 'nancheng', metric: 'carShare', drop: 0.05, reward: 400000, title: '中心城区逼近 240 万上限',",
  "          desc: '“十五五”收官时中心城区人口逼近 240 万规划上限，鸿福路与东莞大道一带是最硬的堵点。靠轨道把高峰小汽车出行占比压下去。',",
  "          anchors: [{ name: '南城街道', x: 97.3, y: 65.8, r: 4 }] },",
  "        { id: 'dg-g21', from: 2032, type: 'connect', reward: 420000, title: '莞城直连广州新塘',",
  "          desc: '佛穗莞城际东莞段 8 站 36.7 公里全地下，2032 年全线建成。莞城、万江、鸿福路第一次直连广州新塘与琶洲——广州先跑、东莞跟跑的被动接驳终于落地。',",
  "          anchors: [{ name: '莞城街道', x: 99.4, y: 56.9, r: 3 }, { name: '万江街道', x: 85.6, y: 61.9, r: 4 }] },",
  "        { id: 'dg-g22', from: 2035, type: 'zoneCov', region: 'binhaiwan', target: 0.45, reward: 450000, title: '副中心 180 万人的覆盖',",
  "          desc: '2035 年松山湖与滨海湾两个副中心各承载 150–180 万人。滨海湾新区的轨道覆盖要做到接近半个新区，才算把“向海要地”坐实。',",
  "          anchors: [{ name: '滨海湾新区', x: 97.5, y: 183.3, r: 6 }] },",
  "      ],",
  "      relocate: { jobs: { guancheng: -0.0006, shilong: -0.0005, binhaiwan: 0.0018, songshanhu: 0.0012 } },",
  "    },",
].join('\n');

const erasStart = s.indexOf('    eras: [');
const erasEnd = blockEnd(s, erasStart);
s = s.slice(0, erasEnd - 1) + ERA5 + '\n    ' + s.slice(erasEnd - 1);

// ---------- 4) 人口曲线补 2035 点 ----------
s = s.replace("[2030, 11.2e6], [2045, 11.8e6]", "[2030, 11.2e6], [2035, 11.6e6], [2045, 12.2e6]");

await writeFile(p, s);
console.log('已补第 5 个时代（2026 起）、6 条事件、7 条阶段目标');