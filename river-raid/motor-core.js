/* River Raid B32C-B34F: continuous channel-one POKEY noise, no CPU runtime. */
(function(root){'use strict';
const CLOCK=1789772.5,PERIOD=131071;
// Atari800 pokey.c's packed poly17 sequence. It advances at the CPU clock,
// independently of AUDF, volume, refuelling and browser audio block boundaries.
const polynomial=new Uint8Array(16385);let shift=0x1ffff;
for(let i=0;i<polynomial.length;i++){shift=((((shift>>5)^shift)&255)<<9)+(shift>>8);polynomial[i]=(shift>>1)&255;}
function bit(cycle){cycle%=PERIOD;return(polynomial[cycle>>3]>>(cycle&7))&1;}
function registers(player){return[31-(player.speed>>4),[0,0x83,0x86,0x84][player.controls&3]];}
class Wave{
 constructor(rate=48000){this.rate=rate;this.sample=0;this.clock=0;this.frequency=23;this.control=0;this.nextTick=672;this.output=0;this.previous=0;this.dc=0;this.highpass=Math.pow(.995,48000/rate);}
 set([frequency,control]){this.frequency=frequency;this.control=control;this.nextTick=Math.min(this.nextTick,Math.ceil(this.clock)+(frequency+1)*28);}
 process(out){const step=CLOCK/this.rate,period=(this.frequency+1)*28,volume=(this.control&15)/60;
  for(let i=0;i<out.length;i++){
   const end=++this.sample*step;let cursor=this.clock,sum=0;
   while(this.nextTick<=end){sum+=(this.nextTick-cursor)*(this.output?1:-1);cursor=this.nextTick;this.output=bit(this.nextTick);this.nextTick+=period;}
   sum+=(end-cursor)*(this.output?1:-1);this.clock=end;
   const value=sum/step*volume;this.dc=value-this.previous+this.highpass*this.dc;this.previous=value;out[i]=this.dc;
  }
 }
}
root.RiverMotor={Wave,registers};
})(globalThis);
