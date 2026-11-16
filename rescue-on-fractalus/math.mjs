// Fixed-point mathematics derived from the supplied Atari disk's routines.
// No processor, instruction decoder, program counter or original code at runtime.
export const byte = value => value & 255;
export const word = value => value & 65535;
export const signedWord = value => (value << 16) >> 16;

// $9821 rounds at each binary digit, rather than rounding a final product.
export function roundedProduct(multiplicand, fraction) {
  let result = 0;
  for (let bit = 0; bit < 8; bit++) {
    if (fraction & (128 >>> bit)) {
      result += (multiplicand >>> (bit + 1)) + ((multiplicand >>> bit) & 1);
    }
  }
  return result & 255;
}

// $9C97 treats the byte as unsigned, truncates the magnitude, then reapplies sign.
export function signedFraction(fraction, value) {
  value = signedWord(value);
  const magnitude = Math.floor((fraction & 255) * Math.abs(value) / 256);
  return value < 0 ? signedWord(-magnitude) : magnitude;
}

export function makeTrigonometry(tables) {
  const quarter = tables.high.map((hi, i) => (hi << 8) | tables.low[i]);
  function sample(angle) {
    angle &= 255;
    const quadrant = angle >>> 6;
    const value = quarter[(angle & 63) ^ tables.reflect[quadrant]];
    return tables.sign[quadrant] ? -value : value;
  }
  function interpolate(angle, fraction) {
    const value = ((8 - fraction) * sample(angle) + fraction * sample(angle + 1)) & 0xffffff;
    return signedWord(value >>> 8);
  }
  return function headingVector(heading) {
    const angle = (heading >>> 6) & 255;
    const fraction = (heading >>> 3) & 7;
    return {sin: interpolate(angle, fraction), cos: interpolate(angle + 64, fraction)};
  };
}
