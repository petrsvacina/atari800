/* Native 2-bit software compositor. Packed art is graphics data, never code.
 * Coordinates use the original 160-pixel bitmap and 35-line drawing origin. */
(function(root){'use strict';
class Bitmap{
 constructor(width=160,height=153){this.width=width;this.height=height;this.pixels=new Uint8Array(width*height);}
 clear(value=0){this.pixels.fill(value);}
 blit(art,column,row,shift=0,mode=1,mirror=false,right=false){
  const w=art.width,h=art.height,byteWidth=w/4;
  let left=(column>=128?column-256:column)*4+Math.floor(shift/2);if(right)left-=(byteWidth-1)*4;
  const top=row-35;
  for(let y=0;y<h;y++){const yy=top+y;if(yy<0||yy>=this.height)continue;
   for(let x=0;x<w;x++){const xx=left+x;if(xx<0||xx>=this.width)continue;const sx=mirror?w-1-x:x,source=art.data[y*byteWidth+(sx>>2)]>>(6-(sx&3)*2)&3,at=yy*this.width+xx;
    if(mode===0)this.pixels[at]|=source;else if(mode>=128)this.pixels[at]&=source;else this.pixels[at]=source;
   }
  }
 }
 rectangle(left,top,right,bottom,pattern=0,alternate=null){
  left=left&255;right=right&255;if(left>=40){if(right>=41)return;left=0;}else if(right>=41)right=40;top=Math.max(35,top);const height=bottom-top;
  for(let y=top;y<bottom;y++){if(y<35||y>=this.height+35)continue;const packed=alternate===null?pattern:((height-(y-top))&1)?pattern:alternate;
   for(let x=left*4;x<right*4;x++)this.pixels[(y-35)*this.width+x]=packed>>(6-(x&3)*2)&3;
  }
 }
 packed(){const out=new Uint8Array(this.width*this.height/4);for(let i=0;i<this.pixels.length;i++)out[i>>2]|=this.pixels[i]<<((3-(i&3))*2);return out;}
 rgba(palette){const out=new Uint8ClampedArray(this.pixels.length*4);for(let i=0;i<this.pixels.length;i++){const color=(typeof palette==='function'?palette(Math.floor(i/this.width)):palette)[this.pixels[i]];out[i*4]=color[0];out[i*4+1]=color[1];out[i*4+2]=color[2];out[i*4+3]=255;}return out;}
}
root.KaratekaBitmap=Bitmap;
})(globalThis);
