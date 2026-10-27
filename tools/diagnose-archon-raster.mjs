// Diagnostic evidence, deliberately separate from the stable-scanout test.
// Reports the first difference in each continuously running original duel.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compareRaster} from './test-archon-raster.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const file of ['archon-raster.json','archon-raster-pal.json']){
 const ref=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures',file)));
 const {failures,checked}=compareRaster(ref);
 console.log(`${ref.tv||'ntsc'}: ${failures.length}/${ref.cases.length} continuous raster duels differ; ${checked} fields examined.`);
 for(const failure of failures)console.log('DIFFERENCE '+failure);
}
