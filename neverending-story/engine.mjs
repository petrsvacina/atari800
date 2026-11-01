/* Native translation of the adventure handlers at $690C–$7144.
 * The supplied adventure's own condition/action data remains data, not 6502 code.
 */
export class Adventure {
  constructor(rules, hooks = {}) {
    this.rules = rules;
    this.hooks = hooks;
    this.events = [];
    this.verbose = true;
    this.random = hooks.random || (() => Math.floor(Math.random() * 256));
  }
  emit(...event) { this.events.push(event); this.hooks.update?.(); }
  common(id, newline = true) { this.emit('common', id, newline); }
  get counters() { return this.state.flags.subarray(32); }
  async start() {
    this.events = [];
    this.state = {chapter: 0, room: 1, image: 0, objects: Uint8Array.from(this.rules.initialObjects),
      flags: new Uint8Array(48), overlays: this.rules.initialOverlays.map(d => [...d])};
    this.state.flags[7] = 1;
    this.verbose = true;
    this.noun = 250; this.verb = 0; this.ended = false;
    await this.initialize();
    await this.automatic();
  }
  async initialize() {
    await this.execute(this.rules.chapters[this.state.chapter].initialize);
    this.describe(); this.verbose = true;
  }
  async automatic() {
    for (let transition = 0; transition < 3 && !this.ended; transition++) {
      try {
        await this.execute(this.rules.automatic);
        if (this.ended) return;
        await this.execute(this.rules.chapters[this.state.chapter].automatic);
        if (this.ended) return;
        const chapter = this.rules.chapters[this.state.chapter];
        await this.execute(chapter.roomScripts[this.state.room - chapter.base]);
        return;
      } catch (error) { if (error !== CHAPTER) throw error; }
    }
  }
  describe() {
    const s = this.state;
    if (!s.flags[7]) { this.common(63); return; }
    this.emit('room', s.chapter, s.room - this.rules.chapters[s.chapter].base);
    s.objects.forEach((location, id) => {
      if (location !== s.room || this.rules.itemPrefixes[id] === 64) return;
      this.emit('indent');
      const prefix = this.rules.itemPrefixes[id];
      if (prefix) this.common(prefix, false);
      this.emit('item', id);
      if (!prefix) this.common(16, false);
      else if (prefix !== 6) this.common(7, false);
    });
    s.image = this.rules.roomImages[s.room];
  }
  object() {
    const id = (this.noun - 50) & 255;
    const sprite = this.rules.objectSprites.indexOf(id);
    return {id, sprite, valid: sprite >= 0 && this.rules.objectSprites[sprite] !== 255,
      location: this.state.objects[id], address: 0xf00 + sprite * 128};
  }
  condition(code, a, b) {
    const s = this.state;
    switch (code) {
      case 0: return s.objects[a] === s.room;
      case 1: return s.objects[a] === 252;
      case 2: return !!s.flags[a];
      case 3: return !s.flags[a];
      case 4: return this.counters[a] === 0;
      case 5: return this.counters[a] === b;
      case 6: return s.objects[a] !== 253;
      case 7: return s.objects[a] === 253;
      case 8: return a >= this.random(); // CMP threshold, POKEY RANDOM
      case 9: return s.room === a;
      default: throw new Error(`Unknown original condition ${code}`);
    }
  }
  async execute(script, depth = 0) {
    if (!script || depth > 128) throw new Error('Invalid adventure script');
    for (let p = 0; p < script.length && !this.ended; p++) {
      const [code, a, b] = script[p];
      if (code === 255) return;
      if (code === 254) continue;
      if (code >= 128) {
        if (!this.condition(code & 127, a, b)) {
          while (++p < script.length && script[p][0] !== 254 && script[p][0] !== 255) {}
          if (!script[p] || script[p][0] === 255) return;
        }
        continue;
      }
      const s = this.state, c = this.counters;
      switch (code) {
        case 0: {
          const path = this.rules.movements[this.verb - 1]?.find(([room]) => room === s.room);
          if (!path) this.common(2);
          else { s.room = path[1]; this.describe(); }
          break;
        }
        case 1: s.objects[a] = b === 250 ? s.room : b; break;
        case 2: { // DROP: $6997
          if (!this.noun) { this.common(25); break; }
          const o = this.object();
          if (!o.valid || o.location !== 252) { this.common(10); break; }
          s.objects[o.id] = s.room; c[0] = (c[0] - 1) & 255;
          if (this.verbose) this.common(13);
          const overlay = s.overlays.slice(0, 5).find(d => d[2] + 256 * d[3] === o.address);
          if (overlay) { overlay[2] = overlay[3] = 0; }
          break;
        }
        case 3: { // TAKE: $69E9
          if (!this.noun) { this.common(25); break; }
          const o = this.object();
          if (!o.valid) { this.common(3); break; }
          if (o.location === 252) { this.common(9); break; }
          if (o.location !== s.room || o.location === 253) { this.common(8); break; }
          if (c[0] === 5) { this.common(11); break; }
          s.objects[o.id] = 252; c[0] = (c[0] + 1) & 255;
          if (this.verbose) this.common(12);
          const overlay = s.overlays.slice(0, 5).find(d => !d[3]);
          if (overlay) { overlay[2] = o.address & 255; overlay[3] = o.address >> 8; }
          break;
        }
        case 4: c[a] = b; break;
        case 5: s.flags[a] = 1; break;
        case 6: s.flags[a] = 0; break;
        case 7: return;
        case 8: this.emit('chapter', s.chapter, a); break;
        case 9: {
          this.common(14);
          let found = false;
          s.objects.forEach((location, id) => {
            if (location === 252) { found = true; this.emit('indent'); this.emit('item', id); }
          });
          if (!found) { this.emit('indent'); this.common(15, false); }
          this.emit('newline'); break;
        }
        case 10: this.describe(); break;
        case 11: this.emit('music', true); this.hooks.music?.(true); break;
        case 12: this.emit('music', false); this.hooks.music?.(false); break;
        case 13: if (c[a] !== 255) c[a]++; break;
        case 14: if (c[a]) c[a]--; break;
        case 15: break;
        case 16: s.image = a === 250 ? this.rules.roomImages[s.room] : a; break;
        case 17: this.common(a); break;
        case 18: await this.hooks.save?.(this.snapshot()); break;
        case 19: {
          const saved = await this.hooks.load?.();
          if (saved) { this.restore(saved); this.describe(); }
          break;
        }
        case 20: this.emit('newline'); this.common(53); this.emit('newline'); this.ended = true; break;
        case 21: c[0] = (c[0] - 1) & 255; break;
        case 22: c[0] = (c[0] + 1) & 255; break;
        case 23: {
          const pointer = a === 250 ? 0 : 0xf00 + (a - 2) * 128;
          s.overlays[5][2] = pointer & 255; s.overlays[5][3] = pointer >> 8; break;
        }
        case 24: s.room = a; break;
        case 25: this.noun = a; break;
        case 26: this.emit('newline'); this.common(29); await this.hooks.pause?.(); this.emit('newline'); break;
        case 27: this.verbose = false; break;
        case 28: this.verbose = true; break;
        case 29: this.verb = a; return this.execute(this.rules.commandScripts[a - 1], depth + 1);
        case 30:
          if (!this.noun || this.noun >= 11) { this.common(37); break; }
          this.verb = this.noun; return this.execute(this.rules.commandScripts[this.verb - 1], depth + 1);
        case 31:
          s.flags[2] = 0; s.chapter++; s.room = s.chapter === 1 ? 52 : 77;
          this.emit('newline'); this.common(47); this.emit('literal', String(s.chapter)); this.emit('newline');
          await this.hooks.pause?.(); await this.initialize();
          // $6318 jumps into the main loop; abandon the calling command.
          throw CHAPTER;
        case 32:
          this.emit('newline'); this.common(52);
          if (await this.hooks.confirm?.()) { this.common(53); this.ended = true; }
          else this.emit('newline');
          break;
        default: throw new Error(`Unknown original action ${code}`);
      }
    }
  }
  tokenize(line, vocabulary) {
    const words = line.slice(0, 78).toLowerCase().trim().split(/ +/).filter(Boolean).slice(0, 16);
    const tokens = [];
    for (const word of words) {
      const head = word.slice(0, 3).padEnd(3, ' ');
      const entry = vocabulary.find(([key]) => key === head);
      if (!entry) return {unknown: word};
      let token = entry[1];
      if ((token === 1 || token === 5) && word.slice(3, 5) === 'th') {
        if (word[5] === 'e') token = token === 1 ? 2 : 4;
        else if (word[5] === 'w') token = token === 1 ? 8 : 6;
      }
      tokens.push(token);
    }
    return {tokens};
  }
  async command(line, vocabulary) {
    if (this.ended) return;
    this.emit('prompt', line.slice(0, 78).toLowerCase());
    const parsed = this.tokenize(line, vocabulary);
    try {
      if (parsed.unknown) { this.common(0); this.emit('literal', '"' + parsed.unknown + '"'); this.emit('newline'); }
      else {
        const t = parsed.tokens;
        let processed = false;
        for (let p = 0; p < t.length;) {
          this.noun = 250;
          while (p < t.length && (!t[p] || t[p] >= 50)) p++;
          if (p === t.length) { if (!processed) { this.common(1); this.emit('newline'); } break; }
          this.verb = t[p++];
          while (p < t.length && !t[p]) p++;
          if (p < t.length && t[p] !== 255) this.noun = t[p++];
          processed = true;
          const index = this.rules.commands.findIndex(([verb, noun]) => verb === this.verb && (noun === 251 || noun === this.noun));
          if (index < 0) { this.common(3); break; }
          await this.execute(this.rules.commandScripts[index]);
        }
      }
    } catch (error) { if (error !== CHAPTER) throw error; }
    await this.automatic();
    this.hooks.update?.();
  }
  snapshot() {
    return {format: 'neverending-story-native', version: 1,
      ...this.state, objects: [...this.state.objects], flags: [...this.state.flags],
      overlays: this.state.overlays.map(d => [...d]), verbose: this.verbose,
      ended: this.ended, events: this.events.map(e => [...e])};
  }
  restore(data) {
    if (!data || data.format !== 'neverending-story-native' || data.version !== 1 ||
        !Number.isInteger(data.chapter) || data.chapter < 0 || data.chapter > 2 ||
        !Number.isInteger(data.room) || data.room < 0 || data.room >= 125 ||
        !Number.isInteger(data.image) || data.image < 0 || data.image >= 57 ||
        data.objects?.length !== this.rules.initialObjects.length || data.flags?.length !== 48 ||
        data.overlays?.length !== 6 || data.overlays.some(d => d.length !== 6 || d.some(v => !Number.isInteger(v) || v < 0 || v > 255)) ||
        [...data.objects, ...data.flags].some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('Invalid saved adventure');
    this.state = {chapter: data.chapter, room: data.room, image: data.image,
      objects: Uint8Array.from(data.objects), flags: Uint8Array.from(data.flags), overlays: data.overlays.map(d => [...d])};
    this.verbose = !!data.verbose; this.ended = !!data.ended;
    this.events = Array.isArray(data.events) ? data.events.slice(-10000) : [];
  }
}
const CHAPTER = Symbol('chapter');

export function decode64(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

export function picture(rules, language, state) {
  const pixels = decode64(language.background);
  const graphics = decode64(rules.chapters[state.chapter].graphics);
  const small = decode64(rules.smallGraphics);
  const draw = d => {
    const [row, x, lo, hi, height, width] = d;
    const address = lo + hi * 256;
    for (let y = 0; y < height * 8; y++) for (let col = 0; col < width; col++) {
      const source = address + y * width + col;
      pixels[(row * 8 + y) * 40 + x + col] = source >= 0x2000 ? graphics[source - 0x2000] : small[source - 0xb00];
    }
  };
  for (const overlay of state.overlays) if (overlay[3]) draw(overlay);
  const descriptor = rules.descriptors[state.image];
  draw(descriptor);
  const [row, x, , , height, width] = descriptor;
  const colors = [154, 224, 38, 254];
  const indices = new Uint8Array(320 * 80);
  for (let y = 0; y < 80; y++) for (let p = 0; p < 160; p++) {
    const v = (pixels[y * 40 + (p >> 2)] >> (6 - (p & 3) * 2)) & 3;
    const inMask = y >= row * 8 && y < (row + height) * 8 && p >= x * 4 && p < (x + width) * 4;
    const color = v === 0 && inMask ? rules.sceneColors[state.image] : colors[v];
    indices[y * 320 + p * 2] = indices[y * 320 + p * 2 + 1] = color;
  }
  return indices;
}
