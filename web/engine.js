/* Native game simulation. No CPU, ROM, XEX loader or Atari hardware emulation. */
(function (root) {
  'use strict';
  const W = 20, H = 12, TILE = 16, FPS = 50;
  const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  const EFFECTS = ['Rychlé nohy', 'Rychlé nohy', 'Pomalé nohy', 'Maxi plamen',
    'Mini plamen', 'Automatické bomby', 'Zákaz bomb', 'Rychlé bomby'];
  class Game {
    constructor(assets, options = {}) {
      this.assets = assets;
      this.options = { players: 2, bot: true, arena: 0, rotate: true, rounds: 8, ...options };
      this.random = options.random || Math.random;
      this.players = [];
      this.state = 'menu';
      this.tick = 0;
      this.events = [];
    }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    start() {
      this.scores = Array(this.options.players).fill(0);
      this.round = 0;
      this.nextRound();
    }
    nextRound() {
      this.round++;
      this.arena = (this.options.arena + (this.options.rotate ? this.round - 1 : 0)) % 8;
      this.terrain = this.assets.maps[this.arena].map(c => c ? 1 : (this.random() < .5 ? 2 : 0));
      // A191-A1B7: the original clears all four corners, including in two-player mode.
      for (const i of [0, 1, 20, 18, 19, 39, 200, 220, 221, 219, 238, 239]) this.terrain[i] = 0;
      const spawns = [[8, 8], [312, 8], [312, 184]];
      this.players = spawns.slice(0, this.options.players).map(([x, y], id) => ({
        id, x, y, alive: true, direction: 0, moving: false, animation: 0,
        bombs: 1, power: 3, effect: null, effectUntil: 0, deathTick: 0, botPlan: [],
      }));
      this.bombs = [];
      this.flames = [];
      this.pendingItems = [];
      this.tick = 0;
      this.finishTick = null;
      this.winner = null;
      this.state = 'ready';
      this.countdown = 75;
      this.emit('ready');
    }
    cell(x, y) { return Math.floor(y / TILE) * W + Math.floor(x / TILE); }
    inside(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }
    at(x, y) { return this.inside(x, y) ? this.terrain[y * W + x] : 1; }
    bombAt(cell) { return this.bombs.find(b => b.cell === cell); }
    intersects(p, cell, radius = 5) {
      const cx = cell % W * TILE, cy = Math.floor(cell / W) * TILE;
      return p.x + radius > cx && p.x - radius < cx + TILE && p.y + radius > cy && p.y - radius < cy + TILE;
    }
    blocked(p, x, y) {
      const r = 5.8;
      if (x - r < 0 || y - r < 0 || x + r > W * TILE || y + r > H * TILE) return true;
      for (const yy of [y - r, y + r]) for (const xx of [x - r, x + r]) {
        const cell = this.cell(xx, yy), terrain = this.terrain[cell];
        if (terrain === 1 || terrain === 2) return true;
        const bomb = this.bombAt(cell);
        if (bomb && !bomb.pass.has(p.id)) return true;
      }
      return false;
    }
    move(p, input) {
      p.moving = false;
      const speed = p.effect === 0 || p.effect === 1 ? 2 : p.effect === 2 ? .5 : 1;
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      // One native pixel per 50-Hz tick; free movement inside the map.
      for (const [axis, amount] of [['x', dx * speed], ['y', dy * speed]]) {
        if (!amount) continue;
        const x = p.x + (axis === 'x' ? amount : 0), y = p.y + (axis === 'y' ? amount : 0);
        if (!this.blocked(p, x, y)) { p[axis] += amount; p.moving = true; }
      }
      if (dy) p.direction = dy > 0 ? 0 : 1;
      if (dx) p.direction = dx > 0 ? 3 : 2;
      if (p.moving) p.animation = (p.animation + 1) % 32;
    }
    placeBomb(p) {
      if (!p.alive || p.effect === 6 || this.bombs.filter(b => b.owner === p.id).length >= p.bombs || this.bombs.length >= 30) return false;
      const cell = this.cell(p.x, p.y);
      if (this.terrain[cell] !== 0 || this.bombAt(cell)) return false;
      const bomb = { cell, owner: p.id, fuse: p.effect === 7 ? 55 : 130,
        power: p.effect === 3 ? 19 : p.effect === 4 ? 3 : p.power,
        pass: new Set(this.players.filter(other => this.intersects(other, cell, 6)).map(other => other.id)) };
      this.bombs.push(bomb);
      this.emit('place');
      return true;
    }
    blastCells(bomb, terrain = this.terrain) {
      const cells = [bomb.cell], x = bomb.cell % W, y = Math.floor(bomb.cell / W);
      for (const [dx, dy] of DIRS) for (let n = 1; n < bomb.power; n++) {
        const xx = x + dx * n, yy = y + dy * n;
        if (!this.inside(xx, yy)) break;
        const cell = yy * W + xx;
        if (terrain[cell] === 1) break;
        cells.push(cell);
        if (terrain[cell] === 2 || (this.bombAt(cell) && cell !== bomb.cell)) break;
      }
      return cells;
    }
    explode(bomb) {
      if (!this.bombs.includes(bomb)) return;
      const cells = this.blastCells(bomb);
      this.bombs.splice(this.bombs.indexOf(bomb), 1);
      for (const cell of cells) {
        if (this.terrain[cell] === 2) {
          this.terrain[cell] = 0;
          if (this.random() < .5) this.pendingItems.push({ cell, type: 3 + Math.floor(this.random() * 4), time: this.tick + 21 });
        } else if (this.terrain[cell] >= 3) this.terrain[cell] = 0;
      }
      this.flames.push({ cells, until: this.tick + 20 });
      this.emit('explode');
      for (const cell of cells) {
        const chain = this.bombAt(cell);
        if (chain) this.explode(chain);
      }
    }
    clearEffect(p) { p.effect = null; p.effectUntil = 0; }
    collect(p) {
      const cell = this.cell(p.x, p.y), type = this.terrain[cell];
      if (type < 3 || type > 6) return;
      this.terrain[cell] = 0;
      if (type === 5) p.bombs = Math.min(10, p.bombs + 1);
      if (type === 6) p.power = Math.min(19, p.power + 1);
      if (type === 4) this.clearEffect(p);
      if (type === 3) { p.effect = Math.floor(this.random() * 8); p.effectUntil = this.tick + 30 * FPS; }
      this.emit(type === 3 ? 'random' : 'pickup', { player: p.id, item: type });
    }
    danger(extraBomb = null) {
      const danger = new Map();
      for (const f of this.flames) for (const c of f.cells) danger.set(c, 0);
      for (const b of [...this.bombs, ...(extraBomb ? [extraBomb] : [])]) {
        for (const c of this.blastCells(b)) danger.set(c, Math.min(danger.get(c) ?? Infinity, b.fuse));
      }
      return danger;
    }
    path(start, goal, danger, allowStart = true) {
      const queue = [start], prev = new Map([[start, null]]);
      for (let k = 0; k < queue.length && k < 240; k++) {
        const c = queue[k];
        if ((c !== start || allowStart) && goal(c)) {
          const path = [];
          for (let p = c; p !== start; p = prev.get(p)) path.unshift(p);
          return path;
        }
        for (const [dx, dy] of DIRS) {
          const x = c % W + dx, y = Math.floor(c / W) + dy, n = y * W + x;
          if (!this.inside(x, y) || prev.has(n) || this.terrain[n] === 1 || this.terrain[n] === 2 || this.bombAt(n)) continue;
          if ((danger.get(n) ?? Infinity) < 35) continue;
          prev.set(n, c); queue.push(n);
        }
      }
      return null;
    }
    botInput(p) {
      const current = this.cell(p.x, p.y), danger = this.danger();
      if (this.tick % 8 === 0 || !p.botPlan.length) {
        if ((danger.get(current) ?? Infinity) < 100) {
          p.botPlan = this.path(current, c => !danger.has(c), danger, false) || [];
        } else {
          const adjacentRock = c => DIRS.some(([dx, dy]) => this.at(c % W + dx, Math.floor(c / W) + dy) === 2);
          const target = c => this.terrain[c] >= 3 || adjacentRock(c) || this.players.some(other => other.id !== p.id && other.alive && this.cell(other.x, other.y) === c);
          p.botPlan = this.path(current, target, danger) || [];
          if (!p.botPlan.length && target(current) && this.tick % 16 === 0) {
            const bomb = { cell: current, power: p.power, fuse: 130 };
            const projected = this.danger(bomb);
            const escape = this.path(current, c => !projected.has(c), projected, false);
            if (escape && escape.length < 7 && this.placeBomb(p)) p.botPlan = escape;
          }
        }
      }
      let target = p.botPlan[0];
      if (target === undefined) return {};
      let tx = target % W * TILE + 8, ty = Math.floor(target / W) * TILE + 8;
      if (Math.abs(p.x - tx) < 1 && Math.abs(p.y - ty) < 1) {
        p.botPlan.shift(); target = p.botPlan[0];
        if (target === undefined) return {};
        tx = target % W * TILE + 8; ty = Math.floor(target / W) * TILE + 8;
      }
      return { left: p.x > tx + .4, right: p.x < tx - .4, up: p.y > ty + .4, down: p.y < ty - .4 };
    }
    step(inputs = []) {
      if (this.state === 'ready') {
        if (--this.countdown <= 0) { this.state = 'playing'; this.emit('go'); }
        return;
      }
      if (this.state !== 'playing') return;
      this.tick++;
      this.flames = this.flames.filter(f => f.until > this.tick);
      this.pendingItems = this.pendingItems.filter(item => {
        if (item.time > this.tick) return true;
        if (!this.bombAt(item.cell) && !this.flames.some(f => f.cells.includes(item.cell))) this.terrain[item.cell] = item.type;
        return false;
      });
      for (const bomb of [...this.bombs]) {
        for (const id of bomb.pass) if (!this.intersects(this.players[id], bomb.cell, 6)) bomb.pass.delete(id);
        if (--bomb.fuse <= 0) this.explode(bomb);
      }
      for (const p of this.players) {
        if (!p.alive) continue;
        if (p.effect !== null && this.tick >= p.effectUntil) this.clearEffect(p);
        const input = this.options.bot && p.id === 1 ? this.botInput(p) : (inputs[p.id] || {});
        this.move(p, input);
        this.collect(p);
        if (input.bomb || p.effect === 5) this.placeBomb(p);
      }
      // Resolve all deaths before choosing a winner, preserving simultaneous draws.
      for (const p of this.players) {
        if (p.alive && this.flames.some(f => f.cells.some(c => this.intersects(p, c, 4)))) {
          p.alive = false; p.deathTick = this.tick; this.emit('death', { player: p.id });
        }
      }
      if (this.players.filter(p => p.alive).length <= 1 && this.finishTick === null) this.finishTick = this.tick + 35;
      if (this.finishTick !== null && this.tick >= this.finishTick) {
        const survivor = this.players.find(p => p.alive);
        this.winner = survivor ? survivor.id : null;
        if (survivor) this.scores[survivor.id]++;
        this.state = this.round >= this.options.rounds ? 'matchOver' : 'roundOver';
        this.emit('roundEnd');
      }
    }
    effectName(p) { return p.effect === null ? '' : EFFECTS[p.effect]; }
  }
  root.DynakillersEngine = { Game, W, H, TILE, FPS, EFFECTS };
})(globalThis);
