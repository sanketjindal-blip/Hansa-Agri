import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/AuthContext';
import { theme } from '../../src/theme';

export default function Signup() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing info', 'Name, email and password are required');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      await register(email, password, name, phone);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join the RKAI farmer community</Text>

          <View style={styles.field}><Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput testID="signup-name" placeholder="Full Name" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
          </View>
          <View style={styles.field}><Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput testID="signup-email" placeholder="Email" placeholderTextColor={theme.colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          </View>
          <View style={styles.field}><Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput testID="signup-phone" placeholder="Phone (optional)" placeholderTextColor={theme.colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
          </View>
          <View style={styles.field}><Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput testID="signup-password" placeholder="Password (min 6)" placeholderTextColor={theme.colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          </View>

          <TouchableOpacity testID="signup-submit" style={styles.primaryBtn} onPress={onSubmit} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.muted}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity testID="goto-login"><Text style={styles.link}>Sign In</Text></TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, flexGrow: 1 },
  back: { marginBottom: 12, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 24, marginTop: 6 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  input: { flex: 1, paddingVertical: 14, marginLeft: 10, color: theme.colors.textPrimary, fontSize: 15 },
  primaryBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  muted: { color: theme.colors.textSecondary },
  link: { color: theme.colors.primary, fontWeight: '700' },
});
