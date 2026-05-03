import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';

const STATUSES = ['new', 'contacted', 'purchased', 'lost'] as const;
type Status = typeof STATUSES[number];

export default function AdminLeads() {
  const router = useRouter();
  const [tab, setTab] = useState<'leads' | 'users'>('leads');
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Leads & Points</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setTab('leads')} style={[styles.tab, tab === 'leads' && styles.tabActive]}>
          <Ionicons name="people" size={14} color={tab === 'leads' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === 'leads' && styles.tabTxtActive]}>Leads</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('users')} style={[styles.tab, tab === 'users' && styles.tabActive]}>
          <Ionicons name="trophy" size={14} color={tab === 'users' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.tabTxt, tab === 'users' && styles.tabTxtActive]}>Users / Points</Text>
        </TouchableOpacity>
      </View>
      {tab === 'leads' ? <LeadsTab /> : <UsersTab />}
    </SafeAreaView>
  );
}

function LeadsTab() {
  const router = useRouter();
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [leads, setLeads] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any | null>(null);
  // Add Lead form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [interest, setInterest] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMgrs, setSelectedMgrs] = useState<string[]>([]);
  const [allMgrs, setAllMgrs] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = filter === 'all' ? '/admin/leads' : `/admin/leads?status=${filter}`;
      const [r, m] = await Promise.all([api.get(path), api.get('/admin/managers')]);
      setLeads(r.data);
      setManagers((m.data || []).filter((x: any) => x.manager_perms?.leads));
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const updateStatus = (lead: any, status: Status) => {
    if (status === 'purchased' && lead.status !== 'purchased') {
      Alert.alert(
        'Mark as purchased?',
        `This will credit 500 points (\u20B9500) to ${lead.referrer_name || 'the referrer'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm & Award', onPress: () => doUpdate(lead, status) },
        ],
      );
      return;
    }
    doUpdate(lead, status);
  };

  const doUpdate = async (lead: any, status: Status) => {
    try {
      await api.patch(`/admin/leads/${lead.id}`, { status, notes: '' });
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
  };

  const resetAdd = () => {
    setName(''); setPhone('+91'); setInterest(''); setNotes('');
    setSelectedMgrs([]); setAllMgrs(false);
  };

  const submitAdd = async () => {
    if (!name.trim()) { Alert.alert('Missing', 'Customer name is required'); return; }
    if (phone.replace(/\D/g, '').length < 10) { Alert.alert('Missing', 'Valid phone required'); return; }
    setBusy(true);
    try {
      await api.post('/admin/leads', {
        name, phone, equipment_interest: interest, notes, source: 'call',
        manager_ids: allMgrs ? [] : selectedMgrs, all_managers: allMgrs,
      });
      const assignedTo = allMgrs ? 'all managers' : selectedMgrs.length > 0 ? `${selectedMgrs.length} manager(s)` : 'no manager';
      Alert.alert('Lead saved', `Lead recorded · ${assignedTo} notified.`);
      setShowAdd(false); resetAdd(); await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const submitAssign = async () => {
    if (!assignTarget) return;
    if (!allMgrs && selectedMgrs.length === 0) { Alert.alert('Select managers', 'Pick managers, or check "All managers"'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/leads/${assignTarget.id}/assign`, {
        manager_ids: allMgrs ? [] : selectedMgrs, all_managers: allMgrs, note: notes,
      });
      Alert.alert('Assigned', `Lead assigned${allMgrs ? ' to all managers' : ` to ${selectedMgrs.length} manager(s)`}.`);
      setAssignTarget(null); resetAdd(); await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const openAssign = (lead: any) => {
    setAssignTarget(lead);
    setSelectedMgrs(lead.assigned_manager_ids || []);
    setAllMgrs(false);
    setNotes('');
  };

  const toggleMgr = (id: string) => {
    setAllMgrs(false);
    setSelectedMgrs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const mgrName = (id: string) => {
    const m = managers.find((x: any) => x.id === id);
    return m ? (m.name || m.phone) : id.slice(0, 6);
  };

  const statusColor = (s: string) => ({ new: '#FF9500', contacted: '#0A84FF', purchased: '#34C759', lost: '#8E8E93' } as any)[s] || theme.colors.textMuted;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} style={{ flex: 1 }}>
          {(['all', ...STATUSES] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f as any)} style={[styles.chip, filter === f && styles.chipActive]}>
              <Text style={[styles.chipTxt, filter === f && styles.chipTxtActive]}>{f.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity testID="add-lead-btn" onPress={() => { resetAdd(); setShowAdd(true); }} style={styles.addBtn}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addLbl}>Add Lead</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} /> : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {leads.length === 0 ? <Text style={styles.empty}>No leads in this view.</Text> : leads.map(l => (
            <View key={l.id} style={styles.leadCard}>
              <View style={styles.leadHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leadName}>{l.name}{l.admin_created ? <Text style={styles.callTag}>  · CALL</Text> : null}</Text>
                  <Text style={styles.leadSub}>{l.phone}{l.equipment_interest ? '  \u00B7  ' + l.equipment_interest : ''}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor(l.status) + '22', borderColor: statusColor(l.status) }]}>
                  <Text style={[styles.statusTxt, { color: statusColor(l.status) }]}>{l.status.toUpperCase()}</Text>
                </View>
              </View>
              {l.referrer_user_id ? (
                <Text style={styles.leadRef}>Referred by: {l.referrer_name || '—'}  \u00B7  {l.referrer_phone}</Text>
              ) : null}
              <Text style={styles.leadRef}>
                <Ionicons name="person" size={11} color={theme.colors.textMuted} />{' '}
                {l.assigned_manager_ids?.length ? `Assigned: ${l.assigned_manager_ids.map(mgrName).join(', ')}` : 'Unassigned'}
              </Text>
              {l.points_awarded ? <Text style={styles.awardTag}>+{l.points_awarded} points awarded</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openAssign(l)} style={[styles.actBtn, { backgroundColor: '#E6F3FF', borderColor: '#0A84FF' }]}>
                  <Text style={[styles.actLbl, { color: '#0A84FF' }]}>{l.assigned_manager_ids?.length ? 'Reassign Mgr' : 'Assign Mgr'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push({ pathname: '/admin-assign-dealer', params: { type: 'lead', id: l.id, label: `${l.name} (${l.phone})` } })} style={[styles.actBtn, { backgroundColor: '#FFF8E6', borderColor: theme.colors.primary }]}>
                  <Text style={[styles.actLbl, { color: theme.colors.primary }]}>{l.assigned_dealer_user_ids?.length ? 'Reassign Dealer' : 'Assign Dealer'}</Text>
                </TouchableOpacity>
                {STATUSES.filter(s => s !== l.status).map(s => (
                  <TouchableOpacity key={s} onPress={() => updateStatus(l, s)} style={[styles.actBtn, s === 'purchased' && { backgroundColor: '#E6F7E9', borderColor: '#34C759' }]}>
                    <Text style={[styles.actLbl, s === 'purchased' && { color: '#34C759' }]}>{s === 'purchased' ? 'Mark Purchased (+500)' : `\u2192 ${s}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Lead modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Add Lead (received via call)</Text>
              <Text style={styles.field}>Customer name *</Text>
              <TextInput placeholder="Full name" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
              <Text style={styles.field}>Phone *</Text>
              <TextInput placeholder="+919876543210" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
              <Text style={styles.field}>Equipment interest</Text>
              <TextInput placeholder="e.g. Tiller, Plough" placeholderTextColor={theme.colors.textMuted} value={interest} onChangeText={setInterest} style={styles.input} />
              <Text style={styles.field}>Notes (optional)</Text>
              <TextInput placeholder="Caller details, follow-up time…" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} />

              <Text style={styles.field}>Assign to managers</Text>
              <TouchableOpacity onPress={() => { setAllMgrs(v => !v); if (!allMgrs) setSelectedMgrs([]); }} style={styles.allMgrBtn}>
                <Ionicons name={allMgrs ? 'checkbox' : 'square-outline'} size={20} color={allMgrs ? theme.colors.secondary : theme.colors.textMuted} />
                <Text style={styles.allMgrTxt}>All Lead Managers ({managers.length})</Text>
              </TouchableOpacity>
              {managers.length === 0 ? (
                <Text style={styles.empty}>No managers with Leads permission. Add one in Manage Managers.</Text>
              ) : managers.map((m: any) => {
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

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setShowAdd(false)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={submitAdd} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Save Lead</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign modal */}
      <Modal visible={!!assignTarget} animationType="slide" transparent onRequestClose={() => setAssignTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Assign lead</Text>
              <Text style={styles.modalSub}>{assignTarget?.name} · {assignTarget?.phone}</Text>
              <Text style={styles.field}>Assign to</Text>
              <TouchableOpacity onPress={() => { setAllMgrs(v => !v); if (!allMgrs) setSelectedMgrs([]); }} style={styles.allMgrBtn}>
                <Ionicons name={allMgrs ? 'checkbox' : 'square-outline'} size={20} color={allMgrs ? theme.colors.secondary : theme.colors.textMuted} />
                <Text style={styles.allMgrTxt}>All Lead Managers ({managers.length})</Text>
              </TouchableOpacity>
              {managers.map((m: any) => {
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
              <Text style={styles.field}>Note (optional)</Text>
              <TextInput placeholder="Sent via SMS to manager" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity onPress={() => setAssignTarget(null)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Close</Text></TouchableOpacity>
                <TouchableOpacity onPress={submitAssign} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Assign + Notify</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<any | null>(null);
  const [delta, setDelta] = useState('500');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const path = q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users';
      const r = await api.get(path); setUsers(r.data);
    } finally { setLoading(false); }
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const d = parseInt(delta, 10);
    if (!d || isNaN(d)) { Alert.alert('Invalid', 'Enter a non-zero integer'); return; }
    if (!reason.trim()) { Alert.alert('Missing', 'Reason is required'); return; }
    setBusy(true);
    try {
      await api.post('/admin/points/adjust', { user_id: target.id, delta: d, reason });
      Alert.alert('Done', `${d > 0 ? 'Credited' : 'Debited'} ${Math.abs(d)} pts to ${target.name || target.phone}.`);
      setTarget(null); setDelta('500'); setReason('');
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput placeholder="Search name / phone" placeholderTextColor={theme.colors.textMuted} value={q} onChangeText={setQ} onSubmitEditing={load} style={styles.searchInput} />
        </View>
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {users.map(u => (
            <View key={u.id} style={styles.userCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.uName}>{u.name || '—'}  <Text style={styles.uRole}>{u.role}</Text></Text>
                <Text style={styles.uSub}>{u.phone || u.email}</Text>
                <Text style={styles.uPoints}>{u.points || 0} pts  \u00B7  \u20B9{u.points || 0}</Text>
              </View>
              <TouchableOpacity onPress={() => setTarget(u)} style={styles.adjBtn}>
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.adjLbl}>Adjust</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      <Modal visible={!!target} animationType="slide" transparent onRequestClose={() => setTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Adjust points</Text>
            <Text style={styles.modalSub}>{target?.name || target?.phone}  \u00B7  current {target?.points || 0} pts</Text>
            <Text style={styles.field}>Delta (+ to credit, - to debit)</Text>
            <TextInput keyboardType="numeric" value={delta} onChangeText={setDelta} style={styles.input} />
            <Text style={styles.field}>Reason *</Text>
            <TextInput placeholder="e.g. Festival bonus / discount on offline order" placeholderTextColor={theme.colors.textMuted} value={reason} onChangeText={setReason} multiline style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setTarget(null)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={submit} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Apply</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  addBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addLbl: { color: '#fff', fontWeight: '700', fontSize: 12 },
  callTag: { fontSize: 9, color: '#0A84FF', fontWeight: '800', letterSpacing: 1 },
  allMgrBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FFFBEA', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  allMgrTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  mgrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6 },
  mgrRowOn: { backgroundColor: '#E6F7E9', borderColor: theme.colors.secondary },
  mgrName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  mgrPhone: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8 },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1 },
  chipTxtActive: { color: '#fff' },
  empty: { textAlign: 'center', paddingVertical: 30, color: theme.colors.textMuted },
  leadCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  leadHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leadName: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  leadSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  leadRef: { fontSize: 11, color: theme.colors.textMuted, marginTop: 8 },
  awardTag: { fontSize: 11, fontWeight: '700', color: theme.colors.secondary, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F4F4F4', borderRadius: 999, borderWidth: 1, borderColor: '#E0E0E0' },
  actLbl: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6 },
  searchInput: { flex: 1, paddingVertical: 10, color: theme.colors.textPrimary },
  userCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, gap: 10, alignItems: 'center' },
  uName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  uRole: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '600' },
  uSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  uPoints: { fontSize: 12, color: theme.colors.secondary, fontWeight: '700', marginTop: 4 },
  adjBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  adjLbl: { color: '#fff', fontWeight: '700', fontSize: 12 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  modalSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
