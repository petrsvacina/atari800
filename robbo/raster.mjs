// Native Robbo character raster. Original pixels/tables are data assets only.
const decode = value => typeof value === 'string'
  ? Uint8Array.from(atob(value), c => c.charCodeAt(0)) : Uint8Array.from(value);

export function decodeAssets(source = globalThis.ROBBO_ASSETS) {
  if (!source) throw new Error('Original Robbo assets have not been loaded');
  return { ...source,
    palette: decode(source.palette), fontBase: decode(source.fontBase),
    wallFont: decode(source.wallFont), animationFont: decode(source.animationFont),
    infoFont: decode(source.infoFont),
    levels: source.levels.map(level => ({ ...level, map: decode(level.map) })),
  };
}

const levelIndex = state => state.level ?? state.cnum ?? 0;

// CHNMON and ENTCV copy original character bytes, including the two independent
// animation banks and all four robot directions. LM uses Atari active-low bits.
export function makeFont(assets, state = {}) {
  const font = new Uint8Array(assets.fontBase);
  const level = levelIndex(state), wall = ((level << 2) & 0xf0);
  for (let i = 0; i < 16; i++) {
    font[i] = assets.wallFont[wall + i];
    font[256 + i] = assets.wallFont[256 + wall + i];
  }
  const source = assets.animationFont;
  const animation = ((state.cntr ?? state.counter ?? state.animationCounter ?? 0) & 2) << 8;
  for (let y = 255; y > 223; y--) {
    font[y] = source[animation + y];
    font[256 + y] = source[animation + 256 + y];
  }
  for (let y = 223, x = 175; x > 79; y--, x--) {
    font[x] = source[animation + y];
    font[256 + x] = source[animation + 256 + y];
  }
  let lm = state.lm ?? state.facing ?? 13, direction = 3;
  while ((lm & 1) && direction > 0) { direction--; lm >>= 1; }
  const robot = ((state.fontRobotPhase ?? state.robotPhase ?? state.noga ?? 0) & 1) << 9;
  const first = direction * 16 + 64;
  for (let x = 0; x < 16; x++) {
    font[0x2f0 + x] = source[robot + first + x];
    font[0x3f0 + x] = source[robot + 256 + first + x];
  }
  return font;
}

// The four solid, wide Atari players form the floor behind all playfield
// colours (PRIOR=4). Consequently an ANTIC4 zero pixel shows COLB, not COLBK.
export function renderPlayfield(assets, state = {}, options = {}) {
  const level = assets.levels[levelIndex(state)];
  const map = state.displayMap ?? state.map ?? state.cave ?? level.map;
  const font = options.font ?? state.font ?? makeFont(assets, state);
  const colors = state.colors ?? level.colors;
  const floor = state.border ?? level.border;
  // The non-scrolling ANTIC4 terminator contributes VSCROL+1 lines; the
  // first scrolling row loses VSCROL lines. Total: 20*8+1 = 161 lines.
  const width = 256, height = options.height ?? 161;
  const scroll = options.scroll ?? state.scrollPixels ?? state.cameraY ?? 0;
  const pixels = new Uint8Array(width * height);
  for (let py = 0; py < height; py++) {
    const sy = py + scroll, tileY = Math.floor(sy / 16);
    for (let px = 0; px < width; px++) {
      const tile = tileY >= 0 && tileY < 32 ? map[tileY * 16 + (px >> 4)] : 0x13;
      // This XEX's optimized PUT_ preserves $A0 boundary bytes in CAVE and
      // explicitly maps them to wall glyph zero before masking other flags.
      const look = assets.look[tile === 0xa0 ? 0 : (tile ?? 0x13) & 127];
      const character = look | ((px >> 3) & 1) | ((sy & 8) << 2);
      const bits = font[(character & 127) * 8 + (sy & 7)];
      const value = (bits >> (6 - ((px & 7) >> 1) * 2)) & 3;
      pixels[py * width + px] = (value === 0 ? floor
        : value === 3 ? colors[(character & 128) ? 3 : 2] : colors[value - 1]) & 254;
    }
  }
  return { width, height, pixels };
}

const bcd = n => ((Math.floor(n / 10) % 10) << 4) | (n % 10);

export function hudCharacters(assets, state = {}) {
  const text = Uint8Array.from(assets.hudTemplate);
  const put = (value, y) => {
    text[y] = 11 + (value & 15); text[y - 1] = 11 + ((value >> 4) & 15);
    text[40 + y] = 1 + (value & 15); text[39 + y] = 1 + ((value >> 4) & 15);
  };
  put(bcd((levelIndex(state) + 1) & 255), 37);
  put(state.ammo ?? state.nabo ?? 0, 31);
  put(state.keys ?? 0, 25);
  put(state.lives ?? state.livs ?? 0x08, 19);
  put(state.screws ?? state.zebr ?? assets.levels[levelIndex(state)].screwsBcd, 13);
  const score = state.score ?? state.scor ?? [0, 0, 0];
  for (let x = 2, y = 7; x >= 0; x--, y -= 2) put(score[x], y);
  return text;
}

export function renderHud(assets, state = {}, options = {}) {
  const width = 320, height = state.demo ? 24 : 16;
  const pixels = new Uint8Array(width * height);
  const background = (state.colors ?? assets.levels[levelIndex(state)].colors)[4] & 254;
  const foreground = (background & 0xf0) | 0x0a;
  const demoForeground = (background & 0xf0) | (((state.clock ?? 0) >> 2) & 0x0e);
  const text = options.characters ?? state.hudCharacters ?? hudCharacters(assets, state);
  const font = new Uint8Array(state.infoFont ?? assets.infoFont);
  const rotation = (state.infoPhase ?? state.frame ?? 0) & 7;
  if (!state.infoFont) for (let i = 0; i < 8; i++) font[0x300 + i] = assets.infoFont[0x300 + ((i - rotation + 8) & 7)];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const code = y < 16 ? text[(y >> 3) * 40 + (x >> 3)]
      : (text.length >= 120 ? text[80 + (x >> 3)] : assets.demoText[x >> 3]);
    const data = font[(code & 127) * 8 + (y & 7)] ^ ((code & 128) ? 255 : 0);
    pixels[y * width + x] = data & (128 >> (x & 7))
      ? (y < 16 ? foreground : demoForeground) : background;
  }
  return { width, height, pixels };
}

export function rgbaImage(assets, raster) {
  const rgba = new Uint8ClampedArray(raster.width * raster.height * 4);
  for (let i = 0; i < raster.pixels.length; i++) {
    const color = (raster.pixels[i] & 254) * 3;
    rgba.set(assets.palette.subarray(color, color + 3), i * 4); rgba[i * 4 + 3] = 255;
  }
  return { width: raster.width, height: raster.height, data: rgba };
}

export function renderFrame(assets, state = {}, options = {}) {
  const width = 320, height = 240;
  const pixels = new Uint8Array(width * height);
  pixels.fill((state.colors ?? assets.levels[levelIndex(state)].colors)[4] & 254);
  const field = renderPlayfield(assets, state, options);
  const hud = renderHud(assets, state);
  for (let y = 0; y < field.height && y + 21 < height; y++)
    pixels.set(field.pixels.subarray(y * field.width, (y + 1) * field.width), (y + 21) * width + 32);
  for (let y = 0; y < hud.height; y++)
    pixels.set(hud.pixels.subarray(y * hud.width, (y + 1) * hud.width), (y + 194) * width);
  return { width, height, pixels };
}

export class RobboRaster {
  constructor(source) { this.assets = decodeAssets(source); }
  playfield(state, options) { return renderPlayfield(this.assets, state, options); }
  hud(state, options) { return renderHud(this.assets, state, options); }
  frame(state, options) { return renderFrame(this.assets, state, options); }
  rgba(raster) { return rgbaImage(this.assets, raster); }
}
