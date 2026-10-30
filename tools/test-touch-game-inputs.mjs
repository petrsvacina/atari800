import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createTouchHarness} from './test-touch-joystick.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Run each presenter's actual input function against the real shared touch
// controller, then compare it to the same physical joystick directions/FIRE.
function inputSource(directory,name){
 const s=fs.readFileSync(path.join(root,directory,'game.js'),'utf8'),start=s.indexOf('function '+name+'(');assert.ok(start>=0);
 let depth=0,quote=null,end=s.indexOf('{',start);
 for(let i=end;i<s.length;i++){const c=s[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&!--depth){end=i+1;break;}}
 return '('+s.slice(start,end)+')';
}
const configs=[['web','inputs'],['karate','getInputs'],['archon','input'],['goonies-web','inputs'],['river-raid','input'],['hero','input'],['boulder-dash','input']];
const bindings=[{left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',bomb:'Space'},{left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',bomb:'KeyQ'},{left:'KeyJ',right:'KeyL',up:'KeyI',down:'KeyK',bomb:'KeyU'}];
const plain=v=>JSON.parse(JSON.stringify(v));let checks=0;
for(const [directory,name]of configs){
 for(const [x,y]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]])for(const fire of [false,true]){
  const h=createTouchHarness(),pads=[],game={mode:'solo',selected:0,phase:'playing',playerIndex:0,joysticks:1,humanSide:'light'},globals={keys:new Set(),touch:new Set(),touches:new Map(),touchFire:false,joystick:h.controller,navigator:{getGamepads:()=>pads},bindings,game,paused:false,menu:false,gamepadFire:false,gamepadPause:false,padFire:false,padPause:false,switchActor(){game.selected=1-game.selected;},start(){},startGame(){},pause(){},setPaused(){}};
  const env=vm.createContext(globals),fn=vm.runInContext(inputSource(directory,name),env);
  if(x||y)h.stick.fire('pointerdown',{pointerId:1,clientX:72+x*64,clientY:72+y*64});if(fire)h.fire.fire('pointerdown',{pointerId:2});
  const touch=plain(fn());h.controller.clear();game.selected=0;env.gamepadFire=false;env.padFire=false;
  const buttons=Array.from({length:16},()=>({pressed:false}));buttons[0].pressed=fire;pads.push({axes:[x,y],buttons});
  const physical=plain(fn());assert.deepEqual(touch,physical,JSON.stringify({directory,x,y,fire}));checks++;
 }
}
// Goonies FIRE switches exactly once per hold. Boulder Dash's second physical
// joystick must not receive player one's touch controls in two-stick mode.
{
 const h=createTouchHarness(),game={mode:'solo',selected:0},env=vm.createContext({joystick:h.controller,keys:new Set(),touch:new Set(),game,navigator:{getGamepads:()=>[]},gamepadFire:false,switchActor(){game.selected=1-game.selected;}}),fn=vm.runInContext(inputSource('goonies-web','inputs'),env);
 h.fire.fire('pointerdown');fn();assert.equal(game.selected,1);fn();assert.equal(game.selected,1);h.fire.fire('pointerup');fn();h.fire.fire('pointerdown');fn();assert.equal(game.selected,0);
}
{
 const h=createTouchHarness(),env=vm.createContext({joystick:h.controller,keys:new Set(),touch:new Set(),game:{joysticks:2},navigator:{getGamepads:()=>[]}}),fn=vm.runInContext(inputSource('boulder-dash','input'),env);
 h.stick.fire('pointerdown',{clientX:144});h.fire.fire('pointerdown',{pointerId:2});assert.equal(fn(0).x,1);assert.equal(fn(0).fire,true);assert.equal(fn(1).x,0);assert.equal(fn(1).fire,false);
}
console.log(`PASS ${checks} real presenter input comparisons across seven games: touch matches physical joystick for all eight directions, neutral and held FIRE; Goonies switch edges and two-player Boulder Dash isolation`);
{
 const h=createTouchHarness(),env=vm.createContext({joystick:h.controller,keys:new Set(),touches:new Map(),touchFire:false,game:{mode:'solo',humanSide:'dark'},paused:false,padPause:false,padFire:false,navigator:{getGamepads:()=>[]},start(){},pause(){}}),fn=vm.runInContext(inputSource('archon','input'),env);
 h.stick.fire('pointerdown',{clientX:144});h.fire.fire('pointerdown',{pointerId:2});const inputs=fn();assert.equal(inputs.primary.x,1);assert.equal(inputs.inputs[1].x,1);assert.equal(inputs.inputs[1].fire,true);assert.equal(inputs.inputs[0].fire,false);
}
console.log('PASS Archon touch controls follow the human player on the dark side');
for(const [directory]of configs){
 const page=fs.readFileSync(path.join(root,directory,'index.html'),'utf8');
 assert.ok(page.includes('../shared/touch-joystick.css?v=20261030-touch'));
 assert.ok(page.indexOf('../shared/touch-joystick.js')<page.indexOf('game.js?v=20261030-touch'));
}
assert.ok(!fs.readFileSync(path.join(root,'karateka/index.html'),'utf8').includes('touch-joystick'),'Karateka keeps its keyboard-style controls');
console.log('PASS shared assets load before all seven presenters and Karateka remains excluded');
