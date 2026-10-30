/* Digital Atari joystick, presented as a two-thumb touch control.
 * The games keep their own original input rules and timing. */
(function(root){'use strict';
const vectors=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const words={
 cs:{controls:'Dotykový joystick',direction:'Levý palec · směr',action:'Pravý palec · akce',stick:'Osmisměrný joystick',fire:'Tlačítko joysticku',bomb:'Položit bombu',switch:'Přepnout postavu',shoot:'Střílet',attack:'Směr + FIRE pro úder',confirm:'Potvrdit / vystřelit',grab:'FIRE + směr pro sbírání'},
 en:{controls:'Touch joystick',direction:'Left thumb · move',action:'Right thumb · action',stick:'Eight-way joystick',fire:'Joystick fire button',bomb:'Place a bomb',switch:'Switch character',shoot:'Fire',attack:'Direction + FIRE to attack',confirm:'Confirm / fire',grab:'FIRE + direction to grab'}
};
function direction(dx,dy,radius){
 const length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;
 const [x,y]=length<radius*.22?[0,0]:vectors[(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8];
 return {x,y,px:dx*scale,py:dy*scale};
}
function mount(options={}){
 const doc=root.document,host=typeof options.host==='string'?doc?.querySelector(options.host):options.host;
 // Also allow the native engines and browser shells to run in DOM-free tools.
 if(!host||typeof doc?.createElement!=='function')return null;
 const language=new URLSearchParams(root.location?.search||'').get('lang')==='en'?'en':'cs',t=words[language],action=options.action||'fire';
 const legacy=Array.from(host.children),oldParent=host.parentNode,oldNext=host.nextSibling;
 for(const node of legacy)node.classList.add('atari-touch-legacy');
 host.classList.add('atari-touch-host');host.setAttribute('aria-label',t.controls);
 if(options.parent)options.parent.appendChild(host);
 const screen=host.parentElement?.classList.contains('screen')?host.parentElement:null;
 screen?.classList.add('atari-stick-screen');host.closest('.arcade')?.classList.add('atari-stick-arcade');
 const panel=doc.createElement('div');panel.className='atari-touch-console';
 panel.innerHTML='<div class="atari-touch-labels"><span></span><span></span></div><div class="atari-touch-row"><div class="atari-stick" tabindex="0" role="group"><span class="atari-stick-knob" aria-hidden="true"></span></div><div class="atari-fire-wrap"><button type="button" class="atari-fire" aria-pressed="false">FIRE</button><span class="atari-fire-hint"></span></div></div>';
 const labels=panel.querySelectorAll('.atari-touch-labels span');labels[0].textContent=t.direction;labels[1].textContent=t.action;
 const stick=panel.querySelector('.atari-stick'),knob=panel.querySelector('.atari-stick-knob'),fire=panel.querySelector('.atari-fire');
 stick.setAttribute('aria-label',t.stick);fire.setAttribute('aria-label',t[action]||t.fire);panel.querySelector('.atari-fire-hint').textContent=t[action]||t.fire;
 if(action==='bomb')fire.textContent=language==='en'?'BOMB':'BOMBA';
 if(action==='switch')fire.textContent=language==='en'?'SWITCH':'POSTAVA';
 const arrows=['→','↘','↓','↙','←','↖','↑','↗'];
 for(let i=0;i<8;i++){const arrow=doc.createElement('span'),angle=i*Math.PI/4;arrow.className='atari-stick-arrow';arrow.textContent=arrows[i];arrow.setAttribute('aria-hidden','true');arrow.style.left=(50+Math.cos(angle)*40)+'%';arrow.style.top=(50+Math.sin(angle)*40)+'%';stick.appendChild(arrow);}
 host.appendChild(panel);
 const state={x:0,y:0,left:false,right:false,up:false,down:false,fire:false},held=new Set(),fireKeys=new Set(),listeners=[];
 let stickPointer=null,firePointer=null;
 const enabled=()=>!options.enabled||options.enabled();
 const listen=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
 function interact(kind){const pending=options.onInteract?.(kind);pending?.catch?.(()=>{});}
 function axes(x,y,px=0,py=0){state.x=x;state.y=y;state.left=x<0;state.right=x>0;state.up=y<0;state.down=y>0;knob.style.transform=`translate(${px}px, ${py}px)`;stick.classList.toggle('is-held',!!(x||y));}
 function firing(){state.fire=firePointer!==null||fireKeys.size>0;fire.classList.toggle('is-held',state.fire);fire.setAttribute('aria-pressed',String(state.fire));}
 function sample(event){const r=stick.getBoundingClientRect(),value=direction(event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2,r.width*.35);axes(value.x,value.y,value.px,value.py);}
 function releasePointer(node,id){if(id!==null&&node.hasPointerCapture?.(id))node.releasePointerCapture(id);}
 function clear(){const a=stickPointer,b=firePointer;stickPointer=firePointer=null;held.clear();fireKeys.clear();axes(0,0);firing();releasePointer(stick,a);releasePointer(fire,b);}
 listen(stick,'pointerdown',e=>{if(!enabled()||stickPointer!==null||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);sample(e);interact('stick');});
 listen(stick,'pointermove',e=>{if(e.pointerId!==stickPointer)return;e.preventDefault();sample(e);});
 const endStick=e=>{if(e.pointerId!==stickPointer)return;const id=stickPointer;stickPointer=null;axes(0,0);releasePointer(stick,id);};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(stick,name,endStick);
 listen(fire,'pointerdown',e=>{if(!enabled()||firePointer!==null||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();firePointer=e.pointerId;fire.setPointerCapture(e.pointerId);firing();interact('fire');});
 const endFire=e=>{if(e.pointerId!==firePointer)return;const id=firePointer;firePointer=null;firing();releasePointer(fire,id);};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(fire,name,endFire);
 const arrowKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
 function keyboardAxes(){const r=stick.getBoundingClientRect(),x=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft')),y=Number(held.has('ArrowDown'))-Number(held.has('ArrowUp')),d=Math.hypot(x,y)||1;axes(x,y,x/d*r.width*.35,y/d*r.width*.35);}
 listen(stick,'keydown',e=>{if(!arrowKeys.has(e.code)||!enabled())return;e.preventDefault();e.stopPropagation();held.add(e.code);keyboardAxes();interact('stick');});
 listen(stick,'keyup',e=>{if(!arrowKeys.has(e.code))return;e.preventDefault();held.delete(e.code);keyboardAxes();});
 listen(fire,'keydown',e=>{if(!['Space','Enter'].includes(e.code)||!enabled())return;e.preventDefault();e.stopPropagation();if(!e.repeat){fireKeys.add(e.code);firing();interact('fire');}});
 // Key releases also reach the game: a key pressed before focus moved here
 // must not remain stuck in the presenter's original keyboard set.
 listen(fire,'keyup',e=>{if(!['Space','Enter'].includes(e.code))return;e.preventDefault();fireKeys.delete(e.code);firing();});
 for(const node of [stick,fire]){listen(node,'contextmenu',e=>e.preventDefault());listen(node,'blur',clear);}
 listen(root,'blur',clear);listen(root,'pagehide',clear);listen(root,'orientationchange',clear);listen(root,'resize',clear);
 listen(doc,'visibilitychange',()=>{if(doc.hidden)clear();});listen(doc,'fullscreenchange',clear);
 function read(){if(!enabled())clear();return state;}
 return {state,read,clear,
  buttons(target,fireKey='fire'){const s=read();for(const name of ['left','right','up','down'])target[name]||=s[name];if(fireKey)target[fireKey]||=s.fire;return target;},
  axes(target){const s=read();target.x=Math.sign(target.x+s.x);target.y=Math.sign(target.y+s.y);target.fire||=s.fire;return target;},
  destroy(){clear();for(const unlisten of listeners)unlisten();panel.remove();host.classList.remove('atari-touch-host');screen?.classList.remove('atari-stick-screen');for(const node of legacy)node.classList.remove('atari-touch-legacy');if(host.parentNode!==oldParent)oldParent.insertBefore(host,oldNext);}
 };
}
root.AtariTouchJoystick={mount,direction};
})(globalThis);
