import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { fonts, radius, spacing, SPEED_MAX_MPH, type ThemePalette } from '@/theme';
import { useTrip } from '@/context/TripContext';
import { useAppearance, type AppearanceMode } from '@/context/AppearanceContext';
import { AnalogDial } from '@/components/AnalogDial';
import { CompassRose } from '@/components/CompassRose';
import { DigitalReadout } from '@/components/DigitalReadout';

type Mode = 'analog' | 'digital';

function bearingLabel(deg: number): string {
  if (!Number.isFinite(deg)) return '---';
  const n = ((deg % 360) + 360) % 360;
  const rounded = Math.round(n) % 360;
  const display = rounded === 360 ? 0 : rounded;
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(display / 45) % 8;
  return `${display.toString().padStart(3, '0')}° ${cardinals[idx]}`;
}

const APPEARANCE_LABELS: Record<AppearanceMode, string> = {
  auto: 'AUTO (SUN)',
  day: 'DAY',
  night: 'NIGHT',
};

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.forgeBlack },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    brand: {
      color: palette.white,
      fontFamily: fonts.display,
      fontSize: 16.5,
      letterSpacing: 1,
    },
    brandAccent: { color: palette.forgeOrange },
    title: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 9,
      letterSpacing: 4,
    },
    simulateBtn: {
      alignSelf: 'center',
      marginBottom: spacing.md,
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: palette.slate,
    },
    simulateBtnActive: {
      borderColor: palette.forgeOrange,
      backgroundColor: palette.slateElevated,
    },
    simulateBtnText: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 2,
    },
    simulateBtnTextActive: {
      color: palette.forgeOrange,
    },
    toggleRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.xl,
      backgroundColor: palette.slate,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      padding: 4,
      marginBottom: spacing.lg,
      zIndex: 2,
      elevation: 4,
    },
    toggle: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: radius.pill,
    },
    toggleActive: {
      backgroundColor: palette.forgeOrange,
    },
    toggleLabel: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 3,
    },
    toggleLabelActive: { color: palette.ink },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      alignSelf: 'stretch',
    },
    dialStack: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    compassInset: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    digitalOuter: {
      flex: 1,
      width: '100%',
      minHeight: 0,
      alignSelf: 'stretch',
      justifyContent: 'center',
      alignItems: 'center',
    },
    digitalColumn: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: palette.slateBorder,
      backgroundColor: palette.slate,
    },
    stat: { alignItems: 'center', flex: 1 },
    statLabel: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 3,
      marginBottom: 4,
    },
    statValue: {
      color: palette.white,
      fontFamily: fonts.display,
      fontSize: 18,
      letterSpacing: 1,
    },
    permission: { alignItems: 'center', gap: 16 },
    permissionText: { color: palette.dim, fontFamily: fonts.body, fontSize: 14 },
    permissionBtn: {
      backgroundColor: palette.forgeOrange,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: radius.pill,
    },
    permissionBtnText: {
      color: palette.ink,
      fontFamily: fonts.display,
      fontSize: 14,
      letterSpacing: 2,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: palette.slateElevated,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      zIndex: 1,
      elevation: 8,
    },
    modalTitle: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 4,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    modalRow: {
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: palette.slate,
    },
    modalRowActive: {
      borderColor: palette.forgeOrange,
      backgroundColor: palette.forgeOrangeGlow,
    },
    modalRowLabel: {
      color: palette.white,
      fontFamily: fonts.display,
      fontSize: 18,
      letterSpacing: 2,
      textAlign: 'center',
    },
    modalRowLabelActive: {
      color: palette.forgeOrange,
    },
    modalHint: {
      marginTop: spacing.sm,
      color: palette.dim,
      fontFamily: fonts.body,
      fontSize: 12,
      textAlign: 'center',
    },
  });
}

export default function SpeedometerScreen() {
  useKeepAwake();

  const { width } = useWindowDimensions();
  const dialSize = Math.min(width - spacing.xl * 2, 380);
  const compassSize = dialSize * 0.42;
  const digitalContainerWidth = width - spacing.xl * 2;
  const digitalFontMax = Math.min(digitalContainerWidth * 0.44, 200);

  const trip = useTrip();
  const { mode: appearanceMode, setMode: setAppearanceMode, palette } = useAppearance();
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [mode, setMode] = useState<Mode>('analog');
  const [appearanceModal, setAppearanceModal] = useState(false);

  useEffect(() => {
    if (!trip.hasPermission) {
      trip.requestPermission();
    }
  }, [trip.hasPermission, trip.requestPermission]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setAppearanceModal(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Appearance: tap to choose day, night, or auto"
        >
          <Text style={styles.brand}>
            for<Text style={styles.brandAccent}>VEX</Text>
          </Text>
        </Pressable>
        <Text style={styles.title}>SPEEDOMETER</Text>
      </View>

      <Modal
        visible={appearanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceModal(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAppearanceModal(false)}
            accessibilityLabel="Close appearance menu"
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>APPEARANCE</Text>
            {(['auto', 'day', 'night'] as const).map((m) => {
              const active = appearanceMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setAppearanceMode(m);
                    setAppearanceModal(false);
                  }}
                  style={[styles.modalRow, active && styles.modalRowActive]}
                >
                  <Text
                    style={[styles.modalRowLabel, active && styles.modalRowLabelActive]}
                  >
                    {APPEARANCE_LABELS[m]}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.modalHint}>
              Auto follows sunrise and sunset at your GPS location. Default is auto.
            </Text>
          </View>
        </View>
      </Modal>

      <View style={styles.toggleRow}>
        <Toggle
          label="ANALOG"
          active={mode === 'analog'}
          onPress={() => setMode('analog')}
          styles={styles}
        />
        <Toggle
          label="DIGITAL"
          active={mode === 'digital'}
          onPress={() => setMode('digital')}
          styles={styles}
        />
      </View>

      {__DEV__ && trip.hasPermission && (
        <Pressable
          style={[
            styles.simulateBtn,
            trip.devSimulateMotion && styles.simulateBtnActive,
          ]}
          onPress={() => trip.setDevSimulateMotion(!trip.devSimulateMotion)}
        >
          <Text
            style={[
              styles.simulateBtnText,
              trip.devSimulateMotion && styles.simulateBtnTextActive,
            ]}
          >
            {trip.devSimulateMotion ? '● SIMULATE MOTION' : '○ SIMULATE MOTION'}
          </Text>
        </Pressable>
      )}

      <View style={styles.center}>
        {!trip.hasPermission ? (
          <View style={styles.permission}>
            <ActivityIndicator color={palette.forgeOrange} />
            <Text style={styles.permissionText}>
              Waiting for location permission…
            </Text>
            <Pressable style={styles.permissionBtn} onPress={trip.requestPermission}>
              <Text style={styles.permissionBtnText}>Grant Access</Text>
            </Pressable>
          </View>
        ) : mode === 'analog' ? (
          <View style={[styles.dialStack, { width: dialSize, height: dialSize }]}>
            <AnalogDial size={dialSize} speed={trip.speedMph} max={SPEED_MAX_MPH} />
            <View
              style={[
                styles.compassInset,
                {
                  width: compassSize,
                  height: compassSize,
                  top: dialSize / 2 - compassSize / 2,
                  left: dialSize / 2 - compassSize / 2,
                },
              ]}
              pointerEvents="none"
            >
              <CompassRose size={compassSize} headingDeg={trip.headingDeg} />
            </View>
          </View>
        ) : (
          <View style={styles.digitalOuter}>
            <View style={styles.digitalColumn}>
              <DigitalReadout
                speed={trip.speedMph}
                containerWidth={digitalContainerWidth}
                fontSizeMax={digitalFontMax}
              />
              <View style={{ height: spacing.lg }} />
              <CompassRose size={compassSize} headingDeg={trip.headingDeg} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat label="TRIP" value={`${trip.distanceMiles.toFixed(2)} mi`} styles={styles} />
        <Stat label="MAX" value={`${Math.round(trip.maxMph)} mph`} styles={styles} />
        <Stat label="HEADING" value={bearingLabel(trip.headingDeg)} styles={styles} />
      </View>
    </SafeAreaView>
  );
}

function Toggle({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggle, active && styles.toggleActive]}
    >
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}
