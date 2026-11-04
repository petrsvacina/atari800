// Native Fred rules. The supplied XEX is the authority; tools/fred_original.py
// executes its routines offline to check this implementation. No CPU at runtime.
const byte = n => n & 255;
const decimal = a => a.reduce((n,b,i) => n + ((b >> 4)*10+(b&15))*100**i,0);
const packed = n => Array.from({length:3},(_,i) => {const v=Math.floor(n/100**i)%100;return (Math.floor(v/10)<<4)|(v%10);});

export class Fred {
  constructor(data, level = 0, random = () => Math.floor(Math.random()*256)) {
    this.data=data; this.random=random; this.events=[]; this.ended=false;this.complete=false;
    this.load(level);this.stageFrames=0;this.spriteRows=new Uint8Array(64);this.projectileRows=new Uint8Array(32);
    this.drawHero();this.presentation=this.snapshot();
  }
  load(level, preserve = false) {
    const old=preserve?{score:this.score,highScore:this.highScore,threshold:this.threshold,lives:this.lives,
      fuel:this.fuel,hat:this.hat,shield:this.shield,boots:this.boots,weapon:this.weapon,stones:this.stones,
      inventory:this.inventory,inventoryBlink:this.inventoryBlink,triggerReleased:this.triggerReleased,
      dropQuota:this.dropQuota,bonusCountdown:this.bonusCountdown,invulnerability:this.invulnerability,
      projectileY:this.projectileY,projectileDX:this.projectileDX,flashTick:this.flashTick}:null;
    const initial=structuredClone(this.data.levels[level].initial);
    delete initial.sounds;delete initial.transitions;
    Object.assign(this,initial,old);this.level=level;
    this.speed=[...this.data.levels[level].speed];this.bonusCountdown??=32;
    this.playerColors=this.data.levels[level].colors.slice(0,4);this.flashTick??=0;
    this.hud=[...this.data.hud];this.progress=[...this.data.progress];
    this.spriteRows?.fill(0);this.projectileRows?.fill(0);
  }
  sound(id) {this.events.push({type:'sound',id});}
  snapshot() {return {terrain:[...this.terrain],camera:this.camera,scroll:this.scroll,
    phase:[...this.phase],clock:[...this.clock],level:this.level,bonus:this.bonus,tick:this.tick};}
  state() {
    const names=['chunk','camera','scroll','tick','x','y','facing','animation','motion','pose','jumpDirection','jumpPhase',
      'previousX','previousY','projectileX','projectileY','projectilePhase','projectileDX','weapon','bonus','bonusClock',
      'dying','deathBits','respawn','fuel','hat','stones','blast','shield','boots','dropQuota','level','triggerReleased',
      'lives','demo','invulnerability','terrain','inventory','inventoryBlink','phase','clock','score','highScore','threshold','playerColors'];
    return Object.fromEntries(names.map(k=>[k,Array.isArray(this[k])?[...this[k]]:this[k]]));
  }
  tile(col,row) {const raw=this.terrain[row*64+col]||0,type=raw&63;return {col,row,raw,type,kind:this.data.classes[type]};}
  put(col,row,value) {const index=row*64+col;if(index>=0&&index<512)this.terrain[index]=byte(value);}
  clear(p) {this.put(p.col,p.row,0);return p.raw;}
  probe(dx,dy,x=this.x,y=this.y) {
    // The two original additions deliberately wrap before dividing into tiles.
    let sum=x+dx+1;const fine=byte(byte(sum)-this.scroll-(sum>255?0:1));
    let vertical=byte(y-dy);if(vertical&128)vertical=0;
    const p=this.tile(byte((fine>>3)+this.camera),(vertical>>4)&7);p.fine=fine;return p;
  }
  atExit() {return this.data.milestones.includes(this.chunk)&&(this.camera&15)===15;}
  addInventory(type) {const i=this.inventory.indexOf(128);if(i>=0){this.inventory[i]=type;this.inventoryBlink[i]=128;return true;}return false;}
  consume(type) {
    const i=this.inventory.indexOf(type);if(i<0)return false;
    this.inventory.splice(i,1);this.inventory.push(128);this.inventoryBlink.splice(i,1);this.inventoryBlink.push(128);return true;
  }
  blink(type) {const i=this.inventory.indexOf(type);if(i>=0)this.inventoryBlink[i]=0;}
  addScore(value) {
    if(this.atExit())value=(value*4)&119;
    // The program accepts a packed BCD hundreds/tens argument.
    const amount=((value>>4)*10+(value&15))*10;
    this.score=packed((decimal(this.score)+amount)%1000000);
    if(decimal(this.score)>=decimal(this.threshold)) {
      this.sound(13);this.lives=byte(this.lives+1);this.threshold=packed(decimal(this.threshold)+8000);
    }
  }
  pickup(p) {
    if(p.raw===5) {
      this.clear(p);this.sound(1);this.dropQuota=Math.min(4,this.dropQuota+1);this.addScore(1);
      if(this.stones<10)this.stones++;
      else if(this.addInventory(2))this.stones=1;
      return false;
    }
    if(p.raw===7) {
      this.clear(p);this.dropQuota=Math.min(4,this.dropQuota+1);
      const type=this.bonus;
      switch(type) {
        case 0:this.sound(5);this.addScore(2);if(this.addInventory(0)&&!this.hat)this.hat=3;break;
        case 1:this.sound(8);this.addScore(3);if(!this.fuel||this.addInventory(1))this.fuel=40;
          if(this.projectilePhase&128)this.weapon=1;break;
        case 2:this.sound(2);this.addScore(2);if(!this.stones||this.addInventory(2))this.stones=10;break;
        case 3:this.blast=128;this.sound(0);this.addScore(10);break;
        case 4:this.addScore(80);this.sound(4);break;
        case 5:this.sound(6);this.addScore(2);if(this.addInventory(5)&&!this.shield)this.shield=1;break;
        case 6:this.sound(7);this.addScore(2);if(this.addInventory(6)&&!this.boots)this.boots=40;break;
        case 8:this.lives=byte(this.lives+1);this.sound(13);break;
      }
      this.bonus=128;return false;
    }
    return p.kind>=32;
  }
  verticalProbe(dy) {
    let p=this.probe(2,dy);const first=p.kind;
    if(!(p.kind&128)&&this.pickup(p))return {solid:true,p};
    p=this.probe(5,dy);
    if(p.kind&128)return {solid:false,p};
    if([30,12,13].includes(p.kind)) {
      if(p.kind===first&&(p.fine&7)===6) {this.motion=64;this.facing=3;this.sound(57);}
      return {solid:false,p};
    }
    return {solid:this.pickup(p),p};
  }
  support() {
    if(this.y&15){const hit=this.verticalProbe(24);return {...hit,solid:false};}
    if(this.y&128) {
      if(this.y>=142&&this.y<224&&(this.respawn&128))this.respawn=byte(this.respawn+1);
      return {solid:false,p:this.probe(5,0)};
    }
    this.respawn=255;const hit=this.verticalProbe(0);
    if(hit.p.kind===45&&!(this.random()&15))this.put(hit.p.col,hit.p.row,57);
    return hit;
  }
  sideBlocked(dx) {
    for(const dy of [1,16,28]){const p=this.probe(dx,dy);if(!(p.kind&128)&&this.pickup(p))return true;}
    return false;
  }
  walkAnimation() {this.animation=this.animation<7?this.animation+1:0;}
  jumpAnimation() {this.animation=this.jumpPhase<8?this.jumpPhase+8:15;}
  moveLeft() {
    if(this.motion&64||this.sideBlocked(1))return;
    if(this.x>=48){this.x=byte(this.x-1);return;}
    if(this.atExit()||this.camera===0) {if(this.x>=17)this.x=byte(this.x-1);else this.animation=0;return;}
    this.scroll=byte(this.scroll+1);if(this.scroll===16){this.camera--;this.scroll=8;}
  }
  moveRight() {
    if(this.motion&64||this.sideBlocked(6))return;
    if(this.x<104){this.x=byte(this.x+1);return;}
    if(this.atExit()){if(this.x<136)this.x++;else this.animation=0;return;}
    this.scroll=byte(this.scroll-1);
    if(!this.scroll){this.scroll=8;if(this.camera+1===33){this.loadChunks();this.camera=1;}else this.camera++;}
  }
  loadChunks() {
    let next=byte(this.chunk+2);if(!this.data.chunks[next])next=1;
    this.chunk=next;
    for(let r=0;r<8;r++) {
      for(let c=0;c<32;c++)this.terrain[r*64+c]=this.terrain[r*64+c+32];
      for(let i=0;i<2;i++) {
        const chunk=this.data.chunks[byte(next-1+i)];
        for(let c=0;c<16;c++)this.terrain[r*64+32+i*16+c]=chunk?.[r*16+c]||0;
      }
    }
  }
  down() {
    if(!(this.motion&64)){this.animation=0;return;}
    this.motion=128;
    if(this.verticalProbe(0).p.kind===32){this.motion=0;this.animation=0;this.facing=1;this.y=byte(this.y-1);return;}
    if(this.support().solid||!(this.motion&64)) {
      this.jumpPhase=128;this.motion=128;this.jumpDirection=0;this.animation=0;this.facing=1;this.fall();return;
    }
    this.y=byte(this.y+2);this.animation=this.animation<8?8:this.animation===15?8:this.animation+1;
  }
  up(direction=0) {
    this.jumpDirection=byte(direction);
    if(this.motion&64) {
      const hit=this.verticalProbe(23);
      if(direction) {
        if(hit.p.kind===32){this.motion=64;return;}
        this.facing=direction<0?2:1;
      } else {
        if(hit.solid)return;
        this.y=byte(this.y-1);if(!this.verticalProbe(23).solid)this.y=byte(this.y-1);this.walkAnimation();return;
      }
    }
    this.motion=1;this.jumpPhase=0;
  }
  jump() {
    if(this.jumpDirection)this.jumpDirection&128?this.moveLeft():this.moveRight();
    this.jumpAnimation();const steps=this.data.jumpCurve[this.jumpPhase];
    if(steps&128){this.jumpPhase=128;if(!(this.motion&64))this.motion=128;return;}
    for(let i=0;i<=steps;i++) {
      this.y=byte(this.y-1);
      if(this.verticalProbe(23).solid){this.jumpPhase=128;if(!(this.motion&64))this.motion=128;return;}
    }
    this.jumpPhase=byte(this.jumpPhase+1);
  }
  fall() {
    if(!(this.respawn&128))return;
    if(this.support().solid){if(!(this.motion&64))this.motion=0;return;}
    if(this.boots&&(this.y&128)&&this.y<152) {
      this.y=128;this.boots=byte(this.boots-1);
      if(this.boots) {if(this.boots===15)this.blink(6);if(!(this.motion&64))this.motion=0;return;}
      if(this.consume(6)&&this.inventory.includes(6)){this.boots=40;if(!(this.motion&64))this.motion=0;return;}
    }
    if(this.motion&64)return;
    this.motion=128;
    if(this.jumpPhase===128){let i=10;while(!(this.data.jumpCurve[i]&128)&&i<35)i++;this.jumpPhase=i+1;}
    this.jumpAnimation();const steps=this.data.jumpCurve[this.jumpPhase]??16;
    for(let i=0;i<=steps;i++){this.y=byte(this.y+1);if(this.support().solid){if(!(this.motion&64))this.motion=0;return;}}
    this.jumpPhase=byte(this.jumpPhase+1);
    if(this.jumpDirection)this.jumpDirection&128?this.moveLeft():this.moveRight();
  }
  selectWeapon(value) {
    this.animation=0;
    if(value!==this.weapon&&(value?this.fuel:this.stones)&&(this.projectilePhase&128)) {
      this.weapon=value;this.sound(57);this.sound(14);
    }
  }
  controls(stick,fire) {
    if(!this.motion)this.walkAnimation();
    if(!this.dying) {
      if(this.motion&&!(this.motion&64))this.motion&128?this.fall():this.jump();
      else {
        const masks=[15,7,11,14,13,6,10,5,9],which=masks.indexOf(stick);
        if(which>=0) {
          if(!(this.motion&64)){if(!(stick&4))this.facing=2;if(!(stick&8))this.facing=1;}
          if(which===0)this.animation=0;
          switch(which) {
            case 1:this.moveRight();break;case 2:this.moveLeft();break;case 3:this.up();break;
            case 4:this.down();break;case 5:this.up(1);break;case 6:this.up(-1);break;
            case 7:this.selectWeapon(0);break;case 8:this.selectWeapon(1);break;
          }
        }
      }
    }
    if(fire)this.fire();this.triggerReleased=Number(!fire);
    this.pose=byte(this.facing*32+this.animation*2);
    if(!this.motion){this.jumpPhase=128;this.jumpDirection=0;this.fall();}
  }
  projectileOrigin() {
    const p=this.probe(this.facing===1?6:1,1);p.col+=this.facing===1?1:-1;
    this.projectileX=byte(this.previousX+(this.facing===1?(this.weapon?7:5):(this.weapon?-7:-4)));
    this.projectileY=byte(this.previousY+10);return p;
  }
  drawProjectile(frame,noise=false) {
    const sprites=this.spriteData;this.projectileRows.fill(0);
    for(let i=0;i<16;i++) {
      let a=sprites[frame*16+i],b=sprites[1024+frame*16+i];
      if(noise){a&=this.random()&this.random()&this.random();b&=this.random()&this.random();}
      this.projectileRows[i]=a;this.projectileRows[16+i]=b;
    }
    this.renderProjectileX=this.projectileX;this.renderProjectileY=this.projectileY;
  }
  clearProjectile() {this.projectileX=220;this.projectilePhase=128;this.sound(10);}
  projectile(fire,mask) {
    if(!fire)this.sound(57);
    if(this.weapon){this.projectileX=220;return;}
    if(this.projectilePhase&128)return;
    if(this.projectileX<12||this.projectileX>=140||this.projectileY>=160){this.clearProjectile();return;}
    let p=this.probe(3,24,this.projectileX,this.projectileY);
    if(mask&&p.kind!==30&&p.kind!==29) {
      if(p.kind===128) {
        const a=this.tile(p.col-1,p.row);if((a.kind&191)&&((a.kind&191)<5)){this.clearProjectile();this.addScore(5);this.kill(a);return;}
        const b=this.tile(p.col+1,p.row);if((b.kind&191)&&((b.kind&191)<5)){this.clearProjectile();this.addScore(5);this.kill(b);return;}
      } else {
        this.clearProjectile();if(p.kind===16)this.breakPot(p);
        if(p.kind<14){this.clearProjectile();this.addScore(5);this.kill(p);return;}
      }
    }
    this.projectileX=byte(this.projectileX+this.projectileDX);
    let delta=this.projectilePhase===128?this.data.stoppedRockDelta:this.data.rockCurve[this.projectilePhase];
    const carry=delta>=128?1:0;this.projectilePhase=byte(this.projectilePhase+1);
    if(delta===128){this.projectilePhase=byte(this.projectilePhase-1);delta=6;}
    // CMP #$80 leaves carry set for the negative half of the original arc.
    this.projectileY=byte(this.projectileY+delta+carry);
    this.drawProjectile(63);
  }
  fire() {
    if(this.facing===3||this.dying||!(this.projectilePhase&128))return;
    if(!this.weapon) {
      if(!this.stones||!this.triggerReleased)return;
      this.stones--;if(!this.stones&&this.consume(2))this.stones=10;
      if(!this.facing||this.facing>=3)return;
      this.projectileDX=this.facing===1?2:254;this.projectileOrigin();this.projectilePhase=0;this.drawProjectile(63);return;
    }
    if(!this.fuel||!--this.fuel) {
      if(this.consume(1)){this.fuel=40;return;}
      this.weapon=0;this.sound(41);return;
    }
    this.sound(25);const p=this.projectileOrigin();this.drawProjectile(60+this.facing,true);
    if(!this.projectileCollision)return;
    const target=(col,row)=>{const q=this.tile(col,row);if(q.kind===16)this.breakPot(q);else if(q.kind<14){this.addScore(5);this.kill(q);}};
    target(p.col+(this.facing===1?-1:1),p.row);target(p.col,p.row);target(p.col,p.row-1);
  }
  breakPot(p) {
    if(p.type!==6)return;
    this.bonusClock=0;this.sound(15);
    let type=0;
    if(this.inventory.includes(0)||(this.random()&(this.level<3?7:3))) {
      const table=[...this.data.bonusDistribution];table.fill(this.data.bonusByLevel[this.level],0,4);
      do {type=table[this.random()&15];}while((!this.level&&type===6)||this.inventory.filter(v=>v===type).length>=2);
    }
    // Hat rarity also observes the inventory limit in the original retry loop.
    this.bonus=type;this.put(p.col,p.row,type===9?5:type===4?199:71);
  }
  protection(mask) {
    if(this.dying)return;
    const normal=()=>{this.playerColors=this.data.levels[this.level].colors.slice(0,4);};
    const flash=()=>{this.playerColors[0]=(this.playerColors[0]&240)|8;};
    if(this.shield) {
      if(this.tick&1)normal();else flash();
      this.shield=byte(this.shield+1);
      if(this.shield){if(this.shield===200)this.blink(5);return;}
      if(this.consume(5)&&this.inventory.includes(5)){this.shield=1;return;}
    }
    this.dying=mask&8;
    if(this.invulnerability){this.invulnerability--;if(this.flashTick&1)normal();else flash();this.flashTick=byte(this.flashTick+1);}
    else {this.flashTick=0;normal();}
    if(!this.dying)return;
    if(this.invulnerability){this.dying=0;return;}
    if(this.hat)this.hat--;
    if(!this.hat) {
      if(!this.consume(0)){this.dying=byte(this.dying+1);return;}
      this.invulnerability=32;if(this.inventory.includes(0))this.hat=3;
    } else {this.invulnerability=32;if(this.hat===1)this.blink(0);}
    this.dying=0;
  }
  kill(p) {this.sound(this.blast&128?0:15);this.phase[15]=0;this.clear(p);this.put(p.col,p.row,[12,13].includes(p.kind)?56:95);}
  actorReady(group) {return this.phase[group]===3&&(this.tick&this.speed[group])===this.speed[group];}
  actors() {
    for(let index=0;index<512;index++) {
      const raw=this.terrain[index];let masked=raw&127;if(!masked)continue;
      if(masked>=64){masked=this.terrain[index]=raw&191;if(!(this.blast&128))continue;}
      if(masked>=32)continue;
      const p=this.tile(index&63,index>>6),g=p.type&15;
      if(this.blast&128&&p.kind<14){this.kill(p);continue;}
      const ready=()=>this.actorReady(g);
      const adjacent=(dx,dy)=>this.tile(p.col+dx,p.row+dy);
      const clear=(dx,dy)=>{if(dx<0&&(p.col===0||p.col===32)||dx>0&&p.col===31||dy<0&&p.row===0)return false;return !!(adjacent(dx,dy).kind&128);};
      const move=(dx,dy,horizontal=false)=>{
        if(!clear(dx,dy))return true;
        if(!ready()||horizontal&&!(this.clock[g]&1))return false;
        this.clear(p);p.col+=dx;p.row+=dy;this.put(p.col,p.row,p.raw|((dx>0||dy>0)?64:0));return false;
      };
      const ledge=dx=>(adjacent(dx,1).kind&240)!==32;
      const drop=()=>{
        if((p.row===0||p.row===2)&&!(this.random()&31)&&this.phase[g]===0&&clear(0,1))this.put(p.col,p.row+1,216);
      };
      switch(p.type) {
        case 1:if(!(this.random()&127))this.put(p.col,p.row,2);break;
        case 2:if(!(this.random()&3)&&this.phase[10]===0&&clear(0,-1)&&(this.tile(p.col,p.row-2).kind&128)) {
          this.put(p.col,p.row-1,154);this.put(p.col,p.row,1);
        }break;
        case 3:case 15:if(this.phase[7]===0&&!(this.random()&15)&&clear(0,1)&&(this.tile(p.col,p.row+2).kind&128))this.put(p.col,p.row+1,215);break;
        case 7:if(!this.bonusClock)this.kill(p);break;
        case 16:if(ready())this.clear(p);break;
        case 17:drop();if(move(-1,0,true))this.put(p.col,p.row,214);break;
        case 18:drop();if(move(1,0,true))this.put(p.col,p.row,214);break;
        case 19:if(ledge(1)||move(1,0,true))this.put(p.col,p.row,213);break;
        case 20:if(ledge(-1)||move(-1,0,true))this.put(p.col,p.row,213);break;
        case 21:case 22: {
          if(p.type===22)drop();const left=!!(this.random()&128);
          if(p.type===21&&ledge(left?-1:1))break;
          if(!clear(left?-1:1,0))break;
          if(ready()&&(this.clock[g]&1))this.put(p.col,p.row,left?(p.type===21?212:209):(p.type===21?211:210));
        }break;
        case 23:if(move(0,1)){const kind=adjacent(0,1).kind;if(kind===0||kind===7)this.clear(p);else if(ready())this.put(p.col,p.row,16);}break;
        case 24:if(move(0,1)&&ready())this.clear(p);break;
        case 25:if(move(0,1)&&ready())this.put(p.col,p.row,219);break;
        case 26:if(move(0,-1)&&ready())this.clear(p);break;
        case 27:if(move(0,-1)&&ready())this.put(p.col,p.row,217);break;
        case 28:if(ready()){if(adjacent(0,1).raw===56){this.put(p.col,p.row,56);this.put(p.col,p.row+1,220);}else this.put(p.col,p.row,157);}break;
        case 29:if(ready()){if(adjacent(0,-1).raw===56){this.put(p.col,p.row,56);this.put(p.col,p.row-1,157);}else this.put(p.col,p.row,156);}break;
        case 31:if(this.actorReady(15))this.clear(p);break;
      }
    }
    this.blast=0;
  }
  randomDrop() {
    if(!this.atExit()){this.dropQuota=4;this.bonusCountdown=32;return;}
    if(!this.bonusCountdown||!this.dropQuota||(this.random()&31))return;
    // Source retries RANDOM until it finds empty air above a plain platform.
    for(;;) {
      const col=(this.random()&15)|16;let row=this.random()&7;
      if(this.tile(col,row).kind!==128)continue;
      while(row<7&&this.tile(col,row+1).kind===128)row++;
      if(row>=7||this.tile(col,row+1).kind!==32)continue;
      const type=(this.random()&15)?5:6;this.dropQuota--;this.put(col,row,type);this.sound(10);return;
    }
  }
  updateHud() {
    if(this.atExit()&&!(this.tick&31)) {
      this.sound(4);const n=((this.bonusCountdown>>4)*10+(this.bonusCountdown&15)+99)%100;
      this.bonusCountdown=byte((Math.floor(n/10)<<4)|(n%10));if(!this.bonusCountdown)this.dying=1;
    }
    this.lives=Math.min(10,this.lives);
    for(let i=0;i<8;i++)if(!(this.inventoryBlink[i]&128))this.inventoryBlink[i]=(this.inventoryBlink[i]||2)>>1;
    if(decimal(this.score)>=decimal(this.highScore))this.highScore=[...this.score];
  }
  get spriteData() {return this._sprites||=Uint8Array.from(atob(this.data.sprites),c=>c.charCodeAt(0));}
  drawHero() {
    this.spriteRows.fill(0);const s=this.spriteData;
    for(let half=0;half<2;half++) {
      const frame=this.data.heroFrames[this.pose+(half?0:1)];
      for(let row=0;row<16;row++){this.spriteRows[half*16+row]=s[frame*16+row];this.spriteRows[32+half*16+row]=s[1024+frame*16+row];}
    }
    this.previousX=this.x;this.previousY=this.y;this.renderHeroX=this.x;this.renderHeroY=this.y;
  }
  loseLife() {
    if(this.atExit())this.lives=byte(this.lives+1);
    this.lives=byte(this.lives-1);
    if(this.atExit()){this.nextLevel();return true;}
    if(this.lives&128){this.ended=true;this.events.push({type:'gameover'});return true;}
    const lives=this.lives,score=this.score,highScore=this.highScore,threshold=this.threshold,
      dropQuota=this.dropQuota,bonusCountdown=this.bonusCountdown,triggerReleased=this.triggerReleased,
      projectileY=this.projectileY,projectileDX=this.projectileDX;
    this.load(this.level);Object.assign(this,{lives,score,highScore,threshold,dropQuota,bonusCountdown,triggerReleased,projectileY,projectileDX});
    this.phase.fill(0);this.clock.fill(0);this.sound(57);this.events.push({type:'death'});return false;
  }
  nextLevel() {
    if(this.level===9){this.complete=true;this.ended=true;this.events.push({type:'complete'});return;}
    const hud=this.hudState||this,scroll=this.scroll;
    this.load(this.level+1,true);this.stageFrames=116;this.stageTick=0;this.stageHud=hud;this.stageScroll=scroll;
    this.stageCells=this.data.hud.slice(96,149);while(this.stageCells.length<53)this.stageCells.push(0);
    const digit=(value,index)=>{let glyph=(value&15)|16;if(glyph>=21)glyph+=27;glyph*=2;this.stageCells[index]=glyph;this.stageCells[index+1]=glyph|1;};
    this.stageCells[47]=this.stageCells[48]=0;
    if(this.level===9){digit(1,45);digit(0,47);}else digit(this.level+1,45);
    this.phase.fill(0);this.clock.fill(0);this.events.push({type:'level',level:this.level});
  }
  advanceStage(stick=15,fire=false) {
    this.events=[];if(!this.stageFrames)return this.events;
    this.stageTick++;this.stageFrames--;
    if(this.stageTick<=22)for(let i=0;i<50;i++)this.stageCells[i]=this.stageCells[i+1];
    if(this.stageTick===22)this.sound(12);
    if(this.stageTick>73&&this.stageTick<=95)for(let i=50;i>=0;i--)this.stageCells[i+1]=this.stageCells[i];
    if(!this.stageFrames){
      this.sound(57);this.projectile(fire,0);this.protection(0);this.controls(stick,fire);this.actors();
      // The source clears its character display before returning to the main
      // loop. Keep that blank frame instead of flashing the previous scenery.
      this.presentation=this.snapshot();this.presentation.terrain.fill(0);
    }
    return this.events;
  }
  sprite() {
    if(!(this.respawn&128)) {
      if(!this.respawn)this.sound(3);
      this.spriteRows.fill(0);const frame=this.data.deathFrames[this.respawn];this.respawn++;
      if(this.respawn>=8)return this.loseLife();
      for(let i=0;i<16;i++){this.spriteRows[i]=this.spriteData[frame*16+i];this.spriteRows[32+i]=this.spriteData[1024+frame*16+i];}
      this.renderHeroY=130;return false;
    }
    if(this.dying) {
      if(this.atExit()&&!this.bonusCountdown)return this.loseLife();
      if(!this.deathBits)this.sound(11);
      this.deathBits=0;for(let row=0;row<32;row++)for(const i of[row,row+32]){
        this.spriteRows[i]&=this.random();if(this.spriteRows[i])this.deathBits=this.spriteRows[i];
      }
      if(!this.deathBits)return this.loseLife();return false;
    }
    this.drawHero();return false;
  }
  frame(stick=15,fire=false,collisions={hero:0,projectile:0}) {
    this.events=[];if(this.ended)return this.events;
    if(this.stageFrames)return this.events;
    this.bonusClock=byte(this.bonusClock+2);this.tick=byte(this.tick+1);
    for(let g=0;g<16&&!(this.speed[g]&128);g++)if(!(this.speed[g]&this.tick)) {
      this.phase[g]++;if(this.phase[g]===4){this.phase[g]=0;this.clock[g]=byte(this.clock[g]+1);}
    }
    this.presentation=this.snapshot();this.updateHud();
    this.hudState={level:this.level,tick:this.tick,chunk:this.chunk,camera:this.camera,weapon:this.weapon,fuel:this.fuel,stones:this.stones,
      lives:this.lives,bonusCountdown:this.bonusCountdown,score:[...this.score],highScore:[...this.highScore],
      inventory:[...this.inventory],inventoryBlink:[...this.inventoryBlink],atExit:()=>this.data.milestones.includes(this.presentation.chunk)&&(this.presentation.camera&15)===15};
    this.randomDrop();
    if(this.sprite())return this.events;
    this.projectileCollision=collisions.projectile||0;
    this.projectile(fire,this.projectileCollision);this.protection(collisions.hero||0);this.controls(stick,fire);this.actors();
    return this.events;
  }
}
