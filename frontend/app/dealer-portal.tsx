import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, formatApiError } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { theme, formatINR } from '../src/theme';

export default function DealerPortal() {
  const router = useRouter();
  const { user } = useAuth();
  const [dealer, setDealer] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<'new' | 'history'>('new');

  // form
  const [phone, setPhone] = useState('+91');
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [purchase, setPurchase] = useState(new Date().toISOString().slice(0, 10));
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [bill, setBill] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role !== 'dealer' && user?.role !== 'admin') {
      Alert.alert('Access denied', 'Only dealers can access this', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    api.get('/dealer/me').then(r => setDealer(r.data.dealer));
    api.get('/products').then(r => { setProducts(r.data); if (r.data[0]) setProductId(r.data[0].id); });
    reloadOrders();
  }, [user]);

  const reloadOrders = async () => {
    try { const r = await api.get('/dealer/orders'); setOrders(r.data); } catch {}
  };

  const pickBill = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission', 'Gallery access required to attach bill'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      setBill(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const captureBill = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission', 'Camera access required'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      setBill(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const submit = async () => {
    if (!phone || !productId) { Alert.alert('Missing', 'Phone and product required'); return; }
    setBusy(true);
    try {
      const endpoint = user?.role === 'admin' ? '/admin/assign-warranty' : '/dealer/assign-warranty';
      const r = await api.post(endpoint, {
        phone, product_id: productId, quantity: parseInt(qty) || 1,
        purchase_date: purchase + 'T00:00:00+00:00',
        customer_name: name || undefined, address, city, state, pincode,
        bill_image_base64: bill || undefined,
      });
      Alert.alert('Warranty activated', `Order ${r.data.order_number} for ${phone}. SMS sent to customer.`);
      setPhone('+91'); setName(''); setAddress(''); setCity(''); setState(''); setPincode(''); setQty('1'); setBill(null);
      reloadOrders();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Dealer Portal</Text>
        <View style={{ width: 24 }} />
      </View>
      {dealer && (
        <View style={styles.dealerBadge}>
          <Ionicons name="storefront" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.dealerName}>{dealer.name}</Text>
            <Text style={styles.dealerSub}>{dealer.state} · {dealer.phone}</Text>
          </View>
        </View>
      )}
      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setTab('new')} style={[styles.tab, tab === 'new' && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === 'new' && styles.tabTxtActive]}>Register Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('history')} style={[styles.tab, tab === 'history' && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === 'history' && styles.tabTxtActive]}>My Sales ({orders.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'new' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.lbl}>Customer Mobile *</Text>
            <TextInput testID="dp-phone" placeholder="+919876543210" placeholderTextColor={theme.colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} />
            <Text style={styles.lbl}>Customer Name</Text>
            <TextInput testID="dp-name" placeholder="Name (first time only)" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} style={styles.input} />
            <Text style={styles.lbl}>Product *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 10 }}>
              {products.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setProductId(p.id)} style={[styles.chip, productId === p.id && styles.chipActive]}>
                  <Text style={[styles.chipTxt, productId === p.id && styles.chipTxtActive]} numberOfLines={1}>{p.name} · {formatINR(p.price)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={styles.lbl}>Qty</Text><TextInput placeholder="1" placeholderTextColor={theme.colors.textMuted} keyboardType="numeric" value={qty} onChangeText={setQty} style={styles.input} /></View>
              <View style={{ flex: 2 }}><Text style={styles.lbl}>Purchase Date</Text><TextInput placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} value={purchase} onChangeText={setPurchase} style={styles.input} /></View>
            </View>
            <Text style={styles.lbl}>Address (optional)</Text>
            <TextInput placeholder="Address" placeholderTextColor={theme.colors.textMuted} value={address} onChangeText={setAddress} style={styles.input} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput placeholder="City" placeholderTextColor={theme.colors.textMuted} value={city} onChangeText={setCity} style={[styles.input, { flex: 1 }]} />
              <TextInput placeholder="State" placeholderTextColor={theme.colors.textMuted} value={state} onChangeText={setState} style={[styles.input, { flex: 1 }]} />
              <TextInput placeholder="Pin" placeholderTextColor={theme.colors.textMuted} value={pincode} onChangeText={setPincode} keyboardType="numeric" style={[styles.input, { flex: 1 }]} maxLength={6} />
            </View>

            <Text style={styles.lbl}>Sale Bill / Invoice Photo</Text>
            {bill ? (
              <View style={styles.billWrap}>
                <Image source={{ uri: bill }} style={styles.billImg} />
                <TouchableOpacity style={styles.removeBill} onPress={() => setBill(null)}>
                  <Ionicons name="close-circle" size={28} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.billRow}>
                <TouchableOpacity testID="bill-gallery" onPress={pickBill} style={[styles.billBtn, { backgroundColor: theme.colors.secondary }]}>
                  <Ionicons name="image-outline" size={18} color="#fff" />
                  <Text style={styles.billBtnTxt}>Upload from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="bill-camera" onPress={captureBill} style={[styles.billBtn, { backgroundColor: theme.colors.primary }]}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.billBtnTxt}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity testID="dp-submit" onPress={submit} disabled={busy} style={styles.saveBtn}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Register Sale & Activate Warranty</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 }}>No sales registered yet</Text>}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.orderNo}>#{item.order_number}</Text>
                <Text style={styles.orderDate}>{new Date(item.purchase_date).toLocaleDateString('en-IN')}</Text>
              </View>
              <Text style={styles.custPhone}>Customer: {item.shipping.phone}</Text>
              {item.items.map((it: any, i: number) => (
                <Text key={i} style={styles.prodLine}>• {it.name} × {it.quantity} ({it.warranty_months} mo)</Text>
              ))}
              {item.bill_image && <Image source={{ uri: item.bill_image }} style={styles.billThumb} />}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  dealerBadge: { flexDirection: 'row', gap: 10, alignItems: 'center', marginHorizontal: 16, backgroundColor: theme.colors.secondary, padding: 12, borderRadius: 12 },
  dealerName: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dealerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  tabRow: { flexDirection: 'row', margin: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textSecondary, fontWeight: '700' },
  tabTxtActive: { color: '#fff' },
  lbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 260 },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTxtActive: { color: '#fff' },
  billRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  billBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  billBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  billWrap: { position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  billImg: { width: '100%', height: 200 },
  removeBill: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 20 },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  orderCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  orderNo: { fontWeight: '800', color: theme.colors.textPrimary },
  orderDate: { color: theme.colors.textMuted, fontSize: 12 },
  custPhone: { color: theme.colors.secondary, fontSize: 12, marginTop: 4, fontWeight: '600' },
  prodLine: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  billThumb: { width: '100%', height: 120, borderRadius: 8, marginTop: 8 },
});
