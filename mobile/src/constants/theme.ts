/**
 * HeatGuard Twin — Unified Design System & Dynamic Tokens
 * Elegant, minimalistic, premium design system supporting Dark (Hero) and Light modes.
 */

import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { getStorageItem, setStorageItem } from '../services/storage';

export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeColors {
  isDark: boolean;
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgGradient: [string, string];
  glowColor: string;

  // Surfaces (Glassmorphic in dark, solid white in light)
  surface: string;
  surfaceSubtle: string;
  surfaceBorder: string;
  surfaceHighlight: string;
  surfaceShadow: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Accents & Hero
  accent: string;
  accentCyan: string;
  accentElectric: string;
  accentPeriwinkle: string;
  accentTint: string;
  accentBorder: string;
  heroGradient: [string, string];
  positive: string;
  negative: string;

  // List Avatars
  avatarBg: string;
  avatarText: string;

  // Buttons & Actions
  buttonGradient: [string, string];
  buttonText: string;
  buttonGlow: string;
  pillBtnBg: string;
  pillBtnText: string;

  // Charts
  chartBarGradient: [string, string];

  // Inputs
  inputBg: string;
  inputBorder: string;
  inputPlaceholder: string;

  // Status & Badges
  statusSuccessBg: string;
  statusSuccessText: string;
  statusSuccessDot: string;
  statusSuccessBorder: string;

  statusWarningBg: string;
  statusWarningText: string;
  statusWarningDot: string;
  statusWarningBorder: string;

  statusDangerBg: string;
  statusDangerText: string;
  statusDangerDot: string;
  statusDangerBorder: string;

  statusMutedBg: string;
  statusMutedText: string;
  statusMutedDot: string;
  statusMutedBorder: string;

  // Categories
  catConstruction: string;
  catDelivery: string;
  catStreetVendor: string;
  catTrafficPolice: string;

  // Data source
  sourceLive: string;
  sourceSynthetic: string;
  sourceSimulated: string;
}

export const DarkTheme: ThemeColors = {
  isDark: true,
  bgPrimary: '#0B1430',
  bgSecondary: '#16284A',
  bgGradient: ['#0B1430', '#16284A'],
  glowColor: '#2563EB',

  surface: 'rgba(18, 30, 58, 0.78)',
  surfaceSubtle: 'rgba(255, 255, 255, 0.05)',
  surfaceBorder: 'rgba(255, 255, 255, 0.10)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.16)',
  surfaceShadow: 'rgba(0, 0, 0, 0.35)',

  textPrimary: '#F5F7FA',
  textSecondary: '#8FA0C2',
  textMuted: '#5E7196',
  textInverse: '#0B1430',

  accent: '#3B82F6',
  accentCyan: '#38BDF8',
  accentElectric: '#2563EB',
  accentPeriwinkle: '#60A5FA',
  accentTint: 'rgba(59, 130, 246, 0.16)',
  accentBorder: 'rgba(59, 130, 246, 0.35)',
  heroGradient: ['#1E40AF', '#0B193D'],
  positive: '#3DDC84',
  negative: '#FF6B6B',

  avatarBg: 'rgba(37, 99, 235, 0.20)',
  avatarText: '#93C5FD',

  pillBtnBg: 'rgba(255, 255, 255, 0.08)',
  pillBtnText: '#F5F7FA',

  chartBarGradient: ['#38BDF8', '#2563EB'],

  buttonGradient: ['#1D4ED8', '#2563EB'],
  buttonText: '#FFFFFF',
  buttonGlow: 'rgba(37, 99, 235, 0.35)',

  inputBg: 'rgba(255, 255, 255, 0.06)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  inputPlaceholder: '#5E7196',

  // Status tokens
  statusSuccessBg: 'rgba(61, 220, 132, 0.12)',
  statusSuccessText: '#3DDC84',
  statusSuccessDot: '#3DDC84',
  statusSuccessBorder: 'rgba(61, 220, 132, 0.25)',

  statusWarningBg: 'rgba(251, 191, 36, 0.12)',
  statusWarningText: '#FBBF24',
  statusWarningDot: '#FBBF24',
  statusWarningBorder: 'rgba(251, 191, 36, 0.25)',

  statusDangerBg: 'rgba(255, 107, 107, 0.12)',
  statusDangerText: '#FF6B6B',
  statusDangerDot: '#FF6B6B',
  statusDangerBorder: 'rgba(255, 107, 107, 0.25)',

  statusMutedBg: 'rgba(255, 255, 255, 0.06)',
  statusMutedText: '#8FA0C2',
  statusMutedDot: '#5E7196',
  statusMutedBorder: 'rgba(255, 255, 255, 0.12)',

  catConstruction: '#8FA0C2',
  catDelivery: '#8FA0C2',
  catStreetVendor: '#8FA0C2',
  catTrafficPolice: '#8FA0C2',

  sourceLive: '#3DDC84',
  sourceSynthetic: '#8FA0C2',
  sourceSimulated: '#8FA0C2',
};

export const LightTheme: ThemeColors = {
  isDark: false,
  bgPrimary: '#EFF6FF',
  bgSecondary: '#EFF6FF',
  bgGradient: ['#EFF6FF', '#EFF6FF'],
  glowColor: '#3B82F6',

  surface: '#FFFFFF',
  surfaceSubtle: '#F0F7FF',
  surfaceBorder: 'rgba(19, 27, 46, 0.08)',
  surfaceHighlight: '#FFFFFF',
  surfaceShadow: 'rgba(19, 27, 46, 0.05)',

  textPrimary: '#131B2E',
  textSecondary: '#6B7686',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  accent: '#2563EB',
  accentCyan: '#0284C7',
  accentElectric: '#2563EB',
  accentPeriwinkle: '#3B82F6',
  accentTint: 'rgba(37, 99, 235, 0.08)',
  accentBorder: 'rgba(37, 99, 235, 0.20)',
  heroGradient: ['#2563EB', '#1D4ED8'],
  positive: '#3DDC84',
  negative: '#FF6B6B',

  avatarBg: 'rgba(37, 99, 235, 0.10)',
  avatarText: '#1D4ED8',

  pillBtnBg: '#131B2E',
  pillBtnText: '#FFFFFF',

  chartBarGradient: ['#38BDF8', '#2563EB'],

  buttonGradient: ['#131B2E', '#1E293B'],
  buttonText: '#FFFFFF',
  buttonGlow: 'rgba(19, 27, 46, 0.15)',

  inputBg: '#FFFFFF',
  inputBorder: 'rgba(19, 27, 46, 0.10)',
  inputPlaceholder: '#64748B',

  // Status tokens
  statusSuccessBg: 'rgba(61, 220, 132, 0.12)',
  statusSuccessText: '#16A34A',
  statusSuccessDot: '#3DDC84',
  statusSuccessBorder: 'rgba(61, 220, 132, 0.25)',

  statusWarningBg: 'rgba(251, 191, 36, 0.12)',
  statusWarningText: '#D97706',
  statusWarningDot: '#FBBF24',
  statusWarningBorder: 'rgba(251, 191, 36, 0.25)',

  statusDangerBg: 'rgba(255, 107, 107, 0.12)',
  statusDangerText: '#DC2626',
  statusDangerDot: '#FF6B6B',
  statusDangerBorder: 'rgba(255, 107, 107, 0.25)',

  statusMutedBg: 'rgba(19, 27, 46, 0.05)',
  statusMutedText: '#6B7686',
  statusMutedDot: '#94A3B8',
  statusMutedBorder: 'rgba(19, 27, 46, 0.08)',

  catConstruction: '#6B7686',
  catDelivery: '#6B7686',
  catStreetVendor: '#6B7686',
  catTrafficPolice: '#6B7686',

  sourceLive: '#16A34A',
  sourceSynthetic: '#6B7686',
  sourceSimulated: '#6B7686',
};

// Global Zustand Store for Theme Mode
interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  hydrated: boolean;
}

const STORAGE_THEME_KEY = 'hg_theme_mode_v1';

export const useThemeStore = create<ThemeStore>((set) => {
  // Initialize from storage async
  getStorageItem(STORAGE_THEME_KEY).then((saved) => {
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      set({ mode: saved, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  });

  return {
    mode: 'dark',
    hydrated: false,
    setMode: (mode: ThemeMode) => {
      set({ mode });
      setStorageItem(STORAGE_THEME_KEY, mode).catch(() => { });
    },
  };
});

/**
 * Main theme hook used by all components.
 * Automatically resolves 'system' to system OS color scheme,
 * defaulting to Dark mode as the hero experience.
 */
export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const systemScheme = useColorScheme();

  const isDark =
    mode === 'dark'
      ? true
      : mode === 'light'
        ? false
        : systemScheme !== 'light'; // default system preference is dark

  const colors = isDark ? DarkTheme : LightTheme;

  return {
    colors,
    isDark,
    mode,
    setMode,
  };
}

// Backward-compatible static Colors export defaulting to Dark Hero Theme
export const Colors = {
  navy: '#0B1430',
  navyLight: '#16284A',
  navyMid: 'rgba(255, 255, 255, 0.12)',

  teal: '#38BDF8',
  tealLight: '#60A5FA',
  tealDark: '#2563EB',

  success: '#3DDC84',
  warning: '#FBBF24',
  danger: '#FF6B6B',
  info: '#3B82F6',

  noPattern: '#3DDC84',
  monitor: '#FBBF24',
  supervisorReview: '#FF6B6B',
  insufficientData: '#8FA0C2',

  textPrimary: '#F5F7FA',
  textSecondary: '#8FA0C2',
  textMuted: '#5E7196',
  textOnDark: '#FFFFFF',

  background: '#0B1430',
  surface: 'rgba(255, 255, 255, 0.07)',
  surfaceAlt: 'rgba(255, 255, 255, 0.035)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.08)',

  construction: '#8FA0C2',
  delivery: '#8FA0C2',
  street_vendor: '#8FA0C2',
  traffic_police: '#8FA0C2',

  live: '#3DDC84',
  synthetic: '#8FA0C2',
  simulated: '#FBBF24',
} as const;

export const Typography = {
  fontFamily: 'System',
  sizes: {
    caption: 12,
    body: 14,
    cardTitle: 16,
    sectionTitle: 20,
    pageTitle: 28,
    metric: 34,
    // backwards-compatibility
    xs: 12,
    sm: 13,
    base: 14,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '600' as const, // maximum two weights per screen: 400 and 600
  },
  styles: {
    pageTitle: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: -0.5,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
    },
    smallLabel: {
      fontSize: 12,
      fontWeight: '500' as const,
      letterSpacing: 0.7, // ~0.06em
      textTransform: 'uppercase' as const,
    },
    metric: {
      fontSize: 34,
      fontWeight: '600' as const,
      fontVariant: ['tabular-nums'] as any,
    },
    metricUnit: {
      fontSize: 12,
      fontWeight: '400' as const,
    },
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const Layout = {
  maxContentWidth: 720,
  maxGridWidth: 1100,
  maxNavWidth: 480,
  pagePaddingMobile: 20,
  pagePaddingDesktop: 32,
  cardGap: 16,
  cardRadius: 20,
  cardPadding: 20,
} as const;

export const Shadows = {
  glass: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const CATEGORY_LABELS: Record<string, string> = {
  construction: 'Construction',
  delivery: 'Delivery',
  street_vendor: 'Street Vendor',
  traffic_police: 'Traffic Police',
};

export const STATUS_LABELS: Record<string, string> = {
  insufficient_data: 'Insufficient Data',
  no_unusual_pattern: 'No Unusual Pattern',
  monitor: 'Monitor',
  supervisor_review: 'Supervisor Review',
};

export const SOURCE_LABELS: Record<string, string> = {
  health_connect: 'LIVE',
  synthetic: 'SENSOR',
  simulated: 'SIMULATED',
  manual: 'MANUAL',
};

export const APP_VERSION = '1.0.0';
export const CONSENT_VERSION = '1.0';
export const DISCLAIMER =
  'Svastra is an illustrative monitoring tool, not a medical device. ' +
  'All assessments are non-diagnostic and must not replace professional medical advice.';
