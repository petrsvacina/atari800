import {decode64} from './engine.mjs';

export class StoryMusic {
  constructor(asset) { this.asset = asset; this.enabled = true; this.wanted = false; this.serial = 0; }
  async play(restart = false) {
    this.wanted = true;
    const serial = ++this.serial;
    this.context ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (!this.gain) { this.gain = this.context.createGain(); this.gain.connect(this.context.destination); }
    this.gain.gain.value = this.enabled ? .65 : 0;
    await this.context.resume();
    this.decoding ||= this.context.decodeAudioData(decode64(this.asset.data).buffer);
    const buffer = await this.decoding;
    if (serial !== this.serial || !this.wanted) return;
    if (this.source && !restart) return;
    this.source?.stop();
    this.source = this.context.createBufferSource(); this.source.buffer = buffer;
    this.source.loop = true; this.source.loopStart = this.asset.loopStart; this.source.loopEnd = this.asset.loopEnd;
    this.source.connect(this.gain); this.source.start();
  }
  stop() { this.wanted = false; this.serial++; this.source?.stop(); this.source = null; }
  setEnabled(value) { this.enabled = value; if (this.gain) this.gain.gain.value = value ? .65 : 0; }
  pause() { void this.context?.suspend(); }
  resume() { if (this.wanted) void this.context?.resume(); }
}
