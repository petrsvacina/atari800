/* Robbo's native POKEY effect sequencer.
 * Supplied XEX: SOUND_ $B806, SOUNDV $B84B, SOPL $B86C, effect data $B896.
 * The supplied XEX is the authority; the original CPU runs only in offline tests.
 */

export const EFFECT_NAMES = Object.freeze([
  'explosion', 'shot', 'bump', 'teleport', 'screw', 'extra life', 'door',
  'ammunition', 'box', 'key', 'small explosion', 'enter capsule',
  'leave capsule', 'open exit', 'magnet',
]);

/** Prepare the extracted, semantic pairs [AUDC, AUDF]; no executable is loaded. */
export function prepareSound(data) {
  const source = data?.sound || data;
  if (source?.preparedRobboSound) return source;
  if (!source || !Array.isArray(source.effects) || source.effects.length !== 15)
    throw new TypeError('Robbo requires the 15 original sound effects');
  const effects = source.effects.map((effect, index) => {
    const steps = effect.steps || effect;
    if (!Array.isArray(steps) || steps.length !== 16 || steps.some(pair =>
      !Array.isArray(pair) || pair.length !== 2 || pair.some(value => !Number.isInteger(value) || value < 0 || value > 255)))
      throw new TypeError(`Invalid original Robbo effect ${index}`);
    return steps.map(pair => Uint8Array.from(pair));
  });
  return { ...source, effects, tableAddress: source.tableAddress ?? 0xB896, preparedRobboSound: true };
}

export class Sound {
  constructor(data, { clock = 0 } = {}) {
    this.data = prepareSound(data);
    // These 16 data cells preserve the driver's original aliases, including
    // reset's deliberate clearing of only the first nine cells.
    this.parameters = new Uint8Array(16);
    this.pointers = this.parameters.subarray(0, 4);
    this.addresses = this.parameters.subarray(4, 12);
    this.registers = new Uint8Array(9);
    this.clock = clock & 255;
    this.footsteps = [];
    this.writes = [];
    this.reset();
  }

  write(register, value) {
    value &= 255;
    if (register < 9) this.registers[register] = value;
    this.writes.push([register, value]);
  }

  reset() {
    this.write(15, 3); // SKCTL: enable POKEY polynomial clocks.
    for (let index = 8; index >= 0; index--) {
      this.parameters[index] = 0;
      this.write(index, 0);
    }
    return this.registers;
  }

  trigger(command) {
    command &= 255;
    if (command & 128) return this.reset();
    if (command >= this.data.effects.length)
      throw new RangeError('Original Robbo sound effect 0–14 required');
    const address = (this.data.tableAddress + command * 32) & 65535;
    this.parameters[12] = address & 255;
    this.parameters[13] = address >>> 8;
    // Explosion, shot and bump have dedicated voices. All remaining effects
    // replace one another on voice four, exactly as SOUND_ does.
    const channel = Math.min(command, 3);
    this.pointers[channel] = 16;
    this.addresses[channel * 2] = address & 255;
    this.addresses[channel * 2 + 1] = address >>> 8;
    return this.registers;
  }

  /** CHNMON's separate one-bit CONSOL click, outside the four POKEY voices. */
  footstep() {
    if (!this.data.footstep) throw new Error('Original CONSOL waveform is missing');
    const pulse = this.data.footstep;
    this.footsteps.push(pulse);
    return pulse;
  }

  /** Called once per VBI, using the original low RTCLOK byte ($14). */
  step(clock) {
    this.writes = [];
    this.clock = clock === undefined ? (this.clock + 1) & 255 : clock & 255;
    if (this.clock & 3) return this.registers;
    for (let channel = 3; channel >= 0; channel--) {
      const register = channel * 2;
      if (!this.pointers[channel]) {
        this.write(register, 0);
        this.write(register + 1, 0);
        continue;
      }
      const address = this.addresses[register] | this.addresses[register + 1] << 8;
      this.parameters[12] = address & 255;
      this.parameters[13] = address >>> 8;
      const effect = (address - this.data.tableAddress) / 32;
      const position = --this.pointers[channel];
      const pair = this.data.effects[effect]?.[position];
      if (!pair) throw new RangeError('Invalid original Robbo sound cursor');
      this.parameters[14] = pair[0];
      this.parameters[15] = pair[1];
      this.write(register, pair[1]);
      this.write(register + 1, pair[0]);
    }
    return this.registers;
  }

  /** Title loop: first mute channel 1, then optionally print a character/line.
   * The original title has typing noises, rather than a musical score.
   * Call at the original title-loop cadence, independent of SOUNDV's VBI gate.
   */
  titleTick(kind = null) {
    this.writes = [];
    this.write(1, 0);
    if (kind === 'character' || kind === 'newline') { this.write(0, 0x10); this.write(1, 0x82); }
    if (kind === 'line' || kind === 'newline') { this.write(0, 0x02); this.write(1, 0xC4); }
    else if (kind !== null && kind !== 'character')
      throw new RangeError('Title sound must be character, line, newline or null');
    return this.registers;
  }
}

export { Wave } from './wave.mjs';

/** Integrate the 81 original CONSOL writes at their 13-cycle cadence.
 * Gain and the analog speaker/filter response have not been hardware calibrated.
 */
export function footstepPCM(data, { rate = 48000, clockHz = data.clockHz || 1773447, gain = 0.18 } = {}) {
  const pulse = data.footstep || data;
  if (!pulse.bits || pulse.bits.length !== 81 || pulse.cyclesPerWrite !== 13)
    throw new TypeError('Original 81-write Robbo CONSOL pulse required');
  const cyclesPerSample = clockHz / rate;
  const duration = pulse.bits.length * pulse.cyclesPerWrite;
  const samples = new Float32Array(Math.ceil((duration / clockHz + 0.04) * rate));
  const highpass = Math.pow(0.995, 48000 / rate);
  let clock = 0, previous = 0, dc = 0;
  for (let index = 0; index < samples.length; index++) {
    const end = clock + cyclesPerSample;
    let total = 0;
    while (clock < end - 1e-8) {
      const step = Math.floor(clock / pulse.cyclesPerWrite);
      const boundary = Math.min(end, (step + 1) * pulse.cyclesPerWrite);
      if (step < pulse.bits.length && !(pulse.bits[step] & 8)) total += boundary - clock;
      clock = boundary;
    }
    const value = total / cyclesPerSample * gain;
    dc = value - previous + highpass * dc;
    previous = value; samples[index] = dc;
  }
  return samples;
}
