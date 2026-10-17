/**
 * ScreenBackground — Dynamic Background with Ambient Glow
 * Implements deep midnight navy / icy gradients with electric blue ambient radial glow.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop, LinearGradient } from 'react-native-svg';
import { useTheme } from '../constants/theme';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bgPrimary },
        Platform.OS === 'web' && ({ transition: 'background-color 300ms ease' } as any),
        style,
      ]}
    >
      {/* Ambient Glow & Gradient Layer (Dark Mode only to preserve clean solid tone in light mode) */}
      {isDark && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              {/* Background Linear Gradient */}
              <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.bgPrimary} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.bgSecondary} stopOpacity="1" />
              </LinearGradient>

              {/* Top/Side Radial Ambient Glow in Nexora Electric Blue */}
              <RadialGradient
                id="radialGlowTop"
                cx="85%"
                cy="12%"
                rx="70%"
                ry="55%"
                fx="85%"
                fy="12%"
              >
                <Stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                <Stop offset="25%" stopColor="#2563EB" stopOpacity="0.16" />
                <Stop offset="45%" stopColor="#3B82F6" stopOpacity="0.10" />
                <Stop offset="65%" stopColor="#1E40AF" stopOpacity="0.05" />
                <Stop offset="85%" stopColor="#1E3A8A" stopOpacity="0.02" />
                <Stop offset="100%" stopColor={colors.bgPrimary} stopOpacity="0" />
              </RadialGradient>

              {/* Bottom Subtle Wave Glow */}
              <RadialGradient
                id="radialGlowBottom"
                cx="15%"
                cy="92%"
                rx="75%"
                ry="50%"
                fx="15%"
                fy="92%"
              >
                <Stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.16" />
                <Stop offset="30%" stopColor="#1E40AF" stopOpacity="0.10" />
                <Stop offset="60%" stopColor="#1E3A8A" stopOpacity="0.04" />
                <Stop offset="100%" stopColor={colors.bgSecondary} stopOpacity="0" />
              </RadialGradient>
            </Defs>

            <Rect width="100%" height="100%" fill="url(#bgGrad)" />
            <Rect width="100%" height="100%" fill="url(#radialGlowTop)" />
            <Rect width="100%" height="100%" fill="url(#radialGlowBottom)" />
          </Svg>
        </View>
      )}

      {/* Screen Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});
