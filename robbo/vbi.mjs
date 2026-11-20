/** Robbo's original vertical blank service, translated as native state updates.
 * CVBL $33B2 in the supplied XEX. The wrapper owns the VBI clock and OS timers. */
const SCREEN = 0x1000;
const byte = value => value & 255;
const word = value => value & 65535;
const decimalByte = value => ((Math.floor(value / 10) % 10) << 4) | (value % 10);

export function createVbi(ctx) {
  const s = ctx.state;
  s.cameraAddress ??= SCREEN;
  s.targetAddress ??= SCREEN;
  s.scrolling ??= 0;
  s.scrollCounter ??= 0;
  s.vscroll ??= 0;
  s.infoPhase ??= 0;
  if (!s.infoFont && ctx.infoFont) s.infoFont = Uint8Array.from(ctx.infoFont);
  if (!s.hudCharacters && ctx.hudTemplate) s.hudCharacters = Uint8Array.from(ctx.hudTemplate);

  function updateInfo() {
    if (s.infoFont) {
      const font = s.infoFont, last = font[0x307];
      for (let n = 6; n >= 0; n--) font[0x301 + n] = font[0x300 + n];
      font[0x300] = last;
    }
    s.infoPhase = (s.infoPhase + 1) & 7;
    if (!s.hudCharacters) return;
    const info = s.hudCharacters;
    function display(value, y) {
      info[y] = 11 + (value & 15);
      info[y - 1] = 11 + ((value >>> 4) & 15);
      info[40 + y] = 1 + (value & 15);
      info[39 + y] = 1 + ((value >>> 4) & 15);
    }
    display(decimalByte(byte(s.level + 1)), 37);
    display(s.ammo, 31);
    display(s.keys, 25);
    display(s.lives, 19);
    display(s.screws, 13);
    for (let n = 2, y = 7; n >= 0; n--, y -= 2) display(s.score[n], y);
  }

  function scroll() {
    if (!s.scrolling) {
      if (word(s.cameraAddress + 128) >= s.targetAddress) {
        if (s.cameraAddress < SCREEN + 1) return;
        s.scrollCounter = 14;
        s.scrolling = 0x82;
      } else {
        if (word(s.cameraAddress + 512) >= s.targetAddress) return;
        if (s.cameraAddress >= SCREEN + 1344) return;
        s.scrollCounter = 2;
        s.scrolling = 0x42;
      }
    }
    if (s.scrolling & 128) {
      const previous = s.scrollCounter;
      if (!previous) {
        s.vscroll = 0;
        s.scrollCounter = 14;
        const flags = s.scrolling;
        s.scrolling = byte(flags - 1);
        if (!(flags & 15)) s.scrolling = 0;
        return;
      }
      s.scrollCounter = byte(previous - 2);
      s.vscroll = previous & 7;
      if (s.vscroll === 6) s.cameraAddress = word(s.cameraAddress - 32);
      return;
    }
    const previous = s.scrollCounter;
    s.scrollCounter = byte(previous + 2);
    s.vscroll = previous & 7;
    if (s.vscroll) return;
    s.cameraAddress = word(s.cameraAddress + 32);
    if (s.scrollCounter < 16) return;
    const flags = s.scrolling;
    s.scrolling = byte(flags - 1);
    if (!(flags & 15)) s.scrolling = 0;
    s.scrollCounter = 2;
  }

  function tick() {
    ctx.soundStep?.(s.clock);
    updateInfo();
    // CVBL restores all four solid floor players and resets DLI/attract state.
    if (s.colors) s.playerColors = [s.colors[4], s.colors[4], s.colors[4], s.colors[4]];
    s.dliPhase = 0;
    s.attract = 0;
    scroll();
    s.cameraY = (s.cameraAddress - SCREEN) / 32 * 8 + s.vscroll;
    return s.cameraY;
  }
  return {tick};
}
