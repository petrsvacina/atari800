export function decode64(text) {
  const raw=atob(text);return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

// These are adventure-level predicates/actions extracted offline. There are
// no CPU registers, machine instructions or BASIC parsing in this runtime.
export class Adventure2 {
  constructor(data,language='cs') { this.data=data;this.language=language;this.reset(0); }
  get program() { return this.data.languages[this.language].programs[this.part]; }
  reset(part=0) {
    this.musicEpoch=(this.musicEpoch||0)+1;
    this.part=part;this.vars={};this.room=0;this.phase='running';this.pc=this.program.start;
    this.stack=[];this.events=[];this.image='INGAME.MIC';this.color=0;this.pauseIndex=-1;
    this.advance();
  }
  value(e) {
    const [op,a,b]=e;
    if(op==='c'||op==='s')return a;
    if(op==='v')return this.vars[a]??(a==='P$'?'':0);
    const x=this.value(a),y=this.value(b);
    switch(op) {
      case '==':return +(x===y);case '!=':return +(x!==y);
      case '<':return +(x<y);case '>':return +(x>y);case '<=':return +(x<=y);case '>=':return +(x>=y);
      case 'AND':return +(Boolean(x)&&Boolean(y));case 'OR':return +(Boolean(x)||Boolean(y));
      case '+':return x+y;case '-':return x-y;case '*':return x*y;case '/':return x/y;
      default:throw new Error('Unknown adventure predicate: '+op);
    }
  }
  advance() {
    this.phase='running';
    for(let budget=0;budget<12000;budget++) {
      for(const [room,pc] of Object.entries(this.program.rooms)) if(this.pc===pc)this.room=Number(room);
      const at=this.pc,op=this.program.ops[this.pc++];
      if(!op)throw new Error('Adventure left its narrative graph');
      const [kind,a,b,c]=op;
      switch(kind) {
        case 'set':this.vars[a]=this.value(b);break;
        case 'text':this.events.push(['text',a]);break;
        case 'clear':this.events.push(['clear']);break;
        case 'position':this.events.push(['position',a,b]);break;
        case 'room':this.room=a;break;
        case 'image':this.image=a;break;
        case 'color':this.color=a;break;
        case 'if':this.pc=this.value(a)?b:c;break;
        case 'jump':this.pc=a;break;
        case 'call':this.stack.push(this.pc);this.pc=a;break;
        case 'return':
          if(!this.stack.length)throw new Error('Adventure return without a call');
          this.pc=this.stack.pop();break;
        case 'input':this.room=a;this.phase='input';this.inputIndex=at;return;
        case 'pause':this.phase='pause';this.pauseIndex=this.program.pauses.indexOf(at);return;
        case 'run':this.reset(a);return;
        case 'end':this.phase='end';return;
        default:throw new Error('Unknown adventure action: '+kind);
      }
    }
    throw new Error('Adventure did not reach an input boundary');
  }
  command(text) {
    if(this.phase!=='input')return;
    this.vars['P$']=text;
    this.events.push(['text','? '+text+'\n']);this.advance();
  }
  continue() { if(this.phase==='pause')this.advance(); }
  snapshot() {
    return {format:'neverending-story-2-native',version:1,part:this.part,room:this.room,phase:this.phase,
      pauseIndex:this.pauseIndex,vars:structuredClone(this.vars),image:this.image,color:this.color};
  }
  restore(saved,language=this.language) {
    if(saved?.format!=='neverending-story-2-native'||saved.version!==1||![0,1,2].includes(saved.part)
      ||!['input','pause','end'].includes(saved.phase)||!Number.isInteger(saved.room)||saved.room<0||saved.room>13
      ||!saved.vars||typeof saved.vars!=='object')throw new Error('Invalid saved adventure');
    this.language=language;this.part=saved.part;this.vars=structuredClone(saved.vars);
    this.room=saved.room;this.image=saved.image;this.color=saved.color;this.phase=saved.phase;
    this.pauseIndex=saved.pauseIndex;this.stack=[];this.events=[['clear']];
    if(this.phase==='input') {
      const input=this.program.inputs.find(i=>this.program.ops[i][1]===this.room);
      if(input===undefined)throw new Error('Invalid saved room');
      const vars=structuredClone(this.vars),image=this.image,color=this.color;
      this.pc=this.program.rooms[String(this.room)];this.advance();
      this.vars=vars;this.phase='input';this.inputIndex=input;this.pc=input+1;this.stack=[];
      // Bitmap-less rooms inherit the picture actually visible before switching.
      if(!this.image)this.image=image; if(this.color===undefined)this.color=color;
    } else if(this.phase==='pause') {
      const pause=this.program.pauses[this.pauseIndex];
      if(pause===undefined)throw new Error('Invalid saved continuation');
      let start=pause;
      while(start>0&&this.program.ops[start-1][0]==='text')start--;
      this.pc=start;this.advance();
    }
    // The 2022 English release added KING.MIC; the Czech chamber retains
    // INGAME.MIC with its original black foreground instead.
    if(!this.data.languages[language].pictures[this.image]){this.image='INGAME.MIC';this.color=0;}
  }
  setLanguage(language) {
    if(!this.data.languages[language])throw new Error('Unknown language');
    if(language!==this.language) {
      const saved=this.snapshot(),command=this.vars['P$'];this.restore(saved,language);
      if(command!==undefined)this.vars['P$']=command;
    }
  }
}
