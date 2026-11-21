// 从 _poi-raw.json 里按类别/关键词筛出条目，写成可读文本
//   node tools/_poi-find.mjs medical "医院|卫生院"  out.txt
import { readFileSync, writeFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tools/_poi-raw.json', 'utf8'));
const cat = process.argv[2] || '';
const re = process.argv[3] ? new RegExp(process.argv[3]) : null;
const outFile = process.argv[4] || 'tools/_poi-list.txt';
const rows = raw.items.filter((it) => (!cat || cat === 'all' || it.cat === cat) && (!re || re.test(it.name)));
rows.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
const lines = rows.map((it) => `${it.name}\t${it.cat}\t${it.lat.toFixed(4)},${it.lon.toFixed(4)}\t${it.kind}\t${[it.tags.amenity, it.tags.shop, it.tags.leisure, it.tags.landuse, it.tags.railway, it.tags.aeroway, it.tags.tourism, it.tags.healthcare].filter(Boolean).join('/')}\t${it.tags.start_date || ''}`);
writeFileSync(outFile, lines.join('\n'));
console.log(`${rows.length} -> ${outFile}`);