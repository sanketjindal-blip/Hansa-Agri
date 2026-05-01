import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { api, formatApiError } from '../src/api';
import { theme } from '../src/theme';

type Asset = { uri: string; type: 'photo' | 'video'; mime: string; name: string };

export default function ServiceRequest() {
  const router = useRouter();
  const [warranties, setWarranties] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [loading, setLoading] = useState(true);

  // form
  const [productId, setProductId] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [w, r] = await Promise.all([api.get('/warranties'), api.get('/service-requests/mine')]);
      setWarranties(w.data); setRequests(r.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pickMedia = async (kind: 'photo' | 'video', source: 'gallery' | 'camera') => {
    const requestPerm = source === 'camera'
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const perm = await requestPerm();
    if (!perm.granted) { Alert.alert('Permission required'); return; }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: kind === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.6,
      videoMaxDuration: 60,
    };
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const ext = (a.fileName?.split('.').pop() || (kind === 'photo' ? 'jpg' : 'mp4')).toLowerCase();
    const mime = kind === 'photo' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `video/${ext}`;
    const name = a.fileName || `${kind}-${Date.now()}.${ext}`;
    // Replace any existing media of this kind (one each max).
    setMedia(prev => [...prev.filter(m => m.type !== kind), { uri: a.uri, type: kind, mime, name }]);
  };

  const removeMedia = (kind: 'photo' | 'video') => setMedia(prev => prev.filter(m => m.type !== kind));

  const submit = async () => {
    if (!title.trim() || !description.trim()) { Alert.alert('Missing', 'Please enter a title and description'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('title', title); fd.append('description', description);
      if (productId) fd.append('product_id', productId);
      if (orderId) fd.append('order_id', orderId);
      for (const m of media) {
        // RN FormData accepts {uri,name,type}
        // @ts-expect-error - RN style FormData
        fd.append(m.type === 'photo' ? 'photo' : 'video', { uri: m.uri, name: m.name, type: m.mime });
      }
      await api.post('/service-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Submitted', 'Our service team will get in touch within 24 hrs.');
      setTitle(''); setDescription(''); setProductId(''); setProductName(''); setOrderId(''); setMedia([]);
      setTab('history'); await load();
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e));
    } finally { setBusy(false); }
  };

  const statusColor = (s: string) => ({
    open: '#FF9500', in_progress: '#0A84FF', resolved: '#34C759', closed: '#8E8E93', cancelled: '#FF3B30',
  } as any)[s] || theme.colors.textMuted;

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Service Request</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setTab('new')} style={[styles.tab, tab === 'new' && styles.tabActive]}><Text style={[styles.tabTxt, tab === 'new' && styles.tabTxtActive]}>Raise Request</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('history')} style={[styles.tab, tab === 'history' && styles.tabActive]}><Text style={[styles.tabTxt, tab === 'history' && styles.tabTxtActive]}>My Requests ({requests.length})</Text></TouchableOpacity>
      </View>

      {tab === 'new' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.lbl}>Pick the purchased product</Text>
            {warranties.length === 0 ? (
              <Text style={styles.empty}>No purchased products yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {warranties.map((w: any) => (
                  <TouchableOpacity key={w.id} testID={`prod-${w.product_id}`} onPress={() => { setProductId(w.product_id); setProductName(w.product_name); setOrderId(w.order_id); }} style={[styles.prodChip, productId === w.product_id && styles.prodChipOn]}>
                    {!!w.image && <Image source={{ uri: w.image }} style={styles.prodImg} />}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prodName, productId === w.product_id && { color: '#fff' }]} numberOfLines={2}>{w.product_name}</Text>
                      <Text style={[styles.prodSub, productId === w.product_id && { color: 'rgba(255,255,255,0.85)' }]}>#{w.order_number}  ·  {w.days_left}d warranty</Text>
                    </View>
                    {productId === w.product_id && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.lbl}>Issue Title *</Text>
            <TextInput testID="sr-title" placeholder="e.g. Engine not starting" placeholderTextColor={theme.colors.textMuted} value={title} onChangeText={setTitle} style={styles.input} />

            <Text style={styles.lbl}>Describe the problem *</Text>
            <TextInput testID="sr-desc" placeholder="What is happening? When did it start?" placeholderTextColor={theme.colors.textMuted} value={description} onChangeText={setDescription} multiline style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} />

            <Text style={styles.lbl}>Photo (max 5 MB)</Text>
            {media.find(m => m.type === 'photo') ? (
              <View style={styles.mediaWrap}>
                <Image source={{ uri: media.find(m => m.type === 'photo')!.uri }} style={styles.photoPreview} />
                <TouchableOpacity onPress={() => removeMedia('photo')} style={styles.removeBtn}><Ionicons name="close-circle" size={28} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mediaRow}>
                <TouchableOpacity testID="sr-photo-cam" onPress={() => pickMedia('photo', 'camera')} style={[styles.mediaBtn, { backgroundColor: theme.colors.primary }]}><Ionicons name="camera-outline" size={18} color="#fff" /><Text style={styles.mediaTxt}>Take Photo</Text></TouchableOpacity>
                <TouchableOpacity testID="sr-photo-gal" onPress={() => pickMedia('photo', 'gallery')} style={[styles.mediaBtn, { backgroundColor: theme.colors.secondary }]}><Ionicons name="image-outline" size={18} color="#fff" /><Text style={styles.mediaTxt}>From Gallery</Text></TouchableOpacity>
              </View>
            )}

            <Text style={styles.lbl}>Video (optional, max 30 MB / 60s)</Text>
            {media.find(m => m.type === 'video') ? (
              <View style={styles.mediaWrap}>
                <Video source={{ uri: media.find(m => m.type === 'video')!.uri }} style={styles.videoPreview} useNativeControls resizeMode={ResizeMode.COVER} isLooping={false} />
                <TouchableOpacity onPress={() => removeMedia('video')} style={styles.removeBtn}><Ionicons name="close-circle" size={28} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mediaRow}>
                <TouchableOpacity onPress={() => pickMedia('video', 'camera')} style={[styles.mediaBtn, { backgroundColor: '#FF3B30' }]}><Ionicons name="videocam-outline" size={18} color="#fff" /><Text style={styles.mediaTxt}>Record Video</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => pickMedia('video', 'gallery')} style={[styles.mediaBtn, { backgroundColor: '#5E5CE6' }]}><Ionicons name="film-outline" size={18} color="#fff" /><Text style={styles.mediaTxt}>From Gallery</Text></TouchableOpacity>
              </View>
            )}

            <TouchableOpacity testID="sr-submit" onPress={submit} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Submit Service Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {requests.length === 0 ? <Text style={styles.empty}>No service requests yet.</Text> : requests.map((r: any) => (
            <View key={r.id} style={styles.reqCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.reqTitle} numberOfLines={2}>{r.title}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusColor(r.status) + '22', borderColor: statusColor(r.status) }]}>
                  <Text style={[styles.statusTxt, { color: statusColor(r.status) }]}>{r.status.toUpperCase()}</Text>
                </View>
              </View>
              {r.product_name ? <Text style={styles.reqSub}>{r.product_name}</Text> : null}
              <Text style={styles.reqDesc} numberOfLines={3}>{r.description}</Text>
              {r.resolution ? <View style={styles.resBox}><Ionicons name="checkmark-circle" size={14} color={theme.colors.secondary} /><Text style={styles.resTxt}>{r.resolution}</Text></View> : null}
              <Text style={styles.reqDate}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
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
  tabRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabTxt: { color: theme.colors.textSecondary, fontWeight: '700' },
  tabTxtActive: { color: '#fff' },
  lbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary, fontSize: 14 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', padding: 30 },
  prodChip: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, minWidth: 220, maxWidth: 280 },
  prodChipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  prodImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#eee' },
  prodName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  prodSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  mediaRow: { flexDirection: 'row', gap: 8 },
  mediaBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  mediaTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mediaWrap: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoPreview: { width: '100%', height: 200 },
  videoPreview: { width: '100%', height: 220, backgroundColor: '#000' },
  removeBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 20 },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reqCard: { backgroundColor: '#fff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  reqTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, marginRight: 8 },
  reqSub: { fontSize: 12, color: theme.colors.secondary, fontWeight: '600', marginTop: 4 },
  reqDesc: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  resBox: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 8, padding: 8, backgroundColor: '#E6F7E9', borderRadius: 8 },
  resTxt: { flex: 1, fontSize: 12, color: theme.colors.textPrimary, fontWeight: '600' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  reqDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 8 },
});
