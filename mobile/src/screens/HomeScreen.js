import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
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
];

function MenuCard({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <Ionicons name={icon} size={24} color={colors.primary} />
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
  const firstName = (user?.fullname || '').split(' ')[0];

  return (
    <View style={styles.root}>
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
