import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

// (a) 历史城区只莞城（第 5 点）：文案去掉东城/南城
s = s.replace(
  "text: '莞城、东城、南城只能走地下；可园与鸦片战争博物馆周边另有地下保护范围，车站与隧道都更贵，拆迁也更贵'",
  "text: '莞城历史城区只能走地下；可园与鸦片战争博物馆周边另有地下保护范围，车站与隧道都更贵，拆迁也更贵'");

// (b) 自然保护区指向真实存在的片区（第 6 点）：旧 id dg27/dg34 已不存在
s = s.replace(
  "// 自然保护区（v3.2 引擎机制 scenic）：银瓶山与大岭山森林公园不开发，山体段只能走地下\n      { use: 'scenic', level: 'mid', star: true, icon: 'tree', label: '银瓶山与大岭山森林公园', text: '谢岗的银瓶山与大岭山森林公园不能开发；穿过山体的线路只能走地下，景区内不能设站',\n        regions: ['dg27', 'dg34'],\n        why: '银瓶山（898 m）是东莞最高峰，1999 年设银瓶山森林公园；大岭山森林公园 1993 年设立，两地都是保护性林地。' },",
  "// 自然保护区（v3.2 引擎机制 scenic + regions[].scenic）：按 OSM 保护区边界整片不开发，山体段只能走地下\n      { use: 'scenic', level: 'mid', star: true, icon: 'tree', label: '银瓶山与佛灵湖郊野公园', text: '银瓶山（谢岗）与佛灵湖（大岭山北）按保护边界整片不开发；穿过山体的线路只能走地下，保护区内不能设站',\n        regions: ['yinpingshan', 'folinghu'],\n        why: '银瓶山（898 m）是东莞最高峰，1999 年设森林公园、后扩为银瓶山郊野公园；佛灵湖郊野公园在松山湖与大岭山之间，两地都按保护边界整片不开发。' },");

await writeFile(p, s);
console.log('保护区 trait 已改为 yinpingshan/folinghu；历史城区文案只留莞城');