/**
 * HeatGuard Twin — Alerts Tab
 * Restrained minimalist alerts feed with width-constrained container (800px),
 * 28px page title, 36px segment filters, soft desaturated status badges, and tidy rhythm.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fetchAssessments } from '../../src/services/api';
import { AssessmentResponse } from '../../src/types';
import {
  useTheme,
  BorderRadius,
} from '../../src/constants/theme';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { GlassCircleIcon, FeatherIconName } from '../../src/components/GlassCircleIcon';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AlertCardProps {
  assessment: AssessmentResponse;
}

function AlertCard({ assessment }: AlertCardProps) {
  const { colors, isDark } = useTheme();

  const severityMap: Record<
    string,
    { label: string; icon: FeatherIconName; color: string; bg: string; border: string }
  > = {
    supervisor_review: {
      label: 'Supervisor Review',
      icon: 'alert-circle',
      color: colors.statusDangerDot,
      bg: colors.statusDangerBg,
      border: colors.statusDangerBorder,
    },
    monitor: {
      label: 'Monitor Advisory',
      icon: 'alert-triangle',
      color: colors.statusWarningDot,
      bg: colors.statusWarningBg,
      border: colors.statusWarningBorder,
    },
    no_unusual_pattern: {
      label: 'Normal Assessment',
      icon: 'check-circle',
      color: colors.statusSuccessDot,
      bg: colors.statusSuccessBg,
      border: colors.statusSuccessBorder,
    },
    insufficient_data: {
      label: 'Telemetry Advisory',
      icon: 'info',
      color: colors.textMuted,
      bg: colors.statusMutedBg,
      border: colors.statusMutedBorder,
    },
  };

  const config = severityMap[assessment.status] ?? severityMap.insufficient_data;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/worker/${assessment.worker_id}`)}
      activeOpacity={0.84}
      style={styles.cardTouchable}
    >
      <GlassCard style={styles.card} radius={20}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <GlassCircleIcon
              name={config.icon}
              size={40}
              iconSize={18}
              color={config.color}
              bg={config.bg}
              borderColor={config.border}
              style={styles.severityIcon}
            />
            <View>
              <Text style={[styles.workerId, { color: colors.textPrimary }]}>
                {assessment.worker_id}
              </Text>
              <Text style={[styles.timestamp, { color: colors.textMuted }]}>
                {formatTime(assessment.assessed_at)}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            {assessment.ml_prediction && (
              <View
                style={[
                  styles.mlPill,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(37, 99, 235, 0.2)',
                  },
                ]}
              >
                <Text style={[styles.mlPillText, { color: colors.accent }]}>
                  ML {Math.round(assessment.ml_prediction.confidence * 100)}%
                </Text>
              </View>
            )}
            <StatusBadge status={assessment.status} size="sm" />
          </View>
        </View>

        {/* Observation text in 14px regular slate */}
        {assessment.observations.length > 0 && (
          <Text
            style={[styles.observation, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {assessment.observations[0]}
          </Text>
        )}

        {/* Action recommended callout (neutral glass) */}
        {assessment.recommended_actions.length > 0 && (
          <View
            style={[
              styles.actionBox,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.actionHeader}>
              <Feather name="shield" size={13} color={colors.textSecondary} style={styles.actionIcon} />
              <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
                Recommended Protocol
              </Text>
            </View>
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>
              {assessment.recommended_actions[0]}
            </Text>
          </View>
        )}

        {/* Context metadata (temperature, heart-rate vitals) */}
        <View style={[styles.metaRow, { borderTopColor: colors.surfaceBorder }]}>
          {assessment.environment?.temperature_c != null && (
            <View style={styles.metaItem}>
              <Feather name="sun" size={13} color={colors.textMuted} style={styles.metaIcon} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {assessment.environment.temperature_c.toFixed(1)}°C ambient
              </Text>
            </View>
          )}

          {assessment.latest_hr != null && (
            <View style={styles.metaItem}>
              <Feather name="heart" size={13} color={colors.textMuted} style={styles.metaIcon} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {Math.round(assessment.latest_hr)} BPM latest
              </Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Feather name="database" size={13} color={colors.textMuted} style={styles.metaIcon} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {assessment.data_quality.reading_count} readings
            </Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function AlertsScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAssessments({ limit: 50 });
      setAssessments(data);
    } catch {
      setError('Could not retrieve recent alerts. Check backend connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const displayed =
    filter === 'active'
      ? assessments.filter(
          (a) => a.status === 'monitor' || a.status === 'supervisor_review'
        )
      : assessments;

  if (loading) {
    return (
      <ScreenBackground style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading exposure alerts…
        </Text>
      </ScreenBackground>
    );
  }

  const containerPadding = isDesktop ? 32 : 20;

  return (
    <ScreenBackground style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: 800,
            paddingHorizontal: containerPadding,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Confident Page Title with Generous Top Spacing */}
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
            Alerts
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Real-time thermal strain advisories & supervisor reviews
          </Text>
        </View>

        {/* 36px Segment Filter Chips */}
        <View style={styles.filterRow}>
          <View
            style={[
              styles.segmentContainer,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.surfaceBorder,
              },
            ]}
          >
            {(['active', 'all'] as const).map((f) => {
              const active = filter === f;
              const activeBg = isDark ? 'rgba(255, 255, 255, 0.14)' : '#131B2E';
              const activeBorder = isDark ? 'rgba(255, 255, 255, 0.22)' : '#1E293B';
              const count =
                f === 'active'
                  ? assessments.filter(
                      (a) => a.status === 'monitor' || a.status === 'supervisor_review'
                    ).length
                  : assessments.length;

              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterTab,
                    active && {
                      backgroundColor: activeBg,
                      borderColor: activeBorder,
                    },
                  ]}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      {
                        color: active ? '#F5F7FA' : colors.textMuted,
                        fontWeight: active ? '600' : '400',
                      },
                    ]}
                  >
                    {f === 'active' ? `Active Alerts (${count})` : `All History (${count})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error && (
          <GlassCard style={styles.errorBanner} radius={14}>
            <Feather name="alert-circle" size={16} color={colors.statusDangerText} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: colors.statusDangerText }]}>
              {error}
            </Text>
          </GlassCard>
        )}

        {/* Alert Cards Feed */}
        {displayed.length === 0 ? (
          <GlassCard style={styles.emptyBox} radius={20}>
            <Feather name="check-circle" size={24} color={colors.statusSuccessDot} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {filter === 'active' ? 'Zero Active Alerts' : 'No Assessment Records'}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              {filter === 'active'
                ? 'No workers currently require intervention or elevated monitoring.'
                : 'No historical assessment records found in the database.'}
            </Text>
          </GlassCard>
        ) : (
          displayed.map((a, idx) => <AlertCard key={idx} assessment={a} />)
        )}

        {/* Bottom Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Feather name="shield" size={12} color={colors.textMuted} style={styles.disclaimerIcon} />
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            Svastra alerts are algorithmic screening flags for work supervisors, not clinical diagnoses.
          </Text>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 24,
    paddingBottom: 140, // Clearance for floating bottom nav
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '400',
  },
  titleSection: {
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 20,
  },
  filterRow: {
    marginBottom: 16,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 3,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabText: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
  },
  cardTouchable: {
    marginBottom: 14,
    width: '100%',
  },
  card: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mlPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  mlPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  severityIcon: {
    marginRight: 12,
  },
  workerId: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  observation: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: 14,
  },
  actionBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  actionIcon: {},
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {},
  metaText: {
    fontSize: 12,
    fontWeight: '400',
  },
  emptyBox: {
    padding: 36,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
    paddingHorizontal: 16,
  },
  disclaimerIcon: {
    flexShrink: 0,
  },
  disclaimerText: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 16,
  },
});
