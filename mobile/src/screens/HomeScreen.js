import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../offline/OfflineContext';
import { colors, radius, shadow, spacing, type } from '../theme';

const markWhite = require('../../assets/nardeli-mark-white.png');

const MENU = [
  {
    key: 'Events',
    icon: 'calendar',
    title: 'Eventos',
    subtitle: 'Agenda y detalle de cada evento',
  },
  {
    key: 'Clientes',
    icon: 'people',
    title: 'Clientes',
    subtitle: 'Busca clientes y su historial',
  },
  {
    key: 'Reportes',
    icon: 'stats-chart',
    title: 'Reportes',
    subtitle: 'Ingresos por periodo',
  },
  {
    key: 'Inventario',
    icon: 'cube',
    title: 'Inventario',
    subtitle: 'Existencias y precios',
  },
  {
    key: 'SyncStatus',
    icon: 'sync',
    title: 'Sincronización',
    subtitle: 'Copia local y cambios pendientes',
  },
];

function MenuCard({ icon, title, subtitle, onPress, badge }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <Ionicons name={icon} size={24} color={colors.primary} />
        {badge > 0 && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <View style={styles.cardArrow}>
        <Ionicons name="arrow-forward" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, errorCount, conflictCount } = useOffline();
  const firstName = (user?.fullname || '').split(' ')[0];
  const syncBadge = pendingCount + errorCount + conflictCount;

  return (
    <View style={styles.root}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.offlineBannerText}>Sin conexión — trabajando con la copia local</Text>
        </View>
      )}
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.heroRow}>
            <View style={styles.heroBrand}>
              <View style={styles.heroBadge}>
                <Image source={markWhite} style={styles.heroMark} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.heroGreeting}>
                  Hola{firstName ? `, ${firstName}` : ''}
                </Text>
                <Text style={styles.heroSub}>Nardéli · Centro de Eventos</Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutBtn} hitSlop={10}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>MENÚ PRINCIPAL</Text>
        <View style={styles.grid}>
          {MENU.map((m) => (
            <MenuCard
              key={m.key}
              icon={m.icon}
              title={m.title}
              subtitle={m.subtitle}
              badge={m.key === 'SyncStatus' ? syncBadge : 0}
              onPress={() => navigation.navigate(m.key)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingVertical: 6,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hero: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingBottom: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMark: { width: 24, height: 24 },
  heroGreeting: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.lg },
  sectionLabel: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm + 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 148,
    ...shadow.sm,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
  },
  cardBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  cardArrow: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
