/**
 * Admin Reports — GSTR-1 / Sales Register / Customer Ledger / Aging.
 * Each tab fetches a dedicated endpoint and presents a friendly summary.
 * GSTR-1 also exposes a 'Download JSON' button (offline-tool ready).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, formatINR } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

type Tab = 'gstr1' | 'sales' | 'ledger' | 'aging';

export default function AdminReports() {
  const [tab, setTab] = useState<Tab>('gstr1');
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Reports</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {([['gstr1', 'GSTR-1'], ['sales', 'SALES REGISTER'], ['ledger', 'CUSTOMER LEDGER'], ['aging', 'AGING']] as [Tab, string][]).map(([k, lbl]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}><Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>{lbl}</Text></TouchableOpacity>
        ))}
      </ScrollView>
      {tab === 'gstr1' && <GSTR1Tab />}
      {tab === 'sales' && <SalesTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'aging' && <AgingTab />}
    </SafeAreaView>
  );
}

// ───────── GSTR-1 ─────────
function GSTR1Tab() {
  const now = new Date();
  const defaultPeriod = `${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async (p?: string) => {
    setLoading(true);
    try { const r = await api.get(`/admin/billing/reports/gstr1?period=${p || period}`); setData(r.data); } catch (e: any) { Alert.alert('Error', String(e)); } finally { setLoading(false); }
  }, [period]);
  useEffect(() => { load(defaultPeriod); }, []);  // eslint-disable-line

  const downloadJson = () => {
    if (!data?.json) return;
    const txt = JSON.stringify(data.json, null, 2);
    if (Platform.OS === 'web') {
      const blob = new Blob([txt], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `GSTR1_${data.summary.period}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      // Open as data: URL for native — user can copy/share from browser
      Linking.openURL('data:application/json;charset=utf-8,' + encodeURIComponent(txt)).catch(() => Alert.alert('JSON', 'Open in browser failed.'));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={s.note}>GSTR-1 outward supplies summary. Period format MMYYYY (e.g. 052026 = May 2026). The downloadable JSON matches the GSTN offline tool's expected schema (b2b/b2cl/b2cs/hsn).</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput placeholder="MMYYYY" placeholderTextColor={theme.colors.textMuted} value={period} onChangeText={setPeriod} maxLength={6} keyboardType="numeric" style={[s.input, { flex: 1 }]} />
        <TouchableOpacity onPress={() => load()} style={[s.btn, { backgroundColor: theme.colors.primary, paddingHorizontal: 18 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Load</Text>}</TouchableOpacity>
      </View>
      {data && (
        <>
          <View style={s.summaryCard}>
            <Text style={s.summaryHead}>Period {data.summary.period}</Text>
            <Row label="Invoices" value={String(data.summary.invoices_count)} />
            <Row label="B2B invoices" value={String(data.summary.b2b_count)} />
            <Row label="B2C-Large invoices" value={String(data.summary.b2cl_count)} />
            <Row label="B2C-Small lines" value={String(data.summary.b2cs_count)} />
            <Row label="HSN summary lines" value={String(data.summary.hsn_lines)} />
            <View style={s.divider} />
            <Row label="Total taxable" value={formatINR(data.summary.total_taxable)} />
            <Row label="Total CGST" value={formatINR(data.summary.total_cgst)} />
            <Row label="Total SGST" value={formatINR(data.summary.total_sgst)} />
            <Row label="Total IGST" value={formatINR(data.summary.total_igst)} />
            <Row label="Total Value" value={formatINR(data.summary.total_value)} bold />
          </View>
          <TouchableOpacity onPress={downloadJson} style={[s.btn, { backgroundColor: '#0A84FF', marginTop: 12 }]}>
            <Text style={s.btnTxt}>Download GSTR-1 JSON ({data.summary.period})</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ───────── Sales Register ─────────
function SalesTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const r = await api.get(`/admin/billing/reports/sales-register?${params.toString()}`);
      setData(r.data);
    } catch (e: any) { Alert.alert('Error', String(e)); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, []);  // eslint-disable-line

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={s.note}>List all tax invoices in a date range. Empty fields = all dates.</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput placeholder="From (YYYY-MM-DD)" placeholderTextColor={theme.colors.textMuted} value={from} onChangeText={setFrom} style={[s.input, { flex: 1 }]} />
        <TextInput placeholder="To (YYYY-MM-DD)" placeholderTextColor={theme.colors.textMuted} value={to} onChangeText={setTo} style={[s.input, { flex: 1 }]} />
      </View>
      <TouchableOpacity onPress={load} style={[s.btn, { backgroundColor: theme.colors.primary, marginTop: 8 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Apply</Text>}</TouchableOpacity>
      {data && (
        <>
          <View style={s.summaryCard}>
            <Text style={s.summaryHead}>Totals · {data.totals.count} invoices</Text>
            <Row label="Taxable" value={formatINR(data.totals.taxable)} />
            <Row label="CGST" value={formatINR(data.totals.cgst)} />
            <Row label="SGST" value={formatINR(data.totals.sgst)} />
            <Row label="IGST" value={formatINR(data.totals.igst)} />
            <Row label="Grand Total" value={formatINR(data.totals.grand_total)} bold />
          </View>
          {data.rows.map((r: any) => (
            <View key={r.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowHead}>{r.number}  ·  {new Date(r.date).toLocaleDateString('en-IN')}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{r.customer || '\u2014'}{r.gstin ? `  ·  ${r.gstin}` : ''}  ·  POS {r.place_of_supply}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.rowAmt}>{formatINR(r.grand_total)}</Text>
                <Text style={s.rowSub}>{r.intra_state ? 'CGST+SGST' : 'IGST'}</Text>
              </View>
            </View>
          ))}
          {data.rows.length === 0 && <Text style={s.empty}>No invoices in this range.</Text>}
        </>
      )}
    </ScrollView>
  );
}

// ───────── Customer Ledger ─────────
function LedgerTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [cid, setCid] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.get('/admin/billing/customers').then(r => setCustomers(r.data)).catch(() => {}); }, []);
  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try { const r = await api.get(`/admin/billing/reports/customer-ledger?customer_id=${id}`); setData(r.data); } catch (e: any) { Alert.alert('Error', String(e)); } finally { setLoading(false); }
  }, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={s.note}>Per-customer history of quotations, invoices, and delivery challans (chronological).</Text>
      <Text style={s.field}>Pick customer</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
        {customers.map(c => (
          <TouchableOpacity key={c.id} onPress={() => { setCid(c.id); load(c.id); }} style={[s.chip, cid === c.id && s.chipOn]}>
            <Text style={[s.chipTxt, cid === c.id && s.chipTxtOn]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {customers.length === 0 && <Text style={s.note2}>No customers yet — add one in Billing → Customers.</Text>}
      {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />}
      {data && (
        <>
          <View style={s.summaryCard}>
            <Text style={s.summaryHead}>{data.customer.name}</Text>
            {data.customer.gstin ? <Text style={s.rowSub}>GSTIN: {data.customer.gstin}</Text> : null}
            <View style={s.divider} />
            <Row label="Invoices" value={String(data.summary.invoices_count)} />
            <Row label="Quotations" value={String(data.summary.quotations_count)} />
            <Row label="Delivery Challans" value={String(data.summary.delivery_challans_count)} />
            <Row label="Total Invoiced" value={formatINR(data.summary.total_invoiced)} bold />
          </View>
          {data.entries.map((e: any) => (
            <View key={e.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowHead}>{e.number}  ·  {(e.type || '').replace('_', ' ').toUpperCase()}</Text>
                <Text style={s.rowSub}>{new Date(e.date).toLocaleDateString('en-IN')}  ·  {e.status || '\u2014'}</Text>
              </View>
              <Text style={s.rowAmt}>{formatINR(e.amount)}</Text>
            </View>
          ))}
          {data.entries.length === 0 && <Text style={s.empty}>No transactions.</Text>}
        </>
      )}
    </ScrollView>
  );
}

// ───────── Aging ─────────
function AgingTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/billing/reports/aging'); setData(r.data); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} />;
  if (!data) return null;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={s.note}>Receivables aging — buckets unpaid invoices by days outstanding. (Mark invoices as `payment_status: paid` to exclude.)</Text>
      <View style={s.summaryCard}>
        <Text style={s.summaryHead}>Total outstanding</Text>
        <Text style={[s.summaryHead, { fontSize: 24, color: theme.colors.primary }]}>{formatINR(data.total_outstanding)}</Text>
        <View style={s.divider} />
        {(['0-30', '31-60', '61-90', '90+'] as const).map(b => (
          <Row key={b} label={`${b} days`} value={formatINR(data.buckets[b] || 0)} />
        ))}
      </View>
      {data.rows.map((r: any) => (
        <View key={r.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowHead}>{r.number}  ·  {r.customer || '\u2014'}</Text>
            <Text style={s.rowSub}>{new Date(r.date).toLocaleDateString('en-IN')}  ·  {r.days} days  ·  bucket {r.bucket}</Text>
          </View>
          <Text style={s.rowAmt}>{formatINR(r.amount)}</Text>
        </View>
      ))}
      {data.rows.length === 0 && <Text style={s.empty}>No outstanding invoices.</Text>}
    </ScrollView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={[s.kvVal, bold ? { fontWeight: '800', color: theme.colors.textPrimary } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  tabRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  tabOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1 },
  tabTxtOn: { color: '#fff' },
  empty: { textAlign: 'center', paddingVertical: 30, color: theme.colors.textMuted },
  note: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 12, padding: 10, backgroundColor: '#FFFBEA', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  note2: { fontSize: 10, color: theme.colors.textMuted, marginTop: 4 },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 13, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F4F4F4', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  chipTxtOn: { color: '#fff' },
  summaryCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginTop: 12 },
  summaryHead: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  kvLabel: { fontSize: 12, color: theme.colors.textSecondary },
  kvVal: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginTop: 8 },
  rowHead: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  rowSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  rowAmt: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
