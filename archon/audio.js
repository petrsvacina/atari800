/* Offline renders of the original Atari sound routines; native PCM playback. */
(function(root){
  'use strict';
  class ArchonAudio{
    constructor(options={}){
      this.assets=options.assets||root.ARCHON_AUDIO;this.createAudio=options.createAudio||(src=>new Audio(src));
      this.createContext=options.createContext||(()=>{const C=root.AudioContext||root.webkitAudioContext;return C?new C():null;});
      this.decode=options.decode||(s=>root.atob(s));this.onStatus=options.onStatus||(()=>{});
      this.tracks=new Map();this.buffers=new Map();this.voices=new Set();this.context=null;this.output=null;
      this.unlocked=false;this.muted=false;this.paused=false;this.preview=false;this.titleWanted=false;this.pending=false;this.attempt=0;
    }
    unlock(){
      this.unlocked=true;
      if(!this.tracks.size)for(const key of ['title','result']){
        const track=this.createAudio(this.assets[key]);track.preload='auto';track.volume=.48;
        track.addEventListener('error',()=>this.onStatus('Zvuk se nepodařilo načíst. Zkus obnovit stránku.'));
        track.addEventListener('ended',()=>{if(key==='title'){this.preview=false;this.titleWanted=false;}});this.tracks.set(key,track);
      }
      if(!this.context){try{this.context=this.createContext();}catch(_){}}
      if(this.context&&!this.output){
        this.output=this.context.createGain();this.output.gain.value=.42;this.output.connect(this.context.destination);
        for(const effect of this.assets.effects){
          const raw=this.decode(effect.data),buffer=this.context.createBuffer(1,raw.length/2,this.assets.sampleRate),pcm=buffer.getChannelData(0);
          for(let i=0;i<pcm.length;i++){let n=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);if(n&32768)n-=65536;pcm[i]=n/32768;}
          this.buffers.set(effect.id,buffer);
        }
      }
      if(this.context?.state==='suspended')Promise.resolve(this.context.resume()).catch(()=>{});
    }
    stopEffects(){for(const source of this.voices){source.onended=null;try{source.stop();}catch(_){}source.disconnect?.();}this.voices.clear();}
    sync(active,paused,muted=this.muted){
      this.paused=paused;this.muted=muted;this.titleWanted=this.unlocked&&!active&&!paused&&this.preview;
      if(paused||muted||!active)this.stopEffects();
      for(const track of this.tracks.values())track.muted=muted;
      const title=this.tracks.get('title');if(!title)return;
      if(!this.titleWanted){this.attempt++;this.pending=false;if(!title.paused)title.pause();}
      else if(title.paused&&!this.pending){
        this.pending=true;const attempt=++this.attempt;
        try{Promise.resolve(title.play()).then(()=>{if(attempt!==this.attempt){if(!this.titleWanted)title.pause();return;}this.pending=false;if(!this.titleWanted)title.pause();else this.onStatus('');},()=>{if(attempt===this.attempt){this.pending=false;this.onStatus('Pro zvuk klikni na tlačítko s notou.');}});}catch(_){this.pending=false;}
      }
      if(paused||!active){const result=this.tracks.get('result');if(result&&!result.paused)result.pause();}
    }
    togglePreview(){this.unlock();this.preview=!this.preview;if(this.preview)this.tracks.get('title').currentTime=0;}
    play(id,short=false){
      if(!this.unlocked||this.muted||this.paused||!this.context||!this.buffers.has(id))return;
      if(this.voices.size>=4){const oldest=this.voices.values().next().value;oldest.onended=null;try{oldest.stop();}catch(_){}this.voices.delete(oldest);}
      const source=this.context.createBufferSource();source.buffer=this.buffers.get(id);source.connect(this.output);this.voices.add(source);
      source.onended=()=>{this.voices.delete(source);source.disconnect?.();};source.start();if(short)source.stop(this.context.currentTime+Math.min(.27,source.buffer.duration));
    }
    event(event){
      if(event.type==='select'||event.type==='move')this.play(this.assets.unitMovementEffects[event.unit]??4,true);
      else if(event.type==='fire')this.play(this.assets.combatEffects.fire[event.side==='light'?0:1]);
      else if(event.type==='impact')this.play(this.assets.combatEffects.impact[event.side==='light'?0:1]);
      else if(event.type==='spell')this.play(5,true);
      else if(event.type==='end'&&this.unlocked&&!this.muted&&!this.paused){
        const result=this.tracks.get('result');result.currentTime=0;Promise.resolve(result.play()).catch(()=>{});
      }
    }
  }
  root.ArchonAudio=ArchonAudio;
})(globalThis);
