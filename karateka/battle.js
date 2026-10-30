/* Common battle integration: original $70AC, $70F0, $710D, $714A, $7207,
 * $0BDD-$0C3C. Byte state is retained; CPU execution is development-only. */
(function(root){'use strict';
const {fighter,byte}=root.KaratekaMotion;
class Battle{
 constructor(data=root.KARATEKA_MOTION_DATA){this.rules=new root.KaratekaCombat.Combat(data);this.hero=fighter();this.enemy=fighter();this.health=[0,0];this.max=[0,0];this.restore=[0,0];this.restoreDelay=[30,30];this.alive=[1,1];this.hit=[0,0];this.results=[0,0];this.hold=0;this.holdRequested=0;this.recovery=0;this.playerSide=0;this.enemySide=0;this.camera=new root.KaratekaCamera(1);this.kind=0;}
 context(){const r=this.rules;r.hero=this.hero;r.heroX=this.hero.x;r.align=this.camera.shift;r.camera=this.camera.offset;r.room=this.camera.room;r.scene=this.camera.scene;r.kind=this.kind;r.playerSide=this.playerSide;r.enemySide=this.enemySide;r.heroAlive=this.alive[0];r.enemyAlive=this.alive[1];r.distance=this.enemySide!==this.playerSide&&(this.camera.offset>=128||this.camera.offset<49)?255:byte(this.enemy.x-this.hero.x);}
 side(f,which){const x=byte(48-this.camera.offset+f.x);if(x<5||x>=251)this[which?'enemySide':'playerSide']=x<128?1:0;}
 removeHealth(which){if(this.health[which]){this.restore[which]=0;this.health[which]--;if(!this.health[which])this.alive[which]=0;}}
 heal(){for(let i=0;i<2;i++){this.restore[i]=byte(this.restore[i]+1);if(this.restore[i]>=this.restoreDelay[i]){if(this.alive[i]){if(this.health[i]!==this.max[i])this.health[i]=byte(this.health[i]+1);else if(!i)this.restoreDelay[0]=30;}this.restore[i]=0;}}}
 death(f){this.rules.command(f,198);}
 instantDeath(f,which,result,force=false){if(!force&&f.x!==this.hero.x)return;this.health[0]=this.alive[0]=0;if(result===4){this.hit[0]=1;this.results[0]=byte(this.results[0]-1);if(!which)this.enemy.height=0;}this.death(f);}
 recoil(f,which,result){
  const pose=f.legs,back=index=>{f.legFrame=index;f.legStep=255;},arms=()=>{f.armFrame=57;f.armStep=1;},moveBack=n=>{f.x=byte(f.x-n*f.facing);};
  if(pose===0){arms();back(88);}else if(pose===1){arms();back(89);}
  else if(pose===5||pose===9||pose===10){arms();f.running=0;back(93);}
  else if(pose===6||pose===31||pose===32)back(93);
  else if(pose<5||pose>=14&&pose<=22){f.legFrame=byte(f.legFrame-1);f.armFrame=byte(f.armFrame-1);f.repeat=10;}
  else if(pose===23||pose===24){f.legFrame=79;f.legStep=1;}
  else if(pose===25||pose===26){if(pose===26)moveBack(1);back(87);}
  else if(pose===27||pose===28)back(88);
  else if(pose===29||pose===30){moveBack(pose===30?2:1);back(89);}
  else if(pose===33){f.legFrame=79;f.legStep=1;moveBack(2);}
  else this.instantDeath(f,which,result);
 }
 applyResult(f,which,result){if(result===1)return;if(result===255)return this.instantDeath(f,which,result,true);this.recoil(f,which,result);}
 damage(){
  this.context();const r=this.rules;
  if(this.results[0]<128&&this.enemy.legs===19&&this.kind!==5)return;
  for(let which=0;which<2;which++){
   this.context();
   const result=this.results[which];if(!result)continue;const f=which?this.enemy:this.hero,oldX=f.x;this.hit[which]=0;
   if(result!==4){this.removeHealth(which);this.hit[which]=1;if(!this.alive[which]){
    if(which||this.kind===1){this.hold=which?30:40;this.holdRequested=1;}
    this.death(f);if(!which&&this.kind!==1&&result===136)f.x=29;
    r.advance(f);this.side({x:oldX},which);continue;
   }}
   if(!which&&result===136&&f.running){f.x=30;f.legStep=f.armStep=1;f.legFrame=76;f.armFrame=52;}
   else{if(which&&this.recovery)continue;this.applyResult(f,which,result);}
   r.advance(f);this.side({x:oldX},which);
  }
 }
}
root.KaratekaBattle=Battle;
})(globalThis);
