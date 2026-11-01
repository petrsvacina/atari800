import {decode64, picture} from './engine.mjs';

// $6561, $65B9, $6688, $6755: 40-column output, wrapping and drop capitals.
export class TextScreen {
  constructor(rules, language) {
    this.rules = rules; this.language = language;
    this.cells = new Uint8Array(600).fill(32);
    this.font = decode64(rules.font);
    this.position = 400; this.column = 0; this.sentence = true; this.icon = 0;
  }
  put(c) {
    this.cells[this.position++] = c;
    this.column = (this.column + 1) % 40;
    if (this.position === 600) {
      this.cells.copyWithin(0, 40); this.cells.fill(32, 560); this.position = 560;
    }
  }
  newline() { do { this.put(32); } while (this.column); }
  literal(text) { for (const c of text) this.put(c.charCodeAt(0)); }
  indent() { this.newline(); this.put(32); this.put(32); }
  word(text) {
    if (this.column + text.length > 40) this.newline();
    for (let i = 0; i < text.length; i++) {
      let c = text.charCodeAt(i);
      if (c === 255) { i++; continue; }
      if (c === 60) { this.newline(); continue; }
      if (c === 46) this.sentence = true;
      else if (c >= 65 && c <= 90) {
        if (!this.sentence) c += 32;
        this.sentence = false;
      }
      this.put(c);
    }
  }
  message(parts) {
    parts.forEach(([word, proper], index) => {
      if (proper) this.sentence = true;
      this.word(word);
      if (proper) this.sentence = false;
      if (index === parts.length - 1 || (this.column && !parts[index + 1][0].startsWith('.'))) this.put(32);
    });
  }
  dropcap(letter) {
    const source = ((letter.charCodeAt(0) - 65) * 4 + 123) * 8;
    this.icon = (this.icon + 1) & 7;
    const code = this.icon * 4;
    const original = decode64(this.rules.font);
    this.font.set(original.slice(source, source + 32), code * 8);
    this.put(code); this.put(code + 1);
    for (let i = 0; i < 38; i++) this.put(32);
    this.put(code + 2); this.put(code + 3);
  }
  event(e) {
    switch (e[0]) {
      case 'common': if (e[2]) { this.newline(); this.sentence = true; } this.message(this.language.common[e[1]]); break;
      case 'chapter': this.sentence = true; this.indent(); this.message(this.language.chapters[e[1]].messages[e[2]]); break;
      case 'room': {
        this.indent();
        const parts = structuredClone(this.language.chapters[e[1]].rooms[e[2]]);
        this.dropcap(parts[0][0][0]); parts[0][0] = parts[0][0].slice(1);
        this.message(parts); break;
      }
      case 'item': this.sentence = false; this.message(this.language.items[e[1]]); break;
      case 'indent': this.indent(); break;
      case 'newline': this.newline(); break;
      case 'literal': this.literal(e[1]); break;
      case 'prompt': this.newline(); this.newline(); this.literal('>' + e[1]); this.newline(); break;
    }
  }
}

export function render(canvas, data, game, language) {
  const lang = data.languages[language], text = new TextScreen(data.rules, lang);
  for (const event of game.events) text.event(event);
  const indices = new Uint8Array(320 * 200).fill(4);
  indices.set(picture(data.rules, lang, game.state));
  for (let row = 0; row < 15; row++) for (let col = 0; col < 40; col++) {
    const c = text.cells[row * 40 + col];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const bit = ((text.font[(c & 127) * 8 + y] >> (7 - x)) & 1) ^ (c >> 7);
      if (bit) indices[(80 + row * 8 + y) * 320 + col * 8 + x] = 14;
    }
  }
  const context = canvas.getContext('2d'), frame = context.createImageData(320, 200);
  for (let i = 0; i < indices.length; i++) {
    const color = indices[i] * 3;
    frame.data[i * 4] = data.palette[color]; frame.data[i * 4 + 1] = data.palette[color + 1];
    frame.data[i * 4 + 2] = data.palette[color + 2]; frame.data[i * 4 + 3] = 255;
  }
  context.putImageData(frame, 0, 0);
  return text;
}
