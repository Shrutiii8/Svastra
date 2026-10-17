/**
 * StatusBadge — Displays assessment status with color coding & glassmorphism
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AssessmentStatus } from '../types';
import { useTheme, Typography, BorderRadius } from '../constants/theme';

interface Props {
  status: AssessmentStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const { colors, isDark } = useTheme();
  const isSmall = size === 'sm';

  const config = {
    no_unusual_pattern: {
      label: 'Normal',
      bg: colors.statusSuccessBg,
      text: colors.statusSuccessText,
      dot: colors.statusSuccessDot,
      border: colors.statusSuccessBorder,
      isNeutral: false,
    },
    monitor: {
      label: 'Monitor',
      bg: colors.statusWarningBg,
      text: colors.statusWarningText,
      dot: colors.statusWarningDot,
      border: colors.statusWarningBorder,
      isNeutral: false,
    },
    supervisor_review: {
      label: 'Supervisor Review',
      bg: colors.statusDangerBg,
      text: colors.statusDangerText,
      dot: colors.statusDangerDot,
      border: colors.statusDangerBorder,
      isNeutral: false,
    },
    insufficient_data: {
      label: 'Insufficient Data',
      bg: colors.statusMutedBg,
      text: colors.statusMutedText,
      dot: colors.statusMutedDot,
      border: colors.statusMutedBorder,
      isNeutral: true,
    },
  }[status] ?? {
    label: 'Insufficient Data',
    bg: colors.statusMutedBg,
    text: colors.statusMutedText,
    dot: colors.statusMutedDot,
    border: colors.statusMutedBorder,
    isNeutral: true,
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        isSmall && styles.badgeSm,
      ]}
    >
      {config.isNeutral ? (
        <Feather
          name="help-circle"
          size={isSmall ? 10 : 12}
          color={config.text}
          style={styles.neutralIcon}
        />
      ) : (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: config.dot,
            },
          ]}
        />
      )}
      <Text
        style={[
          styles.label,
          { color: config.text },
          isSmall && styles.labelSm,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  neutralIcon: {
    marginRight: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  labelSm: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
