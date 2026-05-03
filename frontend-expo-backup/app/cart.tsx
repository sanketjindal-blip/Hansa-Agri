import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../src/CartContext';
import { theme, formatINR } from '../src/theme';

export default function Cart() {
  const router = useRouter();
  const { items, setQty, remove, subtotal, count } = useCart();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="cart-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Cart ({count})</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.product_id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={60} color={theme.colors.textMuted} />
            <Text style={styles.emptyTxt}>Your cart is empty</Text>
            <TouchableOpacity testID="cart-shop" onPress={() => router.replace('/(tabs)/catalog')} style={styles.shopBtn}><Text style={styles.shopTxt}>Browse Products</Text></TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: item.image }} style={styles.img} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cat}>{item.category}</Text>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.price}>{formatINR(item.price)}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity testID={`qty-minus-${item.product_id}`} onPress={() => setQty(item.product_id, item.quantity - 1)} style={styles.stepBtn}><Ionicons name="remove" size={16} color={theme.colors.textPrimary} /></TouchableOpacity>
                <Text style={styles.qty}>{item.quantity}</Text>
                <TouchableOpacity testID={`qty-plus-${item.product_id}`} onPress={() => setQty(item.product_id, item.quantity + 1)} style={styles.stepBtn}><Ionicons name="add" size={16} color={theme.colors.textPrimary} /></TouchableOpacity>
                <TouchableOpacity testID={`remove-${item.product_id}`} onPress={() => remove(item.product_id)} style={styles.removeBtn}><Ionicons name="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLbl}>Subtotal</Text>
            <Text style={styles.totalVal}>{formatINR(subtotal)}</Text>
          </View>
          <TouchableOpacity testID="go-checkout" onPress={() => router.push('/checkout')} style={styles.checkoutBtn}>
            <Text style={styles.checkoutTxt}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  row: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  img: { width: 80, height: 80, borderRadius: 10 },
  cat: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '800', color: theme.colors.primary, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 24, textAlign: 'center', fontWeight: '700', color: theme.colors.textPrimary },
  removeBtn: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDE8E8', alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: '#fff', gap: 12 },
  totalLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  totalVal: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, marginTop: 2 },
  checkoutBtn: { flexDirection: 'row', backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999, alignItems: 'center', gap: 6 },
  checkoutTxt: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 12 },
  shopBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, marginTop: 20 },
  shopTxt: { color: '#fff', fontWeight: '700' },
});
