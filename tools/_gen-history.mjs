// 写入东莞的年代 / 大事件 / 历史任务（据 scripts/_dg-history-2000-2025.md 的调研结果）。
// 临时生成脚本，不进发布。
import { readFile, writeFile } from 'node:fs/promises';

const STAGES = `    stages: [[2000, '世界工厂'], [2008, '双转移阵痛'], [2014, '松山湖与手机'], [2019, '湾区都市']],
    stageLast: '湾区都市',
    eras: [
      // 一、世界工厂（2000–2007）：三来一补顶峰，厂房沿 107 国道与广深铁路铺开，虎门/长安/厚街最密
      { id: 'dg-e1', from: 2000, name: '世界工厂', tag: '三来一补',
        summary: '外资厂沿广深公路与铁路铺开，镇镇有工业区；人口以暂住的外来工为主，长安、虎门、厚街的厂房最密。',
        grow: {
          pop: { changan: 1.40, humen: 1.35, houjie: 1.30, tangxia: 1.25, fenggang: 1.20, dalang: 1.15, changping: 1.15, songshanhu: 1.05, guancheng: 0.97, shilong: 0.95 },
          jobs: { changan: 1.35, songshanhu: 1.30, humen: 1.30, houjie: 1.28, tangxia: 1.25, changping: 1.20, machong: 1.15, shatian: 1.10, guancheng: 0.96 },
        },
        demand: { sc: 0.24, decayHW: 3.4 } },
      // 二、双转移阵痛（2008–2013）：金融危机与腾笼换鸟，劳动密集厂外迁，松山湖开始承接
      { id: 'dg-e2', from: 2008, name: '双转移阵痛', tag: '腾笼换鸟',
        summary: '金融危机后一批中小企业倒闭，劳动密集环节转向内陆；松山湖、寮步一带开始承接研发与总部，老镇人口增速转负。',
        grow: {
          pop: { songshanhu: 1.45, nancheng: 1.12, dalang: 1.10, liaobu: 1.10, changan: 0.98, guancheng: 0.97, humen: 0.96, changping: 0.95, tangxia: 0.92, fenggang: 0.90 },
          jobs: { songshanhu: 1.55, liaobu: 1.15, nancheng: 1.15, dalang: 1.12, xiegang: 1.02, humen: 0.95, hongmei: 0.95, wangniudun: 0.95 },
        },
        demand: { sc: 0.23, decayHW: 3.2 } },
      // 三、松山湖与手机（2014–2018）：华为终端落地，莞产手机占全球约五分之一，2 号线通车
      { id: 'dg-e3', from: 2014, name: '松山湖与手机', tag: '智能终端',
        summary: '华为终端与一批手机供应链迁入松山湖、大岭山、大朗，研发岗位取代流水线；2 号线把东莞站与虎门站连起来。',
        grow: {
          pop: { songshanhu: 1.60, dalingshan: 1.15, nancheng: 1.15, dalang: 1.12, humen: 1.10, changan: 1.08, guancheng: 0.95 },
          jobs: { songshanhu: 2.20, dalingshan: 1.20, dalang: 1.15, humen: 1.12, changan: 1.10, changping: 0.96 },
        },
        demand: { sc: 0.26, decayHW: 3.0 } },
      // 四、湾区都市（2019– ）：大湾区纲要、穗深城际、南沙大桥，滨海湾新区填海开发，2021 年破万亿
      { id: 'dg-e4', from: 2019, name: '湾区都市', tag: '湾区横轴',
        summary: '穗深城际与南沙大桥把东莞拉进广深半小时圈；滨海湾新区向海要地，松山湖与中心城区形成双核。',
        grow: {
          pop: { songshanhu: 1.55, nancheng: 1.20, hongmei: 1.15, humen: 1.08, changan: 1.06, machong: 1.05, shilong: 0.96, guancheng: 0.93 },
          jobs: { songshanhu: 1.60, nancheng: 1.25, changan: 1.10, humen: 1.10, xiegang: 1.05 },
        },
        demand: { sc: 0.28, decayHW: 2.8 } },
    ],`;

const EVENTS = `    events: [
      { y: 2000, m: 11, tag: '人口', title: '五普六百四十四万', desc: '第五次人口普查：常住人口 644.57 万，户籍人口只有 154.51 万，外来人口占七成六——这是一座靠外来工撑起来的城市。' },
      { y: 2001, m: 11, tag: '产业', title: '松山湖设立', desc: '松山湖科技产业园经省批准设立，规划 72 平方公里，目标是承接深圳外溢的研发与总部。' },
      { y: 2003, m: 9, tag: '交通', title: '虎门港对外开放', desc: '虎门港获准对外开放，麻涌、沙田、沙角、长安四个作业区共 7 座码头，东莞第一次有了自己的海港。' },
      { y: 2008, m: 5, tag: '政策', title: '双转移启动', desc: '广东推进产业与劳动力双转移，东莞开始把低端制造环节向外腾退，腾笼换鸟。' },
      { y: 2008, m: 9, tag: '危机', title: '金融危机冲击', desc: '全球金融危机爆发，到 2009 年初，倒闭的中小企业约占全市十分之一。' },
      { y: 2011, m: 12, tag: '交通', title: '虎门高铁站通车', desc: '广深港高铁广深段开通，虎门站成为东莞唯一的高铁站，到深圳北只要十几分钟。' },
      { y: 2014, m: 1, tag: '交通', title: '新东莞站启用', desc: '石龙站停办客运，新建的东莞站启用，日开 86 对广深动车，铁路客运重心从石龙移到茶山、石龙交界。' },
      { y: 2014, m: 9, tag: '产业', title: '华为终端动工', desc: '华为终端项目在松山湖动工，占地 1900 亩、投资 100 亿，规划 3 万研发人员。' },
      { y: 2016, m: 3, tag: '交通', title: '莞惠城际通车', desc: '莞惠城际常平东至惠州北段开通，东莞境内设常平东、樟木头东、银瓶三站。' },
      { y: 2016, m: 5, tag: '交通', title: '地铁 2 号线开通', desc: '东莞轨道交通 2 号线开通，东莞站至虎门火车站 37.8 公里 15 站，东莞成为全国第 27 个开通地铁的城市。' },
      { y: 2016, m: 10, tag: '政策', title: '楼市首次限购', desc: '深圳客涌入推高房价，东莞首次实施限购；2017 年 4 月升级为限购、限贷、限价、限外、限售五限。' },
      { y: 2017, m: 10, tag: '开发', title: '滨海湾新区挂牌', desc: '滨海湾新区正式挂牌，规划 83.2 平方公里，在长安、虎门南侧的滩涂上向海要地。' },
      { y: 2018, m: 7, tag: '产业', title: '华为迁入松山湖', desc: '华为研发部门分批迁入松山湖溪流背坡村，7 月 2 日首批 2700 人，松山湖从产业园变成科技城。' },
      { y: 2019, m: 2, tag: '政策', title: '大湾区纲要发布', desc: '《粤港澳大湾区发展规划纲要》发布，东莞被列为湾区先进制造中心。' },
      { y: 2019, m: 4, tag: '交通', title: '南沙大桥通车', desc: '南沙大桥通车，全长 12.89 公里、双向八车道，分流虎门大桥约三成车流。' },
      { y: 2019, m: 12, tag: '交通', title: '穗深城际开通', desc: '穗深城际新塘南至深圳机场开通，全长 73.996 公里，东莞境内设 10 站，从此可以坐城际直达广深机场。' },
      { y: 2020, m: 1, tag: '危机', title: '新冠疫情', desc: '疫情冲击外贸订单与口岸，2020 年全市 GDP 9650.19 亿，仅增长 1.1%。' },
      { y: 2021, m: 12, tag: '经济', title: '晋级万亿俱乐部', desc: '2021 年东莞 GDP 达 10855.35 亿、增长 8.2%，成为全国第 15 个万亿级城市。' },
      { y: 2023, m: 12, tag: '政策', title: '深圳都市圈获批', desc: '深圳都市圈获批，范围含深圳、东莞、惠州全域，共 16273 平方公里。' },
      { y: 2025, m: 11, tag: '交通', title: '地铁 1 号线开通', desc: '11 月 28 日，轨道交通 1 号线开通，57.478 公里 25 站，从东莞西站到黄江，把中心城区与松山湖、黄江连成一线。' },
    ],
    histTasks: [
      { y: 2003, title: '打通虎门港', desc: '修一条从市区到沙田的干线，让虎门港的码头接上内陆货流。', deadline: [2007, 12],
        anchors: [{ name: '沙田', x: 55, y: 180, r: 10 }, { name: '东莞港', x: 43.3, y: 114.7, r: 8 }] },
      { y: 2011, title: '接上虎门高铁', desc: '虎门高铁站通车，把地铁或干线通到虎门站，让高铁客流进得了城。', deadline: [2015, 12],
        anchors: [{ name: '虎门站', x: 68.6, y: 135.6, r: 8 }, { name: '厚街', x: 59.7, y: 119.3, r: 8 }] },
      { y: 2014, title: '东莞站进城', desc: '客运重心从石龙旧站移到新东莞站，把轨道接到茶山一侧的新站。', deadline: [2018, 12],
        anchors: [{ name: '东莞火车站', x: 144.9, y: 34.7, r: 7 }, { name: '石龙', x: 136.9, y: 28.7, r: 8 }] },
      { y: 2016, title: '复刻 2 号线', desc: '东莞站到虎门火车站 37.8 公里，把两座铁路车站用一条地铁连起来。', deadline: [2020, 12],
        anchors: [{ name: '东莞火车站', x: 144.9, y: 34.7, r: 7 }, { name: '虎门站', x: 68.6, y: 135.6, r: 8 }] },
      { y: 2017, title: '接莞惠城际', desc: '莞惠城际从常平东向西接进中心城区，把西平西与常平东连上。', deadline: [2021, 12],
        anchors: [{ name: '常平东', x: 218.2, y: 90.6, r: 7 }, { name: '西平西', x: 98, y: 76.3, r: 7 }] },
      { y: 2018, title: '松山湖接华为', desc: '华为迁入溪流背坡村，把轨道从中心城区通到松山湖。', deadline: [2022, 12],
        anchors: [{ name: '松山湖', x: 155, y: 110, r: 10 }, { name: '溪流背坡', x: 154.8, y: 119.4, r: 6 }] },
      { y: 2019, title: '湾区横轴', desc: '穗深城际通车后，把东莞西站与滨海湾新区连成一条东西向的湾区横轴。', deadline: [2023, 12],
        anchors: [{ name: '东莞西', x: 49.2, y: 70.1, r: 7 }, { name: '滨海湾新区', x: 100, y: 186, r: 12 }] },
      { y: 2021, title: '万亿双核', desc: '中心城区与松山湖各建一个枢纽，把两个就业中心用轨道连起来。', deadline: [2025, 12],
        anchors: [{ name: '南城 CBD', x: 101, y: 66, r: 8 }, { name: '松山湖', x: 155, y: 110, r: 10 }] },
      { y: 2025, title: '一号线贯通', desc: '1 号线从东莞西站到黄江，把水乡、中心城区与松山湖、黄江串起来。', deadline: [2029, 12],
        anchors: [{ name: '东莞西', x: 49.2, y: 70.1, r: 7 }, { name: '黄江', x: 170, y: 150, r: 10 }] },
    ],`;

let s = await readFile('js/data_dg.js', 'utf8');
const a = s.indexOf("    stages: [[2000, '起步期']],");
const b = s.indexOf('    dataNote: [');
if (a < 0 || b < 0) throw new Error('找不到 stages/eras 块');
s = s.slice(0, a) + STAGES + '\n\n' + s.slice(b);

const c = s.indexOf('    events: [],');
if (c < 0) throw new Error('找不到 events 空块');
s = s.slice(0, c) + EVENTS + '\n' + s.slice(c + '    events: [],'.length);

// 旧注释里「年代、任务仍是空占位」已不成立
s = s.replace("本图当前用于验证地图数据载入与显示：年代、规划细则、地标、设施、事件、任务仍是空占位。",
  '年代、大事件与历史任务依据东莞统计年鉴与地方志整理；规划构成沿用引擎内置的十种用地配比。');
s = s.replace("['占位', 'info', ", "['说明', 'info', ");
await writeFile('js/data_dg.js', s);
console.log('年代 / 事件 / 任务 已写入');