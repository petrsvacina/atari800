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
      this.loadScene(clamp(options.scene || 0, 0, this.levels.length - 1));
    }
    emit(type, extra = {}) { this.events.push({ type, ...extra }); }
    drainEvents() { return this.events.splice(0); }
    addScore(amount) {
      this.score += amount;
      while (this.score >= this.nextLife) { this.lives++; this.nextLife += 5000; this.emit('life'); }
    }
    loadScene(index) {
      this.scene = index; this.level = this.levels[index]; this.age = 0; this.phase = 'playing';
      this.players = this.level.spawns.map((s, id) => ({ id, x: s.x, y: s.y, vx: 0, vy: 0,
        w: 10, h: 18, facing: 1, grounded: false, rail: s.rail ?? null,
        climbing: false, attached: null, attachCooldown: 0, escaped: false, invincible: 100, oldUp: false, carried: false }));
      this.objects = Object.fromEntries(this.level.objects.map(o => [o.id, { ...o }]));
      this.state = { cooler: false, distracted: 0, key: false, opened: false, valves: [false, false],
        boards: 3, bell: 0, eggs: 0, cageDropped: false, drained: 0, leverA: false,
        leverB: false, treasure: false, boomRaised: false, collected: [], cooldowns: {} };
      this.rocks = []; this.eggs = []; this.shots = []; this.selected = 0;
      this.message = this.level.intro; this.emit('scene', { scene: index });
    }
    switchActor() {
      if (this.phase !== 'playing' || this.paused) return;
      const next = 1 - this.selected;
      if (!this.players[next].escaped) { this.selected = next; this.emit('switch'); }
    }
    platformList() {
      let result = this.level.platforms.filter(p => !p.color || this.platformVisible(p.color));
      result = result.filter(p => (!p.gate || !this.isHeld(p.gate)) && (!p.requiresHeld || this.isHeld(p.requiresHeld)));
      const chair = this.objects.chair;
      if (chair) result.push({ x1: chair.x - 6, x2: chair.x + 6, y: chair.y - 9, dynamic: true });
      const ball = this.objects.ball;
      if (ball) result.push({ x1: ball.x - 9, x2: ball.x + 9, y: ball.y, id: 'ball', dynamic: true });
      const cage = this.objects.cage;
      if (cage && this.state.cageDropped) result.push({ x1: cage.x - 9, x2: cage.x + 9, y: cage.y, dynamic: true });
      if (this.scene === 4 && this.state.eggs) {
        const pile = this.objects.pile;
        for (let i = 0; i < this.state.eggs; i++) result.push({ x1: pile.x - 9 + i * 3, x2: pile.x + 14, y: pile.y - (i + 1) * 8, dynamic: true });
      }
      const boom = this.objects.boom;
      if (boom) result.push({ x1: boom.x - 19, x2: boom.x + 19, y: this.state.boomRaised ? boom.raisedY : boom.y, dynamic: true });
      return result;
    }
    platformVisible(color) {
      const phase = Math.floor(this.age / 90) % 3;
      return color === ['blue', 'white', 'red'][phase] || color === ['white', 'red', 'blue'][phase];
    }
    isHeld(id) { return this.players.some(p => !p.escaped && p.attached === id); }
    release(player) { player.attached = null; player.rail = null; player.climbing = false; player.attachCooldown = 30; }
    attach(player, id) {
      const object = this.objects[id]; if (!object) return false;
      if (this.players.some(p => p !== player && p.attached === id)) return false;
      player.attached = id; player.x = object.x; player.y = object.y;
      player.vx = player.vy = 0; player.climbing = false; player.grounded = false;
      return true;
    }
    step(inputs = []) {
      if (this.paused || this.phase === 'over' || this.phase === 'complete') return;
      this.tick++;
      if (this.phase === 'hurt') {
        if (--this.wait <= 0) {
          if (this.lives <= 0) { this.phase = 'over'; this.emit('over'); }
          else this.loadScene(this.scene);
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
      for (const key of Object.keys(this.state.cooldowns)) this.state.cooldowns[key]--;
      const ball = this.objects.ball;
      if (ball) {
        const previous = ball.x; ball.x = ball.centerX - ball.range * Math.cos(this.age / 180);
        for (const p of this.players) if (p.support === 'ball' && p.grounded) p.x += ball.x - previous;
      }
      const platforms = this.platformList();
      for (const player of this.players) { this.move(player, inputs[player.id] || {}, platforms); if (this.phase !== 'playing') return; }
      this.puzzle(inputs);
      if (this.phase !== 'playing') return;
      this.enemies(); this.exits();
    }
    move(p, input, platforms) {
      if (p.escaped) return;
      if (p.invincible) p.invincible--;
      if (p.attachCooldown) p.attachCooldown--;
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const upEdge = !!input.up && !p.oldUp; p.oldUp = !!input.up;
      if (p.attached) {
        if (dx || input.down) { this.release(p); p.vy = .2; }
        else return;
      }
      if (p.rail !== null) {
        const rail = this.level.rails[p.rail];
        if (input.down || (input.up && upEdge)) {
          this.release(p); p.vy = input.up ? -3.5 : .2; p.grounded = false;
        } else {
          p.x = clamp(p.x + dx * .85, rail.x1, rail.x2); p.y = rail.y + p.h;
          p.vx = dx * .85; if (dx) p.facing = dx; return;
        }
      }
      const ladder = this.level.ladders.find(l => Math.abs(p.x - l.x) <= 6 && p.y >= l.top - 2 && p.y <= l.bottom + 2
        && (!l.requiresChair || Math.abs(this.objects.chair.x - this.objects.chair.targetX) <= 14));
      if ((input.up || input.down) && ladder && (p.climbing || (input.up && p.y > ladder.top + 1) || (input.down && p.y < ladder.bottom - 1))) {
        p.climbing = true; p.x = ladder.x; p.vx = p.vy = 0;
        p.y = clamp(p.y + (input.up ? -.8 : .8), ladder.top, ladder.bottom);
        if (p.y === ladder.top || p.y === ladder.bottom) { p.climbing = false; p.grounded = true; }
        return;
      }
      if (p.climbing) {
        if (!dx && ladder) return;
        p.climbing = false;
      }
      p.vx = dx * 1.05; if (dx) p.facing = dx;
      if (upEdge && p.grounded) {
        p.vy = this.objects.spring && near(p, this.objects.spring, 13, 4) ? -4.7 : -(this.level.jumpVelocity || 3.5);
        p.grounded = false; this.emit('jump', { player: p.id });
      }
      const oldY = p.y;
      p.x = clamp(p.x + p.vx, 5, WIDTH - 5);
      for (const wall of this.level.walls || []) {
        if (wall.unlessHeld && this.isHeld(wall.unlessHeld)) continue;
        if (wall.unless && this.state[wall.unless]) continue;
        if (p.y > wall.y && p.y - p.h < wall.y + wall.h && p.x + p.w / 2 > wall.x && p.x - p.w / 2 < wall.x + wall.w) {
          p.x = dx > 0 ? wall.x - p.w / 2 : wall.x + wall.w + p.w / 2;
        }
      }
      p.vy = Math.min(3.5, p.vy + .14); p.y += p.vy; p.grounded = false; p.support = null;
      if (p.vy >= 0) {
        const floor = platforms.filter(f => p.x + 3 > f.x1 && p.x - 3 < f.x2 && oldY <= f.y + .6 && p.y >= f.y).sort((a, b) => a.y - b.y)[0];
        if (floor) { p.y = floor.y; p.vy = 0; p.grounded = true; p.support = floor.id || null; }
      }
      if (input.up && !p.attachCooldown) {
        const rail = (this.level.rails || []).findIndex(r => p.x >= r.x1 && p.x <= r.x2 && Math.abs(p.y - p.h - r.y) <= 5);
        if (rail !== -1) { p.rail = rail; p.vx = p.vy = 0; p.grounded = false; p.y = this.level.rails[rail].y + p.h; }
      }
      if (p.y > HEIGHT + 14) this.hurt('Pozor na propast. Zkus to znovu společně.');
    }
    once(id, message, score = 100) {
      if (this.state.collected.includes(id)) return false;
      this.state.collected.push(id); this.message = message; this.addScore(score); this.emit('puzzle', { id }); return true;
    }
    touching(id, dx = 11, dy = 10) { const o = this.objects[id]; return o && this.players.filter(p => !p.escaped && near(p, o, dx, dy)); }
    hold(id, inputs, always = false) {
      const o = this.objects[id]; if (!o) return;
      for (const p of this.players) {
        if (!p.escaped && !p.attached && !p.attachCooldown && near(p, o, o.dx || 10, o.dy || 12) && (always || inputs[p.id]?.up)) this.attach(p, id);
      }
    }
    puzzle(inputs) {
      const s = this.state;
      if (this.scene === 0) {
        const chair = this.objects.chair;
        for (const p of this.touching('chair', 12, 5) || []) if (p.vx) chair.x = clamp(chair.x + p.vx, chair.minX, chair.maxX);
        if ((this.touching('cooler', 11, 9) || []).some(p => p.vx)) {
          s.cooler = true; this.once('cooler', 'Voda uhasila krb. Teď oba rychle do tunelu!');
        }
        if ((this.touching('press', 11, 6) || []).length) {
          s.distracted = 360; this.once('press', 'Tiskárna chrlí peníze. Fratelliová je venku — druhý může ke krbu.');
        } else if (s.distracted) s.distracted--;
      } else if (this.scene === 1) {
        this.hold('crank', inputs, true);
        if (this.isHeld('crank')) this.once('crank', 'Skála je nahoře. Druhý Goonie může na plovoucí kámen.');
        if (this.isHeld('crank') && (this.touching('ball', 13, 8) || []).length) s.chamberEntered = true;
        if (s.chamberEntered && (this.touching('key', 8, 8) || []).length) { s.key = true; this.once('key', 'Klíč je váš. Sejděte se oba u dolních dveří.'); }
      } else if (this.scene === 2) {
        this.hold('valve1', inputs); this.hold('valve2', inputs);
        s.valves = [this.isHeld('valve1'), this.isHeld('valve2')];
        s.pressure = s.valves.every(Boolean) ? (s.pressure || 0) + 1 : 0;
        if (s.pressure >= 90) { s.opened = true; this.once('pipe', 'Oba ventily zavřené. Tlak roztrhl potrubí — cesta je volná!'); }
      } else if (this.scene === 3) {
        for (const id of ['chain1', 'chain2', 'chain3']) this.hold(id, inputs);
        this.hold('seat', inputs, true);
        if (!this.isHeld('seat')) s.bell++;
        if (s.bell > 60 * 65) { this.hurt('Rozezněl se zvon a přilétli netopýři. Jeden musí hlídat spodní past.'); return; }
        this.rollingRocks();
      } else if (this.scene === 4) {
        this.hold('bone', inputs);
        this.fallingEggs();
      } else if (this.scene === 5) {
        // The organ's water drops cycle the colored stepping stones; no note puzzle.
        if (this.age % 90 === 0) this.emit('platform');
      } else if (this.scene === 6) {
        this.hold('bone', inputs);
        if (this.isHeld('bone')) { s.cageDropped = true; this.once('cage', 'Klec je dole. Použij ji, aby ses zavěsil za spodní zarážku.'); }
        if (s.cageDropped) this.hold('lock', inputs);
        const flipper = this.objects.flipper;
        for (const p of this.players) if (!p.escaped && flipper && near(p, flipper, 10, 4) && p.grounded && !s.cooldowns.flipper) {
          p.vy = -4.2; p.grounded = false; s.cooldowns.flipper = 40; this.emit('jump');
          if (this.isHeld('lock') && s.drained < 3) {
            s.drained++; this.emit('puzzle'); this.addScore(100);
            this.message = s.drained === 3 ? 'Voda klesla a chobotnice je pryč. Oba do pravého tunelu!' : 'Voda klesá. Drž zarážku a znovu skoč na vahadlo.';
          }
        }
      } else if (this.scene === 7) this.ship(inputs);
      this.doors(inputs);
    }
    rollingRocks() {
      const source = this.objects.rock;
      if (!source || this.state.boards === 0) return;
      if (!this.rocks.length && this.age % 120 === 1) this.rocks.push({ x: source.x, y: source.y, vx: -.8, vy: 0 });
      for (const r of this.rocks) {
        const previousY = r.y; r.x += r.vx; r.vy = Math.min(3, r.vy + .13); r.y += r.vy;
        const bounds = (this.level.rockBounds || []).find(b => r.y >= b.top && r.y < b.bottom) || { left: 20, right: 300 };
        if (r.x <= bounds.left || r.x >= bounds.right) { r.vx = -r.vx; r.x = clamp(r.x, bounds.left, bounds.right); }
        for (const p of this.players) if (!p.escaped && near(p, r, 10, 8) && p.vx) r.vx = Math.sign(p.vx) * .8;
        const floor = this.platformList().filter(f => r.x >= f.x1 && r.x <= f.x2 && previousY <= f.y && r.y >= f.y).sort((a, b) => a.y - b.y)[0];
        if (floor) { r.y = floor.y; r.vy = 0; }
        const pipe = this.objects.pipe;
        if (pipe && near(r, pipe, 12, 12) && this.isHeld('seat')) {
          this.state.boards--; this.addScore(150); this.emit('puzzle'); r.remove = true;
          this.message = this.state.boards ? `Prkno prasklo. Ještě ${this.state.boards} zásahy kamenem.` : 'Všechna prkna pryč. Oba levým tunelem!';
        }
        if (r.y > HEIGHT + 8) r.remove = true;
      }
      this.rocks = this.rocks.filter(r => !r.remove);
    }
    fallingEggs() {
      const bird = this.objects.bird, chute = this.objects.chute;
      if (!bird || !chute || this.state.eggs >= 4) return;
      if (this.age % 210 === 30 && this.eggs.length < 3) this.eggs.push({ x: bird.x, y: bird.y, vy: 0 });
      for (const egg of this.eggs) {
        const previousY = egg.y; egg.vy = Math.min(2, egg.vy + .1); egg.y += egg.vy;
        const floor = this.platformList().filter(f => egg.x > f.x1 && egg.x < f.x2 && previousY <= f.y && egg.y >= f.y).sort((a, b) => a.y - b.y)[0];
        if (floor) { egg.y = floor.y; egg.vy = 0; }
        for (const p of this.players) if (!p.escaped && near(p, egg, 11, 8) && p.vx) egg.x += p.vx * 1.2;
        if (near(egg, chute, 13, 15) && this.isHeld('bone')) {
          this.state.eggs++; egg.remove = true; this.addScore(50); this.emit('puzzle');
          this.message = this.state.eggs === 4 ? 'Čtyři vejce tvoří schody. Oba přes lávu do pravého tunelu!' : `Vejce je dole. Ještě ${4 - this.state.eggs} na schody.`;
        }
        if (egg.y > HEIGHT + 12) egg.remove = true;
      }
      this.eggs = this.eggs.filter(e => !e.remove);
    }
    ship(inputs) {
      const s = this.state;
      for (const id of ['leverA', 'leverB']) for (const p of this.touching(id, 9, 9) || []) {
        if ((p.vx || inputs[p.id]?.up) && !s.cooldowns[id]) {
          s[id] = !s[id]; s.cooldowns[id] = 50; this.emit('puzzle');
          this.message = id === 'leverA' ? 'Páka změnila spodní dveře a rameno stěžně.' : 'Horní dveře jsou přepnuté.';
          if (id === 'leverA' && s.treasure) { s.boomRaised = !s.leverA; if (!s.boomRaised) s.lifted = false; }
        }
      }
      const chest = this.objects.chest;
      if (chest && !s.treasure && s.leverA && s.leverB && this.players[1].vx > 0 && near(this.players[1], chest, 14, 10)) {
        s.treasure = true; s.distracted = 100000; this.once('treasure', 'Poklad sype mince. Zvedni menšího Goonieho ramenem stěžně a potkejte se u truhly.', 1000);
      }
      const boom = this.objects.boom;
      if (boom && s.boomRaised && !s.lifted) {
        const p = this.players[0]; if (Math.abs(p.x - boom.x) < 20 && Math.abs(p.y - boom.y) < 3) { p.y = boom.raisedY; s.lifted = true; }
      }
    }
    doors(inputs) {
      for (const door of this.level.doors || []) {
        if (door.requires && !this.state[door.requires]) continue;
        for (const p of this.players) if (!p.escaped && !p.attached && inputs[p.id]?.up && near(p, door, 8, 10) && !this.state.cooldowns['door' + p.id]) {
          p.x = door.to.x; p.y = door.to.y; p.vx = p.vy = 0; p.climbing = false;
          this.state.cooldowns['door' + p.id] = 45; this.emit('door');
        }
      }
    }
    ready() {
      const s = this.state;
      return [s.cooler && s.distracted > 0, s.key, s.opened, s.boards === 0, s.eggs >= 4, true, s.drained >= 3, s.treasure && s.boomRaised && s.lifted][this.scene];
    }
    exits() {
      if (!this.ready()) return;
      const exit = this.level.exit;
      for (const p of this.players) if (!p.escaped && near(p, exit, exit.dx || 13, exit.dy || 13)) {
        p.escaped = true; p.attached = null; this.addScore(200); this.emit('exit', { player: p.id });
        if (this.players[1 - p.id].escaped) {
          this.phase = 'transition'; this.wait = 105; this.addScore(500); this.emit('clear');
          this.message = this.scene === 7 ? 'Poklad je váš. Goonies se nikdy nevzdávají!' : 'Oba jsou v bezpečí. Dobrodružství pokračuje…';
        } else { this.selected = 1 - p.id; this.message = 'Jeden je venku. Teď dostaň do tunelu i druhého.'; }
      }
    }
    enemyPositions() {
      return (this.level.enemies || []).map((e, i) => ({ ...e,
        x: e.x + Math.sin((this.age + i * 70) / (e.period || 85)) * (e.range || 0),
        y: e.y + (e.kind === 'bat' ? Math.sin((this.age + i * 31) / 17) * 5 : 0) }));
    }
    enemies() {
      for (const p of this.players) {
        if (p.escaped || p.invincible) continue;
        for (const hazard of this.level.hazards || []) {
          if (hazard.requires && this.state[hazard.requires]) continue;
          if (hazard.kind === 'water' && this.scene === 6 && this.state.drained >= 3) continue;
          if (p.x > hazard.x && p.x < hazard.x + hazard.w && p.y > hazard.y && p.y - p.h < hazard.y + hazard.h) { this.hurt(hazard.message || 'Pozor na vodu a lávu.'); return; }
        }
        for (const e of this.enemyPositions()) {
          if (e.kind === 'fratelli' && this.state.distracted) continue;
          if (Math.abs(p.x - e.x) < (e.w || 8) && Math.abs(p.y - p.h / 2 - e.y) < (e.h || 7)) { this.hurt('Pozor na pronásledovatele. Příště načasuj cestu jinak.'); return; }
        }
      }
    }
    hurt(message) {
      if (this.phase !== 'playing') return;
      this.lives--; this.message = message; this.phase = 'hurt'; this.wait = 90; this.emit('hurt');
    }
  }
  root.GooniesEngine = { Game, HZ, WIDTH, HEIGHT, near };
})(globalThis);
