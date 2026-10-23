/* Original music and six original PCM samples. No sound-chip emulation in the browser. */
(function(root){
  'use strict';
  class KarateAudio {
    constructor(options={}) {
      this.createAudio=options.createAudio||(src=>new Audio(src));
      this.createContext=options.createContext||(()=>{const C=root.AudioContext||root.webkitAudioContext;return C?new C():null;});
      this.onStatus=options.onStatus||(()=>{}); this.track=null;this.context=null;this.unlocked=false;
      this.muted=false;this.paused=false;this.preview=false;this.mode='both';this.requested=false;this.attempt=0;this.pending=false;
      this.assets=options.assets||root.KARATE_SFX;
      // Video-fit effective rate: original raster IRQs disturb the nominal
      // 3958.587 Hz timer. This approximates their pitch, not every IRQ delay.
      this.playbackSampleRate=options.playbackSampleRate||3700;
      this.decode=options.decode||(encoded=>root.atob(encoded));
      this.buffers=new Map();this.voices=new Set();this.output=null;
    }
    unlock() {
      this.unlocked=true;
      if(!this.track) {
        this.track=this.createAudio('assets/music/international-karate.mp3');
        this.track.loop=true;this.track.preload='auto';this.track.volume=.42;
        this.track.addEventListener('error',()=>this.onStatus('Hudbu se nepodařilo načíst. Zkus obnovit stránku.'));
      }
      if(!this.context) {try{this.context=this.createContext();}catch(_){}}
      if(this.context&&!this.output&&this.assets) {
        const ctx=this.context;
        this.output=ctx.createGain();this.output.gain.value=.8;
        // The Atari DAC is unipolar. AC coupling removes its DC component.
        const highpass=ctx.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=35;
        this.output.connect(highpass);highpass.connect(ctx.destination);
        for(const sample of this.assets.samples) {
          const raw=this.decode(sample.data),rate=this.assets.sourceSampleRate;
          const buffer=ctx.createBuffer(1,Math.ceil(raw.length/rate*44100),44100);
          const pcm=buffer.getChannelData(0);
          for(let i=0;i<pcm.length;i++)pcm[i]=(raw.charCodeAt(Math.min(raw.length-1,Math.floor(i*rate/44100)))/127.5)-1;
          this.buffers.set(sample.id,buffer);
        }
      }
      if(this.context?.state==='suspended')Promise.resolve(this.context.resume()).catch(()=>{});
    }
    sync(active,paused,mode=this.mode,muted=this.muted) {
      this.paused=paused;this.mode=mode;this.muted=muted;
      if(paused||muted||mode==='music'||!active)this.stopEffects();
      const wanted=this.unlocked&&!paused&&mode!=='effects'&&(active||this.preview);
      this.requested=wanted;
      if(!this.track)return;
      this.track.muted=muted;
      if(!wanted) {
        this.attempt++;this.pending=false;
        if(!this.track.paused)this.track.pause();
      } else if(this.track.paused&&!this.pending) {
        const attempt=++this.attempt;this.pending=true;
        try {
          Promise.resolve(this.track.play()).then(()=>{
            if(attempt!==this.attempt){if(!this.requested)this.track.pause();return;}
            this.pending=false;if(!this.requested)this.track.pause();else this.onStatus('');
          },()=>{if(attempt===this.attempt){this.pending=false;this.onStatus('Pro hudbu klikni na tlačítko se zvukem.');}});
        }catch(_){this.pending=false;this.onStatus('Pro hudbu klikni na tlačítko se zvukem.');}
      }
    }
    togglePreview() {this.unlock();this.preview=!this.preview;}
    stopEffects() {
      for(const source of this.voices){source.onended=null;try{source.stop();}catch(_){}source.disconnect?.();}
      this.voices.clear();if(this.track)this.track.volume=.42;
    }
    sample(id,repeatDelay=0) {
      if(!this.unlocked||this.muted||this.paused||this.mode==='music'||!this.context||!this.buffers.has(id))return;
      this.stopEffects();
      const ctx=this.context,t=ctx.currentTime,buffer=this.buffers.get(id);
      const times=repeatDelay?[0,repeatDelay]:[0];
      // Original driver keeps advancing its tune but suppresses the music DAC
      // writes while a digital sample is playing.
      if(this.track)this.track.volume=0;
      for(let i=0;i<times.length;i++){
        const source=ctx.createBufferSource();source.buffer=buffer;source.connect(this.output);this.voices.add(source);
        source.playbackRate.value=this.playbackSampleRate/this.assets.sourceSampleRate;
        source.onended=()=>{source.disconnect?.();this.voices.delete(source);if(!this.voices.size&&this.track)this.track.volume=.42;};
        source.start(t+times[i]);if(i+1<times.length)source.stop(t+times[i+1]);
      }
    }
    effects(events) {
      // The original scans both players once and runs a single sample player.
      // Resolve each simulation tick together: a contact replaces its windup
      // sound, and player 0 has the original priority over player 1.
      const groups=new Map();
      for(const event of events){const tick=event.tick??0;if(!groups.has(tick))groups.set(tick,[]);groups.get(tick).push(event);}
      for(const group of groups.values()){
        const hit=group.find(event=>event.type==='hit'&&event.frame!==undefined);
        const poses=group.filter(event=>event.type==='pose').sort((a,b)=>b.player-a.player);
        if(hit&&!poses.some(event=>event.player===hit.player&&event.frame===hit.frame))poses.push({player:hit.player,frame:hit.frame,flags:0});
        poses.sort((a,b)=>b.player-a.player);
        let selected=null;
        for(const pose of poses){
          const frame=pose.frame;
          if(hit||pose.falling){
            if([18,20,22].includes(frame))selected={id:0,delay:frame===22?.1:0};
            else if([21,32].includes(frame))selected={id:2,delay:.08};
            else if(frame===47)selected={id:5};
            else if(frame===43)selected={id:3};
            else if(frame===39)selected={id:4};
          }else if(pose.flags&0x4d){
            if([10,7,6,22].includes(frame))selected={id:1};
            else if([18,20,21,32].includes(frame))selected={id:2};
          }
        }
        if(group.some(event=>event.type==='break'))selected={id:2};
        if(group.some(event=>event.type==='hit'&&event.frame===undefined))selected={id:3};
        if(selected)this.sample(selected.id,selected.delay||0);
      }
    }
    effect(event) {
      // Public single-event adapter for callers outside the game loop.
      this.effects([typeof event==='string'?{type:event}:event]);
    }
  }
  root.KarateAudio=KarateAudio;
})(globalThis);
