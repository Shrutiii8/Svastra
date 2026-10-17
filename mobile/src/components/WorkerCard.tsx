/**
 * WorkerCard — Restrained Minimalist Outdoor Worker Profile Card
 * Near-monochrome palette, 40px neutral icon circle, primary text BPM metric,
 * soft desaturated status chip, and clean single neutral DEMO tag.
 */
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Worker, AssessmentStatus } from '../types';
import {
  useTheme,
  Typography,
  Spacing,
  BorderRadius,
  CATEGORY_LABELS,
} from '../constants/theme';
import { StatusBadge } from './StatusBadge';
import { GlassCard } from './GlassCard';
import { GlassCircleIcon, FeatherIconName } from './GlassCircleIcon';

interface Props {
  worker: Worker;
  latestHr?: number | null;
  latestHrTime?: string | null;
  assessmentStatus?: AssessmentStatus;
  source?: string;
  onPress: () => void;
}

const CATEGORY_INITIALS_MAP: Record<string, string> = {
  construction: 'CN',
  delivery: 'DL',
  street_vendor: 'SV',
  traffic_police: 'TP',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isStale(iso: string | null | undefined): boolean {
  if (!iso) return true;
  const ageMin = (Date.now() - new Date(iso).getTime()) / 60000;
  return ageMin > 30;
}

export function WorkerCard({
  worker,
  latestHr,
  latestHrTime,
  assessmentStatus,
  source,
  onPress,
}: Props) {
  const { colors, isDark } = useTheme();
  const stale = isStale(latestHrTime);

  const cleanDisplayName = worker.display_name
    .replace(/\s*\(Demo\)/i, '')
    .trim();

  const initials =
    CATEGORY_INITIALS_MAP[worker.category] ??
    worker.id.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() ??
    'WK';

  const isLive = source === 'health_connect';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.touchable}
    >
      <GlassCard style={styles.card} radius={20}>
        <View style={styles.row}>
          {/* Nexora Flat Avatar Circle */}
          <GlassCircleIcon
            initials={initials}
            size={42}
            bg={colors.avatarBg}
            color={colors.avatarText}
            style={styles.avatar}
          />

          {/* Title + Subtitle */}
          <View style={styles.infoCol}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.workerName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {cleanDisplayName}
              </Text>
              {isLive ? (
                <View
                  style={[
                    styles.tagPill,
                    {
                      backgroundColor: colors.statusSuccessBg,
                      borderColor: colors.statusSuccessBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      { color: colors.statusSuccessText },
                    ]}
                  >
                    LIVE
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[styles.workerSubtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {CATEGORY_LABELS[worker.category] ?? worker.category} · {worker.id}
            </Text>
          </View>

          {/* Right Value & Status Pill */}
          <View style={styles.valueCol}>
            <View style={styles.valueRow}>
              {latestHr != null ? (
                <>
                  <Text
                    style={[styles.hrValue, { color: colors.textPrimary }]}
                  >
                    {Math.round(latestHr)}
                  </Text>
                  <Text style={[styles.hrUnit, { color: colors.textMuted }]}>
                    BPM
                  </Text>
                </>
              ) : (
                <Text style={[styles.hrEmpty, { color: colors.textMuted }]}>
                  —
                </Text>
              )}
            </View>

            <View style={styles.badgeWrapper}>
              <StatusBadge
                status={assessmentStatus ?? 'insufficient_data'}
                size="sm"
              />
            </View>
          </View>
        </View>

        {/* Timestamp Footer - always rendered for equal card heights across grid */}
        <View
          style={[
            styles.footerRow,
            {
              borderTopColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(19, 27, 46, 0.05)',
            },
          ]}
        >
          <Feather
            name={latestHrTime ? 'clock' : 'activity'}
            size={11}
            color={colors.textMuted}
            style={styles.timeIcon}
          />
          <Text style={[styles.timeText, { color: colors.textMuted }]} numberOfLines={1}>
            {latestHrTime
              ? `${formatTime(latestHrTime)} ${stale ? '(stale)' : '· synced'}`
              : 'Awaiting vitals sync'}
          </Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: Spacing.md,
    width: '100%',
    flex: 1,
  },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 104,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  workerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  valueCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hrValue: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 2,
    fontVariant: ['tabular-nums'],
  },
  hrEmpty: {
    fontSize: 16,
    fontWeight: '500',
  },
  hrUnit: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  badgeWrapper: {
    marginTop: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  timeIcon: {
    marginRight: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '400',
  },
});
