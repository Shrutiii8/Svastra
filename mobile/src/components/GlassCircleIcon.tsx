import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';

export type FeatherIconName = keyof typeof Feather.glyphMap;

interface GlassCircleIconProps {
  name?: FeatherIconName;
  initials?: string;
  size?: number;
  iconSize?: number;
  color?: string;
  bg?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function GlassCircleIcon({
  name,
  initials,
  size = 40,
  iconSize = 18,
  color,
  bg,
  borderColor,
  style,
}: GlassCircleIconProps) {
  const { colors, isDark } = useTheme();

  const iconColor = color ?? (isDark ? colors.accentCyan : colors.accentElectric);
  const background = bg ?? (initials ? colors.avatarBg : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)');
  const border = borderColor ?? (initials ? 'transparent' : isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(40, 80, 160, 0.12)');

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          borderColor: border,
          borderWidth: initials ? 0 : 1,
        },
        style,
      ]}
    >
      {initials ? (
        <Text
          style={[
            styles.initialsText,
            {
              color: color ?? colors.avatarText,
              fontSize: Math.round(size * 0.36),
            },
          ]}
        >
          {initials.slice(0, 2).toUpperCase()}
        </Text>
      ) : name ? (
        <Feather name={name} size={iconSize} color={iconColor} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initialsText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
