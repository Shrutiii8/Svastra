/**
 * WeatherWidget — Environmental Monitoring Widget
 * Glassmorphic surface displaying ambient temperature, humidity, and wind conditions.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WeatherResponse } from '../types';
import { useTheme, Typography, Spacing, BorderRadius } from '../constants/theme';
import { GlassCard } from './GlassCard';
import { GlassCircleIcon, FeatherIconName } from './GlassCircleIcon';

interface Props {
  weather: WeatherResponse | null;
  loading?: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeatherIconName(code: number | null): FeatherIconName {
  if (code === null) return 'thermometer';
  if (code === 0) return 'sun';
  if (code <= 3) return 'cloud';
  if (code <= 48) return 'wind';
  if (code <= 67) return 'cloud-rain';
  if (code <= 77) return 'cloud-snow';
  if (code <= 82) return 'cloud-drizzle';
  if (code <= 99) return 'cloud-lightning';
  return 'thermometer';
}

export function WeatherWidget({ weather, loading }: Props) {
  const { colors, isDark } = useTheme();

  if (loading) {
    return (
      <GlassCard style={styles.card}>
        <Text style={[styles.loadingText, { color: colors.accentCyan }]}>
          Fetching environmental data…
        </Text>
      </GlassCard>
    );
  }

  if (!weather) {
    return (
      <GlassCard style={styles.card}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          Environmental data currently unavailable
        </Text>
      </GlassCard>
    );
  }

  const isSimulated = weather.is_simulated || weather.source === 'simulated_fallback';
  const iconName = getWeatherIconName(weather.weather_code);

  return (
    <GlassCard style={styles.card}>
      {isSimulated && (
        <View
          style={[
            styles.simulatedBadge,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          <Feather name="activity" size={11} color={colors.textMuted} style={styles.badgeIcon} />
          <Text style={[styles.simulatedText, { color: colors.textMuted }]}>
            OFFLINE FALLBACK
          </Text>
        </View>
      )}

      <View style={styles.mainRow}>
        <GlassCircleIcon
          name={iconName}
          size={48}
          iconSize={22}
          color={colors.accent}
          bg={isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)'}
          borderColor={colors.surfaceBorder}
          style={styles.iconCircle}
        />

        <View style={styles.tempBlock}>
          <Text style={[styles.tempValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {weather.temperature_c != null ? `${weather.temperature_c.toFixed(1)}°C` : '—'}
          </Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={11} color={colors.textMuted} style={styles.pinIcon} />
            <Text
              style={[styles.location, { color: colors.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              New Delhi, India
            </Text>
          </View>
        </View>

        <View style={styles.metricsColumn}>
          {weather.humidity_pct != null && (
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {weather.humidity_pct.toFixed(0)}%
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Humidity</Text>
            </View>
          )}

          {weather.wind_speed_kmh != null && (
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {weather.wind_speed_kmh.toFixed(0)} <Text style={styles.unitText}>km/h</Text>
              </Text>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Wind Speed</Text>
            </View>
          )}
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.surfaceBorder,
          },
        ]}
      >
        <Text
          style={[styles.footerText, { color: colors.textMuted }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {isSimulated ? 'Offline Model' : 'Open-Meteo'} · {formatTime(weather.observed_at)}
        </Text>
        <Text
          style={[styles.footerNote, { color: colors.textMuted }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Ambient condition ≠ personal strain
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.base,
  },
  loadingText: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    padding: Spacing.md,
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    padding: Spacing.md,
  },
  simulatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  badgeIcon: {
    marginRight: 5,
  },
  simulatedText: {
    fontSize: 10,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.6,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconCircle: {
    marginRight: Spacing.base,
  },
  tempBlock: {
    flex: 1,
    minWidth: 0,
  },
  tempValue: {
    fontSize: Typography.sizes['3xl'],
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pinIcon: {
    marginRight: 4,
  },
  location: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  metricsColumn: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  metricItem: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  unitText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.regular,
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  footerText: {
    fontSize: Typography.sizes.xs,
    flexShrink: 1,
  },
  footerNote: {
    fontSize: Typography.sizes.xs,
    fontStyle: 'italic',
    flexShrink: 1,
  },
});
