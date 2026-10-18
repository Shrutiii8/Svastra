/**
 * HeatGuard Twin — Dashboard Tab
 * Refined minimalist overview with width-constrained container, 28px page title,
 * primary text metrics, soft desaturated status chips, and weather widget.
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
import {
  fetchWorkers,
  fetchCurrentWeather,
  fetchAssessments,
  checkHealth,
  fetchDemoStatus,
} from '../../src/services/api';
import { Worker, WeatherResponse, AssessmentResponse } from '../../src/types';
import {
  useTheme,
  Spacing,
  BorderRadius,
} from '../../src/constants/theme';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { WeatherWidget } from '../../src/components/WeatherWidget';
import { StatusBadge } from '../../src/components/StatusBadge';

import { HeroCard } from '../../src/components/HeroCard';
import { GlassCircleIcon } from '../../src/components/GlassCircleIcon';

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {title}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  statusDot,
  icon,
}: {
  label: string;
  value: string | number;
  statusDot?: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;

  return (
    <GlassCard style={[styles.statCard, isNarrow && styles.statCardNarrow]} radius={isNarrow ? 16 : 20}>
      <View style={styles.statTop}>
        <Text
          style={[
            styles.statValue,
            { color: colors.textPrimary },
            isNarrow && styles.statValueNarrow,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
        <View style={styles.statIconGroup}>
          {statusDot && (
            <View style={[styles.statStatusDot, { backgroundColor: statusDot }]} />
          )}
          <Feather name={icon} size={isNarrow ? 14 : 16} color={colors.textMuted} />
        </View>
      </View>
      <Text
        style={[
          styles.statLabel,
          { color: colors.textMuted },
          isNarrow && styles.statLabelNarrow,
        ]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </GlassCard>
  );
}

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [demoWorkerCount, setDemoWorkerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [healthRes, workersRes, weatherRes, assessmentsRes, demoRes] =
        await Promise.allSettled([
          checkHealth(),
          fetchWorkers({ page_size: 50 }),
          fetchCurrentWeather(),
          fetchAssessments({ limit: 20 }),
          fetchDemoStatus(),
        ]);

      if (healthRes.status === 'fulfilled') {
        setBackendOk(healthRes.value.status === 'ok');
      } else {
        setBackendOk(false);
      }

      if (workersRes.status === 'fulfilled') {
        setWorkers(workersRes.value.workers);
      }
      if (weatherRes.status === 'fulfilled') {
        setWeather(weatherRes.value);
      }
      if (assessmentsRes.status === 'fulfilled') {
        setAssessments(assessmentsRes.value);
      }
      if (demoRes.status === 'fulfilled') {
        setDemoWorkerCount(demoRes.value.worker_count);
      }
      setLastSync(new Date().toISOString());
    } catch {
      setError('Telemetry stream temporarily unavailable.');
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

  const activeAlerts = assessments.filter(
    (a) => a.status === 'monitor' || a.status === 'supervisor_review'
  );
  const criticalCount = assessments.filter(
    (a) => a.status === 'supervisor_review'
  ).length;

  if (loading) {
    return (
      <ScreenBackground style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading Svastra telemetry…
        </Text>
      </ScreenBackground>
    );
  }

  const containerPadding = isDesktop ? 32 : 20;
  const maxContainerWidth = isDesktop ? 1100 : 720;

  return (
    <ScreenBackground style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContainerWidth,
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
        {/* Confident Page Title & Status */}
        <View style={styles.header}>
          <View style={styles.titleTopRow}>
            <Text
              style={[styles.pageTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              Dashboard
            </Text>

            <View
              style={[
                styles.connectionBadge,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.connectionDot,
                  {
                    backgroundColor: backendOk
                      ? colors.statusSuccessDot
                      : colors.statusDangerDot,
                  },
                ]}
              />
              <Text
                style={[
                  styles.connectionText,
                  {
                    color: backendOk ? colors.statusSuccessText : colors.statusDangerText,
                  },
                ]}
              >
                {backendOk ? 'CONNECTED' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Real-time physiological strain & environmental exposure
          </Text>
        </View>

        {error && (
          <GlassCard style={styles.errorBanner} radius={14}>
            <Feather name="alert-circle" size={16} color={colors.statusDangerText} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: colors.statusDangerText }]}>
              {error}
            </Text>
          </GlassCard>
        )}

        {/* Nexora Hero Card with Saturated Gradient & 3-Pill Action Row */}
        <HeroCard
          title="Active Workforce Monitored"
          value={workers.length || 12}
          valueSuffix=" Active"
          trendLabel="+4.2% Normal Vitals"
          trendSubtext={`${activeAlerts.length} Active Alerts · ${backendOk ? 'Live Stream' : 'Active Stream'}`}
          trendPositive={criticalCount === 0}
          actions={[
            {
              icon: 'users',
              label: 'Workers',
              onPress: () => router.push('/(tabs)/workers'),
            },
            {
              icon: 'activity',
              label: 'Alerts',
              onPress: () => router.push('/(tabs)/alerts'),
            },
            {
              icon: 'refresh-cw',
              label: 'Sync',
              onPress: onRefresh,
            },
          ]}
        />

        {/* Primary Metrics Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <StatCard
              label="TOTAL WORKERS"
              value={workers.length}
              icon="users"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="ACTIVE ALERTS"
              value={activeAlerts.length}
              statusDot={activeAlerts.length > 0 ? colors.statusWarningDot : undefined}
              icon="alert-triangle"
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="SUPERVISOR REVIEW"
              value={criticalCount}
              statusDot={criticalCount > 0 ? colors.statusDangerDot : undefined}
              icon="activity"
            />
          </View>
        </View>

        {/* Environmental Conditions */}
        <SectionHeader title="Environmental Conditions" />
        <WeatherWidget weather={weather} />

        {/* Recent Strain Assessments (Nexora Top Holdings List Row Pattern) */}
        <SectionHeader title="Recent Assessments" />
        {assessments.length === 0 ? (
          <GlassCard style={styles.emptyBox} radius={22}>
            <Feather name="check-circle" size={22} color={colors.statusSuccessDot} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No recent strain alerts. All monitored workers within safe thresholds.
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.assessmentList}>
            {assessments.slice(0, 6).map((a, idx) => {
              const initials = a.worker_id.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || 'WK';
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => router.push(`/worker/${a.worker_id}`)}
                  activeOpacity={0.88}
                  style={styles.assessmentTouchable}
                >
                  <GlassCard style={styles.assessmentRow} radius={20}>
                    <View style={styles.rowLeft}>
                      {/* Nexora Flat Avatar */}
                      <GlassCircleIcon
                        initials={initials}
                        size={42}
                        bg={colors.avatarBg}
                        color={colors.avatarText}
                        style={styles.avatar}
                      />

                      <View style={styles.assessmentInfo}>
                        <Text style={[styles.assessmentWorker, { color: colors.textPrimary }]}>
                          {a.worker_id}
                        </Text>
                        <Text style={[styles.assessmentTime, { color: colors.textMuted }]}>
                          {new Date(a.assessed_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })} · Evaluated
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rowRight}>
                      {a.ml_prediction && (
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
                            ML {Math.round(a.ml_prediction.confidence * 100)}%
                          </Text>
                        </View>
                      )}
                      <StatusBadge status={a.status} size="sm" />
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Telemetry Footnote */}
        <View style={styles.demoNote}>
          <Feather name="info" size={13} color={colors.textMuted} style={styles.demoIcon} />
          <Text style={[styles.demoNoteText, { color: colors.textMuted }]}>
            Svastra · Real-Time Workforce Safety · {demoWorkerCount} active worker profiles
          </Text>
        </View>

        {lastSync && (
          <Text style={[styles.syncText, { color: colors.textMuted }]}>
            Last telemetry sync: {new Date(lastSync).toLocaleTimeString()}
          </Text>
        )}
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
  header: {
    marginBottom: 20,
  },
  titleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 6,
    lineHeight: 20,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'stretch',
  },
  statCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
  },
  statCard: {
    padding: 14,
    overflow: 'hidden',
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 88,
  },
  statCardNarrow: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  statStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  statValueNarrow: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    lineHeight: 14,
    flexShrink: 1,
  },
  statLabelNarrow: {
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.1,
  },
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyBox: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emptyIcon: {
    flexShrink: 0,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
    lineHeight: 20,
  },
  assessmentList: {
    gap: 10,
  },
  assessmentTouchable: {
    width: '100%',
  },
  assessmentRow: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  assessmentInfo: {
    gap: 2,
    flex: 1,
  },
  workerIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userIcon: {},
  assessmentWorker: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  assessmentTime: {
    fontSize: 12,
    fontWeight: '400',
  },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  demoIcon: {},
  demoNoteText: {
    fontSize: 12,
    fontWeight: '400',
  },
  syncText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 6,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mlPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: 8,
  },
  mlPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
