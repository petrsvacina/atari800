import fs from 'node:fs';import zlib from 'node:zlib';
export const readFixture=name=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url))));
