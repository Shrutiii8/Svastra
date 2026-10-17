/**
 * HeatGuard Twin — Onboarding / Consent Screen
 * Restyled with GlassCard, line icons in glass circles, and gradient pill button.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { setStorageItem, getStorageItem } from '../src/services/storage';
import {
  useTheme,
  Typography,
  Spacing,
  BorderRadius,
  Layout,
  DISCLAIMER,
} from '../src/constants/theme';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { GlassCircleIcon, FeatherIconName } from '../src/components/GlassCircleIcon';
import { NexoraLogo } from '../src/components/NexoraLogo';

interface InfoItem {
  icon: FeatherIconName;
  title: string;
  body: string;
}

const INFO_ITEMS: InfoItem[] = [
  {
    icon: 'heart',
    title: 'Health Measurements',
    body:
      'Svastra reads heart rate and step count from Android Health Connect. ' +
      'These are written by your wearable device or fitness app. ' +
      'Data is only read after you grant permission.',
  },
  {
    icon: 'thermometer',
    title: 'Environmental Data',
    body:
      'Weather conditions (temperature, humidity, wind speed) are fetched from ' +
      'Open-Meteo for regional environmental conditions in New Delhi, India. ' +
      'Your precise GPS location is not requested.',
  },
  {
    icon: 'lock',
    title: 'How Data Is Used',
    body:
      'Readings are sent to a secure backend server to generate a monitoring ' +
      'assessment. Assessments are rule-based and non-diagnostic. ' +
      'This is an illustrative monitoring tool, not a medical device.',
  },
  {
    icon: 'cpu',
    title: 'Workforce Digital Twins',
    body:
      'The platform models individual worker physiological profiles and heat ' +
      'exposure thresholds for proactive safety management.',
  },
  {
    icon: 'trash-2',
    title: 'Data Deletion',
    body:
      'You can clear all stored data from the Profile screen at any time. ' +
      'Revoking Health Connect permissions stops future data collection.',
  },
];

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const [accepted, setAccepted] = useState(false);

  async function handleConsent() {
    if (!accepted) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Please tick the consent checkbox above before continuing.');
      } else {
        Alert.alert(
          'Consent Required',
          'Please tick the checkbox to confirm you have read and agree to the data collection information.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    try {
      await setStorageItem('hg_consent_v1', 'granted');
      const token = await getStorageItem('hg_auth_token');
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    } catch (err) {
      console.warn('Could not persist consent:', err);
      router.replace('/login');
    }
  }

  return (
    <ScreenBackground style={styles.container}>
      {/* Header with Nexora Brand Mark */}
      <View style={styles.header}>
        <View
          style={[
            styles.logoBadge,
            {
              backgroundColor: isDark
                ? 'rgba(37, 99, 235, 0.16)'
                : 'rgba(37, 99, 235, 0.08)',
              borderColor: colors.surfaceBorder,
            },
          ]}
        >
          <NexoraLogo size={44} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Svastra
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Monitor vital physiological indicators and ambient thermal exposure with clarity.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {INFO_ITEMS.map((item, idx) => (
          <GlassCard key={idx} style={styles.infoCard}>
            <GlassCircleIcon
              name={item.icon}
              size={40}
              iconSize={18}
              color={colors.textSecondary}
              bg={colors.surfaceSubtle}
              borderColor={colors.surfaceBorder}
              style={styles.cardIcon}
            />
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text style={[styles.infoBody, { color: colors.textSecondary }]}>
                {item.body}
              </Text>
            </View>
          </GlassCard>
        ))}

        {/* Disclaimer card - restrained neutral styling */}
        <GlassCard style={styles.disclaimerBox}>
          <View style={styles.disclaimerHeader}>
            <Feather
              name="info"
              size={15}
              color={colors.textSecondary}
              style={styles.disclaimerIcon}
            />
            <Text style={[styles.disclaimerLabel, { color: colors.textSecondary }]}>
              Important Disclaimer
            </Text>
          </View>
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            {DISCLAIMER}
          </Text>
        </GlassCard>

        {/* Consent checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
          activeOpacity={0.75}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: accepted ? colors.accent : colors.surfaceBorder,
                backgroundColor: accepted ? colors.accent : 'transparent',
              },
            ]}
          >
            {accepted && <Feather name="check" size={13} color={colors.buttonText} />}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>
            I have read the data collection information above and consent to{' '}
            <Text style={{ fontWeight: Typography.weights.semibold, color: colors.textPrimary }}>
              heart rate and step data
            </Text>{' '}
            being processed by Svastra for exposure monitoring.
          </Text>
        </TouchableOpacity>

        <Text style={[styles.legalNote, { color: colors.textMuted }]}>
          This consent does not constitute compliance with healthcare privacy laws. A formal legal
          and compliance assessment is required before any production or clinical deployment.
        </Text>

        <PrimaryButton
          title="Get Started with Svastra"
          onPress={handleConsent}
          disabled={!accepted}
          style={styles.continueButton}
        />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.pageTitle,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 380,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 48,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  cardIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: Typography.sizes.cardTitle,
    fontWeight: Typography.weights.semibold,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  infoBody: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
  },
  disclaimerBox: {
    padding: Layout.cardPadding,
    borderRadius: Layout.cardRadius,
    marginBottom: Spacing.lg,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  disclaimerIcon: {
    marginRight: 6,
  },
  disclaimerLabel: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.1,
  },
  disclaimerText: {
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    marginRight: Spacing.md,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: Typography.sizes.body,
    lineHeight: 20,
  },
  legalNote: {
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
    marginBottom: Spacing.xl,
  },
  continueButton: {
    marginTop: Spacing.xs,
  },
});
