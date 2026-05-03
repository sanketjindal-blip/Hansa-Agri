/**
 * Admin Delivery — Delivery Challans + Gate Passes (2 tabs).
 *  • DC supports `apply_gst` toggle (Sale → tax-bearing | Job-work → no GST).
 *  • Gate Pass supports one-click generation from a chosen DC/Invoice.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl, Linking, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError, formatINR } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

type Tab = 'dc' | 'gp';

export default function AdminDelivery() {
  const [tab, setTab] = useState<Tab>('dc');
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Delivery</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.tabRow}>
        <TouchableOpacity onPress={() => setTab('dc')} style={[s.tab, tab === 'dc' && s.tabOn]}><Text style={[s.tabTxt, tab === 'dc' && s.tabTxtOn]}>DELIVERY CHALLAN</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('gp')} style={[s.tab, tab === 'gp' && s.tabOn]}><Text style={[s.tabTxt, tab === 'gp' && s.tabTxtOn]}>GATE PASS</Text></TouchableOpacity>
      </View>
      {tab === 'dc' ? <DCTab /> : <GPTab />}
    </SafeAreaView>
  );
}

// ───────── Delivery Challan ─────────
function DCTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/admin/billing/delivery-challans'); setList(r.data); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openPdf = (id: string) => {
    const url = `${BACKEND}/api/admin/billing/delivery-challans/${id}/pdf`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(() => Alert.alert('PDF', 'Open in browser failed.'));
  };
  const del = (d: any) => Alert.alert('Delete?', d.number, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/admin/billing/delivery-challans/${d.id}`); load(); } },
  ]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setShowCreate(true)} style={s.addBtn}><Ionicons name="add" size={18} color="#fff" /><Text style={s.addLbl}>New Delivery Challan</Text></TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {list.length === 0 ? <Text style={s.empty}>No delivery challans yet.</Text> : list.map(d => (
          <View key={d.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.docNum}>{d.number}</Text>
                {!d.apply_gst && <View style={s.tagOrange}><Text style={s.tagTxt}>JOB-WORK</Text></View>}
              </View>
              <Text style={s.metaTxt} numberOfLines={1}>{d.buyer?.name}</Text>
              <Text style={s.metaTxt}>{new Date(d.date).toLocaleDateString('en-IN')}  ·  {formatINR(d.totals?.grand_total || 0)}  ·  {(d.purpose || '').toUpperCase()}{d.vehicle_no ? `  ·  ${d.vehicle_no}` : ''}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => openPdf(d.id)} style={[s.iconBtn, { backgroundColor: '#FFF8E6' }]}><Ionicons name="document-text" size={18} color={theme.colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => del(d)} style={[s.iconBtn, { backgroundColor: '#FDE8E8' }]}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {showCreate && <DCEditor onClose={() => { setShowCreate(false); load(); }} />}
    </View>
  );
}

function DCEditor({ onClose }: { onClose: () => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [customer_id, setCustomerId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [purpose, setPurpose] = useState('sale');
  const [applyGst, setApplyGst] = useState(true);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/billing/customers'), api.get('/admin/billing/catalog-items')])
      .then(([cR, iR]) => { setCustomers(cR.data); setCatalog(iR.data); }).catch(() => {});
  }, []);

  const addLine = () => setItems([...items, { name: '', hsn_code: '843290', qty: 1, unit: 'NOS', rate: 0, discount_pct: 0, gst_rate: 5 }]);
  const setLine = (i: number, k: string, v: any) => { const nx = [...items]; nx[i] = { ...nx[i], [k]: v }; setItems(nx); };
  const rmLine = (i: number) => setItems(items.filter((_, x) => x !== i));
  const pickCat = (i: number, p: any) => setItems(prev => prev.map((it, x) => x === i ? { ...it, name: p.name, description: p.description || '', hsn_code: p.hsn_code, gst_rate: p.gst_rate, unit: p.unit, rate: p.rate } : it));

  const save = async () => {
    if (!customer_id) { Alert.alert('Missing', 'Select a customer'); return; }
    if (items.length === 0) { Alert.alert('Missing', 'Add at least one item'); return; }
    setBusy(true);
    try {
      const body = {
        customer_id, purpose, apply_gst: applyGst,
        items: items.map(it => ({ ...it, qty: Number(it.qty), rate: Number(it.rate), discount_pct: Number(it.discount_pct || 0), gst_rate: Number(it.gst_rate) })),
        vehicle_no: vehicleNo, driver_name: driverName, driver_phone: driverPhone,
        transporter_name: transporterName, notes,
      };
      const r = await api.post('/admin/billing/delivery-challans', body);
      Alert.alert('Saved', `${r.data.number} created.`);
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={[s.modal, { maxHeight: '95%' }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>New Delivery Challan</Text>

            <Text style={s.field}>Customer *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {customers.map(c => (
                <TouchableOpacity key={c.id} onPress={() => setCustomerId(c.id)} style={[s.chip, customer_id === c.id && s.chipOn]}>
                  <Text style={[s.chipTxt, customer_id === c.id && s.chipTxtOn]}>{c.name}{c.gstin ? '  · GST' : ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.field}>Apply GST?</Text>
                <Text style={s.note2}>OFF = Job-work / sample (no tax). ON = tax-bearing DC.</Text>
              </View>
              <Switch value={applyGst} onValueChange={setApplyGst} trackColor={{ true: theme.colors.primary, false: '#ccc' }} />
            </View>

            <Text style={s.field}>Purpose</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {['sale', 'job-work', 'sample', 'approval', 'return'].map(p => (
                <TouchableOpacity key={p} onPress={() => setPurpose(p)} style={[s.chip, purpose === p && s.chipOn]}><Text style={[s.chipTxt, purpose === p && s.chipTxtOn]}>{p.toUpperCase()}</Text></TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.field}>Items</Text>
            {items.map((it, i) => (
              <View key={i} style={s.lineCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.lineHead}>Line {i + 1}</Text>
                  <TouchableOpacity onPress={() => rmLine(i)}><Ionicons name="close-circle" size={20} color={theme.colors.danger} /></TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  {catalog.slice(0, 12).map(p => (
                    <TouchableOpacity key={p.id} onPress={() => pickCat(i, p)} style={s.catChip}><Text style={s.catChipTxt} numberOfLines={1}>{p.name}</Text></TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput placeholder="Item name *" placeholderTextColor={theme.colors.textMuted} value={it.name} onChangeText={v => setLine(i, 'name', v)} style={s.input} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput placeholder="HSN" placeholderTextColor={theme.colors.textMuted} value={it.hsn_code} onChangeText={v => setLine(i, 'hsn_code', v)} style={[s.input, { flex: 1 }]} />
                  <TextInput placeholder="Unit" placeholderTextColor={theme.colors.textMuted} value={it.unit} onChangeText={v => setLine(i, 'unit', v)} style={[s.input, { width: 70 }]} />
                  {applyGst && <TextInput placeholder="GST %" keyboardType="numeric" value={String(it.gst_rate)} onChangeText={v => setLine(i, 'gst_rate', v)} style={[s.input, { width: 70 }]} />}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput placeholder="Qty" keyboardType="numeric" value={String(it.qty)} onChangeText={v => setLine(i, 'qty', v)} style={[s.input, { flex: 1 }]} />
                  <TextInput placeholder="Rate \u20b9" keyboardType="numeric" value={String(it.rate)} onChangeText={v => setLine(i, 'rate', v)} style={[s.input, { flex: 1 }]} />
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={addLine} style={s.addLineBtn}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={[s.addLbl, { color: theme.colors.primary }]}>Add line</Text></TouchableOpacity>

            <Text style={s.field}>Vehicle / Driver</Text>
            <TextInput placeholder="Vehicle No. (e.g. UP14AB1234)" placeholderTextColor={theme.colors.textMuted} value={vehicleNo} onChangeText={setVehicleNo} style={s.input} />
            <TextInput placeholder="Driver Name" placeholderTextColor={theme.colors.textMuted} value={driverName} onChangeText={setDriverName} style={s.input} />
            <TextInput placeholder="Driver Phone" placeholderTextColor={theme.colors.textMuted} value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" style={s.input} />
            <TextInput placeholder="Transporter Name (optional)" placeholderTextColor={theme.colors.textMuted} value={transporterName} onChangeText={setTransporterName} style={s.input} />
            <Text style={s.field}>Notes</Text>
            <TextInput placeholder="Optional notes" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[s.input, { minHeight: 50 }]} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={onClose} style={[s.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[s.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={busy} style={[s.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Save</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ───────── Gate Pass ─────────
function GPTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/admin/billing/gate-passes'); setList(r.data); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openPdf = (id: string) => {
    const url = `${BACKEND}/api/admin/billing/gate-passes/${id}/pdf`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(() => Alert.alert('PDF', 'Open in browser failed.'));
  };
  const del = (g: any) => Alert.alert('Delete?', g.number, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/admin/billing/gate-passes/${g.id}`); load(); } },
  ]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setShowCreate(true)} style={s.addBtn}><Ionicons name="add" size={18} color="#fff" /><Text style={s.addLbl}>New Gate Pass</Text></TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {list.length === 0 ? <Text style={s.empty}>No gate passes yet.</Text> : list.map(g => (
          <View key={g.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.docNum}>{g.number}</Text>
                <View style={[s.tag, g.direction === 'inward' ? { backgroundColor: '#0A84FF22' } : null]}><Text style={[s.tagTxt, g.direction === 'inward' ? { color: '#0A84FF' } : null]}>{(g.direction || 'outward').toUpperCase()}</Text></View>
              </View>
              <Text style={s.metaTxt} numberOfLines={1}>{g.party_name || '—'}</Text>
              <Text style={s.metaTxt}>{new Date(g.date).toLocaleDateString('en-IN')}{g.vehicle_no ? `  ·  ${g.vehicle_no}` : ''}{g.ref_number ? `  ·  ${g.ref_number}` : ''}</Text>
              {g.items_summary ? <Text style={[s.metaTxt, { fontStyle: 'italic' }]} numberOfLines={2}>{g.items_summary}</Text> : null}
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => openPdf(g.id)} style={[s.iconBtn, { backgroundColor: '#FFF8E6' }]}><Ionicons name="document-text" size={18} color={theme.colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => del(g)} style={[s.iconBtn, { backgroundColor: '#FDE8E8' }]}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {showCreate && <GPEditor onClose={() => { setShowCreate(false); load(); }} />}
    </View>
  );
}

function GPEditor({ onClose }: { onClose: () => void }) {
  const [refType, setRefType] = useState<'manual' | 'invoice' | 'delivery_challan'>('delivery_challan');
  const [refList, setRefList] = useState<any[]>([]);
  const [refId, setRefId] = useState('');
  const [direction, setDirection] = useState<'outward' | 'inward'>('outward');
  const [partyName, setPartyName] = useState('');
  const [itemsSummary, setItemsSummary] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (refType === 'manual') { setRefList([]); return; }
    const path = refType === 'invoice' ? '/admin/billing/invoices' : '/admin/billing/delivery-challans';
    api.get(path).then(r => setRefList(r.data)).catch(() => setRefList([]));
  }, [refType]);

  const save = async () => {
    if (refType !== 'manual' && !refId) { Alert.alert('Missing', 'Pick a reference document'); return; }
    if (refType === 'manual' && !partyName.trim()) { Alert.alert('Missing', 'Party name required for manual gate pass'); return; }
    setBusy(true);
    try {
      const body = { ref_type: refType, ref_id: refId || '', direction, party_name: partyName, items_summary: itemsSummary, vehicle_no: vehicleNo, driver_name: driverName, driver_phone: driverPhone, notes };
      const r = await api.post('/admin/billing/gate-passes', body);
      Alert.alert('Saved', `${r.data.number} generated.`);
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={[s.modal, { maxHeight: '95%' }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>New Gate Pass</Text>

            <Text style={s.field}>Direction</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['outward', 'inward'] as const).map(d => (
                <TouchableOpacity key={d} onPress={() => setDirection(d)} style={[s.chip, direction === d && s.chipOn]}><Text style={[s.chipTxt, direction === d && s.chipTxtOn]}>{d.toUpperCase()}</Text></TouchableOpacity>
              ))}
            </View>

            <Text style={s.field}>Generate from</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([['delivery_challan', 'DC'], ['invoice', 'INVOICE'], ['manual', 'MANUAL']] as const).map(([rt, lbl]) => (
                <TouchableOpacity key={rt} onPress={() => { setRefType(rt as any); setRefId(''); }} style={[s.chip, refType === rt && s.chipOn]}><Text style={[s.chipTxt, refType === rt && s.chipTxtOn]}>{lbl}</Text></TouchableOpacity>
              ))}
            </View>

            {refType !== 'manual' && (
              <>
                <Text style={s.field}>Pick reference doc</Text>
                <ScrollView style={{ maxHeight: 220 }}>
                  {refList.length === 0 ? <Text style={s.note2}>No documents available.</Text> : refList.map(r => (
                    <TouchableOpacity key={r.id} onPress={() => setRefId(r.id)} style={[s.refRow, refId === r.id && s.refRowOn]}>
                      <Text style={[s.refTxt, refId === r.id && { color: '#fff' }]}>{r.number}  ·  {r.buyer?.name}</Text>
                      <Text style={[s.refSub, refId === r.id && { color: '#fff' }]}>{new Date(r.date).toLocaleDateString('en-IN')}{r.vehicle_no ? `  ·  ${r.vehicle_no}` : ''}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={s.field}>Party Name {refType === 'manual' ? '*' : '(override)'}</Text>
            <TextInput placeholder="Party / Customer / Vendor" placeholderTextColor={theme.colors.textMuted} value={partyName} onChangeText={setPartyName} style={s.input} />
            <Text style={s.field}>Items Summary</Text>
            <TextInput placeholder="e.g. 5 cartons tillers, 1 spare crate" placeholderTextColor={theme.colors.textMuted} value={itemsSummary} onChangeText={setItemsSummary} multiline style={[s.input, { minHeight: 50 }]} />
            <Text style={s.field}>Vehicle / Driver</Text>
            <TextInput placeholder="Vehicle No." placeholderTextColor={theme.colors.textMuted} value={vehicleNo} onChangeText={setVehicleNo} style={s.input} />
            <TextInput placeholder="Driver Name" placeholderTextColor={theme.colors.textMuted} value={driverName} onChangeText={setDriverName} style={s.input} />
            <TextInput placeholder="Driver Phone" placeholderTextColor={theme.colors.textMuted} value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" style={s.input} />
            <Text style={s.field}>Notes</Text>
            <TextInput placeholder="Optional notes" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[s.input, { minHeight: 40 }]} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={onClose} style={[s.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[s.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={busy} style={[s.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Generate</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, gap: 6, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  tabOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1 },
  tabTxtOn: { color: '#fff' },
  addBtn: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 4, marginHorizontal: 16, marginBottom: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  addLbl: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', paddingVertical: 30, color: theme.colors.textMuted },
  card: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  docNum: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },
  metaTxt: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' },
  tag: { backgroundColor: '#34C75922', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagOrange: { backgroundColor: '#F2A90022', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagTxt: { fontSize: 9, color: '#34C759', fontWeight: '800' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  note2: { fontSize: 10, color: theme.colors.textMuted },
  input: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 13, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F4F4F4', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  chipTxtOn: { color: '#fff' },
  catChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFFBEA', borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 160 },
  catChipTxt: { fontSize: 10, color: theme.colors.textPrimary, fontWeight: '700' },
  lineCard: { backgroundColor: '#FAFAFA', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  lineHead: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF8E6', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary, marginBottom: 4 },
  refRow: { padding: 10, backgroundColor: '#F8F8F8', borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: theme.colors.border },
  refRowOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  refTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  refSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
