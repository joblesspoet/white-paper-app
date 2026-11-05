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
