import {decode64} from './engine.mjs';

export class StoryScreen2 {
  constructor() {this.cells=new Uint8Array(600).fill(32);this.x=0;this.y=0;}
  scroll() {if(this.y>=15){this.cells.copyWithin(0,40);this.cells.fill(32,560);this.y=14;}}
  put(c) {
    if(c===10||c===155){this.x=0;this.y++;this.scroll();return;}
    this.cells[this.y*40+this.x]=c;
    if(++this.x===40){this.x=0;this.y++;this.scroll();}
  }
  event([kind,a,b]) {
    if(kind==='clear'){this.cells.fill(32);this.x=0;this.y=0;}
    else if(kind==='position'){this.x=a;this.y=Math.max(0,b-9);}
    else if(kind==='text')for(const c of a)this.put(c.charCodeAt(0));
  }
}

const accents={1:'á',2:'č',3:'č',4:'ď',5:'é',6:'ě',7:'í',8:'ň',9:'í',10:'ó',11:'ř',12:'š',13:'ť',14:'ň',15:'ů',16:'ú',17:'ý',18:'ř',19:'š',20:'ť',21:'ú',22:'ů',23:'Ž',24:'ž',25:'ý',26:'ž'};
export function readable2(text,language) {
  return Array.from(text,c=>c.charCodeAt(0)<32&&c!=='\n'?(language==='cs'?(accents[c.charCodeAt(0)]||c):c):c).join('');
}

export function indices2(data,game) {
  const lang=data.languages[game.language],font=decode64(lang.font),picture=decode64(lang.pictures[game.image]);
  const indices=new Uint8Array(320*200).fill(4);
  const colors=[134,game.color&254,30,16];
  for(let i=0;i<3200;i++)for(let p=0;p<4;p++) {
    const x=i*8+p*2,c=colors[(picture[i]>>(6-p*2))&3];indices[x]=indices[x+1]=c;
  }
  const text=new StoryScreen2();for(const event of game.events)text.event(event);
  for(let row=0;row<15;row++)for(let col=0;col<40;col++) {
    const atascii=text.cells[row*40+col],c=atascii&127;
    const code=c<32?c+64:c<96?c-32:c;
    for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
      const bit=((font[code*8+y]>>(7-x))&1)^(atascii>>7);
      if(bit)indices[(80+row*8+y)*320+col*8+x]=14;
    }
  }
  return {indices,text};
}

export function render2(canvas,data,game) {
  const {indices,text}=indices2(data,game),ctx=canvas.getContext('2d'),frame=ctx.createImageData(320,200);
  for(let i=0;i<indices.length;i++) {
    const p=indices[i]*3;frame.data.set(data.palette.slice(p,p+3),i*4);frame.data[i*4+3]=255;
  }
  ctx.putImageData(frame,0,0);return text;
}
