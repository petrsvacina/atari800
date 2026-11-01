// Original ANTIC-2 characters and P0 bitmap, drawn by native JavaScript.
export function pixels(game, data, panel = null) {
  const result = new Uint8Array(320 * 240);
  if (!panel && !game.endingFont && !game.white) result.fill(14);
  const font = panel || game.endingFont ? data.titleFont : game.fonts[game.white ? 0 : 1];
  const cells = panel || game.map, white = panel || game.endingFont ? 15 : game.white;
  // The original map has 25 rows, but its display list scans out only 24.
  for (let row = 0; row < 24; row++) for (let column = 0; column < 40; column++) {
    const character = cells[row*40+column];
    for (let y = 0; y < 8; y++) {
      const bits = font[(character & 127)*8+y] ^ (character & 128 ? 255 : 0);
      for (let x = 0; x < 8; x++) result[(24+row*8+y)*320+column*8+x] = (bits & (128 >> x) ? white ^ 15 : white) & 254;
    }
  }
  if (!panel && !game.endingFont) {
    const left = (game.x >> 1)*2 + game.xHigh*256 - 48, top = game.y - 8;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const xx = left + x, yy = top + y;
      if (xx >= 0 && xx < 320 && yy >= 0 && yy < 240 && game.sprite[y] & (128 >> (x >> 1))) result[yy*320+xx] = game.spriteColor & 254;
    }
  }
  return result;
}

export class Screen {
  constructor(canvas, data) {
    this.context = canvas.getContext('2d', {alpha:false});
    this.image = this.context.createImageData(320, 240); this.data = data;
  }
  draw(game, panel = null) {
    const source = pixels(game, this.data, panel), target = this.image.data;
    for (let i = 0; i < source.length; i++) {
      const color = this.data.palette[source[i]];
      target[i*4] = color[0]; target[i*4+1] = color[1]; target[i*4+2] = color[2]; target[i*4+3] = 255;
    }
    this.context.putImageData(this.image, 0, 0);
  }
}
