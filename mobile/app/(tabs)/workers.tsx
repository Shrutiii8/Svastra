/**
 * HeatGuard Twin — Workers Tab
 * Searchable, filterable list of outdoor workers with restrained minimalist styling.
 * Width-constrained container (720px mobile / 1100px desktop 2-column grid),
 * 28px page title, 48px glass pill search, 36px filter chips, and clean card rhythm.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fetchWorkers, fetchWorkerAssessment, fetchWorkerReadings } from '../../src/services/api';
import { Worker, AssessmentStatus, WorkerCategory } from '../../src/types';
import {
  useTheme,
  BorderRadius,
  CATEGORY_LABELS,
} from '../../src/constants/theme';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { WorkerCard } from '../../src/components/WorkerCard';
import { GlassCircleIcon } from '../../src/components/GlassCircleIcon';

const CATEGORIES: Array<WorkerCategory | 'all'> = [
  'all',
  'construction',
  'delivery',
  'street_vendor',
  'traffic_police',
];

const CATEGORY_FILTER_LABELS: Record<string, string> = {
  all: 'All',
  ...CATEGORY_LABELS,
};

interface WorkerWithStatus {
  worker: Worker;
  latestHr?: number | null;
  latestHrTime?: string | null;
  assessmentStatus?: AssessmentStatus;
  source?: string;
}

export default function WorkersScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [workerData, setWorkerData] = useState<WorkerWithStatus[]>([]);
  const [filtered, setFiltered] = useState<WorkerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<WorkerCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchWorkers({ page_size: 50 });
      const workers = res.workers;

      const enriched = await Promise.all(
        workers.map(async (w): Promise<WorkerWithStatus> => {
          try {
            const [readingsRes, assessment] = await Promise.allSettled([
              fetchWorkerReadings(w.id, { metric_type: 'heart_rate', page_size: 1 }),
              fetchWorkerAssessment(w.id),
            ]);

            const latestReading =
              readingsRes.status === 'fulfilled' &&
              readingsRes.value.readings.length > 0
                ? readingsRes.value.readings[0]
                : null;

            return {
              worker: w,
              latestHr: latestReading?.value ?? null,
              latestHrTime: latestReading?.measured_at ?? null,
              assessmentStatus:
                assessment.status === 'fulfilled'
                  ? assessment.value.status
                  : undefined,
              source: latestReading?.source ?? 'synthetic',
            };
          } catch {
            return { worker: w };
          }
        })
      );

      setWorkerData(enriched);
    } catch {
      setError('Could not retrieve worker directory. Check backend connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let result = workerData;
    if (selectedCat !== 'all') {
      result = result.filter((w) => w.worker.category === selectedCat);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (w) =>
          w.worker.id.toLowerCase().includes(q) ||
          w.worker.display_name.toLowerCase().includes(q) ||
          w.worker.category.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [workerData, search, selectedCat]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <ScreenBackground style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading worker directory…
        </Text>
      </ScreenBackground>
    );
  }

  const containerPadding = isDesktop ? 32 : 20;
  const maxContainerWidth = isDesktop ? 1100 : 720;

  return (
    <ScreenBackground style={styles.screen}>
      <View style={[styles.constrainedContainer, { maxWidth: maxContainerWidth, paddingHorizontal: containerPadding }]}>
        {/* Confident Page Title with Generous Top Spacing */}
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
            Workers
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Outdoor personnel roster and real-time biometric strain
          </Text>
        </View>

        {/* 48px Glass Pill Search Field */}
        <View style={styles.searchWrap}>
          <GlassCard style={styles.searchBar} radius={24} highlight={false}>
            <Feather
              name="search"
              size={20}
              color={colors.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search by worker ID or trade category…"
              placeholderTextColor={colors.inputPlaceholder}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              accessibilityLabel="Search workers"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearBtn}
              >
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>

        {/* 36px Horizontally Scrollable Filter Chips */}
        <View style={styles.filterRow}>
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            keyExtractor={(cat) => cat}
            renderItem={({ item: cat }) => {
              const active = selectedCat === cat;
              const activeBg = isDark ? 'rgba(255, 255, 255, 0.14)' : '#131B2E';
              const activeBorder = isDark ? 'rgba(255, 255, 255, 0.24)' : '#1E293B';
              const activeText = '#F5F7FA';

              return (
                <TouchableOpacity
                  onPress={() => setSelectedCat(cat)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? activeBg : colors.surface,
                      borderColor: active ? activeBorder : colors.surfaceBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: active ? activeText : colors.textSecondary,
                        fontWeight: active ? '600' : '400',
                      },
                    ]}
                  >
                    {CATEGORY_FILTER_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {error && (
          <GlassCard style={styles.errorBanner} radius={14}>
            <Feather name="alert-circle" size={16} color={colors.statusDangerText} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: colors.statusDangerText }]}>
              {error}
            </Text>
          </GlassCard>
        )}

        {/* Responsive Workers Grid (1-column on mobile, 2-column on desktop) */}
        <FlatList
          key={isDesktop ? 'grid-2' : 'list-1'}
          data={filtered}
          numColumns={isDesktop ? 2 : 1}
          columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
          keyExtractor={(item) => item.worker.id}
          renderItem={({ item }) => (
            <View style={isDesktop ? styles.gridItem : styles.listItem}>
              <WorkerCard
                worker={item.worker}
                latestHr={item.latestHr}
                latestHrTime={item.latestHrTime}
                assessmentStatus={item.assessmentStatus}
                source={item.source}
                onPress={() => router.push(`/worker/${item.worker.id}`)}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <GlassCard style={styles.emptyContainer} radius={20}>
              <GlassCircleIcon
                name="users"
                size={48}
                iconSize={20}
                color={colors.textMuted}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No workers found
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                {search
                  ? 'No profiles match your search criteria. Try a different query.'
                  : 'No registered workers in this specific trade category.'}
              </Text>
            </GlassCard>
          }
          ListFooterComponent={
            filtered.length > 0 ? (
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Showing {filtered.length} of {workerData.length} workers · Svastra Synthetic Directory
              </Text>
            ) : null
          }
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  constrainedContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
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
    paddingTop: 24,
    paddingBottom: 16,
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
  searchWrap: {
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    paddingVertical: 0,
    outlineStyle: 'none' as any,
  },
  clearBtn: {
    padding: 4,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterList: {
    gap: 10,
    paddingRight: 16,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 14,
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
  columnWrapper: {
    gap: 16,
    alignItems: 'stretch',
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
  },
  listItem: {
    width: '100%',
  },
  listContent: {
    paddingBottom: 140, // Clearance for floating bottom nav
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyIcon: {
    marginBottom: 14,
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
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '400',
    paddingTop: 16,
    paddingBottom: 24,
  },
});
