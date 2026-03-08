import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import * as SplashScreen from 'expo-splash-screen';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.45, 200);

// ─── Animated pulsing dots ────────────────────────────────────────────────────
const PulsingDot = ({ delay, color }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[styles.dot, { opacity, backgroundColor: color }]} />;
};

// ─── Logo: cross + rotated pill ───────────────────────────────────────────────
const AushadXLogo = ({ size }) => {
  const arm = size * 0.235;   // thickness of each arm
  const seg = size * 0.312;   // length of each arm from center

  // Pill dimensions (before rotation)
  const pillW = size * 0.234;
  const pillH = size * 0.547;
  const pillR = pillW / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* ── Background circle ── */}
      <View style={{
        position: 'absolute',
        width: size * 0.92,
        height: size * 0.92,
        borderRadius: size * 0.46,
        backgroundColor: '#245173',
        top: size * 0.04,
        left: size * 0.04,
      }} />

      {/* ── Medical cross (two overlapping rects) ── */}
      {/* Vertical bar */}
      <View style={{
        position: 'absolute',
        width: arm,
        height: arm + seg * 2,
        backgroundColor: '#EAF9FB',
        borderRadius: arm * 0.18,
        left: (size - arm) / 2,
        top: (size - (arm + seg * 2)) / 2,
      }} />
      {/* Horizontal bar */}
      <View style={{
        position: 'absolute',
        width: arm + seg * 2,
        height: arm,
        backgroundColor: '#EAF9FB',
        borderRadius: arm * 0.18,
        top: (size - arm) / 2,
        left: (size - (arm + seg * 2)) / 2,
      }} />

      {/* ── Pill (rotated 45°) ── */}
      <View style={{
        position: 'absolute',
        width: pillW,
        height: pillH,
        borderRadius: pillR,
        overflow: 'hidden',
        transform: [{ rotate: '45deg' }],
        // Soft border
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.25)',
      }}>
        {/* White half */}
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: pillH / 2,
          backgroundColor: '#F0F8FB',
        }} />
        {/* Blue half */}
        <View style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: pillH / 2,
          backgroundColor: '#14467D',
        }} />
        {/* Divider */}
        <View style={{
          position: 'absolute',
          top: pillH / 2 - 1,
          left: 0, right: 0,
          height: 2,
          backgroundColor: '#0B233D',
        }} />
        {/* Shine streak */}
        <View style={{
          position: 'absolute',
          top: 6, bottom: 6,
          left: pillW * 0.18,
          width: pillW * 0.18,
          borderRadius: 4,
          backgroundColor: 'rgba(255,255,255,0.55)',
        }} />
      </View>
    </View>
  );
};

// ─── Main Splash ──────────────────────────────────────────────────────────────
const BootSplash = () => {
  const { colors, isDark } = useTheme();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    // Hide the native static splash screen before starting the JS animation
    SplashScreen.hideAsync().catch(() => {});

    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={{ opacity: fadeIn, transform: [{ scale: logoScale }], alignItems: 'center' }}>
        {/* Logo */}
        <AushadXLogo size={LOGO_SIZE} />

        {/* App name */}
        <View style={styles.appNameContainer}>
          <Text style={[styles.appName, { color: isDark ? '#FFFFFF' : '#0B233D' }]}>Aushad</Text>
          <Text style={[styles.appName, { color: '#4B90A6' }]}>X</Text>
        </View>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your Smart Medicine Companion</Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: fadeIn }]}>
        <PulsingDot delay={0} color={isDark ? '#8EDCE8' : '#4B90A6'} />
        <PulsingDot delay={180} color={isDark ? '#8EDCE8' : '#4B90A6'} />
        <PulsingDot delay={360} color={isDark ? '#8EDCE8' : '#4B90A6'} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appNameContainer: {
    flexDirection: 'row',
    marginTop: 22,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});

export default BootSplash;
