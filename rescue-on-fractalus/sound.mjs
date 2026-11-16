/* Native Rescue on Fractalus effect envelopes and POKEY register mixer.
 * Original data is extracted offline; no original CPU program runs here.
 */
const byte = n => n & 255;
const COLUMNS = ['distortion', 'volume', 'frequency', 'volumeDelta', 'volumeTarget',
  'volumeStep', 'volumePhase', 'frequencyDelta', 'frequencyTarget', 'frequencyStep',
  'frequencyPhase', 'follow', 'channel'];
const FLIGHT_VOICES = {
  scoreClock: ['distortion', 0],
  engineLatch: ['volume', 1], engineLatch2: ['volume', 2], timer: ['volume', 11],
  timerParamA: ['volume', 13], timerParamB: ['volume', 14], engineVoice: ['volume', 12],
  engineValue: ['frequency', 12], engineFrequency: ['frequency', 13], engineDelta: ['frequency', 14],
  engineStepA: ['volumeDelta', 1], engineStepB: ['volumeDelta', 2],
  engineRateA: ['volumeTarget', 1], engineRateB: ['volumeTarget', 2],
  engineGateA: ['volumeStep', 1], engineGateB: ['volumeStep', 2],
  indicatorCharacter: ['distortion', 8], indicatorValue: ['volume', 8], indicatorPhase: ['frequency', 8],
  rescueVoiceBusy: ['follow', 8],
  soundFadeDistortion: ['distortion', 13],
};
const SPECIAL_FIELDS = {
  sfxBusy: 'mode', soundSpecialIndex: 'index', soundSpecialTimer: 'timer',
  soundSpecialVolume: 'volume', soundSpecialPitchA: 'pitchA', soundSpecialPitchB: 'pitchB',
  soundSpecialVolumeTimer: 'volumeTimer',
};

function phaseStep(step, phase) {
  const sum = step + phase;
  let next = sum & 255;
  if (next & 128) next = byte(next + 10 + (sum >>> 8));
  else if (next >= 45) next = 44;
  return next;
}

export class SoundDriver {
  constructor(data, { random = () => 0 } = {}) {
    this.data = data; this.random = random;
    // The original 14-byte columns share their boundary cells. A small typed
    // parameter block preserves those aliases, including the two engine gauges.
    this.parameters = new Uint8Array(14 * 13 + 1);
    this.voices = Object.fromEntries(COLUMNS.map((name, i) => [name, this.parameters.subarray(i * 14, i * 14 + 15)]));
    this.ring = new Uint8Array(32); this.registers = new Uint8Array(9);
    this.special = { mode: 0, index: 0, timer: 0, volume: 0, pitchA: 0, pitchB: 0, volumeTimer: 0 };
    this.scanPriority = this.nextIndex = this.expired = 0;
    this.reset();
  }
  write(register, value) {
    value &= 255; this.registers[register] = value; this.writes.push([register, value]);
  }
  reset() {
    this.writes = [];
    for (let slot = 14; slot > 0; slot--)
      for (const name of COLUMNS) if (name !== 'distortion' && name !== 'frequency') this.voices[name][slot] = 0;
    this.head = this.tail = 0; this.topPriority = 0; this.topIndex = 2;
    for (let slot = 4; slot > 0; slot--) {
      this.voices.channel[slot] = slot * 2; this.write(slot * 2 - 1, 0);
    }
    this.voices.channel[1] = this.voices.channel[3] = 0;
    this.voices.channel[13] = 2; this.voices.channel[14] = 6;
    this.write(8, 96);
    if (this.flightState) {
      this.flightState.eventHead = this.head; this.flightState.eventTail = this.tail;
      this.exportFlightVoices(this.flightState);
    }
  }
  push(value) {
    const at = Math.min(this.head, 31);
    this.ring[at] = value & 255; this.head = (at + 31) & 31;
    if (this.flightState) this.flightState.eventHead = this.head;
  }
  queue(event) { this.push((event & 127) | 128); }
  touch(slot) { this.push(slot & 127); }
  load(event) {
    if (event === 0) return;
    const e = this.data.events[event - 1];
    if (!e) throw new RangeError('Original effect event 0–33 required');
    const v = this.voices, slot = e.slot;
    v.distortion[slot] = e.control & 240; v.volume[slot] = e.control & 15;
    v.frequency[slot] = e.frequency;
    for (const name of ['volumeStep', 'volumeDelta', 'volumeTarget', 'volumePhase', 'frequencyStep', 'follow'])
      v[name][slot] = e[name];
    if (e.frequencyStep)
      for (const name of ['frequencyDelta', 'frequencyTarget', 'frequencyPhase']) v[name][slot] = e[name];
    this.touch(slot);
    if (this.flightState) this.exportFlightVoices(this.flightState);
  }
  emitFrequency(slot) {
    const channel = this.voices.channel[slot];
    if (channel) this.write(channel - 2, this.voices.frequency[slot]);
    return channel;
  }
  emitVoice(slot) {
    const channel = this.emitFrequency(slot);
    if (channel) this.write(channel - 1, (this.voices.volume[slot] & 15) | this.voices.distortion[slot]);
    return channel;
  }
  pickTop() {
    this.scanPriority = 16;
    for (let slot = 1; slot <= 12; slot++) {
      const priority = this.voices.volume[slot] & 15;
      if (this.voices.channel[slot] && priority < this.scanPriority) {
        this.scanPriority = this.topPriority = priority; this.topIndex = slot;
      }
    }
  }
  pickNext() {
    this.scanPriority = 0;
    for (let slot = 1; slot <= 12; slot++) {
      const priority = this.voices.volume[slot] & 15;
      if ((!this.voices.channel[slot] || slot === this.topIndex) && priority >= this.scanPriority) {
        this.scanPriority = priority; this.nextIndex = slot;
      }
    }
  }
  reorder(slot) {
    if (!this.emitVoice(slot)) {
      const priority = this.voices.volume[slot] & 15;
      if (priority < this.topPriority || priority === this.topPriority && slot < this.topIndex) return;
      this.voices.channel[slot] = this.voices.channel[this.topIndex];
      this.voices.channel[this.topIndex] = 0; this.emitVoice(slot);
    } else if (slot < 13) {
      this.pickNext();
      if (this.topIndex !== this.nextIndex) {
        this.voices.channel[this.nextIndex] = this.voices.channel[this.topIndex];
        this.voices.channel[this.topIndex] = 0; this.emitVoice(this.nextIndex);
      }
    }
    this.pickTop();
  }
  specialStep() {
    const s = this.special;
    if (s.mode !== 1) {
      s.timer = byte(s.timer - 1);
      if (s.timer & 128) {
        s.timer = (this.random('sound.noiseTimer') & 3) + 1;
        const noise = this.random('sound.noisePitch') & 255;
        this.write(4, noise | 112); this.write(0, (noise & 127) | 23);
      }
      this.write(8, 4); this.write(1, 163); this.write(5, 163);
      return;
    }
    s.index = byte(s.index - 1); if (s.index & 128) s.index = 7;
    const delta = this.data.sweep[s.index];
    s.pitchA = byte(s.pitchA - delta); s.pitchB = byte(s.pitchB - delta);
    this.write(0, s.pitchA); this.write(4, s.pitchB);
    s.volumeTimer = byte(s.volumeTimer - 1);
    if (s.volumeTimer & 128) {
      s.volume = byte(s.volume + 2);
      if (s.volume >= 15) { s.volume = 15; s.volumeTimer = 50; }
    } else if (s.volumeTimer === 0) {
      s.volume = byte(s.volume - 1);
      if (s.volume === 6) s.mode = byte(s.mode + 1);
      s.volumeTimer++;
    }
    this.write(1, s.volume | 160); this.write(5, s.volume | 160);
  }
  step() {
    this.writes = [];
    if (this.special.mode) this.specialStep();
    const v = this.voices;
    for (let slot = 14; slot > 0; slot--) {
      this.expired = 0;
      if (v.frequencyStep[slot]) {
        v.frequencyPhase[slot] = phaseStep(v.frequencyStep[slot], v.frequencyPhase[slot]);
        if (this.data.gates[v.frequencyPhase[slot]]) {
          v.frequency[slot] += v.frequencyDelta[slot];
          if (v.frequency[slot] === v.frequencyTarget[slot]) { v.frequencyStep[slot] = 0; this.expired++; }
          this.emitFrequency(slot);
        }
      }
      if (v.volumeStep[slot]) {
        v.volumePhase[slot] = phaseStep(v.volumeStep[slot], v.volumePhase[slot]);
        if (this.data.gates[v.volumePhase[slot]]) {
          v.volume[slot] = (v.volume[slot] + v.volumeDelta[slot]) & 15;
          if (v.volume[slot] === v.volumeTarget[slot]) { v.volumeStep[slot] = 0; this.expired++; }
          this.touch(slot);
        }
      }
      if (this.expired) this.queue(v.follow[slot]);
    }
    this.head = Math.min(this.head, 31); this.tail = Math.min(this.tail, 31);
    while (this.tail !== this.head) {
      const entry = this.ring[this.tail];
      if (entry & 128) this.load(entry & 127); else this.reorder(entry);
      this.tail = (this.tail + 31) & 31;
    }
    return this.registers;
  }
  bindFlight(state) {
    this.flightState = state;
    this.ring = state.eventRing; this.head = state.eventHead;
    if (state.eventTail !== undefined) this.tail = state.eventTail;
    for (const [name, [column, slot]] of Object.entries(FLIGHT_VOICES))
      if (state[name] !== undefined) this.voices[column][slot] = state[name];
    for (const [name, field] of Object.entries(SPECIAL_FIELDS))
      if (state[name] !== undefined) this.special[field] = state[name];
    return this;
  }
  exportFlightVoices(state) {
    for (const [name, [column, slot]] of Object.entries(FLIGHT_VOICES)) state[name] = this.voices[column][slot];
  }
  stepFlight(state) {
    this.bindFlight(state);
    this.step();
    state.eventHead = this.head; state.eventTail = this.tail;
    this.exportFlightVoices(state);
    for (const [name, field] of Object.entries(SPECIAL_FIELDS)) state[name] = this.special[field];
    return this.registers;
  }
}

class RegisterPlayer {
  constructor(registers) { this.registers = new Uint8Array(registers || 9); this.writes = []; }
  write(index, value) { value &= 255; this.registers[index] = value; this.writes.push([index, value]); }
  silence() {
    for (let index = 1; index < 8; index += 2) this.write(index, 0);
    this.write(8, 96);
  }
}

/** Original standby score ($70E7/$70F9/$7148), clocked once per VBI.
 * It deliberately ticks only on even values of the original $062D counter.
 */
export class ThemeDriver extends RegisterPlayer {
  constructor(data, { counter = 0, registers } = {}) {
    super(registers); this.data = data.theme; this.counter = counter & 255;
    this.emphasis = 0; this.loops = 0; this.start();
  }
  start() { this.enabled = true; this.duration = 0; this.cursor = 255; this.write(8, 0); }
  stop() { this.enabled = false; this.silence(); }
  nextNote() {
    let at = this.cursor, note;
    for (;;) {
      at = byte(at + 1); note = this.data.stream[at];
      if (note === 0) { at = 0; note = this.data.stream[0]; this.loops++; }
      if (!(note & 128)) break;
      const chord = this.data.chords[note & 31];
      for (let channel = 0; channel < 4; channel++) this.write(channel * 2, chord[channel]);
      this.write(7, chord[4]);
      if (!chord[4]) { note = 0; break; }
    }
    this.cursor = at; this.duration = this.data.durations[note & 31]; this.emphasis = note >>> 4;
  }
  tick() {
    this.duration = byte(this.duration - 1);
    if (this.duration & 128) this.nextNote();
    const half = this.duration >>> 1, control = half < 3 ? 160 + half : 163;
    for (const register of [1, 3, 5]) this.write(register, this.emphasis ? control : 0);
    if (this.emphasis) this.write(this.emphasis - 1, control + 2);
  }
  step(counter) {
    this.writes = [];
    this.counter = counter === undefined ? byte(this.counter + 1) : counter & 255;
    if (this.enabled && !(this.counter & 1)) this.tick();
    return this.registers;
  }
}

/** Original game-over and completion/high-score score player ($7238/$7253). */
export class JingleDriver extends RegisterPlayer {
  constructor(data, { song = 0, registers } = {}) {
    super(registers); this.data = data.jingles;
    this.levels = new Uint8Array(4); this.deltas = new Uint8Array(4); this.frequencies = new Uint8Array(4);
    this.start(song);
  }
  start(song) {
    this.song = this.data.songs[song];
    if (!this.song) throw new RangeError('Original jingle 0 or 1 required');
    this.cursor = 0; this.attackRemaining = 0; this.duration = 1; this.active = true; this.write(8, 0);
  }
  stop() { this.active = false; this.silence(); }
  step() {
    this.writes = [];
    if (!this.active) return this.registers;
    if (this.attackRemaining) {
      this.attackRemaining = byte(this.attackRemaining - 1);
      if (!this.attackRemaining) this.deltas.fill(this.song.release);
    } else {
      this.duration = byte(this.duration - 1);
      if (!this.duration) {
        let read = this.cursor, command = this.song.stream[read++];
        while (command >= 192) {
          this.frequencies.set(this.data.presets[255 - command]);
          command = this.song.stream[read++];
        }
        if (!command) { this.stop(); return this.registers; }
        this.duration = command; this.attackRemaining = 4;
        let notes = this.song.stream[read++]; this.cursor = read;
        for (let channel = 3; channel >= 0; channel--) {
          const code = notes >>> 6;
          if (code === 0) this.levels[channel] = this.deltas[channel] = 0;
          else if (code !== 1) {
            this.levels[channel] = code === 3 ? this.song.loud : this.song.soft;
            this.deltas[channel] = this.song.attack;
            this.write(channel * 2, this.frequencies[channel]);
          }
          notes = byte(notes << 2);
        }
      }
    }
    for (let channel = 3; channel >= 0; channel--) {
      const level = byte(this.levels[channel] + this.deltas[channel]);
      this.levels[channel] = level & 128 ? 0 : level;
      this.write(channel * 2 + 1, (this.levels[channel] >>> 3) ^ this.data.distortion[channel]);
    }
    return this.registers;
  }
}

/** Original launch-station clock-modulated sound ($1B50/$1B5B).
 * The three drift accumulators also select the original missile-fade envelope;
 * they are explicit state so a scene renderer can share their original phase.
 */
export class StationDriver extends RegisterPlayer {
  constructor(data, { counter = 0, decayIndex = 0, drift = [0, 0, 0], registers } = {}) {
    super(registers); this.data = data.station; this.counter = counter & 65535;
    this.decayIndex = decayIndex & 255; this.drift = Uint8Array.from(drift);
    for (const register of [1, 3, 5, 7]) this.write(register, 0);
    this.write(8, 1);
    this.write(0, 255); this.write(2, 252);
  }
  driftMissiles() {
    const first = this.drift[0] + 2; this.drift[0] = first;
    if (first > 255) { this.decayIndex = 0; return; }
    const second = this.drift[1] + 203; this.drift[1] = second;
    if (second > 255) {
      const third = this.drift[2] + 2; this.drift[2] = third;
      if (third > 255) this.decayIndex = 0;
    }
  }
  step(counter) {
    this.writes = [];
    this.counter = counter === undefined ? (this.counter + 1) & 65535 : counter & 65535;
    const high = this.counter >>> 8, low = this.counter & 255;
    if (high || low >= 128) {
      this.driftMissiles();
      if (this.decayIndex < 15) this.write(5, this.data.fade[this.decayIndex++]);
    }
    if (!high && low >= 128) this.write(1, 160 | Math.min(8, (low ^ 128) >>> 4));
    if (high === 1) this.write(3, 160 | Math.min(7, low >>> 5));
    if (high === 2) {
      if (low >= 64) { this.write(2, (low - 64) ^ 255); this.write(3, 167); }
    } else if (high === 3) {
      if (low < 228) { this.write(2, 0); this.write(3, this.data.volume[low] | 128); }
      else { this.write(2, 252); this.write(3, 167); }
    }
    // The attract loop resets only the high clock byte after this audio call.
    if (high >= 5) this.counter = 512 | low;
    return this.registers;
  }
}

/** Lucasfilm launch-logo chord and fade, from the loader's $51EF VBI. */
export class LogoDriver extends RegisterPlayer {
  constructor(data, { registers } = {}) {
    super(registers); this.data = data.logo;
    this.counter = this.data.counter; this.delay = this.data.delay; this.envelope = this.data.envelope;
    this.frequencies = Uint8Array.from(this.data.frequencies); this.write(8, 0);
  }
  tone() {
    const first = (this.envelope >>> 3) | 160, third = first + ((this.envelope >>> 2) & 1);
    this.write(1, first); this.write(3, first); this.write(5, third); this.write(7, third ^ 96);
  }
  step() {
    this.writes = [];
    if (this.counter & 128) return this.registers;
    if (this.counter) {
      this.tone(); this.envelope = byte(this.envelope + 1);
      for (let channel = 3; channel >= 0; channel--) {
        this.write(channel * 2, this.frequencies[channel]);
        this.frequencies[channel] = byte(this.frequencies[channel] + this.data.deltas[channel]);
      }
      this.counter = byte(this.counter - 1);
    } else if (!(this.delay & 128)) {
      this.delay = byte(this.delay - 1);
      if (!this.delay) {
        this.write(8, 96); this.write(0, 250); this.write(4, 255); this.envelope = 36;
      }
    } else {
      this.tone(); this.envelope = byte(this.envelope - 1);
      if (!this.envelope) this.counter = 255;
    }
    return this.registers;
  }
}

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
