// DOM/audio host harness, no browser automation: prove that the file:// bundle
// initializes without fetch/imports and keeps controls connected to the model.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../rescue-on-fractalus/game.js',import.meta.url),'utf8');
for(const language of ['cs','en']) {
 const events={},frames=[],nodes=new Map(),errors=[];let image,now=0;
 const ctx={putImageData:value=>{image=value.data;},getImageData:()=>({data:image?.slice()??new Uint8ClampedArray(256000)}),fillRect(){}};
 class Node {
  constructor(id){this.id=id;this.hidden=false;this.disabled=false;this.value='';this.dataset={};this.textContent='';this.tagName='BUTTON';this.listeners={};this.classList={add(){},remove(){}};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(name,value){this[name]=value;}
  replaceChildren(...children){this.children=children;}
  getContext(){return ctx;}
  focus(){}
  click(){this.listeners.click?.({});}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 node('graphics').value='original';node('standard').value='pal';node('error').hidden=true;node('play-intro').checked=false;
 const document={currentScript:{src:'file:///local/rescue-on-fractalus/game.js'},documentElement:{lang:'cs'},body:{dataset:{}},
  getElementById:node,querySelector:node,querySelectorAll:()=>[],addEventListener:(name,fn)=>{events[name]=fn;}};
 class AudioContext {
  constructor(){this.sampleRate=48000;this.state='suspended';this.destination={};}
  createGain(){return {gain:{value:1},connect(){}};}
  createScriptProcessor(){return {connect(){}};}
  async resume(){this.state='running';}async suspend(){this.state='suspended';}
 }
 const context=vm.createContext({console:{log(){},warn(...x){errors.push(x);},error(...x){errors.push(x);}},document,location:{search:language==='en'?'?lang=en':'',protocol:'file:'},
  URL,URLSearchParams,structuredClone,performance:{now:()=>now},crypto:webcrypto,atob,AudioContext,Blob,Response,DecompressionStream,
  ImageData:class {constructor(data){this.data=data;}},Option:class {constructor(text,value){this.text=text;this.value=value;}},
  navigator:{getGamepads:()=>[]},localStorage:{getItem:()=>null},requestAnimationFrame:fn=>frames.push(fn),addEventListener(){},
  fetch(){throw new Error('Standalone must use bundled assets');}});
 context.window=context;
 await vm.runInContext(source,context);assert.equal(node('start').disabled,false,errors.map(x=>x.map(String).join(' ')).join('\n')+' '+node('error').textContent);assert.equal(document.documentElement.lang,language);
 node('start').click();await Promise.resolve();await Promise.resolve();assert.ok(context.fractalusDebug.game);assert.ok(image?.length===256000);
 const key=(type,code,repeat=false)=>events[type]({code,repeat,target:{tagName:'CANVAS'},preventDefault(){}});
 key('keydown','ArrowDown');key('keydown','Space');
 for(let i=0;i<40;i++){frames.shift()(now+=22);await Promise.resolve();}
 key('keyup','ArrowDown');key('keyup','Space');
 assert.ok(context.fractalusDebug.game.ticks>=35);assert.equal(node('error').hidden,true);
 node('pause').click();const ticks=context.fractalusDebug.game.ticks;frames.shift()(now+=100);assert.equal(context.fractalusDebug.game.ticks,ticks);
 node('resume').click();frames.shift()(now+=25);assert.ok(context.fractalusDebug.game.ticks>ticks);
 node('play-intro').checked=true;node('restart').click();
 let cinematic=context.fractalusDebug.intro;assert.ok(cinematic);assert.equal(cinematic.name,'logo');
 assert.equal(node('phase').textContent,'LUCASFILM GAMES');
 const initial=JSON.stringify(context.fractalusDebug.game.state);
 key('keydown','ArrowUp');key('keydown','KeyL');
 for(let i=0;i<80;i++)frames.shift()(now+=22);
 assert.equal(context.fractalusDebug.game.ticks,0);assert.equal(JSON.stringify(context.fractalusDebug.game.state),initial);
 node('pause').click();const stopped=cinematic.frame;frames.shift()(now+=100);assert.equal(cinematic.frame,stopped);
 node('resume').click();frames.shift()(now+=22);assert.ok(cinematic.frame>stopped);
 let safety=0;const scenes=['logo'];
 while(context.fractalusDebug.intro){frames.shift()(now+=22);const name=context.fractalusDebug.intro?.name;if(name&&name!==scenes.at(-1))scenes.push(name);assert.ok(++safety<3000);}
 assert.deepEqual(scenes,['logo','station','launch']);
 assert.equal(context.fractalusDebug.game.ticks,0);assert.equal(JSON.stringify(context.fractalusDebug.game.state),initial);
 assert.equal(node('skip-intro').hidden,true);assert.equal(node('ending').hidden,true);
 key('keydown','ArrowUp',true);key('keydown','KeyL',true);frames.shift()(now+=22);
 assert.equal(context.fractalusDebug.game.input.port,255);assert.equal(context.fractalusDebug.game.commandQueue.length,0);
 key('keyup','ArrowUp');key('keyup','KeyL');
 node('restart').click();assert.ok(context.fractalusDebug.intro);key('keydown','Space');
 assert.equal(context.fractalusDebug.intro,null);assert.equal(context.fractalusDebug.game.ticks,0);
 key('keydown','Space',true);frames.shift()(now+=22);assert.equal(context.fractalusDebug.game.input.fire,false);
 key('keyup','Space');key('keydown','Space');frames.shift()(now+=22);assert.equal(context.fractalusDebug.game.input.fire,true);key('keyup','Space');
 assert.equal(errors.length,0,`${language} standalone errors: ${errors}`);
}
console.log('PASS standalone file:// bundle: CZ/EN, no fetch, fallback audio, flight/fire, complete intro/launch with frozen gameplay, pause/restart, automatic handoff, skip and held-key suppression. Physical device validation remains separate.');
