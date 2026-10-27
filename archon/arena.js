/* Native translation of Archon's arena state routines, $53A8 and $6A0F–$75E6.
   Coordinates retain color clocks / raster rows; no CPU, opcodes or ROM runtime. */
(function(root){
  'use strict';
  const D=root.ARCHON_MECHANICS,A=root.ARCHON_ASSETS;
  const byte=n=>n&255,signed=n=>n&128?n-256:n;
  const animated=new Set([1,3,5,11,16,17,18,19]);
  const unitBytes=A.units.map(u=>u.frames.flat());
  const reverse=n=>{let v=0;for(let i=0;i<8;i++){v=v*2+(n&1);n>>=1;}return v;};
  function field(randomByte){
    const cells=new Uint8Array(240);
    // $53AE: three glyphs, three color registers, two cells per combination.
    for(let glyph=1;glyph<=3;glyph++)for(let color=0;color<3;color++)for(let count=0;count<2;){
      let x,y;do{x=randomByte()&30;}while(x<3||x>=18);
      do{y=randomByte()&14;}while(!y||y>=12);
      if(!cells[y*20+x]){cells[y*20+x]=glyph+color*64;count++;}
    }
    for(let x=1;x<=18;x++){cells[x]=196;cells[220+x]=197;}
    for(let y=0;y<12;y++){cells[y*20]=198;cells[y*20+19]=198;}
    return cells;
  }
  class Arena{
    constructor(game,fighters,options={}){
      this.game=game;this.fighters=fighters;this.randomByte=()=>game.randomByte();
      this.cells=options.cells?Uint8Array.from(options.cells):field(this.randomByte);
      this.colors=[0,4,12];this.colorDirection=[1,1,-1];this.clock=0;this.lastDrawn=null;
      this.background=game.rules.luminosity.hardwareLuma[game.luminosity];
      const terrain=game.terrain(game.arena.square.x,game.arena.square.y);
      if(terrain==='light')this.background=14;else if(terrain==='dark')this.background=0;
      this.deathClock=176+this.background;this.finished=false;
      this.pmColors=[fighters[0].unitType>=16?[170,52,20,116][fighters[0].unitType-16]:234,
        fighters[1].unitType>=16?[170,52,20,116][fighters[1].unitType-16]:148,D.unitColors[fighters[0].type],D.unitColors[fighters[1].type]];
      this.pmColors=this.pmColors.map(color=>Math.abs((color&15)-this.background)===2?byte(color+(color&15)-this.background):color);
      for(let i=0;i<2;i++){
        const f=fighters[i];Object.assign(f,{hx:i?192:57,by:i?120:104,dir:f.type&8?128:0,walkPhase:0,walkClock:0,
          motionSound:false,slowClock:f.spec.arenaSpeed===.75?64:0,terrainToggle:0,cooldown:0,hurt:0,moving:false,
          previousDirection:0,aiHorizontal:0,aiVertical:0,aiDelay:0,aiRange:D.aiRange[f.type],
          aiRetreat:D.aiRetreat[fighters[1-i].type],aiDodgeX:D.aiDodge[fighters[1-i].type],
          aiDodgeY:D.aiDodge[fighters[1-i].type]+3,weapon:{active:0,hx:0,by:0,dx:0,dy:0,dir:0,phase:0,phaseClock:0,contact:0,terrain:0,ownBitmap:false,size:1,height:8}});
        if(f.aiRange<16&&f.aiRetreat>=20)f.aiRetreat=20;
        const own=game.liveUnits.filter(u=>u.side===f.side).length,enemy=game.liveUnits.filter(u=>u.side!==f.side).length;
        const power=game.isPower(game.arena.square.x,game.arena.square.y)?0:3;
        f.aiReaction=Math.max(1,power+own-enemy);
        Object.defineProperties(f,{
          x:{configurable:true,get(){return(this.hx-48)*2+8;},set(v){this.hx=(v-8)/2+48;}},
          y:{configurable:true,get(){return this.by+8;},set(v){this.by=v-8;}},
          attackTicks:{configurable:true,get(){return(this.dir&127)>=12?1:0;},set(){}},
          areaTicks:{configurable:true,get(){return this.weapon.active&&this.spec.special==='phoenix'?50-(this.weapon.dx+(this.weapon.dy/5)*10):this.weapon.active&&this.spec.special==='banshee'?this.weapon.dx+1:0;},set(){}},
          areaAge:{configurable:true,get(){return this.spec.special==='phoenix'?this.weapon.dx+(this.weapon.dy/5)*10:40-this.weapon.dx;},set(){}},
          walkAge:{configurable:true,get(){return this.walkPhase;},set(v){this.walkPhase=v;}}
        });
      }
      this.lastDrawn=this.pictures();
    }
    event(type,f,extra={}){this.game.emit(type,{side:f.side,unit:f.type,...extra});}
    picture(f,weapon=false){
      const w=f.weapon,dir=weapon?w.dir:f.dir,phase=weapon?w.phase:f.walkPhase;
      let rows,offset=D.frameOffsets[(dir+(phase&3))&127]||0;
      if(weapon){
        if(!w.active||!w.hx)return null;
        rows=(w.ownBitmap?unitBytes[f.type]:A.units[f.type].projectile.raw).slice(offset,offset+w.height);
      }else{
        if(!f.hp||!f.hx)return null;
        rows=unitBytes[f.type].slice(offset,offset+16);
      }
      if(dir&128)rows=rows.map(reverse);
      return{x:((weapon?w.hx:f.hx)-48)*2,y:weapon?w.by:f.by,
        bitWidth:2*(weapon?w.size:1),rows,width:16*(weapon?w.size:1),height:rows.length};
    }
    pictures(){return this.fighters.map(f=>this.picture(f)).concat(this.fighters.map(f=>this.picture(f,true)));}
    overlap(a,b){
      if(!a||!b||a.x>=b.x+b.width||b.x>=a.x+a.width||a.y>=b.y+b.height||b.y>=a.y+a.height)return false;
      const left=Math.max(a.x,b.x),right=Math.min(a.x+a.width,b.x+b.width),top=Math.max(a.y,b.y),bottom=Math.min(a.y+a.height,b.y+b.height);
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if((a.rows[y-a.y]&(128>>Math.floor((x-a.x)/a.bitWidth)))&&(b.rows[y-b.y]&(128>>Math.floor((x-b.x)/b.bitWidth))))return true;
      return false;
    }
    fieldContact(p){
      if(!p)return 0;let bits=0;
      for(let y=0;y<p.rows.length;y++)for(let bit=0;bit<8;bit++)if(p.rows[y]&(128>>bit))for(let xx=0;xx<p.bitWidth;xx++){
        const x=p.x+bit*p.bitWidth+xx,yy=p.y+y;
        if(x<0||x>=320||yy<32||yy>=224)continue;
        const cell=this.cells[Math.floor((yy-32)/16)*20+Math.floor(x/16)],rows=D.glyphs[cell&63];
        if(rows&&(rows[Math.floor((yy-32)%16/2)]&(128>>Math.floor(x%16/2))))bits|=1<<(cell>>>6);
      }
      return bits;
    }
    collisionClass(bits,weapon=false){
      for(let color=0;color<4;color++)if(bits&(1<<color)){
        if(color===3)return weapon?255:0;
        const delta=Math.abs(this.background-this.colors[color]);return delta===0?0:delta===2?64:128;
      }
      return 0;
    }
    captureContacts(){
      const now=this.pictures(),old=now;
      for(let i=0;i<2;i++){
        const f=this.fighters[i],w=f.weapon;
        f.terrainContact=this.collisionClass(this.fieldContact(old[i]));
        w.terrain=this.collisionClass(this.fieldContact(old[i+2]),true);
        if(!(w.contact&128)){
          let mask=0;for(let j=0;j<4;j++)if(j!==i+2&&this.overlap(old[i+2],old[j]))mask|=1<<j;
          w.contact=mask;
        }
      }
      this.lastDrawn=now;
    }
    cycleColors(){
      for(let i=2;i>=0;i--){
        this.colors[i]=(this.colors[i]+this.colorDirection[i]*2)&15;
        if(this.colors[i]===14)this.colorDirection[i]=-1;else if(!this.colors[i])this.colorDirection[i]=1;
      }
    }
    hit(i){
      const f=this.fighters[i],enemy=this.fighters[1-i],w=f.weapon;this.hitResult=64;
      if(!(w.contact&(i?1:2)))return false;
      if(enemy.type===6&&enemy.weapon.active){this.hitResult=130;return false;}
      enemy.hp=Math.max(0,enemy.hp-f.spec.damage);
      if(!enemy.hp){enemy.hx=0;this.deathClock=64;}
      this.hitResult=(f.type&7)===6?130:128;if((f.type&7)!==6)w.contact=128;
      return true;
    }
    endWeapon(f){this.event('weapon',f,{active:false});if(this.lastDrawn)this.lastDrawn[this.fighters.indexOf(f)+2]=null;Object.assign(f.weapon,{active:0,hx:0,dx:0,dy:0,contact:0});if(f.dir>=12)f.dir=f.dir===12?8:f.dir===16?4:f.dir&128;}
    phoenixGeometry(f){
      const w=f.weapon,stage=D.phoenixStages[w.dy/5];
      w.size=[1,2,1,4][stage[0]];w.height=stage[1]+1;w.dir=stage[2];w.hx=byte(f.hx-stage[3]);w.by=byte(f.by-stage[4]);
      w.ownBitmap=w.dy===0||w.dy===20;
    }
    bansheeStep(i){
      const f=this.fighters[i],w=f.weapon;w.dx=byte(w.dx-1);
      if(w.dx&128){w.size=1;w.height=8;this.endWeapon(f);return;}
      w.dy++;if(w.dy>=5){this.hit(i);w.dy=0;}
      Object.assign(w,{dir:18,height:32,size:4,hx:byte(f.hx-12),by:byte(f.by-8),ownBitmap:false});
    }
    weaponStep(i){
      const f=this.fighters[i],w=f.weapon;if(!w.active)return;
      const parameter=D.weaponParameters[f.type];
      if(parameter&64){
        if(f.type===14){this.bansheeStep(i);return;}
        w.dx++;
        if(w.dx===5){this.hit(i);return;}
        if(w.dx!==10)return;
        w.dx=0;w.dy+=5;
        if(w.dy>=25){f.dir=8;w.size=1;w.height=8;this.endWeapon(f);return;}
        this.phoenixGeometry(f);return;
      }
      if(parameter===32){
        if(!(w.contact&128)){this.hit(i);if(this.hitResult&128)this.event('impact',f);}
        if(!(w.active&15)){this.endWeapon(f);return;}w.active=byte(w.active-1);return;
      }
      this.hit(i);
      if(this.hitResult&128){this.event('impact',f);this.endWeapon(f);return;}
      if(w.terrain&128){this.endWeapon(f);return;}
      w.terrainToggle=w.terrain?byte(~(w.terrainToggle||0)):0;
      if(w.terrainToggle)return;
      w.by=byte(w.by+signed(w.dy));if(w.by<16||w.by>=240){this.endWeapon(f);return;}
      w.hx=byte(w.hx+signed(w.dx));if(w.hx<16||w.hx>=240){this.endWeapon(f);return;}
      if(animated.has(f.type)){w.phaseClock=byte(w.phaseClock+1);if((w.phaseClock&3)===3)w.phase=byte(w.phase+1);}
    }
    moveAxis(f,axis,direction){
      const horizontal=axis==='x';
      if(horizontal){f.previousDirection=(f.previousDirection&129)|(direction>0?64:66);f.dir=direction>0?0:128;}
      else{f.previousDirection=(f.previousDirection&66)|(direction<0?129:128);if(!f.moving)f.dir=direction<0?8:4;}
      f.moving=true;
      if(horizontal){if(direction>0&&f.hx<192)f.hx++;else if(direction<0&&f.hx>=57)f.hx--;}
      else{if(direction<0&&f.by>=36)f.by--;else if(direction>0&&f.by<204)f.by++;}
    }
    aimAxis(f,axis,direction){
      if(f.cooldown)return;
      const w=f.weapon,parameter=D.weaponParameters[f.type];f.firing=true;
      if(axis==='x'){
        f.dir=direction>0?14:142;w.hx=byte(f.hx+direction*5);w.dx=byte(parameter*direction);
        w.dir=direction>0?17:145;w.by=byte(f.by+4);
      }else{
        f.dir=direction<0?12:16;w.by=byte(f.by+(direction<0?-7:15));w.dy=byte(parameter*direction);
        if(!w.dx){w.hx=f.hx;w.dir=18;}
        else{
          w.dir=(direction<0?19:20)|(w.dx&128);f.dir=(direction<0?13:15)|(w.dx&128);
          w.by=byte(w.by+(direction<0?4:-4));
        }
      }
    }
    startWeapon(i){
      const f=this.fighters[i],w=f.weapon,parameter=D.weaponParameters[f.type];
      f.cooldown=f.spec.reload;
      if(parameter&64){
        Object.assign(w,{active:64,phase:0,dx:0,dy:0});
        if(f.type===14){w.dx=41;this.bansheeStep(i);}else this.phoenixGeometry(f);
      }else{
        w.active=128|(parameter===32?15:0);w.height=8;w.size=1;w.ownBitmap=false;
        if(animated.has(f.type))w.dir=17;
      }
      this.event('fire',f);this.event('weapon',f,{active:true,restart:true,special:f.spec.special,parameter:D.weaponParameters[f.type]});
    }
    actorStep(i,input){
      const f=this.fighters[i],w=f.weapon;this.weaponStep(i);f.moving=false;f.firing=false;f.vx=0;f.vy=0;
      const ox=f.hx,oy=f.by,parameter=D.weaponParameters[f.type];
      const locked=!!(parameter&96&&w.active&&f.type!==14);let canMove=!locked&&f.hp>0,animate=locked,forcedAI=false;
      const computer=this.game.mode==='solo'&&f.side!==this.game.humanSide;
      if(canMove&&f.terrainContact&128){
        if(this.lastDrawn)this.lastDrawn[i]=null;f.hx=(f.hx&248)|8;f.by=(f.by&240)|16;if(f.by>=204)f.by^=24;
        canMove=computer;forcedAI=computer;f.aiHorizontal=0;f.aiVertical=0;
        if(f.type===14&&w.active){w.hx=byte(f.hx-12);w.by=byte(f.by-8);}
      }else if(canMove){
        f.terrainToggle=f.terrainContact?byte(~f.terrainToggle):0;
        if(f.terrainToggle)canMove=false;
      }
      if(canMove&&!forcedAI&&f.slowClock){f.slowClock=byte(f.slowClock+1);if(!(f.slowClock&3)){f.slowClock=64;canMove=false;}}
      if(canMove){
        animate=true;if(computer)this.ai(i);
        else{
          const dx=Math.sign(input?.x||0),dy=Math.sign(input?.y||0);
          if(input?.fire){if(dx)this.aimAxis(f,'x',dx);if(dy)this.aimAxis(f,'y',dy);}
          else{if(dx)this.moveAxis(f,'x',dx);if(dy)this.moveAxis(f,'y',dy);}
        }
      }
      const previousSound=f.motionSound;
      if(f.moving){f.walkClock=byte(f.walkClock+1);if(!(f.walkClock&3)){f.walkPhase=byte(f.walkPhase+1);f.motionSound=true;}}
      else if(animate){f.walkPhase=0;f.motionSound=false;if(input?.fire&&(f.type&7)===6&&f.hp)this.aimAxis(f,'y',1);}
      if(previousSound!==f.motionSound)this.event('motion',f,{active:f.motionSound});
      if(f.firing)this.startWeapon(i);
      if(f.cooldown&&!--f.cooldown)this.event('charged',f);
      f.vx=(f.hx-ox)*2;f.vy=f.by-oy;
      const dir=f.dir&127;f.look={x:dir===0||dir===14?1:f.dir&128?-1:0,y:[8,12,13].includes(dir)?-1:[4,15,16].includes(dir)?1:0};
    }
    step(inputs){
      this.captureContacts();
      for(let i=1;i>=0;i--)if(!this.fighters[i].hp){
        if(this.deathClock&128){if(this.fighters.some(f=>f.weapon.active))continue;this.finished=true;}
        this.deathClock=byte(this.deathClock-1);
      }
      this.classes=[0,1,2].map(c=>this.collisionClass(1<<c));this.clock++;
      // RTCLOK+1 changes once in 256 VBI calls, not once a second.
      if(!(this.clock&255))this.cycleColors();
      this.actorStep(1,inputs?.[1]);this.actorStep(0,inputs?.[0]);
    }
    syncSound(){for(const f of this.fighters){this.event('motion',f,{active:f.motionSound});this.event('weapon',f,{active:!!f.weapon.active,special:f.spec.special,parameter:D.weaponParameters[f.type]});}}
    areaSize(f){const p=this.picture(f,true);return p?{rx:p.width/2,ry:p.height/2}:{rx:0,ry:0};}
    // $7087–$75E6: attack alignment, delayed decisions, avoidance and escape.
    computer(i){
      const f=this.fighters[i],enemy=this.fighters[1-i];
      const shoot=()=>{if(f.aiHorizontal)this.aimAxis(f,'x',f.aiHorizontal&128?-1:1);if(f.aiVertical)this.aimAxis(f,'y',f.aiVertical&128?-1:1);f.aiHorizontal=0;f.aiVertical=0;f.aiDelay=f.aiReaction;};
      if(f.aiDelay){
        if((f.type&7)===6)f.aiDelay=0;else if(--f.aiDelay)return;
        if(f.aiHorizontal||f.aiVertical){shoot();return;}
      }
      if(!(f.aiHorizontal&127))f.aiHorizontal=0;if(!(f.aiVertical&127))f.aiVertical=0;
      const execute=()=>{
        if(f.aiHorizontal){const negative=!!(f.aiHorizontal&128);f.aiHorizontal=byte(f.aiHorizontal-1);this.moveAxis(f,'x',negative?-1:1);}
        if(f.aiVertical){const negative=!!(f.aiVertical&128);f.aiVertical=byte(f.aiVertical-1);this.moveAxis(f,'y',negative?-1:1);}
      };
      if(f.aiHorizontal||f.aiVertical){execute();return;}
      let tx=byte(f.hx-48)>>3;
      const tileY=y=>(byte(y-32)>>4)+((y&15)>=8?1:0);
      let ty=tileY(f.by),ok=false;
      const dx=Math.abs(enemy.hx-f.hx),dy=Math.abs(enemy.by-f.by),sx=enemy.hx<f.hx?-1:1,sy=enemy.by<f.by?-1:1;
      const blocked=(x,y)=>{
        const cell=this.cells[y*20+x]||0;if(!cell)return false;
        const group=cell>>>6;return group===3||(this.classes?.[group]??this.collisionClass(1<<group))>=128;
      };
      const vertical=direction=>{
        if(direction<0&&f.by<44||direction>0&&f.by>=196)return;
        if(!(tx&1)&&(ty&1)&&blocked(tx,ty+direction))return;
        ok=true;f.aiVertical=direction<0?136:8;ty=tileY(f.by+direction*8);
      };
      const horizontal=direction=>{
        if(direction<0&&f.hx<65||direction>0&&f.hx>=184)return;
        if((tx&1)&&!(ty&1)&&blocked(tx+direction,ty))return;
        ok=true;f.aiHorizontal=direction<0?136:8;tx+=direction;
      };
      const towardV=()=>vertical(sy),awayV=()=>{if(dy<f.aiRetreat)vertical(-sy);},oppositeV=()=>vertical(-sy);
      const towardH=()=>horizontal(sx),awayH=()=>{if(dx<f.aiRetreat)horizontal(-sx);},oppositeH=()=>horizontal(-sx);
      const escape=()=>{
        const first=this.randomByte()&1?'x':'y';
        const tryAxis=axis=>{
          const direction=this.randomByte()&1?-1:1,move=axis==='x'?horizontal:vertical;
          move(direction);if(!ok)move(-direction);
        };
        tryAxis(first);
        if(!ok||(this.randomByte()&1)===1)tryAxis(first==='x'?'y':'x');
        execute();
      };
      const fallback=()=>{
        let random;do{random=this.randomByte();}while(!random);
        if(random===3){escape();return;}
        if(f.previousDirection&128)vertical(f.previousDirection&1?-1:1);
        const h=f.previousDirection&66;if(h>=64)horizontal(h===64?1:-1);
        if(ok)execute();else escape();
      };
      const finish=()=>{if(ok)execute();else fallback();};
      const defend=()=>{
        if(dy<f.aiDodgeY){
          if(f.type===6&&!f.cooldown){this.aimAxis(f,'x',-1);return;}
          awayV();awayH();finish();return;
        }
        if(dx<f.aiDodgeX){
          if(f.type===6&&!f.cooldown){this.aimAxis(f,'y',1);return;}
          awayH();awayV();finish();return;
        }
        if(Math.abs(dx-dy)>=f.aiDodgeX){fallback();return;}
        if(dx<dy){oppositeV();towardH();if(ok){execute();return;}}
        oppositeH();towardV();if(ok){execute();return;}
        oppositeV();towardH();execute();
      };
      const approach=()=>{
        if(enemy.weapon.active){defend();return;}
        if(dy<dx){
          if(dx<f.aiRange){
            if(enemy.by<48||((enemy.by&31)<24&&(enemy.by&31)>=8)||!(this.randomByte()&3))towardV();else oppositeV();
          }else if(f.aiRange<16&&enemy.aiRange>=16&&dy<f.aiDodgeY){awayV();towardH();}
          else{towardH();if(dy>=f.aiRange)towardV();}
        }else{
          if(dy<f.aiRange){
            if(enemy.hx<56||((enemy.hx&15)<12&&(enemy.hx&15)>=4)||!(this.randomByte()&3))towardH();else oppositeH();
          }else if(f.aiRange<16&&enemy.aiRange<16){towardH();if(dy>=f.aiRange)towardV();}
          else if(f.aiRange<16&&dx<f.aiDodgeX){awayH();towardV();}
          else{towardV();if(dx>=f.aiRange)towardH();}
        }
        finish();
      };
      if(f.terrainContact&128){escape();return;}
      if(f.cooldown){
        if(enemy.weapon.active){defend();return;}
        if(f.type===14&&f.weapon.active){approach();return;}
        if(enemy.cooldown&&enemy.cooldown>=f.cooldown)approach();else defend();
        return;
      }
      if(dy<f.aiRange){
        if(Math.abs(dy-dx)<6){f.aiHorizontal=sx<0?128:64;f.aiVertical=sy<0?128:64;f.aiDelay=f.aiReaction;return;}
        if(dy<9&&dx<f.aiRange){
          const delta=(byte(enemy.hx-48)>>3)-tx;
          let clear=true;
          if(ty)for(let n=Math.abs(delta);n>0;n--)if(blocked(tx+Math.sign(delta)*n,ty)){clear=false;break;}
          if(clear){f.aiHorizontal=delta<0||!delta&&sx>0?128:64;f.aiDelay=f.aiReaction;return;}
        }else if(dx<9){
          const delta=(byte(enemy.by-32)>>4)-ty;
          let clear=true;
          if(tx)for(let n=Math.abs(delta);n>0;n--)if(blocked(tx,ty+Math.sign(delta)*n)){clear=false;break;}
          if(clear){f.aiVertical=delta<0||!delta&&sy<0?128:64;f.aiDelay=f.aiReaction;return;}
        }
      }
      approach();
    }
    ai(i){return this.computer(i);}
  }
  root.ArchonArena={Arena,field,byte,signed};
})(globalThis);
