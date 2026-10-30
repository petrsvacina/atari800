/* Karateka's fighter animation routines $6400–$6759, translated to native JS.
 * Animation indices, byte wrapping and input consumption come from the supplied ATR.
 * There is no CPU, instruction decoder or executable original program here. */
(function(root){'use strict';
const byte=v=>v&255,neg=v=>!!(v&128),signed=v=>neg(v)?v-256:v;
const names=['legs','torso','x','drawX','repeat','legFrame','armFrame','legStep','armStep','move','height','contact','facing','spare','spare2','running'];
function fighter(values){const f={};names.forEach((name,i)=>f[name]=values?.[i]??0);return f;}
function bytes(f){return names.map(name=>f[name]);}
class Motion{
 constructor(data){this.data=data;this.heroX=11;this.align=1;this.kick=0;this.punch=0;this.sound=0;this.distance=255;}
 consume(f,kick){if(this.heroX===f.x)this[kick?'kick':'punch']=128;}
 command(f,command){
  const again=()=>this.command(f,0),setBoth=(frame,step=1)=>{f.legFrame=f.armFrame=frame;f.legStep=f.armStep=step;};
  if(!f.running){
   if(command===0xd1){if(neg(f.height)){if(f.torso===6||f.torso===29)f.torso=28;}else if(f.torso===6||f.torso===28)f.torso=29;return again();}
   if(command===0xd7){
    if(f.repeat>=5){f.repeat=0;return again();}
    if(f.legs===22){f.repeat=1;if(f.armFrame===57){f.armFrame=f.legFrame=11;this.consume(f,false);return;}if(f.armFrame===13){f.armFrame=55;f.legFrame=11;this.consume(f,false);return;}}
    if(![6,28,29].includes(f.torso))return again();
    if(f.legs===6){f.repeat=0;setBoth(10);this.consume(f,false);return;}
    f.repeat=1;f.armStep=1;f.armFrame=56;this.consume(f,false);return again();
   }
   if(command===0xc5){
    if(f.legs===6){setBoth(7);f.repeat=0;this.consume(f,true);return;}
    if(f.legs===1&&f.repeat<3){f.repeat=byte(f.repeat+1);f.legFrame=f.armFrame=1;this.consume(f,true);return;}
    if(f.legs===27&&!neg(f.legStep)){f.legFrame=f.armFrame=255;f.legStep=f.armStep=1;f.repeat=0;this.consume(f,true);return;}
    return again();
   }
  }
  if(command===0xc6){
   if(f.legs>=14&&f.legs<20)return;
   if(f.x===this.heroX){if(!((f.x^this.align)&1))f.x=byte(f.x-f.facing);setBoth(32);}
   else{if((f.x^this.align)&1)f.x=byte(f.x-f.facing);setBoth(32);}
   this.consume(f,true);this.consume(f,false);return;
  }
  if(command===0x9b){
   if(f.running){if(f.legs!==7||f.torso!==7)return again();setBoth(17);}
   else{if(f.legs!==6)return again();setBoth(21,255);}
   f.running^=255;this.consume(f,true);return again();
  }
  if(f.running&&command===0xc2){if(f.legs!==7||f.torso!==7)return again();setBoth(22);this.consume(f,true);this.consume(f,false);return;}
  if(f.running){
   if(f.legs===7){if(f.move&&!neg(f.move)){setBoth(63);f.legFrame=63;f.armFrame=42;}return;}
   if(f.legs===35){if(f.move!==1){f.legFrame=73;f.armFrame=52;}return;}
   if(f.legFrame===73){f.legFrame=65;f.armFrame=44;}return;
  }
  if(!f.move)return;
  if(f.legs===6){f.legStep=f.move;f.legFrame=neg(f.move)?61:55;return;}
  if(f.legs<23)return;
  if(f.legFrame>=55&&f.legFrame<63){if(f.legFrame===57){f.legFrame=44;return;}if(f.legFrame===59){f.legFrame=51;return;}}
  if(f.legFrame<63)f.legStep=f.move;
 }
 advance(f,depth=0){
  if(depth>12)throw Error('Invalid animation cycle');
  const d=this.data;f.contact=255;
  if(f.legStep){
   f.legFrame=byte(f.legFrame+f.legStep);let x=f.legFrame,dx;
   if(neg(f.legStep))dx=byte(-d.stride[byte(x+1)]);else dx=d.stride[x];
   if(neg(f.facing))dx=byte(-dx);f.x=byte(f.x+dx);
   const pose=d.legSequence[x];
   if(pose<128)f.legs=pose;
   else if(pose===255)f.legStep=0;
   else if(pose===128){this.sound=byte(this.sound+1);let h=neg(f.height)?0:f.height===1?2:1;f.legs=f.torso=2+h;f.armFrame=byte(f.armFrame+1);f.contact=h;return;}
   else if(pose===129){
    if(f.move===1&&this.distance>=8){f.legFrame=f.armFrame=57;f.legStep=f.armStep=1;}
    else if(neg(f.move)){f.legFrame=f.armFrame=5;f.legStep=f.armStep=1;}
    else{f.legFrame=58;f.legStep=255;f.armStep=1;f.armFrame=57;f.x=byte(f.x+2*signed(f.facing));}
    return this.advance(f,depth+1);
   }else if(pose===130){f.armFrame=57;f.legStep=255;f.legFrame=48;return this.advance(f,depth+1);}
   else if(pose===131){f.legFrame=f.armFrame=0;return this.advance(f,depth+1);}
  }
  if(!f.armStep)return;
  f.armFrame=byte(f.armFrame+f.armStep);const pose=d.armSequence[f.armFrame];
  if(pose<128)f.torso=pose;
  else if(pose===255)f.armStep=0;
  else if(pose===134||pose===132){this.sound=byte(this.sound+1);const h=neg(f.height)?0:f.height===1?2:1;f.torso=(pose===134?25:22)+h;f.contact=(pose===134?6:3)+h;}
 }
}
root.KaratekaMotion={Motion,fighter,bytes,names,byte,signed};
})(globalThis);
