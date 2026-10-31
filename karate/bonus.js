/* Native bonus mechanics translated from the supplied International Karate ATR. */
(function(root){
  'use strict';
  const T=root.KARATE_ROUTINE_DATA,byte=n=>n&255;
  function tiles(broken,previous){ // $31E2: three PMG bitmaps, 31 scanlines.
    const planes=previous?previous.map(plane=>plane.slice()):Array.from({length:3},()=>Array(31).fill(0));
    planes[0][0]=3;planes[2][0]=192;planes[1][0]=broken===0?255:T.tileFragments[0];
    for(let row=1,piece=0;row<31;row+=3,piece++){
      planes[0][row]=7;planes[2][row]=224;
      planes[0][row+1]=planes[2][row+1]=255;
      planes[0][row+2]=planes[2][row+2]=0;
      for(let k=0;k<2;k++)planes[1][row+k]=piece<broken?T.tileFragments[row+k]:255;
      // $3243 loads the third middle byte but never stores it. The original
      // screen clear leaves that scanline zero; preserve it when testing arbitrary RAM.
    }
    return planes;
  }
  const tileCount=reaction=>reaction<40?10-(reaction>>2):1; // $311F
  const tileScore=count=>count===10?2000:count*100; // $3174
  function weaponState(player,difficulty){
    return {player,difficulty,enabled:0,active:0,failed:0,remaining:T.weaponCounts[difficulty],travelCount:0,
      phase:0,dir:0,pos:0,speed:0,kind:0,height:0,positions:[0,0,0,0],colors:Array(9).fill(0),planes:Array.from({length:4},()=>Array(72).fill(0))};
  }
  function spawn(b,randomByte){ // $58EF
    b.planes.forEach(plane=>plane.fill(0));
    const choice=b.difficulty*4+(randomByte()&3);
    b.kind=T.weaponTypes[choice];b.speed=T.weaponSpeeds[choice];
    b.dir=(T.weaponSides[b.travelCount]^b.player)&1;b.pos=b.dir?220:40;
    b.height=T.weaponHeights[b.kind*8+(randomByte()&7)];
    b.positions=[0,0,0,0];
    const end=T.weaponPaletteStarts[b.kind];
    b.colors=T.weaponColors.slice(end-8,end+1);b.active=1;
  }
  function drawWeapon(b,frameByte){ // $595A, $59E0, $5A37
    let offset;
    if(b.kind===0){
      offset=0;b.phase=byte(b.phase+1);
      if(b.phase>=3){b.colors[0]=b.colors[1]=14;b.colors[frameByte&1]=122;b.phase=0;}
      const start=T.orbPhases[b.phase];
      for(let y=0;y<11;y++){b.planes[0][b.height+y]=T.orbLo[start+y];b.planes[1][b.height+y]=T.orbHi[start+y];}
    }else if(b.kind===1){
      offset=b.dir?12:8;const start=b.dir?7:0;
      b.planes[3][b.height+1]=b.planes[3][b.height+3]=b.planes[2][b.height+2]=255;
      for(let y=0;y<7;y++){b.planes[0][b.height+y]=T.bladeLo[start+y];b.planes[1][b.height+y]=T.bladeHi[start+y];}
    }else{
      offset=b.dir?20:16;const start=b.dir?6:0;
      for(let y=0;y<6;y++){
        b.planes[0][b.height+y]=T.shaftLo[start+y];b.planes[1][b.height+y]=T.shaftMid[start+y];b.planes[2][b.height+y]=T.shaftHi[start+y];
      }
    }
    b.positions=T.weaponOffsets.slice(offset,offset+4).map(dx=>byte(b.pos+dx));
  }
  function weaponFrame(b,frameByte,randomByte){ // $5807, called once per PAL VBI.
    if(!b.enabled||(!b.active&&(b.failed||!b.remaining))){b.positions=[0,0,0,0];return;}
    if(!b.active)spawn(b,randomByte);
    b.pos=byte(b.pos+(b.dir?-b.speed:b.speed));
    if(b.dir?b.pos<10:b.pos>=240){
      b.remaining=byte(b.remaining-1);b.travelCount=byte(b.travelCount+1);b.active=0;b.positions=[0,0,0,0];return;
    }
    drawWeapon(b,frameByte);
  }
  function latchCollision(b,mask){ // $388A reads P0PF from the preceding raster.
    if(!b.failed&&b.positions[0]>=48&&b.positions[0]<200)b.failed=mask;
  }
  let masks;
  function fighterMasks(){
    if(masks)return masks;
    masks=root.KARATE_FIGHTERS.frames.map(frame=>{
      const pixels=new Uint8Array(72*96);let tile=0;
      for(let r=0;r<12;r++)for(let c=0;c<(frame.layout[r]&15);c++,tile++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const px=(frame.layout[r]>>4)*8+c*8+x;
        if(px<72)pixels[(r*8+y)*72+px]=(frame.data[tile*8+y]>>(6-(x>>1)*2))&3;
      }
      return pixels;
    });return masks;
  }
  function weaponContact(b,p){
    // Original P0PF: only P0's lit pixels, against all nonzero fighter PF pixels.
    const pixels=fighterMasks()[p.frame];let mask=0;
    for(let y=0;y<72;y++){
      const sy=31+y;if(sy>=96)break;
      const bits=b.planes[0][y];if(!bits)continue;
      for(let bit=0;bit<8;bit++)if(bits&(128>>bit)){
        let sx=(b.positions[0]-48)*2+bit*2-(p.origin-16)*2;
        if(p.facing===-1)sx=70-sx;
        if(sx<0||sx>=72)continue;
        const value=pixels[sy*72+sx];if(value)mask|=1<<(value-1);
      }
    }
    return mask;
  }
  function advance(state){ // $2C43, preserving the pre-increment difficulty check.
    const stageBCD=Math.floor(state.stage/10)*16+state.stage%10;
    if(state.level<5&&(stageBCD&3)===2)state.level++;
    state.stage=Math.min(99,state.stage+1);state.cycle=byte(state.cycle+1);
    if(state.multiplayer)return T.seriesModes[state.stage];
    if(state.cycle===4)return 4;
    if(state.cycle>8){state.cycle=0;if(state.stage>=9&&state.weaponDifficulty<2)state.weaponDifficulty++;return 5;}
    return 1;
  }
  root.KarateBonus={tiles,tileCount,tileScore,weaponState,spawn,drawWeapon,weaponFrame,latchCollision,weaponContact,advance};
})(globalThis);
