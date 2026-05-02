/**
 * Admin: assign a Lead or Service Request to one or more Dealers.
 * Reused by both /admin-leads and /admin-service-requests via deep-link
 * params: ?type=lead|sr&id=<id>&label=<title>.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

type DealerUser = { id: string; name?: string; phone: string; dealer_profile?: { name?: string; city?: string } };

export default function AdminAssignDealer() {
  const { type, id, label } = useLocalSearchParams<{ type: string; id: string; label?: string }>();
  const router = useRouter();
  const [dealers, setDealers] = useState<DealerUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [allDealers, setAllDealers] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isLead = type === 'lead';
  const titleTxt = isLead ? 'Assign Lead to Dealer' : 'Assign Service Ticket to Dealer';

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/dealer-users');
      setDealers(r.data);
      // Pre-fill currently assigned
      const it = isLead
        ? (await api.get('/admin/leads')).data.find((l: any) => l.id === id)
        : (await api.get('/admin/service-requests')).data.find((s: any) => s.id === id);
      if (it?.assigned_dealer_user_ids) setSelected(it.assigned_dealer_user_ids);
    } finally { setLoading(false); }
  }, [id, isLead]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const toggle = (uid: string) => {
    setAllDealers(false);
    setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);
  };

  const submit = async () => {
    if (!allDealers && selected.length === 0) {
      Alert.alert('Pick dealers', 'Select at least one dealer or check "All Dealers"');
      return;
    }
    setBusy(true);
    try {
      const path = isLead
        ? `/admin/leads/${id}/assign-dealers`
        : `/admin/service-requests/${id}/assign-dealers`;
      await api.post(path, {
        dealer_user_ids: allDealers ? [] : selected,
        all_dealers: allDealers,
        note,
      });
      Alert.alert('Assigned', `Dealer(s) notified via SMS + in-app.`, [
        { text: 'OK', onPress: () => safeBack() },
      ]);
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>{titleTxt}</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {!!label && <Text style={styles.contextTxt}>For: {label}</Text>}

          <Text style={styles.field}>Pick dealers</Text>
          <TouchableOpacity onPress={() => { setAllDealers(v => !v); if (!allDealers) setSelected([]); }} style={styles.allBtn}>
            <Ionicons name={allDealers ? 'checkbox' : 'square-outline'} size={20} color={allDealers ? theme.colors.secondary : theme.colors.textMuted} />
            <Text style={styles.allTxt}>All Dealers ({dealers.length})</Text>
          </TouchableOpacity>

          {dealers.length === 0 ? (
            <Text style={styles.empty}>No dealers registered yet. Promote a user to dealer in Admin Console.</Text>
          ) : dealers.map(d => {
            const on = !allDealers && selected.includes(d.id);
            const dn = d.dealer_profile?.name || d.name || d.phone;
            return (
              <TouchableOpacity key={d.id} onPress={() => toggle(d.id)} disabled={allDealers} style={[styles.row, on && styles.rowOn, allDealers && { opacity: 0.45 }]}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? theme.colors.secondary : theme.colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{dn}</Text>
                  <Text style={styles.phone}>{d.phone}{d.dealer_profile?.city ? '  ·  ' + d.dealer_profile.city : ''}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.field}>Note for the dealer (optional, sent in SMS)</Text>
          <TextInput placeholder="e.g. Customer asked for site visit before Friday" placeholderTextColor={theme.colors.textMuted} value={note} onChangeText={setNote} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} />

          <TouchableOpacity testID="confirm-assign-dealer" onPress={submit} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, marginTop: 16 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Assign + Notify</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  contextTxt: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', padding: 16 },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  allBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FFFBEA', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  allTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6 },
  rowOn: { backgroundColor: '#E6F7E9', borderColor: theme.colors.secondary },
  name: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  phone: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
