/* Original command selection, $6E07 and $6E78. Modern event collection is
 * separate; commands and pending attack consumption retain Atari semantics. */
(function(root){'use strict';
const {byte}=root.KaratekaMotion;
class Input{
 constructor(){this.pending=0;this.code=0;this.repeat=0;}
 key(code){this.code=code;this.pending=255;}
 keyboard(r,f){
  const command=c=>{this.pending=0;r.command(f,c);};let a=0;
  if(this.pending){a=this.code;if(a===33){f.move=0;this.repeat=15;if(f.running)r.kick=255;return command(155);}if(a===6){f.move=255;return command(0);}if(a===7){f.move=1;return command(0);}}
  if(f.running){if(r.punch===255)return command(194);if(r.kick===255)return command(155);if(a===21){r.punch=255;return command(194);}return command(0);}
  f.move=0;if(r.punch===255)return command(215);
  const punches={47:255,63:0,23:1},kicks={46:255,62:0,22:1};
  if(Object.hasOwn(punches,a)){r.punch=255;f.height=punches[a];return command(215);}
  if(r.kick===255)return command(197);
  if(Object.hasOwn(kicks,a)){r.kick=255;f.height=kicks[a];return command(197);}
  return command(0);
 }
 joystick(r,f,state,g){
  f.move=state.move<0?255:state.move>0?1:0;f.height=state.height<0?255:state.height>0?1:0;
  const command=c=>r.command(f,c);
  if(f.running){if(f.height>=128)return command(r.punch===255||r.kick===255?194:0);return command(155);}
  if(r.kick===255)return command(197);if(r.punch===255)return command(215);
  if(g.hawkActive&&g.hawkX<39&&g.hawkDx>=128)return command(0);
  if(g.enemyAlive&&g.kind<2&&byte(g.enemyX-f.x)<15)return command(0);
  return command(f.height>=128?155:0);
 }
}
root.KaratekaInput=Input;
})(globalThis);
