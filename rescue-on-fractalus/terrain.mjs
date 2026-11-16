import {word,signedWord} from './math.mjs';

function midpoint(a,b) {
  const x=word(a.x+b.x+1),y=word(a.y+b.y+1),fraction=a.fraction+b.fraction+1;
  const point={x:(x>>>1)|(x&0x8000),y:(y>>>1)|(y&0x8000),fraction:fraction&255};
  if(point.fraction&128) {
    const displacement=word(point.x-a.x)>>>1;
    point.y=word(point.y+(fraction&256?displacement:-displacement));
  }
  return point;
}
const lowHeight=p=>(p.y&0x8000)!==0||p.y<108;
const clampHeight=y=>y>255?(y&0x8000?0:255):y;

export class TerrainRaster {
  constructor(geometry,tables) {
    this.geometry=geometry;
    this.tables=tables;
    this.field=new Uint8Array(48*48);
    this.skyline=new Uint8Array(256);
  }
  reset(options={}) {
    this.field.fill(0);
    if(this.tables.border)for(let row=0;row<48;row++) {
      this.field.set(this.tables.border.slice(row*6,row*6+3),row*48);
      this.field.set(this.tables.border.slice(row*6+3,row*6+6),row*48+45);
    }
    // The four canopy/HUD rows share the original terrain buffers. They are
    // preserved by the body clear, apart from these explicitly cleared cells.
    this.field.set(this.tables.band,44*48);
    if(options.horizonCells)for(let i=0;i<80;i++) {
      const offset=0x2159+i-0x1010,row=Math.floor(offset/96),column=offset%96-(options.half||0);
      if(column>=0&&column<48)this.field[row*48+column]=options.horizonCells[i];
    }
    const cells=[0x2090,0x2091,0x2092,0x2093,0x2094,0x20ba,0x20b9,0x20b8,0x20b7,0x20b6,0x20b5,
                 0x20f0,0x20f1,0x20f2,0x20f3,0x211a,0x2119,0x2118,0x2117,0x2116,
                 0x2150,0x2151,0x2152,0x217a,0x2179,0x2178,0x2177,0x21b0,0x21da,0x21b1,0x21d9,0x21d8];
    for(const address of cells) {
      const offset=address+3-0x1010,row=Math.floor(offset/96),column=offset%96;
      if(column<48)this.field[row*48+column]=0;
    }
    this.skyline.fill(255);
    this.skyline.fill(103,44,212);
    this.skyline.fill(107,64,196);
    this.work={midpoints:0,ridges:0,pixels:0};
  }
  ridge(column,height) {
    if(height<=this.skyline[column])return;
    this.skyline[column]=height>=151?255:height;
    height=Math.min(height,151);
    this.plot(column,height,2);
    this.work.ridges++;
  }
  plot(column,height,value) {
    const row=151-height,offset=(column-32)>>>2;
    if(row<0||row>=48||offset>=48)return;
    this.field[row*48+offset]|=value<<(6-2*(column&3));
    this.work.pixels++;
  }
  leaf(start,end) {
    let x=start.x&255,y=start.y&255,fraction=start.fraction;
    const columns=[end.x&255],heights=[clampHeight(end.y)],fractions=[end.fraction];
    if(columns[0]<45||columns[0]<x)return {x,y,fraction};
    if(columns[0]===x){this.ridge(x,heights[0]);return {x,y,fraction};}
    let depth=0;
    // Clip the left end before tracing the visible ridge. The original uses
    // distinct rounding here and in the subsequent interior subdivision.
    while(x<44) {
      const middle=(x+columns[depth])>>>1,sum=fraction+fractions[depth]+1,average=(y+heights[depth])>>>1;
      let height=average;
      if(middle<=44) {
        x=middle;fraction=sum&255;
        if(fraction&128) {
          const displacement=((columns[depth]-x)&255)>>>1;
          height=sum&256?Math.min(255,average+displacement):Math.max(0,average-displacement);
        }
        y=height;
      } else {
        if(sum&128) {
          const displacement=((middle-x)&255)>>>1;
          height=sum&256?Math.min(255,average+displacement):Math.max(0,average-displacement);
        }
        depth++;columns[depth]=middle;heights[depth]=height;fractions[depth]=sum&255;
      }
    }
    let column=x;
    while(column<212) {
      x=column;
      const gap=(column-columns[depth])&255;
      if(gap===254) {
        this.ridge(column,(heights[depth]+y+1)>>>1);column++;
        y=heights[depth];this.ridge(column,y);column++;
        if(depth===0)break;
        fraction=fractions[depth];depth--;
      } else if(gap===255) {
        y=heights[depth];this.ridge(column,y);column++;
        if(depth===0)break;
        fraction=fractions[depth];depth--;
      } else {
        const middle=(column+columns[depth])>>>1;
        const sum=fraction+fractions[depth]+1,heightSum=y+heights[depth],average=heightSum>>>1;
        let height=average;
        if(sum&128) {
          if(sum&256) {
            const displacement=((middle-x)&255)>>>1;
            height=Math.min(255,average+displacement+(heightSum&1));
          } else {
            const displacement=((middle-x-1)&255)>>>1;
            const result=average+(255^displacement)+(heightSum&1);
            height=result>255?result&255:0;
          }
        }
        depth++;columns[depth]=middle;heights[depth]=height;fractions[depth]=sum&255;
      }
    }
    return {x,y,fraction};
  }
  segment(start,end) {
    if(signedWord(start.x)>=signedWord(end.x))return;
    let span={...start},depth=0,budget=20;
    const stack=[end];
    const subdivide=()=>{
      this.work.midpoints++;
      return midpoint(span,stack[depth]);
    };
    while(span.x&0x8000) {
      if(budget--===0)return;
      const middle=subdivide();
      if((middle.x&0x8000)||middle.x<40)span=middle;
      else {stack[++depth]=middle;if(depth>=15)return;}
    }
    while(span.x<=255&&span.x<216) {
      let rasterize=false,forced=false;
      for(;;) {
        const far=stack[depth];
        if(far.x>255||forced) {
          if(budget--===0)return;
          stack[++depth]=subdivideFor(span,far,this.work);
          if(depth>=15)return;
          forced=false;continue;
        }
        let testHeight=null;
        if(lowHeight(span)) {
          if(!(far.y&0x8000)&&far.y>=108)testHeight=span.y;
        } else if((far.y&0x8000)||far.y<108)testHeight=far.y;
        else rasterize=true;
        if(testHeight!==null) {
          const width=(far.x-span.x)&255;
          if(width<20||!(word(testHeight-(width>>>2))&0x8000))rasterize=true;
          else {forced=true;continue;}
        }
        break;
      }
      if(rasterize) {
        const oldX=span.x&0xff00,oldY=span.y&0xff00;
        const cursor=this.leaf({...span,y:clampHeight(span.y)},stack[depth]);
        span={x:oldX|cursor.x,y:oldY|cursor.y,fraction:cursor.fraction};
      }
      if(depth===0)return;
      span=stack[depth--];
    }
  }
  draw(camera,heightMap,options={}) {
    this.reset(options);
    const geometry=this.geometry.setup(camera,heightMap),order=geometry.tables.order;
    for(let i=0;i<order.length;i+=2) {
      const a=order[i],b=order[i+1];
      if((geometry.visibility[a]&160)||(geometry.visibility[b]&192))continue;
      for(const index of [b,a])if(!(geometry.visibility[index]&16)) {
        geometry.project(index);
        if(options.painter&&options.objects)options.painter.paint(index,geometry,options.objects,this,options.context);
      }
      this.segment({x:geometry.x[a],y:geometry.y[a],fraction:geometry.mapHeight[a]},
                   {x:geometry.x[b],y:geometry.y[b],fraction:geometry.mapHeight[b]});
    }
    this.fill();
    return this;
  }
  fill() {
    const {or,chain}=this.tables;
    for(let column=3;column<45;column++) {
      let row=0;
      while(row<48&&this.field[row*48+column]===0)row++;
      for(let sky=row-1;sky>=1;sky--)this.field[sky*48+column]=85;
      let keep=0,fill=85;
      while(row<48) {
        const at=row*48+column,value=this.field[at];
        this.field[at]=(value&keep)|fill|or[value];
        const next=chain[value]&fill;
        if(next===0)break;
        fill=next;keep=chain[next];row++;
      }
    }
  }
  pixels() {
    const out=new Uint8Array(160*47);
    for(let y=0;y<47;y++)for(let x=0;x<160;x++)out[y*160+x]=(this.field[(y+1)*48+4+(x>>>2)]>>>(6-2*(x&3)))&3;
    return out;
  }
}
function subdivideFor(a,b,work){work.midpoints++;return midpoint(a,b);}
