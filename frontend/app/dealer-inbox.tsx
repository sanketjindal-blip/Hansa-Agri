/**
 * Dealer/Manager Inbox — shows leads + service requests assigned to the
 * current dealer (or manager-with-warranty perm) and lets them update
 * status with a mandatory remark for activity-tracking.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { api, formatApiError, absoluteUrl } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

const LEAD_STATUSES = ['new', 'contacted', 'purchased', 'lost'] as const;
const SR_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'cancelled'] as const;

type Tab = 'leads' | 'service';

export default function DealerInbox() {
  const [tab, setTab] = useState<Tab>('leads');
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Assigned to Me</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setTab('leads')} style={[styles.tab, tab === 'leads' && styles.tabActive]}>
          <Ionicons name="people" size={14} color={tab === 'leads' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === 'leads' && styles.tabTxtActive]}>Leads</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('service')} style={[styles.tab, tab === 'service' && styles.tabActive]}>
          <Ionicons name="build" size={14} color={tab === 'service' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === 'service' && styles.tabTxtActive]}>Service</Text>
        </TouchableOpacity>
      </View>
      {tab === 'leads' ? <LeadsList /> : <ServiceList />}
    </SafeAreaView>
  );
}

function lastUpdate(it: any) {
  if (!it.timeline?.length) return null;
  const t = it.timeline[it.timeline.length - 1];
  const when = new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `Latest: ${when} · ${t.remark || t.action}`;
}

function LeadsList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [nextStatus, setNextStatus] = useState<typeof LEAD_STATUSES[number]>('contacted');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/dealer/leads'); setItems(r.data); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (lead: any, ns: typeof LEAD_STATUSES[number]) => {
    setTarget(lead); setNextStatus(ns); setRemark('');
  };
  const submit = async () => {
    if (!remark.trim()) { Alert.alert('Remark required', 'Add a short note to track the latest update.'); return; }
    if (nextStatus === 'purchased' && target.status !== 'purchased' && target.referrer_user_id) {
      return Alert.alert('Mark as purchased?', `This will credit 500 points to ${target.referrer_name || 'the referrer'}.`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => doSubmit() },
      ]);
    }
    doSubmit();
  };
  const doSubmit = async () => {
    setBusy(true);
    try {
      await api.patch(`/dealer/leads/${target.id}`, { status: nextStatus, remark });
      Alert.alert('Lead updated', `Status \u2192 ${nextStatus.toUpperCase()}`);
      setTarget(null); await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const statusColor = (s: string) => ({ new: '#FF9500', contacted: '#0A84FF', purchased: '#34C759', lost: '#8E8E93' } as any)[s] || theme.colors.textMuted;

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {items.length === 0 ? <Text style={styles.empty}>No leads assigned to you yet.</Text> : items.map(l => (
          <View key={l.id} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{l.name}</Text>
                <Text style={styles.cardSub}>{l.phone}{l.equipment_interest ? '  ·  ' + l.equipment_interest : ''}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: statusColor(l.status) + '22', borderColor: statusColor(l.status) }]}>
                <Text style={[styles.pillTxt, { color: statusColor(l.status) }]}>{l.status.toUpperCase()}</Text>
              </View>
            </View>
            {l.referrer_name ? <Text style={styles.refTxt}>Referred by: {l.referrer_name} · {l.referrer_phone}</Text> : null}
            {!!lastUpdate(l) && <Text style={styles.latestUpdate}>{lastUpdate(l)}</Text>}
            <View style={styles.actions}>
              {LEAD_STATUSES.filter(s => s !== l.status).map(s => (
                <TouchableOpacity key={s} onPress={() => open(l, s)} style={[styles.actBtn, s === 'purchased' && { backgroundColor: '#E6F7E9', borderColor: '#34C759' }]}>
                  <Text style={[styles.actLbl, s === 'purchased' && { color: '#34C759' }]}>{s === 'purchased' ? 'Mark Purchased (+500)' : `\u2192 ${s}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!target} animationType="slide" transparent onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Update lead</Text>
              <Text style={styles.modalSub}>{target?.name} · {target?.phone}</Text>
              <Text style={styles.field}>Move status to</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {LEAD_STATUSES.map(s => (
                  <TouchableOpacity key={s} onPress={() => setNextStatus(s)} style={[styles.chip, nextStatus === s && styles.chipActive]}>
                    <Text style={[styles.chipTxt, nextStatus === s && styles.chipTxtActive]}>{s.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.field}>Remark *</Text>
              <TextInput placeholder="e.g. Customer asked for callback Friday" placeholderTextColor={theme.colors.textMuted} value={remark} onChangeText={setRemark} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} />
              {target?.timeline?.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.field}>Activity</Text>
                  {target.timeline.slice(-6).reverse().map((t: any, i: number) => (
                    <View key={i} style={styles.timelineRow}>
                      <Text style={styles.timelineDate}>{new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      <Text style={styles.timelineTxt}>[{t.role}] {t.action}{t.remark ? '  — ' + t.remark : ''}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setTarget(null)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={submit} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Save</Text>}</TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function ServiceList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<any | null>(null);
  const [status, setStatus] = useState<typeof SR_STATUSES[number]>('in_progress');
  const [remark, setRemark] = useState('');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/dealer/service-requests'); setItems(r.data); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (sr: any) => {
    setTarget(sr); setStatus(sr.status === 'open' ? 'in_progress' : sr.status); setRemark(''); setResolution(sr.resolution || '');
  };
  const submit = async () => {
    if (!remark.trim()) { Alert.alert('Remark required', 'Describe the latest update.'); return; }
    setBusy(true);
    try {
      await api.patch(`/dealer/service-requests/${target.id}`, { status, remark, resolution });
      Alert.alert('Updated', `Status \u2192 ${status.toUpperCase()}`);
      setTarget(null); await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const statusColor = (s: string) => ({ open: '#FF9500', in_progress: '#0A84FF', resolved: '#34C759', closed: '#8E8E93', cancelled: '#FF3B30' } as any)[s] || theme.colors.textMuted;

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {items.length === 0 ? <Text style={styles.empty}>No service requests assigned to you yet.</Text> : items.map(sr => (
          <TouchableOpacity key={sr.id} onPress={() => open(sr)} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>{sr.title}</Text>
                <Text style={styles.cardSub}>{sr.customer_name} · {sr.customer_phone}{sr.product_name ? '  ·  ' + sr.product_name : ''}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: statusColor(sr.status) + '22', borderColor: statusColor(sr.status) }]}>
                <Text style={[styles.pillTxt, { color: statusColor(sr.status) }]}>{sr.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.desc} numberOfLines={2}>{sr.description}</Text>
            {!!lastUpdate(sr) && <Text style={styles.latestUpdate}>{lastUpdate(sr)}</Text>}
            <View style={styles.attachRow}>
              {sr.photo && <Image source={{ uri: absoluteUrl(sr.photo.url) }} style={styles.attachThumb} />}
              {sr.video && <View style={[styles.attachThumb, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="play" size={20} color="#fff" /></View>}
              <Text style={styles.dateTxt}>{new Date(sr.created_at).toLocaleDateString('en-IN')}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!target} animationType="slide" transparent onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle} numberOfLines={2}>{target?.title}</Text>
              <Text style={styles.modalSub}>{target?.customer_name} · {target?.customer_phone}</Text>
              <Text style={styles.desc}>{target?.description}</Text>
              {!!target?.photo && <Image source={{ uri: absoluteUrl(target.photo.url) }} style={styles.fullImg} />}
              {!!target?.video && <Video source={{ uri: absoluteUrl(target.video.url)! }} style={styles.fullVideo} useNativeControls resizeMode={ResizeMode.CONTAIN} />}
              {target?.timeline?.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.field}>Activity</Text>
                  {target.timeline.slice(-6).reverse().map((t: any, i: number) => (
                    <View key={i} style={styles.timelineRow}>
                      <Text style={styles.timelineDate}>{new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      <Text style={styles.timelineTxt}>[{t.role}] {t.action}{t.remark ? '  — ' + t.remark : ''}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.field}>Update status</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {SR_STATUSES.map(s => (
                  <TouchableOpacity key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
                    <Text style={[styles.chipTxt, status === s && styles.chipTxtActive]}>{s.replace('_', ' ').toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.field}>Remark *</Text>
              <TextInput placeholder="e.g. Reached customer site, awaiting parts" placeholderTextColor={theme.colors.textMuted} value={remark} onChangeText={setRemark} multiline style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} />
              <Text style={styles.field}>Resolution (shown to customer)</Text>
              <TextInput placeholder="Final resolution / next steps" placeholderTextColor={theme.colors.textMuted} value={resolution} onChangeText={setResolution} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setTarget(null)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Close</Text></TouchableOpacity>
                <TouchableOpacity onPress={submit} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Update</Text>}</TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 12 },
  tabTxtActive: { color: '#fff' },
  empty: { textAlign: 'center', paddingVertical: 30, color: theme.colors.textMuted },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  refTxt: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  latestUpdate: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  desc: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  attachRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 },
  attachThumb: { width: 50, height: 50, borderRadius: 8 },
  dateTxt: { color: theme.colors.textMuted, fontSize: 11, marginLeft: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F4F4F4', borderRadius: 999, borderWidth: 1, borderColor: '#E0E0E0' },
  actLbl: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  fullImg: { width: '100%', height: 220, borderRadius: 12, marginTop: 12, backgroundColor: '#eee' },
  fullVideo: { width: '100%', height: 220, borderRadius: 12, marginTop: 12, backgroundColor: '#000' },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1 },
  chipTxtActive: { color: '#fff' },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
  timelineRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  timelineDate: { fontSize: 11, color: theme.colors.textMuted, width: 110 },
  timelineTxt: { fontSize: 12, color: theme.colors.textPrimary, flex: 1 },
});
