import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

export default function Offers() {
  const router = useRouter();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/offers').then(r => { setOffers(r.data); setLoading(false); }); }, []);

  const copy = (code: string) => {
    Alert.alert('Promo Code', `Use code: ${code}\n\nApply it at checkout to get your discount.`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="offers-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Offers & Discounts</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          renderItem={({ item }) => (
            <View testID={`offer-${item.code}`} style={[styles.card, { backgroundColor: item.banner_color }]}>
              <Text style={styles.pct}>{item.discount_percent}% OFF</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.desc}>{item.description}</Text>
              <View style={styles.bottom}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeLbl}>Code</Text>
                  <Text style={styles.codeVal}>{item.code}</Text>
                </View>
                <TouchableOpacity testID={`copy-${item.code}`} onPress={() => copy(item.code)} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={16} color="#fff" />
                  <Text style={styles.copyTxt}>Copy</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.valid}>Valid until {new Date(item.valid_until).toLocaleDateString('en-IN')}</Text>
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
  card: { borderRadius: 18, padding: 20 },
  pct: { color: '#fff', fontSize: 28, fontWeight: '800' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  desc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 10 },
  codeBox: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  codeLbl: { color: 'rgba(255,255,255,0.75)', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  codeVal: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  copyTxt: { color: '#fff', fontWeight: '700' },
  valid: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 10, fontWeight: '600' },
});
