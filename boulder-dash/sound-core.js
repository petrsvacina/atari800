/* Four native POKEY voices. Original score and sound registers, no recordings. */
(function(root){'use strict';
const poly4=Uint8Array.from([1,1,1,1,0,0,0,1,0,0,1,1,0,1,0]);
const poly5=Uint8Array.from([1,1,1,1,0,1,1,0,1,0,0,1,1,0,0,0,0,0,1,1,1,0,0,1,0,0,0,1,0,1,0]);
const poly17=new Uint8Array(131071);let lfsr=131071;for(let i=0;i<poly17.length;i++){lfsr=(lfsr>>1)|((((lfsr>>5)^lfsr)&1)<<16);poly17[i]=lfsr&1;}
class Wave{
 constructor(rate=48000){this.rate=rate;this.clock=0;this.regs=Array(9).fill(0);this.channels=Array.from({length:4},()=>({remaining:28,output:0}));this.dc=0;this.previous=0;}
 period(i){const r=this.regs,a=r[8],base=a&1?114:28;
  if(i===1&&(a&16))return (a&64)?r[0]+r[2]*256+7:(r[0]+r[2]*256+1)*base;
  if(i===3&&(a&8))return (a&32)?r[4]+r[6]*256+7:(r[4]+r[6]*256+1)*base;
  if(i===0&&(a&64)||i===2&&(a&32))return r[i*2]+4;
  return (r[i*2]+1)*base;
 }
 set(values){this.regs=Array.from(values);for(let i=0;i<4;i++)this.channels[i].remaining=Math.min(this.channels[i].remaining,this.period(i));}
 process(out){const cycles=1789790/this.rate;for(let i=0;i<out.length;i++){
  let left=cycles,value=0;
  while(left>1e-8){const dt=Math.min(left,...this.channels.map(c=>c.remaining));let mix=0;
   for(let k=0;k<4;k++){const c=this.channels[k],control=this.regs[k*2+1];mix+=(control&15)*((control&16)||c.output?1:-1);c.remaining-=dt;}
   value+=mix*dt;left-=dt;this.clock+=dt;const cycle=Math.floor(this.clock);
   for(let k=0;k<4;k++){const ch=this.channels[k];if(ch.remaining<1e-8){ch.remaining+=this.period(k);const control=this.regs[k*2+1];if(!(control&16)&&((control&128)||poly5[cycle%31])){if(control&32)ch.output^=1;else ch.output=(control&64)?poly4[cycle%15]:poly17[cycle%131071];}}}
  }
  const sample=value/cycles/60;this.dc=sample-this.previous+.995*this.dc;this.previous=sample;out[i]=this.dc*.6;
 }}
}
// POKEY's free-running 17-bit RANDOM register. Phase follows the native clock.
const randomBytes=new Uint8Array(16385);let randomRegister=131071;
for(let i=0;i<randomBytes.length;i++){randomRegister=(((randomRegister>>5^randomRegister)&255)<<9)+(randomRegister>>8);randomBytes[i]=randomRegister>>1&255;}
class Random{
 constructor(phase=Date.now()%131071){this.phase=phase;this.position=0;}
 at(cycle){const bit=((Math.floor(cycle)%131071)+131071)%131071,index=bit>>3,shift=bit&7;return(randomBytes[index]>>shift|randomBytes[index+1]<<(8-shift))&255;}
 read(clock=0){this.position=Math.max(this.position+13,Math.floor(clock));return this.at(this.phase+this.position);}
}
class Music{
 constructor(data=root.BOULDER_ORIGINAL){this.data=data;this.cursor=0;this.envelope=160;this.loops=0;this.clock=0;this.registers=[0,0,0,0,0,0,0,0,120];}
 frame(){this.clock++;
  const r=this.registers,d=this.data;if(this.envelope===160){const n=d.musicNotes,f=d.musicFrequencies;let note=n[this.cursor+1]*2;r[0]=f[note];r[2]=f[note+1];note=n[this.cursor]*2;r[4]=f[note];r[6]=f[note+1];this.cursor=(this.cursor+2)&255;if(!this.cursor)this.loops++;}
  r[7]=this.envelope+3;r[3]=(this.envelope^7)+4;this.envelope=(this.envelope+1)&167;return r;
 }
}
root.BoulderSound={Wave,Music,Random};
})(globalThis);
