import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useCart } from '../../src/CartContext';
import { theme, formatINR } from '../../src/theme';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { add } = useCart();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const res = await api.get(`/products/${id}`); setP(res.data); }
      catch { Alert.alert('Error', 'Product not found'); router.back(); }
      finally { setLoading(false); }
    })();
  }, [id, router]);

  if (loading || !p) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} color={theme.colors.primary} /></SafeAreaView>;

  const onAdd = () => { add({ product_id: p.id, name: p.name, price: p.price, image: p.image, category: p.category }); Alert.alert('Added', `${p.name} added to cart`); };
  const onBuy = () => { add({ product_id: p.id, name: p.name, price: p.price, image: p.image, category: p.category }); router.push('/checkout'); };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.imgWrap}>
          <Image source={{ uri: p.image }} style={styles.img} />
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={styles.cat}>{p.category}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.rateRow}>
            <Ionicons name="star" size={14} color={theme.colors.warning} />
            <Text style={styles.rate}>{p.rating}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.warr}>{p.warranty_months} months warranty</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.hp}>{p.recommended_hp}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatINR(p.price)}</Text>
            <Text style={styles.mrp}>{formatINR(p.mrp)}</Text>
            <View style={styles.saveTag}><Text style={styles.saveTxt}>Save {Math.round(((p.mrp - p.price) / p.mrp) * 100)}%</Text></View>
          </View>

          <Text style={styles.desc}>{p.description}</Text>

          <Text style={styles.sectionTitle}>Key Features</Text>
          {p.features.map((f: string, i: number) => (
            <View key={i} style={styles.featRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.secondary} />
              <Text style={styles.featTxt}>{f}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.specTable}>
            {Object.entries(p.specifications).map(([k, v]: any, i) => (
              <View key={k} style={[styles.specRow, i % 2 === 0 && { backgroundColor: '#FAFAFA' }]}>
                <Text style={styles.specKey}>{k}</Text>
                <Text style={styles.specVal}>{String(v)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity testID="add-to-cart-btn" style={styles.cartBtn} onPress={onAdd}>
          <Ionicons name="cart-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.cartBtnTxt}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="buy-now-btn" style={styles.buyBtn} onPress={onBuy}>
          <Text style={styles.buyBtnTxt}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  imgWrap: { width: '100%', height: 300, backgroundColor: '#F0F0F0' },
  img: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 14, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cat: { fontSize: 11, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 4 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  rate: { fontWeight: '700', color: theme.colors.textPrimary, fontSize: 12 },
  dot: { color: theme.colors.textMuted, marginHorizontal: 2 },
  warr: { fontSize: 12, color: theme.colors.secondary, fontWeight: '600' },
  hp: { fontSize: 12, color: theme.colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 8 },
  price: { fontSize: 28, fontWeight: '800', color: theme.colors.primary },
  mrp: { fontSize: 14, color: theme.colors.textMuted, textDecorationLine: 'line-through' },
  saveTag: { backgroundColor: '#E6F5EA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 4 },
  saveTxt: { color: theme.colors.secondary, fontWeight: '700', fontSize: 11 },
  desc: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginTop: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 22, marginBottom: 10 },
  featRow: { flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  featTxt: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
  specTable: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  specRow: { flexDirection: 'row', padding: 12 },
  specKey: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  specVal: { flex: 1.5, fontSize: 12, color: theme.colors.textPrimary, fontWeight: '500' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.colors.border },
  cartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14 },
  cartBtnTxt: { color: theme.colors.primary, fontWeight: '700' },
  buyBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14 },
  buyBtnTxt: { color: '#fff', fontWeight: '700' },
});
