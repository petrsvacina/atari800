/* Original common rooms $7800-$7983 and scene-3 corridor $B000/$B100. */
(function(root){'use strict';const byte=v=>v&255;
class Rooms{
 constructor(data=root.KARATEKA_ROOMS){this.data=data;}
 part(b,index,mode=1,mirror=false,offset=0,shift=0){const t=this.data.tables,p=t.roomLow[index]+256*t.roomHigh[index];b.blit(this.data.art[p],byte((mirror?39-t.roomX[index]:t.roomX[index])+offset),t.roomY[index],shift,mode,mirror,mirror);}
 paint(b,s){
  b.clear();if(s.room===0){b.rectangle(0,153,40,180,170,0);if(!s.offset||s.offset>=244)b.blit(this.data.art[0xa000],s.offset,86,s.shift,1);for(const i of [0,1,3,4])this.part(b,i,1,false,32+s.offset,s.shift);return;}
  if(s.room===6){b.rectangle(3,159,30,168,170,0);this.part(b,0,1,true);this.part(b,1,1,true);for(const i of [6,7,8,9])this.part(b,i);}
  else{b.rectangle(4,153,36,180,170,0);for(const i of [0,3,1,4]){this.part(b,i);this.part(b,i,1,true);}}
 }
 foreground(b,s){
  if(s.room===0){this.part(b,2,1,false,32+s.offset,s.shift);if(s.door===5)this.part(b,5,0,false,32+s.offset,s.shift);if(s.offset===224&&!s.shift)b.rectangle(37,95,40,173,0);return;}
  this.part(b,2,1,true);
  if(s.room===6){this.part(b,10);if(s.door)this.part(b,s.door,0,true);}
  else{this.part(b,2);if(s.door)this.part(b,s.door,0);if(s.scene>=3&&s.room===1&&s.extraDoor)this.part(b,s.extraDoor,0,true);}
  b.rectangle(0,95,3,173,0);if(s.room!==6)b.rectangle(37,95,40,173,0);
 }
}
root.KaratekaRooms=Rooms;
})(globalThis);
