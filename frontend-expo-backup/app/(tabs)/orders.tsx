import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useI18n } from '../../src/i18n';
import { theme, formatINR } from '../../src/theme';

export default function Orders() {
  const router = useRouter();
  const { t } = useI18n();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await api.get('/orders'); setOrders(res.data); }
    catch (e) { console.log('orders', e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('my_purchases')}</Text>
        <Text style={styles.sub}>{t('track_sub')}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={60} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('no_orders')}</Text>
              <TouchableOpacity testID="orders-shop" onPress={() => router.push('/(tabs)/catalog')} style={styles.shopBtn}>
                <Text style={styles.shopTxt}>{t('start_shopping')}</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View testID={`order-${item.id}`} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View>
                  <Text style={styles.orderNo}>#{item.order_number}</Text>
                  <Text style={styles.date}>{new Date(item.purchase_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: item.status === 'delivered' ? '#E6F5EA' : '#FFF4EA' }]}>
                  <Text style={[styles.statusTxt, { color: item.status === 'delivered' ? theme.colors.secondary : theme.colors.primary }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              {item.items.map((it: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <Image source={{ uri: it.image }} style={styles.itemImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                    <Text style={styles.itemMeta}>Qty: {it.quantity}  ·  {it.warranty_months}mo warranty</Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatINR(it.price * it.quantity)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLbl}>{t('total')}</Text>
                <Text style={styles.totalVal}>{formatINR(item.total)}</Text>
              </View>
              <TouchableOpacity style={styles.warrantyLink} onPress={() => router.push('/(tabs)/warranty')}>
                <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.secondary} />
                <Text style={styles.warrantyTxt}>{t('view_warranty')}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  orderNo: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  date: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  itemImg: { width: 48, height: 48, borderRadius: 8 },
  itemName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  itemMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 4 },
  totalLbl: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  totalVal: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  warrantyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10 },
  warrantyTxt: { color: theme.colors.secondary, fontWeight: '600', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 12 },
  shopBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: 20 },
  shopTxt: { color: '#fff', fontWeight: '700' },
});
