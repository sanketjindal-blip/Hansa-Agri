import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';

type Manager = { id: string; name: string; phone: string; manager_perms?: { leads?: boolean; service?: boolean } };

export default function AdminManagers() {
  const router = useRouter();
  const [list, setList] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState('+91');
  const [name, setName] = useState('');
  const [permLeads, setPermLeads] = useState(true);
  const [permService, setPermService] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/admin/managers'); setList(r.data); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onAdd = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) { Alert.alert('Missing', 'Valid phone required'); return; }
    if (!permLeads && !permService) { Alert.alert('Missing', 'Choose at least one module'); return; }
    setBusy(true);
    try {
      await api.post('/admin/managers', { phone, name: name || undefined, perms_leads: permLeads, perms_service: permService });
      Alert.alert('Manager added', `${name || phone} can now log in to the manager dashboard.`);
      setShowAdd(false); setPhone('+91'); setName(''); setPermLeads(true); setPermService(true);
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const togglePerm = async (m: Manager, key: 'leads' | 'service') => {
    const next = { leads: m.manager_perms?.leads || false, service: m.manager_perms?.service || false };
    next[key] = !next[key];
    if (!next.leads && !next.service) { Alert.alert('Need at least one', 'Demote instead?', [{ text: 'No', style: 'cancel' }, { text: 'Demote', style: 'destructive', onPress: () => doDemote(m) }]); return; }
    try { await api.patch(`/admin/managers/${m.id}`, { perms_leads: next.leads, perms_service: next.service }); await load(); }
    catch (e: any) { Alert.alert('Error', formatApiError(e)); }
  };

  const doDemote = async (m: Manager) => {
    try { await api.delete(`/admin/managers/${m.id}`); await load(); }
    catch (e: any) { Alert.alert('Error', formatApiError(e)); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Managers</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)}><Ionicons name="add-circle" size={28} color={theme.colors.primary} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.helper}>Managers log in with mobile + OTP. Toggle the chips below to grant or remove a module.</Text>
        {list.length === 0 ? <Text style={styles.empty}>No managers yet. Tap + to add one.</Text> : list.map(m => (
          <View key={m.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{m.name || '—'}</Text>
              <Text style={styles.cPhone}>{m.phone}</Text>
              <View style={styles.permRow}>
                <TouchableOpacity onPress={() => togglePerm(m, 'leads')} style={[styles.permChip, m.manager_perms?.leads && styles.permChipOn]}>
                  <Ionicons name={m.manager_perms?.leads ? 'checkmark-circle' : 'close-circle'} size={14} color={m.manager_perms?.leads ? '#fff' : theme.colors.textMuted} />
                  <Text style={[styles.permTxt, m.manager_perms?.leads && { color: '#fff' }]}>Leads</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => togglePerm(m, 'service')} style={[styles.permChip, m.manager_perms?.service && styles.permChipOn]}>
                  <Ionicons name={m.manager_perms?.service ? 'checkmark-circle' : 'close-circle'} size={14} color={m.manager_perms?.service ? '#fff' : theme.colors.textMuted} />
                  <Text style={[styles.permTxt, m.manager_perms?.service && { color: '#fff' }]}>Service</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => Alert.alert('Demote manager?', `${m.name || m.phone} will lose access.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Demote', style: 'destructive', onPress: () => doDemote(m) }])} style={styles.demote}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Manager</Text>
            <Text style={styles.field}>Mobile *</Text>
            <TextInput placeholder="+919876543210" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
            <Text style={styles.field}>Name</Text>
            <TextInput placeholder="Manager name" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
            <Text style={styles.field}>Modules</Text>
            <View style={styles.permRow}>
              <TouchableOpacity onPress={() => setPermLeads(v => !v)} style={[styles.permChip, permLeads && styles.permChipOn]}>
                <Ionicons name={permLeads ? 'checkbox' : 'square-outline'} size={16} color={permLeads ? '#fff' : theme.colors.textMuted} />
                <Text style={[styles.permTxt, permLeads && { color: '#fff' }]}>Leads management</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPermService(v => !v)} style={[styles.permChip, permService && styles.permChipOn]}>
                <Ionicons name={permService ? 'checkbox' : 'square-outline'} size={16} color={permService ? '#fff' : theme.colors.textMuted} />
                <Text style={[styles.permTxt, permService && { color: '#fff' }]}>Service management</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              <TouchableOpacity onPress={() => setShowAdd(false)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={onAdd} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Add</Text>}</TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  helper: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 12 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, gap: 8, alignItems: 'center' },
  cName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  cPhone: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  permRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F4F4F4', borderRadius: 999, borderWidth: 1, borderColor: '#E0E0E0' },
  permChipOn: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary },
  permTxt: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700' },
  demote: { padding: 8 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
