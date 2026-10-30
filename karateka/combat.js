/* Native guard decisions ($6B00) and contact classification ($7366).
 * Decisions use the supplied disk's range, stance and probability tables. */
(function(root){'use strict';
const {byte,Motion}=root.KaratekaMotion;
class Combat extends Motion{
 constructor(data){super(data);this.random=0;this.scene=1;this.room=0;this.kind=0;this.heroAlive=1;this.enemyAlive=1;this.phase=0;this.camera=48;this.playerSide=0;this.enemySide=0;this.hero=null;}
 roll(){return this.random=byte(17*this.random+161);}
 height(f){const a=this.roll();f.height=this.kind===1?(a<128?0:255):a<85?255:a<170?0:1;}
 ai(f){
  const h=this.hero,d=this.data;let x,a;const command=c=>this.command(f,c),idle=()=>{f.height=f.move=0;command(0);};
  if(h.legs===19){if(this.kind)return idle();f.move=0;return command(f.running?19:155);}
  if(f.running){
   if(this.phase){a=byte(f.x-(h.x>=18?6:0));if(a>=45||this.enemySide!==this.playerSide&&(this.camera>=128||this.camera<49)){if(this.scene>=3)return;f.move=1;return command(0);}f.move=0;return command(155);
   }
   if(f.x>=40)return;
   if(this.distance<13||!h.running)return command(155);
   if(h.legFrame===26)return command(194);return;
  }
  if(!this.heroAlive)return idle();
  const advance=()=>{f.move=f.height=1;
   if(!this.room&&f.x<=[13,13,17,19,19][this.scene])f.move=0;
   if(this.room===1&&this.scene===4&&f.x<=17)f.move=0;
   command(0);
  };
  const pause=()=>{if(f.legFrame===3){f.move=this.roll()<d.aiThresholds[17+x]?1:0; // $BFF2,X
    if(!this.room&&f.x<=[13,13,17,19,19][this.scene])f.move=0;
    if(this.room===1&&this.scene===4&&f.x<=17)f.move=0;
    command(0);
   }else idle();};
  const kick=()=>{if(this.roll()>=this.kickChance)return pause();this.height(f);command(197);};
  if(h.running){if(this.distance>=8)return advance();return kick();}
  x=Math.max(7,this.distance);if(this.distance>=12)return advance();
  if(this.kind&&f.x>=32&&f.x<39){a=this.roll();if(a>=d.aiThresholds[x])return pause();if(a>=d.aiThresholds[10+x]){f.height=0;return command(197);}}
  else{a=this.roll();if(a>=d.aiThresholds[x])return pause();if(a>=d.aiThresholds[5+x])return kick();if(a>=d.aiThresholds[10+x]){
    if(this.roll()>=this.punchChance)return pause();this.height(f);x=this.kind;if(f.armFrame===13&&this.kind)f.height=0;
    if(f.legs===22||f.legs===6&&f.torso===6){f.move=0;return command(215);}return pause();
   }}
  if(this.roll()>=this.waitChance)return pause();if(f.legs===6)return advance();return pause();
 }
 contact(pose,attack,distance,defenderIsHero){
  const d=this.data,index=d.stance[pose],kind=d.contactClass[index];let reach=d.reach[index];
  if(!this.enemyAlive)return this.deadContact?this.deadContact(attack):0;
  if(attack!==255&&attack>=6){const off=d.specialOffset[Math.max(23,this.hero.legs)-23];return byte(d.specialReach[kind]+off)===distance?1:0;}
  if(reach!==distance){
   if(reach>distance){if(defenderIsHero)return 4;if(distance<5){reach=this.hero.legs;if(this.hero.legs!==7){this.hero.x=byte(this.hero.x-2);if(this.hero.running)return 4;reach=0;}}}
   if(attack===255)return 0;
   reach=byte(reach+2);if(reach<distance)return 0;
   if(reach===distance)return (attack===0||attack===2?d.highContact:attack===1?d.middleContact:d.edgeContact)[kind];
  }
  if(attack===255)return 0;
  if(attack<3)return 3;
  return (attack<5?d.closeContact:d.lowContact)[kind];
 }
}
root.KaratekaCombat={Combat};
})(globalThis);
