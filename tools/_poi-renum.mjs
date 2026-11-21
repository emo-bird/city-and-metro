import fs from 'node:fs';

const p = 'scripts/_dg-poi.md';
let md = fs.readFileSync(p, 'utf8');
let n = 0;
const out = md.split(/\r?\n/).map(ln => {
  if (/^\| \d+ \| /.test(ln)) {
    n += 1;
    return ln.replace(/^\| \d+ \| /, '| ' + n + ' | ');
  }
  return ln;
});
md = out.join('\n');
md = md.replace('- 总条数：**203**', '- 总条数：**206**');
md = md.replace('医疗 40、高校 27、商圈/商业 23、公园/景点 43、会展/文体 26、产业/园区 24、交通枢纽 20',
  '医疗 40、高校 27、商圈/商业 23、公园/景点 43、会展/文体 26、产业/园区 25、交通枢纽 22');
md = md.replace('- 东莞境内：**162** 条；市外（深/广/惠/中）：41 条', '- 东莞境内：**162** 条；市外（深/广/惠州西部）：44 条');
fs.writeFileSync(p, md, 'utf8');
console.log('renumbered=' + n);