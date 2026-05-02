/**
 * Admin Inventory Dashboard — high-level metrics + per-category breakdown.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatINR, absoluteUrl } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

type CatRow = {
  id: string; name: string; icon: string; products_count: number;
  in_stock_count: number; out_of_stock_count: number;
  avg_price: number; total_value: number; active: boolean;
};
type Summary = {
  totals: { products: number; categories: number; featured: number; in_stock: number; out_of_stock: number; total_value_inr: number };
  by_category: CatRow[];
  recent_products: any[];
  top_priced: any[];
  out_of_stock: any[];
};

export default function AdminInventory() {
  const router = useRouter();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/admin/inventory/summary'); setData(r.data); }
    catch { /* 401/403 handled at app level */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  if (!data) return null;

  const t = data.totals;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Inventory Dashboard</Text>
        <TouchableOpacity onPress={() => router.push('/admin-products')}><Ionicons name="add-circle" size={26} color={theme.colors.primary} /></TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="cube" size={20} color="#fff" />
            <Text style={styles.kpiNum}>{t.products}</Text>
            <Text style={styles.kpiLbl}>Products</Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: theme.colors.secondary }]}>
            <Ionicons name="apps" size={20} color="#fff" />
            <Text style={styles.kpiNum}>{t.categories}</Text>
            <Text style={styles.kpiLbl}>Categories</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: '#34C759' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.kpiNum}>{t.in_stock}</Text>
            <Text style={styles.kpiLbl}>In Stock</Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: '#FF3B30' }]}>
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.kpiNum}>{t.out_of_stock}</Text>
            <Text style={styles.kpiLbl}>Out of Stock</Text>
          </View>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#0A84FF', marginTop: 8 }]}>
          <Ionicons name="cash" size={20} color="#fff" />
          <Text style={styles.kpiNum}>{formatINR(t.total_value_inr)}</Text>
          <Text style={styles.kpiLbl}>Catalog Value (sum of MSRP)</Text>
        </View>

        {/* By Category */}
        <Text style={styles.section}>By Category</Text>
        {data.by_category.length === 0 ? <Text style={styles.empty}>No categories yet.</Text> : data.by_category.map(c => (
          <View key={c.id} style={styles.catRow}>
            <View style={styles.catIcon}><Ionicons name={(c.icon || 'cube-outline') as any} size={20} color={theme.colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.catName} numberOfLines={1}>{c.name}{!c.active ? <Text style={styles.inactive}>  · INACTIVE</Text> : null}</Text>
              <Text style={styles.catSub}>{c.products_count} products · {c.in_stock_count} in stock{c.out_of_stock_count > 0 ? ` · ${c.out_of_stock_count} OOS` : ''}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.barFill, { width: `${Math.min(100, t.products ? (c.products_count / t.products) * 100 : 0)}%` }]} />
              </View>
            </View>
            <View style={styles.catVal}>
              <Text style={styles.catValTxt}>{formatINR(c.total_value)}</Text>
              <Text style={styles.catAvg}>avg {formatINR(c.avg_price)}</Text>
            </View>
          </View>
        ))}

        {/* Out of Stock */}
        {data.out_of_stock?.length > 0 && (
          <>
            <Text style={[styles.section, { color: '#FF3B30' }]}>⚠️  Out of Stock ({data.out_of_stock.length})</Text>
            {data.out_of_stock.slice(0, 5).map(p => (
              <View key={p.id} style={styles.miniRow}>
                {p.image && <Image source={{ uri: absoluteUrl(p.image) }} style={styles.miniThumb} />}
                <View style={{ flex: 1 }}><Text style={styles.miniName} numberOfLines={1}>{p.name}</Text><Text style={styles.miniSub}>{p.category} · {formatINR(p.price)}</Text></View>
              </View>
            ))}
          </>
        )}

        {/* Top priced */}
        <Text style={styles.section}>Top Priced</Text>
        {data.top_priced.map(p => (
          <View key={p.id} style={styles.miniRow}>
            {p.image && <Image source={{ uri: absoluteUrl(p.image) }} style={styles.miniThumb} />}
            <View style={{ flex: 1 }}><Text style={styles.miniName} numberOfLines={1}>{p.name}</Text><Text style={styles.miniSub}>{p.category}</Text></View>
            <Text style={styles.priceTag}>{formatINR(p.price)}</Text>
          </View>
        ))}

        {/* Recent */}
        <Text style={styles.section}>Recently Added</Text>
        {data.recent_products.map(p => (
          <View key={p.id} style={styles.miniRow}>
            {p.image && <Image source={{ uri: absoluteUrl(p.image) }} style={styles.miniThumb} />}
            <View style={{ flex: 1 }}><Text style={styles.miniName} numberOfLines={1}>{p.name}</Text><Text style={styles.miniSub}>{p.category} · {formatINR(p.price)}</Text></View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'flex-start', justifyContent: 'center', minHeight: 86 },
  kpiNum: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4 },
  kpiLbl: { fontSize: 11, color: '#fff', opacity: 0.95, fontWeight: '600' },
  section: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { color: theme.colors.textMuted, padding: 12, textAlign: 'center' },
  catRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  catIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFFBEA', alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  inactive: { fontSize: 9, color: theme.colors.danger, fontWeight: '700' },
  catSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  barWrap: { height: 6, backgroundColor: '#F1F1F1', borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: theme.colors.primary },
  catVal: { alignItems: 'flex-end' },
  catValTxt: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  catAvg: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  miniRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#fff', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6 },
  miniThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#eee' },
  miniName: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  miniSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  priceTag: { fontSize: 12, fontWeight: '800', color: theme.colors.primary },
});
