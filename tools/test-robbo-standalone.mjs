// DOM/audio host test. Browser/device verification is a separate manual check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../robbo/game.js',import.meta.url),'utf8');
const graphics=fs.readFileSync(new URL('../robbo/assets/data.js',import.meta.url),'utf8');
for(const language of ['cs','en']){
  const events={},frames=[],nodes=new Map(),errors=[];let image,now=0,fullscreen=0;
  const canvasContext={putImageData:value=>{image=value.data;}};
  class Node{
    constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.tagName='BUTTON';this.listeners={};this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),toggle:(x,v)=>v?this.classes.add(x):this.classes.delete(x),contains:x=>this.classes.has(x)};}
    addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(name,value){this[name]=value;}getContext(){return canvasContext;}focus(){}click(){this.listeners.click?.({});}
    async requestFullscreen(){fullscreen++;}
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};node('error').hidden=true;
  const doc={currentScript:{src:'file:///local/robbo/game.js'},documentElement:{lang:'cs'},body:node('body'),getElementById:node,querySelector:node,querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn};
  class Audio{
    constructor(){this.sampleRate=48000;this.destination={};this.state='suspended';}createGain(){return{gain:{value:1},connect(){}};}createScriptProcessor(){return{connect(){}};}async resume(){this.state='running';}async suspend(){this.state='suspended';}
  }
  const touchState={left:false,right:false,up:false,down:false,fire:false};
  const context=vm.createContext({console:{log(){},warn(...v){errors.push(v);},error(...v){errors.push(v);}},document:doc,location:{search:language==='en'?'?lang=en':'',protocol:'file:'},URL,URLSearchParams,atob,Blob,Response,DecompressionStream,AudioContext:Audio,ImageData:class{constructor(data){this.data=data;}},navigator:{getGamepads:()=>[]},performance:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn),addEventListener(){},AtariTouchJoystick:{mount:()=>({read:()=>touchState,clear:()=>Object.keys(touchState).forEach(k=>touchState[k]=false)})},fetch(){throw new Error('Standalone cannot fetch assets');}});
  context.window=context;vm.runInContext(graphics,context);await vm.runInContext(source,context);
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(node('error').hidden,true);assert.equal(doc.documentElement.lang,language);assert.equal(image.length,320*240*4);
  node('start').click();await Promise.resolve();await Promise.resolve();const game=context.robboDebug.game;assert.ok(game);assert.equal(game.state.demo,0);
  const key=(type,code,repeat=false)=>events[type]({code,repeat,target:{tagName:'CANVAS'},preventDefault(){}});
  for(let i=0;i<70;i++)frames.shift()(now+=21);assert.equal(game.phase,'play');
  key('keydown','ArrowLeft');for(let i=0;i<20;i++)frames.shift()(now+=21);key('keyup','ArrowLeft');assert.ok(game.state.fx<2);
  key('keydown','ArrowDown');for(let i=0;i<50;i++)frames.shift()(now+=21);key('keyup','ArrowDown');assert.ok(game.scans>8);assert.ok(game.state.fy>2);
  const beforeY=game.state.fy;touchState.up=true;for(let i=0;i<15;i++)frames.shift()(now+=21);touchState.up=false;assert.ok(game.state.fy<beforeY,'Touch direction must reach the native player');
  game.state.ammo=5;touchState.fire=true;touchState.right=true;for(let i=0;i<15;i++)frames.shift()(now+=21);touchState.fire=touchState.right=false;assert.ok(game.state.ammo<5,'Touch FIRE plus direction must shoot');
  node('pause').click();const ticks=game.ticks;frames.shift()(now+=100);assert.equal(game.ticks,ticks);assert.equal(node('pause-overlay').hidden,false);
  node('resume').click();frames.shift()(now+=21);assert.ok(game.ticks>ticks);assert.equal(node('pause-overlay').hidden,true);
  key('keydown','KeyF');assert.equal(fullscreen,1);
  events.keydown({code:'ArrowUp',repeat:false,target:{tagName:'BUTTON'},preventDefault(){}});frames.shift()(now+=21);assert.equal(game.input.stick,14,'Arrow input must work after a toolbar click');key('keyup','ArrowUp');
  key('keydown','ArrowDown');node('pause').click();node('resume').click();key('keydown','ArrowDown',true);frames.shift()(now+=21);assert.equal(game.input.stick,15);key('keyup','ArrowDown');
  const audio=context.robboDebug.audio;assert.ok(audio.node?.onaudioprocess);game.sound.trigger(1);game.sound.step(0);context.robboDebug.tick();
  audio.write(game.sound.registers);const samples=new Float32Array(2048);audio.node.onaudioprocess({outputBuffer:{getChannelData:()=>samples}});assert.ok(samples.some(x=>Math.abs(x)>.0001),'Fallback output must contain actual nonzero PCM');
  node('restart').click();assert.equal(context.robboDebug.game,null);assert.equal(node('welcome').hidden,false);
  // Original title must enter an actual native demo, never a video or CPU runtime.
  let guard=0;while(!context.robboDebug.game){context.robboDebug.tick();assert.ok(++guard<7000);}assert.equal(context.robboDebug.game.state.demo,1);
  key('keydown','Space');assert.equal(context.robboDebug.game.state.demo,0);key('keydown','Space',true);context.robboDebug.tick();assert.equal(context.robboDebug.game.input.fire,false);key('keyup','Space');
  // Force only the test's mission cursor to exercise the full ending integration.
  context.robboDebug.start(55);const last=context.robboDebug.game;last.phase='closing';last.column=-1;last.revealWait=0;context.robboDebug.tick();assert.ok(context.robboDebug.ending);
  for(let i=0;i<745;i++)context.robboDebug.tick();assert.equal(context.robboDebug.ending.phase,'hold');
  for(let i=0;i<600;i++)context.robboDebug.tick();assert.equal(context.robboDebug.ending.phase,'hold');
  key('keydown','Space');for(let i=0;i<117;i++)context.robboDebug.tick();key('keyup','Space');assert.equal(context.robboDebug.ending,null);assert.equal(context.robboDebug.game,null);
  assert.equal(errors.length,0,JSON.stringify(errors));
}
console.log('PASS standalone CZ/EN file:// host: no fetch, actual PCM, title, movement, pause, held-key suppression, fullscreen key, native demo and complete interactive ending.');
