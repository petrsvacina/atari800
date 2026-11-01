// Native translation of the supplied Shift rules. No processor/interpreter runtime.
const byte = n => n & 255;
const COUNTS = [4, 4, 6, 6, 6, 9];
const SPEEDS = [8, 8, 3, 3, 8, 4];
const UNWIND = Symbol('restart original main loop');
const codeChar = c => /[A-F]/.test(c) ? c.charCodeAt(0) - 64 : +c + 48;

export class Shift {
  constructor(data, level = 0, subject = [0x12, 0x34]) {
    this.data = data;
    this.fonts = data.fonts.map(a => Uint8Array.from(a));
    this.flags = Uint8Array.from(data.flags);
    this.map = new Uint8Array(1024);
    Object.assign(this, {frame: 0, animationClock: 0, timerClock: 0, seconds: 0x60,
      spikeFrame: 0, spriteFrame: 0, collisionHigh: 0, keyboardDelay: 0,
      subject: [...subject], music: true, ended: false, events: [], input: 15});
    this.load(level);
    this.execution = this.run(); this.execution.next();
  }

  load(level) { // $408B, $40E2, $41AD, $4210
    const source = this.data.levels[level];
    Object.assign(this, {level, shiftDelay: 0, switchDelay: this.switchDelay || 0,
      gate: 0, supportCheck: 0, falling: 0, key: 0, xHigh: 0,
      idleDelay: 2, jump: 255, solid: 16, white: 15, pose: 1, spriteColor: 0});
    this.flags[100] = this.flags[228] = 48;
    for (const font of this.fonts) font.copyWithin(0x320, 0x300, 0x308);
    this.x = source.spawn[0]; this.y = source.spawn[1];
    this.setSprite(2);
    this.platforms = Array.from({length: 4}, (_, i) => {
      const p = source.platforms[i];
      const slot = this.platforms?.[i] || [0, 0, 0, 0, 0, 0, 0, 0];
      slot[0] = 0;
      if (p) slot.splice(0, 4, p[0], p[1], p[2] & 255, p[2] >> 8);
      return slot;
    });
    this.map.set(source.map);
    if (level !== 36) {
      const at = source.codeAt - 0x2000;
      [...source.code].forEach((c, i) => { this.map[at + i] = codeChar(c); });
      const n = level + 1;
      this.map[40] = 48 + Math.floor(n / 10); this.map[41] = 48 + n % 10;
    }
    this.drawPlatforms(false);
    if (level === 0) {
      const [a, b] = this.subject;
      this.map.set([48+(b>>4), 48+(b&15), 48+(a>>4), 48+(a&15)], 99);
    } else if (level === 3) {
      this.map.set(this.data.shiftText.filter(n => n !== 0), 401); this.map[367] = 19;
    } else if (level === 5) this.map.set(this.data.subjectText.filter(n => n !== 0), 163);
    this.events.push({type: 'level', level});
  }

  setSprite(set) { // $4EFF
    this.spriteSet = set; this.spriteFrame = 0;
    this.sprite = this.data.sprites[set].slice(0, 16);
  }

  animate() { // $4F0C
    if (this.jump < 128 || this.falling || this.animationClock < SPEEDS[this.pose]) return;
    this.animationClock = 0;
    this.spriteFrame = byte(this.spriteFrame + 1);
    if (this.spriteFrame >= COUNTS[this.pose]) this.spriteFrame = 0;
    this.sprite = this.data.sprites[this.spriteSet].slice(this.spriteFrame * 16, this.spriteFrame * 16 + 16);
    if (!this.spriteFrame && (this.pose === 2 || this.pose === 3)) this.sound('step');
  }

  sound(name) { this.events.push({type: 'sound', name}); }

  *wait() { // $3F8D, raster boundary then counters and the original level-13 timer
    yield;
    this.frame = byte(this.frame + 1); this.animationClock = byte(this.animationClock + 1);
    if (this.level === 12 && this.seconds && this.pose !== 4 && this.pose !== 5) {
      if (++this.timerClock >= 50) {
        this.timerClock = 0;
        const n = (this.seconds >> 4) * 10 + (this.seconds & 15) - 1;
        this.seconds = (Math.floor(n / 10) << 4) | n % 10;
        const chars = [48+(this.seconds>>4), 48+(this.seconds&15)];
        if (this.white) this.map.set(chars, 99);
        else { this.map[899] = chars[1]; this.map[900] = chars[0]; }
      }
    }
  }
  *delay(n) { while (n--) yield* this.wait(); }
  *release() { do { yield* this.wait(); } while ((this.input & 31) !== 15); }

  address(x, y) { // $4303/$4309; hardware coordinates and 9-bit horizontal wrap
    const row = (byte(y - 32) & 248) * 5;
    const column = (this.collisionHigh ? x >> 3 : byte(x - 48) >> 3) + (this.collisionHigh ? 26 : 0);
    return row + column;
  }
  cell(index) {
    // The original's off-screen bottom probes can reach the following font
    // data at $2400. Preserve those reads rather than inventing an outer wall.
    return index < 1024 ? this.map[index] || 0 : this.fonts[0][index-1024] || 0;
  }
  *pair(index) { // $44C2
    if (!(yield* this.touch(index))) return 0;
    return yield* this.touch(index + 1);
  }
  *side(index) { // $44A6
    if ((this.y & 7) < 4 && !(yield* this.touch(index))) return 0;
    return yield* this.touch(index + 40);
  }
  *touch(index) { // $44D5; collision classifications from the original $7F30 table
    const tile = this.cell(index), type = this.flags[tile] & 240;
    if (type === this.solid || type === 208 || type === 48) return 0;
    if (type === 240) {
      if (!this.falling && !this.supportCheck) this.die();
      return this.falling || this.supportCheck ? 1 : 0;
    }
    if (type === 224) { this.gate = 1; return 1; }
    if (type === 192) { // $49B5, key's three-frame glyph animation
      if (this.key) return 1;
      this.key = 1; this.sound('key');
      for (let frame = 0; frame < 3; frame++) {
        for (let i = 0; i < 2; i++) this.fonts[i].set(this.data.fonts[i].slice(0x308 + frame * 8, 0x310 + frame * 8), 0x320);
        yield* this.delay(3);
      }
      this.flags[100] = 0; this.flags[228] = 16;
      return this.jump < 128 ? 0 : 1;
    }
    if (type >= 128 && type <= 176) { // $496B, one of four platform switches
      if (this.switchDelay) return 1;
      this.switchDelay = 25; this.sound('switch');
      const slot = this.platforms[(type - 128) >> 4];
      this.restorePlatform(slot); slot[0] ^= slot[1];
      yield* this.drawPlatformAnimated(slot);
      return this.jump < 128 ? 0 : 1;
    }
    if (type === 64) { // $4298, original hidden-room entrance
      this.setSprite(8); this.pose = 5; this.spriteColor = 100;
      yield* this.wipe(); yield* this.delay(25); yield* this.release();
      this.load(36); throw UNWIND;
    }
    return 1;
  }

  airborneSprite() { this.setSprite(this.pose === 1 || this.pose === 3 ? 6 : 7); }

  *controls() { // $4362
    const bits = this.input;
    if (bits === 15) return;
    this.collisionHigh = this.xHigh;
    if (!(bits & 1) && this.jump >= 128 && !this.falling && this.level !== 0) {
      const y = byte(this.y - 2);
      if (y >= 32 && (yield* this.pair(this.address(byte(this.x+3), y)))) {
        this.jump = 2; this.jumpClock = 6; this.airborneSprite();
      }
    }
    if (!(bits & 4)) {
      const oldPose = this.pose; this.pose = 2;
      if (this.jump < 128 || this.falling) this.airborneSprite();
      else if (oldPose !== 2) this.setSprite(1);
      this.idleDelay = 2;
      const x = byte(this.x - 2);
      if (this.x < 2) this.collisionHigh = 0;
      if ((this.collisionHigh || x >= 48) && (yield* this.side(this.address(x, this.y)))) {
        this.xHigh = this.collisionHigh; this.x = x; yield* this.support();
      }
    } else if (!(bits & 8)) {
      const oldPose = this.pose; this.pose = 3;
      if (this.jump < 128 || this.falling) this.airborneSprite();
      else if (oldPose !== 3) this.setSprite(0);
      this.idleDelay = 2;
      const x = byte(this.x + 2);
      if (this.x >= 254) this.collisionHigh = 1;
      if (!(this.xHigh && x >= 96) && (yield* this.side(this.address(byte(x+15), this.y)))) {
        this.xHigh = this.collisionHigh; this.x = x; yield* this.support();
      }
    }
    if (this.input & 16) yield* this.shift();
  }

  *support() { // $4672
    if (this.falling || this.jump < 128) return;
    this.supportCheck = 1;
    if (yield* this.pair(this.address(byte(this.x+3), byte(this.y+16)))) {
      this.falling = 1; this.jump = 255;
    }
    this.supportCheck = 0;
  }
  idle() { // $46EB
    this.y = byte(((byte(this.y-32) & 248) + 32));
    if (this.pose === 0 || this.pose === 2) { this.pose = 0; this.setSprite(3); }
    else { this.pose = 1; this.setSprite(2); }
  }
  *gravity() { // $469C/$4731
    if (this.jump >= 128) {
      if (!this.falling) return;
      this.jumpClock >>= 1;
      this.y = byte(this.y + (this.jumpClock ? 1 : 2));
      const free = yield* this.pair(this.address(byte(this.x+3), byte(this.y+15)));
      if (!free && this.pose !== 4) {
        this.falling = 0; this.idle(); this.shiftDelay = 12; this.sound('step');
        yield* this.pair(this.address(byte(this.x+3), byte(this.y+15)));
      }
      return;
    }
    const phase = this.jump, y = byte(this.y - [0, 1, 2][phase]);
    if (phase && (y < 32 || !(yield* this.pair(this.address(byte(this.x+3), y))))) {
      this.jump = 0; this.jumpClock = 4; return;
    }
    this.y = y;
    if (!--this.jumpClock) {
      this.jump = byte(phase - 1);
      if (this.jump >= 128) {
        yield* this.support(); if (!this.falling) this.idle();
      } else this.jumpClock = [4, 8, 6][this.jump];
    }
  }
  die() { // $4779
    this.gate = 0; this.sound('death');
    this.setSprite(this.pose === 0 || this.pose === 2 ? 4 : 5);
    this.pose = 4; this.animationClock = 0; this.spriteColor = 37;
  }

  platformGeometry(p) { // $480F, direction bits index the original signed strides
    const direction = p[0], stride = [-1, 1, -40, 40, 40][direction >> 1];
    let character = (direction & 3) ? 77 : 81;
    let delta = 1;
    if (!(direction & 10)) { delta = -1; character += 3; }
    if (!this.white) { character += (direction & 10) ? 3 : -3; delta = -delta; }
    return {stride, character, delta, at: p[2] + (p[3] << 8) - 0x2000};
  }
  drawPlatforms() { this.platforms.forEach(p => this.drawPlatform(p)); }
  drawPlatform(p) {
    if (!p[0]) return;
    const g = this.platformGeometry(p);
    for (let i = 0; i < 4; i++) {
      const at = g.at + (i+1)*g.stride;
      p[i+4] = this.map[at] || 0; this.map[at] = byte(g.character + i*g.delta);
    }
  }
  *drawPlatformAnimated(p) { // $4813; gravity also runs on each animation frame
    if (!p[0]) return;
    const g = this.platformGeometry(p);
    for (let i = 0; i < 4; i++) {
      const at = g.at + (i+1)*g.stride;
      p[i+4] = this.map[at] || 0; this.map[at] = byte(g.character + i*g.delta);
      yield* this.gravity(); yield* this.wait(); yield* this.gravity(); yield* this.wait();
    }
  }
  restorePlatform(p) { // $4911
    if (!p[0]) return;
    const g = this.platformGeometry(p);
    for (let i = 0; i < 4; i++) this.map[g.at + (i+1)*g.stride] = p[i+4];
  }

  *shift() { // $4533: both support probes must be the current solid colour
    if (this.shiftDelay || this.falling || this.jump < 128 || this.level < 2 || this.level === 36) return;
    const at = this.address(byte(this.x+3), byte(this.y+16));
    if ((this.flags[this.cell(at)] & 240) !== this.solid || (this.flags[this.cell(at+1)] & 240) !== this.solid) return;
    this.shiftDelay = 12; yield* this.release(); this.sound('shift');
    this.platforms.forEach(p => this.restorePlatform(p));
    for (let part = 0; part < 2; part++) for (let i = 0; i < 250; i++) {
      const a = part * 250 + i, b = 999 - a, t = this.map[a];
      this.map[a] = this.map[b]; this.map[b] = t;
      if (((249-i) & 63) === 0) yield* this.wait();
    }
    this.spriteColor = this.white; this.white ^= 15; this.solid ^= 16;
    this.y = byte(232 - this.y);
    this.xHigh = !this.xHigh && this.x < 145 ? 1 : 0;
    this.x = byte(144 - this.x);
    for (const p of this.platforms) {
      if (!p[0]) break;
      const at = 0x43e7 - (p[2] | p[3] << 8); p[2] = at & 255; p[3] = at >> 8;
      if (p[1] & 3) { if ((p[1] & 3) !== 3) p[1] ^= 3; if (p[0] & 3) p[0] ^= 3; }
      if (p[1] & 12) { if ((p[1] & 12) !== 12) p[1] ^= 12; if (p[0] & 12) p[0] ^= 12; }
    }
    this.drawPlatforms(); this.events.push({type:'shift'});
  }

  *wipe() { // $479F, line-by-line disappearance with original sprite animation
    for (let row = 0; row < 25; row++) {
      this.map.fill(0, row*40, row*40+40); yield* this.wait(); this.animate();
    }
    if (this.jump >= 128 && !this.falling) while (this.spriteFrame !== COUNTS[this.pose]-1) {
      yield* this.wait(); this.animate();
    }
  }
  *complete() { // $3EF6
    if (!this.gate || this.jump < 128 || this.falling) return;
    this.sound('gate'); this.setSprite(8); this.pose = 5; this.spriteColor = 100;
    yield* this.wipe(); this.spriteFrame = byte(this.spriteFrame-2);
    for (;;) {
      const current = this.spriteFrame;
      do { yield* this.wait(); this.animate(); } while (this.spriteFrame === current);
      this.spriteFrame = byte(this.spriteFrame-2);
      if (this.spriteFrame === 254) break;
    }
    yield* this.delay(25); yield* this.release();
    if (this.level === 35) { yield* this.ending(); return; }
    this.load(this.level === 36 ? 30 : this.level + 1);
  }

  *ending() { // $4A69: original ending panel and subject-number reveal
    this.music = true; this.events.push({type:'music',music:true}); this.map.fill(0); yield* this.delay(25);
    this.xHigh = 0; this.x = 0; this.white = 15; this.spriteColor = 0;
    this.endingFont = true;
    const panel = [...this.data.panels[2]], [a, b] = this.subject;
    const chars = n => [48+(n>>4),48+(n&15)];
    panel.splice(this.data.endingSubjectAt[0], 4, ...chars(b), ...chars(a));
    const n = (a>>4)*10+(a&15)+1, next = byte((Math.floor(n/10)<<4) | n%10);
    this.subject[0] = next;
    panel.splice(this.data.endingSubjectAt[1], 4, ...chars(b), ...chars(next));
    for (let column = 0; column < 20; column++) {
      for (let row = 0; row < 25; row++) for (const x of [column, 39-column]) this.map[row*40+x] = panel[row*40+x];
      yield* this.delay(2);
    }
    this.ended = true; this.events.push({type:'ending'});
  }

  *run() { // $3E1C main loop
    for (;;) try {
      yield* this.wait();
      if (this.ended) continue;
      if (this.pose === 4) {
        yield* this.wipe(); yield* this.delay(50); yield* this.release(); this.load(this.level);
      } else if (this.pose < 4) {
        this.animate(); yield* this.controls(); yield* this.gravity();
      }
      if (!(this.frame & 7)) {
        this.spikeFrame = (this.spikeFrame + 1) & 3;
        const which = this.white ? 0 : 1;
        for (let i = 0; i < 4; i++) this.fonts[which].set(this.data.spikes[which].slice(this.spikeFrame*8, this.spikeFrame*8+8), 0x398+i*8);
      }
      if (this.shiftDelay) this.shiftDelay--;
      if (this.switchDelay) this.switchDelay--;
      if (this.jump >= 128 && !this.falling && (this.pose === 2 || this.pose === 3) && !--this.idleDelay) {
        if (this.pose === 2) { this.pose = 0; this.setSprite(3); }
        else { this.pose = 1; this.setSprite(2); }
      }
      if (this.keyboardDelay) this.keyboardDelay--;
      if (this.restartRequested) {
        this.restartRequested = false;
        if (!this.keyboardDelay) { this.keyboardDelay = 60; this.load(this.level); }
      }
      yield* this.complete();
    } catch (error) { if (error !== UNWIND) throw error; }
  }

  tick(input = 15) {
    this.input = input; this.events = []; this.execution.next(); return this.events;
  }
  state() {
    const names = ['level','frame','animationClock','idleDelay','shiftDelay','switchDelay','key','jump',
      'jumpClock','seconds','timerClock','spriteFrame','spikeFrame','gate','pose','falling','supportCheck',
      'solid','white','spriteSet','x','y','xHigh','keyboardDelay'];
    return {...Object.fromEntries(names.map(k => [k, this[k] || 0])),
      map: [...this.map.slice(0, 1000)], platforms: this.platforms.map(p => [...p]), sprite: [...this.sprite],
      keyGlyph: [...this.fonts[0].slice(0x320, 0x328)], rotatedKeyGlyph: [...this.fonts[1].slice(0x320, 0x328)],
      spikes: [...this.fonts[0].slice(0x398, 0x3b8)], rotatedSpikes: [...this.fonts[1].slice(0x398, 0x3b8)],
      keyFlags: [this.flags[100], this.flags[228]], spriteColor: this.spriteColor};
  }
}
