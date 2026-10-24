/* Local music and PCM captured from the original Goonies sound routines. */
(function (root) {
  'use strict';
  class GooniesAudio {
    constructor(options = {}) {
      this.assets = options.assets || root.GOONIES_AUDIO;
      this.createAudio = options.createAudio || (src => new Audio(src));
      this.createContext = options.createContext || (() => { const C = root.AudioContext || root.webkitAudioContext; return C ? new C() : null; });
      this.decode = options.decode || (data => root.atob(data)); this.onStatus = options.onStatus || (() => {});
      this.tracks = {}; this.buffers = new Map(); this.voices = new Set(); this.context = null;
      this.effects = new Map((this.assets?.effects || []).map(e => [e.id, e])); this.effectId = null; this.gameTrack = 'ingame';
      this.unlocked = false; this.muted = false; this.paused = false; this.preview = false; this.wanted = null; this.attempt = 0; this.pending = null;
    }
    unlock() {
      if (!this.assets) return;
      this.unlocked = true;
      if (!Object.keys(this.tracks).length) for (const [name, info] of Object.entries(this.assets.tracks)) {
        const track = this.createAudio(typeof info === 'string' ? info : info.src);
        track.preload = 'auto'; track.loop = true; track.volume = .4;
        track.addEventListener('error', () => this.onStatus('Hudbu se nepodařilo načíst. Zkus obnovit stránku.'));
        this.tracks[name] = track;
      }
      if (!this.context) { try { this.context = this.createContext(); } catch (_) {} }
      if (this.context && !this.output) {
        this.output = this.context.createGain(); this.output.gain.value = .4; this.output.connect(this.context.destination);
        for (const effect of this.assets.effects) {
          const raw = this.decode(effect.data), buffer = this.context.createBuffer(1, raw.length / 2, this.assets.sampleRate), pcm = buffer.getChannelData(0);
          for (let i = 0; i < pcm.length; i++) { let n = raw.charCodeAt(i * 2) | raw.charCodeAt(i * 2 + 1) << 8; if (n & 32768) n -= 65536; pcm[i] = n / 32768; }
          this.buffers.set(effect.id, buffer);
        }
      }
      if (this.context?.state === 'suspended') Promise.resolve(this.context.resume()).catch(() => {});
    }
    stopEffects() {
      for (const voice of this.voices) { voice.onended = null; try { voice.stop(); } catch (_) {} voice.disconnect?.(); }
      this.voices.clear();
      this.effectId = null;
    }
    sync(active, paused, muted = this.muted) {
      this.paused = paused; this.muted = muted;
      const wanted = this.unlocked && !paused ? (active ? this.gameTrack : this.preview ? 'title' : null) : null;
      if (wanted !== this.wanted) { this.attempt++; this.pending = null; }
      this.wanted = wanted;
      if (paused || muted || !active) this.stopEffects();
      for (const [name, track] of Object.entries(this.tracks)) {
        track.muted = muted;
        if (name !== wanted && !track.paused) track.pause();
      }
      const track = this.tracks[wanted];
      if (track && track.paused && this.pending !== wanted) {
        const attempt = ++this.attempt; this.pending = wanted;
        try { Promise.resolve(track.play()).then(() => {
          if (attempt === this.attempt) { this.pending = null; this.onStatus(''); }
          if (this.wanted !== wanted) track.pause();
        }, () => {
          if (attempt === this.attempt) { this.pending = null; this.onStatus('Pro zvuk klikni na tlačítko s notou.'); }
        }); } catch (_) { this.pending = null; }
      }
    }
    togglePreview() { this.unlock(); this.preview = !this.preview; }
    play(id) {
      if (id === 8) { this.stopEffects(); return; }
      if (!this.unlocked || this.muted || this.paused || !this.context || !this.buffers.has(id)) return;
      // Original $8A50-$8A76: printer/bell/stone wait for a free channel;
      // weight/lift cannot restart themselves. Other requests replace it.
      if (this.voices.size && ([2, 7, 22].includes(id) || id === 15 && this.effectId === 15)) return;
      this.stopEffects();
      const voice = this.context.createBufferSource(); voice.buffer = this.buffers.get(id); voice.connect(this.output);
      voice.loop = !!this.effects.get(id)?.loop;
      this.voices.add(voice); this.effectId = id;
      voice.onended = () => { this.voices.delete(voice); if (!this.voices.size) this.effectId = null; voice.disconnect?.(); }; voice.start();
    }
    event(event) {
      if (event.type === 'scene') { this.stopEffects(); this.selectMusic(this.assets?.roomMusic?.[event.scene] || 17); return; }
      if (event.type === 'sound') { if (!this.selectMusic(event.id)) this.play(event.id); return; }
      const id = this.assets?.eventEffects?.[event.type]; if (id !== undefined) this.play(id);
    }
    selectMusic(id) {
      if (![16, 17, 18, 24].includes(id)) return false;
      this.gameTrack = id === 16 || id === 24 ? 'title' : 'ingame'; return true;
    }
  }
  root.GooniesAudio = GooniesAudio;
})(globalThis);
