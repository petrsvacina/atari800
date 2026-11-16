// POKEY's 17-bit polynomial, independent of the audio synthesis phase.
// Native reads keep the original byte distribution. CPU-cycle alignment of the
// RANDOM register is intentionally not claimed by the current port.
export class PokeyRandom {
  constructor(phase=0) {
    this.bits=new Uint8Array(16385);let value=0x1ffff;
    for(let i=0;i<this.bits.length;i++){value=((((value>>>5)^value)&255)<<9)+(value>>>8);this.bits[i]=(value>>>1)&255;}
    this.phase=((phase%131071)+131071)%131071;this.reads=0;
  }
  advance(cycles){this.phase=(this.phase+Math.floor(cycles))%131071;}
  next(){this.advance(9);this.reads++;const index=this.phase>>>3,shift=this.phase&7;return ((this.bits[index]>>>shift)|(this.bits[index+1]<<(8-shift)))&255;}
}
