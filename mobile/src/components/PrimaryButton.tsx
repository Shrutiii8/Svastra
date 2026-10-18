/**
 * PrimaryButton — Pill Gradient Action Button
 * Horizontal gradient from periwinkle (#7C9CFF) to cyan (#5FE0F2) with navy text and soft glow.
 */
import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Typography, BorderRadius, Shadows, useTheme } from '../constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  icon,
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.buttonContainer,
        Shadows.subtle,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {/* Horizontal Gradient SVG */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop
                offset="0%"
                stopColor={disabled ? '#475569' : colors.buttonGradient[0]}
              />
              <Stop
                offset="100%"
                stopColor={disabled ? '#64748B' : colors.buttonGradient[1]}
              />
            </LinearGradient>
          </Defs>
          <Rect
            width="100%"
            height="100%"
            rx={BorderRadius.full}
            ry={BorderRadius.full}
            fill="url(#btnGrad)"
          />
        </Svg>
      </View>

      {/* Button Content */}
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator color={colors.buttonText} size="small" />
        ) : (
          <>
            {icon && <View style={styles.iconWrap}>{icon}</View>}
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              {title}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    minHeight: 52,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  iconWrap: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },
});
