import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/AuthContext';
import { useI18n } from '../../src/i18n';
import { HansaLogo } from '../../src/components/HansaLogo';
import { theme } from '../../src/theme';
import { api } from '../../src/api';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/me/points').then(r => { if (!cancelled) setPoints(r.data.balance ?? 0); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const menu = [
    { icon: 'gift-outline', label: 'Refer & Earn — Submit a lead', onPress: () => router.push('/refer') },
    { icon: 'bag-outline', label: t('my_orders'), onPress: () => router.push('/(tabs)/orders') },
    { icon: 'shield-checkmark-outline', label: t('warranty'), onPress: () => router.push('/(tabs)/warranty') },
    { icon: 'pricetag-outline', label: t('offers_discounts'), onPress: () => router.push('/offers') },
    { icon: 'newspaper-outline', label: t('news_updates'), onPress: () => router.push('/news') },
    { icon: 'location-outline', label: t('find_dealer'), onPress: () => router.push('/dealers') },
    { icon: 'share-social-outline', label: 'Follow us (Facebook, Instagram, YouTube)', onPress: () => router.push('/social') },
    { icon: 'headset-outline', label: t('support_service'), onPress: () => router.push('/support') },
    ...(user?.role === 'admin' ? [
      { icon: 'construct-outline', label: t('admin_dashboard'), onPress: () => router.push('/admin') },
      { icon: 'cube-outline', label: 'Manage Products', onPress: () => router.push('/admin-products') },
      { icon: 'apps-outline', label: 'Manage Categories', onPress: () => router.push('/admin-categories') },
      { icon: 'people-outline', label: 'Leads & Points', onPress: () => router.push('/admin-leads') },
      { icon: 'settings-outline', label: 'Admin Console (Dealers / Warranty / Company)', onPress: () => router.push('/admin-console') },
      { icon: 'storefront-outline', label: 'Dealer Portal', onPress: () => router.push('/dealer-portal') },
    ] : []),
    ...(user?.role === 'dealer' ? [
      { icon: 'storefront-outline', label: 'Dealer Portal', onPress: () => router.push('/dealer-portal') },
    ] : []),
  ];

  const onLogout = () => {
    Alert.alert(t('logout'), 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{user?.name?.charAt(0).toUpperCase() || 'F'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || 'Farmer'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
            {user?.role === 'admin' ? <View style={styles.roleBadge}><Text style={styles.roleTxt}>ADMIN</Text></View> : user?.role === 'dealer' ? <View style={[styles.roleBadge, { backgroundColor: '#0A84FF' }]}><Text style={styles.roleTxt}>DEALER</Text></View> : null}
          </View>
        </View>

        <TouchableOpacity testID="points-card" onPress={() => router.push('/refer')} style={styles.pointsCard}>
          <View style={styles.pointsIcon}><Ionicons name="trophy" size={28} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsLbl}>Reward Points</Text>
            <Text style={styles.pointsVal}>{points ?? '—'} <Text style={styles.pointsUnit}>pts</Text></Text>
            <Text style={styles.pointsSub}>= ₹ {points ?? 0}  ·  Tap to refer & earn 500 pts</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.langRow}>
            <TouchableOpacity testID="lang-en" onPress={() => setLang('en')} style={[styles.langBtn, lang === 'en' && styles.langActive]}>
              <Text style={[styles.langTxt, lang === 'en' && styles.langTxtActive]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="lang-hi" onPress={() => setLang('hi')} style={[styles.langBtn, lang === 'hi' && styles.langActive]}>
              <Text style={[styles.langTxt, lang === 'hi' && styles.langTxtActive]}>हिन्दी</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('account')}</Text>
          {menu.map(m => (
            <TouchableOpacity key={m.label} testID={`menu-${m.label}`} style={styles.row} onPress={m.onPress}>
              <View style={styles.iconBox}><Ionicons name={m.icon as any} size={20} color={theme.colors.primary} /></View>
              <Text style={styles.rowLbl}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('company')}</Text>
          <View style={styles.info}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <HansaLogo size={80} />
            </View>
            <Text style={styles.infoTitle}>{t('app_name')} — Ramkishan Agri Innovate Pvt Ltd</Text>
            <Text style={styles.infoLine}>Plot No. 26, Harsh Commercial Park, Garh Road, Meerut-250002</Text>
            <Text style={styles.infoLine}>+91 9045 333 332  ·  +91 9479 333 332</Text>
            <Text style={styles.infoLine}>support@agriequipments.com</Text>
            <Text style={styles.infoTag}>{t('tagline')}</Text>
          </View>
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <Text style={styles.logoutTxt}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  email: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  phone: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
  roleTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  pointsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.secondary, padding: 14, borderRadius: 16, marginTop: 12 },
  pointsIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  pointsLbl: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.9 },
  pointsVal: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },
  pointsUnit: { fontSize: 13, opacity: 0.85, fontWeight: '600' },
  pointsSub: { color: '#fff', fontSize: 11, opacity: 0.92, marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  langActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  langTxt: { color: theme.colors.textPrimary, fontWeight: '700' },
  langTxtActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF4EA', alignItems: 'center', justifyContent: 'center' },
  rowLbl: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  info: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: theme.colors.secondary },
  infoTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  infoLine: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
  infoTag: { fontSize: 11, color: theme.colors.primary, letterSpacing: 2, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FDE8E8', paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  logoutTxt: { color: theme.colors.danger, fontWeight: '700' },
});
