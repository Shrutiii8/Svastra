/**
 * HeatGuard Twin — Root Layout Navigator
 * Connects dynamic theme tokens to Stack router and status bar.
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/constants/theme';

export default function RootLayout() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Svastra';
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          title: 'Svastra',
          headerStyle: { backgroundColor: colors.bgPrimary },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 17,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bgPrimary },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Svastra' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, title: 'Svastra' }} />
        <Stack.Screen name="login" options={{ headerShown: false, title: 'Sign In · Svastra' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Svastra' }} />
        <Stack.Screen
          name="worker/[id]"
          options={{
            title: 'Worker Twin · Svastra',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: colors.bgPrimary },
            headerTintColor: colors.textPrimary,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
