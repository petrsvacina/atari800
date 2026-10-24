/* Original indexed bitmap composition, separated from browser UI for validation. */
(function (root) {
  'use strict';
  const backgrounds = new Map(), decoded = new Map();
  function decode(frame) {
    if (frame.pixels) return frame.pixels;
    const key = frame.packed || frame.packedBase64;
    if (decoded.has(key)) return decoded.get(key);
    const raw = root.atob(key), pixels = new Uint8Array(frame.width * frame.height), stride = frame.width / 8;
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) pixels[y * frame.width + x] = raw.charCodeAt(y * stride + (x >> 3)) >> (6 - ((x & 7) >> 1) * 2) & 3;
    decoded.set(key, pixels); return pixels;
  }
  function compose(game, graphics = root.GOONIES_GRAPHICS, original = root.GOONIES_ORIGINAL) {
    const scene = game.scene, background = graphics.scenes[scene];
    if (!backgrounds.has(scene)) backgrounds.set(scene, decode({ width: 320, height: 176, packed: background.packedBase64 }));
    const pixels = new Uint8Array(backgrounds.get(scene));
    function blit(frame, x, y, height = frame?.height) {
      if (!frame) return;
      const source = decode(frame);
      for (let row = 0; row < Math.min(height, frame.height); row++) for (let column = 0; column < frame.width; column++) {
        const dx = x + column, dy = y + row, color = source[row * frame.width + column];
        if (color && dx >= 0 && dx < 320 && dy >= 0 && dy < 176) pixels[dy * 320 + dx] = color;
      }
    }
    const object = (index, column, y) => blit(graphics.sprites.objects[index], column * 8, y - 16);
    if (scene === 0) {
      const s = game.state;
      object(8 + (s.chairRaw & 3), Math.floor(s.chairRaw / 4), 66);
      object(5, 30, s.pressY);
      if (s.fireOn !== false) {
        object(16, 10, 157); object(1 + (s.fireFrame || 0), 10, 150);
      }
      if (s.coolerStage < 5) {
        object([12, 13, 14, 15, 0][s.coolerStage], [6, 8, 9, 10, 10][s.coolerStage], [127, 131, 139, 146, 146][s.coolerStage]);
      }
      for (const note of s.money) object(note.y < 32 ? 7 : note.y & 4 ? 6 : 7, note.y < 32 ? 33 : note.y & 4 ? 36 : 35, note.y);
    }
    for (const command of game.rooms?.draw || []) blit(command.frame, command.column * 8, command.y - 16, command.height);
    const actor = n => {
      if (!n.type || n.frame & 128) return;
      blit(original.scenes[scene].frames[n.frame]?.[n.x & 3], Math.floor(n.x / 4) * 8, n.y - 16);
    };
    for (const p of game.players) actor(p.native);
    if (scene === 0 && game.ma) actor(game.ma);
    for (const n of game.rooms?.actors || []) actor(n);
    for (const n of game.rooms?.bats || []) actor(n);
    for (const command of game.rooms?.afterDraw || []) blit(command.frame, command.column * 8, command.y - 16, command.height);
    return pixels;
  }
  root.GooniesRaster = { compose };
})(globalThis);
