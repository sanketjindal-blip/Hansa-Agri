import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { useCart } from '../src/CartContext';
import { useAuth } from '../src/AuthContext';
import { theme, formatINR } from '../src/theme';

export default function Checkout() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();

  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [promo, setPromo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState(0);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const applyPromo = async () => {
    try {
      const res = await api.get('/offers');
      const offer = res.data.find((o: any) => o.code.toUpperCase() === promo.trim().toUpperCase());
      if (offer) {
        const d = Math.round(subtotal * (offer.discount_percent / 100));
        setDiscount(d);
        Alert.alert('Promo applied', `${offer.discount_percent}% off · saved ${formatINR(d)}`);
      } else {
        setDiscount(0);
        Alert.alert('Invalid code', 'This promo code does not exist');
      }
    } catch (e) { console.log(e); }
  };

  const placeOrder = async () => {
    if (!fullName || !phone || !address || !city || !state || !pincode) {
      Alert.alert('Missing info', 'Please fill all shipping fields');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/orders/checkout', {
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        full_name: fullName, phone, address, city, state, pincode,
        payment_method: paymentMethod,
        promo_code: promo || undefined,
      });
      clear();
      Alert.alert('Order placed!', `Order #${res.data.order_number} confirmed. You can track it in My Purchases.`, [
        { text: 'View Orders', onPress: () => router.replace('/(tabs)/orders') },
      ]);
    } catch (e: any) {
      Alert.alert('Checkout failed', formatApiError(e));
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="checkout-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <TextInput testID="ck-name" placeholder="Full Name" placeholderTextColor={theme.colors.textMuted} value={fullName} onChangeText={setFullName} style={styles.input} />
          <TextInput testID="ck-phone" placeholder="Phone" placeholderTextColor={theme.colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
          <TextInput testID="ck-address" placeholder="Address (village, street)" placeholderTextColor={theme.colors.textMuted} value={address} onChangeText={setAddress} style={[styles.input, { minHeight: 60 }]} multiline />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput testID="ck-city" placeholder="City" placeholderTextColor={theme.colors.textMuted} value={city} onChangeText={setCity} style={[styles.input, { flex: 1 }]} />
            <TextInput testID="ck-state" placeholder="State" placeholderTextColor={theme.colors.textMuted} value={state} onChangeText={setState} style={[styles.input, { flex: 1 }]} />
          </View>
          <TextInput testID="ck-pin" placeholder="Pincode" placeholderTextColor={theme.colors.textMuted} value={pincode} onChangeText={setPincode} keyboardType="numeric" style={styles.input} maxLength={6} />

          <Text style={styles.sectionTitle}>Promo Code</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput testID="ck-promo" placeholder="Enter code (e.g. RKAI10)" placeholderTextColor={theme.colors.textMuted} value={promo} onChangeText={setPromo} autoCapitalize="characters" style={[styles.input, { flex: 1 }]} />
            <TouchableOpacity testID="apply-promo" onPress={applyPromo} style={styles.applyBtn}><Text style={styles.applyTxt}>Apply</Text></TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity testID="pm-cod" onPress={() => setPaymentMethod('cod')} style={[styles.pmRow, paymentMethod === 'cod' && styles.pmActive]}>
            <Ionicons name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}><Text style={styles.pmTitle}>Cash on Delivery</Text><Text style={styles.pmSub}>Pay when you receive the product</Text></View>
          </TouchableOpacity>
          <TouchableOpacity testID="pm-online" onPress={() => setPaymentMethod('online')} style={[styles.pmRow, paymentMethod === 'online' && styles.pmActive]}>
            <Ionicons name={paymentMethod === 'online' ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}><Text style={styles.pmTitle}>Online Payment (UPI/Card)</Text><Text style={styles.pmSub}>Confirm payment link via dealer (demo)</Text></View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summary}>
            <View style={styles.sRow}><Text style={styles.sLbl}>Subtotal ({items.length} items)</Text><Text style={styles.sVal}>{formatINR(subtotal)}</Text></View>
            <View style={styles.sRow}><Text style={styles.sLbl}>Discount</Text><Text style={[styles.sVal, { color: theme.colors.secondary }]}>-{formatINR(discount)}</Text></View>
            <View style={styles.sRow}><Text style={styles.sLbl}>Shipping</Text><Text style={styles.sVal}>Free</Text></View>
            <View style={[styles.sRow, { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10, marginTop: 6 }]}>
              <Text style={styles.grandLbl}>Total</Text><Text style={styles.grandVal}>{formatINR(total)}</Text>
            </View>
          </View>
        </ScrollView>
        <View style={styles.bottomBar}>
          <TouchableOpacity testID="place-order-btn" onPress={placeOrder} disabled={busy || items.length === 0} style={[styles.placeBtn, (busy || items.length === 0) && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeTxt}>Place Order · {formatINR(total)}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  applyBtn: { backgroundColor: theme.colors.secondary, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', marginBottom: 10 },
  applyTxt: { color: '#fff', fontWeight: '700' },
  pmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  pmActive: { borderColor: theme.colors.primary, borderWidth: 2 },
  pmTitle: { fontWeight: '700', color: theme.colors.textPrimary },
  pmSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  summary: { backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  sRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sLbl: { color: theme.colors.textSecondary, fontSize: 13 },
  sVal: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  grandLbl: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  grandVal: { fontSize: 18, fontWeight: '800', color: theme.colors.primary },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.colors.border },
  placeBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  placeTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
