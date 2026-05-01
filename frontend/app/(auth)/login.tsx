import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/AuthContext';
import { useI18n } from '../../src/i18n';
import { HansaLogo } from '../../src/components/HansaLogo';
import { theme } from '../../src/theme';

export default function Login() {
  const router = useRouter();
  const { sendOtp, verifyOtp, login } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState<'phone' | 'otp' | 'admin'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPwd, setAdminPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const onSend = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) { Alert.alert('Invalid phone', 'Enter a valid 10-digit mobile number'); return; }
    setBusy(true);
    try { await sendOtp(phone); setStep('otp'); Alert.alert('OTP sent', `We sent a 6-digit code to ${phone}`); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const onVerify = async () => {
    if (otp.length !== 6) { Alert.alert('Invalid OTP', 'Enter the 6-digit code'); return; }
    setBusy(true);
    try { await verifyOtp(phone, otp, name || undefined); router.replace('/(tabs)'); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const onAdminLogin = async () => {
    if (!adminEmail || !adminPwd) { Alert.alert('Missing info', 'Email and password required'); return; }
    setBusy(true);
    try { await login(adminEmail, adminPwd); router.replace('/(tabs)'); }
    catch (e: any) { Alert.alert('Login failed', e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBadge}><HansaLogo size={84} /></View>
          <Text style={styles.title}>{step === 'admin' ? 'Admin Login' : t('welcome_back')}</Text>
          <Text style={styles.subtitle}>{step === 'phone' ? 'Login with your mobile number' : step === 'otp' ? `Enter OTP sent to ${phone}` : 'Sign in with admin email & password'}</Text>

          {step === 'phone' && (
            <>
              <View style={styles.field}>
                <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.prefix}>+91</Text>
                <TextInput testID="login-phone" placeholder="10-digit mobile number" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={13} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput testID="login-name" placeholder="Your Name (first time only)" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
              </View>
              <TouchableOpacity testID="send-otp" style={styles.primaryBtn} onPress={onSend} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={styles.field}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput testID="login-otp" placeholder="6-digit OTP" placeholderTextColor={theme.colors.textMuted} keyboardType="number-pad" value={otp} onChangeText={setOtp} maxLength={6} style={styles.input} />
              </View>
              <TouchableOpacity testID="verify-otp" style={styles.primaryBtn} onPress={onVerify} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Verify & Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity testID="back-phone" onPress={() => { setStep('phone'); setOtp(''); }} style={styles.secondary}>
                <Text style={styles.secondaryTxt}>Change mobile number</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'admin' && (
            <>
              <View style={styles.field}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput testID="admin-email" placeholder={t('email')} placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={adminEmail} onChangeText={setAdminEmail} style={styles.input} />
              </View>
              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput testID="admin-password" placeholder={t('password')} placeholderTextColor={theme.colors.textMuted} secureTextEntry value={adminPwd} onChangeText={setAdminPwd} style={styles.input} />
              </View>
              <TouchableOpacity testID="admin-login" style={styles.primaryBtn} onPress={onAdminLogin} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>{t('sign_in')}</Text>}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
          <TouchableOpacity testID="switch-mode" onPress={() => setStep(step === 'admin' ? 'phone' : 'admin')} style={styles.switchBtn}>
            <Ionicons name={step === 'admin' ? 'phone-portrait-outline' : 'shield-outline'} size={18} color={theme.colors.secondary} />
            <Text style={styles.switchTxt}>{step === 'admin' ? 'Farmer login (OTP)' : 'Admin login (email)'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  logoBadge: { alignSelf: 'center', backgroundColor: '#FFFBEA', padding: 12, borderRadius: 24, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 28, marginTop: 6 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  prefix: { marginLeft: 10, color: theme.colors.textPrimary, fontWeight: '700' },
  input: { flex: 1, paddingVertical: 14, marginLeft: 10, color: theme.colors.textPrimary, fontSize: 15 },
  primaryBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  secondaryTxt: { color: theme.colors.secondary, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  or: { marginHorizontal: 10, color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  switchBtn: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingVertical: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  switchTxt: { color: theme.colors.secondary, fontWeight: '700' },
});
