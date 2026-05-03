import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from '../src/components/VideoPlayer';
import { api, formatApiError, absoluteUrl } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'cancelled'] as const;

type SR = {
  id: string;
  title: string;
  description: string;
  customer_name?: string;
  customer_phone?: string;
  product_name?: string;
  status: string;
  photo?: { url: string };
  video?: { url: string };
  assigned_manager_ids?: string[];
  created_at: string;
};
type Manager = { id: string; name?: string; phone: string; manager_perms?: { service?: boolean; leads?: boolean } };

export default function AdminServiceRequests() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | typeof STATUSES[number]>('all');
  const [items, setItems] = useState<SR[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<SR | null>(null);
  const [selectedMgrs, setSelectedMgrs] = useState<string[]>([]);
  const [allMgrs, setAllMgrs] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = filter === 'all' ? '/admin/service-requests' : `/admin/service-requests?status=${filter}`;
      const [s, m] = await Promise.all([api.get(path), api.get('/admin/managers')]);
      setItems(s.data);
      setManagers((m.data as Manager[]).filter(x => x.manager_perms?.service));
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const open = (sr: SR) => {
    setTarget(sr);
    setSelectedMgrs(sr.assigned_manager_ids || []);
    setAllMgrs(false);
    setNote('');
  };

  const submit = async () => {
    if (!target) return;
    if (!allMgrs && selectedMgrs.length === 0) {
      Alert.alert('Choose managers', 'Select one or more managers, or tick "All managers"');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/service-requests/${target.id}/assign`, {
        manager_ids: allMgrs ? [] : selectedMgrs,
        all_managers: allMgrs,
        note,
      });
      Alert.alert('Assigned', `Service request assigned${allMgrs ? ' to all managers' : ` to ${selectedMgrs.length} manager(s)`}. SMS + in-app notification sent.`);
      setTarget(null);
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const toggleMgr = (id: string) => {
    setAllMgrs(false);
    setSelectedMgrs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const statusColor = (s: string) => ({ open: '#FF9500', in_progress: '#0A84FF', resolved: '#34C759', closed: '#8E8E93', cancelled: '#FF3B30' } as any)[s] || theme.colors.textMuted;

  const mgrName = (id: string) => {
    const m = managers.find(x => x.id === id);
    return m ? (m.name || m.phone) : id.slice(0, 6);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Service Requests</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', ...STATUSES] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f as any)} style={[styles.chip, filter === f && styles.chipActive]}>
            <Text style={[styles.chipTxt, filter === f && styles.chipTxtActive]}>{f.replace('_', ' ').toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} /> : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {items.length === 0 ? <Text style={styles.empty}>No service requests</Text> : items.map(sr => (
            <TouchableOpacity key={sr.id} onPress={() => open(sr)} style={styles.card}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{sr.title}</Text>
                  <Text style={styles.cardSub}>{sr.customer_name || '—'} · {sr.customer_phone || ''}</Text>
                  {sr.product_name ? <Text style={styles.prodLine}>📦 {sr.product_name}</Text> : null}
                </View>
                <View style={[styles.pill, { backgroundColor: statusColor(sr.status) + '22', borderColor: statusColor(sr.status) }]}>
                  <Text style={[styles.pillTxt, { color: statusColor(sr.status) }]}>{sr.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.desc} numberOfLines={2}>{sr.description}</Text>
              <View style={styles.attachRow}>
                {sr.photo && <Image source={{ uri: absoluteUrl(sr.photo.url) }} style={styles.attachThumb} />}
                {sr.video && (
                  <View style={[styles.attachThumb, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="play" size={20} color="#fff" />
                  </View>
                )}
                <Text style={styles.dateTxt}>{new Date(sr.created_at).toLocaleDateString('en-IN')}</Text>
              </View>
              <View style={styles.assignRow}>
                <Ionicons name="person" size={12} color={theme.colors.textMuted} />
                <Text style={styles.assignTxt}>
                  {sr.assigned_manager_ids && sr.assigned_manager_ids.length > 0
                    ? `Mgr: ${sr.assigned_manager_ids.map(mgrName).join(', ')}`
                    : 'No manager'}
                  {sr.assigned_dealer_user_ids?.length ? `  ·  Dealers: ${sr.assigned_dealer_user_ids.length}` : ''}
                </Text>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); router.push({ pathname: '/admin-assign-dealer', params: { type: 'sr', id: sr.id, label: sr.title } }); }} style={styles.dealerBtn}>
                  <Text style={styles.dealerBtnTxt}>{sr.assigned_dealer_user_ids?.length ? 'Reassign Dealer' : '+ Dealer'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!target} animationType="slide" transparent onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle} numberOfLines={2}>{target?.title}</Text>
              <Text style={styles.modalSub}>{target?.customer_name} · {target?.customer_phone}{target?.product_name ? '  ·  ' + target.product_name : ''}</Text>
              <Text style={styles.desc}>{target?.description}</Text>
              {!!target?.photo && <Image source={{ uri: absoluteUrl(target.photo.url) }} style={styles.fullImg} />}
              {!!target?.video && <VideoPlayer uri={absoluteUrl(target.video.url)!} style={styles.fullVideo} />}

              <Text style={styles.field}>Assign to</Text>
              <TouchableOpacity onPress={() => { setAllMgrs(v => !v); if (!allMgrs) setSelectedMgrs([]); }} style={styles.allMgrBtn}>
                <Ionicons name={allMgrs ? 'checkbox' : 'square-outline'} size={20} color={allMgrs ? theme.colors.secondary : theme.colors.textMuted} />
                <Text style={styles.allMgrTxt}>All Service Managers ({managers.length})</Text>
              </TouchableOpacity>

              <View style={{ gap: 6 }}>
                {managers.length === 0 ? (
                  <Text style={styles.empty}>No managers with Service permission. Add one in Manage Managers.</Text>
                ) : managers.map(m => {
                  const on = !allMgrs && selectedMgrs.includes(m.id);
                  return (
                    <TouchableOpacity key={m.id} onPress={() => toggleMgr(m.id)} disabled={allMgrs} style={[styles.mgrRow, on && styles.mgrRowOn, allMgrs && { opacity: 0.45 }]}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? theme.colors.secondary : theme.colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mgrName}>{m.name || '—'}</Text>
                        <Text style={styles.mgrPhone}>{m.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.field}>Note (optional)</Text>
              <TextInput placeholder="Internal note for the manager (sent via SMS)" placeholderTextColor={theme.colors.textMuted} value={note} onChangeText={setNote} multiline style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setTarget(null)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Close</Text></TouchableOpacity>
                <TouchableOpacity onPress={submit} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Assign + Notify</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1 },
  chipTxtActive: { color: '#fff' },
  empty: { textAlign: 'center', paddingVertical: 30, color: theme.colors.textMuted },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  prodLine: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  desc: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  attachRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 },
  attachThumb: { width: 50, height: 50, borderRadius: 8 },
  dateTxt: { color: theme.colors.textMuted, fontSize: 11, marginLeft: 4 },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  assignTxt: { fontSize: 11, color: theme.colors.textMuted, flex: 1 },
  dealerBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FFF8E6', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary },
  dealerBtnTxt: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  fullImg: { width: '100%', height: 220, borderRadius: 12, marginTop: 12, backgroundColor: '#eee' },
  fullVideo: { width: '100%', height: 220, borderRadius: 12, marginTop: 12, backgroundColor: '#000' },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  allMgrBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FFFBEA', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  allMgrTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  mgrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  mgrRowOn: { backgroundColor: '#E6F7E9', borderColor: theme.colors.secondary },
  mgrName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  mgrPhone: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
