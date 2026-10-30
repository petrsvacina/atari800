import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary')});
for(const file of ['assets/motion.js','assets/art.js','characters.js','motion.js','combat.js','fight.js','hazards.js','bitmap.js','camera.js','battle.js','assets/scene1.js','scenery1.js','assets/scene2.js','scenery2.js','input.js','assets/rooms.js','rooms.js','stage1.js','assets/campaign.js','stage2.js','stage3.js','stage4.js','assets/special-character.js','special-character.js'])vm.runInContext(fs.readFileSync(path.join(root,'karateka',file),'utf8'),scope,{filename:file});
const D=scope.KARATEKA_MOTION_DATA,{fighter,bytes,Motion}=scope.KaratekaMotion,{Combat}=scope.KaratekaCombat;
const fixtures=name=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'research/karateka',name+'-oracle.json.gz'))));
const equal=(got,want,details)=>assert.equal(JSON.stringify(got),JSON.stringify(want),JSON.stringify(details));
let count=0;
for(const c of fixtures('motion')){
 const r=new Motion(D),f=fighter(c.fighter);Object.assign(r,{heroX:c.globals[98],align:c.globals[80],distance:c.globals[51]});
 if(c.routine===0x6400)r.advance(f);else r.command(f,c.command);
 equal([Array.from(bytes(f)),{'69':r.sound,'70':r.kick,'71':r.punch}],c.expected,c);count++;
}
console.log('PASS 16000 original motion states, commands and input-latch side effects');
for(const c of fixtures('combat')){
 const r=new Combat(D),f=fighter(c.f);Object.assign(r,{hero:fighter(c.hero),heroX:c.hero[2],align:c.g[80],distance:c.g[51],random:c.g[72],phase:c.g[48],room:c.g[68],enemySide:c.g[75],playerSide:c.g[76],kind:c.g[77],camera:c.g[82],heroAlive:c.g[93],scene:c.g[208],kickChance:c.g[215],punchChance:c.g[216],waitChance:c.g[217]});
 r.ai(f);equal([Array.from(bytes(f)),{'69':r.sound,'70':r.kick,'71':r.punch,'72':r.random}],c.expected,c);count++;
}
console.log('PASS 12000 original guard decisions, including RNG consumption');
for(const c of fixtures('contact')){
 const r=new Combat(D);r.hero=fighter();Object.assign(r.hero,{legs:c.heroPose,running:c.heroMode,x:c.heroX});equal([r.contact(c.pose,c.attack,c.distance,c.side),r.hero.x],c.expected,c);count++;
}
console.log('PASS 10080 original range/contact cases, including close-contact displacement');
for(const c of fixtures('gate')){
 const gate=new scope.KaratekaHazards.Gate(),motion=new Motion(D);motion.align=c.g[80];
 const g={hero:fighter(c.f),motion,activePose:c.g[32],heroAlive:c.g[93],enemyAlive:c.g[94],health:c.g[182],restore:0,restoreDelay:30,enemyImpact:0,cue:0};
 Object.assign(gate,{y:c.g[167],velocity:c.g[168],acceleration:c.g[169],wait:c.g[170]});gate.tick(g);
 equal([Array.from(bytes(g.hero)),{...c.g,32:g.activePose,167:gate.y,168:gate.velocity,169:gate.acceleration,170:gate.wait,93:g.heroAlive,182:g.health,91:g.restore,184:g.restoreDelay,67:g.enemyImpact,69:motion.sound,70:motion.kick,71:motion.punch,30225:g.cue?255:0}],c.expected,c);count++;
}
console.log('PASS 10000 original gate motion, trigger and impact cases');
for(const c of fixtures('hawk')){
 const h=new scope.KaratekaHazards.Hawk();Object.assign(h,{delay:c.g[144],x:c.g[145],nextDelay:c.g[146],y:c.g[147],dx:c.g[148],frame:c.g[149],turn:c.g[150],active:c.g[152],passes:c.g[164],maxPasses:c.g[165]});
 const g={hero:fighter(c.f),heroAlive:c.g[93],enemyAlive:c.g[94],enemyHealth:c.g[183],enemyRestore:0,hold:0,holdRequested:0,enemyImpact:0,heroImpact:0,flash:0,redraw:0,recovery:0};h.tick(g);
 equal({...c.g,144:h.delay,145:h.x,146:h.nextDelay,147:h.y,148:h.dx,149:h.frame,150:h.turn,151:g.flash,152:h.active,164:h.passes,94:g.enemyAlive,183:g.enemyHealth,92:g.enemyRestore,186:g.hold,78:g.holdRequested,67:g.enemyImpact,64:g.heroImpact,131:g.redraw,137:g.recovery},c.expected,c);count++;
}
console.log('PASS 16000 original hawk movement and attack/defence windows');
for(const c of fixtures('palace-hawk')){
 const h=new scope.KaratekaHazards.PalaceHawk();Object.assign(h,{delay:c.g[144],x:c.g[145],nextDelay:c.g[146],y:c.g[147],dx:c.g[148],frame:c.g[149],turn:c.g[150],passes:c.g[164],maxPasses:c.g[165]});
 const g={hero:fighter(c.f),heroAlive:c.g[93],random:c.g[72],hold:0,holdRequested:0,enemyImpact:0,heroImpact:0,flash:0,redraw:0,recovery:0};h.tick(g);
 equal({...c.g,144:h.delay,145:h.x,146:h.nextDelay,147:h.y,148:h.dx,149:h.frame,150:h.turn,151:g.flash,164:h.passes,186:g.hold,78:g.holdRequested,67:g.enemyImpact,64:g.heroImpact,84:g.redraw,137:g.recovery},c.expected,c);count++;
}
console.log('PASS 10000 original palace hawk attacks and retreat timing');
for(const c of fixtures('bitmap')){
 const b=new scope.KaratekaBitmap();let seed=c.seed;
 for(let i=0;i<6120;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed>>>24;for(let j=0;j<4;j++)b.pixels[i*4+j]=value>>(6-j*2)&3;}
 if(c.kind==='blit')b.blit(c.art,c.x,c.y,c.shift,c.mode,c.routine===0x2809||c.routine===0x280c,c.routine===0x2806||c.routine===0x280c);
 else b.rectangle(c.left,c.top,c.right,c.bottom,c.pattern,c.alternate);
 assert.equal(crypto.createHash('sha256').update(Buffer.from(b.packed())).digest('hex'),c.sha256,JSON.stringify(c));count++;
}
console.log('PASS 2200 original bitmap clipping, masking, mirroring and rectangle cases');
for(const c of fixtures('character')){
 const b=new scope.KaratekaBitmap();let seed=c.seed;
 for(let i=0;i<6120;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed>>>24;for(let j=0;j<4;j++)b.pixels[i*4+j]=value>>(6-j*2)&3;}
 const f=fighter(c.fighter);new scope.KaratekaCharacters().draw(b,f,c.shift,c.style,!!c.alternate);
 assert.equal(crypto.createHash('sha256').update(Buffer.from(b.packed())).digest('hex'),c.sha256,JSON.stringify(c));assert.equal(f.drawX,c.drawX);count++;
}
console.log('PASS 2600 original composite characters with subpixel offsets, head variants and clipping');
for(const c of fixtures('camera')){
 const cam=new scope.KaratekaCamera(c.scene);Object.assign(cam,{shift:c.state[80],cloud:c.state[81],offset:c.state[82],velocity:c.state[83],room:c.state[68],heroX:c.state[98],enemyX:c.state[114],hawkX:c.state[145]});
 if(c.direction===0)cam.right(c.state[111],c.state[101]);else cam.left();
 equal({...c.state,80:cam.shift,81:cam.cloud,82:cam.offset,83:cam.velocity,98:cam.heroX,114:cam.enemyX,145:cam.hawkX},c.expected,c);count++;
}
console.log('PASS 18000 original pan states in three campaign scenes');
for(const c of fixtures('battle')){
 const g=new scope.KaratekaBattle();g.hero=fighter(c.hero);g.enemy=fighter(c.enemy);const z=c.state;
 g.results=[z[64],z[65]];g.hit=[z[66],z[67]];Object.assign(g.rules,{sound:z[69],kick:z[70],punch:z[71]});Object.assign(g,{enemySide:z[75],playerSide:z[76],kind:z[77],holdRequested:z[78],recovery:z[90]});Object.assign(g.camera,{shift:z[80],offset:z[82]});g.restore=[z[91],z[92]];g.alive=[z[93],z[94]];g.max=[z[176],z[177]];g.health=[z[182],z[183]];g.restoreDelay=[z[184],z[185]];g.hold=z[186];g.damage();
 equal([Array.from(bytes(g.hero)),Array.from(bytes(g.enemy)),{...z,64:g.results[0],65:g.results[1],66:g.hit[0],67:g.hit[1],69:g.rules.sound,70:g.rules.kick,71:g.rules.punch,75:g.enemySide,76:g.playerSide,77:g.kind,78:g.holdRequested,91:g.restore[0],92:g.restore[1],93:g.alive[0],94:g.alive[1],182:g.health[0],183:g.health[1],186:g.hold}],c.expected,c);count++;
}
console.log('PASS 12000 original hit integrations, energy and side effects');
for(const c of fixtures('scenery1')){
 const b=new scope.KaratekaBitmap(),s=new scope.KaratekaScenery1();s.paint(b,c.state);
 assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.background,JSON.stringify(c));s.foreground(b,c.state);
 assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.foreground,JSON.stringify(c));count++;
}
console.log('PASS 240 original scene-1 background and foreground repaints');
for(const c of fixtures('input')){
 const r=new Motion(D),f=fighter(c.fighter),i=new scope.KaratekaInput(),z=c.state;Object.assign(r,{sound:z[69],kick:z[70],punch:z[71],align:z[80],heroX:z[98]});Object.assign(i,{code:z[221],pending:z[223],repeat:z[242]});i.keyboard(r,f);
 equal([Array.from(bytes(f)),{...z,69:r.sound,70:r.kick,71:r.punch,221:i.code,223:i.pending,242:i.repeat}],c.expected,c);count++;
}
console.log('PASS 12000 original keyboard commands and pending attack consumption');
for(const c of fixtures('scenery2')){
 const b=new scope.KaratekaBitmap(),s=new scope.KaratekaScenery2();s.paint(b,c.state);assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.background,JSON.stringify(c));s.foreground(b,c.state);assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.foreground,JSON.stringify(c));count++;
}
console.log('PASS 240 original palace backgrounds and moving portcullis repaints');
for(const c of fixtures('rooms')){
 const b=new scope.KaratekaBitmap(),s=new scope.KaratekaRooms();s.paint(b,c.state);assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.background,JSON.stringify(c));s.foreground(b,c.state);assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.foreground,JSON.stringify(c));count++;
}
console.log('PASS 240 original corridor and common palace-room repaints');
for(const c of fixtures('stage1')){
 const g=new scope.KaratekaStage1(),z=c.state;g.endFrame=()=>{};g.hero=fighter(c.fighters[0]);g.enemy=fighter(c.fighters[1]);
 Object.assign(g,{progress:z[48],guardStyle:z[62],results:[z[64],z[65]],hit:[z[66],z[67]],enemySide:z[75],playerSide:z[76],kind:z[77],holdRequested:z[78],recovery:z[90],restore:[z[91],z[92]],alive:[z[93],z[94]],marker:z[130],deathDelay:z[136],enemyWait:z[137],farDelay:z[139],climb:z[153],falling:z[161],cliffFall:z[162],cutRequested:z[175],max:[z[176],z[177]],health:[z[182],z[183]],restoreDelay:[z[184],z[185]],hold:z[186],buffer:z[7],mode:'playing'});
 Object.assign(g.camera,{room:z[68],shift:z[80],cloud:z[81],offset:z[82],velocity:z[83]});Object.assign(g.rules,{sound:z[69],kick:z[70],punch:z[71],random:z[72]});Object.assign(g.input,{code:z[221],pending:z[223],repeat:z[242]});g.enemyProbabilities();g.tick({});
 const out={48:g.progress,62:g.guardStyle,64:g.results[0],65:g.results[1],66:g.hit[0],67:g.hit[1],68:g.camera.room,69:g.rules.sound,70:g.rules.kick,71:g.rules.punch,72:g.rules.random,75:g.enemySide,76:g.playerSide,77:g.kind,78:g.holdRequested,80:g.camera.shift,81:g.camera.cloud,82:g.camera.offset,83:g.camera.velocity,90:g.recovery,91:g.restore[0],92:g.restore[1],93:g.alive[0],94:g.alive[1],130:g.marker,136:g.deathDelay,137:g.enemyWait,139:g.farDelay,153:g.climb,161:g.falling,162:g.cliffFall,175:g.cutRequested,176:g.max[0],177:g.max[1],182:g.health[0],183:g.health[1],184:g.restoreDelay[0],185:g.restoreDelay[1],186:g.hold,221:g.input.code,223:g.input.pending,242:g.input.repeat};
 equal([Array.from(bytes(g.hero)),Array.from(bytes(g.enemy)),out],c.expected,c);count++;
}
console.log('PASS 6000 original outdoor battle/camera integrations before rendering');
for(const c of fixtures('stage2')){
 const g=new scope.KaratekaStage2(),z=c.state;g.endFrame=()=>{};g.hawk.animate=()=>{};g.hero=fighter(c.fighters[0]);g.enemy=fighter(c.fighters[1]);
 Object.assign(g,{progress:z[48],guardStyle:z[62],results:[z[64],z[65]],hit:[z[66],z[67]],enemySide:z[75],playerSide:z[76],kind:z[77],holdRequested:z[78],recovery:z[90],restore:[z[91],z[92]],alive:[z[93],z[94]],marker:z[130],deathDelay:z[136],enemyWait:z[137],farDelay:z[139],climb:z[153],falling:z[161],cliffFall:z[162],cutRequested:z[175],max:[z[176],z[177]],health:[z[182],z[183]],restoreDelay:[z[184],z[185]],hold:z[186],buffer:z[7],mode:'playing'});
 Object.assign(g.camera,{room:z[68],shift:z[80],cloud:z[81],offset:z[82],velocity:z[83]});Object.assign(g.rules,{sound:z[69],kick:z[70],punch:z[71],random:z[72]});Object.assign(g.input,{code:z[221],pending:z[223],repeat:z[242]});Object.assign(g,{courtSeen:z[53],birdEnabled:z[87],flash:z[151]});Object.assign(g.gate,{y:z[167],velocity:z[168],acceleration:z[169],wait:z[170]});Object.assign(g.hawk,{delay:z[144],x:z[145],nextDelay:z[146],y:z[147],dx:z[148],frame:z[149],turn:z[150],active:z[152],passes:z[164],maxPasses:z[165]});g.enemyProbabilities();g.tick({});
 const out={53:g.courtSeen,85:z[85],87:g.birdEnabled,144:g.hawk.delay,145:g.hawk.x,146:g.hawk.nextDelay,147:g.hawk.y,148:g.hawk.dx,149:g.hawk.frame,150:g.hawk.turn,151:g.flash,152:g.hawk.active,164:g.hawk.passes,165:g.hawk.maxPasses,167:g.gate.y,168:g.gate.velocity,169:g.gate.acceleration,170:g.gate.wait,48:g.progress,62:g.guardStyle,64:g.results[0],65:g.results[1],66:g.hit[0],67:g.hit[1],68:g.camera.room,69:g.rules.sound,70:g.rules.kick,71:g.rules.punch,72:g.rules.random,75:g.enemySide,76:g.playerSide,77:g.kind,78:g.holdRequested,80:g.camera.shift,81:g.camera.cloud,82:g.camera.offset,83:g.camera.velocity,90:g.recovery,91:g.restore[0],92:g.restore[1],93:g.alive[0],94:g.alive[1],130:g.marker,136:g.deathDelay,137:g.enemyWait,139:g.farDelay,153:g.climb,161:g.falling,162:g.cliffFall,175:g.cutRequested,176:g.max[0],177:g.max[1],182:g.health[0],183:g.health[1],184:g.restoreDelay[0],185:g.restoreDelay[1],186:g.hold,221:g.input.code,223:g.input.pending,242:g.input.repeat};
 equal([Array.from(bytes(g.hero)),Array.from(bytes(g.enemy)),out],c.expected,c);count++;
}
console.log('PASS 4000 original palace battle, gate, hawk and camera integrations before rendering');
for(const c of fixtures('stage3')){
 const g=new scope.KaratekaStage3(),z=c.state;g.endFrame=()=>{};g.hawk.animate=()=>{};g.hero=fighter(c.fighters[0]);g.enemy=fighter(c.fighters[1]);
 Object.assign(g,{progress:z[48],guardStyle:z[62],results:[z[64],z[65]],hit:[z[66],z[67]],enemySide:z[75],playerSide:z[76],kind:z[77],holdRequested:z[78],recovery:z[90],restore:[z[91],z[92]],alive:[z[93],z[94]],marker:z[130],deathDelay:z[136],enemyWait:z[137],farDelay:z[139],climb:z[153],falling:z[161],cliffFall:z[162],cutRequested:z[175],max:[z[176],z[177]],health:[z[182],z[183]],restoreDelay:[z[184],z[185]],hold:z[186],buffer:z[7],mode:'playing'});
 Object.assign(g.camera,{room:z[68],shift:z[80],cloud:z[81],offset:z[82],velocity:z[83]});Object.assign(g.rules,{sound:z[69],kick:z[70],punch:z[71],random:z[72]});Object.assign(g.input,{code:z[221],pending:z[223],repeat:z[242]});Object.assign(g,{door:z[132],flash:z[151],endingState:z[154],doorThreshold:z[197],extraDoor:z[237]});Object.assign(g.hawk,{delay:z[144],x:z[145],nextDelay:z[146],y:z[147],dx:z[148],frame:z[149],turn:z[150],active:z[152],passes:z[164],maxPasses:z[165]});g.enemyProbabilities();g.tick({});
 const out={132:g.door,154:g.endingState,197:g.doorThreshold,237:g.extraDoor,144:g.hawk.delay,145:g.hawk.x,146:g.hawk.nextDelay,147:g.hawk.y,148:g.hawk.dx,149:g.hawk.frame,150:g.hawk.turn,151:g.flash,152:g.hawk.active,164:g.hawk.passes,165:g.hawk.maxPasses,48:g.progress,62:g.guardStyle,64:g.results[0],65:g.results[1],66:g.hit[0],67:g.hit[1],68:g.camera.room,69:g.rules.sound,70:g.rules.kick,71:g.rules.punch,72:g.rules.random,75:g.enemySide,76:g.playerSide,77:g.kind,78:g.holdRequested,80:g.camera.shift,81:g.camera.cloud,82:g.camera.offset,83:g.camera.velocity,90:g.recovery,91:g.restore[0],92:g.restore[1],93:g.alive[0],94:g.alive[1],130:g.marker,136:g.deathDelay,137:g.enemyWait,139:g.farDelay,153:g.climb,161:g.falling,162:g.cliffFall,175:g.cutRequested,176:g.max[0],177:g.max[1],182:g.health[0],183:g.health[1],184:g.restoreDelay[0],185:g.restoreDelay[1],186:g.hold,221:g.input.code,223:g.input.pending,242:g.input.repeat};
 equal([Array.from(bytes(g.hero)),Array.from(bytes(g.enemy)),out],c.expected,c);count++;
}
console.log('PASS 7000 original underground battle, hawk and room transition integrations before rendering');
for(const c of fixtures('stage4')){
 const g=new scope.KaratekaStage4(),z=c.state;g.endFrame=()=>{};g.hawk.animate=()=>{};g.hero=fighter(c.fighters[0]);g.enemy=fighter(c.fighters[1]);
 Object.assign(g,{progress:z[48],guardStyle:z[62],results:[z[64],z[65]],hit:[z[66],z[67]],enemySide:z[75],playerSide:z[76],kind:z[77],holdRequested:z[78],recovery:z[90],restore:[z[91],z[92]],alive:[z[93],z[94]],marker:z[130],deathDelay:z[136],enemyWait:z[137],farDelay:z[139],climb:z[153],falling:z[161],cliffFall:z[162],cutRequested:z[175],max:[z[176],z[177]],health:[z[182],z[183]],restoreDelay:[z[184],z[185]],hold:z[186],buffer:z[7],mode:'playing'});
 Object.assign(g.camera,{room:z[68],shift:z[80],cloud:z[81],offset:z[82],velocity:z[83]});Object.assign(g.rules,{sound:z[69],kick:z[70],punch:z[71],random:z[72]});Object.assign(g.input,{code:z[221],pending:z[223],repeat:z[242]});Object.assign(g,{door:z[132],flash:z[151],endingState:z[154],doorThreshold:z[197],extraDoor:z[237]});Object.assign(g.hawk,{delay:z[144],x:z[145],nextDelay:z[146],y:z[147],dx:z[148],frame:z[149],turn:z[150],active:z[152],passes:z[164],maxPasses:z[165]});Object.assign(g,{marikoPose:z[57],marikoStep:z[59],threat:z[88],marikoWait:z[160],entranceMusic:!!z[46854]});g.enemyProbabilities();g.tick({});
 const out={57:g.marikoPose,59:g.marikoStep,88:g.threat,160:g.marikoWait,46854:g.entranceMusic?255:0,132:g.door,154:g.endingState,197:g.doorThreshold,237:g.extraDoor,144:g.hawk.delay,145:g.hawk.x,146:g.hawk.nextDelay,147:g.hawk.y,148:g.hawk.dx,149:g.hawk.frame,150:g.hawk.turn,151:g.flash,152:g.hawk.active,164:g.hawk.passes,165:g.hawk.maxPasses,48:g.progress,62:g.guardStyle,64:g.results[0],65:g.results[1],66:g.hit[0],67:g.hit[1],68:g.camera.room,69:g.rules.sound,70:g.rules.kick,71:g.rules.punch,72:g.rules.random,75:g.enemySide,76:g.playerSide,77:g.kind,78:g.holdRequested,80:g.camera.shift,81:g.camera.cloud,82:g.camera.offset,83:g.camera.velocity,90:g.recovery,91:g.restore[0],92:g.restore[1],93:g.alive[0],94:g.alive[1],130:g.marker,136:g.deathDelay,137:g.enemyWait,139:g.farDelay,153:g.climb,161:g.falling,162:g.cliffFall,175:g.cutRequested,176:g.max[0],177:g.max[1],182:g.health[0],183:g.health[1],184:g.restoreDelay[0],185:g.restoreDelay[1],186:g.hold,221:g.input.code,223:g.input.pending,242:g.input.repeat};
 equal([Array.from(bytes(g.hero)),Array.from(bytes(g.enemy)),out],c.expected,c);count++;
}
console.log('PASS 5000 original final-bank battle and Mariko recognition/reunion steps before rendering');
for(const c of fixtures('special-character')){
 const b=new scope.KaratekaBitmap();let seed=c.seed;for(let i=0;i<6120;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed>>>24;for(let j=0;j<4;j++)b.pixels[i*4+j]=value>>(6-j*2)&3;}
 const f=fighter(c.fighter);new scope.KaratekaSpecialCharacter().draw(b,f,c.shift);assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.sha256,JSON.stringify(c));assert.equal(f.drawX,c.drawX);count++;
}
console.log('PASS 1200 original final-opponent composites, including masking and clipping');
for(let kind=0;kind<6;kind++)for(let strategy=0;strategy<4;strategy++){
 const g=new scope.KaratekaFight({kind});for(let i=0;i<3000&&g.phase==='playing';i++){
  const gap=g.enemy.x-g.hero.x;g.tick({stance:i===0,move:gap>8?1:gap<6?-1:0,kick:strategy<2&&i%14<7,punch:strategy>=2&&i%11<5,height:strategy&1?1:0});
  for(const f of [g.hero,g.enemy]){assert(f.legs<42&&f.torso<38,'Preview produced an invalid pose');assert(Number.isInteger(f.x));}
  for(const hp of g.health)assert(hp>=0&&hp<=14);
 }
}
console.log('PASS 24 preview input strategies retain valid poses and health');
console.log(`${count} isolated original-routine comparisons passed. This does not verify the campaign, integration cadence, graphics, or audio.`);
