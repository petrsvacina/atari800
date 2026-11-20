// Continuous POKEY waveform, adapted from this project's Boulder Dash/Fred
// generators. Register changes and audio callback boundaries preserve phase.
// Divider/high-pass behavior follows Atari800's documented POKEY channel model;
// analog output filtering and power-on polynomial phase remain unverified.
const poly4 = Uint8Array.from([1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0]);
const poly5 = Uint8Array.from([1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0]);
function polynomial(bits) {
  const values = new Uint8Array(2 ** bits - 1);
  let state = 2 ** bits - 1;
  for (let i = 0; i < values.length; i++) {
    state = (state >>> 1) | (((state >>> 5) ^ state) & 1) << (bits - 1);
    values[i] = state & 1;
  }
  return values;
}
const poly9 = polynomial(9), poly17 = polynomial(17);

export class Wave {
  constructor(rate = 48000, clockHz = 1773447) {
    this.rate = rate; this.clockHz = clockHz; this.clock = 0;
    this.registers = new Uint8Array(9);
    this.channels = Array.from({ length: 4 }, () => ({ remaining: 28, output: 0 }));
    this.previous = 0; this.dc = 0; this.highpass = Math.pow(0.995, 48000 / rate);
  }
  period(channel) {
    const r = this.registers, control = r[8], base = control & 1 ? 114 : 28;
    if (channel === 1 && (control & 16))
      return control & 64 ? r[0] + r[2] * 256 + 7 : (r[0] + r[2] * 256 + 1) * base;
    if (channel === 3 && (control & 8))
      return control & 32 ? r[4] + r[6] * 256 + 7 : (r[4] + r[6] * 256 + 1) * base;
    if (channel === 0 && (control & 64) || channel === 2 && (control & 32)) return r[channel * 2] + 4;
    return (r[channel * 2] + 1) * base;
  }
  set(registers) {
    this.registers.set(registers);
    for (let channel = 0; channel < 4; channel++)
      this.channels[channel].remaining = Math.min(this.channels[channel].remaining, this.period(channel));
  }
  process(output) {
    const cycles = this.clockHz / this.rate;
    for (let sample = 0; sample < output.length; sample++) {
      let left = cycles, total = 0;
      while (left > 1e-8) {
        let delta = left;
        for (const channel of this.channels) delta = Math.min(delta, channel.remaining);
        let mix = 0;
        for (let channel = 0; channel < 4; channel++) {
          const voice = this.channels[channel], control = this.registers[channel * 2 + 1];
          mix += (control & 15) * ((control & 16) || voice.output ? 1 : -1);
          voice.remaining -= delta;
        }
        total += mix * delta; left -= delta; this.clock += delta;
        const phase = Math.floor(this.clock);
        for (let channel = 0; channel < 4; channel++) {
          const voice = this.channels[channel];
          if (voice.remaining >= 1e-8) continue;
          voice.remaining += this.period(channel);
          const control = this.registers[channel * 2 + 1];
          if (!(control & 16) && ((control & 128) || poly5[phase % 31])) {
            if (control & 32) voice.output ^= 1;
            else if (control & 64) voice.output = poly4[phase % 15];
            else voice.output = this.registers[8] & 128 ? poly9[phase % 511] : poly17[phase % 131071];
          }
          if (channel === 2 && (this.registers[8] & 4)) this.channels[0].output = 0;
          if (channel === 3 && (this.registers[8] & 2)) this.channels[1].output = 0;
        }
      }
      const value = total / cycles / 60;
      this.dc = value - this.previous + this.highpass * this.dc;
      this.previous = value; output[sample] = this.dc * 0.6;
    }
  }
}
