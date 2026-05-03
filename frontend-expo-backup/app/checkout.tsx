import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
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
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod');
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [rzpEnabled, setRzpEnabled] = useState(false);
  const [rzpHtml, setRzpHtml] = useState<string | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [redeemOn, setRedeemOn] = useState(false);

  useEffect(() => {
    api.get('/payments/config').then(r => setRzpEnabled(!!r.data.razorpay_enabled)).catch(() => {});
    api.get('/me/points').then(r => setPointsBalance(r.data.balance || 0)).catch(() => {});
  }, []);

  const afterPromo = Math.max(0, subtotal - discount);
  const maxRedeem = Math.min(pointsBalance, Math.floor(afterPromo));
  const effectiveRedeem = redeemOn ? Math.min(redeemPoints || 0, maxRedeem) : 0;
  const total = useMemo(() => Math.max(0, afterPromo - effectiveRedeem), [afterPromo, effectiveRedeem]);

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
        redeem_points: effectiveRedeem,
      });
      const order = res.data;

      if (paymentMethod === 'razorpay' && rzpEnabled) {
        const rz = await api.post('/payments/razorpay/create-order', { amount_inr: order.total });
        const html = `<!DOCTYPE html><html><body><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
var opts = { key: '${rz.data.key_id}', amount: ${rz.data.amount}, currency: 'INR', name: 'RKAI', description: 'Order ${order.order_number}', order_id: '${rz.data.order_id}', prefill: { name: '${fullName}', contact: '${phone}', email: '${user?.email || ''}' }, theme: { color: '#FF6600' }, handler: function(r){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'success', order_id:'${order.id}', ...r})); }, modal: { ondismiss: function(){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancel'})); } } };
new Razorpay(opts).open();
</script></body></html>`;
        setRzpHtml(html);
        setBusy(false);
        return;
      }

      clear();
      Alert.alert('Order placed!', `Order #${order.order_number} confirmed. You can track it in My Purchases.`, [
        { text: 'View Orders', onPress: () => router.replace('/(tabs)/orders') },
      ]);
    } catch (e: any) {
      Alert.alert('Checkout failed', formatApiError(e));
    } finally { setBusy(false); }
  };

  const onRzpMessage = async (evt: any) => {
    try {
      const data = JSON.parse(evt.nativeEvent.data);
      if (data.type === 'success') {
        await api.post('/payments/razorpay/verify', {
          order_id: data.order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature,
        });
        setRzpHtml(null);
        clear();
        Alert.alert('Payment successful', 'Your order has been paid.', [{ text: 'View Orders', onPress: () => router.replace('/(tabs)/orders') }]);
      } else {
        setRzpHtml(null);
        Alert.alert('Payment cancelled', 'You can retry from the Orders screen.');
      }
    } catch (e: any) { setRzpHtml(null); Alert.alert('Payment error', formatApiError(e)); }
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

          <Text style={styles.sectionTitle}>Redeem Reward Points</Text>
          {pointsBalance <= 0 ? (
            <View style={styles.pointsHint}>
              <Ionicons name="trophy-outline" size={18} color={theme.colors.textMuted} />
              <Text style={styles.pointsHintTxt}>You have no points yet. Refer a friend from your Profile → Refer & Earn to start earning.</Text>
            </View>
          ) : (
            <View style={styles.pointsBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="trophy" size={22} color={theme.colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pointsTitle}>You have {pointsBalance} pts (≈ ₹{pointsBalance})</Text>
                  <Text style={styles.pointsSub}>1 point = ₹1. Max usable on this order: ₹{maxRedeem}</Text>
                </View>
                <TouchableOpacity testID="toggle-redeem" onPress={() => { const next = !redeemOn; setRedeemOn(next); setRedeemPoints(next ? maxRedeem : 0); }} style={[styles.toggle, redeemOn && styles.toggleOn]}>
                  <View style={[styles.knob, redeemOn && styles.knobOn]} />
                </TouchableOpacity>
              </View>
              {redeemOn && (
                <TextInput
                  testID="redeem-input"
                  keyboardType="numeric"
                  value={String(redeemPoints)}
                  onChangeText={(v) => setRedeemPoints(Math.max(0, Math.min(parseInt(v.replace(/\D/g, ''), 10) || 0, maxRedeem)))}
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder={`Use up to ${maxRedeem} pts`}
                  placeholderTextColor={theme.colors.textMuted}
                />
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity testID="pm-cod" onPress={() => setPaymentMethod('cod')} style={[styles.pmRow, paymentMethod === 'cod' && styles.pmActive]}>
            <Ionicons name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}><Text style={styles.pmTitle}>Cash on Delivery</Text><Text style={styles.pmSub}>Pay when you receive the product</Text></View>
          </TouchableOpacity>
          <TouchableOpacity testID="pm-rzp" onPress={() => setPaymentMethod('razorpay')} style={[styles.pmRow, paymentMethod === 'razorpay' && styles.pmActive, !rzpEnabled && { opacity: 0.5 }]} disabled={!rzpEnabled}>
            <Ionicons name={paymentMethod === 'razorpay' ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pmTitle}>Razorpay (UPI / Card / Netbanking)</Text>
              <Text style={styles.pmSub}>{rzpEnabled ? 'Secure online payment via Razorpay' : 'Disabled — add RAZORPAY keys in backend .env to enable'}</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summary}>
            <View style={styles.sRow}><Text style={styles.sLbl}>Subtotal ({items.length} items)</Text><Text style={styles.sVal}>{formatINR(subtotal)}</Text></View>
            <View style={styles.sRow}><Text style={styles.sLbl}>Discount</Text><Text style={[styles.sVal, { color: theme.colors.secondary }]}>-{formatINR(discount)}</Text></View>
            {effectiveRedeem > 0 && (
              <View style={styles.sRow}><Text style={styles.sLbl}>Points Redeemed ({effectiveRedeem} pts)</Text><Text style={[styles.sVal, { color: theme.colors.secondary }]}>-{formatINR(effectiveRedeem)}</Text></View>
            )}
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
      <Modal visible={!!rzpHtml} animationType="slide" onRequestClose={() => setRzpHtml(null)}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <TouchableOpacity onPress={() => setRzpHtml(null)}><Ionicons name="close" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontWeight: '700' }}>Secure Payment</Text>
            <View style={{ width: 24 }} />
          </View>
          {rzpHtml && <WebView source={{ html: rzpHtml }} onMessage={onRzpMessage} javaScriptEnabled domStorageEnabled originWhitelist={['*']} />}
        </SafeAreaView>
      </Modal>
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
  pointsBox: { backgroundColor: '#FFFBEA', borderWidth: 1, borderColor: '#FFE08A', borderRadius: 12, padding: 12 },
  pointsTitle: { fontWeight: '700', color: theme.colors.textPrimary, fontSize: 13 },
  pointsSub: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  pointsHint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  pointsHintTxt: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
  toggle: { width: 44, height: 26, borderRadius: 999, backgroundColor: '#D5D5D5', padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: theme.colors.secondary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { transform: [{ translateX: 18 }] },
});
