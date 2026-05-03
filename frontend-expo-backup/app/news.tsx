import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

export default function News() {
  const router = useRouter();
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/news').then(r => { setNews(r.data); setLoading(false); }); }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="news-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>News & Updates</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={news}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.image }} style={styles.img} />
              <View style={{ padding: 14 }}>
                <View style={styles.tagPill}><Text style={styles.tagTxt}>{item.tag}</Text></View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.sum}>{item.summary}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.date}>{new Date(item.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              </View>
            </View>
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
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  img: { width: '100%', height: 160 },
  tagPill: { alignSelf: 'flex-start', backgroundColor: '#FFF4EA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagTxt: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 8 },
  sum: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6, fontWeight: '600' },
  body: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 20 },
  date: { fontSize: 11, color: theme.colors.textMuted, marginTop: 10 },
});
