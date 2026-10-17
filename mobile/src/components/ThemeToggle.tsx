/**
 * ThemeToggle — Minimalist System / Light / Dark Mode Switcher
 * Glassmorphic segmented pill control with subtle animated transition.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeMode, Typography, BorderRadius } from '../constants/theme';

export function ThemeToggle() {
  const { mode, setMode, colors, isDark } = useTheme();

  // Active theme is either light or dark
  const activeMode: 'light' | 'dark' = mode === 'light' ? 'light' : 'dark';

  const options: Array<{ id: 'light' | 'dark'; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { id: 'light', label: 'Light', icon: 'sun' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(40, 80, 160, 0.05)',
          borderColor: colors.surfaceBorder,
        },
      ]}
    >
      {options.map((opt) => {
        const active = activeMode === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => setMode(opt.id)}
            style={[
              styles.optionPill,
              active && [
                styles.optionActive,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#131B2E',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#1E293B',
                  shadowColor: isDark ? '#000000' : '#131B2E',
                },
              ],
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label} theme`}
            accessibilityState={{ selected: active }}
          >
            <Feather
              name={opt.icon}
              size={14}
              color={
                active
                  ? isDark
                    ? '#60A5FA'
                    : '#FFFFFF'
                  : colors.textMuted
              }
              style={styles.icon}
            />
            <Text
              style={[
                styles.optionLabel,
                {
                  color: active
                    ? isDark
                      ? '#F5F7FA'
                      : '#FFFFFF'
                    : colors.textMuted,
                },
                active && styles.optionLabelActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  optionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 0,
  },
  icon: {
    marginRight: 6,
  },
  optionLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.3,
  },
  optionLabelActive: {
    fontWeight: Typography.weights.bold,
  },
});
