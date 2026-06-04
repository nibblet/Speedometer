/**
 * Theme tokens. The `forgeOrange*` slots hold the user-selected accent color
 * (default Forge Orange); everything else is fixed per day/night surface.
 * Build a palette with `makePalette(resolved, accentHex)`; screens should read
 * `useAppearance().palette` so accent + day/night changes flow through.
 */
export type ThemePalette = {
  forgeBlack: string;
  slate: string;
  slateElevated: string;
  slateBorder: string;
  /** Selected accent. */
  forgeOrange: string;
  /** Darkened accent (gradients, trim). */
  forgeOrangeDim: string;
  /** Low-alpha accent wash (glows, fills). */
  forgeOrangeGlow: string;
  /** Primary foreground (light on dark themes, dark on day theme). */
  white: string;
  bone: string;
  dim: string;
  dimmer: string;
  danger: string;
  /** Text on accent surfaces; auto-picked dark/light for contrast. */
  ink: string;
};

/** A selectable accent preset. */
export type Accent = { key: string; label: string; hex: string };

/** Primary accent colors the user can choose from. First entry is the default. */
export const ACCENTS: Accent[] = [
  { key: 'orange', label: 'Orange', hex: '#FF6A1A' },
  { key: 'amber', label: 'Amber', hex: '#FFB000' },
  { key: 'lime', label: 'Lime', hex: '#5DD63B' },
  { key: 'green', label: 'Green', hex: '#2FA84F' },
  { key: 'teal', label: 'Teal', hex: '#15C2A8' },
  { key: 'sky', label: 'Sky', hex: '#2E9BFF' },
  { key: 'violet', label: 'Violet', hex: '#7C5CFF' },
  { key: 'pink', label: 'Pink', hex: '#FF4D8D' },
  { key: 'red', label: 'Red', hex: '#FF453A' },
  { key: 'cyan', label: 'Cyan', hex: '#00CFE0' },
];

export const DEFAULT_ACCENT_KEY = ACCENTS[0].key;

export function accentHexForKey(key: string): string {
  return ACCENTS.find((a) => a.key === key)?.hex ?? ACCENTS[0].hex;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Multiply each channel toward black (factor 0..1). */
function darken(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const c = (v: number) => Math.round(v * factor).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Perceived luminance 0..1; used to pick readable text on the accent. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Fixed (non-accent) tokens per surface mode. */
const baseTokens = {
  night: {
    forgeBlack: '#0A0A0A',
    slate: '#161616',
    slateElevated: '#1E1E1E',
    slateBorder: '#2A2A2A',
    white: '#FFFFFF',
    bone: '#E8E6E1',
    dim: '#7A7A7A',
    dimmer: '#4A4A4A',
    danger: '#FF3B30',
  },
  day: {
    forgeBlack: '#E8E6E1',
    slate: '#DCDAD6',
    slateElevated: '#D4D2CE',
    slateBorder: '#C5C3BF',
    white: '#141414',
    bone: '#2A2A2A',
    dim: '#5A5A5A',
    dimmer: '#8A8A8A',
    danger: '#D63030',
  },
} as const;

/** Build a full palette for the given surface mode and accent hex. */
export function makePalette(resolved: 'day' | 'night', accentHex: string): ThemePalette {
  const base = baseTokens[resolved];
  return {
    ...base,
    forgeOrange: accentHex,
    forgeOrangeDim: darken(accentHex, 0.62),
    forgeOrangeGlow: rgba(accentHex, resolved === 'day' ? 0.14 : 0.18),
    ink: luminance(accentHex) > 0.5 ? '#0A0A0A' : '#FFFFFF',
  };
}

export const palettes = {
  night: makePalette('night', accentHexForKey(DEFAULT_ACCENT_KEY)),
  day: makePalette('day', accentHexForKey(DEFAULT_ACCENT_KEY)),
} satisfies Record<'night' | 'day', ThemePalette>;

/** Default static reference (night); prefer `useAppearance().palette` for screens. */
export const colors = palettes.night;

export const fonts = {
  display: 'Rajdhani_700Bold',
  bold: 'Rajdhani_600SemiBold',
  body: 'Rajdhani_500Medium',
  light: 'Rajdhani_400Regular',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const SPEED_MAX_MPH = 25;
