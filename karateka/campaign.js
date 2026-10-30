/* Native bank handovers. Only state retained by the original loader crosses. */
(function(root){'use strict';
class Campaign{
 constructor(seed=7){this.reset(seed);}
 reset(seed=7){this.seed=seed&255;this.number=1;this.game=new root.KaratekaStage1(this.seed);this.events=[];}
 next(number){
  const previous=this.game,seed=previous.rules.random,Type=[null,root.KaratekaStage1,root.KaratekaStage2,root.KaratekaStage3,root.KaratekaStage4][number];
  if(!Type)throw Error('Unknown original scene '+number);
  const next=new Type(seed,number===4?previous:null);
  if(number<4)for(const side of ['hero','enemy'])for(const field of ['drawX','repeat','spare2'])next[side][field]=previous[side][field];
  next.restore=previous.restore.slice();if(number>=3)next.enemyWait=previous.enemyWait;
  this.number=number;this.game=next;this.events=[];
  if(number===2)this.events.push({type:'movie',id:'palace-intro'});if(number===3)this.events.push({type:'movie',id:'hawk-intro'});
 }
 tick(input){this.game.tick(input);this.events=this.game.events.slice();return this.events;}
}
root.KaratekaCampaign=Campaign;
})(globalThis);
