import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');
const OLD = '[[62,176],[74,169],[90,168],[104,174],[112,186],[104,197],[88,201],[72,195],[62,187]]';
const LAND = '[[106,176],[117,179],[121,190],[117,200],[104,200],[101,190],[103,182]]';
const FILL = '[[96,178],[106,176],[103,182],[101,190],[104,200],[97,199],[93,190],[93,184]]';
s = s.split(OLD).join(LAND);
s = s.replace("{ name: '滨海湾新区（填海）', year: 2010, poly: " + LAND,
  "{ name: '滨海湾新区（填海）', year: 2010, poly: " + FILL);
fs.writeFileSync(f, s);
const land = s.includes(LAND), fill = s.includes(FILL);
console.log('陆域片区', land, '填海', fill);