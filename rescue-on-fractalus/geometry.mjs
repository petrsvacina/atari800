import {word,signedWord,signedFraction,makeTrigonometry} from './math.mjs';
const s8=value=>(value<<24)>>24;

// The original 45-cell view traversal, expressed as vectors and map coordinates.
export class ViewGeometry {
  constructor(tables,trigonometry) {
    this.tables=tables;
    this.headingVector=makeTrigonometry(trigonometry);
    this.u=new Uint16Array(46);
    this.depth=new Uint16Array(46);
    this.height=new Uint16Array(45);
    this.mapIndex=new Uint8Array(45);
    this.mapHeight=new Uint8Array(45);
    this.visibility=new Uint8Array(45);
    this.spans=new Uint8Array(32);
    this.x=new Uint16Array(45);
    this.y=new Uint16Array(45);
  }
  setup(camera,map) {
    const {sin,cos}=this.headingVector(camera.heading);
    const worldX=(camera.x&65535)>>>4,worldZ=(camera.z&65535)>>>4;
    this.u[0]=signedFraction(worldZ&255,sin)-signedFraction(worldX&255,cos);
    this.depth[0]=-(signedFraction(worldZ&255,cos)+signedFraction(worldX&255,sin));
    const steep=(camera.altitude>>>8)>=64;
    const altitude=steep?0xff00|(camera.altitude&255):word(camera.altitude<<2);
    const direction=((camera.heading>>>8)<<2)|(steep?2:0)|((camera.heading>>>15)&1);
    const pattern=this.tables.patterns[(direction>>>6)&3];
    let row=((worldZ>>>8)&15)<<4,column=(worldX>>>8)&15;
    for(let i=0;i<45;i++) {
      const step=pattern[i];
      let u=this.u[i],depth=this.depth[i];
      if(step&128) {
        row=(row-16)&255;u+=sin;depth-=cos;
        if(step&64){column--;u-=cos;depth-=sin;}
        else if(step&32){column++;u+=cos;depth+=sin;}
      } else if(step&64) {
        row=(row+16)&255;u-=sin;depth+=cos;
        if(step&32){column--;u-=cos;depth-=sin;}
        else if(step&16){column++;u+=cos;depth+=sin;}
      } else if(step&32) {
        column--;u-=cos;depth-=sin;
      } else if(step&16) {
        column++;u+=cos;depth+=sin;
      } else {
        // Only the first cell of quadrant zero has an empty traversal step.
        u=this.u[0];depth=this.depth[0];
      }
      this.u[i+1]=u;this.depth[i+1]=depth;
      const index=row|(column&15),height=map[index],altLow=altitude&255;
      this.mapIndex[i]=index;this.mapHeight[i]=height;
      const difference=height-(altitude>>>8)-(altLow?1:0);
      let projected=((difference&255)<<8)|((-altLow)&255);
      projected>>>=4;
      if(difference<0)projected^=0xf000;
      this.height[i]=projected;
      const z=this.depth[i+1],x=signedWord(this.u[i+1]);
      this.visibility[i]=(z&0x8000)||z<32?128:Math.abs(x)<z?0:x<0?64:32;
    }
    // Clip front-facing/behind-camera neighbours at the original near plane.
    const order=this.tables.order;
    for(let i=0;i<12;i+=2) {
      const a=order[i],b=order[i+1],av=this.visibility[a],bv=this.visibility[b];
      const index=av===0&&(bv&128)?b:(av&128)&&bv===0?a:-1;
      if(index>=0){this.depth[index+1]=32;this.visibility[index]=0;}
    }
    const pitch=word(camera.pitch<<2),centre=(6-(pitch>>>8))&255;
    const shear=signedWord(camera.roll)>>1;
    for(let row=0;row<32;row++)this.spans[row]=Math.floor(((centre<<8)+(row-16)*shear)/256);
    return this;
  }
  project(index) {
    const depth=this.depth[index+1];
    const x=projectAxis(this.u[index+1],depth),y=projectAxis(this.height[index],depth);
    const high=x>>>8;
    const offset=high&128?this.spans[0]:high?this.spans[31]:this.spans[(x&255)>>>3];
    this.x[index]=x;
    this.y[index]=y+s8(offset);
    this.visibility[index]|=16;
    return [this.x[index],this.y[index]];
  }
}

export function projectAxis(numerator,divisor) {
  const signed=signedWord(numerator),negative=signed<0,magnitude=Math.abs(signed);
  let doubles=0;
  while(magnitude>=divisor&&doubles<8){divisor=word(divisor<<1);doubles++;}
  if(doubles===8)return negative?0xc000:0x4000;
  const quotient=Math.floor(256*magnitude/divisor)&255;
  let distance;
  if(doubles===0)distance=(((quotient>>>1)+quotient+1)>>>2)&127;
  else {const scaled=word(quotient<<doubles);distance=(scaled+(scaled>>>1))>>>2;}
  return word(128+(negative?-distance:distance));
}
