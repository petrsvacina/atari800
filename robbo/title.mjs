/* Native Robbo title data writers, translated from the supplied XEX.
 * Typist $A8C9–$A947; large masked logo $ABD8–$AC82.
 */
const decode = value => typeof value === 'string'
  ? Uint8Array.from(atob(value), character => character.charCodeAt(0)) : Uint8Array.from(value);

export function prepareTitle(data) {
  if (data.preparedRobboTitle) return data;
  return { ...data, font: decode(data.font), credits: decode(data.credits),
    instructions: decode(data.instructions), logoGlyphs: decode(data.logoGlyphs),
    preparedRobboTitle: true };
}

export class TitleTypist {
  constructor(data, { clock = 0, timer = 255, cursor = 0, offset = 0 } = {}) {
    this.data = prepareTitle(data);
    // Eight displayed rows and one blank source row for the original copy loop.
    this.screen = new Uint8Array(288);
    this.registers = new Uint8Array(9);
    this.clock = clock & 255; this.timer = timer & 65535;
    this.cursor = cursor; this.offset = offset;
    this.soundKind = null; this.writes = [];
    this.endCount = 0; this.demoRequested = false;
  }
  write(register, value) { this.registers[register] = value; this.writes.push([register, value]); }
  line() {
    this.offset += this.cursor;
    this.timer = (this.timer & 0xFF00) | 15;
    this.write(0, 2); this.write(1, 0xC4);
    this.screen.copyWithin(0, 32, 288);
    this.cursor = 0;
  }
  /** One title-loop pass after the OS timer tick. With decrementTimer=true,
   * perform that VBI countdown here too; the original timer is 16-bit CDTMV1.
   */
  step(clock, { decrementTimer = true } = {}) {
    this.clock = clock === undefined ? (this.clock + 1) & 255 : clock & 255;
    if (decrementTimer && this.timer) this.timer--;
    this.writes = []; this.soundKind = null;
    this.write(1, 0);
    this.screen[224 + this.cursor] = this.clock & 8 ? 128 : 0;
    if (!this.timer) {
      if (this.cursor >= 32) {
        this.soundKind = 'line'; this.line();
      } else {
        const position = this.offset + this.cursor;
        let character = position < 0
          ? this.data.instructionPrefix[this.data.instructionPrefix.length + position]
          : this.data.instructions[position];
        if (character === undefined) throw new RangeError('Invalid original title text cursor');
        this.timer = (this.timer & 0xFF00) | (2 + (character & 3));
        this.write(0, 0x10); this.write(1, 0x82);
        this.soundKind = 'character';
        if (character === 255) {
          this.timer = (this.timer & 255) | 1024;
          this.offset = -3; character = 64; this.endCount++;
        }
        if (character === 64) {
          this.screen[224 + this.cursor] = 0;
          this.cursor++; this.line(); this.soundKind = 'newline';
        } else {
          this.screen[224 + this.cursor] = character;
          this.cursor++;
        }
      }
    }
    this.demoRequested = this.timer >>> 8 === 1;
    return this.screen;
  }
}

export class TitleLogo {
  constructor(data, { random = () => 255, direction = 0 } = {}) {
    this.data = prepareTitle(data); this.random = random;
    this.screen = new Uint8Array(128);
    this.mask = (this.data.maskSeed[0] << 8) | this.data.maskSeed[1];
    this.colors = Uint8Array.from(this.data.colors);
    this.direction = direction & 255;
  }
  left() { this.mask = ((this.mask << 2) | (this.mask >>> 14)) & 65535; }
  right() { this.mask = ((this.mask >>> 2) | (this.mask << 14)) & 65535; }
  step(clock) {
    for (let color = 4; color > 0; color--)
      if (!(this.random('title.color') & 31)) this.colors[color] = (this.colors[color] + 16) & 255;
    for (let column = 4; column >= 0; column--) {
      const glyph = this.data.logoTiles[column];
      for (let row = 0; row < 8; row++) {
        const bits = this.data.logoGlyphs[glyph * 8 + row];
        let expanded = 0;
        for (let bit = 7; bit >= 0; bit--) expanded = (expanded << 2) | (bits & (1 << bit) ? 3 : 0);
        const at = row * 16 + column * 3 + 1;
        this.screen[at] = (expanded >>> 8) & (this.mask >>> 8);
        this.screen[at + 1] = expanded & (this.mask & 255);
        this.left();
      }
    }
    if (!(clock & 3)) {
      if (!(this.random('title.direction') & 31)) this.direction = (this.direction + 1) & 255;
      if (this.direction & 1) this.left(); else this.right();
    }
    return this.screen;
  }
}
