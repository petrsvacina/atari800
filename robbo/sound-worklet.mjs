import { Wave } from './wave.mjs';
import { footstepPCM } from './sound.mjs';

class RobboSoundProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.wave = new Wave(sampleRate, options.processorOptions?.clockHz || 1773447);
    this.active = false;
    this.pulses = [];
    this.port.onmessage = ({ data }) => {
      if (data.registers) this.wave.set(data.registers);
      if (data.clockHz) this.wave.clockHz = data.clockHz;
      if (data.footstep) this.pulses.push({ samples: footstepPCM(data.footstep,
        { rate: sampleRate, clockHz: this.wave.clockHz }), at: 0 });
      if (data.active !== undefined) this.active = !!data.active;
      if (!this.active) this.pulses = [];
    };
  }
  process(inputs, outputs) {
    const channel = outputs[0][0];
    if (this.active) {
      this.wave.process(channel);
      for (const pulse of this.pulses) {
        const length = Math.min(channel.length, pulse.samples.length - pulse.at);
        for (let index = 0; index < length; index++) channel[index] += pulse.samples[pulse.at++];
      }
      this.pulses = this.pulses.filter(pulse => pulse.at < pulse.samples.length);
    }
    else channel.fill(0);
    return true;
  }
}

registerProcessor('robbo-sound', RobboSoundProcessor);
