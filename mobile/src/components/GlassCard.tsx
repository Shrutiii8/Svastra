/**
 * GlassCard — Reusable Glassmorphic Surface Primitive
 * Provides blur, subtle border, diffuse shadow, and inner highlight.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { useTheme, BorderRadius, Shadows } from '../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  highlight?: boolean;
}

export function GlassCard({
  children,
  style,
  radius = 22,
  highlight = true,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.surfaceBorder,
          borderRadius: radius,
          shadowColor: isDark ? '#000000' : '#131B2E',
          shadowOpacity: isDark ? 0.22 : 0.05,
          shadowRadius: isDark ? 16 : 12,
          shadowOffset: { width: 0, height: isDark ? 6 : 3 },
          elevation: 0,
        },
        Platform.OS === 'web' && ({
          backdropFilter: isDark ? 'blur(24px) saturate(140%)' : undefined,
          WebkitBackdropFilter: isDark ? 'blur(24px) saturate(140%)' : undefined,
          boxShadow: isDark
            ? '0 6px 24px rgba(0, 0, 0, 0.28)'
            : '0 4px 18px rgba(19, 27, 46, 0.05)',
          transition: 'background-color 300ms ease, border-color 300ms ease, box-shadow 300ms ease',
        } as any),
        style,
      ]}
    >
      {highlight && isDark && (
        <View
          style={[
            styles.topHighlight,
            {
              borderTopColor: colors.surfaceHighlight,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
            },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    opacity: 0.8,
  },
});
