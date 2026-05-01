import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/AuthContext';
import { theme } from '../src/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => {
        if (user) router.replace('/(tabs)');
        else router.replace('/(auth)/login');
      }, 600);
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
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>RKAI</Text>
        </View>
        <Text style={styles.title}>Ramkishan Agri Innovate</Text>
        <Text style={styles.tagline}>OUR CULTURE IS AGRICULTURE</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 24,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  tagline: { color: '#FFD9B8', fontSize: 13, letterSpacing: 3, marginTop: 8, fontWeight: '600' },
});
