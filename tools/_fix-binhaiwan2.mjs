import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');
const LAND_OLD = '[[106,176],[117,179],[121,190],[117,200],[104,200],[101,190],[103,182]]';
const FILL_OLD = '[[96,178],[106,176],[103,182],[101,190],[104,200],[97,199],[93,190],[93,184]]';
// 交椅湾、沙角一带的主航道以西本来就是水面（岸线 x 106→101），填海范围放在水面里才有视觉与机制意义
const FILL = '[[87,179],[97,176],[100,183],[99,193],[95,201],[89,197],[86,188]]';
const LAND = '[[87,179],[97,176],[106,176],[117,179],[121,190],[117,200],[104,200],[95,201],[89,197],[86,188]]';
s = s.split(LAND_OLD).join(LAND);
s = s.split(FILL_OLD).join(FILL);
fs.writeFileSync(f, s);
console.log('land', s.includes(LAND), 'fill', s.includes(FILL));