// Original Robbo title: ANTIC A logo, mode 2 text and mode C separators.
import { prepareTitle } from './title.mjs';

export function renderTitle(assets, titleData, logo, typist) {
  const data = prepareTitle(titleData);
  const colors = logo?.colors ?? data.colors;
  const logoScreen = logo?.screen ?? new Uint8Array(128);
  const textScreen = typist?.screen ?? new Uint8Array(288);
  const font = typist?.font ?? data.font;
  const width = 320, height = 240, pixels = new Uint8Array(width * height);
  pixels.fill(colors[5] & 254);
  const left = data.layout.left;

  // ANTIC A: sixteen bytes, four double-width colour clocks per byte,
  // each visible bitmap row four scanlines high, followed by one blank line.
  for (let row = 0; row < data.layout.logoRows.length; row++) {
    const layout = data.layout.logoRows[row];
    for (let byte = 0; byte < 16; byte++) for (let group = 0; group < 4; group++) {
      const value = (logoScreen[row * 16 + byte] >> (6 - group * 2)) & 3;
      const color = colors[value ? value : 5] & 254;
      for (let y = 0; y < layout.height; y++) for (let x = 0; x < 4; x++)
        pixels[(layout.y + y) * width + left + byte * 16 + group * 4 + x] = color;
    }
  }

  const textColors = y => {
    let pf1 = colors[2], pf2 = colors[3];
    for (const change of data.colorChanges) if (y >= change.vcount * 2 - 8)
      for (const [address, value] of change.writes) {
        if (address === 0xd017) pf1 = value;
        if (address === 0xd018) pf2 = value;
      }
    return [pf2 & 254, ((pf2 & 0xf0) | (pf1 & 0x0f)) & 254];
  };
  const drawRow = (screen, at, top) => {
    for (let row = 0; row < 8; row++) {
      const [background, foreground] = textColors(top + row);
      for (let column = 0; column < 32; column++) {
        const code = screen[at + column] ?? 0;
        const bits = font[(code & 127) * 8 + row] ^ ((code & 128) ? 255 : 0);
        for (let x = 0; x < 8; x++) pixels[(top + row) * width + left + column * 8 + x]
          = bits & (128 >> x) ? foreground : background;
      }
    }
  };
  for (let row = 0; row < data.layout.creditRows.length; row++)
    drawRow(data.credits, row * 32, data.layout.creditRows[row]);
  for (let row = 0; row < data.layout.typistRows.length; row++)
    drawRow(textScreen, row * 32, data.layout.typistRows[row]);

  // ANTIC C: 128 one-bit pixels, each two physical pixels wide, COLPF0 ink.
  for (const top of data.layout.separatorRows) for (let x = 0; x < 256; x++) {
    const on = data.separator[x >> 4] & (128 >> ((x >> 1) & 7));
    pixels[top * width + left + x] = colors[on ? 1 : 5] & 254;
  }
  return { width, height, pixels };
}
