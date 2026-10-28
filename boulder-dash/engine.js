/* Native Boulder Dash state routines from the supplied Atari ATR.
 * Cell codes and update order retain the original scanline semantics.
 * This is ordinary JavaScript: no CPU, instruction set, or original program. */
(function(root){'use strict';
const D=root.BOULDER_ORIGINAL,byte=v=>v&255;
const C={SPACE:0,DIRT:1,WALL:2,MAGIC:3,EXIT:4,OPEN_EXIT:5,STEEL:7,
 FIREFLY:8,BOULDER:16,FALLING_BOULDER:18,DIAMOND:20,FALLING_DIAMOND:22,
 EXPLOSION:27,DIAMOND_EXPLOSION:32,INBOX:37,BUTTERFLY:48,ROCKFORD:56,AMOEBA:58};
const fields={rng0:0x781,rng1:0x782,stick:0x788,amoebaGrowing:0x789,magicState:0x78a,
 magicFrames:0x78b,magicSeconds:0x78c,enough:0x78d,amoebaOpen:0x78e,amoebaWasOpen:0x78f,
 preSpawn:0x792,spawnSeconds:0x793,missing:0x794,status:0x795,tone:0x796,volume:0x797,pitch:0x798,
 walkSound:0x799,explosionTone:0x79a,explosionVolume:0x79b,explosionPitch:0x79c,
 facing:0x79d,playerX:0x79e,playerY:0x79f,amoebaMask:0x7a1,amoebaCount:0x7a2,amoebaPrevious:0x7a3,
 freeze:0x7a4,scanDelay:0x7a5,player:0x7a6,twoPlayers:0x7a7,won:0x7a8,gameOver:0x7a9,
 cave:0x7b7,level:0x7b8,lives:0x7b6,secondsFrame:0x839,elapsed:0x83a,
 moving:0x842,trigger:0x843,boxFlash:0x844,flash:0x7ae,bonusFlash:0x833};
const arrays={score:[0x7b9,6],time:[0x836,3],diamonds:[0x83b,2],needed:[0x83d,2],value:[0x7b3,3],extraValue:[0x83f,3]};
function digits(value,count){return String(value%10**count).padStart(count,'0').split('').map(Number);}
function number(ds){return ds.reduce((n,d)=>n*10+d,0);}
class Cave{
 constructor(options={}){
  for(const key of Object.keys(fields))this[key]=0;
  this.data=options.data||D;this.randomByte=options.randomByte||(()=>Math.floor(Math.random()*256));
  this.soundRegisters=Array(9).fill(0);this.events=[];this.cells=new Uint8Array(880);this.appearance=new Uint8Array(880);this.score=digits(0,6);this.lives=3;this.player=0;this.twoPlayers=0;
  this.facing=0;this.walkSound=0;this.tone=0;this.volume=0;this.pitch=0;this.explosionTone=0;this.explosionVolume=0;this.explosionPitch=0;
  this.elapsed=0;this.clock=0;this.secondsFrame=0;this.boxFlash=0;this.bonusFlash=0;this.flash=0;this.stick=0;this.trigger=0;
  this.load(options.cave??1,options.level??0);
 }
 sound(index,value){this.soundRegisters[index]=byte(value);this.onSound?.(this.soundRegisters);}
 emit(type,details={}){this.events.push({type,...details});}
 drainEvents(){const e=this.events;this.events=[];return e;}
 randomCave(){
  // $0C01: two byte generator, including carry between each addition.
  const r0=this.rng0,r1=this.rng1;let a=r0+(r0&1)*128;
  a=(a&255)+19+(a>255?1:0);this.rng0=a&255;
  let b=r1+(r1&1)*128+(a>255?1:0);
  b=(b&255)+(r0>>1)+(b>255?1:0);this.rng1=b&255;return this.rng1;
 }
 load(cave,level){
  this.cave=cave;this.level=level;this.record=this.data.caves[cave-1];if(!this.record)throw Error('Neznámá původní jeskyně.');
  const p=this.record;this.rng0=p[4+level];this.rng1=0;this.cells.fill(0);
  // $1C02 fills rows 1..21 before the source border/commands overwrite them.
  for(let y=1;y<22;y++)for(let x=0;x<40;x++){
   const random=this.randomCave();let cell=1;for(let i=0;i<4;i++)if(random<p[28+i])cell=p[24+i];this.cells[y*40+x]=cell;
  }
  this.rectangle(7,0,0,40,22);
  const offset=[-40,-39,1,41,40,39,-1,-41];
  for(let cursor=32;p[cursor]!==255;){
   const command=p[cursor],object=command&63,x=p[cursor+1],y=p[cursor+2]-2,w=p[cursor+3],h=p[cursor+4];
   if(object===37){this.playerX=x;this.playerY=y+2;}
   if(command<64){this.cells[y*40+x]=object;cursor+=3;}
   else if(command<128){let at=y*40+x;for(let i=0;i<w;i++,at+=offset[h])this.cells[at]=object;cursor+=5;}
   else if(command<192){this.fill(object,x,y,w,h);this.fill(p[cursor+5],x+1,y+1,w-2,h-2);cursor+=6;}
   else{this.rectangle(object,x,y,w,h);cursor+=5;}
  }
  Object.assign(this,{amoebaOpen:0,amoebaWasOpen:0,missing:0,status:0,magicState:0,magicFrames:0,magicSeconds:0,enough:0,
   amoebaCount:0,amoebaPrevious:0,elapsed:0,secondsFrame:0,won:0,freeze:0,scanDelay:this.data.scanDelay[level],
   time:digits(p[14+level],3),needed:digits(p[9+level],2),value:digits(p[2],3),extraValue:digits(p[3],3),diamonds:digits(0,2),
   amoebaGrowing:1,preSpawn:1,spawnSeconds:this.twoPlayers?6:4,amoebaMask:127});
  for(let i=0;i<880;i++)this.appearance[i]=this.data.tileCharacters[this.cells[i]];
  this.colors=p.slice(19,24);this.emit('load',{cave,level});
 }
 fill(code,x,y,w,h){for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)this.cells[(y+yy)*40+x+xx]=code;}
 rectangle(code,x,y,w,h){for(let xx=0;xx<w;xx++){this.cells[y*40+x+xx]=code;this.cells[(y+h-1)*40+x+xx]=code;}
  for(let yy=1;yy<h-1;yy++){this.cells[(y+yy)*40+x]=code;this.cells[(y+yy)*40+x+w-1]=code;}}
 set(index,code){this.cells[index]=code;this.appearance[index]=this.data.tileCharacters[code];if(this.scanWork)this.scanWork.plots.push(index-this.scan+41);}
 soundRock(diamond=false,carry=0){this.pitch=diamond?(this.randomByte()&15)+10+carry:10;this.volume=10;this.tone=diamond?10:0;this.emit('stone',{diamond});}
 explode(index,diamonds=false){
  const stage=diamonds?33:28;
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
   const at=index+y*40+x;if(this.cells[at]!==7)this.set(at,stage-(at>this.scan?1:0));
  }
  this.explosionTone=0;this.explosionVolume=14;this.explosionPitch=70;this.emit('explosion',{diamonds,index});
 }
 mark(value){this.scanWork?.path.push(value);}
 rounded(v){return v===16||v===20||v===2;}
 enemy(v){return v>=8&&v<=11||v>=48&&v<=51;}
 fly(index,butterfly){
  const neighbors=[index-40,index-1,index+1,index+40];
  this.mark(neighbors.filter(at=>[56,57,58].includes(this.cells[at])).length);
  if(neighbors.some(at=>[56,57,58].includes(this.cells[at]))){this.explode(index,butterfly);return;}
  const direction=this.cells[index]&3,forward=[-1,-40,1,40],side=[40,-1,-40,1];
  let dest,dir;
  if(butterfly){
   if(!this.cells[index+forward[direction]]){this.mark(0);dest=index+forward[direction];dir=(direction+1)&3;}
   else if(!this.cells[index+side[direction]]){this.mark(1);dest=index+side[direction];dir=direction;}
   else{this.mark(2);this.cells[index]=52+((direction+3)&3);return;}
  }else{
   if(!this.cells[index+side[direction]]){this.mark(0);dest=index+side[direction];dir=(direction+3)&3;}
   else if(!this.cells[index+forward[direction]]){this.mark(1);dest=index+forward[direction];dir=direction;}
   else{this.mark(2);this.cells[index]=12+((direction+1)&3);return;}
  }
  this.set(dest,(butterfly?52:12)+dir);this.set(index,0);
 }
 stone(index,diamond,falling){
  const below=index+40,v=this.cells[below],scanned=diamond?23:19;
  const rounded=this.rounded(v),b1=(v&51)===v,b2=(v|48)===v,f1=(v&11)===v,f2=!!(v&8);
  this.mark(v===0?0:falling&&v===3?3:rounded?16:!falling?1:v===56?56:'b'+(b1?b2?2:1:0)+'f'+(b1&&b2?0:f1?f2?2:1:0));
  this.mark(falling&&v===3?this.magicState:0);this.mark(falling&&v===3&&!this.cells[index+80]?1:0);
  const left=!this.cells[index+39]?(!this.cells[index-1]?2:1):0,right=!this.cells[index+41]?(!this.cells[index+1]?2:1):0;
  this.mark(rounded?left*3+(left===2?0:right):0);
  const drop=()=>{this.set(below,scanned);this.set(index,0);};
  if(!v){drop();if(!falling)this.soundRock(diamond);return;}
  if(falling&&v===3){
   if(!this.magicState)this.magicState=1;
   if(this.magicState===1&&!this.cells[index+80])this.set(index+80,diamond?19:23);
   this.set(index,0);this.soundRock(!diamond);return;
  }
  if(falling)this.soundRock(diamond,v>=3?1:0);
  if(this.rounded(v)){
   if(!this.cells[index-1]&&!this.cells[index+39]){this.set(index-1,scanned);this.set(index,0);}
   else if(!this.cells[index+1]&&!this.cells[index+41]){this.set(index+1,scanned);this.set(index,0);}
   else if(falling)this.set(index,diamond?21:17);
  }else if(falling){
   if(v===56||this.enemy(v))this.explode(below,v>=48&&v<=51);
   else this.set(index,diamond?21:17);
  }
 }
 amoeba(index){
  this.mark(this.amoebaPrevious>=200?1:0);this.mark(this.amoebaPrevious>=200?0:this.amoebaGrowing);this.mark(this.amoebaPrevious>=200||!this.amoebaGrowing?0:this.amoebaOpen);
  this.mark(this.amoebaPrevious>=200||!this.amoebaGrowing||this.amoebaOpen?0:[-40,-1,1,40].filter(d=>this.cells[index+d]===0||this.cells[index+d]===1).length);
  this.amoebaCount=byte(this.amoebaCount+1);
  if(this.amoebaPrevious>=200){this.set(index,17);return;}
  if(!this.amoebaGrowing){this.set(index,20);return;}
  const offsets=[-40,-1,1,40];
  if(!this.amoebaOpen&&offsets.some(d=>this.cells[index+d]===0||this.cells[index+d]===1))this.amoebaOpen=1;
  const chance=this.randomByte()&this.amoebaMask;this.mark(chance<4?chance:4);
  if(chance<4){const at=index+offsets[chance],target=this.cells[at];this.mark(target<2?target:2);if(target===0||target===1){if(target===1)this.walkSound=65;this.set(at,59);this.emit('amoeba');}}
 }
 bonusLife(){this.mark(this.lives===9?1:0);if(this.lives<9){this.lives++;this.bonusFlash=128;this.emit('life');}}
 addScore(value){
  const oldThousands=this.score[2],oldHundreds=this.score[3];
  let carry=0,carries=0,add=digits(value,6);for(let i=5;i>=0;i--){carry=this.score[i]+add[i]+carry>=10?1:0;carries+=carry;}this.mark(carries);
  this.score=digits(number(this.score)+value,6);this.mark(this.score[2]!==oldThousands?1:0);this.mark(oldHundreds===4?this.score[3]===4?1:2:0);
  // $103C awards a life when leaving the 400s and when thousands change.
  if(this.score[2]!==oldThousands)this.bonusLife();if(oldHundreds===4&&this.score[3]!==4)this.bonusLife();
 }
 collect(){
  this.pitch=100;this.volume=10;this.tone=10;this.addScore(number(this.value));this.diamonds=digits(number(this.diamonds)+1,2);
  this.mark(this.diamonds[1]===0?this.diamonds[0]===0?2:1:0);this.mark(this.diamonds[0]===this.needed[0]?this.diamonds[1]===this.needed[1]?2:1:0);
  if(number(this.diamonds)===number(this.needed)){this.enough=1;this.value=[...this.extraValue];this.flash=6;this.tone=8;this.volume=15;this.pitch=10;this.emit('exit-open');}
  this.emit('diamond');
 }
 playerMove(index,offset){
  const at=index+offset,v=this.cells[at];let allowed=false;this.moving=0;this.mark([0,1,5,16,20].includes(v)?v:2);this.mark(this.trigger);this.mark(v===16&&Math.abs(offset)===1&&!this.cells[index+offset*2]?1:0);
  if(v===0){allowed=true;this.walkSound=65;this.walkPitch=204;this.sound(2,204);}
  if(v===1){allowed=true;this.walkSound=65;this.walkPitch=75;this.sound(2,75);this.emit('dig');}
  if(v===20){allowed=true;this.collect();}
  if(v===5){allowed=true;this.status=2;this.won=1;}
  if(v===16&&Math.abs(offset)===1&&!this.cells[index+offset*2]&&!(this.randomByte()&3)){
   allowed=true;this.soundRock(false);this.set(index+offset*2,17);
  }
  if(allowed){
   if(this.trigger===0)this.set(at,0);
   else{this.set(at,57);this.set(index,0);this.moving=1;this.playerX+=offset===1?1:offset===-1?-1:0;this.playerY+=offset===40?1:offset===-40?-1:0;}
  }
 }
 rockford(index){
  this.stick=this.inputStick;
  const stick=this.stick;this.mark(stick);
  if(stick===11)this.playerMove(index,-1);
  if(stick===13)this.playerMove(index,40);
  if(stick===7)this.playerMove(index,1);
  if(stick===14)this.playerMove(index,-40);
  if(stick===6||stick===5)this.playerMove(index,1);
  if(stick===9||stick===10)this.playerMove(index,-1);
  if([7,6,5].includes(stick))this.facing=0;if([11,9,10].includes(stick))this.facing=1;
  this.missing=0;
 }
 *scanCave(input={}){
  const provider=input,readInput=()=>typeof provider==='function'?provider():provider;input=readInput();
  this.inputStick=input.stick??(15&(input.x>0?7:input.x<0?11:15)&(input.y>0?13:input.y<0?14:15));this.trigger=input.fire?0:1;
  if(this.missing!==16)this.missing=byte(this.missing+1);
  if(this.missing===16&&this.trigger===0&&this.elapsed)this.status=2;
  if(!this.amoebaOpen&&this.amoebaWasOpen){this.amoebaGrowing=0;this.sound(5,0);}
  this.amoebaWasOpen=this.amoebaOpen;this.amoebaOpen=0;this.amoebaPrevious=this.amoebaCount;this.amoebaCount=0;
  for(let y=1;y<22;y++){
   for(let x=0;x<40;x++){
    const index=y*40+x;this.scan=index;const v=this.cells[index];
    this.scanWork={code:v,plots:[],path:[],row:y,column:x};
    if(v===4){this.mark(this.enough);if(this.enough)this.set(index,5);}
    else if(v===5||v===37){this.boxFlash=byte(this.boxFlash+1);this.mark(this.boxFlash&1);this.mark(this.spawnSeconds?1:0);if(!(this.boxFlash&1)){this.set(index,v);if(v===37&&!this.spawnSeconds)this.set(index,38);}
     else{this.appearance[index]=46;this.scanWork.plots.push(41);}}
    else if(v>=38&&v<=40){this.mark(this.spawnSeconds?1:0);if(!this.spawnSeconds)this.set(index,v===40?56:v+1);}
    else if(v>=8&&v<=11)this.fly(index,false);
    else if(v>=48&&v<=51)this.fly(index,true);
    else if(v===16||v===18||v===20||v===22)this.stone(index,v>=20,!!(v&2));
    else if(v===58)this.amoeba(index);
    else if(v===56){const live=readInput();this.inputStick=live.stick??(15&(live.x>0?7:live.x<0?11:15)&(live.y>0?13:live.y<0?14:15));this.trigger=live.fire?0:1;this.rockford(index);}
    else if(v>=27&&v<=36)this.set(index,v===31?0:v===36?20:v+1);
    const nw=index-41;this.scanWork.normalized=!!this.data.normalize[this.cells[nw]];if(nw>=0&&this.data.normalize[this.cells[nw]])this.cells[nw]=this.data.normalize[this.cells[nw]];
    this.scanWork.key=[v,...this.scanWork.path,this.scanWork.plots.length].join('/');
    yield this.scanWork;
   }
   if(this.walkSound!==64){this.walkSound=byte((this.walkSound+1)&79);this.sound(3,this.walkSound);}
   if(this.amoebaWasOpen){this.amoebaNoisePitch=this.randomByte();this.sound(4,this.amoebaNoisePitch);this.sound(5,166);} // $0FAD row sound also reads RANDOM.
   this.rowAudio?.();
  }
  this.scanWork=null;
 }
 step(input={}){for(const cell of this.scanCave(input)){}this.scanWork=null;}
 second(){
  this.elapsed=byte(this.elapsed+1);
  if(this.elapsed===this.record[1])this.amoebaMask=15;
  this.time=digits((number(this.time)+999)%1000,3);
  if(!number(this.time))this.status=2;
  else if(!this.time[0]&&!this.time[1]){this.pitch=50+this.time[2];this.tone=10;this.volume=10;}
 }
 frame(){
  if((this.freeze^1)&this.magicState){this.magicFrames=byte(this.magicFrames+1);if(this.magicFrames===60){this.magicFrames=0;this.magicSeconds=byte(this.magicSeconds+1);if(this.magicSeconds===this.record[1])this.magicState=2;}}
  this.secondsFrame=byte(this.secondsFrame+1);
  if(this.secondsFrame===60){this.secondsFrame=0;if(!this.freeze){if(this.preSpawn){this.spawnSeconds=byte(this.spawnSeconds-1);if(!this.spawnSeconds){this.preSpawn=0;this.tone=8;this.volume=15;this.pitch=10;this.emit('spawn');}}else this.second();}}
  this.clock=byte(this.clock+1);
  if(!(this.clock&7)){
   this.sound(0,this.pitch);this.sound(1,this.tone*16+this.volume);this.volume>>=1;
   this.sound(6,this.explosionPitch);this.sound(7,this.explosionTone*16+this.explosionVolume);if(this.explosionVolume)this.explosionVolume--;
  }
 }
}
root.Boulder={Cave,C,fields,arrays,number,digits,HZ:1789790/(114*262)};
})(globalThis);
