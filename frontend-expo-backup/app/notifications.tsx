import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';
import { safeBack } from '../src/nav';

type Notif = {
  id: string;
  title: string;
  body: string;
  type: string;
  ref_type: string;
  ref_id: string;
  read: boolean;
  created_at: string;
};

const ICON_FOR: Record<string, string> = {
  service_assigned: 'build',
  service_status: 'construct',
  lead_assigned: 'people',
  lead_purchased: 'trophy',
  system: 'notifications',
};

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setItems(r.data.items || []);
      setUnread(r.data.unread_count || 0);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    try {
      await api.post('/notifications/mark-read', { all: true });
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
  };

  const onTap = async (n: Notif) => {
    if (!n.read) {
      try { await api.post('/notifications/mark-read', { ids: [n.id] }); } catch {}
    }
    if (n.ref_type === 'service_request') {
      router.push('/manager');
    } else if (n.ref_type === 'lead') {
      router.push('/manager');
    }
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Notifications {unread > 0 ? `(${unread})` : ''}</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={markAll}><Text style={styles.markTxt}>Mark all read</Text></TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
      </View>
      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /> : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.empty}>No notifications yet</Text>
            </View>
          ) : items.map(n => (
            <TouchableOpacity key={n.id} onPress={() => onTap(n)} style={[styles.card, !n.read && styles.unread]}>
              <View style={[styles.iconBox, !n.read && { backgroundColor: theme.colors.primary }]}>
                <Ionicons name={(ICON_FOR[n.type] || 'notifications') as any} size={20} color={!n.read ? '#fff' : theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, !n.read && { fontWeight: '800' }]}>{n.title}</Text>
                <Text style={styles.cardBody} numberOfLines={3}>{n.body}</Text>
                <Text style={styles.cardDate}>{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              {!n.read && <View style={styles.dot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  markTxt: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  empty: { color: theme.colors.textMuted, fontSize: 14 },
  card: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, alignItems: 'flex-start' },
  unread: { backgroundColor: '#FFF8E6', borderColor: theme.colors.primary },
  iconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFFBEA', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  cardBody: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 },
  cardDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 4, marginLeft: 4 },
});
