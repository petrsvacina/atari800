import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'shared/touch-joystick.js'),'utf8');

class Node{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attributes={};this.events=new Map();this.classes=new Set();this.captures=new Set();this.style={};this.textContent='';this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),contains:x=>this.classes.has(x),toggle:(x,value)=>{if(value)this.classes.add(x);else this.classes.delete(x);}};}
 get className(){return [...this.classes].join(' ');}set className(s){this.classes=new Set(s.split(/\s+/).filter(Boolean));}
 get parentElement(){return this.parentNode;}get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
 appendChild(node){node.remove();node.parentNode=this;this.children.push(node);return node;}
 insertBefore(node,next){if(!next)return this.appendChild(node);node.remove();node.parentNode=this;this.children.splice(this.children.indexOf(next),0,node);}
 remove(){if(this.parentNode)this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
 addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
 removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
 fire(name,values={}){const e={target:this,pointerType:'touch',pointerId:1,button:0,clientX:72,clientY:72,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};for(const fn of [...(this.events.get(name)||[])])fn(e);return e;}
 setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);this.fire('lostpointercapture',{pointerId:id});}
 getBoundingClientRect(){return {left:0,top:0,width:144,height:144};}
 matches(s){return s.startsWith('.')?this.classes.has(s.slice(1)):this.tagName.toLowerCase()===s;}
 closest(s){for(let n=this;n;n=n.parentNode)if(n.matches(s))return n;return null;}
 querySelectorAll(selector){const parts=selector.split(' '),found=[];const visit=n=>{for(const child of n.children){if(child.matches(parts.at(-1))){let p=child.parentNode,i=parts.length-2;while(p&&i>=0){if(p.matches(parts[i]))i--;p=p.parentNode;}if(i<0)found.push(child);}visit(child);}};visit(this);return found;}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 set innerHTML(s){this.children=[];const stack=[this];for(const token of s.matchAll(/<\/?([\w-]+)([^>]*)>/g)){if(token[0].startsWith('</')){stack.pop();continue;}const n=new Node(token[1]);for(const a of token[2].matchAll(/([\w-]+)="([^"]*)"/g)){if(a[1]==='class')n.className=a[2];else n.setAttribute(a[1],a[2]);}stack.at(-1).appendChild(n);if(!['br','input','img','meta','link'].includes(token[1]))stack.push(n);}}
}

export function createTouchHarness({language='cs',action='fire',enabled=()=>true}={}){
 const window=new Node('window'),document=new Node('document'),arcade=new Node(),host=new Node(),legacy=new Node('button'),interactions=[];
 arcade.className='arcade';host.className='touch-controls';host.appendChild(legacy);arcade.appendChild(host);document.appendChild(arcade);document.createElement=tag=>new Node(tag);document.hidden=false;
 const context=vm.createContext({URLSearchParams,location:{search:language==='en'?'?lang=en':''},document,addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window)});
 vm.runInContext(source,context);
 const controller=context.AtariTouchJoystick.mount({host,action,enabled,onInteract:kind=>interactions.push(kind)});
 return {context,controller,window,document,host,legacy,interactions,stick:host.querySelector('.atari-stick'),fire:host.querySelector('.atari-fire')};
}

const h=createTouchHarness(),neutral={x:0,y:0,left:false,right:false,up:false,down:false,fire:false};
const snapshot=()=>({...h.controller.read()});assert.deepEqual(snapshot(),neutral);
h.stick.fire('pointerdown',{pointerId:11,clientX:130,clientY:14});assert.equal(snapshot().x,1);assert.equal(snapshot().y,-1);
h.fire.fire('pointerdown',{pointerId:22});assert.equal(snapshot().fire,true);assert.equal(h.fire.getAttribute('aria-pressed'),'true');
h.stick.fire('pointermove',{pointerId:99,clientX:0,clientY:144});assert.equal(snapshot().x,1,'A third pointer must not steal the joystick');
h.fire.fire('pointerup',{pointerId:99});assert.equal(snapshot().fire,true,'An unrelated finger must not release FIRE');
h.stick.fire('pointermove',{pointerId:11,clientX:-500,clientY:72});assert.equal(snapshot().x,-1);assert.equal(snapshot().y,0);assert.equal(snapshot().fire,true);
h.stick.fire('pointercancel',{pointerId:11});assert.equal(snapshot().x,0);assert.equal(snapshot().fire,true,'Cancelling direction must leave the other thumb held');
h.fire.fire('pointerup',{pointerId:22});assert.deepEqual(snapshot(),neutral);
for(const reset of ['blur','pagehide','resize','orientationchange']){
 h.stick.fire('pointerdown',{pointerId:1,clientX:144});h.fire.fire('pointerdown',{pointerId:2});h.window.fire(reset);assert.deepEqual(snapshot(),neutral,reset);assert.equal(h.stick.captures.size+h.fire.captures.size,0);
}
h.fire.fire('pointerdown',{pointerId:2});h.document.hidden=true;h.document.fire('visibilitychange');assert.deepEqual(snapshot(),neutral);h.document.hidden=false;
h.stick.fire('pointerdown',{pointerId:1,clientY:0});h.document.fire('fullscreenchange');assert.deepEqual(snapshot(),neutral);
h.stick.fire('pointerdown',{pointerId:1,clientX:75,clientY:75});assert.equal(snapshot().x,0);assert.equal(snapshot().y,0,'The centre has a dead zone');h.controller.clear();
h.stick.fire('keydown',{code:'ArrowUp'});h.stick.fire('keydown',{code:'ArrowRight'});h.fire.fire('keydown',{code:'Space'});assert.equal(snapshot().x,1);assert.equal(snapshot().y,-1);assert.equal(snapshot().fire,true);
assert.ok(!h.fire.fire('keyup',{code:'Space'}).stopped,'Release must also clear any older native keyboard press');assert.equal(snapshot().fire,false);assert.equal(snapshot().x,1);h.controller.clear();
h.fire.fire('pointerdown',{pointerId:2});const buttons=h.controller.buttons({left:true});assert.equal(buttons.left,true);assert.equal(buttons.fire,true);h.fire.fire('pointerup',{pointerId:2});assert.equal(h.controller.buttons({left:true}).left,true,'Releasing touch must preserve keyboard input');
let active=true;const gated=createTouchHarness({enabled:()=>active});gated.fire.fire('pointerdown');active=false;assert.equal(gated.controller.read().fire,false);gated.stick.fire('pointerdown',{clientX:140});assert.equal(gated.controller.state.x,0);active=true;assert.equal(gated.controller.read().fire,false);
const en=createTouchHarness({language:'en',action:'switch'});assert.equal(en.fire.textContent,'SWITCH');assert.equal(en.fire.getAttribute('aria-label'),'Switch character');
for(let angle=0;angle<360;angle++){
 const a=angle*Math.PI/180,s=h.context.AtariTouchJoystick.direction(500*Math.cos(a),500*Math.sin(a),50);
 assert.ok([-1,0,1].includes(s.x)&&[-1,0,1].includes(s.y));assert.ok(s.x||s.y);assert.ok(Math.hypot(s.px,s.py)<=50.000001);
}
h.controller.destroy();h.fire.fire('pointerdown');assert.equal(h.controller.state.fire,false);assert.equal(h.legacy.classList.contains('atari-touch-legacy'),false);
console.log('PASS touch joystick: independent thumbs, diagonals, pointer ownership/cancellation, held FIRE, dead zone, blur/visibility/rotation/fullscreen cleanup, keyboard coexistence and CZ/EN labels');
