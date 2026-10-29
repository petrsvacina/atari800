/* Shared presentation-only localisation. Generated with each game's catalogue. */
(function(root){'use strict';
const english=new URLSearchParams(root.location?.search||'').get('lang')==='en';
const messages=root.ATARI_GAME_MESSAGES,upper=new Map(),patterns=[],cache=new Map();
const normalize=value=>value.replace(/\s+/gu,' ').trim();
const quote=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
for(const[source,target]of Object.entries(messages)){
 upper.set(source.toLocaleUpperCase('cs'),target.toLocaleUpperCase('en'));
 if(!source.includes('{'))continue;
 const parts=source.split(/(\{\w+\})/g),names=parts.filter(p=>/^\{\w+\}$/.test(p)).map(p=>p.slice(1,-1));
 for(const caps of [false,true]){
  const expression=parts.map(p=>/^\{\w+\}$/.test(p)?'(.+?)':quote(caps?p.toLocaleUpperCase('cs'):p)).join('');
  const translated=caps?target.split(/(\{\w+\})/g).map(p=>/^\{\w+\}$/.test(p)?p:p.toLocaleUpperCase('en')).join(''):target;
  patterns.push({re:new RegExp('^'+expression+'$','u'),names,target:translated,specificity:parts.filter(p=>!/^\{\w+\}$/.test(p)).join('').length});
 }
}
patterns.sort((a,b)=>b.specificity-a.specificity);
function exact(value){return messages[value]??upper.get(value)??value;}
function t(value){
 if(!english||typeof value!=='string'||!value.trim())return value;
 if(cache.has(value))return cache.get(value);
 const source=normalize(value);let translated=exact(source);
 if(translated===source)for(const pattern of patterns){const match=pattern.re.exec(source);if(!match)continue;
  const values=Object.fromEntries(pattern.names.map((name,i)=>[name,exact(match[i+1])]));
  translated=pattern.target.replace(/\{(\w+)\}/g,(_,name)=>values[name]);break;
 }
 const result=translated===source?value:value.match(/^\s*/u)[0]+translated+value.match(/\s*$/u)[0];
 if(cache.size>=4096)cache.clear();cache.set(value,result);return result;
}
function translateTree(node){
 for(const child of [...node.childNodes]){
  if(child.nodeType===3){child.nodeValue=t(child.nodeValue);continue;}
  if(child.nodeType!==1||['SCRIPT','STYLE','NOSCRIPT'].includes(child.tagName))continue;
  for(const name of ['aria-label','title','placeholder','alt'])if(child.hasAttribute(name))child.setAttribute(name,t(child.getAttribute(name)));
  if(child.tagName==='META'&&child.getAttribute('name')==='description')child.setAttribute('content',t(child.getAttribute('content')));
  translateTree(child);
 }
}
function html(value){if(!english)return value;const fragment=document.createElement('template');fragment.innerHTML=value;translateTree(fragment.content);return fragment.innerHTML;}
root.AtariI18n={language:english?'en':'cs',locale:english?'en-GB':'cs-CZ',t,html};
if(english&&root.document){
 document.documentElement.lang='en';translateTree(document.documentElement);
 const brand=document.querySelector('a.brand'),href=brand?.getAttribute('href');
 if(href&&/^(?:\.\/)?index\.html$/.test(href))brand.setAttribute('href',href+'?lang=en');
}
})(globalThis);
