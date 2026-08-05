import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow, spacing, type } from '../theme';

const markWhite = require('../../assets/nardeli-mark-white.png');
const markMaroon = require('../../assets/nardeli-mark-maroon.png');

const Field = React.forwardRef(function Field(
  { icon, secureField, value, onChangeText, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [secure, setSecure] = useState(!!secureField);

  return (
    <View
      style={[
        styles.field,
        focused && styles.fieldFocused,
      ]}
    >
      <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        ref={ref}
        style={styles.fieldInput}
        placeholderTextColor="#b9a7b0"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secureField ? secure : false}
        {...props}
      />
      {secureField && (
        <TouchableOpacity hitSlop={10} onPress={() => setSecure((s) => !s)}>
          <Ionicons
            name={secure ? 'eye-outline' : 'eye-off-outline'}
            size={19}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef(null);
  const anim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(badgeAnim, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [anim, badgeAnim]);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const cardTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const badgeScale = badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}
      >
        <Image
          source={markWhite}
          style={styles.watermark}
          resizeMode="contain"
          pointerEvents="none"
        />
        <Image
          source={markWhite}
          style={styles.watermarkSmall}
          resizeMode="contain"
          pointerEvents="none"
        />

        <Animated.View
          style={[
            styles.badge,
            { transform: [{ scale: badgeScale }] },
          ]}
        >
          <Image source={markMaroon} style={styles.badgeMark} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.brandName}>Nardéli</Text>
        <Text style={styles.brandTagline}>CENTRO DE EVENTOS</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.card,
              { opacity: anim, transform: [{ translateY: cardTranslateY }] },
            ]}
          >
            <Text style={styles.welcome}>Bienvenido de nuevo</Text>
            <Text style={styles.welcomeSub}>Ingresa a tu panel operativo</Text>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Correo</Text>
              <Field
                icon="mail-outline"
                placeholder="tucorreo@nardeli.mx"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Contraseña</Text>
              <Field
                ref={passwordRef}
                icon="lock-closed-outline"
                placeholder="••••••••"
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                secureField
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleSubmit}
              />
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={loading}
              style={styles.buttonWrap}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                {loading ? (
                  <Text style={styles.buttonText}>Entrando…</Text>
                ) : (
                  <>
                    <Text style={styles.buttonText}>Entrar</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.footer}>
            <Image source={markMaroon} style={styles.footerMark} resizeMode="contain" />
            <Text style={styles.footerText}>Nardéli · Centro de Eventos</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingBottom: 36,
    borderBottomLeftRadius: radius.xl + 14,
    borderBottomRightRadius: radius.xl + 14,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    width: 260,
    height: 260,
    top: -70,
    right: -90,
    opacity: 0.1,
    transform: [{ rotate: '18deg' }],
  },
  watermarkSmall: {
    position: 'absolute',
    width: 130,
    height: 130,
    bottom: -30,
    left: -40,
    opacity: 0.08,
    transform: [{ rotate: '-12deg' }],
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.md,
  },
  badgeMark: { width: 40, height: 40 },
  brandName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 3,
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: 50,
    ...shadow.md,
  },
  welcome: { ...type.h2, color: colors.text },
  welcomeSub: { ...type.body, color: colors.textMuted, marginTop: 2, marginBottom: spacing.lg },
  formGroup: { marginBottom: spacing.md },
  fieldLabel: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 50,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  fieldInput: { flex: 1, fontSize: 15, color: colors.text },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  buttonWrap: { borderRadius: radius.md, marginTop: spacing.xs, ...shadow.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 15,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  footerMark: { width: 14, height: 14, opacity: 0.6 },
  footerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
