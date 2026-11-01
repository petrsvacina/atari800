export class ShiftAudio {
  constructor(assets) { this.assets = assets; this.buffers = {}; this.muted = false; this.mode = true; this.paused = false; }
  async unlock() {
    this.context ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    await this.context.resume();
    this.ready ||= Promise.all(Object.entries(this.assets).map(async ([name, value]) => {
      const bytes = Uint8Array.from(atob(value.data), c => c.charCodeAt(0));
      this.buffers[name] = await this.context.decodeAudioData(bytes.buffer);
    }));
    await this.ready; this.sync(); if (this.paused) await this.context.suspend();
  }
  sync() {
    if (!this.context || !this.buffers.music) return;
    if (this.muted || !this.mode) { this.source?.stop(); this.source = null; return; }
    if (this.source) return;
    const source = this.context.createBufferSource(); source.buffer = this.buffers.music;
    source.loop = true; source.loopStart = this.assets.music.loopStart; source.loopEnd = this.assets.music.loopEnd;
    const gain = this.context.createGain(); gain.gain.value = .65;
    source.connect(gain).connect(this.context.destination); source.start(); this.source = source;
  }
  effect(name) {
    if (this.muted || this.mode || !this.buffers[name] || this.context.state !== 'running') return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffers[name]; gain.gain.value = .75;
    source.connect(gain).connect(this.context.destination); source.start();
  }
  setMode(music) { this.mode = music; this.sync(); }
  mute() { this.muted = !this.muted; this.sync(); }
  pause(value) { this.paused = value; if (this.context) (value ? this.context.suspend() : this.context.resume()).catch(() => {}); }
}
