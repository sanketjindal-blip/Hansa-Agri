import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { useI18n } from '../src/i18n';
import { HansaLogo } from '../src/components/HansaLogo';
import { theme } from '../src/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => {
        if (user) router.replace('/(tabs)');
        else router.replace('/(auth)/login');
      }, 700);
      return () => clearTimeout(t);
    }
  }, [loading, user, router]);

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1745850783543-a29c3f3869ee?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80' }}
      style={styles.bg}
      testID="splash-screen"
    >
      <View style={styles.overlay}>
        <View style={styles.logoWrap}>
          <HansaLogo size={140} />
        </View>
        <Text style={styles.title}>{t('app_name')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoWrap: { backgroundColor: '#FFFBEA', padding: 10, borderRadius: 24, marginBottom: 24 },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  tagline: { color: '#FFD9B8', fontSize: 13, marginTop: 8, fontWeight: '600', textAlign: 'center' },
});
