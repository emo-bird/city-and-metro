// 给 dg 写自己的用地构成（plans），并按史实给各片区指定 plan
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const PLANS = `    // 用地构成（参照 js/data_gz.js 的写法，按东莞实际：镇域工业 + 中心商贸 + 松山湖高新 + 临港 + 老城）
    plans: {
      // 老城：莞城，骑楼与老街，商住混合、工业极少
      oldtown: { RES: 0.46, MIX: 0.22, COM: 0.22, INST: 0.06, IND: 0.04 },
      // 市中心：南城、东城，行政商务与居住
      citycore: { RES: 0.24, MIX: 0.28, COM: 0.36, INST: 0.12, IND: 0.00 },
      // 镇域工业：三来一补留下的厂房 + 村庄住宅，是东莞最常见的镇街形态
      townind: { RES: 0.40, MIX: 0.12, COM: 0.06, INST: 0.06, IND: 0.36 },
      // 镇中心商贸：虎门服装、常平物流、樟木头房产这类以商贸服务为主的镇中心
      towncore: { RES: 0.30, MIX: 0.26, COM: 0.28, INST: 0.06, IND: 0.10 },
      // 高新区：松山湖，研发、大学、产业园为主，居住配套
      hitech: { RES: 0.26, MIX: 0.20, COM: 0.08, INST: 0.32, IND: 0.14 },
      // 临港产业：麻涌、沙田，粮油、化工、码头堆场
      port: { RES: 0.22, MIX: 0.18, COM: 0.08, INST: 0.08, IND: 0.44 },
      // 滨海湾新区：填海新城的商务与产业混合
      waterfront: { RES: 0.28, MIX: 0.30, COM: 0.20, INST: 0.18, IND: 0.04 },
      // 生态园：低密度研发与居住，绿地比重高
      ecopark: { RES: 0.34, MIX: 0.26, COM: 0.14, INST: 0.18, IND: 0.08 },
      // 农业与生态镇：望牛墩、洪梅、谢岗、桥头，以村庄居住为主
      rural: { RES: 0.62, MIX: 0.16, COM: 0.04, INST: 0.06, IND: 0.12 },
      // 公园（park 片区本身会被置为绿地，这里只定底色）
      park: { RES: 0.60, MIX: 0.20, COM: 0.10, INST: 0.10, IND: 0.00 },
      // 市外（只用于底色，不可开发）
      outmix: { RES: 0.40, MIX: 0.25, COM: 0.15, INST: 0.10, IND: 0.10 },
      outind: { RES: 0.28, MIX: 0.18, COM: 0.09, INST: 0.05, IND: 0.40 },
      outres: { RES: 0.55, MIX: 0.20, COM: 0.06, INST: 0.04, IND: 0.15 },
      // 兜底（引擎在找不到 plan 时用 D.plans.res）
      res: { RES: 0.62, MIX: 0.16, COM: 0.05, INST: 0.05, IND: 0.12 },
      mix: { RES: 0.45, MIX: 0.25, COM: 0.10, INST: 0.12, IND: 0.08 },
      ind: { RES: 0.25, MIX: 0.10, COM: 0.05, INST: 0.00, IND: 0.60 },
    },
`;

if (s.includes('plans: CM.DATA.plans,')) s = s.replace('    plans: CM.DATA.plans,\n', PLANS);
else throw new Error('未找到 plans: CM.DATA.plans,');

const MAP = {
  guancheng: 'oldtown', dongcheng: 'citycore', nancheng: 'citycore', wanjiang: 'oldtown',
  shilong: 'townind', humen: 'towncore', changan: 'townind', changping: 'towncore',
  houjie: 'townind', shijie: 'townind', zhangmutou: 'towncore', tangxia: 'townind',
  fenggang: 'townind', qingxi: 'townind', dalang: 'townind', zhongtang: 'townind',
  liaobu: 'townind', dalingshan: 'townind', huangjiang: 'townind', chashan: 'townind',
  gaobu: 'townind', dongkeng: 'townind', qiaotou: 'townind', hengli: 'townind',
  machong: 'port', shatian: 'port', daojiao: 'townind', shipai: 'townind',
  qishi: 'townind', wangniudun: 'rural', hongmei: 'rural', xiegang: 'rural',
  songshanhu: 'hitech', shengtaiyuan: 'ecopark',
  yinpingshan: 'park', folinghu: 'park', tongsha: 'park', shuilianshan: 'park',
  huyingshan: 'park', dgbotany: 'park',
  gz_out: 'outmix', sz_out: 'outind', hz_out: 'outres', zs_out: 'outres', outer: 'outres',
};
let n = 0;
for (const [id, plan] of Object.entries(MAP)) {
  const re = new RegExp("(\\{ id: '" + id + "'[^\\n]*?plan: ')([a-z]+)(')");
  if (!re.test(s)) { console.warn('未找到片区', id); continue; }
  s = s.replace(re, (_m, a, _b, c) => a + plan + c);
  n++;
}
await writeFile(p, s);
console.log('plans 已写入，片区改指', n, '个');