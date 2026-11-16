// Share overlapping *named scalar* state, without a machine address space.
// Metadata is also consumed by the offline original-program fixture tools.
export function linkState(values,...maps) {
  const state=structuredClone(values),entries=Object.entries(Object.assign({},...maps)).map(([name,[address,width]])=>({name,address,width}));
  const groups=[];
  for(const entry of entries.sort((a,b)=>a.address-b.address||b.width-a.width)) {
    const group=groups.at(-1);
    if(group&&entry.address<group.end){group.entries.push(entry);group.end=Math.max(group.end,entry.address+entry.width);}
    else groups.push({start:entry.address,end:entry.address+entry.width,entries:[entry]});
  }
  for(const group of groups) {
    if(group.entries.length===1){const {name,width}=group.entries[0];state[name]??=0;continue;}
    if(group.end-group.start>4)throw new Error('Unexpected scalar alias group');
    let value=0;
    for(const entry of [...group.entries].reverse()) {
      const shift=8*(entry.address-group.start),mask=(2**(entry.width*8)-1)*2**shift;
      value=((value&~mask)|((state[entry.name]??0)*2**shift))>>>0;
    }
    for(const {name,address,width}of group.entries) {
      const shift=8*(address-group.start),mask=2**(width*8)-1;
      Object.defineProperty(state,name,{enumerable:true,configurable:true,
        get:()=>Math.floor(value/2**shift)&mask,
        set:v=>{const range=mask*2**shift;value=((value&~range)|((v&mask)*2**shift))>>>0;}});
    }
  }
  return state;
}
