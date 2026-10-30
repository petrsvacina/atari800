/* Continuous effect 8: original joined 16-bit POKEY noise registers.
 * The polynomial/counter phase persists across audio blocks; no PCM loop. */
(function(root){'use strict';
const CLOCK=1789790,PERIOD=131071,divider=0x076c+7;
const poly5=[1,1,1,1,0,1,1,0,1,0,0,1,1,0,0,0,0,0,1,1,1,0,0,1,0,0,0,1,0,1,0],poly17=new Uint8Array(16385);let register=0x1ffff;
for(let i=0;i<poly17.length;i++){register=((((register>>5)^register)&255)<<9)+(register>>8);poly17[i]=(register>>1)&255;}
function noise(cycle){cycle%=PERIOD;return poly17[cycle>>3]>>(cycle&7)&1;}
class Wave{
 constructor(rate=48000){this.rate=rate;this.sample=0;this.clock=0;this.next=divider;this.output=0;this.active=false;this.previous=0;this.dc=0;this.highpass=Math.pow(.995,48000/rate);}
 set(active){this.active=Math.max(0,Math.min(2,Number(active)));}
 process(out){const step=CLOCK/this.rate;
  for(let i=0;i<out.length;i++){
   const end=++this.sample*step;let cursor=this.clock,sum=0;
   while(this.next<=end){sum+=(this.next-cursor)*(this.output?1:-1);cursor=this.next;if(poly5[this.next%31])this.output=noise(this.next);this.next+=divider;}
   sum+=(end-cursor)*(this.output?1:-1);this.clock=end;const value=sum/step*.05;this.dc=value-this.previous+this.highpass*this.dc;this.previous=value;out[i]=this.dc*this.active;
  }
 }
}
root.KaratekaNoise={Wave};
})(globalThis);
