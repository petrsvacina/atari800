/* Native horizontal pan arithmetic from the three original campaign scenes.
 * Byte coordinates, acceleration, fractional phase and original edge behaviour
 * are retained; the outer scene/progression decisions are separate. */
(function(root){'use strict';
const byte=v=>v&255,negative=v=>!!(v&128);
class Camera{
 constructor(scene=1){this.scene=scene;this.shift=scene===1?1:0;this.cloud=scene===1?254:17;this.offset=scene===1?48:0;this.velocity=0;this.room=0;this.heroX=11;this.enemyX=48;this.hawkX=80;}
 right(running,legFrame){
  const desired=running?(legFrame>=66&&legFrame<74?244:250):252;
  if(desired!==this.velocity){
   if(desired<this.velocity)this.velocity=byte(desired-2);
   else if(!negative(this.velocity))this.velocity=byte(this.velocity-2);
   else{this.velocity=byte(this.velocity+2);if(!this.velocity)return;}
  }
  this.pan();
 }
 left(){
  const desired=this.scene===1?6:4;
  if(this.velocity!==desired){
   if(this.velocity<desired||negative(this.velocity))this.velocity=byte(this.velocity+2);
   else{this.velocity=byte(this.velocity-2);if(!this.velocity)return;}
  }
  this.pan();
 }
 pan(){
  if(negative(this.velocity)){
   const limit=this.scene===1?248:249;
   if(this.velocity<limit){this.negativeStep(byte(this.velocity+(this.scene===1?8:7)));this.negativeStep(limit);}
   else this.negativeStep(this.velocity);
  }else this.positiveStep(this.velocity);
 }
 negativeStep(amount){
  let phase=byte(amount+this.shift);
  if(!negative(phase)){this.shift=phase;return;}
  this.shift=byte(phase+8);this.heroX=byte(this.heroX-1);this.enemyX=byte(this.enemyX-1);this.hawkX=byte(this.hawkX-1);this.offset=byte(this.offset-1);
  this.cloud=byte(this.cloud-1);if(this.cloud===247)this.cloud=this.scene>=3?49:39;
  const stop=this.scene===1?26:this.scene===2?27:223;
  if(this.offset===stop){this.offset=byte(this.offset+1);this.cloud=byte(this.cloud+1);this.heroX=byte(this.heroX+1);this.enemyX=byte(this.enemyX+1);if(this.scene!==1)this.hawkX=byte(this.hawkX+1);this.shift=0;if(this.scene===1)this.velocity=0;}
 }
 positiveStep(amount){
  if(this.scene!==1&&!this.offset){this.shift=0;this.velocity=0;return;}
  let phase=byte(amount+this.shift);
  if(phase<8)this.shift=phase;
  else{this.shift=byte(phase-8);this.heroX=byte(this.heroX+1);this.enemyX=byte(this.enemyX+1);this.offset=byte(this.offset+1);this.hawkX=byte(this.hawkX+1);this.cloud=byte(this.cloud+1);if(this.cloud===40)this.cloud=this.scene>=3?238:248;}
  if(this.scene===1){if(!this.room&&this.offset===48){this.shift=1;this.velocity=0;}if(this.offset===11){this.shift=0;this.velocity=0;}}
  else if(!this.offset)this.shift=0;
 }
}
root.KaratekaCamera=Camera;
})(globalThis);
