import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';

type Cat = { id: string; key: string; label: string; icon: string; sort_order: number; active: boolean };

const ICON_OPTIONS = [
  'cube', 'construct', 'disc', 'hammer', 'leaf', 'arrow-down', 'resize', 'flower',
  'layers', 'triangle', 'git-branch', 'apps', 'pricetag', 'ribbon', 'rocket',
  'cog', 'build', 'analytics', 'speedometer', 'flash', 'bonfire', 'planet',
  'aperture', 'archive', 'basket', 'beaker', 'bicycle', 'briefcase', 'cart',
  'compass', 'crop', 'cut', 'flag', 'flame', 'globe', 'home', 'medal', 'navigate',
  'shield', 'star', 'sunny', 'thermometer', 'trail-sign', 'tree', 'water',
];

export default function AdminCategories() {
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pickIcon, setPickIcon] = useState(false);
  const [busy, setBusy] = useState(false);

  // form state
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('cube');
  const [sortOrder, setSortOrder] = useState('100');
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/categories');
      setCats(r.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setKey(''); setLabel(''); setIcon('cube'); setSortOrder(String((cats.length + 1) * 10)); setActive(true);
    setShowForm(true);
  };
  const openEdit = (c: Cat) => {
    setEditing(c);
    setKey(c.key); setLabel(c.label); setIcon(c.icon); setSortOrder(String(c.sort_order)); setActive(c.active);
    setShowForm(true);
  };

  const submit = async () => {
    if (!key.trim() || !label.trim()) { Alert.alert('Missing', 'Key and Label are required'); return; }
    setBusy(true);
    try {
      const body = { key: key.trim(), label: label.trim(), icon, sort_order: parseInt(sortOrder, 10) || 100, active };
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, body);
      } else {
        await api.post('/admin/categories', body);
      }
      setShowForm(false);
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const onDelete = (c: Cat) => Alert.alert(
    'Delete category?',
    `"${c.label}" will be removed from the app's category tabs. Products with category "${c.key}" will remain but the tab will disappear.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.delete(`/admin/categories/${c.id}`); await load(); } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
    } }],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Manage Categories</Text>
        <TouchableOpacity testID="add-category" onPress={openAdd}><Ionicons name="add-circle" size={28} color={theme.colors.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={styles.helper}>Tap any category to edit its label, icon, sort order or visibility. Products keep working under their category key.</Text>
          {cats.map((c) => (
            <TouchableOpacity key={c.id} testID={`cat-${c.key}`} onPress={() => openEdit(c)} style={[styles.row, !c.active && { opacity: 0.45 }]}>
              <View style={styles.iconBox}><Ionicons name={c.icon as any} size={24} color={theme.colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Text style={styles.rowSub}>key: {c.key}  ·  order #{c.sort_order}{c.active ? '' : '  ·  HIDDEN'}</Text>
              </View>
              <TouchableOpacity onPress={() => onDelete(c)} hitSlop={10}><Ionicons name="trash-outline" size={20} color={theme.colors.danger} /></TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editing ? 'Edit Category' : 'Add Category'}</Text>

              <Text style={styles.field}>Key (used by products) *</Text>
              <TextInput placeholder="e.g. Tiller" placeholderTextColor={theme.colors.textMuted} value={key} onChangeText={setKey} style={styles.input} autoCapitalize="words" />

              <Text style={styles.field}>Display Label *</Text>
              <TextInput placeholder="e.g. Power Tiller" placeholderTextColor={theme.colors.textMuted} value={label} onChangeText={setLabel} style={styles.input} />

              <Text style={styles.field}>Icon</Text>
              <TouchableOpacity testID="open-icon-picker" onPress={() => setPickIcon(true)} style={styles.iconPickBtn}>
                <View style={styles.iconBox}><Ionicons name={icon as any} size={28} color={theme.colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{icon}</Text>
                  <Text style={styles.rowSub}>Tap to choose another</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.field}>Sort order</Text>
              <TextInput keyboardType="numeric" value={sortOrder} onChangeText={setSortOrder} style={styles.input} />

              <TouchableOpacity onPress={() => setActive(a => !a)} style={styles.toggleRow}>
                <Ionicons name={active ? 'checkbox' : 'square-outline'} size={22} color={active ? theme.colors.secondary : theme.colors.textMuted} />
                <Text style={styles.toggleTxt}>Visible in app (uncheck to hide)</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <TouchableOpacity onPress={() => setShowForm(false)} style={[styles.btn, { backgroundColor: '#eee', flex: 1 }]}><Text style={[styles.btnTxt, { color: theme.colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity testID="save-category" onPress={submit} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>{editing ? 'Save changes' : 'Add'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={pickIcon} animationType="slide" transparent onRequestClose={() => setPickIcon(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Pick an icon</Text>
              <TouchableOpacity onPress={() => setPickIcon(false)}><Ionicons name="close" size={26} color={theme.colors.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.iconGrid}>
              {ICON_OPTIONS.map((name) => (
                <TouchableOpacity key={name} testID={`icon-${name}`} onPress={() => { setIcon(name); setPickIcon(false); }} style={[styles.iconCell, icon === name && styles.iconCellActive]}>
                  <Ionicons name={name as any} size={26} color={icon === name ? '#fff' : theme.colors.primary} />
                  <Text numberOfLines={1} style={[styles.iconLbl, icon === name && { color: '#fff' }]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  helper: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFFBEA', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  rowSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  field: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  iconPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F8F8', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  toggleTxt: { color: theme.colors.textPrimary, fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 24 },
  iconCell: { width: '23%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#FFFBEA', alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconCellActive: { backgroundColor: theme.colors.primary },
  iconLbl: { fontSize: 9, color: theme.colors.textSecondary, fontWeight: '600' },
});
