import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { theme } from '../src/theme';

export default function AdminConsole() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'dealers' | 'warranty' | 'company'>('dealers');

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Access denied', 'Admin only', [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [user, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Admin Console</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.tabRow}>
        {([['dealers', 'Dealers', 'location'], ['warranty', 'Warranty', 'shield'], ['company', 'Company', 'business']] as const).map(([k, lbl, ico]) => (
          <TouchableOpacity key={k} testID={`tab-${k}`} onPress={() => setTab(k as any)} style={[styles.tab, tab === k && styles.tabActive]}>
            <Ionicons name={ico as any} size={16} color={tab === k ? '#fff' : theme.colors.textSecondary} />
            <Text style={[styles.tabTxt, tab === k && styles.tabTxtActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'dealers' && <DealersTab />}
      {tab === 'warranty' && <WarrantyTab />}
      {tab === 'company' && <CompanyTab />}
    </SafeAreaView>
  );
}

// ----------------- DEALERS CRUD -----------------
function DealersTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', whatsapp: '', state: '', type: 'Authorised Dealer' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/dealers'); setList(r.data); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm({ name: '', address: '', phone: '+91', whatsapp: '+91', state: '', type: 'Authorised Dealer' }); setModal(true); };
  const openEdit = (d: any) => { setEditId(d.id); setForm({ name: d.name, address: d.address, phone: d.phone, whatsapp: d.whatsapp, state: d.state, type: d.type }); setModal(true); };
  const save = async () => {
    if (!form.name || !form.phone || !form.address) return Alert.alert('Missing', 'Name, address and phone required');
    setBusy(true);
    try {
      if (editId) await api.patch(`/admin/dealers/${editId}`, form);
      else await api.post('/admin/dealers', form);
      setModal(false); await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };
  const del = (d: any) => {
    Alert.alert('Delete', `Delete dealer "${d.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/admin/dealers/${d.id}`); await load(); } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
      }},
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity testID="dealer-new" style={styles.addBtn} onPress={openNew}>
        <Ionicons name="add-circle" size={20} color="#fff" /><Text style={styles.addTxt}>Add New Dealer</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={theme.colors.primary} /> : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardType}>{item.type} · {item.state}</Text>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSub}>{item.phone}  ·  WA {item.whatsapp}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>{item.address}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity testID={`dealer-edit-${item.id}`} onPress={() => openEdit(item)} style={[styles.iconBtn, { backgroundColor: '#FFF4EA' }]}><Ionicons name="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity testID={`dealer-del-${item.id}`} onPress={() => del(item)} style={[styles.iconBtn, { backgroundColor: '#FDE8E8' }]}><Ionicons name="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModal(false)}><Ionicons name="close" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
            <Text style={styles.title}>{editId ? 'Edit Dealer' : 'New Dealer'}</Text>
            <View style={{ width: 24 }} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <TextInput placeholder="Dealer Name" placeholderTextColor={theme.colors.textMuted} value={form.name} onChangeText={v => setForm({ ...form, name: v })} style={styles.input} />
              <TextInput placeholder="Address" placeholderTextColor={theme.colors.textMuted} value={form.address} onChangeText={v => setForm({ ...form, address: v })} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} />
              <TextInput placeholder="State" placeholderTextColor={theme.colors.textMuted} value={form.state} onChangeText={v => setForm({ ...form, state: v })} style={styles.input} />
              <TextInput placeholder="Phone (+91...)" placeholderTextColor={theme.colors.textMuted} value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} style={styles.input} />
              <TextInput placeholder="WhatsApp (+91...)" placeholderTextColor={theme.colors.textMuted} value={form.whatsapp} onChangeText={v => setForm({ ...form, whatsapp: v })} style={styles.input} />
              <TextInput placeholder="Type (Authorised Dealer / Factory)" placeholderTextColor={theme.colors.textMuted} value={form.type} onChangeText={v => setForm({ ...form, type: v })} style={styles.input} />
              <TouchableOpacity testID="dealer-save" onPress={save} disabled={busy} style={styles.saveBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>{editId ? 'Update Dealer' : 'Create Dealer'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ----------------- ASSIGN WARRANTY -----------------
function WarrantyTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [phone, setPhone] = useState('+91');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [purchase, setPurchase] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/products').then(r => { setProducts(r.data); if (r.data[0]) setProductId(r.data[0].id); }); }, []);

  const submit = async () => {
    if (!phone || !productId) return Alert.alert('Missing', 'Phone and product required');
    setBusy(true);
    try {
      const r = await api.post('/admin/assign-warranty', {
        phone, product_id: productId, quantity: parseInt(qty) || 1,
        purchase_date: purchase + 'T00:00:00+00:00',
        customer_name: name || undefined, address, city, state, pincode,
      });
      Alert.alert('Warranty assigned', `Order ${r.data.order_number} created for ${phone}. SMS sent.`);
      setPhone('+91'); setName(''); setAddress(''); setCity(''); setState(''); setPincode(''); setQty('1');
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLbl}>Allot warranty to a farmer by mobile number. This creates a delivered order and activates the product warranty on the customer's HANSA app.</Text>
        <Text style={styles.field}>Customer Phone *</Text>
        <TextInput testID="aw-phone" placeholder="+919045666666" placeholderTextColor={theme.colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
        <Text style={styles.field}>Customer Name (first-time only)</Text>
        <TextInput testID="aw-name" placeholder="Name" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
        <Text style={styles.field}>Product *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 10 }}>
          {products.map(p => (
            <TouchableOpacity key={p.id} onPress={() => setProductId(p.id)} style={[styles.chip, productId === p.id && styles.chipActive]}>
              <Text style={[styles.chipTxt, productId === p.id && styles.chipTxtActive]} numberOfLines={1}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.field}>Quantity</Text>
            <TextInput testID="aw-qty" placeholder="1" placeholderTextColor={theme.colors.textMuted} keyboardType="numeric" value={qty} onChangeText={setQty} style={styles.input} />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.field}>Purchase Date (YYYY-MM-DD)</Text>
            <TextInput testID="aw-date" placeholder="2026-05-01" placeholderTextColor={theme.colors.textMuted} value={purchase} onChangeText={setPurchase} style={styles.input} />
          </View>
        </View>
        <Text style={styles.field}>Address / City / State / Pincode (optional)</Text>
        <TextInput placeholder="Address" placeholderTextColor={theme.colors.textMuted} value={address} onChangeText={setAddress} style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput placeholder="City" placeholderTextColor={theme.colors.textMuted} value={city} onChangeText={setCity} style={[styles.input, { flex: 1 }]} />
          <TextInput placeholder="State" placeholderTextColor={theme.colors.textMuted} value={state} onChangeText={setState} style={[styles.input, { flex: 1 }]} />
          <TextInput placeholder="Pin" placeholderTextColor={theme.colors.textMuted} value={pincode} onChangeText={setPincode} keyboardType="numeric" style={[styles.input, { flex: 1 }]} maxLength={6} />
        </View>
        <TouchableOpacity testID="aw-submit" onPress={submit} disabled={busy} style={styles.saveBtn}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Assign Warranty & Send SMS</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ----------------- COMPANY INFO -----------------
function CompanyTab() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/settings/company').then(r => setData(r.data)); }, []);

  const save = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await api.patch('/admin/settings/company', {
        name: data.name, tagline: data.tagline, address: data.address,
        phone: data.phone, phone_2: data.phone_2 || '', whatsapp: data.whatsapp,
        email: data.email, website: data.website || '',
      });
      Alert.alert('Saved', 'Company info updated');
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  if (!data) return <ActivityIndicator style={{ marginTop: 30 }} color={theme.colors.primary} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {([
          ['name', 'Company Name'], ['tagline', 'Tagline'], ['address', 'Address'],
          ['phone', 'Primary Phone'], ['phone_2', 'Secondary Phone'], ['whatsapp', 'WhatsApp Number'],
          ['email', 'Email'], ['website', 'Website'],
        ] as const).map(([k, lbl]) => (
          <View key={k}>
            <Text style={styles.field}>{lbl}</Text>
            <TextInput testID={`co-${k}`} placeholder={lbl} placeholderTextColor={theme.colors.textMuted} value={data[k] || ''} onChangeText={v => setData({ ...data, [k]: v })} multiline={k === 'address'} style={[styles.input, k === 'address' && { minHeight: 70, textAlignVertical: 'top' }]} />
          </View>
        ))}
        <TouchableOpacity testID="co-save" onPress={save} disabled={busy} style={styles.saveBtn}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Update Company Info</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  addBtn: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14, backgroundColor: theme.colors.secondary, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardType: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  cardName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveTxt: { color: '#fff', fontWeight: '700' },
  sectionLbl: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 14, lineHeight: 18, paddingHorizontal: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 220 },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTxtActive: { color: '#fff' },
});
