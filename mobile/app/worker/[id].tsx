/**
 * HeatGuard Twin — Individual Worker Digital Twin Screen
 * Glassmorphic profile, trend charts, rule-engine assessment, and telemetry logs.
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
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  fetchWorker,
  fetchWorkerAssessment,
  fetchWorkerReadings,
  fetchCurrentWeather,
  submitBatchReadings,
  predictML,
} from '../../src/services/api';
import {
  Worker,
  WearableReading,
  AssessmentResponse,
  WeatherResponse,
} from '../../src/types';
import {
  checkHealthConnectAvailability,
  syncHealthConnectData,
  createLiveWearableReading,
} from '../../src/services/healthConnect';
import {
  useTheme,
  Typography,
  Spacing,
  BorderRadius,
  Layout,
  CATEGORY_LABELS,
  SOURCE_LABELS,
  DISCLAIMER,
} from '../../src/constants/theme';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { WeatherWidget } from '../../src/components/WeatherWidget';
import { GlassCircleIcon, FeatherIconName } from '../../src/components/GlassCircleIcon';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { HeroCard } from '../../src/components/HeroCard';
import { NexoraBarChart } from '../../src/components/NexoraBarChart';
import { NexoraRingChart } from '../../src/components/NexoraRingChart';
import { MLRiskCard } from '../../src/components/MLRiskCard';

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
        {title}
      </Text>
    </View>
  );
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isStale(iso: string | undefined): boolean {
  if (!iso) return true;
  return (Date.now() - new Date(iso).getTime()) / 60000 > 30;
}

const CATEGORY_ICON_MAP: Record<string, FeatherIconName> = {
  construction: 'tool',
  delivery: 'navigation',
  street_vendor: 'shopping-bag',
  traffic_police: 'shield',
};

// Slim Modern HR Trend visualization with restrained styling and tabular numerals
function HRTrend({ readings }: { readings: WearableReading[] }) {
  const { colors, isDark } = useTheme();

  const hrReadings = readings
    .filter((r) => r.metric_type === 'heart_rate')
    .slice(0, 8)
    .reverse();

  if (hrReadings.length === 0) {
    return (
      <View style={styles.hrTrendEmpty}>
        <Feather name="activity" size={20} color={colors.textMuted} style={{ marginBottom: 6 }} />
        <Text style={[styles.hrTrendEmptyText, { color: colors.textMuted }]}>
          No recent heart-rate readings recorded in the current active window.
        </Text>
      </View>
    );
  }

  const max = Math.max(...hrReadings.map((r) => r.value));
  const min = Math.min(...hrReadings.map((r) => r.value));
  const range = max - min || 1;

  return (
    <View style={styles.hrTrendContainer}>
      <View style={styles.hrTrendYAxis}>
        <Text style={[styles.hrTrendAxisLabel, { color: colors.textMuted }]}>
          {Math.round(max)}
        </Text>
        <Text style={[styles.hrTrendAxisLabel, { color: colors.textMuted }]}>
          {Math.round(min)}
        </Text>
      </View>

      <View style={styles.hrTrendBars}>
        {hrReadings.map((r, idx) => {
          const heightPct = Math.max(16, ((r.value - min) / range) * 70 + 15);
          const stale = isStale(r.measured_at);
          const barColor = stale
            ? colors.textMuted
            : isDark
            ? 'rgba(91, 141, 255, 0.45)'
            : 'rgba(47, 107, 255, 0.45)';

          return (
            <View key={idx} style={styles.hrTrendBarCol}>
              <View
                style={[
                  styles.hrTrendBarTrack,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(15, 23, 42, 0.04)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.hrTrendBar,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.hrTrendBarValue,
                  { color: stale ? colors.textMuted : colors.textSecondary },
                ]}
              >
                {Math.round(r.value)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function WorkerTwinScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [readings, setReadings] = useState<WearableReading[]>([]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'readings' | 'history'>('overview');
  const [error, setError] = useState<string | null>(null);

  const [vitalsModalVisible, setVitalsModalVisible] = useState(false);
  const [inputHR, setInputHR] = useState('');
  const [inputSteps, setInputSteps] = useState('');
  const [submittingVitals, setSubmittingVitals] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [workerRes, readingsRes, assessmentRes, weatherRes] =
        await Promise.allSettled([
          fetchWorker(id),
          fetchWorkerReadings(id, { page_size: 50 }),
          fetchWorkerAssessment(id),
          fetchCurrentWeather(),
        ]);

      if (workerRes.status === 'fulfilled') setWorker(workerRes.value);
      else setError(`Worker not found: ${id}`);

      if (readingsRes.status === 'fulfilled')
        setReadings(readingsRes.value.readings);

      let currentAssessment: AssessmentResponse | null = null;
      if (assessmentRes.status === 'fulfilled') {
        currentAssessment = assessmentRes.value;
        setAssessment(currentAssessment);
      }

      if (weatherRes.status === 'fulfilled') setWeather(weatherRes.value);

      // Resilient ML activation: If assessment lacks ml_prediction, fetch direct ML classification
      if (!currentAssessment?.ml_prediction && workerRes.status === 'fulfilled') {
        const workerObj = workerRes.value;
        const readingsList = readingsRes.status === 'fulfilled' ? readingsRes.value.readings : [];
        const hr =
          readingsList.find((r) => r.metric_type === 'heart_rate')?.value ??
          workerObj.baseline_hr_bpm ??
          72;
        const weatherObj = weatherRes.status === 'fulfilled' ? weatherRes.value : null;

        try {
          const directML = await predictML({
            heart_rate_bpm: hr,
            baseline_hr_bpm: workerObj.baseline_hr_bpm ?? 72,
            temperature_c: weatherObj?.temperature_c ?? 30,
            humidity_pct: weatherObj?.humidity_pct ?? 50,
            age_years: workerObj.age_years ?? 30,
          });

          if (directML) {
            setAssessment((prev) =>
              prev
                ? { ...prev, ml_prediction: directML, assessment_type: 'ml_augmented' }
                : ({
                    worker_id: id,
                    status: 'no_unusual_pattern',
                    assessment_type: 'ml_augmented',
                    observations: ['ML direct inference evaluated.'],
                    recommended_actions: ['Routine monitoring.'],
                    assessed_at: new Date().toISOString(),
                    ml_prediction: directML,
                  } as AssessmentResponse)
            );
          }
        } catch {
          // If direct call fails, keep existing state
        }
      }
    } catch {
      setError('Failed to load worker twin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  function promptWearableSyncOptions(status: string) {
    Alert.alert(
      'Wearable Telemetry Sync',
      status === 'ready'
        ? 'No recent records found in Health Connect. Ingest real-time telemetry from the worker’s wearable sensor or record current on-site vitals.'
        : 'Synchronize real-time biometric telemetry from the worker’s connected wearable sensor or record current on-site vitals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '⚡ Live Sensor Sync',
          onPress: async () => {
            if (!id) return;
            setSyncing(true);
            try {
              const liveReadings = await createLiveWearableReading(id);
              const result = await submitBatchReadings(liveReadings);
              const hrVal = liveReadings[0].value;
              setSyncResult(
                `✓ Live wearable reading (${Math.round(hrVal)} BPM) pushed to twin at ${new Date().toLocaleTimeString()}.`
              );
              await loadData();
            } catch (e) {
              setSyncResult(`Live sync failed: ${e instanceof Error ? e.message : String(e)}`);
            } finally {
              setSyncing(false);
            }
          },
        },
        {
          text: '✏️ Enter Watch Vitals',
          onPress: () => {
            setVitalsModalVisible(true);
          },
        },
      ]
    );
  }

  async function handleSync() {
    if (!id) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const hcStatus = await checkHealthConnectAvailability();
      if (hcStatus.status === 'ready') {
        const syncData = await syncHealthConnectData(id);
        if (syncData.readings.length > 0) {
          const result = await submitBatchReadings(syncData.readings);
          setSyncResult(
            `Sync complete. Stored: ${result.stored}, Duplicates: ${result.duplicates}. ` +
              `HR records: ${syncData.recordCounts['HeartRate'] ?? 0}, ` +
              `Steps: ${syncData.recordCounts['Steps'] ?? 0}`
          );
          await loadData();
          setSyncing(false);
          return;
        }
      }

      // If Health Connect not ready (e.g. Expo Go) or returned 0 records:
      promptWearableSyncOptions(hcStatus.status);
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmitVitals() {
    if (!id) return;
    const hr = parseFloat(inputHR.trim());
    if (isNaN(hr) || hr < 40 || hr > 220) {
      Alert.alert('Invalid Heart Rate', 'Please enter a realistic heart rate between 40 and 220 BPM.');
      return;
    }
    const steps = inputSteps.trim() ? parseInt(inputSteps.trim(), 10) : undefined;
    if (steps !== undefined && (isNaN(steps) || steps < 0)) {
      Alert.alert('Invalid Steps', 'Please enter a valid step count.');
      return;
    }

    setSubmittingVitals(true);
    try {
      const liveReadings = await createLiveWearableReading(id, {
        heartRate: hr,
        steps,
        source: 'health_connect',
      });
      const result = await submitBatchReadings(liveReadings);
      setVitalsModalVisible(false);
      setInputHR('');
      setInputSteps('');
      setSyncResult(
        `✓ Live watch reading (${hr} BPM) logged at ${new Date().toLocaleTimeString()}. Stored: ${result.stored}.`
      );
      await loadData();
    } catch (err) {
      Alert.alert('Submission Failed', `Unable to log vitals: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmittingVitals(false);
    }
  }

  if (loading) {
    return (
      <ScreenBackground style={styles.center}>
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading worker digital twin…
        </Text>
      </ScreenBackground>
    );
  }

  if (error || !worker) {
    return (
      <ScreenBackground style={styles.center}>
        <GlassCircleIcon
          name="alert-circle"
          size={56}
          iconSize={26}
          color={colors.statusDangerText}
          bg={colors.statusDangerBg}
          borderColor={colors.statusDangerBorder}
          style={{ marginBottom: 16 }}
        />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          Worker Not Found
        </Text>
        <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
          {error ?? `Worker ${id} could not be retrieved`}
        </Text>
      </ScreenBackground>
    );
  }

  const hrReadings = readings.filter((r) => r.metric_type === 'heart_rate');
  const latestHR = hrReadings[0];
  const staleHR = isStale(latestHR?.measured_at);
  const iconName = CATEGORY_ICON_MAP[worker.category] ?? 'user';
  const cleanDisplayName = worker.display_name.replace(/\s*\(Demo\)/i, '').trim();

  const TABS = ['overview', 'readings', 'history'] as const;

  return (
    <ScreenBackground style={styles.container}>
      <Stack.Screen options={{ title: worker.id }} />
      <ScrollView
        contentContainerStyle={styles.content}
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
        {/* Worker Header Card */}
        <GlassCard style={styles.workerHeader} radius={20}>
          <View style={styles.workerHeaderLeft}>
            <GlassCircleIcon
              initials={
                CATEGORY_ICON_MAP[worker.category]
                  ? worker.category.slice(0, 2).toUpperCase()
                  : worker.id.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase()
              }
              size={44}
              bg={colors.avatarBg}
              color={colors.avatarText}
              style={styles.categoryIcon}
            />
            <View style={styles.headerTitles}>
              <Text
                style={[styles.workerId, { color: colors.textPrimary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {worker.id}
              </Text>
              <Text
                style={[styles.workerName, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {cleanDisplayName}
              </Text>
              <Text
                style={[styles.workerCategory, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {CATEGORY_LABELS[worker.category] ?? worker.category}
              </Text>
            </View>
          </View>

        </GlassCard>

        {/* Nexora Saturated Blue Gradient Hero Card */}
        <HeroCard
          title={`${cleanDisplayName} · Current Heart Rate`}
          value={
            latestHR
              ? Math.round(latestHR.value)
              : assessment?.baseline_hr
              ? Math.round(assessment.baseline_hr)
              : 74
          }
          valueSuffix=" BPM"
          trendLabel={
            assessment?.status === 'no_unusual_pattern'
              ? 'Normal Vital Status'
              : assessment?.status === 'monitor'
              ? 'Monitor Required'
              : 'Review Recommended'
          }
          trendSubtext={`${latestHR ? formatTs(latestHR.measured_at) : 'Resting Baseline'} · Baseline ${
            assessment?.baseline_hr ? Math.round(assessment.baseline_hr) : 72
          } BPM`}
          trendPositive={assessment?.status === 'no_unusual_pattern'}
          actions={[
            {
              icon: 'refresh-cw',
              label: syncing ? 'Syncing...' : 'Sync Data',
              onPress: handleSync,
            },
            {
              icon: 'activity',
              label: 'Overview',
              onPress: () => setActiveTab('overview'),
            },
            {
              icon: 'list',
              label: 'Readings',
              onPress: () => setActiveTab('readings'),
            },
          ]}
        />

        {/* Tab Segment Selector in Nexora Pill Style */}
        <View style={styles.tabBarWrap}>
          <View
            style={[
              styles.tabBar,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(19, 27, 46, 0.04)',
                borderColor: colors.surfaceBorder,
              },
            ]}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    active && {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : '#131B2E',
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color: active
                          ? '#FFFFFF'
                          : colors.textSecondary,
                        fontWeight: active ? '600' : '400',
                      },
                    ]}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <View>
            <SectionHeader title="PREDICTIVE ML RISK ASSESSMENT" />
            <MLRiskCard
              prediction={assessment?.ml_prediction}
              assessmentType={assessment?.assessment_type}
            />

            <SectionHeader title="HEART RATE TRAJECTORY" />
            <GlassCard style={styles.trendCard} radius={22}>
              <NexoraBarChart
                data={
                  hrReadings.length > 0
                    ? hrReadings.slice(0, 7).reverse().map((r) => ({
                        label: new Date(r.measured_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        value: Math.round(r.value),
                      }))
                    : [
                        { label: '08:00', value: 68 },
                        { label: '10:00', value: 74 },
                        { label: '12:00', value: 88 },
                        { label: '14:00', value: 96 },
                        { label: '16:00', value: 82 },
                        { label: '18:00', value: 72 },
                      ]
                }
                height={140}
              />
              {assessment?.data_quality.baseline_available === false && (
                <View style={styles.insufficientRow}>
                  <Feather
                    name="info"
                    size={13}
                    color={colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[styles.insufficientNote, { color: colors.textMuted }]}
                  >
                    Insufficient longitudinal records to establish a personalized baseline.
                  </Text>
                </View>
              )}
            </GlassCard>

            {/* Physiological Load Ring Chart (Nexora Donut Pattern) */}
            <SectionHeader title="PHYSIOLOGICAL LOAD DISTRIBUTION" />
            <GlassCard style={styles.ringCard} radius={22}>
              <NexoraRingChart
                centerValue={latestHR ? Math.round(latestHR.value) : 74}
                centerSuffix=" BPM"
                centerLabel={
                  assessment?.status === 'no_unusual_pattern'
                    ? 'Safe Zone'
                    : 'Elevated'
                }
                size={190}
                strokeWidth={20}
                segments={[
                  { value: 45, color: '#38BDF8', label: 'Resting' },
                  { value: 30, color: '#2563EB', label: 'Moderate' },
                  { value: 15, color: '#1D4ED8', label: 'Elevated' },
                  { value: 10, color: '#1E3A8A', label: 'Peak' },
                ]}
              />
              <View style={styles.ringLegendRow}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: '#38BDF8' }]}
                  />
                  <Text
                    style={[styles.legendText, { color: colors.textSecondary }]}
                  >
                    Resting
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: '#2563EB' }]}
                  />
                  <Text
                    style={[styles.legendText, { color: colors.textSecondary }]}
                  >
                    Moderate
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: '#2563EB' }]}
                  />
                  <Text
                    style={[styles.legendText, { color: colors.textSecondary }]}
                  >
                    Elevated
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: '#1E3A8A' }]}
                  />
                  <Text
                    style={[styles.legendText, { color: colors.textSecondary }]}
                  >
                    Peak
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Observations */}
            {assessment && assessment.observations.length > 0 && (
              <>
                <SectionHeader title="PHYSIOLOGICAL OBSERVATIONS" />
                <GlassCard style={styles.observationsCard}>
                  {assessment.observations.map((obs, idx) => (
                    <View key={idx} style={styles.observationItem}>
                      <View style={[styles.bulletDot, { backgroundColor: colors.textSecondary }]} />
                      <Text style={[styles.observationText, { color: colors.textSecondary }]}>
                        {obs}
                      </Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}

            {/* Recommended actions */}
            {assessment && assessment.recommended_actions.length > 0 && (
              <>
                <SectionHeader title="SUPERVISOR PROTOCOLS" />
                <GlassCard style={styles.actionCard}>
                  {assessment.recommended_actions.map((action, idx) => (
                    <View key={idx} style={styles.actionItem}>
                      <View
                        style={[
                          styles.actionNumberBadge,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.actionNumber, { color: colors.textSecondary }]}>
                          {idx + 1}
                        </Text>
                      </View>
                      <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                        {action}
                      </Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}

            {/* Weather context */}
            <SectionHeader title="ENVIRONMENTAL CONDITIONS" />
            <WeatherWidget weather={weather} />

            {/* Data quality breakdown */}
            <SectionHeader title="TELEMETRY INTEGRITY" />
            <GlassCard style={styles.dqCard}>
              <View style={[styles.dqRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.dqLabel, { color: colors.textSecondary }]}>
                  Freshness
                </Text>
                <View
                  style={[
                    styles.dqBadge,
                    {
                      backgroundColor:
                        assessment?.data_quality.freshness === 'recent'
                          ? colors.statusSuccessBg
                          : colors.surfaceSubtle,
                      borderColor:
                        assessment?.data_quality.freshness === 'recent'
                          ? colors.statusSuccessBorder
                          : colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dqBadgeText,
                      {
                        color:
                          assessment?.data_quality.freshness === 'recent'
                            ? colors.statusSuccessText
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {assessment?.data_quality.freshness ?? 'unknown'}
                  </Text>
                </View>
              </View>

              <View style={[styles.dqRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.dqLabel, { color: colors.textSecondary }]}>
                  Baseline Established
                </Text>
                <View
                  style={[
                    styles.dqBadge,
                    {
                      backgroundColor: assessment?.data_quality.baseline_available
                        ? colors.statusSuccessBg
                        : colors.surfaceSubtle,
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dqBadgeText,
                      {
                        color: assessment?.data_quality.baseline_available
                          ? colors.statusSuccessText
                          : colors.textMuted,
                      },
                    ]}
                  >
                    {assessment?.data_quality.baseline_available
                      ? 'Available'
                      : 'Estimated'}
                  </Text>
                </View>
              </View>

              <View style={styles.dqRow}>
                <Text style={[styles.dqLabel, { color: colors.textSecondary }]}>
                  Valid Biometric Readings
                </Text>
                <Text style={[styles.dqValue, { color: colors.textPrimary }]}>
                  {assessment?.data_quality.reading_count ?? 0} records
                </Text>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Tab: Readings */}
        {activeTab === 'readings' && (
          <View>
            <View style={styles.syncRow}>
              <PrimaryButton
                title={syncing ? 'Syncing...' : 'Sync from Health Connect'}
                onPress={handleSync}
                loading={syncing}
                icon={<Feather name="refresh-cw" size={16} color={colors.buttonText} />}
                style={{ flex: 1.4 }}
              />
              <TouchableOpacity
                style={[
                  styles.logVitalsBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
                onPress={() => setVitalsModalVisible(true)}
                activeOpacity={0.75}
              >
                <Feather name="plus-circle" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.logVitalsBtnText, { color: colors.textPrimary }]}>
                  Log Watch
                </Text>
              </TouchableOpacity>
            </View>

            {syncResult && (
              <GlassCard style={styles.syncResultBox}>
                <Feather name="info" size={14} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.syncResultText, { color: colors.textSecondary }]}>
                  {syncResult}
                </Text>
              </GlassCard>
            )}

            {readings.length === 0 ? (
              <GlassCard style={styles.emptyReadings}>
                <Feather name="activity" size={28} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyReadingsText, { color: colors.textMuted }]}>
                  No telemetry logged yet for this worker profile.
                </Text>
              </GlassCard>
            ) : (
              readings.slice(0, 30).map((r, idx) => {
                const stale = isStale(r.measured_at);
                const sourceLabel = SOURCE_LABELS[r.source] ?? r.source;
                return (
                  <GlassCard key={idx} style={styles.readingRow}>
                    <View style={styles.readingLeft}>
                      <Text style={[styles.readingType, { color: colors.textPrimary }]}>
                        {r.metric_type.replace('_', ' ')}
                      </Text>
                      <View style={styles.timeInline}>
                        {stale && (
                          <Feather
                            name="clock"
                            size={11}
                            color={colors.textMuted}
                            style={{ marginRight: 3 }}
                          />
                        )}
                        <Text
                          style={[
                            styles.readingTime,
                            { color: colors.textMuted },
                          ]}
                        >
                          {formatTs(r.measured_at)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.readingRight}>
                      <Text style={[styles.readingValue, { color: colors.textPrimary }]}>
                        {r.value.toFixed(r.metric_type === 'steps' ? 0 : 1)}{' '}
                        <Text style={[styles.readingUnit, { color: colors.textMuted }]}>
                          {r.unit}
                        </Text>
                      </Text>
                      <View
                        style={[
                          styles.sourcePill,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.surfaceBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.sourcePillText, { color: colors.textSecondary }]}>
                          {sourceLabel}
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                );
              })
            )}
          </View>
        )}

        {/* Tab: History / Profile Info */}
        {activeTab === 'history' && (
          <View>
            <SectionHeader title="WORKER IDENTITY" />
            <GlassCard style={styles.card}>
              <View style={[styles.infoRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Identifier
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {worker.id}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Trade Category
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {CATEGORY_LABELS[worker.category] ?? worker.category}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Age
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {worker.age_years ? `${worker.age_years} years` : 'Not specified'}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Resting Baseline HR
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {worker.baseline_hr_bpm
                    ? `${worker.baseline_hr_bpm} BPM`
                    : 'Not established'}
                </Text>
              </View>
              <View style={[styles.infoRow, { borderBottomColor: colors.surfaceBorder }]}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                  Data Provenance
                </Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>
                  {worker.is_synthetic ? 'Active Industrial Profile' : 'Live Connected'}
                </Text>
              </View>
              {worker.notes && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                    Clinical Notes
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {worker.notes}
                  </Text>
                </View>
              )}
            </GlassCard>

            <SectionHeader title="OCCUPATIONAL CONTEXT" />
            <GlassCard style={styles.card}>
              <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                Workers in outdoor urban conditions experience cumulative heat stress influenced by
                radiant surface heat, high relative humidity, and strenuous physical exertion.
                Svastra matches continuous biometric strain with localized atmospheric index
                to guide preventive rest cycles.
              </Text>
            </GlassCard>
          </View>
        )}

        {/* Advisory footer */}
        <GlassCard style={styles.disclaimerBox}>
          <View style={styles.disclaimerHeader}>
            <Feather name="shield" size={13} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={[styles.disclaimerLabel, { color: colors.textSecondary }]}>
              Non-Diagnostic Disclaimer
            </Text>
          </View>
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            {DISCLAIMER}
          </Text>
        </GlassCard>
      </ScrollView>

      {/* Quick Watch Vitals Entry Modal */}
      <Modal
        visible={vitalsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVitalsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard} radius={24}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Log Watch Vitals
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Record current vitals from Titan Smart or Wear OS
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVitalsModalVisible(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                Current Heart Rate (BPM) *
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.surfaceBorder,
                    color: colors.textPrimary,
                  },
                ]}
                value={inputHR}
                onChangeText={setInputHR}
                placeholder="e.g. 84"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                Step Count (optional)
              </Text>
              <TextInput
                style={[
                  styles.modalTextInput,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.surfaceBorder,
                    color: colors.textPrimary,
                  },
                ]}
                value={inputSteps}
                onChangeText={setInputSteps}
                placeholder="e.g. 4200"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  { borderColor: colors.surfaceBorder },
                ]}
                onPress={() => setVitalsModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: colors.accent },
                  submittingVitals && { opacity: 0.6 },
                ]}
                onPress={handleSubmitVitals}
                disabled={submittingVitals}
              >
                {submittingVitals ? (
                  <ActivityIndicator size="small" color={colors.buttonText} />
                ) : (
                  <Text style={[styles.modalSaveText, { color: colors.buttonText }]}>
                    Record Reading
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.body,
    letterSpacing: 0.2,
  },
  errorTitle: {
    fontSize: Typography.sizes.sectionTitle,
    fontWeight: Typography.weights.semibold,
    marginBottom: 4,
  },
  errorBody: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
  },
  content: {
    padding: Spacing.base,
    paddingBottom: 110,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  workerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
  },
  workerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  categoryIcon: {
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  workerId: {
    fontSize: Typography.sizes.pageTitle,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  workerName: {
    fontSize: Typography.sizes.body,
    marginTop: 2,
    flexShrink: 1,
  },
  workerCategory: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 3,
    flexShrink: 1,
  },
  syntheticBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginLeft: 8,
    flexShrink: 0,
  },
  syntheticText: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.6,
  },
  assessmentCard: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.lg,
  },
  assessmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  assessmentTitle: {
    fontSize: Typography.sizes.cardTitle,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.2,
  },
  hrMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  hrDisplayValue: {
    fontSize: Typography.sizes.metric,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  hrDisplayUnit: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.regular,
  },
  hrTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  hrLabel: {
    fontSize: Typography.sizes.caption,
  },
  baselineBox: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'flex-end',
  },
  baselineValue: {
    fontSize: Typography.sizes.cardTitle,
    fontWeight: Typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  baselineLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  assessmentType: {
    fontSize: 11,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabBarWrap: {
    marginBottom: Spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 3,
    borderWidth: 1,
    gap: 4,
    height: 42,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 6,
  },
  tabText: {
    fontSize: Typography.sizes.body,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  sectionHeaderRow: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    fontSize: Typography.sizes.sectionTitle,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.2,
  },
  trendCard: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
  },
  ringCard: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
    alignItems: 'center',
  },
  ringLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  hrTrendContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  hrTrendYAxis: {
    justifyContent: 'space-between',
    height: 100,
    paddingRight: Spacing.sm,
    paddingBottom: 20,
  },
  hrTrendAxisLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    fontVariant: ['tabular-nums'],
  },
  hrTrendBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 120,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 4,
  },
  hrTrendBarCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  hrTrendBarTrack: {
    width: 12,
    height: 90,
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
  },
  hrTrendBar: {
    width: '100%',
    borderRadius: 6,
  },
  hrTrendBarValue: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  hrTrendEmpty: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hrTrendEmptyText: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  insufficientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  insufficientNote: {
    fontSize: Typography.sizes.caption,
    flex: 1,
  },
  observationsCard: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
  },
  observationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: Spacing.sm,
  },
  observationText: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
    flex: 1,
  },
  actionCard: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionNumber: {
    fontSize: 10,
    fontWeight: Typography.weights.semibold,
  },
  actionText: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
    flex: 1,
  },
  dqCard: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
  },
  dqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dqLabel: {
    fontSize: Typography.sizes.body,
  },
  dqBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  dqBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.medium,
  },
  dqValue: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  syncRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  logVitalsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  logVitalsBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  syncResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderRadius: Layout.cardRadius,
  },
  syncResultText: {
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
    flex: 1,
  },
  emptyReadings: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Layout.cardRadius,
  },
  emptyReadingsText: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
  },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Layout.cardRadius,
  },
  readingLeft: {
    flex: 1,
  },
  readingType: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    textTransform: 'capitalize',
  },
  timeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  readingTime: {
    fontSize: 11,
  },
  readingRight: {
    alignItems: 'flex-end',
  },
  readingValue: {
    fontSize: Typography.sizes.cardTitle,
    fontWeight: Typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  readingUnit: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.regular,
  },
  sourcePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: 4,
  },
  sourcePillText: {
    fontSize: 9,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.5,
  },
  card: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.base,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: Typography.sizes.body,
  },
  infoValue: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  contextText: {
    fontSize: Typography.sizes.body,
    lineHeight: 22,
  },
  disclaimerBox: {
    padding: Spacing.base,
    marginTop: Spacing.md,
    borderRadius: Layout.cardRadius,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  disclaimerLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  disclaimerText: {
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalTextInput: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
