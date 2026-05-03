import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { theme } from '../src/theme';

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'news' | 'offer'>('news');

  // news form
  const [nTitle, setNTitle] = useState('');
  const [nSummary, setNSummary] = useState('');
  const [nBody, setNBody] = useState('');
  const [nImage, setNImage] = useState('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80');
  const [nTag, setNTag] = useState('Update');

  // offer form
  const [oCode, setOCode] = useState('');
  const [oTitle, setOTitle] = useState('');
  const [oDesc, setODesc] = useState('');
  const [oPct, setOPct] = useState('10');
  const [oValid, setOValid] = useState('2026-12-31');

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Access denied', 'Admin account required', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  }, [user, router]);

  const submitNews = async () => {
    if (!nTitle || !nSummary || !nBody) return Alert.alert('Missing', 'All fields required');
    setBusy(true);
    try {
      await api.post('/admin/news', { title: nTitle, summary: nSummary, body: nBody, image: nImage, tag: nTag });
      Alert.alert('Success', 'News published'); setNTitle(''); setNSummary(''); setNBody('');
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const submitOffer = async () => {
    if (!oCode || !oTitle) return Alert.alert('Missing', 'Code and title required');
    setBusy(true);
    try {
      await api.post('/admin/offers', { code: oCode, title: oTitle, description: oDesc, discount_percent: parseInt(oPct) || 10, valid_until: oValid, banner_color: theme.colors.primary });
      Alert.alert('Success', 'Offer created'); setOCode(''); setOTitle(''); setODesc('');
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="admin-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Admin Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {stats && (
            <View style={styles.statsGrid}>
              {[
                { lbl: 'Users', val: stats.users, icon: 'people' },
                { lbl: 'Products', val: stats.products, icon: 'cube' },
                { lbl: 'Orders', val: stats.orders, icon: 'receipt' },
                { lbl: 'Open Tickets', val: stats.open_tickets, icon: 'help-circle' },
              ].map(s => (
                <View key={s.lbl} style={styles.statCard}>
                  <Ionicons name={s.icon as any} size={22} color={theme.colors.primary} />
                  <Text style={styles.statVal}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.tabRow}>
            <TouchableOpacity testID="admin-tab-news" onPress={() => setTab('news')} style={[styles.tabBtn, tab === 'news' && styles.tabActive]}><Text style={[styles.tabTxt, tab === 'news' && styles.tabTxtActive]}>Publish News</Text></TouchableOpacity>
            <TouchableOpacity testID="admin-tab-offer" onPress={() => setTab('offer')} style={[styles.tabBtn, tab === 'offer' && styles.tabActive]}><Text style={[styles.tabTxt, tab === 'offer' && styles.tabTxtActive]}>Create Offer</Text></TouchableOpacity>
          </View>

          {tab === 'news' ? (
            <View>
              <TextInput testID="admin-n-title" placeholder="Title" placeholderTextColor={theme.colors.textMuted} value={nTitle} onChangeText={setNTitle} style={styles.input} />
              <TextInput testID="admin-n-summary" placeholder="Short summary" placeholderTextColor={theme.colors.textMuted} value={nSummary} onChangeText={setNSummary} style={styles.input} />
              <TextInput testID="admin-n-body" placeholder="Body" placeholderTextColor={theme.colors.textMuted} value={nBody} onChangeText={setNBody} multiline style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} />
              <TextInput testID="admin-n-tag" placeholder="Tag (e.g. Product Launch, Sale)" placeholderTextColor={theme.colors.textMuted} value={nTag} onChangeText={setNTag} style={styles.input} />
              <TextInput testID="admin-n-image" placeholder="Image URL" placeholderTextColor={theme.colors.textMuted} value={nImage} onChangeText={setNImage} style={styles.input} />
              <TouchableOpacity testID="admin-publish-news" onPress={submitNews} disabled={busy} style={styles.submitBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Publish News</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TextInput testID="admin-o-code" placeholder="Promo Code (e.g. DIWALI20)" placeholderTextColor={theme.colors.textMuted} value={oCode} onChangeText={setOCode} autoCapitalize="characters" style={styles.input} />
              <TextInput testID="admin-o-title" placeholder="Offer Title" placeholderTextColor={theme.colors.textMuted} value={oTitle} onChangeText={setOTitle} style={styles.input} />
              <TextInput testID="admin-o-desc" placeholder="Description" placeholderTextColor={theme.colors.textMuted} value={oDesc} onChangeText={setODesc} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} />
              <TextInput testID="admin-o-pct" placeholder="Discount %" placeholderTextColor={theme.colors.textMuted} value={oPct} onChangeText={setOPct} keyboardType="numeric" style={styles.input} />
              <TextInput testID="admin-o-valid" placeholder="Valid until (YYYY-MM-DD)" placeholderTextColor={theme.colors.textMuted} value={oValid} onChangeText={setOValid} style={styles.input} />
              <TouchableOpacity testID="admin-create-offer" onPress={submitOffer} disabled={busy} style={styles.submitBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Create Offer</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  statVal: { fontSize: 24, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 6 },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  tabRow: { flexDirection: 'row', marginTop: 24, gap: 8, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textSecondary, fontWeight: '700' },
  tabTxtActive: { color: '#fff' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitTxt: { color: '#fff', fontWeight: '700' },
});
