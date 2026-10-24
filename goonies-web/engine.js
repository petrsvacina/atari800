/* Native platform and puzzle simulation. No Atari CPU or hardware at runtime. */
(function (root) {
  'use strict';
  const HZ = 60, WIDTH = 320, HEIGHT = 176;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const near = (a, b, dx = 11, dy = 10) => Math.abs(a.x - b.x) <= dx && Math.abs(a.y - b.y) <= dy;
  class Game {
    constructor(options = {}) {
      this.levels = options.levels || root.GOONIES_LEVELS;
      this.mode = options.mode || 'solo'; this.practice = !!options.practice;
      this.score = 0; this.lives = 5; this.selected = 0; this.tick = 0; this.events = [];
      this.phase = 'playing'; this.paused = false; this.message = ''; this.nextLife = 5000;
      this.randomState = options.seed ?? 0x476f6f6e;
      this.randomSource = typeof options.randomByte === 'function' ? options.randomByte : null;
      this.loadScene(clamp(options.scene || 0, 0, this.levels.length - 1));
    }
    emit(type, extra = {}) { this.events.push({ type, ...extra }); }
    drainEvents() { return this.events.splice(0); }
    addScore(amount) {
      this.score += amount;
      while (this.score >= this.nextLife) { this.lives++; this.nextLife += 5000; this.emit('life'); }
    }
    loadScene(index, checkpoint = null) {
      this.scene = index; this.level = this.levels[index]; this.age = 0; this.phase = 'playing';
      this.originalScene = root.GOONIES_ORIGINAL.scenes[index];
      this.rectangles = this.originalScene.rectangles.map(r => ({ ...r })); this.contacts = Array(8).fill(0);
      this.players = this.originalScene.players.map((s, id) => ({ id,
        native: { ...s, vx: s.vx > 127 ? s.vx - 256 : s.vx, vy: s.vy > 127 ? s.vy - 256 : s.vy },
        facing: 1, grounded: false, rail: null, climbing: false, attached: null,
        attachCooldown: 0, escaped: false, invincible: 0, oldUp: false }));
      for (const p of this.players) this.syncBody(p);
      this.state = { cooler: false, distracted: 0, key: false, opened: false, valves: [false, false],
        boards: 3, bell: 0, eggs: 0, cageDropped: false, drained: 0, leverA: false,
        leverB: false, treasure: false, boomRaised: false, collected: [], cooldowns: {} };
      Object.assign(this.state, { chairRaw: 36, coolerStage: 0, coolerClock: 2,
        pressY: 26, pressDirection: 0, money: [], moneyInside: 0, moneyAtDoor: false,
        maTarget: 114, maWait: 8, maIdle: 160, fireFrame: 1 });
      if (index === 0) this.ma = { ...this.originalScene.actors[2] };
      this.rooms = index ? new root.GooniesRooms.Rooms(this) : null;
      if (checkpoint) {
        if (!index && checkpoint.cooler) Object.assign(this.state, { coolerStage: 5, cooler: true, fireOff: true, fireOn: false });
        if (this.rooms) Object.assign(this.rooms, checkpoint.room);
        if (index === 6 && this.rooms.cageReleased) this.rooms.cage.y = 152;
      }
      this.rocks = []; this.eggs = []; this.shots = []; this.selected = 0;
      this.message = this.level.intro; this.emit('scene', { scene: index });
    }
    randomByte() { if (this.randomSource) return this.randomSource() & 255; this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState >>> 24; }
    switchActor() {
      if (this.phase !== 'playing' || this.paused) return;
      const next = 1 - this.selected;
      if (!this.players[next].escaped) { this.selected = next; this.emit('switch'); }
    }
    step(inputs = []) {
      if (this.paused || this.phase === 'over' || this.phase === 'complete') return;
      this.tick++;
      if (this.phase === 'hurt') {
        if (--this.wait <= 0) {
          if (this.lives <= 0) { this.phase = 'over'; this.emit('over'); }
          else this.loadScene(this.scene, this.checkpoint());
        }
        return;
      }
      if (this.phase === 'transition') {
        if (--this.wait <= 0) {
          if (this.scene === this.levels.length - 1 || this.practice) { this.phase = 'complete'; this.emit('complete'); }
          else this.loadScene(this.scene + 1);
        }
        return;
      }
      this.age++;
      if (this.age % 4) return;
      for (const player of this.players) { this.move(player, inputs[player.id] || {}); if (this.phase !== 'playing') return; }
      if (this.rooms) { this.rooms.stepActors(inputs); if (this.phase === 'playing') this.rooms.step(inputs); }
      else { this.house(); if (this.phase === 'playing') this.exits(); }
    }
    checkpoint() {
      const r = this.rooms;
      return { cooler: this.state.coolerStage > 0, room: !r ? null :
        this.scene === 1 ? { key: r.key } :
        this.scene === 2 ? { burst: r.burst } :
        this.scene === 3 ? { boards: r.boards, hammer: r.hammer } :
        this.scene === 4 ? { pile: r.pile } :
        this.scene === 6 ? { cageReleased: r.cageReleased, draining: r.draining, waterY: r.waterY } : {} };
    }
    syncBody(p) {
      const data = root.GOONIES_ORIGINAL, n = p.native;
      const frame = n.frame & 127;
      p.w = data.bodyWidths[frame] * 2; p.h = data.bodyHeights[frame];
      p.x = n.x * 2 + p.w / 2; p.y = n.y - 16 + p.h;
      p.vx = n.vx / 2; p.vy = n.vy / 4;
      p.climbing = !!n.climb; if (n.vx) p.facing = Math.sign(n.vx);
    }
    move(p, input) {
      if (p.escaped) return;
      if (p.invincible) p.invincible--;
      p.nativeMoved = true;
      const oldVy = p.native.vy;
      const result = root.GooniesMovement.step(p.native, { ...(p.freezeInput ? {} : input), jumpDisabled: !!p.jumpDisabled }, this.rectangles,
        root.GOONIES_ORIGINAL.bodyWidths, root.GOONIES_ORIGINAL.bodyHeights, this.contacts);
      p.jumpDisabled = false;
      p.freezeInput = false;
      this.syncBody(p); p.grounded = result.grounded; p.rail = result.rail ? true : null;
      if (oldVy >= 0 && p.native.vy < 0 && !p.native.climb) this.emit('jump', { player: p.id });
      if (p.native.y > 192 && p.native.y < 240) this.hurt('Pozor na propast. Zkus to znovu společně.');
    }
    once(id, message, score = 100) {
      if (this.state.collected.includes(id)) return false;
      this.state.collected.push(id); this.message = message; this.addScore(score); this.emit('puzzle', { id }); return true;
    }
    nativeOverlap(actor, box) {
      const data = root.GOONIES_ORIGINAL, frame = actor.frame & 127;
      return box.x2 >= actor.x && box.y2 >= actor.y
        && actor.x + data.bodyWidths[frame] >= box.x1
        && actor.y + data.bodyHeights[frame] >= box.y1;
    }
    house() {
      const s = this.state, actors = this.players.map(p => p.native);
      this.houseMother();
      if (this.phase !== 'playing') return;
      const pushers = this.mode === 'two' ? actors : [actors[this.selected]];
      for (const actor of pushers) {
        if (this.nativeOverlap(actor, { x1: s.chairRaw, x2: s.chairRaw, y1: 76, y2: 76 }) && actor.vx > 0 && s.chairRaw + actor.vx < 120) s.chairRaw += actor.vx;
        else if (this.nativeOverlap(actor, { x1: s.chairRaw + 6, x2: s.chairRaw + 6, y1: 76, y2: 76 }) && actor.vx < 0 && s.chairRaw + actor.vx >= 32) s.chairRaw += actor.vx;
      }
      if (s.chairRaw !== 36) this.once('chair', 'Židle je posunutá. Pod otvorem na půdu ji použij jako stupínek.', 200);
      const coolerBefore = s.coolerStage;
      s.fireOn = !s.fireOff;
      if (s.fireOn) s.fireFrame = ((s.fireFrame || 0) + 1) & 3;
      const operating = actors.some(actor => this.nativeOverlap(actor, { x1: 118, x2: 128, y1: 32, y2: 32 }));
      if (operating) {
        this.once('press', 'Tiskárna pouští peníze z okna. Přepni na druhého Goonieho.');
        if (!s.pressDirection) {
          if (s.pressY >= 28) {
            s.pressDirection = -1; s.pressY = 28;
            if (s.money.length < 8) s.money.push({ y: 26, column: 33 });
          } else s.pressY++;
        } else if (s.pressY < 18) { s.pressDirection = 0; s.pressY = 18; }
        else s.pressY--;
      }
      for (const note of s.money) note.y += 2;
      s.money = s.money.filter(note => note.y < (s.moneyCutoff || 154));
      s.moneyInside = s.money.filter(note => note.y >= 98).length;
      s.moneyAtDoor = s.money.some(note => note.y >= 116); s.moneyCutoff = 154;
      if (--s.coolerClock < 0) s.coolerClock = 2;
      if (!s.coolerStage) {
        const box = { x1: 23, x2: 25, y1: 131, y2: 154 };
        if (pushers.some(actor => actor.vx > 0 && actor.vy < 0 && this.nativeOverlap(actor, box))) {
          s.coolerStage = 1; this.once('cooler', 'Nádrž se převrací. Až uhasí oheň, slez krbem do tunelu.');
        }
      } else if (s.coolerStage < 5 && !s.coolerClock) s.coolerStage++;
      if (coolerBefore === 5) s.fireOff = true;
      s.cooler = s.coolerStage === 5; s.distracted = s.moneyInside ? 1 : 0;
      this.rectangles[0].x1 = this.rectangles[0].x2 = s.chairRaw + 3;
      this.rectangles[20].type = s.fireOn ? 128 : 4;
    }
    houseMother() {
      const s = this.state, n = this.ma;
      if (s.moneyInside) s.maTarget = 138;
      else {
        const band = { x1: 8, x2: 159, y1: n.y - 6, y2: n.y + 16 };
        const target = this.players.find(p => !p.escaped && this.nativeOverlap(p.native, band));
        if (target) s.maTarget = target.native.x;
      }
      const attack = { x1: n.x, x2: n.x + 8, y1: n.y + 2, y2: n.y + 8 };
      if (this.players.some(p => !p.escaped && this.nativeOverlap(p.native, attack))) { this.hurt('Fratelliová tě chytila. Nech ji nejdřív zabavit padajícími penězi.'); return; }
      const input = {};
      let hidden = false;
      if (((n.x - s.maTarget) & 255) < 3) {
        if (n.x >= 104 && n.x < 120) {
          hidden = true;
          if (--s.maIdle <= 0) { s.maIdle = (this.randomByte() & 127) + 64; s.maTarget = 56; s.maWait = 16; }
        } else {
          s.maWait = (s.maWait - 1) & 255;
          if (s.maWait & 128) s.maTarget = 114;
        }
      } else input[n.x > s.maTarget ? 'left' : 'right'] = true;
      const previousFrame = n.frame;
      root.GooniesMovement.step(n, input, this.rectangles, root.GOONIES_ORIGINAL.bodyWidths, root.GOONIES_ORIGINAL.bodyHeights, this.contacts);
      if (hidden) n.frame |= 128;
      if (n.x >= 134 && s.moneyAtDoor) {
        s.moneyCutoff = 140;
        n.frame = (this.age / 4) % 6 === 0 ? previousFrame === 24 ? 25 : 24 : previousFrame;
      }
    }
    exits() {
      const box = { x1: 144, x2: 144, y1: 160, y2: 191 };
      for (const p of this.players) p.atExit = this.nativeOverlap(p.native, box);
      if (this.players.every(p => p.atExit)) this.finishScene();
    }
    finishScene() {
      if (this.phase !== 'playing') return;
      for (const p of this.players) p.escaped = true;
      this.phase = 'transition'; this.wait = 105; this.addScore(1000); this.emit('clear');
      this.message = this.scene === 7 ? 'Poklad je váš. Goonies se nikdy nevzdávají!' : 'Oba jsou v bezpečí. Dobrodružství pokračuje…';
    }
    hurt(message) {
      if (this.phase !== 'playing') return;
      this.lives--; this.message = message; this.phase = 'hurt'; this.wait = 90; this.emit('hurt');
    }
  }
  root.GooniesEngine = { Game, HZ, WIDTH, HEIGHT, near };
})(globalThis);
