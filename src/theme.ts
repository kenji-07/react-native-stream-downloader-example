export const colors = {
  background: '#07070C',
  surface: '#12121A',
  surfaceRaised: '#1C1C27',
  surfacePressed: '#262634',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.46)',
  accent: '#8B5CF6',
  accentSoft: 'rgba(139,92,246,0.18)',
  accentGlow: 'rgba(139,92,246,0.55)',
  magentaGlow: 'rgba(236,72,153,0.42)',
  blueGlow: 'rgba(59,130,246,0.35)',
  success: '#30D158',
  warning: '#FFB020',
  danger: '#FF453A',
  onLight: '#07070C',
  overlay: 'rgba(0,0,0,0.55)',
  black: '#000000',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;
