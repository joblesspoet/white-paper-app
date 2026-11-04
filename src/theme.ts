/**
 * FlowCanvas design tokens.
 *
 * Values mirror `design-system/flowcanvas/MASTER.md` (flat design: bold color,
 * clean lines, no gradients and no shadows — depth is expressed with borders).
 *
 * Typography note: the design system specifies Calistoga (headings) and Inter
 * (body). Custom fonts are not bundled yet, so screens use the platform system
 * font with the weights and sizes below. Font loading is tracked in
 * `docs/task-status.md` under Known issues.
 */

export const colors = {
  primary: '#0D9488',
  onPrimary: '#FFFFFF',
  secondary: '#14B8A6',
  accent: '#EA580C',
  onAccent: '#FFFFFF',
  background: '#F0FDFA',
  foreground: '#134E4A',
  muted: '#E8F1F4',
  border: '#99F6E4',
  destructive: '#DC2626',
  ring: '#0D9488',
  surface: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '500' },
} as const;

/** Minimum touch target on every interactive element. */
export const touchTarget = 44;
