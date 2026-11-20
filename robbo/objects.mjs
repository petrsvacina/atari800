/** Native translation of Robbo's named object routines. Development source map:
 * research/robbo/rules.md. No CPU, opcodes or original program runs here. */
export const WHAT = Uint8Array.from([
  0,2,0,0,2,0,2,2,2,2,2,0,0,2,2,3, 0,0,2,0,0,0,0,2,2,0,0,0,2,2,2,2,
  3,3,0,2,2,3,3,2,0,0,3,3,2,2,2,2, 2,2,2,2,2,2,2,2,2,2,2,0,2,2,2,3,
  3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,
  0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2, 2,2,2,2,2,2,0,0,0,0,0,0,2,0,0,0,
]);
export const NEXT = Uint8Array.from([98,99,100,101,102,103,32,0,106,107,108,109,42,111,112,113,114,115,116,117,58,119,97,0,0,32]);
const SURPRISE = Uint8Array.from([0,0,63,63,33,33,33,33,61,61,61,36,36,36,36,36,38,38,64,43,43,43,43,43,99,99,21,44,46,45,47,35]);
const TELEPORT_DIRECTIONS = [13,11,7,14,14,7,11,13,7,14,13,11,11,13,14,7];
const DIRECTIONS = [[0,-1],[0,1],[-1,0],[1,0]];
const BULLET = [81,82,79,80], LASER = [85,86,83,84], BLASTER = [89,90,87,88];

/** ctx: {state, test(x?,y?), put(id), randomByte(), sound(id), robbo(),
 * addScore(low,mid), afterScan?()}. x/y are working coordinates; scanX/scanY
 * retain the location being dispatched. put() must preserve bit 7 in map. */
export function createObjectEngine(ctx) {
  const s = ctx.state;
  const put = id => ctx.put(id & 255);
  const sound = id => ctx.sound(id);
  const random = () => ctx.randomByte() & 255;
  const test = (x = s.x, y = s.y) => ctx.test(x,y);
  function take() { const id=test(); put(32); return id; }
  function move(dx,dy) {
    const target = test(s.x+dx,s.y+dy);
    s.blocked=target;
    if (target!==32) return false;
    const id=take();s.x+=dx;s.y+=dy;put(id | (dx>0 || dy>0 ? 128 : 0));return true;
  }
  function direction(lm=s.lm) { for(let n=0;n<4;n++) if(!(lm & (1<<n))) return n; return -1; }
  function forward() { const n=direction();return n>=0 && move(...DIRECTIONS[n]); }
  function classify(dx,dy) { const raw=test(s.x+dx,s.y+dy), id=raw===160?0:raw&127;return {id,flags:WHAT[id]}; }
  function contact() {
    for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      if(classify(dx,dy).id!==42) continue;
      s.x+=dx;s.y+=dy;sound(10);put(97);s.x=s.scanX;s.y=s.scanY;return;
    }
  }
  function surpriseHit() { sound(10);put(110); }
  function bombHit() { put(96); }
  function bulletImpact(id,flags) {
    if(!(flags&1)) {sound(2);return;}
    if(id===64) return bombHit();
    if(id===63) return surpriseHit();
    sound(10);put(97);
  }
  function shoot(n,type=1) {
    if(n<0 || n>3)return;
    const [dx,dy]=DIRECTIONS[n], {id,flags}=classify(dx,dy);
    s.x+=dx;s.y+=dy;
    if(type===3) {
      if(id!==32 && !(flags&1))return;
      if(id===63)surpriseHit();
      if(id===64)return bombHit();
      put(BLASTER[n] | (dx>0 || dy>0 ?128:0));return;
    }
    const segment=n<2?91:93;
    if(id===32 || (type===1 && id===segment)) {
      put((type===1?BULLET[n]:LASER[n]) | (dx>0 || dy>0 ?128:0));return;
    }
    bulletImpact(id,flags);
  }
  function projectile(n,type=1) {
    const [dx,dy]=DIRECTIONS[n];
    if(type===1) {
      if(move(dx,dy))return;
      put(s.blocked===91 || s.blocked===93 ?32:102);
      shoot(n,1);return;
    }
    if(move(dx,dy)) {
      if(type===2) {
        s.x-=dx;s.y-=dy;put(n<2?91:93);
      } else {
        s.x-=dx;s.y-=dy;put(98);
      }
      return;
    }
    put(type===2?BULLET[n^1]:98);
    shoot(n,type);
  }
  function gun(n,type) {if(random()<18) {if(type===1)sound(1);shoot(n,type);} }
  function inertia(n) {
    if(move(...DIRECTIONS[n])){sound(8);return;}
    put(6);shoot(n,1);
  }
  function magnet() {
    if(s.fy!==s.y)return;
    let at=s.y*16+s.x;
    do {at++;} while(at<512 && s.map[at]===32);
    if(at>=512 || (s.map[at]&127)!==42)return;
    s.map[at]=139;s.fac=1;sound(14);
  }
  function attracted(n) {
    s.fac=1;
    if(move(...DIRECTIONS[n]))return;
    put(118);s.fac=0;sound(10);
  }
  function rotatingGun() {
    if(!(s.counter&3) && !(random()&3)) {
      const id=take(), left=!!(random()&1);
      put(left?(id===44?47:id-1):(id===47?44:id+1));return;
    }
    if(random()&7)return;
    const n=[3,1,2,0][test()-44];
    shoot(n,1);
  }
  function movingGun(n) {
    if(s.counter&1) {
      if(!move(...DIRECTIONS[n]))put(n===2?13:14);
    }
    gun(0,1);
  }
  function barrier() {
    const startX=s.x,startY=s.y,base=startY*16+startX;
    const fill=s.map[base+1]===15?15:32;
    let offset=0;
    // Original walks right until the explicit end marker ($05).
    for(let guard=0;guard<512;guard++) {
      offset++;s.x++;
      if(s.map[base+offset]===15) {
        s.x--;offset--;
        if(offset)put(15);
        offset++;s.x++;put(32);
      }
      if(s.map[base+offset]===5)break;
    }
    offset--;s.x--;
    if(fill===15) {s.map[base+offset]=15;put(15);}
  }
  function wallFollower(primary,straight,turned,blocked) {
    contact();
    if(move(...DIRECTIONS[primary])){put(turned);contact();return;}
    if(move(...DIRECTIONS[straight])){contact();return;}
    put(blocked);
  }
  function bouncer(n,turned) {
    contact();
    if(move(...DIRECTIONS[n])){contact();return;}
    put(turned);
  }
  function firingBat(n,turned) {
    contact();if(!move(...DIRECTIONS[n]))put(turned);
    contact();if(!(random()&7))shoot(1,1);
  }
  function chaser() {
    contact();
    if(!(random()&1)) {
      if(s.y!==s.fy) {
        const n=s.y>s.fy?0:1;
        if(move(...DIRECTIONS[n]))return;
      }
      if(s.x!==s.fx) {move(...DIRECTIONS[s.x<s.fx?3:2]);return;}
    }
    if(random()&32)return;
    const lm=s.lm;s.lm=TELEPORT_DIRECTIONS[random()&3];forward();s.lm=lm;
  }
  function explosion() {
    sound(0);s.x--;s.y--;
    const base=s.y*16+s.x, offsets=[0,1,2,16,17,18,32,33,34],frames=[97,98,97,98,99,98,97,98,97];
    for(let n=8;n>=0;n--) {
      const at=base+offsets[n],raw=s.map[at];
      if(raw===160)continue;
      const id=raw&127;
      if(n!==4 && !(WHAT[id]&2))continue;
      s.map[at]=id===64?224:frames[n];
    }
    s.x++;s.y++;
  }
  function surprise() {
    const id=SURPRISE[random()&31];if(id){put(id);return;}
    put(43);
    for(s.y=30;s.y>=0;s.y--)for(s.x=15;s.x>=0;s.x--) {
      const id=test()&127;
      if(id===40 || id===41)put(160);
      else if(id===124 || id===18 || id===38 || (id>=65 && id<=76))put(225);
    }
    ctx.addScore(0,5);sound(13);
  }
  function teleport() {
    if(test()!==s.tele)return;
    put(105);
    let escaped=forward();
    if(!escaped) {
      const lm=s.lm,n=direction(lm);
      // The fallback list is traversed backwards, preserving entering direction.
      for(let at=(n+1)*4-1;at>=0;at--) {
        s.lm=TELEPORT_DIRECTIONS[at];
        if(forward()){escaped=true;break;}
      }
      s.lm=lm;
    }
    if(!escaped){put(s.tele);return;}
    // MFEX: refresh destination, update the tracked robot and camera target.
    put(test());s.fx=s.x;s.fy=s.y;s.moving=0;
    ctx.teleportExit?.();
    s.x=s.scanX;s.y=s.scanY;put(s.tele);s.tele=1;
  }
  function waitingRobot() {
    if(s.scrolling)return;
    // WFAC waits a VBL and rechecks VSF. Wrapper may supply that exact check.
    if(ctx.spawnReady && !ctx.spawnReady())return;
    sound(11);put(106);
  }
  function closedExit() {
    if(s.screws)return;
    sound(13);ctx.exitFlash?.();put(21);
  }
  function openExit() {if(!(s.counter&3))put(test()^3);}
  const dispatch = Array(97).fill(null);
  Object.assign(dispatch,{
    1:()=>gun(3,3),4:()=>gun(2,3),
    7:()=>inertia(2),8:()=>inertia(3),9:()=>inertia(0),10:()=>inertia(1),
    11:()=>attracted(2),12:()=>attracted(3),13:()=>movingGun(3),14:()=>movingGun(2),
    17:barrier,20:closedExit,21:openExit,22:openExit,
    23:()=>gun(1,3),24:()=>gun(0,3),27:waitingRobot,
    28:()=>gun(0,1),29:()=>gun(1,1),30:()=>gun(2,1),31:()=>gun(3,1),
    39:()=>gun(1,2),38:chaser,40:magnet,42:()=>ctx.robbo(),
    44:rotatingGun,45:rotatingGun,46:rotatingGun,47:rotatingGun,
    58:surprise,60:()=>gun(2,2),62:()=>gun(3,2),
    65:()=>wallFollower(2,0,68,67),66:()=>wallFollower(3,1,195,68),
    67:()=>wallFollower(0,3,65,66),68:()=>wallFollower(1,2,194,65),
    69:()=>wallFollower(2,1,71,72),70:()=>wallFollower(3,0,200,199),
    71:()=>wallFollower(0,2,70,69),72:()=>wallFollower(1,3,197,70),
    73:()=>bouncer(2,202),74:()=>bouncer(3,201),
    75:()=>bouncer(0,204),76:()=>bouncer(1,203),
    77:()=>firingBat(2,78),78:()=>firingBat(3,77),
    79:()=>projectile(2,1),80:()=>projectile(3,1),81:()=>projectile(0,1),82:()=>projectile(1,1),
    83:()=>projectile(2,2),84:()=>projectile(3,2),85:()=>projectile(0,2),86:()=>projectile(1,2),
    87:()=>projectile(2,3),88:()=>projectile(3,3),89:()=>projectile(0,3),90:()=>projectile(1,3),
    94:()=>gun(0,2),96:explosion,
  });
  for(let id=48;id<=57;id++)dispatch[id]=teleport;
  function* scanSteps({wait=false}={}) {
    s.counter=(s.counter+1)&255;
    for(s.scanY=0;s.scanY<31;s.scanY++)for(s.scanX=0;s.scanX<16;s.scanX++) {
      s.x=s.scanX;s.y=s.scanY;
      const raw=test();
      if(raw&128){if(raw!==160)put(raw&127);continue;}
      if(raw>=97) {
        if(raw>122)continue;
        if(raw===109){s.tele=0;s.fac=1;}
        put(NEXT[raw-97]);continue;
      }
      if(wait&&raw===27&&!s.scrolling)yield {kind:'halt',frames:1};
      if(wait&&raw===20&&!s.screws){sound(13);ctx.exitFlash?.();yield {kind:'flash',frames:3};put(21);}
      else dispatch[raw]?.();
    }
    if(wait)yield {kind:'halt',frames:1};
    ctx.afterScan?.();
  }
  function tick(){for(const event of scanSteps()){} }
  return {tick,scanSteps,move,forward,shoot,classify,take,direction,contact,dispatch};
}
