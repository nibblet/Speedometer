/**
 * forVEX brand tokens.
 * Adjust forgeOrange to match the exact spec from the master brand sheet if needed.
 */
export const colors = {
  forgeBlack: '#0A0A0A',
  slate: '#161616',
  slateElevated: '#1E1E1E',
  slateBorder: '#2A2A2A',
  forgeOrange: '#FF6A1A',
  forgeOrangeDim: '#A0410F',
  forgeOrangeGlow: 'rgba(255, 106, 26, 0.18)',
  white: '#FFFFFF',
  bone: '#E8E6E1',
  dim: '#7A7A7A',
  dimmer: '#4A4A4A',
  danger: '#FF3B30',
} as const;

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
