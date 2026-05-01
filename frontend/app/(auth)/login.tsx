import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/AuthContext';
import { theme } from '../../src/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter email and password');
      return;
    }
    setBusy(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setEmail('ramesh@farm.com');
    setPassword('farmer123');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBadge}>
            <Text style={styles.logoTxt}>RKAI</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your RKAI farmer account</Text>

          <View style={styles.field}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput
              testID="login-email"
              placeholder="Email"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput
              testID="login-password"
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
          </View>

          <TouchableOpacity testID="login-submit" style={styles.primaryBtn} onPress={onSubmit} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity testID="login-demo-btn" onPress={useDemo} style={styles.demoBtn}>
            <Text style={styles.demoTxt}>Use Demo Farmer Account</Text>
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.muted}>New here? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity testID="goto-signup">
                <Text style={styles.link}>Create account</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  logoBadge: {
    alignSelf: 'center', width: 84, height: 84, borderRadius: 42,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  logoTxt: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 32, marginTop: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 14,
  },
  input: { flex: 1, paddingVertical: 14, marginLeft: 10, color: theme.colors.textPrimary, fontSize: 15 },
  primaryBtn: {
    backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  primaryTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  demoBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  demoTxt: { color: theme.colors.secondary, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  muted: { color: theme.colors.textSecondary },
  link: { color: theme.colors.primary, fontWeight: '700' },
});
