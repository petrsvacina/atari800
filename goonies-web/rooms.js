/* Native room mechanisms translated from the supplied game's puzzle routines. */
(function(root){
  'use strict';
  const byte=n=>n&255, signed=n=>n>127?n-256:n;
  class Rooms {
    constructor(game){
      this.game=game;this.room=game.originalScene.sourceRoomId;
      this.data=root.GOONIES_MECHANISMS[this.room];this.draw=[];this.afterDraw=[];this.actorDraw=[];this.actors=[];this.update=0;
      this.bats=[];this.batClock=this.room===6?(game.randomByte()&63)+62:96;
      if(this.room===2){this.bucketY=[21,21,21,92];this.bucketDirection=[0,0,0,0];this.bucketClocks=[...this.data.bucketDelays];this.weightY=74;this.ballX=111;this.ballY=120;this.pumpPhase=0;this.key=false;this.shine=5;}
      if(this.room===1){this.valves=0;this.burst=0;this.npcX=this.data.npcStops[this.data.npcOrder[0]];this.npcOrder=0;this.npcWait=0;this.npcAtStop=false;this.water=0;this.gun={...game.originalScene.actors[2]};this.gunClock=[4,4];this.gunAim=0;this.gunWait=0;this.gunEnabled=false;this.bullet=null;}
      if(this.room===5){this.plates=[0,0,0];this.doorCooldown=[0,0];this.surface=Array.from({length:8},()=>({speed:7,phase:0,column:(game.randomByte()&31)+6}));this.actors=game.originalScene.actors.slice(2).filter(a=>a.type).map(a=>({...a}));}
      if(this.room===3){this.boards=3;this.hammer=6;this.hammerClock=0;this.stone={...game.originalScene.actors[2],controls:25};this.stoneRectangles=this.data.stoneRectangles.map(r=>({...r}));this.seat=false;this.actors=[this.stone];}
      if(this.room===4){this.pile=0;this.springs=[0,0];this.springPhase=0;this.doorCooldown=[0,0];this.birdClock=127;this.bird=null;this.eggs=[];}
      if(this.room===6){this.cage={...game.originalScene.actors[2]};this.cageRectangles=this.data.cageRectangles.map(r=>({...r}));this.cageReleased=false;this.draining=false;this.waterY=123;this.waterPhase=0;this.headPhase=1;this.bubbleIndices=[1,2,3,4,5,6,7,0,8,9,1,2,3,4,5,6];this.actors=[this.cage];}
      if(this.room===7){this.mother={...game.originalScene.actors[2],controls:31};this.chestX=128;this.liftY=90;this.coins=[];this.coinClock=0;this.coinsLeft=4;this.distracted=false;this.motherPhase=238;this.actors=[this.mother];}
    }
    overlap(n,x1,y1,x2=x1,y2=y1){return this.game.nativeOverlap(n,{x1,y1,x2,y2});}
    children(x1,y1,x2=x1,y2=y1){return this.game.players.filter(p=>!p.escaped&&this.overlap(p.native,x1,y1,x2,y2));}
    prop(key,column,y,height){if(key)(this.renderAfter?this.afterDraw:this.collectActorDraw?this.actorDraw:this.draw).push({frame:this.data.frames[key],column,y,height});}
    propAfter(key,column,y,height){this.renderAfter=true;this.prop(key,column,y,height);this.renderAfter=false;}
    sprite(n){this.actors.push(n);}
    danger(x1,y1,x2=x1,y2=y1,message='Pozor na past. Zkus pohyb jinak načasovat.'){
      if(this.children(x1,y1,x2,y2).length)this.game.hurt(message);
    }
    both(x1,y1,x2=x1,y2=y1){return this.children(x1,y1,x2,y2).length===2;}
    finish(){this.game.finishScene();}
    frame(logical,x,y){const frame=this.game.originalScene.frames[logical]?.[x&3];if(frame)this.draw.push({frame,column:Math.floor(x/4),y});}
    step(inputs){this.update++;this.draw=[...this.actorDraw];this.afterDraw=[];if(this.room===2)this.buckets();else if(this.room===1)this.valvesRoom();else if(this.room===5)this.organ(inputs);else if(this.room===3)this.rocksRoom();else if(this.room===4)this.eggsRoom(inputs);else if(this.room===6)this.octopus();else if(this.room===7)this.ship();}
    controls(value){return{up:!(value&1),down:!(value&2),left:!(value&4),right:!(value&8),jumpDisabled:!!(value&16)};}
    moveObject(n,input,rectangles){const frame=n.frame;root.GooniesMovement.step(n,input,rectangles,root.GOONIES_ORIGINAL.bodyWidths,root.GOONIES_ORIGINAL.bodyHeights,this.game.contacts);n.frame=frame;}
    buckets(){
      const d=this.data,g=this.game;
      this.pumpPhase=byte(this.pumpPhase+1);
      for(let i=2;i>=0;i--)this.prop(d.pumpFrames[d.pumpPhases[(i+this.pumpPhase)&3]],d.pumpColumns[i],d.pumpRows[i]);
      for(let i=2;i>=0;i--){
        this.bucketClocks[i]-=this.bucketDirection[i]===0?6:1;
        if(this.bucketClocks[i]<0){this.bucketClocks[i]=d.bucketDelays[i];
          if(this.bucketDirection[i]<0){this.bucketY[i]--;if(this.bucketY[i]<25)this.bucketDirection[i]=0;}
          else {this.bucketY[i]+=3;if(this.bucketY[i]>=39)this.bucketDirection[i]=-1;}
        }
        this.pailWalls(i);
      }
      const bottom=this.bucketY.slice(0,3).map(y=>128-y);
      for(let i=3;i>=0;i--)this.prop(d.ropeFrame,d.pailColumns[i],(this.bucketY[i]&1)+d.ropeTopY[i],this.bucketY[i]-d.ropeTopOffset[i]);
      for(let i=2;i>=0;i--){
        this.prop(d.pailFrame,d.pailColumns[i],this.bucketY[i]+3);
        if(bottom[i]>=103){this.prop(d.bucketBottom,d.bottomColumns[i]+1,117);this.prop(d.bucketFrames[1],d.bottomColumns[i],bottom[i]);}
        else this.prop(d.bucketFrames[0],d.bottomColumns[i],bottom[i]);
        this.prop(d.ropeFrame,d.bottomColumns[i],(bottom[i]&1)+d.ropeBottomY[i],bottom[i]-d.ropeBottomOffset[i]);
        this.danger(d.bottomColumns[i]*4+2,bottom[i],d.bottomColumns[i]*4+3,bottom[i]+4,'Pozor na spodní vědro.');
      }
      const weightOn=this.children(129,this.weightY,140,this.weightY+1);
      if(weightOn.length){this.weightY=Math.min(108,this.weightY+1);for(const p of weightOn)p.jumpDisabled=true;g.rectangles[19].type=128;}
      else {if(this.weightY>=74)this.weightY--;g.rectangles[19].type=this.weightY>=92?1:128;}
      Object.assign(g.rectangles[20],{y1:this.weightY,y2:this.weightY});
      this.prop(d.ropeFrame,32,(this.weightY&1)+56,this.weightY-69);
      this.prop(d.counterweightFrame,32,this.weightY-13);
      let y=this.bucketY[3];y=this.bucketDirection[3]<0?Math.max(72,y-1):Math.min(88,y+1);this.bucketY[3]=y;this.pailWalls(3);
      const crankOn=this.children(57,180,58,191).length>0;this.bucketDirection[3]=crankOn?-1:0;
      this.prop(d.pailFrame,d.pailColumns[3],y);
      this.prop(d.crankFrames[(y^3)&3],14,158);
      const chosen=g.players[g.selected],other=g.players[1-g.selected],hit=p=>this.overlap(p.native,this.ballX,117,this.ballX+5,123);
      if(hit(chosen)||g.mode==='two'&&hit(other)){
        const p=hit(chosen)?chosen:other;p.native.vx=-p.native.vx;
        const x=this.ballX+p.native.vx;if(x<112)this.ballX=x<40?39:x;
      } else if(!hit(other))this.ballX=Math.min(112,this.ballX+1);
      Object.assign(g.rectangles[21],{type:3,x1:this.ballX,x2:this.ballX+5});
      const oldY=this.ballY;if(this.update%5===0)this.ballY^=1;g.rectangles[21].y1=g.rectangles[21].y2=this.ballY;
      this.prop(d.ballFrames[this.ballX&3],Math.floor(this.ballX/4),oldY);
      if(!this.key){this.prop(d.keyFrame,2,162);if(this.children(35,79,41,79).length){this.key=true;g.once('key','Klíč je váš. Oba se vraťte k levým dolním dveřím.',200);}
        else {if(--this.shine<0)this.shine=10;if(this.shine<5)this.prop(d.keyShine,9,79);}}
      g.state.key=this.key;
      if(this.key&&this.both(13,160,13,176))this.finish();
      this.danger(40,125,117,125,'Voda v prostřední komoře je nebezpečná.');
      for(const p of g.players)g.syncBody(p);
      if(!this.bats.length&&--this.batClock<0){this.batClock=64;this.spawnBat(0,1);}
    }
    pailWalls(i){
      const d=this.data,g=this.game,y=this.bucketY[i],x=d.pailColumns[i]*4+2,index=d.bucketWalls[i];
      Object.assign(g.rectangles[index],{type:1,y2:y+21});Object.assign(g.rectangles[index+1],{type:0,y2:y+21});
      if(this.bucketDirection[i]>=0)this.danger(x,y,x+4,y+21,'Vědro tě přimáčklo. Počkej na jeho zdvih.');
    }
    valvesRoom(){
      const d=this.data,g=this.game;this.actors=[];
      g.rectangles[31].type=this.burst?129:1;
      this.renderAfter=true;this.valveNpc();
      this.valves=0;for(let i=2;i>=0;i--)this.valves=(this.valves<<1)|(this.children(d.valveX[i],d.valveY[i]).length?1:0);
      if(this.valves===3&&!this.burst){this.burst=1;g.once('pipe','Oba ventily jsou zavřené. Tlak roztrhl potrubí!',200);}
      for(let i=2;i>=0;i--){const route=d.routes[i*8+this.valves];if(route&128)continue;
        this.danger(d.hazardX[i],d.hazardY[i],d.hazardX[i]+4,d.hazardY[i]+4,'Pozor na proud vody z potrubí.');
        const phase=(this.update&1)?2:0,variant=route+phase;
        this.prop(d.streamFrames[variant],d.streamColumns[i]+d.streamDX[variant],d.streamRows[i]+d.streamDY[variant]);
      }
      if(this.burst){if(this.burst<5)this.prop(d.burstFrames[this.burst++-1],34,100);}
      else this.prop(d.spoutFrames[(this.valves&2)?1:0],35,96);
      g.state.opened=!!this.burst;g.state.valves=[!!(this.valves&1),!!(this.valves&2)];
      this.valveBullet();this.renderAfter=false;
      if(this.burst&&this.both(144,96,144,112))this.finish();
    }
    valveNpc(){
      const d=this.data;
      if(this.water){const target=d.npcOrder[this.npcOrder];
        for(const [columns,rows] of [[d.dropCol1,d.dropY1],[d.dropCol2,d.dropY2]])this.danger(columns[target]*4+2,rows[target]-this.water,columns[target]*4+2,rows[target]-this.water+4,'Pozor na vodu, kterou pouští Fratelli.');
      }
      const target=d.npcOrder[this.npcOrder],goal=d.npcStops[target];
      if(!this.npcAtStop){
        if(byte(this.npcX-goal)<3){this.npcAtStop=true;this.water=16;this.npcWait=24;this.npcX=goal;}
        else this.npcX+=this.npcX<goal?2:-2;
        const phase=(this.npcX&2)+(this.npcX>goal?1:0);this.prop(d.npcFrames[phase],Math.floor(this.npcX/4),30);
      } else {
        if(!this.npcWait){this.npcOrder=(this.npcOrder+1)&15;this.npcAtStop=false;}else this.npcWait--;
        this.prop(d.npcFrames[(this.npcWait&4)?4:5],Math.floor(this.npcX/4),28);
        if(this.water){this.water--;for(const [columns,rows] of [[d.dropCol1,d.dropY1],[d.dropCol2,d.dropY2]])this.prop(d.waterFrames[(this.update&1)?0:1],columns[target],rows[target]-this.water);}
      }
    }
    valveGun(){
      const d=this.data,g=this.game,n=this.gun;
      if(this.gunClock[0]||this.gunClock[1]){this.gunClock[0]=byte(this.gunClock[0]-1);if(!this.gunClock[0])this.gunClock[1]=byte(this.gunClock[1]-1);if(!this.burst)this.gunEnabled=false;}
      if(this.burst||!(this.gunClock[0]||this.gunClock[1])) {
        this.gunEnabled=true;const goal=d.gunHeight[this.gunAim&15];
        if(!this.gunWait){if(byte(goal-n.y)<2)this.gunWait=1;else this.moveObject(n,{[goal<n.y?'up':'down']:true},g.rectangles);}
        if(this.gunWait){this.gunWait++;if(this.gunWait>=96){this.gunWait=0;this.gunAim=(this.gunAim+1)&15;}
          else if(this.gunWait===40){const y=d.bulletHeight[this.gunAim];if(this.children(5,y,152,y+12).length)this.bullet={x:5,age:1,aim:this.gunAim};}}
      }
      if(this.gunEnabled){let frame=this.gunWait?(this.gunWait<28?0:1):n.climb?(n.y&2)?3:2:0;this.prop(d.gunFrames[frame],Math.floor(n.x/4),n.y);}
    }
    valveBullet(){
      const d=this.data;
      if(this.bullet){const b=this.bullet;b.x++;if(b.x>=d.bulletEnd[b.aim])this.bullet=null;else{b.age++;this.danger(b.x*4,d.bulletHeight[b.aim],b.x*4+4,d.bulletHeight[b.aim],'Zásah střelou.');this.prop(d.bulletFrames[b.age<3?0:1],b.x,d.bulletHeight[b.aim]);}}
    }
    organ(inputs){
      const d=this.data,g=this.game;
      for(let i=0;i<3;i++)if(this.plates[i])this.plates[i]--;
      const mask=this.plates.reduce((a,v)=>(a<<1)|(v?1:0),0),types=d.platformTypes[mask];
      for(let i=12;i>=0;i--){g.rectangles[19+i].type=types[i];if(!(types[i]&128))this.prop(d.platformFrames[d.platformColors[i]>>1],d.platformColumns[i],d.platformRows[i]);}
      let inDoor=false;for(let i=0;i<2;i++)if(this.children(d.doorMarkerX[i],d.doorMarkerY[i]).length)inDoor=true;
      if(inDoor){
        for(let i=1;i>=0;i--)for(const p of g.players){if(!this.doorCooldown[p.id]&&(g.mode==='two'||g.selected===p.id)&&inputs[p.id]?.right&&this.overlap(p.native,d.doorX[i],d.doorY[i])){
          p.native.x=byte(p.native.x+signed(d.doorDX[i]));p.native.y=byte(p.native.y+signed(d.doorDY[i]));this.doorCooldown[p.id]=4;g.emit('door');}}
      } else this.prop(d.doorFrame,20,145);
      for(const p of g.players){if(this.doorCooldown[p.id]){this.doorCooldown[p.id]--;p.native.frame|=128;}else p.native.frame&=127;g.syncBody(p);}
      this.danger(2,178,160,178,'Voda dole je příliš hluboká. Použij plovoucí stupínky.');
      for(let i=2;i>=0;i--){if(this.children(d.plateX[i],121).length)this.plates[i]=4;this.prop(d.plateFrames[i],d.plateColumns[i],121+(this.plates[i]?2:0));}
      if(this.both(146,161))this.finish();
      for(let i=7;i>=0;i--){const s=this.surface[i];s.phase-=s.speed;if(s.phase<0){s.column=(g.randomByte()&31)+2;if(s.column<6)s.column+=8;s.speed=(g.randomByte()&7)||1;s.phase=s.speed+28;}this.prop(d.surfaceFrame,s.column,175+Math.floor(s.phase/4));}
    }
    rocksRoom(){
      const d=this.data,g=this.game;
      if(!this.hammerClock&&this.alarmPending){this.spawnBat(d.alarmPaths[this.alarmIndex++]);this.alarmPending--;}
      for(let i=0;i<9;i++)this.stoneRectangles[d.gateIndices[i]].type=d.gateClosedTypes[i];
      for(let gate=0;gate<3;gate++)if(this.children(97,31+gate*40).length)for(let i=gate*3;i<gate*3+3;i++)this.stoneRectangles[d.gateIndices[i]].type=d.gateOpenTypes[i];
      this.seat=this.children(88,174,88,188).length>0;
      const seat=this.seat?1:0;this.prop(d.seatFrames[seat],d.seatColumns[seat],d.seatRows[seat]);this.prop(d.trapFrames[seat],d.trapColumns[seat],d.trapRows[seat]);
      for(let i=0;i<this.boards;i++)this.prop(d.boardFrame,5,d.boardRows[i]);g.rectangles[16].type=this.boards?3:131;
      if(this.hammer>=7){this.hammer=0;this.hammerClock=6;this.alarmPending=5;this.alarmIndex=0;}
      let hammer=this.hammer;if(this.hammerClock){this.hammerClock--;hammer=this.hammerClock;}
      this.prop(d.hammerFrames[hammer],d.hammerColumns[hammer],d.hammerRows[hammer]);
      for(let i=8;i>=0;i--)if(d.gateVisible[i]&&!((this.stoneRectangles[d.gateIndices[i]].type^d.gateSigns[i])&128))this.prop(d.gateFrames[i],d.gateColumns[i],d.gateRows[i]);
      g.state.boards=this.boards;
      if(this.both(20,186,28,186)){g.lives=Math.min(9,g.lives+3);this.finish();}
    }
    stoneActor(){
      const d=this.data,n=this.stone,g=this.game;
      if(this.overlap(n,67,163,76,172))n.controls=this.seat?25:21;
      else for(let i=32;i>=21;i--){const r=this.stoneRectangles[i];if(!this.overlap(n,r.x1-1,r.y1,r.x2+1,r.y2))continue;const k=i-21;
        if(!(k<6&&(r.type&128)))n.controls=d.stoneControls[k];
        if(d.stoneReset[k]){if(k===11)this.hammer++;if(k===10&&this.boards){this.boards--;g.addScore(35);g.emit('puzzle');}Object.assign(n,{x:144,y:18,vx:0,vy:0,climb:0,direction:0,moving:0,frame:30,controls:25});}break;}
      this.moveObject(n,this.controls(n.controls),this.stoneRectangles.slice(0,23));
    }
    octopus(){
      const d=this.data,g=this.game,n=this.cage;
      for(let i=2;i>=0;i--)for(const actor of [n,g.players[1].native,g.players[0].native])if(this.overlap(actor,d.currentX1[i],d.currentY1[i],d.currentX2[i],d.currentY2[i])&&g.randomByte()<112&&actor.vx+1<3)actor.vx++;
      for(const p of g.players)g.syncBody(p);
      Object.assign(g.rectangles[0],{type:this.cageReleased?3:131,x1:n.x+2,x2:n.x+2,y1:n.y,y2:n.y});
      if(!this.cageReleased&&this.children(48,44).length){this.cageReleased=true;g.once('cage','Klec se uvolnila. Posuň ji pod spodní zarážku.',50);}
      const lock=this.children(36,142).length>0;g.rectangles[33].type=lock?6:134;
      if(!lock)this.prop(d.lockFrame,9,112);
      for(let i=1;i>=0;i--){const touched=this.children(d.flipperX1[i],d.flipperY1[i],d.flipperX2[i],d.flipperY2[i]).length>0;
        if(touched&&(i!==0||lock)){if(i===0&&!this.draining){this.draining=true;g.once('drain','Voda odtéká a chobotnice klesá. Oba do pravého tunelu!',500);}this.prop(d.flipperFrames[i],d.flipperColumns[i],d.flipperRows[i]);}
        else this.prop(d.flipperIdleFrames[i],d.flipperIdleColumns[i],d.flipperIdleRows[i]);}
      if(this.draining&&this.waterY<150)this.waterY++;
      if(this.update%5===0)this.headPhase=(this.headPhase+1)&3;if(this.update%20===0)this.waterPhase=(this.waterPhase+1)&3;
      const offset=d.waterOffset[this.waterPhase];this.prop(d.waterFrames[this.waterPhase],30,this.waterY+offset);
      const headY=this.waterY-d.headOffset[this.headPhase]+offset+1;this.prop(d.headFrames[this.headPhase],29,headY);
      this.danger(124,headY,136,171,'Chobotnice hlídá cestu. Nejdřív vypusť její jezírko.');this.danger(102,159,107,186,'Pozor na proud vody.');
      for(let i=15;i>=0;i--){const lane=i&3,idx=this.bubbleIndices[i],path=d.bubbles[lane],x=path.x[idx],y=path.y[idx];if(x){this.prop(d.bubbleFrames[x&3],Math.floor(x/4),y);if(this.update%3===0)this.bubbleIndices[i]++;}else this.bubbleIndices[i]=0;}
      g.state.cageDropped=this.cageReleased;g.state.drained=this.waterY===150?3:0;
      if(this.both(141,119))this.finish();
      if(--this.batClock<0){this.batClock=84+(g.randomByte()&63);if(this.bats.length<3)this.spawnBat(g.randomByte()<112?9:7);}
    }
    cageActor(){
      const n=this.cage,g=this.game;
      for(const p of g.players.filter(p=>g.mode==='two'||p.id===g.selected)){
        if(this.overlap(p.native,n.x,n.y,n.x,n.y+8)&&p.native.vx>0)n.vx=p.native.vx;
        else if(this.overlap(p.native,n.x+8,n.y,n.x+8,n.y+8)&&p.native.vx<0)n.vx=p.native.vx;
      }
      this.moveObject(n,{down:this.cageReleased},this.cageRectangles);
    }
    ship(){
      const d=this.data,g=this.game;
      let switches=0;for(let i=0;i<4;i++)switches=(switches<<1)|(this.children(d.switchX[i],d.switchY[i]).length?1:0);
      let mask=d.switchMasks[switches];for(let i=2;i>=0;i--)if(this.children(d.extraX[i],d.extraY[i]).length)mask|=d.extraMasks[i];
      for(let i=2;i>=0;i--){const open=!!(mask&(1<<(2-i)));this.prop(d.hatchFrames[open?1:0],d.hatchColumns[i],d.hatchRows[i]);g.rectangles[d.hatchFloor[i]].type=open?4:3;g.rectangles[d.hatchCeiling[i]].type=open?128:2;}
      const oldLift=this.liftY,sloth=g.players.find(p=>p.native.baseFrame!==0);
      if(sloth&&this.overlap(sloth.native,81,126)){if(this.liftY>=47)this.liftY--;}else if(this.liftY<90)this.liftY++;
      g.rectangles[45].y1=g.rectangles[45].y2=this.liftY;g.rectangles[46].y1=this.liftY+3;g.rectangles[46].y2=this.liftY+6;
      this.prop(d.liftFrame,22,oldLift);
      for(const p of g.players.filter(p=>g.mode==='two'||p.id===g.selected))if(this.overlap(p.native,this.chestX,64)&&p.native.vx>0&&this.chestX+p.native.vx<144)this.chestX+=p.native.vx;
      if(this.chestX>=134){g.rectangles[52].type=4;if(this.coinsLeft){if(this.coinClock)this.coinClock--;else if(this.coins.length<4){this.coinClock=3;this.coins.push({y:56});this.coinsLeft--;if(this.coinsLeft===2){this.distracted=true;g.once('treasure','Mince odlákaly Fratelliovou. Přiveď oba Goonies k pokladu.',0);}}}}
      else g.rectangles[52].type=128;
      this.prop(d.hatchFrames[this.chestX>=134?1:0],18,139);
      this.prop(d.chestFrames[(this.chestX>=134?4:0)+(this.chestX&3)],Math.floor(this.chestX/4),57);
      for(const coin of this.coins){coin.y+=5;if(coin.y<180)this.prop(d.coinFrame,35,coin.y);}this.coins=this.coins.filter(c=>c.y<180);
      this.danger(137,178,159,178,'Pozor na moře za lodí.');
      if(this.mother.type!==0&&this.mother.type!==15&&this.overlap(this.mother,137,178,159,178)){this.mother.type=15;this.mother.moving=8;g.addScore(100);}
      const pulley=(this.liftY&12)>>2;this.propAfter(d.pulleyFrames[pulley],19,d.pulleyY[pulley]);
      g.state.treasure=this.chestX>=134;g.state.boomRaised=this.liftY<48;
      if(this.both(144,64))this.finish();
    }
    shipMother(){
      const n=this.mother,g=this.game,d=this.data;
      if(!n.type)return;if(n.type===15){if(!n.moving)n.type=0;else{n.moving--;n.frame=n.moving>=4?28:29;}return;}
      root.GooniesMovement.step(n,this.controls(n.controls),g.rectangles,root.GOONIES_ORIGINAL.bodyWidths,root.GOONIES_ORIGINAL.bodyHeights,g.contacts);
      if((this.update+1)%5===0)this.motherPhase++;
      const child=g.players.find(p=>p.native.baseFrame===0);
      if(this.distracted)n.controls=23;
      else if(child&&this.overlap(child.native,92,117,132,132)){
        if((child.native.x&254)===(n.x&254)){n.frame=24+(this.motherPhase&1);n.controls=31;}
        else n.controls=n.x<(child.native.x&254)?23:27;
      }else{n.controls=27;n.frame=d.motherIdleFrames[this.motherPhase&3];}
      if(child&&this.overlap(child.native,n.x+2,n.y+4,n.x+5,n.y+16))g.hurt('Fratelliová tě chytila. Sloth musí nejdřív odlákat její pozornost.');
    }
    eggsRoom(inputs){
      const d=this.data,g=this.game;
      this.portals(inputs);
      this.springPhase=(this.springPhase+(this.update%3===0?1:0))%3;
      for(let i=1;i>=0;i--){let pressed=this.children(d.springX[i],d.springY[i],d.springX[i]+3,d.springY[i]).length>0;if(i===0)pressed=!pressed;this.springs[i]=pressed?0:2;
        this.prop(d.springFrames[this.springPhase*2+(pressed?0:1)],d.springColumns[i],d.springRows[i]);if(!pressed)this.danger(d.lavaX[i],d.lavaY[i],d.lavaX[i],d.lavaY[i],'Pozor na lávu.');}
      const y=d.pileY[this.pile];g.rectangles[30].y1=g.rectangles[31].y1=g.rectangles[31].y2=y;
      for(let i=this.pile;i>=0;i--)this.prop(d.pileFrame,32,d.pileY[i]);
      if(this.both(142,138))this.finish();
      if(!this.bird||this.bird.frame&128){if(--this.birdClock<0){this.birdClock=64;let path=g.randomByte()&3;if(this.pile>=4&&path===3)path=2;const routeX=d.birdArrivalX[path],routeY=d.birdArrivalY[path];this.bird={type:9,x:routeX[0],y:routeY[0],vx:routeX[0],vy:routeY[0],frame:32,moving:32,climb:path,direction:1,baseFrame:0};}}
      if(this.bird&&this.bird.direction&&!(this.bird.frame&128))this.frame(31,this.bird.x+6,this.bird.y+13);
      this.actors=[...(this.bird?[this.bird]:[]),...this.eggs.filter(n=>n.type)];g.state.eggs=this.pile;
    }
    portals(inputs){
      const d=this.data,g=this.game;
      for(let i=5;i>=0;i--)for(const p of g.players)if(!this.doorCooldown[p.id]&&(g.mode==='two'||g.selected===p.id)&&this.overlap(p.native,d.doorX[i],d.doorY[i])&&(d.doorControls[i]===8?inputs[p.id]?.right:inputs[p.id]?.left)){
        p.native.x=byte(p.native.x+signed(d.doorDX[i]));p.native.y=byte(p.native.y+signed(d.doorDY[i]));this.doorCooldown[p.id]=4;g.emit('door');}
      for(const p of g.players){if(this.doorCooldown[p.id]){this.doorCooldown[p.id]--;p.native.frame|=128;p.freezeInput=true;}else p.native.frame&=127;g.syncBody(p);}
    }
    eggActor(n,inputs){
      const d=this.data,g=this.game;
      if(n.type===11){if(n.direction){n.direction--;n.frame=38;}else n.type=0;return;}
      if(n.type===10){this.pathActor(n,d.birdPathsX[n.climb],d.birdPathsY[n.climb],40,false);return;}
      if(!n.direction){n.type=10;n.direction=0;n.moving=0;n.climb=(n.y>=104?2:0)+(n.x>=88?1:0);n.baseFrame=0;n.vx=d.birdTargetX[n.climb];n.vy=d.birdTargetY[n.climb];n.frame|=128;return;}
      if(n.direction<8)n.frame=38;if((this.update+1)%3===0)n.direction--;
      let input={};for(const p of g.players.filter(p=>g.mode==='two'||g.selected===p.id)){const edge=p.native.vx<0?n.x+5:n.x-1;if(this.overlap(p.native,edge,n.y,edge,n.y+6)){input={left:!!inputs[p.id]?.left,right:!!inputs[p.id]?.right};break;}}
      for(let i=5;i>=0;i--){if(this.overlap(n,d.doorX[i]-2,d.doorY[i]-2,d.doorX[i]+4,d.doorY[i]+6)&&(d.doorControls[i]===8?input.right:input.left)){n.x=byte(n.x+signed(d.eggDoorDX[i]));n.y=byte(n.y+signed(d.doorDY[i]));n.hiddenClock=4;break;}}
      if(n.hiddenClock){n.hiddenClock--;n.frame|=128;input={};}else n.frame&=127;
      const countdown=n.direction;n.direction=0;this.moveObject(n,input,d.eggRectangles);n.direction=countdown;
      for(let i=1;i>=0;i--)if(this.springs[i]&&this.overlap(n,d.lavaX[i]-4,d.lavaY[i],d.lavaX[i]+4,d.lavaY[i])){n.type=11;n.y+=4;n.direction=2;}
      if(this.overlap(n,136,182)){n.type=0;if(this.pile<4){this.pile++;g.addScore(50);g.emit('puzzle');}}
    }
    pathActor(n,xs,ys,frameBase,bird){
      if(n.frame&128&&bird)return;
      if(!bird&&n.direction){n.direction--;n.frame|=128;return;}
      let x=n.x&254,y=n.y&254,dx=Math.sign((n.vx&254)-x),dy=Math.sign((n.vy&254)-y);
      n.x=x+dx*2;if(dx||dy)n.y=y+dy*2;
      if(!dx&&!dy){
        for(let retry=0;retry<4;retry++){
          n.baseFrame++;n.vx=xs[n.baseFrame];n.vy=ys[n.baseFrame];
          if(n.vy===255||n.vy===undefined){n.frame|=128;if(!bird)n.type=0;return;}
          if(n.vy===0){if(bird){if(this.eggs.filter(e=>e.type).length<8){this.eggs.push({type:8,x:n.x+6,y:n.y+13,vx:0,vy:0,frame:31,direction:112,moving:0,climb:0,baseFrame:0});n.direction=0;}continue;}
            n.direction=4;n.baseFrame++;n.x=n.vx=xs[n.baseFrame];n.y=n.vy=ys[n.baseFrame];n.frame|=128;
          }break;
        }
      }
      if(!bird&&n.direction){n.direction--;n.frame|=128;return;}
      this.danger(n.x+(bird?3:0),n.y,n.x+(bird?13:4),n.y+(bird?11:8),bird?'Pozor na velkého ptáka.':'Vejce se vylíhlo. Příště ho pošli dolů včas.');
      n.moving=(n.moving+1)%3;let direction=bird&&(dx>0||!dx&&((n.frame&127)>=35))?3:0;n.frame=frameBase+n.moving+direction;
    }
    spawnBat(path=0,direction=0){
      const route=this.data.batPaths[path];if(!route)return;
      this.bats.push({type:4,x:route.x[0],y:route.y[0],vx:route.x[0],vy:route.y[0],frame:16,moving:16,climb:path,direction,baseFrame:0});
    }
    batActors(){
      const d=this.data;
      for(const n of this.bats){let x=n.x&254,y=n.y&254,dx=Math.sign((n.vx&254)-x),dy=Math.sign((n.vy&254)-y);n.x=x+dx*2;if(dx||dy)n.y=y+dy*2;
        if(!dx&&!dy){for(let repeat=0;repeat<6;repeat++){const p=d.batPaths[n.climb];n.baseFrame++;n.vx=p.x[n.baseFrame];n.vy=p.y[n.baseFrame];if(n.vy===255||n.vy===undefined){n.type=0;break;}if(n.vy===0){if(n.direction){if(this.bucketY?.[3]<80){n.climb=1;n.baseFrame=-1;}}else if(this.game.randomByte()<128){n.climb=d.batBranches[n.climb];n.baseFrame=-1;}continue;}break;}}
        if(n.type){this.danger(n.x,n.y,n.x+4,n.y+4,'Pozor na netopýra.');n.moving++;n.frame=16+(n.moving&3);}}
      this.bats=this.bats.filter(n=>n.type);
    }
    stepActors(inputs){
      this.actorDraw=[];
      if(this.room===1){this.collectActorDraw=true;this.valveGun();this.collectActorDraw=false;}
      if(this.room===3)this.stoneActor();
      if(this.room===4){if(this.bird)this.pathActor(this.bird,this.data.birdArrivalX[this.bird.climb],this.data.birdArrivalY[this.bird.climb],32,true);for(const egg of this.eggs)if(egg.type)this.eggActor(egg,inputs);}
      if(this.room===6)this.cageActor();
      if(this.room===7)this.shipMother();
      this.batActors();
      if(this.room!==5)return;
      const d=this.data,g=this.game;
      for(const n of this.actors){const lane=n.climb;
        if(n.moving){if(!n.vy){n.frame=47;n.vy=1;}else{n.y=d.dropY[lane];const before=n.moving--;n.frame=before>=7?43:44;}continue;}
        const velocity=n.vy+1;if(velocity<5)n.vy=velocity;n.y+=velocity;
        if(n.y>=d.dropEnd[lane]){if(lane>=3&&lane<6){n.y-=7;this.plates[lane-3]=16;}n.moving=(g.randomByte()&63)+(lane>=3&&lane<6?32:lane>=6?49:48);n.x=d.dropX[lane];n.vy=0;n.frame=47;}
        else {this.danger(n.x+2,n.y,n.x+2,n.y+3,'Pozor na padající kapku.');n.frame=(n.y&4)?45:46;}
      }
    }
  }
  root.GooniesRooms={Rooms};
})(globalThis);
