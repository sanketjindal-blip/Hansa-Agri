import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Linking, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

type Tab = 'youtube' | 'instagram' | 'facebook';

export default function Social() {
  const router = useRouter();
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('youtube');

  useEffect(() => {
    api.get('/social/feed')
      .then(r => setFeed(r.data))
      .catch(e => console.log(e))
      .finally(() => setLoading(false));
  }, []);

  const open = (url?: string) => { if (url) Linking.openURL(url).catch(() => {}); };

  const links = feed?.links || {};

  const Top = () => (
    <View>
      <Text style={styles.sub}>रामकिशन एग्री इनोवेट प्रा. लि. · Follow us for daily farming tips, launches & offers.</Text>
      <View style={styles.socialRow}>
        <TouchableOpacity testID="social-fb" style={[styles.socialBtn, { backgroundColor: '#1877F2' }]} onPress={() => open(links.facebook)}>
          <Ionicons name="logo-facebook" size={28} color="#fff" /><Text style={styles.socialLbl}>Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="social-ig" style={[styles.socialBtn, { backgroundColor: '#E4405F' }]} onPress={() => open(links.instagram)}>
          <Ionicons name="logo-instagram" size={28} color="#fff" /><Text style={styles.socialLbl}>Instagram</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="social-yt" style={[styles.socialBtn, { backgroundColor: '#FF0000' }]} onPress={() => open(links.youtube)}>
          <Ionicons name="logo-youtube" size={28} color="#fff" /><Text style={styles.socialLbl}>YouTube</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity testID="social-wa" style={styles.waBtn} onPress={() => open('https://wa.me/919479333332')}>
        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
        <Text style={styles.waLbl}>WhatsApp: +91 9479 333 332</Text>
      </TouchableOpacity>

      <View style={styles.tabsRow}>
        {(['youtube', 'instagram', 'facebook'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            testID={`tab-${t}`}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === 'youtube' ? 'logo-youtube' : t === 'instagram' ? 'logo-instagram' : 'logo-facebook'}
              size={16}
              color={tab === t ? '#fff' : theme.colors.textSecondary}
            />
            <Text style={[styles.tabLbl, tab === t && styles.tabLblActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderYouTube = () => {
    const videos = feed?.youtube?.videos || [];
    if (!videos.length) return <Text style={styles.empty}>No videos yet</Text>;
    return (
      <View style={{ gap: 12 }}>
        {videos.map((item: any) => (
          <TouchableOpacity key={item.video_id} testID={`video-${item.video_id}`} style={styles.vCard} onPress={() => open(item.url)}>
            <View style={styles.vImgWrap}>
              <Image source={{ uri: item.thumbnail }} style={styles.vImg} />
              <View style={styles.vPlay}><Ionicons name="play" size={22} color="#fff" /></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vTitle} numberOfLines={3}>{item.title}</Text>
              <Text style={styles.vDate}>{new Date(item.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderInstagram = () => {
    const ig = feed?.instagram || {};
    const posts: any[] = ig.posts || [];
    return (
      <View>
        <View style={styles.profileCard}>
          {!!ig.avatar && <Image source={{ uri: ig.avatar }} style={styles.avatar} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{ig.name || ig.handle}</Text>
            <Text style={styles.profileHandle}>@{ig.handle}</Text>
            {!!ig.followers && <Text style={styles.followers}>{typeof ig.followers === 'number' ? ig.followers.toLocaleString('en-IN') : ig.followers} followers</Text>}
            {!!ig.bio && <Text style={styles.bio} numberOfLines={3}>{ig.bio}</Text>}
          </View>
          <TouchableOpacity style={styles.followBtn} onPress={() => open(ig.profile_url || links.instagram)}>
            <Text style={styles.followLbl}>Follow</Text>
          </TouchableOpacity>
        </View>
        {posts.length === 0 ? (
          <Text style={styles.empty}>Posts unavailable. Tap Follow to view on Instagram.</Text>
        ) : (
          <View style={styles.grid}>
            {posts.map((p) => (
              <TouchableOpacity key={p.id || p.shortcode} testID={`ig-${p.shortcode}`} style={styles.gridItem} onPress={() => open(p.url)}>
                <Image source={{ uri: p.thumbnail }} style={styles.gridImg} />
                {p.is_video && (
                  <View style={styles.vidBadge}><Ionicons name="play" size={12} color="#fff" /></View>
                )}
                <View style={styles.gridStats}>
                  <View style={styles.statRow}><Ionicons name="heart" size={12} color="#fff" /><Text style={styles.statTxt}>{p.likes ?? '-'}</Text></View>
                  <View style={styles.statRow}><Ionicons name="chatbubble" size={12} color="#fff" /><Text style={styles.statTxt}>{p.comments ?? '-'}</Text></View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFacebook = () => {
    const fb = feed?.facebook || {};
    return (
      <View>
        <View style={styles.profileCard}>
          {!!fb.avatar ? (
            <Image source={{ uri: fb.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#1877F2', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="logo-facebook" size={36} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={2}>{fb.name}</Text>
            {!!fb.description && <Text style={styles.bio} numberOfLines={4}>{fb.description}</Text>}
          </View>
          <TouchableOpacity style={[styles.followBtn, { backgroundColor: '#1877F2' }]} onPress={() => open(fb.page_url || links.facebook)}>
            <Text style={styles.followLbl}>Open</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fbHelp}>
          <Ionicons name="information-circle" size={18} color={theme.colors.textMuted} />
          <Text style={styles.fbHelpTxt}>
            Facebook restricts public post listings. Tap "Open" to view the latest posts on Facebook.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="social-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Connect with HANSA</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Top />
          <View style={{ marginTop: 12 }}>
            {tab === 'youtube' && renderYouTube()}
            {tab === 'instagram' && renderInstagram()}
            {tab === 'facebook' && renderFacebook()}
          </View>
        </ScrollView>
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

  tabsRow: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F1F1F1' },
  tabActive: { backgroundColor: theme.colors.primary },
  tabLbl: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabLblActive: { color: '#fff' },

  vCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  vImgWrap: { width: 120, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  vImg: { width: '100%', height: '100%' },
  vPlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  vTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  vDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },

  profileCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#eee' },
  profileName: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  profileHandle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  followers: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '600' },
  bio: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },
  followBtn: { backgroundColor: '#E4405F', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  followLbl: { color: '#fff', fontWeight: '700', fontSize: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 6 },
  gridItem: { width: '32.5%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee', position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  vidBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 4 },
  gridStats: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 8, padding: 6, backgroundColor: 'rgba(0,0,0,0.35)' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  fbHelp: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  fbHelpTxt: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },

  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 },
});
