/* H.E.R.O. foreground rules, native JavaScript. Original byte overflow and
 * ordering are retained; there is no CPU, instruction decoder or ROM here. */
(function(root){'use strict';
const byte=n=>n&255,negative=n=>(n&128)!==0,bcd=n=>(n>>4)*10+(n&15);
const fields={clock:0x04,x:0x21,room:0x22,backRoom:0x23,deepest:0x24,y:0x25,wallX:0x26,darkness:0x2a,power:0x31,motion:0x32,death:0x33,deathSlot:0x34,expired:0x35,facing:0x36,wallPhase:0x37,bombs:0x38,lives:0x39,attached:0x3e,floorPresent:0x3f,middleMode:0x4a,flash:0x62,groundMask:0x67,flyFrame:0x68,walkFrame:0x69,lift:0x6a,minerOffset:0x6d,rescue:0x73,beamX:0x74,beamWallHit:0x75,level:0x7e,laserPhase:0x79,lampHit:0x7a,playerLower:0x7b,playerMiddle:0x7c,playerUpper:0x7d,still:0x85,extraExplosion:0x89,drawnRoom:0x8a,turnDelay:0x8b,movingWallPhase:0x8c,ghostContact:0x8d,hudLevel:0x8e,horizontalDelay:0x8f,lastStick:0x90};
const arrays={enemyY:[0x27,3],enemyX:[0x2b,3],bombX:[0x2e,3],wallColors:[0x46,3],enemyFrames:[0x4c,3],enemyColors:[0x4f,3],contact:[0x52,3],shotHit:[0x55,3],effectFrames:[0x59,3],effectColors:[0x5c,3],fuses:[0x5f,3],enemyPhase:[0x6b,2],backup:[0x6e,5],killed:[0x86,3]};
class Game{
 constructor(options={}){this.assets=options.assets||root.HERO_ORIGINAL;this.random=options.random||(()=>Math.random()*256|0);this.best=options.best||0;this.reset(options.difficulty||0);}
 reset(difficulty=0){
  const s=this.s={};for(const k of Object.keys(fields))s[k]=0;for(const [k,[,count]] of Object.entries(arrays))s[k]=new Uint8Array(count);
  s.tiles=new Uint8Array(264);s.upper=new Uint8Array(3);s.lower=new Uint8Array(3);
  s.drawnRoom=255;s.laserPhase=255;s.level=this.assets.difficultyStart[difficulty];s.hudLevel=s.level;this.difficulty=difficulty;this.endless=false;this.maxScore=false;this.score=0;this.phase='playing';this.frames=0;this.body=null;this.inStep=false;this.prepareLevel(true);this.roomData();this.actors();this.preparePose();
 }
 prepareLevel(first=false){const s=this.s,initial=this.assets.initial;
  s.x=initial[0];s.room=initial[1];s.backRoom=initial[2];s.deepest=initial[3];s.y=initial[4];s.wallX=initial[5];
  s.enemyY.set(initial.slice(6,9));s.darkness=initial[9];s.enemyX.set(initial.slice(10,13));s.bombX.set(initial.slice(13,16));
  s.power=initial[16];s.motion=initial[17];s.death=initial[18];s.deathSlot=initial[19];s.expired=initial[20];s.facing=initial[21];s.wallPhase=initial[22];s.bombs=initial[23];if(first)s.lives=initial[24];
  s.darkness=[0x20,0xc0,0x90,0][s.level&3];
  if(first)s.drawnRoom=255;s.room=0;
 }
 get level(){return this.s.level+1;}get lives(){return this.s.lives;}get power(){return this.s.power;}
 index(){return byte(this.assets.levelOffsets[this.s.level]+this.s.room);}
 kill(slot=0){this.s.deathSlot=slot;this.s.death=255;}
 addScore(points){const previous=Math.floor(this.score/10000),s=this.s;this.score+=points;
  if(this.score>999999){this.score=1222221;this.maxScore=true;this.best=999999;s.gameOver=255;s.room=0;s.level=0;this.difficulty=0;this.phase='over';return;}
  const next=Math.floor(this.score/10000),packed=n=>(Math.floor(n/10)<<4)|(n%10);
  if(((packed(previous)^packed(next))&0x12)&&s.lives<7)s.lives++;
  this.best=Math.max(this.best,this.score);
 }
 changeRoom(oldRoom){const s=this.s;s.wallPhase=0;s.extraExplosion=0;s.enemyPhase.fill(0);s.still=0;s.movingWallPhase=0x50;s.bombX.fill(0x93);s.minerOffset=s.facing>=8?0x60:0x80;
  for(let i=0;i<3;i++)if(s.killed[i]){s.enemyY[i]=50;s.killed[i]=0;}
  const current=[s.wallX,...s.enemyY,s.darkness];
  if(s.room===s.backRoom){s.wallX=s.backup[0];s.enemyY.set(s.backup.slice(1,4));s.darkness=s.backup[4];s.backup.set(current);}
  else{s.backup.set(current);s.darkness=[0x20,0xc0,0x90,0][s.level&3];const flags=this.assets.roomFlags[this.index()];s.wallX=flags&0xfc?(flags&0xfc)|1:0;
   const wall=s.wallX===9||s.wallX===153?s.wallX:0;s.wallX=s.deepest===s.room?s.wallX:wall;s.enemyY.fill(s.deepest===s.room?0:50);
  }
  s.backRoom=oldRoom;
 }
 // 82A0–8472: ghost contact, propeller acceleration and horizontal movement.
 move(stick){const s=this.s,a=this.assets;
  s.attached=0;
  if(s.effectFrames[0]===0xe5&&!s.death&&s.room>=11&&negative(s.ghostContact)){
   const reach=(s.minerOffset&127)+22;
   if(s.x<0x3b+reach&&s.y>=0x84&&s.y<0x88){s.y=0x84;s.groundMask=0x40;s.motion=0;s.facing=negative(s.minerOffset)?0:8;s.attached=255;s.x=byte(reach+0x34+(negative(s.minerOffset)?0:4));}
  }
  if(s.effectFrames[0]!==0xe5&&s.effectFrames[0]!==0x94&&!negative(s.contact[0])&&!s.death&&negative(s.ghostContact)&&s.room>=11){const target=s.x-48;stick=target===s.bombX[0]?15:target<s.bombX[0]?7:11;}
  if(s.flash||s.gameOver||s.rescue||s.death)return stick;
  if(!(stick&1)){s.lift=byte(s.lift+1);if(s.lift&64)s.lift=byte(s.lift-1);}else{s.lift=byte(s.lift-1);if(negative(s.lift))s.lift=byte(s.lift+1);}
  let velocity=s.lift>>3;if(s.room>=11&&!velocity)velocity=1;
  if(velocity>=4){if(!negative(s.groundMask)){
   let y=byte(s.y-a.verticalSpeed[velocity]);
   if(y<21){s.y=0x87;const old=s.room;s.room=byte(s.room-1);if(negative(s.room)){s.room=byte(s.room+1);y=22;s.y=y;}else{this.entryKind='up';this.changeRoom(old);}}
   else{s.y=y;this.lava();}
  }}else if(!(s.groundMask&64)){
   let y=byte(s.y+a.verticalSpeed[velocity]);
   if(s.room>=10&&y>=139){s.deathSlot=0;s.death=255;y=132;}
   if(y>=146){s.y=22;const old=s.room;if(s.deepest===s.room)s.deepest=byte(s.deepest+1);s.room=byte(s.room+1);this.entryKind='down';this.changeRoom(old);}
   else{s.y=y;this.lava();}
  }
  if(negative(s.attached)||s.death)return stick;
  if(!(s.x&3)){if((stick&12)===12)return stick;const facing=stick&8;if(facing!==s.facing){s.laserPhase=255;if(s.motion)s.turnDelay=3;}s.facing=facing;}
  s.turnDelay=byte(s.turnDelay-1);if(!negative(s.turnDelay))return stick;s.turnDelay=byte(s.turnDelay+1);
  if(!(s.x&3)){if((s.lastStick&12)===12)s.horizontalDelay=1;else{s.horizontalDelay=byte(s.horizontalDelay-1);if(!negative(s.horizontalDelay))return stick;s.horizontalDelay=byte(s.horizontalDelay+1);}}
  s.x=byte(s.x+(s.facing?-1:1));
  if((s.facing&&s.x<48)||(!s.facing&&s.x>=204)){
   const side=s.facing?0:1,old=s.room;
   if((a.creatures[2][this.index()]&1)!==side){if(s.deepest===s.room)s.deepest=byte(s.deepest+1);s.room=byte(s.room+1);}else s.room=byte(s.room-1);
   s.x=[200,52][side];this.entryKind='side';this.changeRoom(old);
  }
  return stick;
 }
 lava(){const s=this.s;if(s.room>=10&&s.y>=this.assets.lavaHeight[s.clock&3]){s.deathSlot=0;s.death=255;}}
 // 8472–857A: source room lookup and per-level palette.
 roomData(){const s=this.s,a=this.assets,i=this.index();s.darkness=(s.darkness&15)|[0x20,0xc0,0x90,0][s.level&3];
  for(let x=2;x>=0;x--)s.wallColors[x]=s.darkness&1?(s.fuses[1]||s.fuses[2]?2:0):([6,4,2][x]|s.darkness);
  for(let x=0;x<3;x++){let v=a.creatures[x][i];s.enemyX[x]=x===2?(v&0xfc)|1:(v===0x93?v:v&0xfc);if(x===2&&s.enemyX[x]===0x91)s.enemyX[x]=0x93;}
  s.upper[0]=!s.room?0xc0:s.room>=11?255:a.floors[0][byte(i-1)];s.upper[1]=a.floors[0][i];s.upper[2]=a.floors[1][i];
  s.lower[0]=!s.room?0:s.room>=11?255:a.floors[2][byte(i-1)];s.lower[1]=a.floors[2][i];s.lower[2]=a.floors[3][i];
  // Previous room's right-hand blocks live one table later.
  if(s.room&&s.room<11){s.upper[0]=a.floors[1][byte(i-1)];s.lower[0]=a.floors[3][byte(i-1)];}
  s.middleMode=a.roomFlags[i]&1?4:5;
  if(a.roomFlags[i]&2)s.wallColors[1]=s.clock&8?0x44:0x42;
  s.floorPresent=s.room<10&&(s.room===a.lastRooms[s.level]||!(s.wallX===9||s.wallX===153));
  if(s.lower[1]===254&&s.upper[1]===255&&s.level>=13){s.lower[1]=a.wallMotion[(s.movingWallPhase>>3)&7];if(s.playerMiddle)s.lampHit=1;}
  if(s.room!==s.drawnRoom){s.drawnRoom=s.room;root.HeroTerrain.build(s,a,this.random);if(this.inStep){
   const kind=this.entryKind||(!s.room&&s.death?(s.death===149?'intro':'empty'):'side');
   this.profile=root.HERO_TIMING?.rooms[`${s.level}:${s.room}:${kind}`]?.[this.frameClock&3];
   s.clock=byte(this.frameClock+(this.profile?.[0]??1));this.redrew=true;
  }}
 }
 // 857A–8765: enemy animation, dynamite fuses and the low-level pursuer.
 actors(){const s=this.s,a=this.assets,phase=(s.still>>2)&3,half=phase>>1;
  for(let x=2;x>=0;x--){
   if(x===2){s.enemyColors[x]=0x96;s.enemyFrames[x]=0x66;}
   else{
    const kind=a.creatures[x][this.index()]&3;
    if(s.enemyY[x]!==50){
     if(kind===3){s.enemyX[x]=byte(s.enemyX[x]+(s.killed[x]?9:s.enemyPhase[0]&127));s.enemyY[x]=10;}
     else if(kind){s.enemyY[x]=s.enemyPhase[1]&127;if(kind===2)s.enemyX[x]=byte(s.enemyX[x]+(s.enemyPhase[0]&127)*2);}
     else s.enemyY[x]=12;
    }
    const frameValues=[a.creatureFrames[half],a.creatureFrames[half+2],a.creatureFrames[phase+4],a.creatureColors[half]];
    s.enemyFrames[x]=frameValues[kind];s.enemyColors[x]=[0x51,0x5e,0x36,0x19][kind];
   }
   if(s.killed[x]){s.killed[x]--;if(!s.killed[x]){s.enemyY[x]=50;s.contact[x]=0;}s.enemyFrames[x]=0x7e;s.enemyColors[x]=0x44;}
   if(s.enemyX[x]>=0x93)s.enemyFrames[x]=0x94;
  }
  if(s.darkness&1){for(let x=2;x>=0;x--){if(s.fuses[x])break;if(s.enemyFrames[x]!==0x7e)s.enemyColors[x]=0xa5;}}
  for(let x=2;x>=0;x--){s.effectFrames[x]=a.bombFrames[s.flyFrame];s.effectColors[x]=0x6c;
   if(s.fuses[x]){s.fuses[x]--;if(!s.fuses[x]){s.extraExplosion=0;s.bombX[x]=0x93;}
    else if(s.fuses[x]<32){let y=s.fuses[x]<19&&s.extraExplosion?4:(s.fuses[x]>>1)&3;s.effectFrames[x]=a.bombFrames[3+y];s.effectColors[x]=0x44;if(!s.rescue)s.flash=a.bombColors[y];}
   }
   if(s.bombX[x]===0x93)s.effectFrames[x]=0x94;
  }
  if(s.room>=11&&s.level>=9&&!s.lower[2]&&s.upper[2]===0xc0){s.effectFrames[0]=0xe5;s.effectColors[0]=5;s.bombX[0]=byte((s.minerOffset&127)+28);}
  if(s.level>=16&&s.room>=11&&!s.lower[2]&&s.upper[2]===0xe0&&s.effectFrames[0]!==0xe5){
   if(s.bombX[0]===0x93)s.bombX[0]=s.facing?120:28;
   else if(s.bombX[0]!==0x92){
    if(s.death===0x95&&!s.deathSlot)s.bombX[0]=0x92;
    else if(!(s.clock&(s.level<18?3:1))){const target=s.x-48;if(s.bombX[0]<target)s.bombX[0]=Math.min(120,s.bombX[0]+1);else if(s.bombX[0]>target)s.bombX[0]=Math.max(28,s.bombX[0]-1);}
   }
   if(s.bombX[0]!==0x92){let frame=(s.still>>3)&7;if(s.death)frame=a.ghostDeath[s.death>>5];s.effectFrames[0]=a.ghostFrames[frame];s.effectColors[0]=0xe3;}
  }
  if(s.room===a.lastRooms[s.level]){
   s.effectFrames[1]=0x5c;s.effectColors[1]=0x27;s.bombX[1]=0x80;
   const flags=a.roomFlags[a.levelOffsets[s.level]+a.lastRooms[s.level]];
   if((flags&0xfc)===8){s.effectFrames[1]=0x7a;s.bombX[1]=0x18;}
   if(s.rescue)s.effectFrames[1]=s.facing?0x89:0x6b;
  }
 }
 choosePose(){const s=this.s,a=this.assets;
  let bits=a.heroBits,offset=0xd8,reverse=!!s.facing;
  if(s.death>=0x97){bits=a.heroBits;offset=0xf5;reverse=false;}
  // The original clear-sprite helper leaves A=0 before CMP #$8C; this
  // intentionally keeps the ordinary pose during the respawn descent.
  else if(negative(s.motion))offset=a.heroFly[s.flyFrame];else if(s.motion)offset=a.heroWalk[s.walkFrame];
  if(s.rescue)offset=negative(s.motion)?0x87:0xd8;
  this.body={bits,offset,reverse};
 }
 preparePose(){const s=this.s,a=this.assets;if(!this.body)this.choosePose();const {bits,offset,reverse}=this.body;
  const hero=Array.from({length:28},(_,i)=>bits[offset+i]||0);
  this.picture={hero,reverse,heroColors:a.heroColors.slice(),heroY:s.y+2,heroX:s.x,
   enemies:Array.from({length:3},(_,i)=>({bits:a.actorBits.slice(s.enemyFrames[i],s.enemyFrames[i]+13),colors:a.actorColors.slice(s.enemyColors[i],s.enemyColors[i]+13),x:s.enemyX[i]+48,y:[0x79,0x4e,0x2e][i]+s.enemyY[i]})),
   effects:Array.from({length:3},(_,i)=>({bits:a.effectBits.slice(s.effectFrames[i],s.effectFrames[i]+14),colors:a.effectColors.slice(s.effectColors[i],s.effectColors[i]+14),x:s.bombX[i]+48,y:[0x94,0x6a,0x3f][i]})),beam:{x:s.beamX,y:s.y+8,width:s.wallPhase<128?8:2}};
  // Effect images use A4xx, except the lower ghost/miner image, which is A0xx.
  // The latter sheet is supplied separately by the extractor.
  for(let i=0;i<3;i++)this.picture.effects[i].bits=this.assets.objectBits.slice(s.effectFrames[i],s.effectFrames[i]+14);
 }
 timers(){const s=this.s;
  for(let x=2;x>=0;x--){if(x===2){if(negative(s.motion)||s.y!==0x84)continue;}else{if(s.death||s.rescue||s.killed[0]||s.killed[1])continue;const mask=s.level<9?3:s.level<17?1:0;if(mask&s.still)continue;}
   if(x<2){let n=s.enemyPhase[x];if(negative(n)){n=byte(n+1);if(n>this.assets.oscillatorLimits[x])n=this.assets.oscillatorLimits[x]&127;}else{n=byte(n-1);if(negative(n))n=128;}s.enemyPhase[x]=n;}
   else{let n=s.minerOffset;if(negative(n)){n=byte(n+1);if(n>this.assets.oscillatorLimits[2])n=this.assets.oscillatorLimits[2]&127;}else{n=byte(n-1);if(negative(n))n=128;}s.minerOffset=n;}
  }
  let fly=s.rescue?0:s.flyFrame,walk=s.rescue?3:s.walkFrame;
  if(!s.rescue){if(s.clock&2)fly=fly?fly-1:2;if(!(s.clock&3))walk=walk?walk-1:4;}s.flyFrame=fly;s.walkFrame=walk;
  if(!s.death||s.death<0xe0){if(s.death)s.movingWallPhase|=128;let n=s.movingWallPhase;if(!negative(n))n=(n+1)&63;else if((n&0xf8)!==128)n=byte((n&0xf8)-1);s.movingWallPhase=n;}
 }
 laser(fire){const s=this.s;
  if(!s.gameOver&&!s.death&&!s.rescue&&fire){
   if(negative(s.beamWallHit)){if(s.wallX>=10&&s.wallX<153&&!(s.clock&1)){s.wallPhase=byte(s.wallPhase+1);if(!s.wallPhase)s.wallX=0;}s.beamWallHit=0;s.laserPhase=255;}
   s.laserPhase=byte(s.laserPhase+3);let offset=s.laserPhase&15;
   let x=s.facing?byte(s.x-4+(s.wallPhase>=128?4:0)-offset):byte(s.x+4+offset);
   // Original out-of-screen condition uses two unsigned comparisons.
   s.beamX=x;
  }else{s.laserPhase=255;s.beamX=0;}
 }
 rescueStep(){const s=this.s,a=this.assets;if(!negative(s.motion))s.motion=0;
  if(s.power){const mask=s.level<6?2:3;if(!(s.clock&mask)){const low=a.powerBonusLow[s.level];this.addScore((low===0x99?100:bcd(low))+100*bcd(a.powerBonusHigh[s.level]));s.power=byte(s.power-1);if(s.power)return;}else return;}
  if(s.fuses[1])return;
  if(s.bombs){s.bombs--;this.addScore(50);s.fuses[1]=16;return;}
  s.rescue=byte(s.rescue+1);
  if(!s.rescue&&this.difficulty===4){let n=this.random()&31;if(n>=20)n-=12;s.level=n;}
  else{s.level=byte(s.level+1);s.hudLevel=s.level;if(s.level>19){this.endless=true;s.level=12;}}
  this.prepareLevel(false);
 }
 deathStep(stick){const s=this.s,slot=s.deathSlot;let waiting=false;
  if(s.death>=0x96){if(s.death===0x96){s.y=5;s.enemyY[slot]=50;s.motion=128;s.lives--;if(!s.lives){this.phase='over';s.gameOver=255;s.beamX=0;return;}}
   else if(s.room>=10&&s.y>=0x83&&!(s.clock&7))s.y=byte(s.y+1);
  }
  if(s.death<0x96||s.death===0x96){const target=[0x73,0x49,0x19][slot];if(s.y!==target){s.y=byte(s.y+1);s.death=byte(s.death-1);}else waiting=true;}
  else s.death=byte(s.death-1);
  if((waiting||!s.death)&&(stick&15)!==15&&s.expired){s.death=0;s.lift=31;}
 }
 // 8A3B–8C01: exact character-level floor/side tests; walls do not use
 // approximated rectangles. Coordinates and asymmetric edge characters matter.
 terrainCollision(stick){const s=this.s,t=s.tiles,a=this.assets;
  let col=byte(s.x-48)>>2;col=Math.min(39,col+1);let odd=col&1;col>>=1;
  const floorAt=o=>odd?!!(t[o+2+col]&0x30):(t[o+2+col]>=0x93||(t[o+1+col]!==0&&t[o+1+col]!==0x95));
  let y=s.y;s.motion=128;s.groundMask=0;
  if(y>=0x47&&y<0x49&&floorAt(48))y=0x49;
  if(y>=0x71&&y<0x73&&floorAt(120)){y=0x73;if(a.roomFlags[this.index()]&2)s.lampHit=0;}
  if(y>=0x31&&y<0x35&&floorAt(120)){y=0x31;s.motion=0;if(a.roomFlags[this.index()]&2)s.lampHit=2;}
  else if(y>=0x5b&&y<0x5f&&floorAt(192)){y=0x5b;s.motion=0;}
  s.y=y;
  if((stick&12)===12)return;
  let column=(byte(s.x-48)>>2)+1;if(stick&8)column--;else column++;
  column=Math.min(39,column);odd=column&1;column>>=1;
  if(!s.motion)s.motion=64;
  let c=t[48+2+column];if(y>=0x32){if(!c)c|=t[120+2+column];if(y>=0x49){c=t[120+2+column];if(y>=0x5c){c=t[192+2+column];if(!c)c|=t[120+2+column];}if(y>=0x73)c=t[192+2+column];}}
  const pass=ch=>ch===0||(odd?[0xed,0xfd,0x95]:[0xe9,0xf9,0x91]).includes(ch);
  if(pass(c))return;
  s.x=(s.x&0xfc)+((stick&8)?4:0);
  if(pass(t[120+2+column]))return;
  if(y>=0x33&&y<0x70&&column&&a.roomFlags[this.index()]&2)s.lampHit=1;
 }
 interactions(stick){const s=this.s;
  if(!negative(s.lampHit))this.kill(s.lampHit);
  for(let i=2;i>=0;i--){if(!s.killed[i]&&negative(s.shotHit[i])){if(i===2)s.darkness=1;else{this.addScore(50);s.killed[i]=19;}}
   if(negative(s.contact[i])&&!s.killed[i]){if(i===2)s.darkness=1;else this.kill(i);}
  }
  if(!s.motion&&s.bombs){let i=s.y<0x44?2:1;if(s.bombX[i]===0x93&&!s.fuses[i]&&stick===13&&!(s.x&3)&&s.x>=13){s.bombX[i]=byte(s.x-48);s.fuses[i]=64;}}
  if(!s.death&&s.room===this.assets.lastRooms[s.level]){const left=byte(s.bombX[1]+48-7);if(byte(s.x-left)<15){this.addScore(1000);s.rescue=byte(s.rescue-1);}}
  if(negative(s.expired)&&!(s.clock&63)){s.power=byte(s.power-1);if(!s.power){this.prepareLevel(false);s.death=255;}}
 }
 explosions(){const s=this.s,a=this.assets;let slot=-1;for(let i=2;i>=0;i--)if(s.fuses[i]===34){slot=i;break;}if(slot<0)return;
  s.bombs=byte(s.bombs-1);
  if(s.enemyY[slot]!==0x50){let n=byte(s.enemyX[slot]-19),carry=s.enemyX[slot]>=19;if(n<s.bombX[slot]){n=byte(n+35);if(n>=s.bombX[slot]&&!s.killed[slot]&&slot!==2){s.killed[slot]=19;this.addScore(50);}}}
  if(s.wallX<153){let n=byte(s.wallX-18-(s.wallX>=153?0:1));if(n>=240)n=1;
   if(n<s.bombX[slot]){n=byte(n+4);if(n>=s.bombX[slot])s.wallPhase=128;else{n=byte(n+32);if(n>=s.bombX[slot]){n=byte(n-4);if(n<s.bombX[slot])s.wallPhase=128;else{s.wallX=0;s.extraExplosion=0x75;this.addScore(75);}}}}
  }
  if(s.y===(slot===2?0x31:0x5b)&&s.bombX[slot]<0x93){const edge=byte(s.bombX[slot]-8);if(byte(s.x-48-edge-(s.x>=48?0:1))<17){s.x=byte(s.x+(s.facing?1:-1));this.kill(slot);}}
 }
 step(input={}){if(this.phase!=='playing')return;
  const s=this.s;this.inStep=true;this.redrew=false;this.extraFrames=0;this.profile=null;this.entryKind=null;this.frameClock=s.clock;let stick=15;if(input.up)stick&=14;if(input.down)stick&=13;if(input.left)stick&=11;if(input.right)stick&=7;
  // The raster has already collected the collisions for these displayed sprites.
  if(!s.death&&!s.rescue&&!s.killed[0]&&!s.killed[1])s.still=byte(s.still+1);
  s.lampHit=128;stick=this.move(stick);this.roomData();this.actors();this.choosePose();if(this.profile)s.clock=byte(this.frameClock+this.profile[1]);this.timers();
  if(this.profile){s.clock=byte(this.frameClock+this.profile[2]);this.extraFrames=this.profile[3]-1;}
  else if(this.redrew){if(!s.death)s.clock=byte(s.clock+1);this.extraFrames=s.death?1:2;}
  this.laser(input.fire);
  if(s.rescue)this.rescueStep();else{
   if(s.death)this.deathStep(stick);else{this.terrainCollision(stick);this.interactions(stick);}
   this.explosions();if(!s.gameOver&&!negative(s.expired)&&s.death<0x77){s.power=byte(s.power+1);if(s.power>0x51){s.power=0x51;s.expired=byte(s.expired-1);}}
  }
  this.preparePose();if(!(s.clock&1))root.HeroTerrain.animate(s,this.assets);
  s.lastStick=stick;this.sound=root.HeroSound?.registers(s,!!input.fire,this.random);s.clock=this.profile?byte(this.frameClock+this.profile[3]):byte(s.clock+1);this.frames++;
  if(root.HeroRaster)root.HeroRaster.collide(this);this.inStep=false;
 }
 snapshot(){const s=this.s,out={score:this.score};for(const k of Object.keys(fields))out[k]=s[k];for(const k of Object.keys(arrays))out[k]=Array.from(s[k]);return out;}
}
root.Hero={Game,fields,arrays,byte};
})(globalThis);
