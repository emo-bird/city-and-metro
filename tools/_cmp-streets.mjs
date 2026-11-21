// 对比各图 geo 数据：步行街道（streets）与道路（roads）的规模
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const files = ['gz', 'hz', 'sz', 'bj', 'wh', 'sh', 'hk', 'tp', 'ny', 'ld', 'pa', 'sy', 'sg', 'tk', 'dg'];
for (const id of files) {
  let src;
  try { src = await readFile('js/geo_' + id + '.js', 'utf8'); } catch { console.log(id, 'missing'); continue; }
  const CM = { GEOS: {} };
  try { vm.runInNewContext(src, { window: { CM }, CM }); } catch (e) { console.log(id, 'ERR', e.message); continue; }
  const G = CM.GEOS[id];
  if (!G) { console.log(id, 'no geo'); continue; }
  const st = G.streets || '';
  const segs = st ? st.split('!').filter(Boolean).length : 0;
  const rows = G.roads || [];
  const cls = {}; for (const r of rows) cls[r[1]] = (cls[r[1]] || 0) + 1;
  console.log(id.padEnd(4), 'roads', String(rows.length).padStart(6), 'cls', JSON.stringify(cls), 'streets 段', String(segs).padStart(6), 'streets 字符', String(st.length).padStart(7));
}