const bytes = encoded => Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
export class Screen {
  constructor(canvas,data) {
    this.canvas=canvas;this.data=data;this.context=canvas?.getContext('2d',{alpha:false});
    this.fonts=data.levels.map(l=>({static:bytes(l.foreground),animated:bytes(l.animation)}));
    this.hudFont=bytes(data.hudFont);this.pixels=new Uint8Array(320*240);this.playfield=new Uint8Array(320*240);
    this.image=this.context?.createImageData(320,240);
  }
  glyph(raw,x,y,font,offset,colors,hit=false) {
    for(let row=0;row<8;row++) {
      const bits=font[offset+row];
      for(let pair=0;pair<4;pair++) {
        const value=(bits>>(6-pair*2))&3;
        const color=value?(value===3&&(raw&128)?colors[3]:colors[value-1]):colors[4];
        for(let k=0;k<2;k++) {
          const px=x+pair*2+k,py=y+row;if(px<32||px>=288||py<0||py>=240)continue;
          const index=py*320+px;this.pixels[index]=color;
          if(hit)this.playfield[index]=value?1<<(value===3&&(raw&128)?3:value-1):0;
        }
      }
    }
  }
  terrain(picture) {
    const fonts=this.fonts[picture.level],colors=this.data.levels[picture.level].colors.slice(4);
    // The source composes characters before drawing. Half-cell animation can
    // spill into an empty neighboring tile, which must not erase that image.
    const chars=new Uint8Array(8*36+256);
    for(let row=0;row<8;row++)for(let col=0;col<18;col++) {
      const raw=picture.terrain[row*64+picture.camera+col]||0,type=raw&63,g=type&15;
      if(!raw)continue;let dest=col*2;
      if(type>=17&&type<=20&&(picture.clock[g]&1)) {
        const shifted=(dest+this.data.animationOffsets[g])&255;if(shifted)dest=shifted;
      }
      const code=(type*2)|(raw&128);chars[row*36+dest]=code;chars[row*36+((dest+1)&255)]=code+1;
    }
    for(let row=0;row<8;row++)for(let col=0;col<36;col++) {
      const raw=chars[row*36+col],type=(raw&126)>>1,g=type&15,x=col*8+picture.scroll*2;
      const animated=type>=16&&type<=31,font=animated?fonts.animated:fonts.static;
      let top=animated?picture.phase[g]*256+g*16:type*16;
      // A broken pot uses one of the original HUD object glyphs.
      const bonus=type===7&&picture.bonus<9;
      let source=font;
      if(bonus){let b=picture.bonus+1;top=(b>=5?512:0)+(b>=5?b-5:b)*16;source=this.hudFont;}
      for(let half=0;half<2;half++)
        this.glyph(raw,x,24+row*16+half*8,source,top+half*1024+(raw&1)*8,colors,true);
    }
  }
  sprite(rows,x,y,colors,draw=true,collision=true) {
    let mask=0;const height=rows.length/2;
    for(let row=0;row<height;row++)for(let bit=0;bit<8;bit++) {
      const a=(rows[row]>>(7-bit))&1,b=(rows[height+row]>>(7-bit))&1;
      if(!(a|b))continue;
      const color=a&&b?colors[0]|colors[1]:colors[b?1:0];
      for(let k=0;k<2;k++) {
        const px=x*2+bit*2+k,py=((y+row)&255)-8;
        if(px<32||px>=288||py<24||py>=152)continue;
        const index=py*320+px;if(collision)mask|=this.playfield[index];
        // The bottom playfield DLI changes PRIOR from $21 to $24: PF0/PF1
        // cover the players there, while still setting collision latches.
        if(draw&&!(py>=136&&(this.playfield[index]&3)))this.pixels[index]=color;
      }
    }
    return mask;
  }
  hud(game,transition=false) {
    const cells=[...this.data.hud],font=this.hudFont,colors=[...this.data.hudColors.slice(0,3),(game.tick&16)?8:12,0];
    const digit=(v,at)=>{let ch=(v&15)|16;if(ch>=21)ch+=27;ch*=2;cells[at]=ch;cells[at+1]=ch|1;};
    const bcd=(b,at)=>{digit(b>>4,at);digit(b,at+2);};
    for(let i=0;i<3;i++){bcd(game.score[2-i],i*4);bcd(game.highScore[2-i],20+i*4);}
    if(game.atExit()&&(game.tick&4)){bcd(game.bonusCountdown,14);}else cells.fill(0,14,18);
    for(let i=0;i<36;i++)if(i<3||i>=32)cells[32+i]=(cells[32+i]&127)|(game.weapon?128:0);
    for(let i=0;i<10;i++)cells[36+i]=((i<game.stones?i&1:186)+70)|(game.weapon?0:128);
    for(let i=0;i<14;i++)cells[50+i]=i>=14-Math.min(7,game.lives)*2?(72+(i&1)):0;
    for(let i=0;i<8;i++) {
      let code=game.inventory[i]&128?106:(game.inventory[i]+1)*2;
      if(game.inventoryBlink[i]===1)code=0;
      if(code>=10&&code!==106)code+=54;
      cells[73+i*2]=code;cells[74+i*2]=code|1;
    }
    // ANTIC alternates the upper/lower glyph banks for each two-line HUD row.
    for(let line=0;line<3;line++)for(let half=0;half<2;half++)for(let col=0;col<32;col++) {
      const raw=cells[line*32+col];this.glyph(raw,32+col*8,160+(line?22+(line-1)*16:0)+half*8,font,(raw&127)*8+half*1024,colors);
    }
    const progress=[...this.data.progress];progress.fill(85,6,25);progress[25]=86;for(const i of[6,12,18])progress[i]=149;
    let section=((game.chunk===1?161:game.chunk)-3)&255;section>>=1;
    if(!(game.tick&4))progress[6+(section>>2)]|=[192,48,12,3][section&3];
    for(let c=0;c<32;c++)for(let bit=0;bit<4;bit++)for(let k=0;k<2;k++)for(let y=154;y<156;y++) {
      const x=32+c*8+bit*2+k,color=(progress[c]>>(6-bit*2))&3;
      this.pixels[y*320+x]=color?(color===3&&y===154&&x<126&&!transition?this.data.levels[game.level??0].colors[6]:colors[color-1]):0;
    }
    // Original missile gauge: twenty rows, bottom-up filling, x at the spray can.
    for(let row=0;row<=20;row++)if(row>=((40-game.fuel)>>1))for(let x=34;x<46;x++)this.pixels[(192+row)*320+x]=this.data.hudColors[3];
  }
  raster(game,{drawSprites=true,hud=true}={}) {
    if(game.stageFrames) {
      this.pixels.fill(0);this.playfield.fill(0);const colors=[...this.data.hudColors.slice(0,3),12,0];
      for(let half=0;half<2;half++)for(let col=0;col<36;col++) {
        const raw=game.stageCells[col]||0;this.glyph(raw,col*8+game.stageScroll*2,88+half*8,this.hudFont,(raw&127)*8+half*1024,colors);
      }
      if(hud)this.hud(game.stageHud,true);return {pixels:this.pixels,collisions:{hero:0,projectile:0}};
    }
    this.pixels.fill(0);this.playfield.fill(0);this.terrain(game.presentation||game.snapshot());
    const colors=game.playerColors||this.data.levels[game.level].colors.slice(0,4);
    const projectile=this.sprite(game.projectileRows,game.projectileX,game.renderProjectileY??game.projectileY,colors.slice(2),drawSprites);
    const hero=this.sprite(game.spriteRows,game.x,game.renderHeroY??game.previousY,colors,drawSprites);
    if(hud)this.hud(game.hudState||game);return {pixels:this.pixels,collisions:{hero,projectile}};
  }
  draw(game) {
    const {pixels}=this.raster(game);if(!this.context)return;
    const rgba=this.image.data,palette=this.data.palette;
    for(let i=0;i<pixels.length;i++){const j=pixels[i]*3;rgba[i*4]=palette[j];rgba[i*4+1]=palette[j+1];rgba[i*4+2]=palette[j+2];rgba[i*4+3]=255;}
    this.context.putImageData(this.image,0,0);
  }
}
