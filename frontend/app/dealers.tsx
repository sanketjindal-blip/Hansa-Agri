import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

export default function Dealers() {
  const router = useRouter();
  const [dealers, setDealers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/dealers').then(r => { setDealers(r.data); setLoading(false); }); }, []);

  const call = (num: string) => Linking.openURL(`tel:${num}`).catch(() => {});
  const wa = (num: string) => Linking.openURL(`https://wa.me/${num.replace(/\D/g, '')}`).catch(() => {});
  const map = (addr: string) => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`).catch(() => {});

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="dealers-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Find a Dealer</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={dealers}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View testID={`dealer-${item.id}`} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.type}>{item.type} · {item.state}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.addr}>{item.address}</Text>
                </View>
                <View style={styles.pinIcon}><Ionicons name="location" size={20} color={theme.colors.primary} /></View>
              </View>
              <View style={styles.row}>
                <TouchableOpacity testID={`call-${item.id}`} style={[styles.btn, { backgroundColor: theme.colors.primary }]} onPress={() => call(item.phone)}>
                  <Ionicons name="call" size={14} color="#fff" /><Text style={styles.btnTxt}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`wa-${item.id}`} style={[styles.btn, { backgroundColor: '#25D366' }]} onPress={() => wa(item.whatsapp)}>
                  <Ionicons name="logo-whatsapp" size={14} color="#fff" /><Text style={styles.btnTxt}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`map-${item.id}`} style={[styles.btn, { backgroundColor: theme.colors.secondary }]} onPress={() => map(item.address)}>
                  <Ionicons name="map" size={14} color="#fff" /><Text style={styles.btnTxt}>Map</Text>
                </TouchableOpacity>
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
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  type: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4 },
  addr: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 },
  pinIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4EA', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 999 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
