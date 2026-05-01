import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useI18n } from '../../src/i18n';
import { theme, formatINR } from '../../src/theme';

export default function Catalog() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { t } = useI18n();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [active, setActive] = useState<string>((params.category as string) || 'all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.get('/products', { params: { category: active, q: q || undefined } }),
        api.get('/products/categories'),
      ]);
      setProducts(p.data);
      setCategories(c.data);
    } finally { setLoading(false); }
  }, [active, q]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (params.category) setActive(params.category as string); }, [params.category]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('products')}</Text>
        <TouchableOpacity testID="catalog-cart" onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
        <TextInput
          testID="search-input"
          placeholder={t('search_placeholder')}
          placeholderTextColor={theme.colors.textMuted}
          value={q}
          onChangeText={setQ}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {['all', ...categories].map(c => (
          <TouchableOpacity key={c} testID={`chip-${c}`} onPress={() => setActive(c)} style={[styles.chip, active === c && styles.chipActive]}>
            <Text style={[styles.chipTxt, active === c && styles.chipTxtActive]}>{c === 'all' ? t('all') : c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 }}>{t('no_products')}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity testID={`product-${item.id}`} style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
              <Image source={{ uri: item.image }} style={styles.cardImg} />
              <View style={{ padding: 10 }}>
                <Text style={styles.cat}>{item.category}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={styles.price}>{formatINR(item.price)}</Text>
                  <View style={styles.addBtn}><Ionicons name="add" size={16} color="#fff" /></View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, color: theme.colors.textPrimary },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, height: 36 },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 12 },
  chipTxtActive: { color: '#fff' },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  cardImg: { width: '100%', height: 130 },
  cat: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 4, minHeight: 34 },
  price: { fontSize: 15, fontWeight: '800', color: theme.colors.primary },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' },
});
