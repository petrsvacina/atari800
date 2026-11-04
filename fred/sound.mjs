// Original four-channel effect allocator, envelopes and repeat/stop semantics.
export class Effects {
  constructor(data) {this.data=data;this.envelopes=data.envelopes.flat();this.voices=Array.from({length:4},()=>({value:0,remaining:0,period:0}));this.registers=new Uint8Array(8);}
  clear(i) {
    if(i<0) {
      // The supplied program's STOP with no active matching voice writes just
      // beyond its voice table. Preserve its three resulting envelope bytes.
      this.envelopes[0x11cd-0x10ea]=0;this.envelopes[0x11d1-0x10ea]=1;this.envelopes[0x11d5-0x10ea]=0;return;
    }
    Object.assign(this.voices[i],{remaining:1,period:0,value:0});
  }
  request(command) {
    if(command&128){this.voices.forEach((v,i)=>{this.clear(i);v.remaining=0;});this.registers.fill(0);return;}
    const id=command&15,loop=!!(command&16),stop=!!(command&32),tag=id<<4;
    let i;
    if(loop) {
      i=3;while(i>=0&&!(this.voices[i].value>>4===id&&(this.voices[i].period&128)))i--;
      if(i>=0||stop){if(stop)this.clear(i);return;}
    }
    i=3;while(i>=0&&!(this.voices[i].value>>4===id&&(this.voices[i].period&128)))i--;
    if(i>=0){this.clear(i);return;}
    i=3;while(i>=0&&((this.voices[i].period&128)||this.voices[i].value))i--;
    if(i<0) {
      let lowest=15;
      for(let j=3;j>=0;j--)if(!(this.voices[j].period&128)&&(this.voices[j].value&15)<lowest){lowest=this.voices[j].value&15;i=j;}
      if(i<0)return;
    }
    Object.assign(this.voices[i],{remaining:this.data.timing[id],period:this.data.timing[id]|(loop?128:0),value:tag|15});
  }
  tick() {
    for(let i=3;i>=0;i--) {
      const v=this.voices[i];let ended=!v.remaining;
      if(!ended) {
        const at=v.value*2,control=this.envelopes[at];ended=control===255;
        if(!ended){this.registers[i*2+1]=control;this.registers[i*2]=this.envelopes[at+1];
          if(!--v.remaining){v.remaining=v.period&15;if(v.value&15)v.value--;else if(v.period&128){v.value|=15;v.remaining=v.period&15;}else Object.assign(v,{value:0,period:0,remaining:0});}
        }
      }
      if(ended) {
        if(v.period&128){v.value|=15;v.remaining=v.period&15;}
        else {this.registers[i*2]=0;this.registers[i*2+1]=0;Object.assign(v,{value:0,period:0,remaining:0});}
      }
    }
    return [...this.registers];
  }
}

const makePolynomial=(bits,tap)=>{const a=new Uint8Array(2**bits-1);let n=2**bits-1;for(let i=0;i<a.length;i++){n=(n>>1)|((((n>>tap)^n)&1)<<(bits-1));a[i]=n&1;}return a;};
const poly4=makePolynomial(4,1),poly5=makePolynomial(5,2),poly17=makePolynomial(17,5);
export class Wave {
  constructor(rate=48000) {this.rate=rate;this.clock=0;this.previous=0;this.dc=0;this.highpass=Math.pow(.995,48000/rate);this.voices=Array.from({length:4},()=>({frequency:0,control:0,remaining:28,output:0}));}
  set(values) {for(let i=0;i<4;i++){const c=this.voices[i];c.frequency=values[i*2];c.control=values[i*2+1];c.remaining=Math.min(c.remaining,(c.frequency+1)*28);}}
  process(out) {
    const cycles=1773447/this.rate;
    for(let i=0;i<out.length;i++) {
      let left=cycles,value=0;
      while(left>1e-8) {
        const dt=Math.min(left,...this.voices.map(c=>c.remaining));let mix=0;
        for(const c of this.voices){mix+=(c.control&15)*((c.control&16)||c.output?1:-1);c.remaining-=dt;}
        value+=mix*dt;left-=dt;this.clock+=dt;const phase=Math.floor(this.clock);
        for(const c of this.voices)if(c.remaining<1e-8) {
          c.remaining+=(c.frequency+1)*28;
          if(!(c.control&16)&&((c.control&128)||poly5[phase%31])) {
            if(c.control&32)c.output^=1;else c.output=(c.control&64)?poly4[phase%15]:poly17[phase%131071];
          }
        }
      }
      const sample=value/cycles/60;this.dc=sample-this.previous+this.highpass*this.dc;this.previous=sample;out[i]=this.dc*.65;
    }
  }
}
