/**
 * Minimal colour maths for canvas objects.
 *
 * Text placed on the canvas must stay readable in both themes, so the object
 * palettes are checked with a real WCAG contrast ratio instead of an eyeballed
 * pairing.
 */

export type Rgb = { r: number; g: number; b: number };

/** WCAG AA contrast for normal-size text. */
export const MIN_READABLE_CONTRAST = 4.5;

/** Parse `#rrggbb` (the only colour format the app stores). */
export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}

function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** Relative luminance as defined by WCAG. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when text in `foreground` is readable on `background`. */
export function isReadableOn(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= MIN_READABLE_CONTRAST;
}

/** True for the `#rrggbb` strings the custom-colour picker produces. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export type Hsv = { h: number; s: number; v: number };

/** Convert a stored hex colour into the HSV space the picker manipulates. */
export function hexToHsv(hex: string): Hsv {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rgb.r) hue = ((rgb.g - rgb.b) / delta) % 6;
    else if (max === rgb.g) hue = (rgb.b - rgb.r) / delta + 2;
    else hue = (rgb.r - rgb.g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return {
    h: Math.round(hue),
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

/** Convert HSV back into the `#rrggbb` string stored on an object. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - chroma;
  const [r, g, b] =
    hue < 60 ? [chroma, x, 0]
    : hue < 120 ? [x, chroma, 0]
    : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma]
    : hue < 300 ? [x, 0, chroma]
    : [chroma, 0, x];
  const channel = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

/** Pick whichever candidate reads best on `background` (used for custom notes). */
export function readableTextColor(background: string, candidates: readonly string[]): string {
  return candidates.reduce((best, candidate) =>
    contrastRatio(candidate, background) > contrastRatio(best, background) ? candidate : best,
  );
}
