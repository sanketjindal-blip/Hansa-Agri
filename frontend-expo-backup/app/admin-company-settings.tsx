/**
 * Admin Company Settings — edit the GST/PAN/bank/address used on every
 * billing document (quotation, tax invoice, etc.). Auto-seeded with the
 * RAMKISHAN AGRI INNOVATE PRIVATE LIMITED data on first load.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

const FIELDS: [string, string, string?][] = [
  ['legal_name', 'Legal Name *'],
  ['trade_name', 'Trade Name'],
  ['gstin', 'GSTIN *', 'characters'],
  ['pan', 'PAN', 'characters'],
  ['cin', 'CIN'],
  ['address_line1', 'Address Line 1'],
  ['address_line2', 'Address Line 2'],
  ['city', 'City'],
  ['state', 'State'],
  ['state_code', 'State Code (2-digit)'],
  ['pincode', 'Pincode'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['website', 'Website'],
  ['bank_name', 'Bank Name'],
  ['bank_account', 'Bank A/c No.'],
  ['bank_ifsc', 'IFSC Code', 'characters'],
  ['bank_branch', 'Bank Branch'],
  ['invoice_prefix', 'Invoice Prefix (e.g. HANSA)'],
  ['default_terms', 'Default T&C'],
];

export default function AdminCompanySettings() {
  const [c, setC] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/admin/billing/company').then(r => setC(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!c.legal_name || !c.gstin) { Alert.alert('Missing', 'Legal Name and GSTIN are required'); return; }
    setBusy(true);
    try { await api.put('/admin/billing/company', c); Alert.alert('Saved', 'Company settings updated'); }
    catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Company Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={s.note}>These values appear on every quotation, tax invoice, and (later) e-Way Bill. Auto-seeded from your GST certificate.</Text>
          {FIELDS.map(([k, lbl, cap]) => (
            <View key={k}>
              <Text style={s.field}>{lbl}</Text>
              <TextInput
                placeholder={lbl}
                placeholderTextColor={theme.colors.textMuted}
                value={c[k] || ''}
                onChangeText={v => setC((p: any) => ({ ...p, [k]: v }))}
                autoCapitalize={(cap as any) || 'sentences'}
                multiline={k === 'default_terms'}
                style={[s.input, k === 'default_terms' && { minHeight: 70 }]}
              />
            </View>
          ))}
          <TouchableOpacity onPress={save} disabled={busy} style={[s.btn, { backgroundColor: theme.colors.primary, marginTop: 18 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Save Settings</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  note: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12, padding: 10, backgroundColor: '#FFFBEA', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 13 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
