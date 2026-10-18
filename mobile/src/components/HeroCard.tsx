/**
 * HeroCard — Saturated Blue Gradient Hero Card (Dark) / Clean Blue Surface Hero Card (Light)
 * Responsive design engineered to prevent any text overflow on mobile viewports.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ViewStyle,
  StyleProp,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useTheme, BorderRadius } from '../constants/theme';
import { AnimatedNumber } from './AnimatedNumber';

export interface HeroAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}

interface HeroCardProps {
  title: string;
  value: number;
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
  trendLabel?: string;
  trendSubtext?: string;
  trendPositive?: boolean;
  actions?: HeroAction[];
  style?: StyleProp<ViewStyle>;
}

export function HeroCard({
  title,
  value,
  valuePrefix = '',
  valueSuffix = '',
  decimals = 0,
  trendLabel,
  trendSubtext,
  trendPositive = true,
  actions = [],
  style,
}: HeroCardProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;

  return (
    <View
      style={[
        styles.container,
        isDark
          ? styles.containerDark
          : [
              styles.containerLight,
              Platform.OS === 'web' && ({
                boxShadow: '0 4px 18px rgba(37, 99, 235, 0.08)',
              } as any),
            ],
        style,
      ]}
    >
      {/* Saturated Blue Gradient SVG background (Dark Mode only) */}
      {isDark && (
        <View style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="heroGradientGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#1E40AF" />
                <Stop offset="50%" stopColor="#152E72" />
                <Stop offset="100%" stopColor="#0B193D" />
              </LinearGradient>
            </Defs>
            <Rect
              width="100%"
              height="100%"
              rx={22}
              ry={22}
              fill="url(#heroGradientGrad)"
            />
          </Svg>
        </View>
      )}

      {/* Hero Card Content */}
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: isNarrow ? 14 : 20,
            paddingTop: isNarrow ? 18 : 24,
            paddingBottom: isNarrow ? 16 : 20,
          },
        ]}
      >
        {/* Title */}
        <Text
          style={[
            styles.titleText,
            {
              color: isDark ? 'rgba(255, 255, 255, 0.72)' : '#131B2E',
              fontSize: isNarrow ? 11.5 : 13,
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>

        {/* Large Bold Metric with count-up */}
        <View style={styles.metricRow}>
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={valuePrefix}
            suffix={valueSuffix}
            style={[
              styles.metricText,
              {
                color: isDark ? '#FFFFFF' : '#131B2E',
                fontSize: isNarrow ? 30 : 34,
              },
            ]}
          />
        </View>

        {/* Trend Row */}
        {(trendLabel || trendSubtext) && (
          <View
            style={[
              styles.trendRow,
              {
                gap: isNarrow ? 6 : 8,
                marginBottom: isNarrow ? 14 : 18,
              },
            ]}
          >
            {trendLabel && (
              <View
                style={[
                  styles.trendPill,
                  {
                    paddingHorizontal: isNarrow ? 7 : 8,
                    backgroundColor: trendPositive
                      ? isDark
                        ? 'rgba(61, 220, 132, 0.20)'
                        : 'rgba(22, 163, 74, 0.12)'
                      : isDark
                      ? 'rgba(255, 107, 107, 0.20)'
                      : 'rgba(239, 68, 68, 0.12)',
                    borderColor: trendPositive
                      ? isDark
                        ? 'transparent'
                        : 'rgba(22, 163, 74, 0.25)'
                      : isDark
                      ? 'transparent'
                      : 'rgba(239, 68, 68, 0.25)',
                    borderWidth: isDark ? 0 : 1,
                  },
                ]}
              >
                <Feather
                  name={trendPositive ? 'trending-up' : 'alert-circle'}
                  size={isNarrow ? 11 : 12}
                  color={
                    trendPositive
                      ? isDark
                        ? '#3DDC84'
                        : '#16A34A'
                      : isDark
                      ? '#FF6B6B'
                      : '#DC2626'
                  }
                  style={styles.trendIcon}
                />
                <Text
                  style={[
                    styles.trendLabelText,
                    {
                      fontSize: isNarrow ? 11 : 12,
                      color: trendPositive
                        ? isDark
                          ? '#3DDC84'
                          : '#16A34A'
                        : isDark
                        ? '#FF6B6B'
                        : '#DC2626',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {trendLabel}
                </Text>
              </View>
            )}

            {trendSubtext && (
              <Text
                style={[
                  styles.trendSubtext,
                  {
                    fontSize: isNarrow ? 11 : 12,
                    color: isDark ? 'rgba(255, 255, 255, 0.65)' : '#6B7686',
                  },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {trendSubtext}
              </Text>
            )}
          </View>
        )}

        {/* 3-Pill Action Row */}
        {actions.length > 0 && (
          <View
            style={[
              styles.actionsRow,
              {
                gap: isNarrow ? 6 : 8,
                paddingTop: isNarrow ? 10 : 12,
                borderTopColor: isDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(37, 99, 235, 0.12)',
              },
            ]}
          >
            {actions.map((act, index) => (
              <TouchableOpacity
                key={index}
                onPress={act.onPress}
                activeOpacity={0.82}
                style={[
                  styles.pillButton,
                  {
                    paddingHorizontal: isNarrow ? 4 : 8,
                    paddingVertical: isNarrow ? 8 : 10,
                  },
                  isDark
                    ? styles.pillButtonDark
                    : [
                        styles.pillButtonLight,
                        Platform.OS === 'web' && ({
                          boxShadow: '0 2px 8px rgba(19, 27, 46, 0.18)',
                        } as any),
                      ],
                ]}
              >
                <Feather
                  name={act.icon}
                  size={isNarrow ? 12 : 14}
                  color="#FFFFFF"
                  style={[styles.pillIcon, { marginRight: isNarrow ? 3 : 5 }]}
                />
                <Text
                  style={[
                    styles.pillText,
                    {
                      fontSize: isNarrow ? 11 : 12.5,
                      letterSpacing: isNarrow ? 0 : 0.1,
                    },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {act.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 14,
  },
  containerDark: {
    ...Platform.select({
      web: {
        boxShadow: '0 10px 30px rgba(11, 25, 61, 0.40)',
      } as any,
      default: {
        shadowColor: '#0B193D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 0,
      },
    }),
  },
  containerLight: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(37, 99, 235, 0.08)',
      } as any,
      default: {
        shadowColor: '#1E3A8A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    marginBottom: 10,
  },
  metricText: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 8,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
  },
  trendIcon: {
    marginRight: 4,
  },
  trendLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendSubtext: {
    fontSize: 12,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pillButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  pillButtonDark: {
    backgroundColor: 'rgba(7, 15, 36, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  pillButtonLight: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#131B2E',
    ...Platform.select({
      default: {
        shadowColor: '#131B2E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.16,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  pillIcon: {
    marginRight: 5,
    flexShrink: 0,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
});
