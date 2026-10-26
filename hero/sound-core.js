/* Original H.E.R.O. sound requests and a native two-voice POKEY waveform
 * generator. Only the channels/modes used by this game are needed. */
(function(root){'use strict';
function registers(s,fire=false,random=()=>0){let f0=0,c0=0,f1=0,c1=0;
 if(s.death){if(s.death>=0x96){const parity=(s.clock>>1)&1;c1=((s.death-0x60)>>4)|0xa0;f1=parity?0x1e:0x58;}}
 else if(s.rescue){if(s.power&&!((s.clock>>1)&3)){c1=0xa8;f1=0x30;}}
 else if(fire&&s.beamX<0xe0){c1=0xa5;f1=[0x18,0x1e,0x38,0x3e][s.clock&3];}
 if(s.fuses[1]||s.fuses[2]){const fuse=s.fuses[1]||s.fuses[2];if(fuse>=32){c0=random()&6;f0=0x80|c0;}else{f0=0x18;c0=fuse>>1;}}
 else if(!s.rescue&&s.power&&!(s.expired&128)){f0=(s.power>>2)^63;c0=0x84;}
 else if((s.motion&128)&&!(s.ghostContact&128)&&!s.death&&!s.rescue){f0=[0x10,0x13,0x17][s.flyFrame];c0=s.flyFrame+1;}
 return [f0,c0,f1,c1];
}
// Hardware polynomials: the phase is shared by both voices and continues
// through register changes. A register update never restarts a sample loop.
const poly5=[1,1,1,1,0,1,1,0,1,0,0,1,1,0,0,0,0,0,1,1,1,0,0,1,0,0,0,1,0,1,0];
const poly17=new Uint8Array(131071);let lfsr=131071;for(let i=0;i<poly17.length;i++){lfsr=(lfsr>>1)|((((lfsr>>5)^lfsr)&1)<<16);poly17[i]=lfsr&1;}
class Wave{
 constructor(rate=48000){this.rate=rate;this.clock=0;this.channels=[0,1].map(()=>({frequency:0,control:0,remaining:28,output:0}));this.dc=0;this.previous=0;}
 set(values){for(let i=0;i<2;i++){const ch=this.channels[i];ch.frequency=values[i*2];ch.control=values[i*2+1];ch.remaining=Math.min(ch.remaining,(ch.frequency+1)*28);}}
 process(out){const cycles=1789772.5/this.rate;for(let i=0;i<out.length;i++){
  let left=cycles,value=0;
  while(left>1e-8){const dt=Math.min(left,...this.channels.map(c=>c.remaining));let mix=0;
   for(const ch of this.channels){const level=ch.control&15;mix+=level*((ch.control&16)||ch.output?1:-1);ch.remaining-=dt;}
   value+=mix*dt;left-=dt;this.clock+=dt;const cycle=Math.floor(this.clock);
   for(const ch of this.channels)if(ch.remaining<1e-8){ch.remaining+=(ch.frequency+1)*28;const c=ch.control;if(!(c&16)&&((c&128)||poly5[cycle%31])){if(c&32)ch.output^=1;else ch.output=poly17[cycle%131071];}}
  }
  const sample=value/cycles/30;this.dc=sample-this.previous+0.995*this.dc;this.previous=sample;out[i]=this.dc*0.48;
 }}
}
root.HeroSound={registers,Wave};
})(globalThis);
