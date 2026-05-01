import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, RefreshControl, ActivityIndicator, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/AuthContext';
import { useCart } from '../../src/CartContext';
import { theme, formatINR } from '../../src/theme';

const CAT_ICONS: Record<string, any> = {
  Tiller: 'construct', Harrow: 'disc', Plough: 'hammer', Cultivator: 'leaf',
  Subsoiler: 'arrow-down', Leveller: 'resize', Weeder: 'flower', 'Bund Maker': 'layers',
  Ridger: 'triangle', 'Trench Maker': 'git-branch',
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { count } = useCart();
  const [featured, setFeatured] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, n, o, c] = await Promise.all([
        api.get('/products/featured'),
        api.get('/news'),
        api.get('/offers'),
        api.get('/products/categories'),
      ]);
      setFeatured(f.data);
      setNews(n.data);
      setOffers(o.data);
      setCategories(c.data);
    } catch (e) {
      console.log('home load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false} testID="home-scroll">
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Namaste {user?.name?.split(' ')[0] || 'Farmer'}</Text>
            <Text style={styles.sub}>What will you harvest today?</Text>
          </View>
          <TouchableOpacity testID="cart-icon" onPress={() => router.push('/cart')} style={styles.cartBtn}>
            <Ionicons name="cart-outline" size={26} color={theme.colors.textPrimary} />
            {count > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{count}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Warranty expiry alert */}
        {expiringWarranty && (
          <TouchableOpacity testID="warranty-alert" onPress={() => router.push('/(tabs)/warranty')} style={styles.warnBanner}>
            <Ionicons name="warning" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Warranty expiring soon</Text>
              <Text style={styles.warnSub}>{expiringWarranty.product_name} · {expiringWarranty.days_left} days left</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Hero */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1745850783543-a29c3f3869ee?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80' }}
          style={styles.hero}
          imageStyle={{ borderRadius: 20 }}
        >
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTag}>OUR CULTURE IS AGRICULTURE</Text>
            <Text style={styles.heroTitle}>Energizing the Future of Farming</Text>
            <TouchableOpacity testID="hero-shop" style={styles.heroBtn} onPress={() => router.push('/(tabs)/catalog')}>
              <Text style={styles.heroBtnTxt}>Shop Now</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* Offers banner */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Active Offers</Text>
          <TouchableOpacity testID="see-all-offers" onPress={() => router.push('/offers')}><Text style={styles.link}>View all</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {offers.map(o => (
            <View key={o.id} style={[styles.offerCard, { backgroundColor: o.banner_color }]}>
              <Text style={styles.offerPct}>{o.discount_percent}% OFF</Text>
              <Text style={styles.offerTitle}>{o.title}</Text>
              <View style={styles.codePill}><Text style={styles.codeTxt}>{o.code}</Text></View>
            </View>
          ))}
        </ScrollView>

        {/* Categories */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginTop: 24 }]}>Shop by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 12 }}>
          {categories.map(c => (
            <TouchableOpacity key={c} testID={`cat-${c}`} style={styles.catChip} onPress={() => router.push({ pathname: '/(tabs)/catalog', params: { category: c } })}>
              <View style={styles.catIcon}><Ionicons name={(CAT_ICONS[c] || 'cube') as any} size={22} color={theme.colors.primary} /></View>
              <Text style={styles.catTxt} numberOfLines={1}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity testID="see-all-featured" onPress={() => router.push('/(tabs)/catalog')}><Text style={styles.link}>View all</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {featured.map(p => (
            <TouchableOpacity key={p.id} testID={`featured-${p.id}`} style={styles.featCard} onPress={() => router.push(`/product/${p.id}`)}>
              <Image source={{ uri: p.image }} style={styles.featImg} />
              <View style={{ padding: 12 }}>
                <Text style={styles.featCat}>{p.category}</Text>
                <Text style={styles.featName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.featPrice}>{formatINR(p.price)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* News */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Latest Updates</Text>
          <TouchableOpacity testID="see-all-news" onPress={() => router.push('/news')}><Text style={styles.link}>View all</Text></TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 12, marginBottom: 24 }}>
          {news.slice(0, 3).map(n => (
            <TouchableOpacity key={n.id} style={styles.newsCard} onPress={() => router.push('/news')}>
              <Image source={{ uri: n.image }} style={styles.newsImg} />
              <View style={{ flex: 1, padding: 12 }}>
                <Text style={styles.newsTag}>{n.tag}</Text>
                <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
                <Text style={styles.newsSum} numberOfLines={2}>{n.summary}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity testID="quick-warranty" style={styles.quickCard} onPress={() => router.push('/(tabs)/warranty')}>
            <Ionicons name="shield-checkmark" size={24} color={theme.colors.secondary} />
            <Text style={styles.quickTxt}>Warranty</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-dealer" style={styles.quickCard} onPress={() => router.push('/dealers')}>
            <Ionicons name="location" size={24} color={theme.colors.earth} />
            <Text style={styles.quickTxt}>Dealers</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="quick-support" style={styles.quickCard} onPress={() => router.push('/support')}>
            <Ionicons name="headset" size={24} color={theme.colors.primary} />
            <Text style={styles.quickTxt}>Support</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  hello: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  cartBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: theme.colors.primary, borderRadius: 999, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  hero: { height: 180, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  heroOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 20, justifyContent: 'flex-end', borderRadius: 20 },
  heroTag: { color: '#FFD9B8', letterSpacing: 2, fontSize: 10, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  heroBtn: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: theme.colors.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 12, alignItems: 'center', gap: 6 },
  heroBtnTxt: { color: '#fff', fontWeight: '700' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  link: { color: theme.colors.primary, fontWeight: '600', fontSize: 13 },
  offerCard: { width: 220, padding: 16, borderRadius: 16, marginTop: 8 },
  offerPct: { color: '#fff', fontSize: 22, fontWeight: '800' },
  offerTitle: { color: '#fff', fontSize: 14, marginTop: 4, fontWeight: '600' },
  codePill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  codeTxt: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  catChip: { alignItems: 'center', width: 76 },
  catIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF4EA', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFE3CC' },
  catTxt: { fontSize: 11, marginTop: 6, color: theme.colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  featCard: { width: 170, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, marginTop: 8 },
  featImg: { width: '100%', height: 110 },
  featCat: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  featName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 4, minHeight: 34 },
  featPrice: { fontSize: 15, fontWeight: '800', color: theme.colors.primary, marginTop: 6 },
  newsCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  newsImg: { width: 100, height: 100 },
  newsTag: { color: theme.colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  newsTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  newsSum: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  quickRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 8 },
  quickCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border },
  quickTxt: { fontWeight: '600', color: theme.colors.textPrimary, fontSize: 12 },
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: theme.colors.warning },
  warnTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  warnSub: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2 },
});
