import { geoIndex } from './geo-index.mjs';
import { simulationStamp } from './sim-stamp.mjs';
import { execFileSync } from 'node:child_process';

await geoIndex(process.cwd(), true);
await simulationStamp(true);
console.log('--- verify --write');
execFileSync(process.execPath, ['scripts/verify-game.mjs', '--write'], { stdio: 'inherit' });
console.log('--- verify read-only');
execFileSync(process.execPath, ['scripts/verify-game.mjs'], { stdio: 'inherit' });