import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
      const timer = setTimeout(() => {
        if (user) router.replace('/(tabs)');
        else router.replace('/(auth)/login');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, user, router]);

  return (
    <View style={styles.bg} testID="splash-screen">
      <View style={styles.topGreen} />
      <View style={styles.bottomEarth} />
      <View style={styles.overlay}>
        <View style={styles.logoWrap}>
          <HansaLogo size={140} />
        </View>
        <Text style={styles.title}>{t('app_name')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: theme.colors.secondary },
  topGreen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%', backgroundColor: theme.colors.secondaryDark },
  bottomEarth: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', backgroundColor: theme.colors.earth },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoWrap: { backgroundColor: '#FFFBEA', padding: 14, borderRadius: 28, marginBottom: 24 },
  title: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  tagline: { color: '#FFD9B8', fontSize: 13, marginTop: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
});
