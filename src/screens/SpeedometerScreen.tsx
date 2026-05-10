import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { colors, fonts, radius, spacing, SPEED_MAX_MPH } from '@/theme';
import { useTrip } from '@/context/TripContext';
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

export default function SpeedometerScreen() {
  // Keep the phone screen awake for the entire time this screen is mounted
  useKeepAwake();

  const { width } = useWindowDimensions();
  const dialSize = Math.min(width - spacing.xl * 2, 380);
  const compassSize = dialSize * 0.42;

  const trip = useTrip();
  const [mode, setMode] = useState<Mode>('analog');

  // Request permission on first mount
  useEffect(() => {
    if (!trip.hasPermission) {
      trip.requestPermission();
    }
  }, [trip.hasPermission, trip.requestPermission]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          for<Text style={styles.brandAccent}>VEX</Text>
        </Text>
        <Text style={styles.title}>SPEEDOMETER</Text>
      </View>

      <View style={styles.toggleRow}>
        <Toggle
          label="ANALOG"
          active={mode === 'analog'}
          onPress={() => setMode('analog')}
        />
        <Toggle
          label="DIGITAL"
          active={mode === 'digital'}
          onPress={() => setMode('digital')}
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
            <ActivityIndicator color={colors.forgeOrange} />
            <Text style={styles.permissionText}>
              Waiting for location permission…
            </Text>
            <Pressable
              style={styles.permissionBtn}
              onPress={trip.requestPermission}
            >
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
          <View style={styles.digitalStack}>
            <DigitalReadout speed={trip.speedMph} size={dialSize * 0.95} />
            <View style={{ height: spacing.xl }} />
            <CompassRose size={compassSize} headingDeg={trip.headingDeg} />
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat label="TRIP" value={`${trip.distanceMiles.toFixed(2)} mi`} />
        <Stat label="MAX" value={`${Math.round(trip.maxMph)} mph`} />
        <Stat label="HEADING" value={bearingLabel(trip.headingDeg)} />
      </View>
    </SafeAreaView>
  );
}

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.forgeBlack },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  brand: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1,
  },
  brandAccent: { color: colors.forgeOrange },
  title: {
    color: colors.dim,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 4,
  },
  simulateBtn: {
    alignSelf: 'center',
    marginBottom: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.slateBorder,
    backgroundColor: colors.slate,
  },
  simulateBtnActive: {
    borderColor: colors.forgeOrange,
    backgroundColor: colors.slateElevated,
  },
  simulateBtnText: {
    color: colors.dim,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 2,
  },
  simulateBtnTextActive: {
    color: colors.forgeOrange,
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    backgroundColor: colors.slate,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.slateBorder,
    padding: 4,
    marginBottom: spacing.lg,
    // Ensure toggles stay above the flex area: huge digital text can overflow and
    // steal touches from earlier siblings (later siblings paint/evaluate hits on top).
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
    backgroundColor: colors.forgeOrange,
  },
  toggleLabel: {
    color: colors.dim,
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 3,
  },
  toggleLabelActive: { color: colors.forgeBlack },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  digitalStack: { alignItems: 'center', justifyContent: 'center' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.slateBorder,
    backgroundColor: colors.slate,
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: {
    color: colors.dim,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 4,
  },
  statValue: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
  },
  permission: { alignItems: 'center', gap: 16 },
  permissionText: { color: colors.dim, fontFamily: fonts.body, fontSize: 14 },
  permissionBtn: {
    backgroundColor: colors.forgeOrange,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
  },
  permissionBtnText: {
    color: colors.forgeBlack,
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 2,
  },
});
