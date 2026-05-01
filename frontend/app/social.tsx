import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

export default function Social() {
  const router = useRouter();
  const [social, setSocial] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/social'), api.get('/social/youtube')])
      .then(([s, y]) => { setSocial(s.data); setVideos(y.data.videos || []); })
      .catch(e => console.log(e))
      .finally(() => setLoading(false));
  }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  const Header = () => (
    <View>
      <Text style={styles.sub}>रामकिशन एग्री इनोवेट प्रा. लि. · Follow us for daily farming tips, launches & offers.</Text>
      <View style={styles.socialRow}>
        <TouchableOpacity testID="social-fb" style={[styles.socialBtn, { backgroundColor: '#1877F2' }]} onPress={() => open(social?.facebook)}>
          <Ionicons name="logo-facebook" size={28} color="#fff" /><Text style={styles.socialLbl}>Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="social-ig" style={[styles.socialBtn, { backgroundColor: '#E4405F' }]} onPress={() => open(social?.instagram)}>
          <Ionicons name="logo-instagram" size={28} color="#fff" /><Text style={styles.socialLbl}>Instagram</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="social-yt" style={[styles.socialBtn, { backgroundColor: '#FF0000' }]} onPress={() => open(social?.youtube)}>
          <Ionicons name="logo-youtube" size={28} color="#fff" /><Text style={styles.socialLbl}>YouTube</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity testID="social-wa" style={styles.waBtn} onPress={() => open('https://wa.me/919045333332')}>
        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        <Text style={styles.waLbl}>WhatsApp: +91 9045 333 332</Text>
      </TouchableOpacity>
      <View style={styles.ytHeader}>
        <Ionicons name="logo-youtube" size={20} color="#FF0000" />
        <Text style={styles.ytTitle}>Latest Videos</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="social-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Connect with HANSA</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          ListHeaderComponent={Header}
          data={videos}
          keyExtractor={(v) => v.video_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 12 }}>No videos yet</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity testID={`video-${item.video_id}`} style={styles.vCard} onPress={() => open(item.url)}>
              <View style={styles.vImgWrap}>
                <Image source={{ uri: item.thumbnail }} style={styles.vImg} />
                <View style={styles.vPlay}><Ionicons name="play" size={22} color="#fff" /></View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vTitle} numberOfLines={3}>{item.title}</Text>
                <Text style={styles.vDate}>{new Date(item.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
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
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 14 },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  socialBtn: { flex: 1, paddingVertical: 18, borderRadius: 16, alignItems: 'center', gap: 6 },
  socialLbl: { color: '#fff', fontWeight: '700', fontSize: 12 },
  waBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#25D366', paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  waLbl: { color: '#fff', fontWeight: '700' },
  ytHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 6 },
  ytTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  vCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  vImgWrap: { width: 120, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  vImg: { width: '100%', height: '100%' },
  vPlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  vTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  vDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
});
