/* Native character-map construction, translated from the supplied game's
 * 9583–9B5E. The 24-column bands and special cases are original data. */
(function(root){'use strict';
const U=48,UE=72,ME=96,M=120,MM=144,LE=168,L=192,W=216;
function pack(t,offset,value){for(let y=3;y>=0;y--){const n=(value&3)*4;t[offset+y]=n?n+0x8d:0;value>>=2;}}
function reflected(c){if(!c||c===0x99)return c;if(c<0x99)return c^4;return c===0x9d?0xa1:0x9d;}
function build(s,a,random=()=>0){
 const t=s.tiles;
 t.fill(0x99,U,U+4);t.fill(0x99,L,L+4);t.fill(s.floorPresent?0x99:0,M,M+4);
 for(let i=0;i<3;i++){const o=[U,M,L][i];pack(t,o+4,s.upper[i]);pack(t,o+8,s.lower[i]);}
 for(let y=11,x=0;y>=0;y--,x++){
  let c=t[U+y];
  if(!c){
   if(y!==11&&t[U+y+1]===0x99){t[U+y+1]=0x9d;t[U+11+x]=0xa1;t[UE+11+x]=0xa2;}
   if(y&&t[U+y-1]===0x99)t[U+y-1]=0xa1;
   c=t[U+y];
  }
  t[UE+y]=c?c^3:0;c=reflected(c);t[U+12+x]=c;t[UE+12+x]=c?c^3:0;
  c=t[L+y];
  if(!c){
   if(y!==11&&t[L+y+1]===0x99){t[L+y+1]=0x9d;t[U+11+x+144]=0xa1;t[LE+11+x]=0xa0;}
   if(y&&t[L+y-1]===0x99)t[L+y-1]=0xa1;
   c=t[L+y];
  }
  t[LE+y]=c?c&0xfe:0;c=c?c|1:0;c=reflected(c);t[L+12+x]=c;t[LE+12+x]=c?c&0xfe:0;
 }
 // The middle band has a different bevel and vertical reflection.
 pack(t,M+4,s.upper[1]);pack(t,M+8,s.lower[1]);
 for(let y=11,x=0;y>=0;y--,x++){
  let c=t[M+y];
  if(!c){
   if(y!==11&&t[M+y+1]===0x99){t[M+y+1]=0x9d;t[ME+y+1]=0x9c;t[MM+y+1]=0x9e;t[M+11+x]=0xa1;t[ME+11+x]=0xa0;t[MM+11+x]=0xa2;}
   if(y&&t[M+y-1]===0x99)t[M+y-1]=0xa1;c=t[M+y];
  }
  t[ME+y]=c?c&0xfe:0;t[MM+y]=c?c^3:0;
  let r=reflected(c);t[M+12+x]=r;t[ME+12+x]=r?r&0xfe:0;t[MM+12+x]=r?(r&0xfe)|2:0;
 }
 if(!s.room){t[U+9]=0x9d;t[UE+9]=0x9e;for(let i=10;i<22;i++){t[U+i]=0x99;t[UE+i]=0x9a;}}
 for(let x=47;x>=0;x--){const c=t[U+(x>>1)];t[x]=!c||((x&1)?c===0x95:c<0x93)?0:a.ceilingTiles[x&7];}
 // Texture noise is cosmetic POKEY RANDOM, independent of game collisions.
 for(let y=23;y>=0;y--){for(const [o,from,to] of [[UE,0x9a,0x9a],[ME,0x98,0xb0],[MM,0x9a,0x9a],[LE,0x98,0xb0],[U,0x99,0x98],[L,0x99,0x98]])if(t[o+y]===from)t[o+y]=to|(random()&1);}
 animate(s,a);
 return t;
}
function animate(s,a){
 const t=s.tiles;
 t.fill(s.floorPresent?0x99:0,M,M+4);pack(t,M+4,s.upper[1]);pack(t,M+8,s.lower[1]);
 if(!(s.middleMode&1)){
  for(let y=9;y>=0;y--){let c=t[M+2+y];
   if(!c){if(t[M+3+y]===0x99){t[M+3+y]=t[M+13+y]=0x9d;t[ME+3+y]=t[ME+13+y]=0x9c;t[MM+3+y]=t[MM+13+y]=0x9e;}if(y&&t[M+1+y]===0x99)t[M+1+y]=0xa1;c=t[M+2+y];}
   for(const o of [M+12,MM+2,MM+12,ME+2,ME+12])t[o+y]=c;
   if(c){if(c===0x99){t[MM+2+y]=t[MM+12+y]=(y&1)|0x9a;t[ME+2+y]=t[ME+12+y]=(y&1)|0xb0;}else{t[ME+2+y]=t[ME+12+y]=c&0xfc;t[MM+2+y]=t[MM+12+y]=(c&0xfc)|2;}}
  }
 }else{
  for(let y=11,x=0;y>=0;y--,x++){
   let c=t[M+y];
   if(!c){if(y!==11&&t[M+y+1]===0x99){t[M+y+1]=0x9d;t[ME+y+1]=0x9c;t[MM+y+1]=0x9e;t[M+11+x]=0xa1;t[ME+11+x]=0xa0;t[MM+11+x]=0xa2;}if(y&&t[M+y-1]===0x99)t[M+y-1]=0xa1;c=t[M+y];}
   t[MM+y]=c;
   if(c===0x99){t[M+12+x]=c;t[MM+y]=t[MM+12+x]=(y&1)|0x9a;t[ME+y]=t[ME+12+x]=(y&1)|0xb0;}
   else{t[MM+y]=c?c^3:0;t[ME+y]=c?c&0xfe:0;let r=reflected(c?c|1:0);t[M+12+x]=r;t[ME+12+x]=r?r&0xfe:0;t[MM+12+x]=r?(r&0xfe)|2:0;}
  }
 }
 function set(o,values){for(const [index,value] of values)t[o+index]=value;}
 if(s.level===16&&s.room===8){set(M,[[0,0x99],[1,0x99],[2,0x99],[3,0x99],[4,0x99]]);for(let i=0;i<5;i++){t[ME+i]=(i&1)?0xb1:0xb0;t[MM+i]=(i&1)?0x9b:0x9a;}}
 else if(s.wallX===9){t[ME+4]=0xa0;t[M+4]=0xa1;t[MM+4]=0xa2;for(let i=0;i<4;i++){t[ME+i]=(i&1)?0xb1:0xb0;t[M+i]=0x99;t[MM+i]=(i&1)?0x9b:0x9a;}}
 else if(s.wallX===0x99){t[ME+19]=0x9c;t[M+19]=0x9d;t[MM+19]=0x9e;for(let i=20;i<24;i++){t[ME+i]=(i&1)?0xb1:0xb0;t[M+i]=0x99;t[MM+i]=(i&1)?0x9b:0x9a;}}
 const column=s.wallX>>3;
 if(column>=2&&column<19){const base=s.wallPhase&128?0xf4:0xe4,shift=(s.wallX&4)?4:0;for(let y=0;y<3;y++){t[ME+2+column+y*24]=base+shift+y;if(shift)t[ME+3+column+y*24]=base+8+y;}}
 const water=s.room===a.lastRooms[s.level]||s.room>=10;
 for(let x=47;x>=0;x--){const c=t[L+(x>>1)];let value=0;if(c&&((x&1)?c!==0x95:c>=0x93))value=a.waterTiles[(water?(s.clock<<3)&0xe0:0)|(x&31)];if(!value&&water)value=((s.clock>>4)&3)+8;t[W+x]=value;}
 return t;
}
root.HeroTerrain={build,animate,pack,offsets:{U,UE,ME,M,MM,LE,L,W}};
})(globalThis);
