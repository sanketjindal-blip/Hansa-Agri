import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';

type Lead = { id: string; name: string; phone: string; status: string; equipment_interest?: string; points_awarded?: number; created_at: string; };

export default function ReferEarn() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [points, setPoints] = useState(0);
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([api.get('/leads/mine'), api.get('/me/points')]);
      setLeads(l.data); setPoints(p.data.balance || 0); setTxns(p.data.transactions || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { Alert.alert('Missing', 'Name and Mobile are mandatory'); return; }
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) { Alert.alert('Invalid phone', 'Enter a valid mobile number'); return; }
    setBusy(true);
    try {
      await api.post('/leads', { name: name.trim(), phone, equipment_interest: interest, notes });
      Alert.alert('Lead submitted', `Thanks! When ${name.trim()} purchases an equipment, you will earn 500 points (\u20B9500).`);
      setName(''); setPhone('+91'); setInterest(''); setNotes('');
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const statusColor = (s: string) => ({
    new: '#FF9500', contacted: '#0A84FF', purchased: '#34C759', lost: '#8E8E93',
  } as any)[s] || theme.colors.textMuted;

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Refer & Earn</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}><Ionicons name="gift" size={36} color="#fff" /></View>
            <Text style={styles.heroTitle}>Earn 500 Points = \u20B9500</Text>
            <Text style={styles.heroSub}>Refer a friend who buys HANSA equipment & get 500 reward points (1 point = \u20B91). Redeem on your next purchase.</Text>
          </View>

          <View style={styles.balanceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.balLbl}>Your Points</Text>
              <Text style={styles.balVal}>{points} <Text style={styles.balUnit}>pts</Text></Text>
              <Text style={styles.balRupee}>= \u20B9 {points}</Text>
            </View>
            <Ionicons name="trophy" size={48} color="#FFD60A" />
          </View>

          <Text style={styles.section}>Submit a Lead</Text>
          <Text style={styles.field}>Friend's Name *</Text>
          <TextInput testID="lead-name" placeholder="Full Name" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
          <Text style={styles.field}>Friend's Mobile *</Text>
          <TextInput testID="lead-phone" placeholder="+91XXXXXXXXXX" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
          <Text style={styles.field}>Equipment Interest (optional)</Text>
          <TextInput testID="lead-interest" placeholder="e.g. Tiller, Cultivator" placeholderTextColor={theme.colors.textMuted} value={interest} onChangeText={setInterest} style={styles.input} />
          <Text style={styles.field}>Notes (optional)</Text>
          <TextInput testID="lead-notes" placeholder="Any details that help our team" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} />
          <TouchableOpacity testID="lead-submit" onPress={submit} disabled={busy} style={styles.submitBtn}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Submit Lead</Text>}
          </TouchableOpacity>

          <Text style={styles.section}>My Leads ({leads.length})</Text>
          {leads.length === 0 ? (
            <Text style={styles.empty}>No leads yet. Submit your first one above!</Text>
          ) : leads.map((l) => (
            <View key={l.id} style={styles.leadCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.leadName}>{l.name}</Text>
                <Text style={styles.leadSub}>{l.phone}{l.equipment_interest ? '  \u00B7  ' + l.equipment_interest : ''}</Text>
                <Text style={styles.leadDate}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[styles.statusPill, { backgroundColor: statusColor(l.status) + '22', borderColor: statusColor(l.status) }]}>
                  <Text style={[styles.statusTxt, { color: statusColor(l.status) }]}>{l.status.toUpperCase()}</Text>
                </View>
                {l.points_awarded ? <Text style={styles.awardTxt}>+{l.points_awarded} pts</Text> : null}
              </View>
            </View>
          ))}

          {txns.length > 0 && (
            <>
              <Text style={styles.section}>Points History</Text>
              {txns.map((t) => (
                <View key={t.id} style={styles.txnRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnReason} numberOfLines={2}>{t.reason}</Text>
                    <Text style={styles.txnDate}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                  <Text style={[styles.txnDelta, { color: t.delta > 0 ? theme.colors.secondary : theme.colors.danger }]}>{t.delta > 0 ? '+' : ''}{t.delta}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  heroCard: { backgroundColor: theme.colors.primary, padding: 18, borderRadius: 18, alignItems: 'center', marginBottom: 14 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: '#fff', opacity: 0.92, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  balanceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEA', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FFE08A' },
  balLbl: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  balVal: { fontSize: 32, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 4 },
  balUnit: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600' },
  balRupee: { fontSize: 13, color: theme.colors.secondary, fontWeight: '700', marginTop: 2 },
  section: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 22, marginBottom: 10 },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 8 },
  submitBtn: { backgroundColor: theme.colors.secondary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 14 },
  leadCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, gap: 10, alignItems: 'center' },
  leadName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  leadSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  leadDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  awardTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.secondary },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  txnReason: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '600' },
  txnDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  txnDelta: { fontSize: 16, fontWeight: '800' },
});
