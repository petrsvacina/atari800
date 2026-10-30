/* Native underground/last-guard/hawk scene, original $B804-$BB69. */
(function(root){'use strict';
const {byte}=root.KaratekaMotion;
class Stage3 extends root.KaratekaStage1{
 constructor(seed=7){super(seed);this.initDungeon(seed);}
 initDungeon(seed){
  this.hero.x=10;this.enemy.x=65;this.camera=new root.KaratekaCamera(3);this.max=[10,18];this.health=[10,18];this.restore=[0,0];this.restoreDelay=[30,30];this.alive=[1,1];this.rules.random=byte(seed);this.rules.data={...root.KARATEKA_MOTION_DATA,aiThresholds:root.KARATEKA_CAMPAIGN.scenes[3].aiThresholds};
  this.hawk=new root.KaratekaHazards.Hawk();this.guardStyle=3;this.progress=2;this.climb=0;this.marker=0;this.mode='hawk-intro';this.palette=4;this.door=0;this.doorThreshold=1;this.extraDoor=0;this.flash=0;this.endingState=0;this.rules.deadContact=a=>this.doorContact(a);this.enemyProbabilities();
 }
 enemyProbabilities(){if(this.camera?.scene!==3)return super.enemyProbabilities();const d=root.KARATEKA_CAMPAIGN.scenes[3],i=this.guardStyle;Object.assign(this.rules,{kickChance:d.kick[i],punchChance:d.punch[i],waitChance:d.wait[i]});}
 continueMovie(){if(this.mode==='hawk-intro')this.mode='playing';}
 spawnGuard(){this.newEnemy();this.enemy.x=61;this.alive[1]=1;this.health[1]=this.max[1];this.marker=0;this.guardStyle=byte(this.guardStyle+1);this.enemyProbabilities();}
 cameraTick(){
  const c=this.camera,h=this.hero;Object.assign(c,{heroX:h.x,enemyX:this.enemy.x,hawkX:this.hawk.x});const translate=n=>{c.heroX=byte(c.heroX+n);c.enemyX=byte(c.enemyX+n);c.hawkX=byte(c.hawkX+n);};
  if(h.x>=128||h.x<3){c.room=byte(c.room-1);if(this.door||!c.room)this.door=0;translate(30);}
  else if(h.x>=33){
   if(c.room===4&&this.hawk.active)c.velocity=0;
   else{c.room=byte(c.room+1);if(c.room>=this.doorThreshold)this.door=5;const next=byte(c.room+2);if(next>this.guardStyle&&next!==8){this.spawnGuard();c.enemyX=this.enemy.x;}translate(-30);}
  }else if(c.room||(c.offset===224&&!c.shift&&h.x>=15)||(!c.offset&&!c.shift&&h.x<15)||h.x===15)c.velocity=0;
  else if(h.x<15)c.left();else c.right(h.running,h.legFrame);
  h.x=c.heroX;this.enemy.x=c.enemyX;this.hawk.x=c.hawkX;
 }
 advancePlayer(input){
  const h=this.hero,r=this.rules;this.context();let idle=false;
  if(!this.alive[1]){if(!this.deathDelay&&this.enemy.legs===19){if(h.torso===28||h.torso===29){h.torso=6;r.kick=r.punch=0;}}else{h.move=0;r.command(h,209);idle=true;}}
  if(!idle)this.poll(input);r.advance(h);if(h.legFrame===21){this.hold=30;this.holdRequested=1;}
 }
 leftWall(){const h=this.hero;if(h.running>=128)return;Object.assign(h,{legFrame:13,armFrame:13,legStep:1,armStep:1,legs:6,torso:6,x:9});this.emit('bump',13);}
 hazardContext(){return {hero:this.hero,heroAlive:this.alive[0],enemyAlive:this.alive[1],enemyHealth:this.health[1],enemyRestore:this.restore[1],hold:this.hold,holdRequested:this.holdRequested,enemyImpact:this.hit[1],heroImpact:this.results[0],flash:this.flash,redraw:0,recovery:this.enemyWait,shift:this.camera.shift,random:this.rules.random};}
 acceptHazards(g){this.alive[1]=g.enemyAlive;this.health[1]=g.enemyHealth;this.restore[1]=g.enemyRestore;this.hold=g.hold;this.holdRequested=g.holdRequested;this.hit[1]=g.enemyImpact;this.results[0]=g.heroImpact;this.flash=g.flash;this.enemyWait=g.recovery;}
 activateHawk(){this.kind=5;this.alive[1]=1;this.hawk.delay=1;this.health[1]=this.max[1];}
 doorContact(attack){
  if(this.camera.scene<3||this.hero.x<29||this.hero.x>=32||!this.door||attack===255||attack>=6)return 0;
  this.hit[1]=1;if(attack>=3)return 0;this.holdRequested=1;this.hold=30;this.door=0;this.doorThreshold=byte(this.doorThreshold+1);return 255;
 }
 tick(input={}){
  this.events=[];if(this.phase!=='playing'||this.mode==='hawk-intro')return;this.clock++;
  const h=this.hero,e=this.enemy,r=this.rules,c=this.camera,b=this.hawk;r.random=byte(5*r.random+13);
  if(!b.active&&!this.deathDelay&&this.buffer===64){this.emit('music',23);this.emit('wait',170);this.emit('scene',4);return;}
  if(h.legs===19&&b.delay&&(e.legs===19||e.legs===7||this.kind&&e.legs===6)){this.emit('music',22);this.phase='lost';return;}
  if(this.kind===5&&b.active&&b.delay){b.delay=byte(b.delay-1);if(!b.delay)b.spawn(this.hazardContext());}
  if(!this.marker&&e.legs===19&&h.legs===6){this.marker=1;if(this.alive[0]){this.restoreDelay[0]=2;if(this.guardStyle===6){this.max=[23,5];this.restoreDelay[1]=255;}else{this.max[0]=byte(this.max[0]-1);this.max[1]=byte(this.max[1]+1);if(this.health[0]>this.max[0])this.health[0]=this.max[0];}if(this.kind===1){this.kind=2;this.deathDelay=2;}else this.deathDelay=1;}}
  this.advancePlayer(input);
  if(c.room===1){if(!this.extraDoor){if(h.x>=7){this.extraDoor=5;e.x=byte(e.x-2);this.emit('gate',7);}}else if(h.x<6){this.leftWall();h.x=7;}}
  else if(!c.room&&h.x<8)this.leftWall();
  this.context();if(this.kind<5&&(this.buffer===32||e.legFrame>=14||!e.legStep)){r.ai(e);r.advance(e);}
  this.context();this.results=[0,0];if(this.alive[0]&&this.kind<5){let result=r.contact(e.legs,h.contact,r.distance,false);if(result===255){if(c.room===4)this.activateHawk();result=3;}if(this.kind<2){this.results[1]=result;this.context();if(this.buffer===32)this.results[0]=r.contact(h.legs,e.contact,r.distance,true);}}
  const gh=this.hazardContext();b.tick(gh);this.acceptHazards(gh);
  if(h.x>=31&&this.door){this.results[0]=136;this.emit('bump',13);}if(this.endingState===254)this.results[0]=255;
  this.recovery=e.x>=32&&(!c.room||this.door)?1:0;this.damage();this.heal();
  if((!c.room||this.door)&&!this.alive[1]&&e.legs!==19&&e.x>=30&&e.x<40)e.x=30;
  if(!this.alive[0]){b.turn=1;if(c.room===1&&h.x<9)h.x=9;else if(!c.room&&h.x<11)h.x=11;}
  this.cameraTick();b.animate({hero:h,distant:0});this.endFrame();
 }
}
root.KaratekaStage3=Stage3;
})(globalThis);
