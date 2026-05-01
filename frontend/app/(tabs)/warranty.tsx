import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

export default function Warranty() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/warranties');
      setItems(res.data);
    } catch (e) {
      console.log('warranty', e);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Warranty Tracker</Text>
        <Text style={styles.sub}>All your products & their coverage</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-outline" size={60} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No warranties yet</Text>
              <Text style={styles.emptySub}>Purchase a product to activate warranty coverage.</Text>
              <TouchableOpacity testID="warranty-shop" onPress={() => router.push('/(tabs)/catalog')} style={styles.shopBtn}>
                <Text style={styles.shopTxt}>Browse Products</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const active = item.status === 'active';
            return (
              <View testID={`warranty-${item.id}`} style={styles.card}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Image source={{ uri: item.image }} style={styles.img} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cat}>{item.category}</Text>
                    <Text style={styles.name} numberOfLines={2}>{item.product_name}</Text>
                    <Text style={styles.order}>Order: {item.order_number}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: active ? '#E6F5EA' : '#FDE8E8' }]}>
                    <Text style={[styles.statusTxt, { color: active ? theme.colors.secondary : theme.colors.danger }]}>
                      {active ? 'ACTIVE' : 'EXPIRED'}
                    </Text>
                  </View>
                </View>
                <View style={styles.datesRow}>
                  <View><Text style={styles.dateLbl}>Purchased</Text><Text style={styles.dateVal}>{new Date(item.purchase_date).toLocaleDateString('en-IN')}</Text></View>
                  <View><Text style={styles.dateLbl}>Expires</Text><Text style={styles.dateVal}>{new Date(item.expiry_date).toLocaleDateString('en-IN')}</Text></View>
                  <View><Text style={styles.dateLbl}>Days Left</Text><Text style={[styles.dateVal, { color: active ? theme.colors.secondary : theme.colors.danger }]}>{item.days_left}</Text></View>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, item.percent_remaining))}%`, backgroundColor: active ? theme.colors.secondary : theme.colors.danger }]} />
                </View>
                <TouchableOpacity testID={`claim-${item.id}`} style={[styles.claimBtn, !active && styles.claimDisabled]} disabled={!active} onPress={() => router.push('/support')}>
                  <Ionicons name="construct-outline" size={16} color="#fff" />
                  <Text style={styles.claimTxt}>{active ? 'Claim Warranty' : 'Warranty Expired'}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
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
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: theme.colors.secondary },
  img: { width: 72, height: 72, borderRadius: 10 },
  cat: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  order: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  datesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  dateLbl: { fontSize: 10, color: theme.colors.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  dateVal: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '700', marginTop: 2 },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', borderRadius: 999 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.secondary, paddingVertical: 10, borderRadius: 999, marginTop: 12 },
  claimDisabled: { backgroundColor: theme.colors.textMuted },
  claimTxt: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
  shopBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginTop: 20 },
  shopTxt: { color: '#fff', fontWeight: '700' },
});
