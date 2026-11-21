import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {}, CM: { GEOS: {}, U: {} } };
ctx.window.CM = ctx.CM;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/geo_dg.js', 'utf8'), ctx);
const G = ctx.CM.GEOS.dg;
const names = new Set(['沙田', '沙田镇', '石龙', '石龙镇', '黄江', '黄江镇', '滨海湾', '滨海湾新区', '南城', '南城街道', '松山湖', '松山湖园区', '凤岗', '凤岗镇', '雁田', '交椅湾', '塘厦', '塘厦镇', '虎门', '虎门镇', '厚街', '厚街镇', '常平', '常平镇', '樟木头', '樟木头镇', '长安', '长安镇', '麻涌', '麻涌镇', '道滘', '道滘镇', '中堂', '中堂镇', '寮步', '寮步镇', '大朗', '大朗镇', '莞城', '莞城街道', '南城CBD', '鸿福路', '松山湖园区']);
const hits = [];
for (const p of G.places || []) if (names.has(p[0])) hits.push(p);
console.log('places hits');
for (const p of hits) console.log(' ', p[0], +p[1].toFixed(1), +p[2].toFixed(1), 'type', p[3]);
// 也按名字模糊搜索
const like = ['滨海', '雁田', '交椅', '松山湖', '黄江', '石龙', '沙田', '鸿福'];
for (const k of like) {
  const found = (G.places || []).filter((p) => p[0].includes(k)).slice(0, 8).map((p) => p[0] + '(' + p[1].toFixed(1) + ',' + p[2].toFixed(1) + ')');
  console.log(k, '→', found.join(' '));
}