/* Native board evaluation and spell selection from $3F6B–$4B71.
   The tables are data; the browser executes ordinary JavaScript game rules. */
(function(root){
  'use strict';
  const D=root.ARCHON_MECHANICS,byte=n=>n&255;
  const spells=['teleport','heal','shiftTime','exchange','summonElemental','revive','imprison'];
  class BoardAI{
    constructor(game){this.g=game;this.random=()=>game.randomByte();this.side=game.turn;this.enemy=this.side==='light'?'dark':'light';this.dark=this.side==='dark';
      this.state=game.originalAIState||(game.originalAIState={injury:0,maximumHP:0});this.target=null;
      this.luma=game.rules.luminosity.hardwareLuma[game.luminosity];this.powerThreat=false;this.small=false;this.advantage=0;
    }
    get units(){return this.g.liveUnits;}
    piece(id){return this.g.units.find(u=>u.originalIndex===id)||null;}
    locate(u){this.target=u;return u?.alive?{x:u.x,y:u.y}:null;}
    used(key,side=this.side){return this.g.usedSpells[side].has(key);}
    protected(u){return !u?.alive||this.g.isPower(u.x,u.y);}
    prisoner(side){return this.units.find(u=>u.side===side&&u.imprisoned)||null;}
    get improving(){
      const g=this.g;if(g.sourceLightDirection)return this.dark?g.sourceLightDirection<0:g.sourceLightDirection>0;const index=(g.cycleIndex+g.cycleDirection+10)%10;
      let increasing=g.rules.luminosity.cycle[index]>g.luminosity;if(g.pendingEndpointFlip)increasing=!increasing;
      return this.dark?!increasing:increasing;
    }
    advanced(){
      const list=[];let maximum=0;
      for(let y=2;y<=6;y++)for(let x=this.dark?5:0;x<(this.dark?9:4);x++){
        const u=this.g.at(x,y);if(!u||u.side===this.side||u.type===(this.dark?7:15))continue;
        const hp=this.g.spec(u).hp;maximum=Math.max(maximum,hp);list.push({u,hp});
      }
      if(!list.length||list.length-1<(this.random()&3))return false;
      for(let i=list.length-1;i>=0;i--)if(list[i].hp===maximum){this.locate(list[i].u);return true;}return false;
    }
    unicorn(){
      if(this.random()&3)return false;
      for(const id of this.dark?[6,10]:[29,25]){
        const u=this.piece(id);if(this.protected(u))continue;this.locate(u);
        const terrain=this.g.terrain(u.x,u.y);
        if(terrain==='cycle'||terrain===(this.dark?'dark':'light'))return true;
      }
      return false;
    }
    enemyMage(){const mage=this.g.mage(this.enemy);if(mage)this.locate(mage);return !this.protected(mage);}
    action(key,extra={}){return{spell:key,target:this.target?.id,x:this.target?.x,y:this.target?.y,...extra};}
    spell(key,mage){
      const g=this.g,lum=this.luma,enemyPrisoner=this.prisoner(this.enemy),ownPrisoner=this.prisoner(this.side);
      if(key==='heal'){
        for(const id of this.dark?[27,29]:[8,6,10]){
          const u=this.piece(id);if(u?.alive&&u.health<6&&!this.protected(u)){this.locate(u);return this.action(key);}
        }return null;
      }
      if(key==='exchange')return null; // $4A6A is RTS: the original AI never selects it.
      if(key==='imprison'){
        if(lum===(this.dark?14:0))return null;
        if(!this.improving&&(this.used('shiftTime')||(this.dark?lum>=12:lum<4)))return null;
        if(this.enemyMage())return this.action(key);
        if(!this.improving)return null;
        if(!this.used('shiftTime',this.enemy)){
          if(this.used('shiftTime'))return null;
          if(g.firstSide===this.side&&(this.dark?lum>=10:lum<6))return null;
        }
        if(this.dark?lum<6:lum>=10)return null;
        return this.advanced()||this.unicorn()?this.action(key):null;
      }
      if(key==='shiftTime'){
        if(this.improving){
          if(lum!==0&&lum!==14)return null;
          return lum===(this.dark?0:14)||ownPrisoner?this.action(key):null;
        }
        if(this.dark?lum<8:lum>=8)return null;
        if(ownPrisoner)return g.firstSide===this.side||this.used('shiftTime',this.enemy)?this.action(key):null;
        if(enemyPrisoner)return this.action(key);
        return this.used('imprison')&&this.used('imprison',this.enemy)&&this.used('shiftTime',this.enemy)?this.action(key):null;
      }
      if(key==='summonElemental'){
        if(this.enemyMage()){
          if(this.target!==enemyPrisoner)return this.action(key);
        }else{
          if(this.advanced()){
            if(this.target!==enemyPrisoner)return this.action(key);
          }else if(!this.unicorn())return null;
        }
        if(g.terrain(this.target.x,this.target.y)==='cycle'&&(this.dark?lum>=4:lum<12))return null;
        return this.action(key);
      }
      if(key==='revive'){
        for(let y=mage.y+1;y>=mage.y-1;y--)for(let x=mage.x+1;x>=mage.x-1;x--){
          if(!g.inBoard(x,y)||g.at(x,y)||g.isPower(x,y))continue;
          const terrain=g.terrain(x,y),dark=terrain==='dark'||terrain==='cycle'&&lum<8;
          if(dark!==this.dark)continue;
          for(const id of this.dark?[29,25]:[6,10]){
            const u=this.piece(id);if(u&&!u.alive)return this.action(key,{revive:u.id,x,y});
          }
        }return null;
      }
      if(key==='teleport'){
        const exposed=this.enemyMage();
        if(exposed){
          if(this.target===enemyPrisoner&&g.terrain(this.target.x,this.target.y)==='cycle'&&(this.dark?lum>=4:lum<12))return null;
          const destination={x:this.target.x,y:this.target.y},column=this.dark?8:0;
          for(const y of [0,2,6,8,5,3]){
            const u=g.at(column,y);
            // Original $495D tests the piece index's bit 3, including its quirks.
            if(u&&((u.originalIndex^(this.dark?255:0))&8)===0){this.locate(u);return this.action(key,{...destination});}
          }return null;
        }
        if(this.random()&3)return null;
        let row;do{row=this.random()&15;}while(row>=9);
        const u=g.at(this.dark?8:0,row);if(!u||u.side!==this.side)return null;
        if((u.type&7)===3){
          if(this.random()&1)return null;
          let best=0,destination=null;
          for(let y=8;y>=0;y--)for(let x=this.dark?1:6;x<(this.dark?3:8);x++){
            const result=this.score(u,x,y);
            if(result.valid&&result.value>=best&&result.value>=48){best=result.value;destination={x,y};}
          }
          if(destination){this.locate(u);return this.action(key,destination);}return null;
        }
        const x=this.dark?0:8,y=8-row,target=g.at(x,y);if(!target)return null;
        // $49E7 compares the entire type byte with the side byte.
        if(target.type===(this.dark?255:0))return null;
        const terrain=g.terrain(x,y);
        const dark=terrain==='dark'||terrain==='cycle'&&(lum===0||lum===14);
        if(terrain==='cycle'&&lum!==0&&lum!==14)return null;
        if(dark!==this.dark)return null;
        this.locate(u);return this.action(key,{x,y});
      }
      return null;
    }
    bonus(x,y){const t=this.g.terrain(x,y),light=t==='light'?7:t==='dark'?0:this.luma>>1;return this.dark?7-light:light;}
    spellHalf(side){return this.g.usedSpells[side].size>>1;}
    score(unit,x,y){
      const index=y*9+x,occupant=this.g.at(x,y),bonus=this.bonus(x,y);
      let shield=0;
      if(y===4&&(x===0||x===8)){const owner=x===0?'light':'dark';shield=this.spellHalf(owner)*(owner===this.side?-1:1);}
      if(occupant?.side===this.side)return{valid:false,value:bonus};
      let combat=0,enemyMaximum=0,carry=0;
      // Preserve byte carries between the original chained sums/subtractions.
      const add=(a,b)=>{const sum=(a&255)+(b&255)+carry;carry=sum>255?1:0;return sum&255;};
      const sub=(a,b)=>{const difference=(a&255)-(b&255)-(carry?0:1);carry=difference>=0?1:0;return difference&255;};
      if(occupant){
        enemyMaximum=this.g.spec(occupant).hp;carry=1;
        combat=sub(enemyMaximum,occupant.health);combat=sub(combat,3);combat=sub(combat,this.state.injury);
        carry=0;combat=add(combat,shield);combat=add(combat,bonus);combat=add(combat,this.advantage);
        if(shield>=0){carry=0;combat=add(combat,shield);}
      }
      carry=0;let value=add(D.positionValues[index],bonus);value=add(value,shield);value=add(value,combat);
      if(this.small&&enemyMaximum){carry=0;value=add(this.state.maximumHP,value);carry=1;value=sub(value,enemyMaximum);}
      if(this.powerThreat&&this.g.isPower(x,y))value=byte(value+6);
      return{valid:true,value};
    }
    path(unit,x,y){
      const start=unit.y*9+unit.x,end=y*9+x,delta=end-start,distance=Math.abs(delta),entry=D.pathDistances.indexOf(distance);
      if(entry<0)return[end];
      const range=this.g.spec(unit).move,negative=delta<0;
      let pointer=D.pathStarts[entry]+(negative?96:0),length=D.pathLengths[entry],count=D.pathCounts[entry],success=false;
      const positions=[];
      const run=()=>{
        let clear=true;
        for(let j=length;j>=0;j--){const value=byte(start+D.pathOffsets[pointer++]);positions[j]=value;
          if(value<81&&this.g.at(value%9,Math.floor(value/9)))clear=false;}
        success=clear;return clear;
      };
      const edge=(distance===2&&(y===0||y===8)||distance===18&&(x===0||x===8));
      const skip=(distance===2||distance===18)&&(range<4||edge);
      if(skip&&range>=4)pointer+=6;
      if(!skip)for(let n=0;n<count;n++)if(run())return[end,...positions];
      const special=D.pathSpecial[entry];
      if(special===255)return null;
      if(special===4){
        if(range<4)pointer+=count*(length+1);length=0;
        return run()?[end,...positions.slice(0,1)]:null;
      }
      length=0;
      if(special===0){
        if(!run())return null;positions[2]=positions[0];
        if(run())pointer++;else if(!run())return null;
        positions[1]=positions[0];if(!run())return null;
      }else{
        if(run())pointer++;else if(!run())return null;
        positions[2]=positions[0];if(!run())return null;positions[1]=positions[0];
        if(!run()&&!run())return null;
      }
      return[end,...positions];
    }
    choose(){
      const g=this.g,mage=g.mage(this.side);
      if(mage&&!mage.imprisoned){
        for(const key of ['imprison','shiftTime','summonElemental','teleport','exchange','revive','heal']){
          if(this.used(key))continue;const action=this.spell(key,mage);if(action)return action;
        }
      }
      const counts=['light','dark'].map(side=>this.units.filter(u=>u.side===side).length);
      this.small=counts[0]<5||counts[1]<5;
      if(this.small)this.advantage=byte(counts[this.dark?1:0]-counts[this.dark?0:1]);
      if(counts[0]<3&&counts[1]<3&&!g.quietCounter)g.quietCounter=252;
      const powers=g.powerControl;this.powerThreat=powers.light===4||powers.dark===4;
      const candidates=this.units.filter(u=>u.side===this.side&&!u.imprisoned).sort((a,b)=>b.y*9+b.x-(a.y*9+a.x));
      for(const u of candidates){
        let origin=D.positionValues[u.y*9+u.x]-30+this.bonus(u.x,u.y);
        if(u.y===4&&u.x===(this.dark?8:0))origin-=this.spellHalf(this.side);
        if(this.powerThreat&&g.isPower(u.x,u.y))origin+=6;
        u._originalBaseline=byte(origin);
      }
      let maximum=0;
      for(let i=candidates.length-1;i>=0;i--){
        const u=candidates[i],spec=g.spec(u);this.state.maximumHP=spec.hp;this.state.injury=spec.hp-u.health;
        let best=0,destination=null;
        for(let y=Math.min(8,u.y+spec.move);y>=Math.max(0,u.y-spec.move);y--){
          const span=spec.mode==='ground'?spec.move-Math.abs(y-u.y):spec.move;
          for(let x=Math.min(8,u.x+span);x>=Math.max(0,u.x-span);x--){
            const result=this.score(u,x,y);if(!result.valid)continue;
            const value=byte(result.value-u._originalBaseline);if(value<best)continue;
            if(spec.mode==='ground'&&(value<maximum||!this.path(u,x,y)))continue;
            if(value===best){let random;do{random=this.random()&3;}while(!random);if(random>=2)continue;}
            best=value;destination={x,y};
          }
        }
        u._originalScore=best;u._originalDestination=destination;maximum=Math.max(maximum,best);
      }
      const best=candidates.filter(u=>u._originalScore===maximum);
      if(!best.length)return null;
      let index=0;
      if(best.length>1){const mask=best.length-1>=8?15:best.length-1>=4?7:3;do{index=this.random()&mask;}while(index>=best.length);}
      const unit=best[index];return unit._originalDestination?{unit:unit.id,...unit._originalDestination,score:maximum}:null;
    }
  }
  root.ArchonBoardAI={BoardAI,spells};
})(globalThis);
