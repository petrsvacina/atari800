/* Native translation of the River Raid river/object generator, A711–AE96.
 * Tables contain art and numeric parameters only. No original CPU runs here. */
(function(root){
'use strict';
const byte=n=>n&255,signed=n=>n&128?n-256:n;
class Generator{
 constructor(a,checkpoint,previousCheckpoint){
  this.data=a.generator;const start=checkpoint||this.data.starts[0];
  Object.assign(this,{stage:start.stage,seed:[...start.seed],checkpoint:{...start,seed:[...start.seed]},previousCheckpoint:{...start,seed:[...start.seed]},center:start.center,water:20,inset:54,target:0,velocity:0,nextWidth:13,previousWidth:0,hold:1,sections:17,segmentRow:0,layout:0,flags:start.stage&1?132:128,bridgeDestroyed:false,bridgePrep:0,decorSide:0,decorSeed:0,direction:0,blackRows:2,first:10,nearest:10,clock:23,flip:0,gunnerSlot:11,row:-1,nextId:0,decorOffset:0,decorWidth:0,decorHeight:0,decorCursor:0});
  this.actors=Array.from({length:11},()=>({rawY:0,frame:0,type:0,rawX:0,flags:0,size:0,id:-2}));
  Object.assign(this.actors[10],{rawY:74,type:14,flags:this.flags,id:-1});
  this.previousCheckpoint=previousCheckpoint||{stage:start.stage-1,seed:[0,0,0],center:0};
  this.tank={frame:0,rawX:0,rawY:0,phase:255,picture:0,shotX:0,shotY:0,fraction:0,dx:0,fractionDX:0,follow:0,bankCollision:false};
  this.gunner={rawX:0,rawY:0,dx:0,bankCollision:false};
 }
 advanceSeed(){const [aa,ab,ac]=this.seed;const bit=((((ab<<5)&255)^ab)>>7)&1;this.seed=[byte(aa*2+bit),byte(ab*2+(ac>>7)),byte(ac*2+(aa>>7))];}
 advanceStage(){this.previousCheckpoint=this.checkpoint;this.stage=(this.stage>=80?78:this.stage)+1;this.checkpoint={stage:this.stage,seed:[...this.seed],center:this.center};}
 setWidth(width,target=width*4){this.nextWidth=width;this.target=target;this.hold=2;const delta=target-this.inset;if(delta)this.velocity=delta>0?(delta>=32?2:1):(delta< -32?-2:-1);}
 parameters(){
  this.narrow=this.stage<9?6:0;
  if(++this.segmentRow<32){if(!(this.flags&128))this.advanceSeed();}
  else{
   this.segmentRow=0;this.decorSide=0;this.bridgePrep=0;this.flags=(this.flags&4)|16;this.previousWidth=this.nextWidth;
   if(--this.hold){if(this.sections===1){this.bridgeDestroyed=false;this.flags=this.stage&1?128:132;}this.advanceSeed();}
   else{
    if(--this.sections===0){this.advanceStage();this.sections=16;}
    this.advanceSeed();
    if(this.sections===1){this.layout=0;this.bridgePrep=this.stage&1?255:0;this.setWidth(13,54);}
    else if(this.stage&1)this.setWidth(7);
    else{
     let special=false;
     if(this.sections===2){if(this.layout===192)special=true;else this.layout=0;}
     else if(((this.layout<<1)^this.layout)&128)this.layout=this.layout&64?192:0;
     else if(!(this.seed[0]&48))special=true;
     if(special){this.layout=(this.layout&128)||64;this.setWidth(0);}
     else{let width=this.seed[0]&15;if(width<2)width+=2;let max=15-(this.layout&128?1:0)-(this.stage<20?1:0);if(this.narrow)max=8;this.setWidth(Math.min(width,max));}
    }
   }
  }
  if(this.velocity){if(this.velocity<0?this.target>=this.inset:this.inset>=this.target)this.velocity=0;else{this.inset=byte(this.inset+this.velocity);this.water=byte(this.water-2*this.velocity);}}
 }
 trajectory(){
  if(this.flags&128){this.direction=0;this.center=byte(this.center+signed(this.data.bridgeShift[this.segmentRow]));return;}
  if(this.bridgePrep&&(this.center<24||this.center>=41)){this.center+=this.center<24?1:-1;return;}
  let min=1,max=64;
  if(this.stage<3){min=28;max=36;}
  else if(!(this.stage&1)||this.bridgePrep||this.stage<10){min=25;max=40;}
  else{if(this.stage<20){min=13;max=52;}if(this.decorSide){if(this.decorSide&128)min=25;else max=40;}}
  const random=this.seed[2]&15;
  if(!this.direction)this.direction=random<8?-1:1;
  else if(random<8)return;
  else if(random===13)this.direction=-this.direction;
  else if(random===15&&Math.max(this.nextWidth,this.previousWidth)>14-(this.layout&128?1:0))return;
  const width=Math.max(this.inset,this.target),space=byte((64-width)*2),e=this.nearest<11?this.actors[this.nearest]:null;
  let blocked=this.direction<0?this.center<min:this.center>=max;
  if(!blocked&&e&&e.type>=8){
   if(this.direction<0){const bank=this.layout&128?this.center+(this.decorSeed&128?128:space/2):this.center+space+width;blocked=byte(e.rawX-23+this.narrow+(e.size?8:0))>=byte(bank);}
   else{const bank=this.layout&128?this.center+(this.decorSeed&128?64+width:0):this.center+width;blocked=byte(e.rawX-32-this.narrow)<byte(bank+2);}
  }
  if(blocked)this.direction=-this.direction;else this.center=byte(this.center+this.direction);
 }
 decoration(){
  if(this.flags&128||this.segmentRow||!(this.seed[2]&32))return;
  let index,offset;
  if(this.stage&1){index=this.seed[0]&7;offset=this.data.oddDecorationOffsets[index];}
  else{index=Math.min(this.nextWidth,this.previousWidth);if(index<2)return;if(this.layout&128){if(index<5)return;index+=11;}offset=this.data.evenDecorationOffsets[index];}
  this.decorWidth=this.data.decorationWidths[index];this.decorOffset=offset;this.decorHeight=this.data.decorations[this.decorWidth].height;this.decorCursor=0;
  let side=this.seed[2]&128;if(side?this.center<24:this.center>=41)side^=128;this.decorSide=side+1;
 }
 pixels(){
  const out=new Uint8Array(48),land=this.blackRows?170:85;let cursor=0,edgeX=this.center+(this.layout&128?0:this.inset);
  const fill=(value,count)=>{count=byte(count);if(count<128){out.fill(value,cursor,cursor+count);cursor+=count;}return(edgeX&3)*4;};
  const edge=(phase,brown=this.blackRows)=>{phase+=brown?16:0;out[cursor++]=this.data.edges[phase];out[cursor++]=this.data.edges[phase+1];};
  const decoration=()=>{const pattern=this.data.decorations[this.decorWidth].bits;for(let i=0;i<this.decorWidth;i++)out[cursor++]=pattern[this.decorCursor++];};
  let count=(edgeX>>2)-1;
  if(!(this.layout&128)&&(this.decorSide&128)&&this.segmentRow<this.decorHeight){fill(land,this.decorOffset);decoration();count-=this.decorWidth+this.decorOffset;}
  edge(fill(land,count));
  let span=this.water;
  if(this.layout&128){
   if(this.inset<6)span+=2*this.inset;
   else{
    edgeX=byte(edgeX+(this.water>>1));edge(fill(255,(edgeX>>2)-cursor)+2,this.inset<8);
    edgeX=byte(edgeX+this.inset*2);count=(edgeX>>2)-cursor-1;
    if(this.inset<8)edge(fill(170,count),true);
    else{
     if(this.decorSide&&this.segmentRow<this.decorHeight){const offset=this.decorOffset-cursor;fill(land,offset);decoration();count-=offset+this.decorWidth;}
     edge(fill(land,count),false);
    }
    span=this.water>>1;
   }
  }
  edgeX=byte(edgeX+span);edge(fill(255,(edgeX>>2)-cursor)+2);
  count=48-cursor;
  if(!(this.layout&128)&&this.decorSide&&!(this.decorSide&128)&&this.segmentRow<this.decorHeight){fill(land,count-this.decorOffset-this.decorWidth+1);decoration();count=this.decorOffset-1;}
  fill(land,count);if(cursor!==48)throw new Error('Invalid generated river width '+cursor);
  if(this.blackRows)this.blackRows--;return out;
 }
 spawn(){
  const d=this.data,[aa,ab,ac]=this.seed;let type=1,offset=0,extra=0,narrow=this.narrow;
  const subtractInsets=value=>{let carry=type===15?1:0;for(const n of extra?[8,narrow,8]:[8,narrow]){const result=value-n-(1-carry);carry=result>=0?1:0;value=byte(result);}return value;};
  if(this.flags&128){type=14;extra=7;offset=byte(this.inset-6);}
  else{
   let choose=false,place=false;
   if(this.segmentRow){offset=byte(this.stage-8);if(!(offset&128)){if(offset>=32)choose=true;else{offset=byte(offset*8);if(offset>=ab)choose=true;}}}
   else{type=0;offset=this.sections+this.hold;if(offset<18){offset=byte(2*(63-Math.min(this.stage,d.fuelDifficultyCap)));if(offset<ab)choose=true;else if(!(aa&64)){type=15;place=true;}}}
   if(choose){type=d.types[ab&7];if(type===7&&this.stage<5)type=13;else if(type===12&&(this.segmentRow||this.stage<3))type=8;place=true;}
   if(place){
    if(type===13)extra=5;
    if(this.nextWidth===this.previousWidth&&(this.stage&1)){offset=Math.min((aa&63)+narrow,(extra?55:63)-narrow)+this.inset;if(aa&128&&type!==15)this.pendingFlags|=8;}
    else{
     const width=Math.max(this.nextWidth,this.previousWidth),island=!!(this.layout&128);offset=this.nextWidth===this.previousWidth?this.stage>>1:width;
     if(width>14-(island?1:0)&&type!==7)type=1;
     else{
      if(this.sections===1)narrow+=2;
      if((this.sections===1||width>(island?10:13))&&type===13){extra=0;type=8;}
      offset=byte(width*4);
      if(offset&&island){
       offset=byte(64-offset);this.decorSeed=aa;
       if(aa&128)offset=byte(128-offset+narrow+1);
       else{offset=subtractInsets(offset);if(type!==15)this.pendingFlags|=8;}
      }else if(aa&128){offset=subtractInsets(byte(128-offset));if(type!==15)this.pendingFlags|=8;}
      else offset=byte(offset+narrow+1);
     }
    }
   }
  }
  let center=this.center;if(this.bridgePrep&128)center=Math.max(24,Math.min(40,center));
  const slot=--this.first;this.nearest=slot;this.clock=d.heights[type]+4;
  const e={rawY:byte(97-this.clock),frame:type,type,rawX:byte(offset+32+center),flags:this.flags|this.pendingFlags,size:d.sizes[type],id:this.nextId++};this.pendingFlags=0;this.actors[slot]=e;
  if(type===8&&this.gunnerSlot>=11&&this.sections<14&&!(ac&112)&&this.stage>=13){e.type=e.frame=10;this.gunnerSlot=slot;this.gunner.rawX=0;}
  this.spawnTank();this.clock--;
 }
 spawnTank(){
  const t=this.tank,d=this.data,[aa,,ac]=this.seed;
  if(this.segmentRow||t.frame)return;
  if(this.flags&128){Object.assign(t,{rawY:11,frame:(aa&127)<64?5:6,rawX:(aa&127)+64,follow:0,dx:2,fractionDX:0});return;}
  if(this.actors[this.nearest].frame<8||this.stage<7||this.sections<5||this.sections>=14||ac&192)return;
  const width=Math.min(this.nextWidth,this.previousWidth);if(width<2||width>=14)return;
  let velocity=((ac>>3)^(this.stage===10?7:0))&6;if(!velocity&&!(this.layout&128)&&width<8)velocity=8;
  t.dx=d.tankVelocities[velocity];t.fractionDX=d.tankVelocities[velocity+1];
  let frame=5,x;
  if(this.layout&128){if(this.decorSide||width>=11||width<4)return;frame+=ac&1;x=124;}
  else if(this.stage&1){x=ac&31;if(x>=16){x+=88;if(this.decorSide&&!(this.decorSide&128))x=byte(120-x);else frame++;}else if(this.decorSide&128){frame++;x=byte(120-x);}x=byte(x+this.center+32);}
  else{x=d.bankTankX[width];if(x>=80){if(this.decorSide&&!(this.decorSide&128))x=byte(152-x);else frame++;}else if(this.decorSide&128){frame++;x=byte(152-x);}x=byte(x+48);}
  Object.assign(t,{frame,rawX:x,rawY:12,phase:255,follow:255});
 }
 next(){
  this.parameters();this.trajectory();this.decoration();const pixels=this.pixels();
  this.tank.rawY=byte(this.tank.rawY+1);this.tank.shotY=byte(this.tank.shotY+1);this.gunner.rawY=byte(this.gunner.rawY+1);
  for(const e of this.actors)e.rawY=byte(e.rawY+1);
  if(this.actors[10].rawY===0&&this.first<11){for(let i=9;i>=this.first;i--)this.actors[i+1]={...this.actors[i]};this.flip^=1;this.first++;if(this.gunnerSlot<11)this.gunnerSlot++;if(this.nearest<11)this.nearest++;}
  if(this.nearest<11){if(this.clock){this.clock--;this.row++;return pixels;}this.nearest=11;}
  if(!(this.segmentRow&15)&&this.first){this.pendingFlags=0;this.spawn();}
  this.row++;return pixels;
 }
}
root.RiverGenerator=Generator;
})(globalThis);
