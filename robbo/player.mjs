// Named Robbo movement, pickup and fire routines translated from the supplied XEX.
const DIRECTIONS=[[0,-1],[0,1],[-1,0],[1,0]],DEMO_DIRECTIONS=[13,11,7,14];
export function bcdAdd(a,b,carry=0){let n=(a&15)+(b&15)+carry;if(n>9)n+=6;n+=(a&240)+(b&240);if(n>159)n+=96;return {value:n&255,carry:n>255?1:0};}
export function bcdSubtract(a,b,carry=1){let n=(a&15)-(b&15)-(1-carry),borrow=n<0;if(borrow)n-=6;n+=(a&240)-(b&240);const ok=n>=0;if(!ok)n-=96;return {value:n&255,carry:ok?1:0};}
export function addScore(state,low,mid=0){let a=bcdAdd(state.score[2],low);state.score[2]=a.value;a=bcdAdd(state.score[1],mid,a.carry);state.score[1]=a.value;state.score[0]=bcdAdd(state.score[0],0,a.carry).value;}

export function createPlayer(ctx) {
  const s=ctx.state,test=()=>ctx.test(),put=id=>ctx.put(id),sound=id=>ctx.sound(id),random=()=>ctx.randomByte()&255;
  const objects=()=>ctx.objects;
  const input=()=>ctx.input?.()??s.input??{stick:15,fire:false};
  function settle() {
    put(test());s.targetAddress=0x1000+s.y*64+s.x*2;s.fx=s.x;s.fy=s.y;
    if(s.tele===1)for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const {id}=objects().classify(dx,dy);
      if(id>=65&&id<=78){sound(10);put(97);return;}
    }
    let at=s.y*16+s.x+1;
    while(at<512&&s.map[at]===32)at++;
    if(s.map[at]===41){s.fac=1;put(140);sound(14);}
  }
  function stop(){s.moving=0;settle();}
  function collect() {
    objects().take();s.x=s.scanX;s.y=s.scanY;objects().forward();settle();
  }
  function blocked(id) {
    if([14,13,63,35,20,64].includes(id)) {
      const moved=objects().forward();s.moving=moved?1:0;if(moved)sound(8);
      s.x=s.scanX;s.y=s.scanY;objects().forward();settle();return;
    }
    if(id>=48&&id<=57) {
      s.tele=id;put(id|128);s.x=s.scanX;s.y=s.scanY;sound(3);s.moving=0;put(100);return;
    }
    if(id===61) {
      s.keys=bcdAdd(s.keys,1).value;ctx.addScore(0x75,0);sound(9);collect();return;
    }
    if(s.keys&&(id===124||id===18)) {
      s.keys=bcdSubtract(s.keys,1).value;ctx.addScore(0,1);sound(6);put(122);return;
    }
    if(id===36) {
      if(!s.screws)ctx.addScore(0x50,2);
      else{s.screws=bcdSubtract(s.screws,1).value;ctx.addScore(0,1);}
      sound(4);collect();return;
    }
    if(id===21||id===22) {
      s.x=s.scanX;s.y=s.scanY;put(32);ctx.addScore(0,0x10);sound(12);s.fac=128;return;
    }
    if(id===33) {
      const next=bcdAdd(s.ammo,9);s.ammo=next.carry?0x99:next.value;
      ctx.addScore(0x50,0);sound(7);collect();return;
    }
    if(id===43) {
      s.lastLifeLevel=s.level;s.lives=bcdAdd(s.lives,1).value;ctx.addScore(0,2);sound(5);collect();return;
    }
    if(id===6&&objects().forward()) {
      const n=objects().direction();if(n>=0)put([9,138,7,136][n]);sound(8);
      s.x=s.scanX;s.y=s.scanY;objects().forward();settle();return;
    }
    s.x=s.fx;s.y=s.fy;stop();
  }
  function move() {
    let stick;
    if(s.demo) {
      if(!s.moving||!(random()&15))stick=DEMO_DIRECTIONS[random()&3];else stick=s.lm;
    }else stick=input().stick&15;
    if(stick!==15)s.lm=stick;s.moving=1;
    let n=0;while(n<4&&(stick&(1<<n)))n++;
    if(n===4){stop();return;}
    if(objects().move(...DIRECTIONS[n])){settle();return;}
    const id=s.blocked;s.x+=DIRECTIONS[n][0];s.y+=DIRECTIONS[n][1];blocked(id);
  }
  function tick() {
    if(s.tele===1)s.tele=0;s.fac=1;
    s.shotTimer=(s.shotTimer-1)&255;if(s.shotTimer&128)s.shotTimer=(s.shotTimer+1)&255;
    const fire=(s.demo&&!(random()&15))||input().fire;
    if(!fire){move();return;}
    s.moving=0;if(s.shotTimer)return;
    const stick=s.demo?s.lm:input().stick&15;if(stick===15)return;s.lm=stick;
    if(!s.ammo){s.noga=(s.noga+1)&255;return;}
    s.ammo=bcdSubtract(s.ammo,1).value;s.shotTimer=5;
    const n=objects().direction();if(n>=0){objects().shoot(n);sound(1);}
  }
  return {tick,settle,stop,blocked};
}
