import fs from 'node:fs';
let d = fs.readFileSync('js/data_dg.js', 'utf8');

function matchBrace(s, i) { // i 指向 '{'
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

for (const id of ['dg-e1', 'dg-e2', 'dg-e3', 'dg-e4']) {
  const at = d.indexOf("id: '" + id + "'");
  if (at < 0) throw new Error('missing era ' + id);
  const ds = d.indexOf('demand: {', at);
  if (ds < 0) throw new Error('missing demand ' + id);
  const brStart = d.indexOf('{', ds);
  const brEnd = matchBrace(d, brStart);
  const seg = d.slice(brStart, brEnd + 1);
  if (!seg.includes('corridors')) { console.log('skip', id); continue; }
  const ci = seg.indexOf('corridors: [');
  const arrEnd = seg.indexOf(']', ci) + 1;
  const corr = seg.slice(ci, arrEnd);
  // demand 内容 = 去掉 corridors 及其前面的逗号
  let inner = seg.slice(1, seg.lastIndexOf('corridors')).replace(/[,\s]+$/, '');
  const rebuilt = 'demand: {' + inner + ' },\n        ' + corr.replace(/,\s*$/, '') + ',';
  d = d.slice(0, ds) + rebuilt + d.slice(brEnd + 1);
  console.log('fixed', id, '=>', rebuilt.slice(0, 80));
}
fs.writeFileSync('js/data_dg.js', d);