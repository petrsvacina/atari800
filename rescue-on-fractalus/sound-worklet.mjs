import { Wave } from './sound.mjs';

class FractalusSoundProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.wave = new Wave(sampleRate, options.processorOptions?.clockHz || 1773447);
    this.active = false;
    this.port.onmessage = ({ data }) => {
      if (data.registers) this.wave.set(data.registers);
      if (data.clockHz) this.wave.clockHz=data.clockHz;
      if (data.active !== undefined) this.active = !!data.active;
    };
  }
  process(inputs, outputs) {
    const channel = outputs[0][0];
    if (this.active) this.wave.process(channel);
    else channel.fill(0);
    return true;
  }
}

registerProcessor('fractalus-sound', FractalusSoundProcessor);
