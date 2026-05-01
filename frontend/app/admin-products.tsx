import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { useAuth } from '../src/AuthContext';
import { theme, formatINR } from '../src/theme';

type FormState = {
  name: string; category: string; price: string; warranty_months: string;
  description: string; image: string; features: string; recommended_hp: string;
  specifications: string; featured: boolean;
};

const EMPTY: FormState = {
  name: '', category: 'Tiller', price: '0', warranty_months: '12',
  description: '', image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80',
  features: '', recommended_hp: '35 HP & above', specifications: '', featured: false,
};

const CATEGORIES = ['Tiller', 'Harrow', 'Plough', 'Cultivator', 'Ridger', 'Subsoiler', 'Leveller', 'Weeder', 'Bund Maker', 'Trench Maker'];

export default function AdminProducts() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Access denied', 'Admin only', [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [user, router]);

  const load = useCallback(async () => {
    try { const r = await api.get('/products'); setProducts(r.data); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, category: p.category, price: String(p.price), warranty_months: String(p.warranty_months),
      description: p.description, image: p.image, features: (p.features || []).join('\n'),
      recommended_hp: p.recommended_hp || '',
      specifications: Object.entries(p.specifications || {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
      featured: !!p.featured,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.price) return Alert.alert('Missing', 'Name and price required');
    setBusy(true);
    try {
      const specs: Record<string, string> = {};
      form.specifications.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > 0) specs[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      const payload = {
        name: form.name, category: form.category, price: parseFloat(form.price),
        warranty_months: parseInt(form.warranty_months) || 12,
        description: form.description, image: form.image,
        features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
        specifications: specs, recommended_hp: form.recommended_hp, featured: form.featured,
      };
      if (editId) await api.patch(`/admin/products/${editId}`, payload);
      else await api.post('/admin/products', payload);
      setModalOpen(false);
      await load();
      Alert.alert('Saved', editId ? 'Product updated' : 'Product created');
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const del = (p: any) => {
    Alert.alert('Delete', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/admin/products/${p.id}`); await load(); } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
      }},
    ]);
  };

  const sendReminders = async () => {
    try {
      const r = await api.post('/admin/warranty-reminders');
      Alert.alert('Reminders sent', `${r.data.sent} SMS sent to farmers with warranty expiring soon.`);
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity testID="ap-back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Manage Products</Text>
        <TouchableOpacity testID="ap-new" onPress={openNew}><Ionicons name="add-circle" size={28} color={theme.colors.primary} /></TouchableOpacity>
      </View>

      <TouchableOpacity testID="send-reminders" style={styles.reminderBtn} onPress={sendReminders}>
        <Ionicons name="notifications" size={16} color="#fff" />
        <Text style={styles.reminderTxt}>Send warranty SMS reminders</Text>
      </TouchableOpacity>

      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.pCard}>
              <Image source={{ uri: item.image }} style={styles.pImg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pCat}>{item.category}{item.featured ? ' · ★ Featured' : ''}</Text>
                <Text style={styles.pName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.pPrice}>{formatINR(item.price)}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity testID={`edit-${item.id}`} onPress={() => openEdit(item)} style={[styles.iconBtn, { backgroundColor: '#FFF4EA' }]}><Ionicons name="create-outline" size={18} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity testID={`del-${item.id}`} onPress={() => del(item)} style={[styles.iconBtn, { backgroundColor: '#FDE8E8' }]}><Ionicons name="trash-outline" size={18} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalOpen(false)}><Ionicons name="close" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
            <Text style={styles.title}>{editId ? 'Edit Product' : 'New Product'}</Text>
            <View style={{ width: 24 }} />
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
              <TextInput testID="ap-name" placeholder="Product name" placeholderTextColor={theme.colors.textMuted} value={form.name} onChangeText={v => setForm({ ...form, name: v })} style={styles.input} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 10 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c} onPress={() => setForm({ ...form, category: c })} style={[styles.chip, form.category === c && styles.chipActive]}>
                    <Text style={[styles.chipTxt, form.category === c && styles.chipTxtActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput testID="ap-price" placeholder="Price (INR)" placeholderTextColor={theme.colors.textMuted} value={form.price} onChangeText={v => setForm({ ...form, price: v })} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
                <TextInput testID="ap-warr" placeholder="Warranty months" placeholderTextColor={theme.colors.textMuted} value={form.warranty_months} onChangeText={v => setForm({ ...form, warranty_months: v })} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
              </View>
              <TextInput testID="ap-hp" placeholder="Recommended HP (e.g., 35 HP & above)" placeholderTextColor={theme.colors.textMuted} value={form.recommended_hp} onChangeText={v => setForm({ ...form, recommended_hp: v })} style={styles.input} />
              <TextInput testID="ap-desc" placeholder="Description" placeholderTextColor={theme.colors.textMuted} value={form.description} onChangeText={v => setForm({ ...form, description: v })} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} />
              <TextInput testID="ap-image" placeholder="Image URL" placeholderTextColor={theme.colors.textMuted} value={form.image} onChangeText={v => setForm({ ...form, image: v })} style={styles.input} />
              {!!form.image && <Image source={{ uri: form.image }} style={styles.preview} />}
              <Text style={styles.hintLbl}>Key Features (one per line)</Text>
              <TextInput testID="ap-features" placeholder="Loosens hard soil&#10;Breaks clods" placeholderTextColor={theme.colors.textMuted} value={form.features} onChangeText={v => setForm({ ...form, features: v })} multiline style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} />
              <Text style={styles.hintLbl}>Specifications (Key: Value per line)</Text>
              <TextInput testID="ap-specs" placeholder="Frame: 60mm x 60mm&#10;Weight: 180 Kg" placeholderTextColor={theme.colors.textMuted} value={form.specifications} onChangeText={v => setForm({ ...form, specifications: v })} multiline style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} />
              <TouchableOpacity testID="ap-featured" onPress={() => setForm({ ...form, featured: !form.featured })} style={styles.checkRow}>
                <Ionicons name={form.featured ? 'checkbox' : 'square-outline'} size={22} color={theme.colors.primary} />
                <Text style={styles.checkTxt}>Mark as Featured (shows on home)</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="ap-save" onPress={submit} disabled={busy} style={styles.saveBtn}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>{editId ? 'Update Product' : 'Create Product'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  reminderBtn: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: theme.colors.secondary, padding: 12, borderRadius: 12, gap: 8, alignItems: 'center', justifyContent: 'center' },
  reminderTxt: { color: '#fff', fontWeight: '700' },
  pCard: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  pImg: { width: 56, height: 56, borderRadius: 8 },
  pCat: { fontSize: 10, color: theme.colors.secondary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  pName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  pPrice: { fontSize: 13, fontWeight: '800', color: theme.colors.primary, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipTxt: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 12 },
  chipTxtActive: { color: '#fff' },
  preview: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  hintLbl: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  checkTxt: { color: theme.colors.textPrimary, fontSize: 13 },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveTxt: { color: '#fff', fontWeight: '700' },
});
