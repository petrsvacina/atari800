/* Development integration of verified fighter routines. Campaign not yet wired. */
(function(root){'use strict';
const {fighter,byte,signed}=root.KaratekaMotion;
class Fight{
 constructor(options={}){this.rules=new root.KaratekaCombat.Combat(root.KARATEKA_MOTION_DATA);this.reset(options.kind||0);}
 reset(kind=0){
  const r=this.rules,d=r.data;
  this.hero=fighter([7,7,11,0,0,0,0,0,0,0,255,255,1,0,0,255]);
  this.enemy=fighter([7,7,31,0,0,0,0,0,0,0,255,255,255,0,0,255]);
  this.max=[14,14];this.health=[14,14];this.restore=[0,0];this.clock=0;this.lastInput={};this.rules.kick=0;this.rules.punch=0;this.phase='playing';this.kind=kind;this.playerResult=0;this.enemyResult=0;
  Object.assign(r,{hero:this.hero,random:7,kind:0,scene:1,room:0,phase:0,camera:27,playerSide:0,enemySide:0,heroAlive:1,enemyAlive:1,kickChance:d.guardKick[kind],punchChance:d.guardPunch[kind],waitChance:d.guardWait[kind]});
 }
 context(){const r=this.rules;r.heroX=this.hero.x;r.align=1;r.distance=byte(this.enemy.x-this.hero.x);r.heroAlive=!!this.health[0];r.enemyAlive=!!this.health[1];}
 impact(f,result,side){
  if(!result)return;const r=this.rules;this.restore[side]=0;
  if(result!==4&&this.health[side])this.health[side]--;
  if(!this.health[side]){r.command(f,198);f.running=0;return;}
  if(result===1)return;
  // $714A: rewind an interrupted move, or enter the original knockback sequence.
  const arms=()=>{f.armFrame=57;f.armStep=1;},back=index=>{f.legFrame=index;f.legStep=255;};
  if(f.legs===0){arms();back(88);}
  else if(f.legs===1){arms();back(89);}
  else if(f.legs===5||f.legs===9||f.legs===10){arms();back(93);}
  else if(f.legs===6||f.legs===31||f.legs===32)back(93);
  else if(f.legs<5||f.legs>=14&&f.legs<=22){f.legFrame=byte(f.legFrame-1);f.armFrame=byte(f.armFrame-1);f.repeat=10;}
  else if(f.legs===23||f.legs===24){f.legFrame=79;f.legStep=1;}
  else if(f.legs===25||f.legs===26){f.x=byte(f.x-f.facing);back(87);}
  else if(f.legs===27||f.legs===28)back(88);
  else if(f.legs===29||f.legs===30){f.x=byte(f.x-3*signed(f.facing));back(89);}
  else if(f.legs===33){f.x=byte(f.x-2*signed(f.facing));back(93);}
  else if(side===0){this.health[0]=0;r.command(f,198);f.running=0;}
 }
 tick(input={}){
  if(this.phase!=='playing')return;this.clock++;const r=this.rules,h=this.hero,e=this.enemy;this.context();
  h.move=input.move<0?255:input.move>0?1:0;h.height=input.height<0?255:input.height>0?1:0;
  r.sound=0;if(input.kick&&!this.lastInput.kick)r.kick=255;if(input.punch&&!this.lastInput.punch)r.punch=255;
  if(this.health[0])r.command(h,input.stance?155:input.bow?194:r.punch===255?215:r.kick===255?197:0);
  this.lastInput={kick:!!input.kick,punch:!!input.punch};
  r.advance(h);this.context();
  if(this.health[1])r.ai(e);r.advance(e);this.context();
  this.enemyResult=this.health[0]&&this.health[1]?r.contact(e.legs,h.contact,r.distance,false):0;
  this.playerResult=this.health[0]&&this.health[1]?r.contact(h.legs,e.contact,r.distance,true):0;
  this.impact(h,this.playerResult,0);this.impact(e,this.enemyResult,1);
  for(let i=0;i<2;i++)if(this.health[i]&&++this.restore[i]>=30){this.health[i]=Math.min(this.max[i],this.health[i]+1);this.restore[i]=0;}
  // The preview contains one arena. Campaign camera and scene boundaries are separate work.
  h.x=Math.max(3,Math.min(36,h.x));e.x=Math.max(3,Math.min(39,e.x));
  if(h.legs===19)this.phase='lost';else if(e.legs===19)this.phase='won';
 }
}
root.KaratekaFight=Fight;
})(globalThis);
