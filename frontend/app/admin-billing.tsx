/**
 * Admin Billing Hub — single screen with 3 tabs:
 *   • Customers   — GSTIN-aware customer master CRUD
 *   • Quotations  — list + create quote → preview PDF → convert to invoice
 *   • Invoices    — list + create tax-invoice → preview PDF
 *
 * Item-line picker pulls from the catalog so HSN code + GST rate auto-fill.
 * Each new line can also be a free-form item if the admin types a custom name.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError, formatINR } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';
import { useRouter } from 'expo-router';

const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

// ───────── helpers ─────────
type Tab = 'invoices' | 'quotations' | 'customers';
type Customer = any; type Item = any; type Doc = any;

const stateName = (code?: string) => (code ? STATES[code] || code : '—');
const STATES: Record<string, string> = {
  '01':'J&K','02':'HP','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan',
  '09':'Uttar Pradesh','10':'Bihar','19':'West Bengal','22':'Chhattisgarh','23':'MP','24':'Gujarat','27':'Maharashtra',
  '29':'Karnataka','30':'Goa','32':'Kerala','33':'Tamil Nadu','36':'Telangana','37':'Andhra Pradesh',
};

export default function AdminBilling() {
  const [tab, setTab] = useState<Tab>('invoices');
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Billing</Text>
        <TouchableOpacity onPress={() => router.push('/admin-company-settings')}><Ionicons name="business" size={24} color={theme.colors.primary} /></TouchableOpacity>
      </View>
      <View style={s.tabRow}>
        {(['invoices', 'quotations', 'customers'] as Tab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'customers' && <CustomersTab />}
      {tab === 'quotations' && <DocsTab kind="quotation" />}
      {tab === 'invoices' && <DocsTab kind="invoice" />}
    </SafeAreaView>
  );
}

// ───────── Customers ─────────
function CustomersTab() {
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.get('/admin/billing/customers'); setList(r.data); }
    catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (c: Customer) => Alert.alert('Delete customer?', c.name, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`/admin/billing/customers/${c.id}`); load(); } },
  ]);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity testID="add-customer" onPress={() => setEdit({ name: '', gstin: '', billing_state_code: '09' })} style={s.addBtn}>
        <Ionicons name="add" size={18} color="#fff" /><Text style={s.addLbl}>Add Customer</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {list.length === 0 ? <Text style={s.empty}>No customers. Tap "Add Customer".</Text> : list.map(c => (
          <View key={c.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{c.name}</Text>
              {c.gstin ? <Text style={s.metaTxt}>GSTIN: {c.gstin}  ·  {stateName(c.billing_state_code)}</Text> : <Text style={s.metaTxt}>Unregistered  ·  {stateName(c.billing_state_code)}</Text>}
              <Text style={s.metaTxt}>{c.phone || '—'}  ·  {c.billing_city || ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setEdit(c)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color={theme.colors.primary} /></TouchableOpacity>
            <TouchableOpacity onPress={() => remove(c)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      {edit && <CustomerEditor customer={edit} onClose={() => { setEdit(null); load(); }} />}
    </View>
  );
}

function CustomerEditor({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [c, setC] = useState<Customer>(customer);
  const [busy, setBusy] = useState(false);
  const isNew = !c.id;
  const setF = (k: string, v: any) => setC((p: Customer) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!c.name?.trim()) { Alert.alert('Missing', 'Name is required'); return; }
    setBusy(true);
    try {
      if (isNew) await api.post('/admin/billing/customers', c);
      else await api.patch(`/admin/billing/customers/${c.id}`, c);
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={s.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>{isNew ? 'Add Customer' : 'Edit Customer'}</Text>
            {([
              ['name', 'Customer / Buyer name *'],
              ['gstin', 'GSTIN (15 chars, optional for B2C)'],
              ['contact_person', 'Contact person'],
              ['phone', 'Phone'], ['email', 'Email'],
              ['billing_address_line1', 'Billing Address Line 1'],
              ['billing_address_line2', 'Billing Address Line 2'],
              ['billing_city', 'City'], ['billing_pincode', 'Pincode'],
              ['billing_state_code', 'State Code (e.g. 09 for UP, 27 for MH)'],
              ['payment_terms', 'Payment Terms'],
            ] as [string, string][]).map(([k, lbl]) => (
              <View key={k}>
                <Text style={s.field}>{lbl}</Text>
                <TextInput placeholder={lbl} placeholderTextColor={theme.colors.textMuted} value={c[k] || ''} onChangeText={v => setF(k, v)} style={s.input} autoCapitalize={k === 'gstin' || k === 'pan' ? 'characters' : 'none'} />
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

// ───────── Quotations + Invoices (shared) ─────────
function DocsTab({ kind }: { kind: 'quotation' | 'invoice' }) {
  const [list, setList] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const path = kind === 'quotation' ? '/admin/billing/quotations' : '/admin/billing/invoices';

  const load = useCallback(async () => {
    try { const r = await api.get(path); setList(r.data); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, [path]);
  useEffect(() => { load(); }, [load]);

  const openPdf = (id: string) => {
    const url = `${BACKEND}/api${path}/${id}/pdf`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => Alert.alert('PDF', 'Open in browser failed.'));
    }
  };

  const convert = async (q: Doc) => {
    try {
      const r = await api.post(`/admin/billing/quotations/${q.id}/convert`);
      Alert.alert('Converted', `Invoice ${r.data.number} created.`);
      load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
  };

  const del = (doc: Doc) => Alert.alert('Delete?', doc.number, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.delete(`${path}/${doc.id}`); load(); } },
  ]);

  const [ewayInv, setEwayInv] = useState<Doc | null>(null);

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity testID={`add-${kind}`} onPress={() => setShowCreate(true)} style={s.addBtn}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={s.addLbl}>{kind === 'quotation' ? 'New Quotation' : 'New Tax Invoice'}</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {list.length === 0 ? <Text style={s.empty}>No {kind}s yet.</Text> : list.map(d => (
          <View key={d.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.docNum}>{d.number}</Text>
                {d.status === 'converted' && <View style={s.tag}><Text style={s.tagTxt}>CONVERTED</Text></View>}
              </View>
              <Text style={s.metaTxt} numberOfLines={1}>{d.buyer?.name}</Text>
              <Text style={s.metaTxt}>{new Date(d.date).toLocaleDateString('en-IN')}  ·  {formatINR(d.totals?.grand_total || 0)}  ·  {d.totals?.intra_state ? 'CGST+SGST' : 'IGST'}</Text>
              {kind === 'invoice' && d.eway_bill_no ? (
                <Text style={[s.metaTxt, { color: '#0A84FF', fontWeight: '700' }]} numberOfLines={1}>e-Way: {d.eway_bill_no}</Text>
              ) : null}
            </View>
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={() => openPdf(d.id)} style={[s.iconBtn, { backgroundColor: '#FFF8E6' }]}><Ionicons name="document-text" size={18} color={theme.colors.primary} /></TouchableOpacity>
              {kind === 'invoice' && (
                <TouchableOpacity onPress={() => setEwayInv(d)} style={[s.iconBtn, { backgroundColor: '#E0F0FF' }]}>
                  <Ionicons name={d.eway_bill_no ? 'checkmark-circle' : 'car-outline'} size={18} color="#0A84FF" />
                </TouchableOpacity>
              )}
              {kind === 'quotation' && d.status !== 'converted' && (
                <TouchableOpacity onPress={() => convert(d)} style={[s.iconBtn, { backgroundColor: '#E6F7E9' }]}><Ionicons name="arrow-forward-circle" size={18} color="#34C759" /></TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => del(d)} style={[s.iconBtn, { backgroundColor: '#FDE8E8' }]}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {showCreate && <DocEditor kind={kind} onClose={() => { setShowCreate(false); load(); }} />}
      {ewayInv && <EwayBillModal invoice={ewayInv} onClose={() => { setEwayInv(null); load(); }} />}
    </View>
  );
}

function EwayBillModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const [eb, setEb] = useState(invoice.eway_bill_no || '');
  const [ebDate, setEbDate] = useState(invoice.eway_bill_date || '');
  const [veh, setVeh] = useState(invoice.vehicle_no || '');
  const [tmode, setTmode] = useState(invoice.transport_mode || 'Road');
  const [tname, setTname] = useState(invoice.transporter_name || '');
  const [tid, setTid] = useState(invoice.transporter_id || '');
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  const save = async () => {
    if (!eb.trim()) { Alert.alert('Missing', 'Enter the e-Way Bill number'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/billing/invoices/${invoice.id}/eway-bill`, {
        eway_bill_no: eb, eway_bill_date: ebDate, vehicle_no: veh, transport_mode: tmode,
        transporter_name: tname, transporter_id: tid,
      });
      Alert.alert('Saved', 'e-Way Bill attached to invoice');
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const generate = async () => {
    setGenBusy(true);
    try {
      const r = await api.post(`/admin/billing/invoices/${invoice.id}/generate-eway`);
      Alert.alert('Generated', JSON.stringify(r.data));
      onClose();
    } catch (e: any) {
      Alert.alert('e-Way Bill GSP', formatApiError(e) + '\n\nFor now use Manual Entry below.');
    } finally { setGenBusy(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={s.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>e-Way Bill — {invoice.number}</Text>
            <Text style={[s.metaTxt, { padding: 10, backgroundColor: '#FFFBEA', borderRadius: 8, marginVertical: 8 }]}>
              GSP integration (Cygnet/NIC/etc.) is pending credentials. Until then, generate the e-Way Bill on the GST portal manually and paste the 12-digit number below to attach it to the invoice & PDF.
            </Text>
            <TouchableOpacity onPress={generate} disabled={genBusy} style={[s.btn, { backgroundColor: '#0A84FF', marginBottom: 12 }]}>
              {genBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Auto-Generate via GSP (pending creds)</Text>}
            </TouchableOpacity>

            <Text style={s.field}>e-Way Bill No. *</Text>
            <TextInput placeholder="12-digit number" placeholderTextColor={theme.colors.textMuted} value={eb} onChangeText={setEb} keyboardType="numeric" maxLength={12} style={s.input} />
            <Text style={s.field}>Date</Text>
            <TextInput placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} value={ebDate} onChangeText={setEbDate} style={s.input} />
            <Text style={s.field}>Vehicle No.</Text>
            <TextInput placeholder="e.g. UP14AB1234" placeholderTextColor={theme.colors.textMuted} value={veh} onChangeText={setVeh} style={s.input} />
            <Text style={s.field}>Transport Mode</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['Road', 'Rail', 'Air', 'Ship'].map(m => (
                <TouchableOpacity key={m} onPress={() => setTmode(m)} style={[s.chip, tmode === m && s.chipOn]}><Text style={[s.chipTxt, tmode === m && s.chipTxtOn]}>{m.toUpperCase()}</Text></TouchableOpacity>
              ))}
            </View>
            <Text style={s.field}>Transporter Name</Text>
            <TextInput placeholder="Optional" placeholderTextColor={theme.colors.textMuted} value={tname} onChangeText={setTname} style={s.input} />
            <Text style={s.field}>Transporter ID</Text>
            <TextInput placeholder="Optional 15-char GST or transporter ID" placeholderTextColor={theme.colors.textMuted} value={tid} onChangeText={setTid} style={s.input} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={onClose} style={[s.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[s.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={busy} style={[s.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Save Manual Entry</Text>}</TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DocEditor({ kind, onClose }: { kind: 'quotation' | 'invoice'; onClose: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [customer_id, setCustomerId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState(''); const [terms, setTerms] = useState('');
  const [poNum, setPoNum] = useState(''); const [vehNum, setVehNum] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/billing/customers'), api.get('/admin/billing/catalog-items')])
      .then(([cR, iR]) => { setCustomers(cR.data); setCatalog(iR.data); })
      .catch(() => {});
  }, []);

  const addLine = () => setItems([...items, { name: '', hsn_code: '843290', qty: 1, unit: 'NOS', rate: 0, discount_pct: 0, gst_rate: 5 }]);
  const setLine = (i: number, k: string, v: any) => { const next = [...items]; next[i] = { ...next[i], [k]: v }; setItems(next); };
  const rmLine = (i: number) => setItems(items.filter((_, x) => x !== i));
  const pickFromCatalog = (i: number, p: Item) => setLine(i, 'name', p.name) && setItems(prev => prev.map((it, x) => x === i ? { ...it, name: p.name, description: p.description || '', hsn_code: p.hsn_code, gst_rate: p.gst_rate, unit: p.unit, rate: p.rate } : it));

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);

  const save = async () => {
    if (!customer_id) { Alert.alert('Missing', 'Select a customer'); return; }
    if (items.length === 0) { Alert.alert('Missing', 'Add at least one item'); return; }
    setBusy(true);
    try {
      const path = kind === 'quotation' ? '/admin/billing/quotations' : '/admin/billing/invoices';
      const body: any = { customer_id, items: items.map(it => ({ ...it, qty: Number(it.qty), rate: Number(it.rate), discount_pct: Number(it.discount_pct || 0), gst_rate: Number(it.gst_rate) })), notes, terms };
      if (kind === 'invoice') { body.po_number = poNum; body.vehicle_no = vehNum; }
      const r = await api.post(path, body);
      Alert.alert('Saved', `${r.data.number} created. Tap the doc icon to preview the PDF.`);
      onClose();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={[s.modal, { maxHeight: '95%' }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>{kind === 'quotation' ? 'New Quotation' : 'New Tax Invoice'}</Text>

            <Text style={s.field}>Customer *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {customers.map(c => (
                <TouchableOpacity key={c.id} onPress={() => setCustomerId(c.id)} style={[s.chip, customer_id === c.id && s.chipOn]}>
                  <Text style={[s.chipTxt, customer_id === c.id && s.chipTxtOn]}>{c.name}{c.gstin ? '  · GST' : ''}</Text>
                </TouchableOpacity>
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
                    <TouchableOpacity key={p.id} onPress={() => pickFromCatalog(i, p)} style={s.catChip}>
                      <Text style={s.catChipTxt} numberOfLines={1}>{p.name}</Text>
                    </TouchableOpacity>
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
                  <TextInput placeholder="Rate ₹" keyboardType="numeric" value={String(it.rate)} onChangeText={v => setLine(i, 'rate', v)} style={[s.input, { flex: 1 }]} />
                  <TextInput placeholder="Disc %" keyboardType="numeric" value={String(it.discount_pct)} onChangeText={v => setLine(i, 'discount_pct', v)} style={[s.input, { width: 70 }]} />
                </View>
                <Text style={s.lineTotal}>= {formatINR((Number(it.qty) || 0) * (Number(it.rate) || 0) * (1 - (Number(it.discount_pct) || 0) / 100) * (1 + (Number(it.gst_rate) || 0) / 100))}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={addLine} style={s.addLineBtn}>
              <Ionicons name="add" size={18} color={theme.colors.primary} />
              <Text style={[s.addLbl, { color: theme.colors.primary }]}>Add line</Text>
            </TouchableOpacity>

            <Text style={s.field}>Notes</Text>
            <TextInput placeholder="Optional notes" placeholderTextColor={theme.colors.textMuted} value={notes} onChangeText={setNotes} multiline style={[s.input, { minHeight: 50 }]} />
            <Text style={s.field}>Terms</Text>
            <TextInput placeholder="Optional T&C overrides" placeholderTextColor={theme.colors.textMuted} value={terms} onChangeText={setTerms} multiline style={[s.input, { minHeight: 50 }]} />

            {kind === 'invoice' && (
              <>
                <Text style={s.field}>Customer P.O.</Text>
                <TextInput placeholder="P.O. number / ref" placeholderTextColor={theme.colors.textMuted} value={poNum} onChangeText={setPoNum} style={s.input} />
                <Text style={s.field}>Vehicle No.</Text>
                <TextInput placeholder="e.g. UP14AB1234" placeholderTextColor={theme.colors.textMuted} value={vehNum} onChangeText={setVehNum} style={s.input} />
              </>
            )}

            <View style={s.previewBar}>
              <Text style={s.previewTxt}>Subtotal preview: {formatINR(subtotal)}</Text>
              <Text style={s.previewSub}>Final total (with GST + round-off) appears on the PDF.</Text>
            </View>

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
  tag: { backgroundColor: '#34C75922', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagTxt: { fontSize: 9, color: '#34C759', fontWeight: '800' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 13, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F4F4F4', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  chipTxtOn: { color: '#fff' },
  catChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FFFBEA', borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 160 },
  catChipTxt: { fontSize: 10, color: theme.colors.textPrimary, fontWeight: '700' },
  lineCard: { backgroundColor: '#FAFAFA', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  lineHead: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 },
  lineTotal: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, textAlign: 'right', marginTop: 4 },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF8E6', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary, marginBottom: 4 },
  previewBar: { backgroundColor: '#F0F8FF', padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#0A84FF' },
  previewTxt: { fontSize: 14, fontWeight: '800', color: '#0A84FF' },
  previewSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
