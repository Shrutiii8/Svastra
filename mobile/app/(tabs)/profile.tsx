/**
 * HeatGuard Twin — Profile / Settings Tab
 * Restrained minimalist configuration with width-constrained container (720px),
 * 28px page title, 20px section headers, theme selector, and system diagnostics.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getStorageItem, setStorageItem, deleteStorageItem } from '../../src/services/storage';
import {
  checkHealth,
  fetchDemoStatus,
  resetDemo,
  fetchCurrentUser,
  logoutUser,
  setAuthToken,
  updateCurrentUser,
  ApiError,
} from '../../src/services/api';
import { User } from '../../src/types';
import {
  checkHealthConnectAvailability,
  requestHealthConnectPermissions,
  HealthConnectIntegration,
} from '../../src/services/healthConnect';
import {
  useTheme,
  BorderRadius,
  DISCLAIMER,
  APP_VERSION,
} from '../../src/constants/theme';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ThemeToggle } from '../../src/components/ThemeToggle';
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

function InfoRow({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.surfaceBorder }]}>
      <View style={styles.infoLabelGroup}>
        {icon && <Feather name={icon} size={15} color={colors.textMuted} style={styles.infoIcon} />}
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text
        style={[styles.infoValue, { color: valueColor ?? colors.textPrimary }]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [hcIntegration, setHcIntegration] =
    useState<HealthConnectIntegration | null>(null);
  const [backendStatus, setBackendStatus] = useState<string>('checking…');
  const [backendDb, setBackendDb] = useState<string>('checking…');
  const [demoWorkerCount, setDemoWorkerCount] = useState<number>(0);
  const [demoReadingCount, setDemoReadingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  // User Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('worker');
  const [savingUser, setSavingUser] = useState(false);

  const loadUser = useCallback(async () => {
    setAuthLoading(true);
    try {
      // 1. Try local cache first for instant render
      const cached = await getStorageItem('hg_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {}
      }

      // 2. Fetch fresh user details from backend if token exists
      const token = await getStorageItem('hg_auth_token');
      if (token) {
        setAuthToken(token);
        const freshUser = await fetchCurrentUser();
        setUser(freshUser);
        await setStorageItem('hg_user', JSON.stringify(freshUser));
      } else {
        setUser(null);
      }
    } catch {
      // Retain cached user if offline or network unavailable
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [hcStatus, healthRes, demoRes] = await Promise.allSettled([
        checkHealthConnectAvailability(),
        checkHealth(),
        fetchDemoStatus(),
      ]);

      if (hcStatus.status === 'fulfilled') {
        setHcIntegration(hcStatus.value);
      }

      if (healthRes.status === 'fulfilled') {
        setBackendStatus(healthRes.value.status === 'ok' ? 'Connected' : 'Error');
        setBackendDb(healthRes.value.database === 'ok' ? 'Available' : 'Unavailable');
      } else {
        setBackendStatus('Unreachable');
        setBackendDb('—');
      }

      if (demoRes.status === 'fulfilled') {
        setDemoWorkerCount(demoRes.value.worker_count);
        setDemoReadingCount(demoRes.value.reading_count);
      }
    } finally {
      setLoading(false);
    }
    await loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your Svastra account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
            } catch {}
            await deleteStorageItem('hg_auth_token');
            await deleteStorageItem('hg_user');
            setAuthToken(null);
            setUser(null);
            router.replace('/login');
          },
        },
      ]
    );
  }

  function openEditModal() {
    setEditName(user?.full_name || '');
    setEditRole(user?.role || 'worker');
    setEditModalVisible(true);
  }

  async function handleSaveProfile() {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name.');
      return;
    }
    setSavingUser(true);
    try {
      const updated = await updateCurrentUser({
        full_name: editName.trim(),
        role: editRole,
      });
      setUser(updated);
      await setStorageItem('hg_user', JSON.stringify(updated));
      setEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.');
    } catch {
      Alert.alert('Update Failed', 'Unable to save profile changes. Please verify backend connection.');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleRequestPermissions() {
    const result = await requestHealthConnectPermissions();
    Alert.alert(
      'Permission Result',
      `Granted: ${result.granted.length}\nDenied: ${result.denied.length}\n\n` +
        (result.denied.length > 0
          ? 'Some permissions were denied. You can grant them in Android Settings > Health Connect.'
          : 'All requested permissions granted.'),
      [{ text: 'OK', onPress: loadStatus }]
    );
  }

  async function handleDemoReset() {
    Alert.alert(
      'Reset Telemetry Environment',
      'This will refresh workforce telemetry records and restore initial profiles. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              const result = await resetDemo();
              Alert.alert(
                'Reset Complete',
                `${result.message}\nWorkers created: ${result.worker_count}`,
                [{ text: 'OK', onPress: loadStatus }]
              );
            } catch (err: any) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : err?.message || 'Verify backend connectivity.';
              Alert.alert('Error', `Reset failed: ${message}`);
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }

  async function handleClearConsent() {
    Alert.alert(
      'Clear Consent & Cache',
      'This will delete your stored consent credentials and return to the onboarding screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Consent',
          style: 'destructive',
          onPress: async () => {
            await deleteStorageItem('hg_consent_v1');
            router.replace('/onboarding');
          },
        },
      ]
    );
  }

  const hcStatusLabel = () => {
    if (!hcIntegration) return 'Detecting…';
    switch (hcIntegration.status) {
      case 'ready':
        return 'Ready & Connected';
      case 'available':
        return 'Available (Grant Required)';
      case 'expo_go':
        return 'Active (Wearable Sensor Bridge)';
      case 'not_installed':
        return 'Service Not Installed';
      case 'permission_denied':
        return 'Permissions Denied';
      case 'unavailable':
        return 'Android Only';
    }
  };

  const hcStatusColor = () => {
    if (!hcIntegration) return colors.textMuted;
    switch (hcIntegration.status) {
      case 'ready':
      case 'expo_go':
        return colors.statusSuccessText;
      case 'available':
        return colors.statusWarningText;
      case 'permission_denied':
        return colors.statusDangerText;
      default:
        return colors.textMuted;
    }
  };

  const containerPadding = isDesktop ? 32 : 20;

  return (
    <ScreenBackground style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: 720,
            paddingHorizontal: containerPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Confident Page Title with Generous Top Spacing */}
        <View style={styles.titleSection}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
            Profile
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Application appearance, wearable sync, and telemetry diagnostics
          </Text>
        </View>

        {/* 1. Account & Identity */}
        <SectionHeader title="Account & Identity" />
        {user ? (
          <GlassCard style={styles.card} radius={20}>
            <View style={styles.userHeaderRow}>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(37, 99, 235, 0.2)'
                      : 'rgba(37, 99, 235, 0.12)',
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.accent }]}>
                  {(user.full_name || user.email || 'S')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.userTitleGroup}>
                <View style={styles.userNameBadgeRow}>
                  <Text style={[styles.userNameText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {user.full_name || 'Svastra Member'}
                  </Text>
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: isDark
                          ? 'rgba(56, 189, 248, 0.16)'
                          : 'rgba(14, 165, 233, 0.12)',
                        borderColor: isDark ? '#0284c7' : '#38bdf8',
                      },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: colors.accent }]}>
                      {user.role.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.userEmailText, { color: colors.textSecondary }]}>
                  {user.email}
                </Text>
              </View>
            </View>

            {/* Email Verified Notice Badge */}
            <View
              style={[
                styles.verifiedBanner,
                {
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  borderColor: 'rgba(16, 185, 129, 0.25)',
                },
              ]}
            >
              <Feather name="check-circle" size={14} color="#10b981" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#34d399', fontWeight: '500' }}>
                Email Verified
              </Text>
            </View>

            <View style={styles.infoList}>
              <InfoRow
                label="Registered Email"
                value={user.email}
                icon="mail"
              />
              <InfoRow
                label="Assigned Role"
                value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                icon="briefcase"
              />
              <InfoRow
                label="Account Status"
                value={user.is_active ? 'Active' : 'Inactive'}
                valueColor={user.is_active ? colors.statusSuccessText : colors.statusDangerText}
                icon="shield"
              />
              {user.last_login_at && (
                <InfoRow
                  label="Last Login"
                  value={new Date(user.last_login_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  icon="clock"
                />
              )}
              {user.created_at && (
                <InfoRow
                  label="Member Since"
                  value={new Date(user.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  icon="calendar"
                />
              )}
            </View>

            <View style={styles.userActionsRow}>
              <TouchableOpacity
                style={[
                  styles.profileActionButton,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
                onPress={openEditModal}
                activeOpacity={0.75}
              >
                <Feather name="edit-2" size={14} color={colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.profileActionButtonText, { color: colors.textPrimary }]}>
                  Edit Profile
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profileActionButton,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                  },
                ]}
                onPress={handleSignOut}
                activeOpacity={0.75}
              >
                <Feather name="log-out" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={[styles.profileActionButtonText, { color: '#ef4444' }]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.card} radius={20}>
            <View style={styles.cardTitleRow}>
              <GlassCircleIcon
                name="user-check"
                size={36}
                iconSize={16}
                color={colors.accent}
                bg={colors.surfaceSubtle}
                borderColor={colors.surfaceBorder}
                style={styles.cardIcon}
              />
              <View style={styles.cardTitleGroup}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  Guest Session
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Sign in with email OTP to personalize your worker twin profile
                </Text>
              </View>
            </View>

            <PrimaryButton
              title="Sign In with Email OTP"
              onPress={() => router.push('/login')}
              icon={<Feather name="log-in" size={16} color={colors.buttonText} />}
              style={{ marginTop: 14 }}
            />
          </GlassCard>
        )}

        {/* 2. Theme Configuration */}
        <SectionHeader title="Appearance" />
        <GlassCard style={styles.card} radius={20}>
          <View style={styles.cardTitleRow}>
            <GlassCircleIcon
              name="moon"
              size={36}
              iconSize={16}
              color={colors.accent}
              bg={colors.surfaceSubtle}
              borderColor={colors.surfaceBorder}
              style={styles.cardIcon}
            />
            <View style={styles.cardTitleGroup}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Theme
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Select Dark or Light theme
              </Text>
            </View>
          </View>
          <ThemeToggle />
        </GlassCard>

        {/* 2. Wearable & Health Connect */}
        <SectionHeader title="Wearable Integration" />
        <GlassCard style={styles.card} radius={20}>
          <View style={styles.cardTitleRow}>
            <GlassCircleIcon
              name="activity"
              size={36}
              iconSize={16}
              color={colors.textSecondary}
              bg={colors.surfaceSubtle}
              borderColor={colors.surfaceBorder}
              style={styles.cardIcon}
            />
            <View style={styles.cardTitleGroup}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Android Health Connect
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Syncs heart rate and cadence from Titan Smart or Wear OS
              </Text>
            </View>
          </View>

          <View style={styles.infoList}>
            <InfoRow
              label="Integration Status"
              value={hcStatusLabel()}
              valueColor={hcStatusColor()}
              icon="shield"
            />
            <InfoRow
              label="Permissions Granted"
              value={
                hcIntegration?.grantedPermissions.length
                  ? `${hcIntegration.grantedPermissions.length} Active`
                  : 'None'
              }
              icon="check-circle"
            />
          </View>

          {hcIntegration?.status === 'available' && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#131B2E',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.20)' : '#1E293B',
                },
              ]}
              onPress={handleRequestPermissions}
              activeOpacity={0.8}
            >
              <Feather name="key" size={14} color="#F5F7FA" style={styles.btnIcon} />
              <Text style={[styles.actionButtonText, { color: '#F5F7FA' }]}>
                Grant Health Connect Permissions
              </Text>
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* 3. Diagnostics */}
        <SectionHeader title="Diagnostics" />
        <GlassCard style={styles.card} radius={20}>
          <View style={styles.infoList}>
            <InfoRow
              label="Active Profiles"
              value={`${demoWorkerCount} Workers`}
              icon="users"
            />
            <InfoRow
              label="Telemetry Records"
              value={`${demoReadingCount} Readings`}
              icon="bar-chart-2"
            />
            <InfoRow
              label="Client Version"
              value={`v${APP_VERSION}`}
              icon="code"
            />
          </View>
        </GlassCard>

        {/* 4. Data Controls */}
        <SectionHeader title="Data Controls" />
        <GlassCard style={styles.card} radius={20}>
          <TouchableOpacity
            style={[
              styles.controlRow,
              { borderBottomColor: colors.surfaceBorder },
            ]}
            onPress={handleDemoReset}
            disabled={resetting}
            activeOpacity={0.7}
          >
            <View style={styles.controlLeft}>
              <Feather name="refresh-cw" size={16} color={colors.accent} style={styles.controlIcon} />
              <View>
                <Text style={[styles.controlTitle, { color: colors.textPrimary }]}>
                  Re-Seed System Data
                </Text>
                <Text style={[styles.controlSub, { color: colors.textMuted }]}>
                  Reset telemetry records to initial factory baseline
                </Text>
              </View>
            </View>
            {resetting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlRowLast}
            onPress={handleClearConsent}
            activeOpacity={0.7}
          >
            <View style={styles.controlLeft}>
              <Feather name="shield-off" size={16} color={colors.statusDangerDot} style={styles.controlIcon} />
              <View>
                <Text style={[styles.controlTitle, { color: colors.statusDangerText }]}>
                  Clear Consent & Re-Onboard
                </Text>
                <Text style={[styles.controlSub, { color: colors.textMuted }]}>
                  Revoke local telemetry consent and reset session
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </GlassCard>

        {/* Regulatory Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Feather name="info" size={13} color={colors.textMuted} style={styles.disclaimerIcon} />
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            {DISCLAIMER}
          </Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard} radius={24}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Edit Profile
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                Full Name
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
                value={editName}
                onChangeText={setEditName}
                placeholder="Your Name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={[styles.modalInputLabel, { color: colors.textSecondary }]}>
                Role / Function
              </Text>
              <View style={styles.roleSelectorRow}>
                {['worker', 'supervisor', 'admin'].map((r) => {
                  const selected = editRole === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setEditRole(r)}
                      style={[
                        styles.roleSelectChip,
                        {
                          backgroundColor: selected
                            ? colors.accent
                            : colors.surfaceSubtle,
                          borderColor: selected ? colors.accent : colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleSelectChipText,
                          { color: selected ? colors.buttonText : colors.textSecondary },
                        ]}
                      >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.surfaceBorder }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: colors.accent },
                  savingUser && { opacity: 0.6 },
                ]}
                onPress={handleSaveProfile}
                disabled={savingUser}
              >
                {savingUser ? (
                  <ActivityIndicator size="small" color={colors.buttonText} />
                ) : (
                  <Text style={[styles.modalSaveText, { color: colors.buttonText }]}>
                    Save Changes
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
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 24,
    paddingBottom: 140, // Clearance for floating bottom nav
  },
  titleSection: {
    marginBottom: 20,
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
  sectionHeaderRow: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  card: {
    padding: 20,
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 18,
  },
  infoList: {},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    flexShrink: 1,
    textAlign: 'right',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: 14,
  },
  btnIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  controlRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
  },
  controlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  controlIcon: {
    marginRight: 12,
  },
  controlTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  controlSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  disclaimerIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  disclaimerText: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
    flex: 1,
  },
  // User Profile & Account Styles
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  userTitleGroup: {
    flex: 1,
  },
  userNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userEmailText: {
    fontSize: 13,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  userActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  profileActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal Styles
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
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
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
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleSelectChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
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
