/**
 * Pure TypeScript QR Code matrix encoder (Byte mode, Error Correction Level M).
 *
 * Generates standard scannable QR codes (Versions 1-4) for classroom join links
 * like `flowcanvas://join?code=482910` with zero external dependencies, ready for
 * `react-native-svg` rendering and Node verification.
 */

export type QrMatrix = {
  size: number;
  modules: boolean[][];
};

// Version 1..4 capacities (data codewords) & EC codewords for EC Level M
const VERSION_SPECS: readonly {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignmentCenters: readonly number[];
}[] = [
  { version: 1, size: 21, dataCodewords: 16, ecCodewords: 10, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 28, ecCodewords: 16, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, ecCodewords: 26, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 64, ecCodewords: 36, alignmentCenters: [6, 26] },
];

// GF(256) with primitive polynomial 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j += 1) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

function encodeDataBytes(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function buildCodewords(bytes: Uint8Array, dataCodewords: number): Uint8Array {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit length (valid for versions 1-9)
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = dataCodewords * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const out = new Uint8Array(dataCodewords);
  for (let i = 0; i < bits.length / 8; i += 1) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | bits[i * 8 + b];
    out[i] = byte;
  }

  let padIndex = bits.length / 8;
  const pads = [0xec, 0x11];
  let toggle = 0;
  while (padIndex < dataCodewords) {
    out[padIndex++] = pads[toggle];
    toggle ^= 1;
  }
  return out;
}

function drawFinderPattern(
  modules: boolean[][],
  reserved: boolean[][],
  row: number,
  col: number,
) {
  const size = modules.length;
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const onOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      modules[rr][cc] = inBox && (onOuter || inInner);
      reserved[rr][cc] = true;
    }
  }
}

function drawAlignmentPattern(
  modules: boolean[][],
  reserved: boolean[][],
  row: number,
  col: number,
) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const onOuter = Math.abs(r) === 2 || Math.abs(c) === 2;
      const isCenter = r === 0 && c === 0;
      modules[row + r][col + c] = onOuter || isCenter;
      reserved[row + r][col + c] = true;
    }
  }
}

function formatBits(maskPattern: number): number {
  // EC Level M = 00
  const data = (0b00 << 3) | maskPattern;
  let rem = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >> i) & 1) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

function placeFormatInfo(modules: boolean[][], maskPattern: number) {
  const size = modules.length;
  const bits = formatBits(maskPattern);
  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;

    if (i < 8) modules[8][size - 1 - i] = bit;
    else if (i < 9) modules[8][15 - i] = bit;
    else modules[8][14 - i] = bit;
  }
  modules[size - 8][8] = true; // dark module
}

function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function penaltyScore(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;
  for (let r = 0; r < size; r += 1) {
    let run = 1;
    for (let c = 1; c < size; c += 1) {
      if (modules[r][c] === modules[r][c - 1]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  for (let c = 0; c < size; c += 1) {
    let run = 1;
    for (let r = 1; r < size; r += 1) {
      if (modules[r][c] === modules[r - 1][c]) {
        run += 1;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  }
  return score;
}

export function encodeQrMatrix(text: string): QrMatrix {
  const bytes = encodeDataBytes(text);
  const spec =
    VERSION_SPECS.find((s) => bytes.length + 2 <= s.dataCodewords) ??
    VERSION_SPECS[VERSION_SPECS.length - 1];

  const data = buildCodewords(bytes.slice(0, spec.dataCodewords - 2), spec.dataCodewords);
  const ec = rsRemainder(data, spec.ecCodewords);
  const allCodewords = new Uint8Array(data.length + ec.length);
  allCodewords.set(data);
  allCodewords.set(ec, data.length);

  const size = spec.size;
  const baseModules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  drawFinderPattern(baseModules, reserved, 0, 0);
  drawFinderPattern(baseModules, reserved, 0, size - 7);
  drawFinderPattern(baseModules, reserved, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    baseModules[6][i] = dark;
    reserved[6][i] = true;
    baseModules[i][6] = dark;
    reserved[i][6] = true;
  }

  // Alignment patterns
  for (const r of spec.alignmentCenters) {
    for (const c of spec.alignmentCenters) {
      if (reserved[r][c]) continue;
      drawAlignmentPattern(baseModules, reserved, r, c);
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 9; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  reserved[size - 8][8] = true;

  // Place data bits in zig-zag columns
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx += 1) {
        const c = col - dx;
        if (reserved[r][c]) continue;
        let bit = false;
        if (bitIdx < totalBits) {
          const byte = allCodewords[bitIdx >> 3];
          bit = ((byte >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx += 1;
        }
        baseModules[r][c] = bit;
      }
    }
    upward = !upward;
  }

  let bestMask = 0;
  let bestScore = Infinity;
  let bestModules = baseModules;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = baseModules.map((row, r) =>
      row.map((val, c) => (reserved[r][c] ? val : val !== maskCondition(mask, r, c))),
    );
    placeFormatInfo(candidate, mask);
    const score = penaltyScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  void bestMask;
  return { size, modules: bestModules };
}
