/**
 * HeatGuard Twin — Tabs Navigation Layout
 * Floating glass bar detached from screen edge, max-width 480px, centered on desktop.
 * 24px Feather icons, 12px labels, active indicator pill, and neutral slate inactive items.
 */
import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/constants/theme';
import { NexoraLogo } from '../../src/components/NexoraLogo';

interface TabConfig {
  name: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
}

const TABS: TabConfig[] = [
  {
    name: 'index',
    title: 'Dashboard',
    icon: 'home',
  },
  {
    name: 'workers',
    title: 'Workers',
    icon: 'users',
  },
  {
    name: 'alerts',
    title: 'Alerts',
    icon: 'activity',
  },
  {
    name: 'profile',
    title: 'Profile',
    icon: 'user',
  },
];

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomOffset = Platform.select({
    web: 24,
    default: Math.max(insets.bottom + 12, 16),
  });

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgPrimary,
          height: Platform.OS === 'ios' ? 96 : 72,
        },
        headerShadowVisible: false,
        headerTitle: () => (
          <View style={styles.headerLeft}>
            <NexoraLogo size={26} color={colors.textPrimary} style={styles.logo} />
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
              Svastra
            </Text>
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(20, 35, 75, 0.05)',
                  borderColor: colors.surfaceBorder,
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Notifications"
            >
              <Feather name="bell" size={16} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(20, 35, 75, 0.05)',
                  borderColor: colors.surfaceBorder,
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Menu"
            >
              <Feather name="sliders" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ),
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomOffset,
          left: 16,
          right: 16,
          maxWidth: 480,
          marginHorizontal: 'auto',
          alignSelf: 'center',
          height: 64,
          borderRadius: 32,
          backgroundColor: isDark
            ? 'rgba(11, 20, 48, 0.88)'
            : 'rgba(255, 255, 255, 0.94)',
          borderColor: colors.surfaceBorder,
          borderWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 6 : 8,
          paddingTop: 8,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: isDark ? 'blur(24px) saturate(140%)' : undefined,
                WebkitBackdropFilter: isDark ? 'blur(24px) saturate(140%)' : undefined,
                boxShadow: isDark
                  ? '0 12px 36px rgba(0, 0, 0, 0.45)'
                  : '0 8px 28px rgba(16, 28, 60, 0.08)',
                width: 'calc(100% - 32px)',
                transform: 'translateX(-50%)',
                left: '50%',
              } as any)
            : {
                shadowColor: isDark ? '#000000' : 'rgba(16, 28, 60, 0.15)',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.35 : 0.08,
                shadowRadius: 16,
                elevation: 6,
              }),
        },
        tabBarActiveTintColor: isDark ? '#60A5FA' : '#2563EB',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.1,
          marginTop: 2,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <View style={styles.tabIconWrapper}>
                {focused && (
                  <View
                    style={[
                      styles.activePill,
                      { backgroundColor: isDark ? '#60A5FA' : '#2563EB' },
                    ]}
                  />
                )}
                <Feather
                  name={tab.icon}
                  size={22}
                  color={color}
                  style={{ opacity: focused ? 1 : 0.65 }}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    marginRight: 4,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 30,
    width: 36,
  },
  activePill: {
    position: 'absolute',
    top: -6,
    width: 14,
    height: 2.5,
    borderRadius: 2,
  },
});
