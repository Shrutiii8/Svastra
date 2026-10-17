/**
 * HeatGuard Twin / Svastra — Email Authentication & OTP Verification Screen
 * Distinct Sign In and Sign Up tabs with admin role assignment and email OTP delivery.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { requestOTP, resendOTP, verifyOTP, setAuthToken, ApiError } from '../src/services/api';
import { setStorageItem } from '../src/services/storage';
import { useTheme, Typography, BorderRadius, Shadows } from '../src/constants/theme';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { GlassCard } from '../src/components/GlassCard';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { NexoraLogo } from '../src/components/NexoraLogo';
import { GlassCircleIcon } from '../src/components/GlassCircleIcon';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();

  // Mode: 'login' (existing admin) | 'register' (new admin)
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // Steps: 'form' (input credentials) | 'otp' (verify 6-digit code)
  const [step, setStep] = useState<'form' | 'otp'>('form');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('admin');
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cooldown timer for resending OTP
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    if (loading) return;
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setOtp('');
    setStep('form');
  };

  const handleSendOTP = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'register') {
      const cleanName = fullName.trim();
      if (!cleanName) {
        setErrorMsg('Please enter your full name for administrator registration.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await requestOTP(
        cleanEmail,
        mode,
        mode === 'register' ? fullName.trim() : undefined,
        role
      );
      setSuccessMsg(res.message || `Verification code sent to ${cleanEmail}`);
      startCooldown(res.cooldown_seconds || 60);
      setStep('otp');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Unable to dispatch verification email. Please check connectivity or try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0 || loading) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await resendOTP(
        email.trim().toLowerCase(),
        mode,
        mode === 'register' ? fullName.trim() : undefined,
        role
      );
      setSuccessMsg(res.message || 'A new verification code has been dispatched.');
      startCooldown(res.cooldown_seconds || 60);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to resend code. Please try again shortly.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setErrorMsg(null);
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d+$/.test(cleanOtp)) {
      setErrorMsg('Please enter the full 6-digit code received in your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOTP(
        email.trim().toLowerCase(),
        cleanOtp,
        mode,
        mode === 'register' ? fullName.trim() : undefined,
        role
      );

      // Store authenticated session
      await setStorageItem('hg_auth_token', res.access_token);
      await setStorageItem('hg_user', JSON.stringify(res.user));
      setAuthToken(res.access_token);

      setSuccessMsg(`Welcome, ${res.user.full_name || res.user.email}! Loading workforce twin…`);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Verification failed. Please ensure the code is correct and not expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    router.replace('/(tabs)');
  };

  return (
    <ScreenBackground style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Branding */}
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
                Shadows.subtle,
              ]}
            >
              <NexoraLogo size={46} color={colors.accent} />
            </View>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
              Svastra
            </Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
              Workforce Heat Strain & Physiological Twin Intelligence
            </Text>
          </View>

          {/* Authentication Card */}
          <GlassCard style={styles.card} radius={24}>
            {step === 'form' ? (
              <>
                {/* Segmented Control / Tabs: Sign In vs Sign Up */}
                <View
                  style={[
                    styles.tabContainer,
                    {
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.06)',
                      borderColor: colors.surfaceBorder,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.tabButton,
                      mode === 'login' && [
                        styles.tabButtonActive,
                        { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
                      ],
                    ]}
                    onPress={() => handleModeSwitch('login')}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name="log-in"
                      size={15}
                      color={mode === 'login' ? colors.accent : colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        { color: mode === 'login' ? colors.textPrimary : colors.textMuted },
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tabButton,
                      mode === 'register' && [
                        styles.tabButtonActive,
                        { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
                      ],
                    ]}
                    onPress={() => handleModeSwitch('register')}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name="user-plus"
                      size={15}
                      color={mode === 'register' ? colors.accent : colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        { color: mode === 'register' ? colors.textPrimary : colors.textMuted },
                      ]}
                    >
                      Sign Up (Admin)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Header for Active Mode */}
                <View style={styles.cardHeader}>
                  <GlassCircleIcon
                    name={mode === 'login' ? 'shield' : 'user-check'}
                    size={40}
                    iconSize={18}
                    color={colors.accent}
                    bg={colors.surfaceSubtle}
                    borderColor={colors.surfaceBorder}
                    style={styles.cardIcon}
                  />
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      {mode === 'login' ? 'Admin Sign In' : 'Create Admin Account'}
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      {mode === 'login'
                        ? 'Sign in to monitor workers & oversee heat safety'
                        : 'Register as an administrator to supervise workforce vitals'}
                    </Text>
                  </View>
                </View>

                {/* Error Banner */}
                {errorMsg && (
                  <View
                    style={[
                      styles.alertBox,
                      {
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      },
                    ]}
                  >
                    <Feather name="alert-circle" size={16} color="#ef4444" style={styles.alertIcon} />
                    <Text style={[styles.alertText, { color: '#f87171' }]}>{errorMsg}</Text>
                  </View>
                )}

                {/* Sign Up: Full Name Input */}
                {mode === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      Administrator Name <Text style={{ color: colors.accent }}>*</Text>
                    </Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: colors.surfaceBorder,
                        },
                      ]}
                    >
                      <Feather name="user" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: colors.textPrimary }]}
                        placeholder="e.g. Dr. Rajesh Sharma"
                        placeholderTextColor={colors.textMuted}
                        value={fullName}
                        onChangeText={(t) => {
                          setFullName(t);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}

                {/* Email Address Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {mode === 'register' ? 'Official Work Email' : 'Email Address'}{' '}
                    <Text style={{ color: colors.accent }}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.surfaceBorder,
                      },
                    ]}
                  >
                    <Feather name="mail" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary }]}
                      placeholder="admin@svastra.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {/* Sign Up: Role Info Badge */}
                {mode === 'register' && (
                  <View style={styles.roleNoticeBox}>
                    <Feather name="shield" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.roleNoticeText, { color: colors.textSecondary }]}>
                      Assigned Role: <Text style={{ color: colors.accent, fontWeight: '700' }}>Admin / Supervisor</Text> (Worker Supervision)
                    </Text>
                  </View>
                )}

                <PrimaryButton
                  title={
                    loading
                      ? 'Sending OTP…'
                      : mode === 'register'
                      ? 'Send Registration Code'
                      : 'Send Sign In Code'
                  }
                  onPress={handleSendOTP}
                  loading={loading}
                  disabled={loading || !email.trim() || (mode === 'register' && !fullName.trim())}
                  icon={<Feather name="send" size={16} color={colors.buttonText} />}
                  style={styles.actionButton}
                />

                {/* Footer Switch Prompt */}
                <View style={styles.modePromptRow}>
                  <Text style={[styles.modePromptText, { color: colors.textMuted }]}>
                    {mode === 'login' ? "Don't have an admin account?" : 'Already registered?'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleModeSwitch(mode === 'login' ? 'register' : 'login')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modePromptLink, { color: colors.accent }]}>
                      {mode === 'login' ? 'Sign Up as Admin' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleContinueAsGuest}
                  activeOpacity={0.7}
                  style={styles.guestButton}
                >
                  <Text style={[styles.guestButtonText, { color: colors.textMuted }]}>
                    Skip for now · Continue as Guest →
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Step 2: OTP Verification Card */}
                <View style={styles.cardHeader}>
                  <GlassCircleIcon
                    name="key"
                    size={42}
                    iconSize={20}
                    color={colors.accent}
                    bg={colors.surfaceSubtle}
                    borderColor={colors.surfaceBorder}
                    style={styles.cardIcon}
                  />
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      {mode === 'register' ? 'Verify Registration' : 'Sign In Verification'}
                    </Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      We sent a 6-digit OTP code to{' '}
                      <Text style={{ color: colors.accent, fontWeight: '600' }}>
                        {email}
                      </Text>
                    </Text>
                  </View>
                </View>

                {mode === 'register' && fullName && (
                  <View
                    style={[
                      styles.identityPill,
                      {
                        backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        borderColor: 'rgba(56, 189, 248, 0.25)',
                      },
                    ]}
                  >
                    <Feather name="user-check" size={13} color="#38bdf8" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: '#38bdf8', fontWeight: '500' }}>
                      Registering Admin: {fullName}
                    </Text>
                  </View>
                )}

                {errorMsg && (
                  <View
                    style={[
                      styles.alertBox,
                      {
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      },
                    ]}
                  >
                    <Feather name="alert-circle" size={16} color="#ef4444" style={styles.alertIcon} />
                    <Text style={[styles.alertText, { color: '#f87171' }]}>{errorMsg}</Text>
                  </View>
                )}

                {successMsg && (
                  <View
                    style={[
                      styles.alertBox,
                      {
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                      },
                    ]}
                  >
                    <Feather name="check-circle" size={16} color="#10b981" style={styles.alertIcon} />
                    <Text style={[styles.alertText, { color: '#34d399' }]}>{successMsg}</Text>
                  </View>
                )}

                {/* 6-Digit OTP Input */}
                <View style={styles.otpInputGroup}>
                  <TextInput
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: errorMsg ? '#ef4444' : colors.accent,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="••••••"
                    placeholderTextColor={colors.textMuted}
                    value={otp}
                    onChangeText={(t) => {
                      setOtp(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <Text style={[styles.otpHelpText, { color: colors.textMuted }]}>
                    Code valid for 10 minutes
                  </Text>
                </View>

                <PrimaryButton
                  title={
                    loading
                      ? 'Verifying…'
                      : mode === 'register'
                      ? 'Verify & Complete Registration'
                      : 'Verify & Sign In'
                  }
                  onPress={handleVerifyOTP}
                  loading={loading}
                  disabled={loading || otp.trim().length !== 6}
                  icon={<Feather name="check-circle" size={16} color={colors.buttonText} />}
                  style={styles.actionButton}
                />

                {/* Resend and Edit Actions */}
                <View style={styles.otpActionRow}>
                  {cooldown > 0 ? (
                    <Text style={[styles.cooldownText, { color: colors.textMuted }]}>
                      Resend code in <Text style={{ color: colors.accent, fontWeight: '700' }}>{cooldown}s</Text>
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResendOTP} disabled={loading} activeOpacity={0.7}>
                      <Text style={[styles.resendText, { color: colors.accent }]}>
                        Didn't receive code? Resend
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      setStep('form');
                      setOtp('');
                      setErrorMsg(null);
                    }}
                    activeOpacity={0.7}
                    style={styles.changeEmailButton}
                  >
                    <Text style={[styles.changeEmailText, { color: colors.textSecondary }]}>
                      Back to {mode === 'register' ? 'Sign Up' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </GlassCard>

          {/* Security Note */}
          <View style={styles.footerNote}>
            <Feather name="lock" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Secured with encrypted email OTP & JWT authorization
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: 4,
    borderWidth: 1,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  tabButtonActive: {
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertIcon: {
    marginRight: 8,
  },
  alertText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  roleNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    marginBottom: 16,
  },
  roleNoticeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionButton: {
    marginTop: 8,
    width: '100%',
  },
  modePromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  modePromptText: {
    fontSize: 13,
  },
  modePromptLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  guestButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 6,
  },
  guestButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  identityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  otpInputGroup: {
    alignItems: 'center',
    marginVertical: 18,
  },
  otpInput: {
    width: '80%',
    maxWidth: 240,
    height: 60,
    borderWidth: 2,
    borderRadius: 16,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpHelpText: {
    fontSize: 12,
    marginTop: 10,
  },
  otpActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cooldownText: {
    fontSize: 13,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  changeEmailButton: {
    paddingVertical: 4,
  },
  changeEmailText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 12,
  },
});
