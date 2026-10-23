/* Original music is rendered ahead of time; the browser only plays MP3 + PCM. */
(function (root) {
  'use strict';
  class DynakillersAudio {
    constructor(assets, options = {}) {
      this.assets = assets;
      this.createAudio = options.createAudio || (src => new Audio(src));
      this.createContext = options.createContext || (() => {
        const Context = root.AudioContext || root.webkitAudioContext;
        return Context ? new Context() : null;
      });
      this.onStatus = options.onStatus || (() => {});
      this.context = null;
      this.buffers = new Map();
      this.music = new Map();
      this.activeTrack = null;
      this.unlocked = false;
      this.previewEnabled = false;
      this.mode = 'both';
      this.muted = false;
      this.paused = false;
      this.requested = null;
      this.blocked = false;
      this.failedTracks = new Set();
    }
    init() {
      this.unlocked = true;
      this.previewEnabled = true;
      this.blocked = false;
      if (!this.music.size) {
        for (const name of ['title', 'ingame']) {
          const audio = this.createAudio(`assets/music/${name}.mp3`);
          audio.preload = 'auto'; audio.loop = true; audio.volume = .38;
          audio.addEventListener('error', () => {
            this.failedTracks.add(name);
            this.onStatus('Hudbu se nepodařilo načíst. Zkus obnovit stránku.');
          });
          this.music.set(name, audio);
        }
      }
      if (!this.context) {
        this.context = this.createContext();
        if (this.context) {
          this.gain = this.context.createGain();
          this.gain.gain.value = this.muted ? 0 : .2;
          this.gain.connect(this.context.destination);
          for (const [id, encoded] of Object.entries(this.assets.samples)) {
            const bytes = root.atob(encoded), buffer = this.context.createBuffer(1, bytes.length * 2, 7800);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bytes.length; i++) {
              const b = bytes.charCodeAt(i);
              data[i * 2] = ((b & 15) - 7.5) / 7.5;
              data[i * 2 + 1] = ((b >> 4) - 7.5) / 7.5;
            }
            this.buffers.set(id, buffer);
          }
        }
      }
      if (this.context) this.context.resume().catch(() => {});
    }
    togglePreview() {
      const wasPlaying = this.unlocked && this.previewEnabled && this.activeTrack === 'title' && !this.music.get('title')?.paused;
      this.init();
      this.previewEnabled = !wasPlaying;
    }
    restartGame() { this.activeTrack = null; }
    synchronize(state, paused, mode = this.mode, muted = this.muted) {
      const muteChanged = muted !== this.muted;
      this.mode = mode; this.muted = muted; this.paused = paused;
      if (this.gain && muteChanged) this.gain.gain.setTargetAtTime(muted ? 0 : .2, this.context.currentTime, .02);
      for (const audio of this.music.values()) if (audio.muted !== muted) audio.muted = muted;
      const desired = !this.unlocked || paused || mode === 'samples' ? null
        : state === 'menu' ? (this.previewEnabled ? 'title' : null) : 'ingame';
      for (const [name, audio] of this.music) {
        if (name !== desired && !audio.paused) audio.pause();
      }
      if (desired !== this.requested) this.blocked = false;
      this.requested = desired;
      if (!desired || this.blocked || this.failedTracks.has(desired)) return;
      const audio = this.music.get(desired);
      if (desired !== this.activeTrack) {
        audio.currentTime = 0;
        this.activeTrack = desired;
      }
      if (audio.paused) {
        this.blocked = true;
        try {
          const promise = audio.play();
          Promise.resolve(promise).then(() => {
            this.blocked = false;
            if (this.requested !== desired) audio.pause();
            else this.onStatus('');
          }, () => {
            if (this.requested === desired) this.onStatus('Pro přehrání hudby stiskni tlačítko se zvukem.');
          });
        } catch (_) {
          this.onStatus('Pro přehrání hudby stiskni tlačítko se zvukem.');
        }
      }
    }
    play(id) {
      if (!this.context || this.muted || this.paused || this.mode === 'music') return;
      const buffer = this.buffers.get(String(id));
      if (!buffer) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer; source.connect(this.gain); source.start();
    }
    stop() {
      this.requested = null;
      for (const audio of this.music.values()) audio.pause();
    }
    get titlePlaying() {
      return this.requested === 'title' && !this.music.get('title')?.paused;
    }
  }
  root.DynakillersAudio = DynakillersAudio;
})(globalThis);
