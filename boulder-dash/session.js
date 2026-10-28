/* Native game session: original cave order, player banks and bonus accounting. */
(function(root){'use strict';
const B=root.Boulder,D=root.BOULDER_ORIGINAL;
class Session{
 constructor(options={}){this.input=options.input||(()=>({}));this.audio=options.audio||(()=>{});this.onChange=options.onChange||(()=>{});this.time=0;this.frameCount=0;this.phase='title';this.music=new root.BoulderSound.Music();this.noise=new root.BoulderSound.Random();this.g=new B.Cave();this.raster=new root.BoulderRaster(this.g);this.paused=false;this.players=1;this.joysticks=1;this.scan=null;this.budget=0;this.timingMisses=new Set();}
 start(cave=1,level=0,players=1,joysticks=1){this.players=players;this.joysticks=joysticks;this.g=new B.Cave({cave,level,randomByte:()=>this.noise.read(this.frameCount*29868+Math.max(0,root.BoulderTiming.cpuPerFrame-this.budget)*29868/root.BoulderTiming.cpuPerFrame)});this.g.twoPlayers=players===2?1:0;this.g.twoControls=joysticks===2?1:0;this.g.load(cave,level);this.g.player=0;this.g.facing=0;this.g.stick=15;this.raster=new root.BoulderRaster(this.g);this.banks=Array.from({length:2},()=>({lives:3,cave,level,score:B.digits(0,6)}));this.paused=false;this.enter();}
 enter(){const g=this.g;g.load(g.cave,g.level);g.spawnSeconds=this.players===2&&this.joysticks===1&&!this.previousWon?6:4;
  g.walkSound=64;g.walkPitch=75;g.soundRegisters.fill(0);g.soundRegisters[2]=75;g.onSound=values=>this.audio(values,this.time);
  this.raster.reset();this.phase='reveal';this.reveal=new Uint8Array(880);this.revealDone=0;this.redrawAt=0;this.scan=null;this.budget=0;this.onChange(this);
 }
 advance(){const g=this.g;g.cave=D.nextCave[g.cave-1];if(g.cave===21){g.cave=1;g.level=Math.min(4,g.level+1);}if(D.intermissions[g.cave-1])g.bonusLife();}
 save(){const g=this.g;this.banks[g.player]={lives:g.lives,cave:g.cave,level:g.level,score:[...g.score]};}
 fail(){const g=this.g;g.freeze=1;this.previousWon=false;
  if(D.intermissions[g.cave-1])this.advance();
  else{g.lives--;this.save();if(this.players===2&&this.banks[g.player^1].lives>0)g.player^=1;Object.assign(g,JSON.parse(JSON.stringify(this.banks[g.player])));}
  if(!g.lives){g.gameOver=1;this.phase='over';this.onChange(this);return;}
  this.phase='ready';this.readyFrames=0;this.onChange(this);
 }
 finish(){const g=this.g;g.freeze=1;this.scan=null;
  if(g.won){this.phase='bonus';this.bonusCount=0;this.previousWon=true;}
  else this.fail();this.onChange(this);
 }
 skip(){if((this.phase==='play')&&!this.g.spawnSeconds){this.g.status=2;this.g.won=0;}}
 cellCycles(work){
  if(root.BoulderTiming)return root.BoulderTiming.cell(work,this.timingMisses)+(work.code===56&&this.g.twoControls&&this.g.player?(work.plots.length?4:2):0);
  throw Error('Chybí časovací data původních rutin.');
 }
 frame(){
  if(this.paused)return;this.time=++this.frameCount/B.HZ;
  const g=this.g,r=this.raster;
  if(this.phase==='title'){r.titleFrame();this.audio(this.music.frame(),this.time);return;}
  r.frame();if(this.phase==='reveal')r.coverFrame();g.frame();r.endFrame();
  if(this.phase==='reveal'){
   this.budget+=root.BoulderTiming.cpuPerFrame;
   while(this.budget>0){
    if(this.revealDone<2640){const y=this.revealDone%22;let x,rejected=0;do{x=g.randomByte();if(x>=40)rejected++;}while(x>=40);this.reveal[y*40+x]=1;
     this.budget-=323+19*rejected+(((0x4c50+y*40+x-41)&255)+41>255?1:0)+(y*2+235>255?1:0)+(y*2+236>255?1:0);this.revealDone++;
    }else{const index=this.redrawAt++,y=Math.floor(index/40);this.reveal[index]=1;this.budget-=285+(y*2+235>255?1:0)+(y*2+236>255?1:0)+(((0x4c50+index-41)&255)+41>255?1:0);
     if(this.redrawAt===880){this.reveal=null;g.walkSound=64;g.soundRegisters.fill(0);g.sound(2,75);this.phase='play';this.onChange(this);break;}
    }
   }return;
  }
  if(this.phase==='ready'){if(++this.readyFrames>15&&this.input(g.player).fire)this.enter();return;}
  if(this.phase==='over')return;
  if(this.phase==='bonus'){
   // $2746 pitch sweep has 15 x 256 decrement loops for each time unit.
   this.budget+=root.BoulderTiming.cpuPerFrame;
   const quantum=15*(256*5+30)+600;
   while(this.budget>=quantum){this.budget-=quantum;g.time=B.digits((B.number(g.time)+999)%1000,3);g.addScore(g.level+1);g.sound(6,(15+this.bonusCount)&255);g.sound(7,170);this.bonusCount=(this.bonusCount+1)&255;
    if(!B.number(g.time)){g.sound(7,0);this.advance();this.save();this.phase='ready';this.readyFrames=0;this.onChange(this);break;}
   }return;
  }
  this.budget+=root.BoulderTiming.cpuPerFrame;
  while(this.budget>0&&this.phase==='play'){
   if(!this.scan){this.scan=g.scanCave(()=>this.input(g.player));this.budget-=root.BoulderTiming.scanStart(g,this.input(g.player));}
   const next=this.scan.next();if(next.done){this.scan=null;this.budget-=root.BoulderTiming.scanEnd(g);if(g.status)this.finish();}
   else{const w=next.value;this.budget-=this.cellCycles(w);if(w.column===39)this.budget-=root.BoulderTiming.row(g,w);}
  }
 }
}
root.BoulderSession=Session;
})(globalThis);
