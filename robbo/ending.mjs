/* Data-only original ending cinema plus native COPT random reveal.
 * No original processor, executable or machine-code bytes run in the browser.
 */
import { Sound } from './sound.mjs';
const decode = value => typeof value === 'string'
  ? Uint8Array.from(atob(value), character => character.charCodeAt(0)) : Uint8Array.from(value);

export async function prepareEnding(source) {
  if (source.preparedRobboEnding) return source;
  const compressed = decode(source.atlasGzip);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const atlas = new Uint8Array(await new Response(stream).arrayBuffer());
  if (atlas.length !== source.width * source.height * source.atlasImages)
    throw new Error('Invalid original ending atlas size');
  return { ...source, atlas, palette: decode(source.palette),
    hold: source.hold.map(frame => ({ ...frame, random: decode(frame.random) })),
    closing: source.closing.map(frame => ({ ...frame, rowColors: decode(frame.rowColors) })),
    holdData: { ...source.holdData, font: decode(source.holdData.font),
      message: decode(source.holdData.message), initialScreen: decode(source.holdData.initialScreen) },
    preparedRobboEnding: true };
}

/** Original $AABC COPT: one independent RANDOM-indexed write on each of three
 * pages, then poll TETR. A last pending store can straddle a video boundary.
 */
export class EndingHold {
  constructor(data) {
    this.data = data.holdData || data;
    this.screen = new Uint8Array(this.data.initialScreen);
    this.page = this.data.page || 0; this.pending = null;
  }
  commitPending() {
    if (this.pending) { this.screen[this.pending[0]] = this.pending[1]; this.pending = null; }
  }
  advanceRandom(values, { deferLast = false } = {}) {
    this.commitPending();
    for (let index = 0; index < values.length; index++) {
      const address = this.page * 256 + (values[index] & 255);
      const value = this.data.message[address];
      this.page = (this.page + 1) % 3;
      if (deferLast && index === values.length - 1) this.pending = [address, value];
      else this.screen[address] = value;
    }
    return this.screen;
  }
  render(frame, { rowColors, pixels = new Uint8Array(320 * 240) } = {}) {
    pixels.fill(0);
    const phase = (frame + this.data.fontPhase) & 7, font = this.data.font;
    for (let y = 0; y < 160; y++) {
      const background = rowColors ? rowColors[y * 2] : frame ? 2 : 0;
      const foreground = rowColors ? rowColors[y * 2 + 1] : 14;
      for (let x = 0; x < 256; x++) {
        const character = this.screen[(y >> 3) * 32 + (x >> 3)], glyph = character & 127;
        const byte = glyph === 96 ? font[0x300 + (((y & 7) - phase) & 7)] : font[glyph * 8 + (y & 7)];
        const bits = byte ^ (character & 128 ? 255 : 0);
        pixels[(y + 40) * 320 + x + 32] = bits & (128 >> (x & 7)) ? foreground : background;
      }
    }
    return pixels;
  }
}

/** One step per PAL VBI. Fire is accepted during hold, as in the original.
 * The captured intro and first 512 reveal frames preserve a verified original
 * raster/POKEY phase. Later hold has no timeout; native random writes continue.
 */
export class Ending {
  constructor(data, { random = () => Math.floor(Math.random() * 256) } = {}) {
    if (!data.preparedRobboEnding) throw new TypeError('Await prepareEnding(data) before creating Ending');
    this.data = data; this.random = random; this.phase = 'intro'; this.cursor = 0;
    this.holdFrame = 0; this.hold = new EndingHold(data);
    this.sound = new Sound(data.sound);
    this.sound.parameters.set(data.holdData.soundParameters);
    this.sound.registers.set(data.holdData.soundRegisters);
    this.width = data.width; this.height = data.height;
    this.registers = new Uint8Array(9); this.pixels = new Uint8Array(this.width * this.height);
    this.renderBuffer = new Uint8Array(this.pixels.length);
    this.done = false; this.returnEffect = data.returnEffect;
  }
  image(index) {
    const size = this.width * this.height;
    return this.data.atlas.subarray(index * size, (index + 1) * size);
  }
  step({ fire = false } = {}) {
    if (this.done) return this;
    if (this.phase === 'intro') {
      const frame = this.data.intro[this.cursor++];
      this.pixels = this.image(frame.image); this.registers.set(frame.registers);
      if (this.cursor === this.data.intro.length) { this.phase = 'hold'; this.cursor = 0; }
      return this;
    }
    if (this.phase === 'hold' && fire) {
      this.hold.commitPending(); this.phase = 'closing'; this.cursor = 0;
      this.closingFontBase = this.holdFrame;
      this.sound.step(this.data.holdData.clock + this.holdFrame);
      this.sound.trigger(9);
    }
    if (this.phase === 'hold') {
      const frame = this.data.hold[this.holdFrame % this.data.hold.length];
      const reference = this.holdFrame < this.data.hold.length;
      const random = reference ? frame.random : Uint8Array.from(frame.random, () => this.random() & 255);
      this.hold.advanceRandom(random, frame);
      this.pixels = reference ? this.image(frame.image)
        : this.hold.render(this.holdFrame, { pixels: this.renderBuffer });
      this.sound.step(this.data.holdData.clock + this.holdFrame);
      this.registers.set(this.sound.registers); this.holdFrame++;
      return this;
    }
    const frame = this.data.closing[this.cursor];
    this.pixels = this.hold.render(this.closingFontBase + this.cursor,
      { rowColors: frame.rowColors, pixels: this.renderBuffer });
    if (this.cursor) this.sound.step(this.data.holdData.clock + this.closingFontBase + this.cursor);
    this.registers.set(this.sound.registers);
    if (++this.cursor === this.data.closing.length) {
      this.sound.trigger(this.returnEffect);
      this.phase = 'done'; this.done = true;
    }
    return this;
  }
}
