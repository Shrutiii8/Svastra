/**
 * NexoraBarChart — Soft-Blue Rounded-Top Gradient Bar Chart
 * Animates from zero height on mount with subtle dashed gridlines and x-axis labels.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
  Line,
} from 'react-native-svg';
import { useTheme } from '../constants/theme';

export interface BarChartItem {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface NexoraBarChartProps {
  data: BarChartItem[];
  height?: number;
  unit?: string;
  maxValue?: number;
}

export function NexoraBarChart({
  data,
  height = 140,
  unit = '',
  maxValue,
}: NexoraBarChartProps) {
  const { colors, isDark } = useTheme();
  const [width, setWidth] = useState<number>(300);
  const [animProgress, setAnimProgress] = useState<number>(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animId: number;
    const duration = 850;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
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
  }, [data]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  const calculatedMax =
    maxValue ??
    Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)), 10);
  const chartHeight = height - 30; // 30px for bottom labels
  const barCount = data.length || 1;
  const slotWidth = width / barCount;
  const barWidth = Math.min(Math.max(slotWidth * 0.45, 14), 28);

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Soft-blue gradient for bars */}
          <LinearGradient id="nexoraBarGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#60A5FA" />
            <Stop offset="60%" stopColor="#3B82F6" />
            <Stop offset="100%" stopColor="#1D4ED8" />
          </LinearGradient>

          {/* Secondary / subtle top stacked bar gradient */}
          <LinearGradient id="nexoraBarGradSecondary" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#93C5FD" />
            <Stop offset="100%" stopColor="#60A5FA" />
          </LinearGradient>
        </Defs>

        {/* Horizontal dashed gridlines */}
        {gridLevels.map((lvl, index) => {
          const y = chartHeight - chartHeight * lvl;
          return (
            <Line
              key={index}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={
                isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(19, 27, 46, 0.06)'
              }
              strokeWidth="1"
              strokeDasharray="4, 4"
            />
          );
        })}

        {/* Bars */}
        {data.map((item, index) => {
          const barHeight =
            (item.value / calculatedMax) * chartHeight * animProgress;
          const x = index * slotWidth + (slotWidth - barWidth) / 2;
          const y = chartHeight - barHeight;

          return (
            <React.Fragment key={index}>
              {/* Main Bar with rounded top */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 0)}
                rx={barWidth / 3.5}
                ry={barWidth / 3.5}
                fill="url(#nexoraBarGrad)"
              />

              {/* Optional secondary / target marker */}
              {item.secondaryValue != null && (
                <Rect
                  x={x}
                  y={
                    chartHeight -
                    (item.secondaryValue / calculatedMax) * chartHeight * animProgress
                  }
                  width={barWidth}
                  height={3}
                  rx={1.5}
                  ry={1.5}
                  fill="#FBBF24"
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* X-axis Labels */}
      <View style={styles.labelsRow}>
        {data.map((item, idx) => (
          <View
            key={idx}
            style={[styles.labelSlot, { width: `${100 / barCount}%` }]}
          >
            <Text
              style={[styles.labelText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 8,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 6,
    width: '100%',
    justifyContent: 'space-between',
  },
  labelSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
