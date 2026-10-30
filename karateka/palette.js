/* Original cliff DLI selector ($B098-$B10A), including the two bitmap flags.
 * The native compositor repaints pixels; palette state still follows the
 * source's alternating buffers and two-step camera history. */
(function(root){'use strict';
class Palette{
 constructor(){this.flags=[255,255];this.selector=0;this.history=[{shift:1,offset:48},{shift:1,offset:48}];this.force=2;this.mode='climb';this.side=0;}
 select(g,previous,force){
  const c=g.camera,quiet=c.room||c.offset<35||c.shift===previous.shift&&c.offset===previous.offset&&g.hero.x>=16&&g.enemy.x>=19&&!force;
  if(quiet){if(g.buffer!==32){if(!this.flags[1])return this.selector;this.flags[1]=0;this.selector=1;}if(this.flags[0]){this.flags[0]=0;this.selector=1;}}
  else{const index=g.buffer===32?0:1;if(!this.flags[index]){this.flags[index]=255;this.selector=0;}}
  return this.selector;
 }
 update(g){if(g.mode!==this.mode||g.playerSide!==this.side)this.force=2;this.mode=g.mode;this.side=g.playerSide;g.palette=this.select(g,this.history[1],this.force);this.history=[{shift:g.camera.shift,offset:g.camera.offset},this.history[0]];if(this.force)this.force--;}
}
root.KaratekaPalette=Palette;
})(globalThis);
