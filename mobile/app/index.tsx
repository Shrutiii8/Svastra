/**
 * HeatGuard Twin — Welcome / Splash Screen
 * Dynamic glassmorphic hero presentation with ambient lighting.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getStorageItem } from '../src/services/storage';
import { setAuthToken } from '../src/services/api';
import { useTheme, Typography, Spacing, BorderRadius, Shadows } from '../src/constants/theme';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { NexoraLogo } from '../src/components/NexoraLogo';

export default function IndexScreen() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    async function checkConsentAndAuth() {
      try {
        const consent = await getStorageItem('hg_consent_v1');
        const token = await getStorageItem('hg_auth_token');

        // Smooth splash delay
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 800));

        if (consent !== 'granted') {
          router.replace('/onboarding');
          return;
        }

        if (token) {
          setAuthToken(token);
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    }
    checkConsentAndAuth();
  }, []);

  return (
    <ScreenBackground style={styles.container}>
      {/* Hero Nexora Brand Mark */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isDark
              ? 'rgba(37, 99, 235, 0.16)'
              : 'rgba(37, 99, 235, 0.08)',
            borderColor: colors.surfaceBorder,
          },
          Shadows.subtle,
        ]}
      >
        <NexoraLogo size={58} color={colors.accent} />
      </View>

      {/* Brand Title */}
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Svastra
      </Text>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Intelligent wearable vitals & workforce{'\n'}heat strain monitoring
      </Text>

      <ActivityIndicator
        color={colors.accent}
        style={styles.loader}
        size="small"
      />

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        Svastra · Illustrative non-diagnostic monitoring platform
      </Text>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  iconContainer: {
    width: 92,
    height: 92,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: BorderRadius.full,
    width: 30,
    height: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.sizes.pageTitle,
    fontWeight: Typography.weights.semibold,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing['3xl'],
  },
  loader: {
    marginBottom: Spacing['2xl'],
  },
  disclaimer: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    position: 'absolute',
    bottom: Spacing['2xl'],
  },
});
