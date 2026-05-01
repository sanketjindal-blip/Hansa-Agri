import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/AuthContext';
import { theme } from '../../src/theme';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const menu = [
    { icon: 'bag-outline', label: 'My Orders', onPress: () => router.push('/(tabs)/orders') },
    { icon: 'shield-checkmark-outline', label: 'Warranty', onPress: () => router.push('/(tabs)/warranty') },
    { icon: 'pricetag-outline', label: 'Offers & Discounts', onPress: () => router.push('/offers') },
    { icon: 'newspaper-outline', label: 'News & Updates', onPress: () => router.push('/news') },
    { icon: 'location-outline', label: 'Find a Dealer', onPress: () => router.push('/dealers') },
    { icon: 'headset-outline', label: 'Support & Service', onPress: () => router.push('/support') },
    ...(user?.role === 'admin' ? [{ icon: 'construct-outline', label: 'Admin Dashboard', onPress: () => router.push('/admin') }] : []),
  ];

  const onLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{user?.name?.charAt(0).toUpperCase() || 'F'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || 'Farmer'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.phone ? <Text style={styles.phone}>{user.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {menu.map(m => (
            <TouchableOpacity key={m.label} testID={`menu-${m.label}`} style={styles.row} onPress={m.onPress}>
              <View style={styles.iconBox}><Ionicons name={m.icon as any} size={20} color={theme.colors.primary} /></View>
              <Text style={styles.rowLbl}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company</Text>
          <View style={styles.info}>
            <Text style={styles.infoTitle}>Ramkishan Agri Innovate Pvt Ltd</Text>
            <Text style={styles.infoLine}>Plot No. 26, Harsh Commercial Park, Garh Road, Meerut-250002</Text>
            <Text style={styles.infoLine}>+91 9045 333 332  ·  +91 9479 333 332</Text>
            <Text style={styles.infoLine}>support@agriequipments.com</Text>
            <Text style={styles.infoTag}>OUR CULTURE IS AGRICULTURE</Text>
          </View>
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <Text style={styles.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  email: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  phone: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF4EA', alignItems: 'center', justifyContent: 'center' },
  rowLbl: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  info: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 4, borderLeftColor: theme.colors.secondary },
  infoTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  infoLine: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  infoTag: { fontSize: 10, color: theme.colors.primary, letterSpacing: 2, fontWeight: '700', marginTop: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FDE8E8', paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  logoutTxt: { color: theme.colors.danger, fontWeight: '700' },
});
