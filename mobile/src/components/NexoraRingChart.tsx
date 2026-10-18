/**
 * NexoraRingChart — Segmented Thick Donut / Ring Chart
 * Graduated blue-tone segments with bold center figure and count-up on mount.
 * Matches the circular element in the right phone of the Nexora reference.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../constants/theme';
import { AnimatedNumber } from './AnimatedNumber';

export interface RingSegment {
  value: number;
  color: string;
  label?: string;
}

interface NexoraRingChartProps {
  segments?: RingSegment[];
  centerValue: number;
  centerPrefix?: string;
  centerSuffix?: string;
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
}

export function NexoraRingChart({
  segments = [
    { value: 35, color: '#F8FAFC', label: 'Rest' },
    { value: 25, color: '#38BDF8', label: 'Moderate' },
    { value: 25, color: '#2563EB', label: 'Elevated' },
    { value: 15, color: '#1E3A8A', label: 'Peak' },
  ],
  centerValue,
  centerPrefix = '',
  centerSuffix = '',
  centerLabel = 'Activity Rate',
  size = 200,
  strokeWidth = 24,
}: NexoraRingChartProps) {
  const { colors, isDark } = useTheme();
  const [animProgress, setAnimProgress] = useState<number>(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animId: number;
    const duration = 1000;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimProgress(eased);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setAnimProgress(1);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 100;

  // Calculate segment offsets with a small gap
  let accumulatedAngle = 0;
  const gapAngle = 4; // 4 degrees gap between segments

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {/* Base Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={
              isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(19, 27, 46, 0.05)'
            }
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Segment Arcs */}
          {segments.map((seg, i) => {
            const fraction = seg.value / total;
            const strokeLength = fraction * circumference * animProgress;
            const dashGap = circumference - strokeLength;
            const offset = -(accumulatedAngle / 360) * circumference;

            accumulatedAngle += fraction * 360;

            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${Math.max(strokeLength - 3, 0)}, ${dashGap + 3}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </G>
      </Svg>

      {/* Center Figure & Label */}
      <View style={styles.centerContainer}>
        <AnimatedNumber
          value={centerValue}
          prefix={centerPrefix}
          suffix={centerSuffix}
          style={[styles.centerNumber, { color: colors.textPrimary }]}
        />
        {centerLabel ? (
          <Text
            style={[styles.centerSubtext, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {centerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 14,
    position: 'relative',
  },
  centerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNumber: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  centerSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
