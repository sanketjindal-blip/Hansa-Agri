import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
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
  'shield', 'star', 'sunny', 'thermometer', 'trail-sign', 'water',
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
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/categories');
      setCats(r.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const persistOrder = async (next: Cat[]) => {
    setCats(next);  // optimistic
    try {
      await api.post('/admin/categories/reorder', { ids: next.map(c => c.id) });
    } catch (e: any) { Alert.alert('Error saving order', formatApiError(e)); load(); }
  };

  const openAdd = () => {
    setEditing(null);
    setKey(''); setLabel(''); setIcon('cube'); setActive(true);
    setShowForm(true);
  };
  const openEdit = (c: Cat) => {
    setEditing(c);
    setKey(c.key); setLabel(c.label); setIcon(c.icon); setActive(c.active);
    setShowForm(true);
  };

  const submit = async () => {
    if (!key.trim() || !label.trim()) { Alert.alert('Missing', 'Key and Label are required'); return; }
    setBusy(true);
    try {
      const sortOrder = editing ? editing.sort_order : (cats.length + 1) * 10;
      const body = { key: key.trim(), label: label.trim(), icon, sort_order: sortOrder, active };
      if (editing) await api.patch(`/admin/categories/${editing.id}`, body);
      else await api.post('/admin/categories', body);
      setShowForm(false);
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e)); } finally { setBusy(false); }
  };

  const onDelete = (c: Cat) => Alert.alert(
    'Delete category?',
    `"${c.label}" will be removed from the app's category tabs.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.delete(`/admin/categories/${c.id}`); await load(); } catch (e: any) { Alert.alert('Error', formatApiError(e)); }
    } }],
  );

  const renderRow = ({ item, drag, isActive }: RenderItemParams<Cat>) => (
    <ScaleDecorator>
      <TouchableOpacity
        testID={`cat-${item.key}`}
        onLongPress={drag}
        delayLongPress={120}
        disabled={isActive}
        onPress={() => openEdit(item)}
        style={[styles.row, !item.active && { opacity: 0.45 }, isActive && styles.rowActive]}
      >
        <View style={styles.dragHandle}><Ionicons name="reorder-three" size={22} color={theme.colors.textMuted} /></View>
        <View style={styles.iconBox}><Ionicons name={item.icon as any} size={24} color={theme.colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.rowSub}>key: {item.key}{item.active ? '' : '  ·  HIDDEN'}</Text>
        </View>
        <TouchableOpacity onPress={() => onDelete(item)} hitSlop={10}><Ionicons name="trash-outline" size={20} color={theme.colors.danger} /></TouchableOpacity>
      </TouchableOpacity>
    </ScaleDecorator>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
          <Text style={styles.title}>Manage Categories</Text>
          <TouchableOpacity testID="add-category" onPress={openAdd}><Ionicons name="add-circle" size={28} color={theme.colors.primary} /></TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <DraggableFlatList
            data={cats}
            onDragEnd={({ data }) => persistOrder(data as Cat[])}
            keyExtractor={(it) => it.id}
            renderItem={renderRow}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            ListHeaderComponent={
              <Text style={styles.helper}>
                <Ionicons name="hand-left" size={12} /> Long-press a row & drag to reorder. Tap to edit. The order here drives the chips on Catalog & Home.
              </Text>
            }
          />
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  helper: { color: theme.colors.textSecondary, fontSize: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  rowActive: { backgroundColor: '#FFF7E6', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  dragHandle: { paddingHorizontal: 4 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFBEA', alignItems: 'center', justifyContent: 'center' },
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
