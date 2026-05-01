import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';

export default function Support() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { const r = await api.get('/support/tickets'); setTickets(r.data); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!subject || !message) { Alert.alert('Missing info', 'Subject and message are required'); return; }
    setBusy(true);
    try {
      await api.post('/support/tickets', { subject, message });
      setSubject(''); setMessage('');
      await load();
      Alert.alert('Ticket submitted', 'Our team will contact you within 24 hours.');
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="support-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Support & Service</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.contactCard}>
                <Ionicons name="call" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactTitle}>Call us directly</Text>
                  <Text style={styles.contactLine}>+91 9045 333 332  ·  +91 9479 333 332</Text>
                  <Text style={styles.contactLine}>support@agriequipments.com</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Raise a Service Request</Text>
              <TextInput testID="sup-subject" placeholder="Subject (e.g. Warranty claim)" placeholderTextColor={theme.colors.textMuted} value={subject} onChangeText={setSubject} style={styles.input} />
              <TextInput testID="sup-message" placeholder="Describe your issue..." placeholderTextColor={theme.colors.textMuted} value={message} onChangeText={setMessage} multiline style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} />
              <TouchableOpacity testID="sup-submit" onPress={submit} disabled={busy} style={styles.submitBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Submit Ticket</Text>}
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>My Tickets</Text>
              {tickets.length === 0 && <Text style={styles.empty}>No tickets yet</Text>}
            </ScrollView>
          }
          renderItem={({ item }) => (
            <View style={styles.ticket}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tSubject}>{item.subject}</Text>
                <Text style={styles.tMsg} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.tDate}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: item.status === 'open' ? '#FFF4EA' : '#E6F5EA' }]}>
                <Text style={[styles.statusTxt, { color: item.status === 'open' ? theme.colors.primary : theme.colors.secondary }]}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  contactCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: theme.colors.primary, alignItems: 'center' },
  contactTitle: { fontWeight: '700', color: theme.colors.textPrimary, fontSize: 13 },
  contactLine: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  submitBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitTxt: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: theme.colors.textMuted, paddingVertical: 20 },
  ticket: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 10 },
  tSubject: { fontWeight: '700', color: theme.colors.textPrimary, fontSize: 14 },
  tMsg: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  tDate: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
