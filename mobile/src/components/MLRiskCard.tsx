/**
 * HeatGuard Twin — ML Risk Intelligence Card
 * Displays machine learning classification, confidence score, and class probabilities.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MLPrediction } from '../types';
import { useTheme, Typography, Spacing, BorderRadius } from '../constants/theme';
import { GlassCard } from './GlassCard';

interface Props {
  prediction?: MLPrediction | null;
  assessmentType?: string;
}

export function MLRiskCard({ prediction, assessmentType }: Props) {
  const { colors, isDark } = useTheme();

  if (!prediction) {
    return (
      <GlassCard style={styles.emptyContainer} radius={20}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(37, 99, 235, 0.2)',
                },
              ]}
            >
              <Feather name="cpu" size={16} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                ML Heat-Stress Classifier
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Standby mode · Awaiting fresh biometric readings
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.surfaceBorder },
            ]}
          >
            <Text style={[styles.statusPillText, { color: colors.textMuted }]}>
              {assessmentType === 'rule_based_prototype' ? 'Rule Engine Active' : 'Standby'}
            </Text>
          </View>
        </View>
      </GlassCard>
    );
  }

  const { risk_level, risk_label, confidence, probabilities, source, model_name, disclaimer } =
    prediction;

  // Map risk level to semantic theme styling
  const statusConfig = {
    0: {
      title: 'No Unusual Pattern',
      desc: 'Normal physiological range detected.',
      bg: colors.statusSuccessBg,
      border: colors.statusSuccessBorder,
      text: colors.statusSuccessText,
      dot: colors.statusSuccessDot,
      icon: 'check-circle' as const,
    },
    1: {
      title: 'Elevated Strain — Monitor',
      desc: 'Heart rate elevated above worker baseline in heat.',
      bg: colors.statusWarningBg,
      border: colors.statusWarningBorder,
      text: colors.statusWarningText,
      dot: colors.statusWarningDot,
      icon: 'alert-triangle' as const,
    },
    2: {
      title: 'Supervisor Review Required',
      desc: 'Significant biometric anomaly under ambient stress.',
      bg: colors.statusDangerBg,
      border: colors.statusDangerBorder,
      text: colors.statusDangerText,
      dot: colors.statusDangerDot,
      icon: 'alert-circle' as const,
    },
  }[risk_level] ?? {
    title: risk_label,
    desc: 'Automated ML inference assessment.',
    bg: colors.statusMutedBg,
    border: colors.statusMutedBorder,
    text: colors.textSecondary,
    dot: colors.textMuted,
    icon: 'info' as const,
  };

  const confidencePct = Math.round(confidence * 100);
  const probNormal = Math.round((probabilities?.['no_unusual_pattern'] ?? 0) * 100);
  const probMonitor = Math.round((probabilities?.['monitor'] ?? 0) * 100);
  const probReview = Math.round((probabilities?.['supervisor_review'] ?? 0) * 100);

  const isLocal = source === 'ml_local';

  return (
    <GlassCard style={styles.card} radius={22}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(37, 99, 235, 0.25)',
              },
            ]}
          >
            <Feather name="cpu" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              ML Heat-Stress Classifier
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {model_name}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.modePill,
            {
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(37, 99, 235, 0.08)',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(37, 99, 235, 0.2)',
            },
          ]}
        >
          <View
            style={[
              styles.modeDot,
              { backgroundColor: colors.statusSuccessDot },
            ]}
          />
          <Text style={[styles.modeText, { color: colors.accent }]}>
            {isLocal ? 'IN-PROCESS ML' : 'ML MICROSERVICE'}
          </Text>
        </View>
      </View>

      {/* Main Prediction Banner */}
      <View
        style={[
          styles.predictionBanner,
          {
            backgroundColor: statusConfig.bg,
            borderColor: statusConfig.border,
          },
        ]}
      >
        <View style={styles.bannerLeft}>
          <Feather name={statusConfig.icon} size={20} color={statusConfig.text} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: statusConfig.text }]}>
              {statusConfig.title}
            </Text>
            <Text style={[styles.bannerDesc, { color: colors.textSecondary }]}>
              {statusConfig.desc}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.confidenceChip,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.6)',
              borderColor: statusConfig.border,
            },
          ]}
        >
          <Text style={[styles.confidenceVal, { color: colors.textPrimary }]}>
            {confidencePct}%
          </Text>
          <Text style={[styles.confidenceLabel, { color: colors.textMuted }]}>
            Confidence
          </Text>
        </View>
      </View>

      {/* Class Probabilities Distribution */}
      <View style={styles.probSection}>
        <View style={styles.probHeaderRow}>
          <Text style={[styles.probSectionLabel, { color: colors.textSecondary }]}>
            CLASS PROBABILITY DISTRIBUTION
          </Text>
          <Text style={[styles.probSectionValue, { color: colors.textMuted }]}>
            Softmax output
          </Text>
        </View>

        {/* 3 Probability Bars */}
        <View style={styles.probRow}>
          <View style={styles.probItem}>
            <View style={styles.probItemLabelRow}>
              <Text style={[styles.probItemLabel, { color: colors.textMuted }]}>
                Normal
              </Text>
              <Text style={[styles.probItemPct, { color: colors.textPrimary }]}>
                {probNormal}%
              </Text>
            </View>
            <View
              style={[
                styles.probBarTrack,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
              ]}
            >
              <View
                style={[
                  styles.probBarFill,
                  {
                    width: `${Math.max(4, probNormal)}%`,
                    backgroundColor: colors.statusSuccessDot,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.probItem}>
            <View style={styles.probItemLabelRow}>
              <Text style={[styles.probItemLabel, { color: colors.textMuted }]}>
                Monitor
              </Text>
              <Text style={[styles.probItemPct, { color: colors.textPrimary }]}>
                {probMonitor}%
              </Text>
            </View>
            <View
              style={[
                styles.probBarTrack,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
              ]}
            >
              <View
                style={[
                  styles.probBarFill,
                  {
                    width: `${Math.max(4, probMonitor)}%`,
                    backgroundColor: colors.statusWarningDot,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.probItem}>
            <View style={styles.probItemLabelRow}>
              <Text style={[styles.probItemLabel, { color: colors.textMuted }]}>
                Supervisor
              </Text>
              <Text style={[styles.probItemPct, { color: colors.textPrimary }]}>
                {probReview}%
              </Text>
            </View>
            <View
              style={[
                styles.probBarTrack,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
              ]}
            >
              <View
                style={[
                  styles.probBarFill,
                  {
                    width: `${Math.max(4, probReview)}%`,
                    backgroundColor: colors.statusDangerDot,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Non-Diagnostic Disclaimer */}
      <View
        style={[
          styles.disclaimerRow,
          {
            borderTopColor: colors.surfaceBorder,
          },
        ]}
      >
        <Feather name="shield" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          {disclaimer}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  emptyContainer: {
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: Typography.sizes.caption,
    marginTop: 1,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  modeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  predictionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  bannerTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    marginBottom: 2,
  },
  bannerDesc: {
    fontSize: Typography.sizes.caption,
    lineHeight: 16,
  },
  confidenceChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  confidenceVal: {
    fontSize: Typography.sizes.sectionTitle,
    fontWeight: Typography.weights.bold,
    lineHeight: 22,
  },
  confidenceLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  probSection: {
    marginBottom: Spacing.md,
  },
  probHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  probSectionLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.6,
  },
  probSectionValue: {
    fontSize: 10,
  },
  probRow: {
    flexDirection: 'row',
    gap: 8,
  },
  probItem: {
    flex: 1,
  },
  probItemLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  probItemLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  probItemPct: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
  },
  probBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  probBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disclaimerText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
});
