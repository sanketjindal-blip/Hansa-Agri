/**
 * Admin Purchase — Vendors + Purchase Orders (2 tabs).
 * GST-aware POs (vendor-state vs our-state determines IGST vs CGST+SGST).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError, formatINR } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

const STATES: Record<string, string> = {
  '01': 'J&K', '02': 'HP', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar',
  '19': 'West Bengal', '22': 'Chhattisgarh', '23': 'MP', '24': 'Gujarat', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'AP',
};
const stateName = (c?: string) => (c ? STATES[c] || c : '\u2014');

type Tab = 'po' | 'vendors';

export default function AdminPurchase() {
  const [tab, setTab] = useState<Tab>('po');
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Purchase</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.tabRow}>
        <TouchableOpacity onPress={() => setTab('po')} style={[s.tab, tab === 'po' && s.tabOn]}><Text style={[s.tabTxt, tab === 'po' && s.tabTxtOn]}>PURCHASE ORDERS</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('vendors')} style={[s.tab, tab === 'vendors' && s.tabOn]}><Text style={[s.tabTxt, tab === 'vendors' && s.tabTxtOn]}>VENDORS</Text></TouchableOpacity>
      </View>
      {tab === 'vendors' ? <VendorsTab /> : <POsTab />}
    </SafeAreaView>
  );
}

// ───────── Vendors ─────────
function VendorsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const load = useCallback(async () => {
    try { const r = await api.get('/admin/billing/vendors'); setList(r.data); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const remove = (v: any) => Alert.alert('Delete vendor?', v.name, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/admin/billing/vendors/${v.id}`); load(); } },
  ]);
  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setEdit({ name: '', gstin: '', state_code: '09' })} style={s.addBtn}><Ionicons name="add" size={18} color="#fff" /><Text style={s.addLbl}>Add Vendor</Text></TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {list.length === 0 ? <Text style={s.empty}>No vendors yet.</Text> : list.map(v => (
          <View key={v.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{v.name}</Text>
              {v.gstin ? <Text style={s.metaTxt}>GSTIN: {v.gstin}  ·  {stateName(v.state_code)}</Text> : <Text style={s.metaTxt}>Unregistered  ·  {stateName(v.state_code)}</Text>}
              <Text style={s.metaTxt}>{v.phone || '\u2014'}  ·  {v.city || ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setEdit(v)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color={theme.colors.primary} /></TouchableOpacity>
            <TouchableOpacity onPress={() => remove(v)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      {edit && <VendorEditor vendor={edit} onClose={() => { setEdit(null); load(); }} />}
    </View>
  );
}

function VendorEditor({ vendor, onClose }: { vendor: any; onClose: () => void }) {
  const [v, setV] = useState<any>(vendor);
  const [busy, setBusy] = useState(false);
  const isNew = !v.id;
  const setF = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));
  const save = async () => {
    if (!v.name?.trim()) { Alert.alert('Missing', 'Name is required'); return; }
    setBusy(true);
    try {
      if (isNew) await api.post('/admin/billing/vendors', v);
      else await api.patch(`/admin/billing/vendors/${v.id}`, v);
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={s.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>{isNew ? 'Add Vendor' : 'Edit Vendor'}</Text>
            {([
              ['name', 'Vendor / Supplier name *'],
              ['gstin', 'GSTIN'],
              ['contact_person', 'Contact person'],
              ['phone', 'Phone'], ['email', 'Email'],
              ['address_line1', 'Address Line 1'], ['address_line2', 'Address Line 2'],
              ['city', 'City'], ['pincode', 'Pincode'],
              ['state_code', 'State Code (e.g. 27 for MH)'],
              ['payment_terms', 'Payment Terms'],
              ['bank_name', 'Bank Name'], ['bank_account', 'Bank A/c'], ['bank_ifsc', 'IFSC'],
            ] as [string, string][]).map(([k, lbl]) => (
              <View key={k}>
                <Text style={s.field}>{lbl}</Text>
                <TextInput placeholder={lbl} placeholderTextColor={theme.colors.textMuted} value={v[k] || ''} onChangeText={val => setF(k, val)} style={s.input} autoCapitalize={k === 'gstin' || k === 'bank_ifsc' ? 'characters' : 'none'} />
              </View>
            ))}
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

// ───────── POs ─────────
function POsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/admin/billing/purchase-orders'); setList(r.data); } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openPdf = (id: string) => {
    const url = `${BACKEND}/api/admin/billing/purchase-orders/${id}/pdf`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url).catch(() => Alert.alert('PDF', 'Open in browser failed.'));
  };
  const del = (p: any) => Alert.alert('Delete PO?', p.number, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/admin/billing/purchase-orders/${p.id}`); load(); } },
  ]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setShowCreate(true)} style={s.addBtn}><Ionicons name="add" size={18} color="#fff" /><Text style={s.addLbl}>New Purchase Order</Text></TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {list.length === 0 ? <Text style={s.empty}>No purchase orders yet.</Text> : list.map(p => (
          <View key={p.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.docNum}>{p.number}</Text>
              <Text style={s.metaTxt} numberOfLines={1}>{p.vendor?.name}</Text>
              <Text style={s.metaTxt}>{new Date(p.date).toLocaleDateString('en-IN')}  ·  {formatINR(p.totals?.grand_total || 0)}  ·  {p.totals?.intra_state ? 'CGST+SGST' : 'IGST'}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => openPdf(p.id)} style={[s.iconBtn, { backgroundColor: '#FFF8E6' }]}><Ionicons name="document-text" size={18} color={theme.colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => del(p)} style={[s.iconBtn, { backgroundColor: '#FDE8E8' }]}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {showCreate && <POEditor onClose={() => { setShowCreate(false); load(); }} />}
    </View>
  );
}

function POEditor({ onClose }: { onClose: () => void }) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [vendor_id, setVendorId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/billing/vendors'), api.get('/admin/billing/catalog-items')])
      .then(([vR, iR]) => { setVendors(vR.data); setCatalog(iR.data); }).catch(() => {});
  }, []);

  const addLine = () => setItems([...items, { name: '', hsn_code: '843290', qty: 1, unit: 'NOS', rate: 0, discount_pct: 0, gst_rate: 18 }]);
  const setLine = (i: number, k: string, val: any) => { const nx = [...items]; nx[i] = { ...nx[i], [k]: val }; setItems(nx); };
  const rmLine = (i: number) => setItems(items.filter((_, x) => x !== i));
  const pickCat = (i: number, p: any) => setItems(prev => prev.map((it, x) => x === i ? { ...it, name: p.name, description: p.description || '', hsn_code: p.hsn_code, gst_rate: p.gst_rate, unit: p.unit, rate: p.rate } : it));

  const save = async () => {
    if (!vendor_id) { Alert.alert('Missing', 'Select a vendor'); return; }
    if (items.length === 0) { Alert.alert('Missing', 'Add at least one item'); return; }
    setBusy(true);
    try {
      const body = {
        vendor_id,
        items: items.map(it => ({ ...it, qty: Number(it.qty), rate: Number(it.rate), discount_pct: Number(it.discount_pct || 0), gst_rate: Number(it.gst_rate) })),
        expected_delivery: expectedDelivery, notes, terms,
      };
      const r = await api.post('/admin/billing/purchase-orders', body);
      Alert.alert('Saved', `${r.data.number} created.`);
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={[s.modal, { maxHeight: '95%' }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>New Purchase Order</Text>

            <Text style={s.field}>Vendor *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {vendors.map(v => (
                <TouchableOpacity key={v.id} onPress={() => setVendorId(v.id)} style={[s.chip, vendor_id === v.id && s.chipOn]}>
                  <Text style={[s.chipTxt, vendor_id === v.id && s.chipTxtOn]}>{v.name}{v.gstin ? '  · GST' : ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {vendors.length === 0 && <Text style={s.note2}>No vendors yet — add one in the Vendors tab first.</Text>}

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
                  <TextInput placeholder="GST %" keyboardType="numeric" value={String(it.gst_rate)} onChangeText={v => setLine(i, 'gst_rate', v)} style={[s.input, { width: 70 }]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput placeholder="Qty" keyboardType="numeric" value={String(it.qty)} onChangeText={v => setLine(i, 'qty', v)} style={[s.input, { flex: 1 }]} />
                  <TextInput placeholder="Rate \u20b9" keyboardType="numeric" value={String(it.rate)} onChangeText={v => setLine(i, 'rate', v)} style={[s.input, { flex: 1 }]} />
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={addLine} style={s.addLineBtn}><Ionicons name="add" size={18} color={theme.colors.primary} /><Text style={[s.addLbl, { color: theme.colors.primary }]}>Add line</Text></TouchableOpacity>

            <Text style={s.field}>Expected Delivery</Text>
            <TextInput placeholder="e.g. 2026-06-15" placeholderTextColor={theme.colors.textMuted} value={expectedDelivery} onChangeText={setExpectedDelivery} style={s.input} />
            <Text style={s.field}>Notes</Text>
            <TextInput placeholder="Optional notes" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[s.input, { minHeight: 50 }]} />
            <Text style={s.field}>Terms</Text>
            <TextInput placeholder="Optional T&C" placeholderTextColor={theme.colors.textMuted} value={terms} onChangeText={setTerms} multiline style={[s.input, { minHeight: 50 }]} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={onClose} style={[s.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[s.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={busy} style={[s.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Save & Generate</Text>}</TouchableOpacity>
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
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  docNum: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },
  metaTxt: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F4' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  note2: { fontSize: 10, color: theme.colors.textMuted, marginTop: 4 },
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
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
