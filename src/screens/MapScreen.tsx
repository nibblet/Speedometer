import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import MapView, { Polyline, Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { fonts, palettes, spacing, radius, type ThemePalette } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';
import { useTrip } from '@/context/TripContext';
import { SAVED_LOOPS, type SavedLoop } from '@/data/savedLoops';
import { useSunsetMinutes } from '@/hooks/useSunsetMinutes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function createMapStyles(palette: ThemePalette) {
  const isDay = palette === palettes.day;
  const overlayCardBg = isDay ? 'rgba(232,230,227,0.94)' : 'rgba(10,10,10,0.85)';
  const sunsetBg = isDay ? 'rgba(220,218,214,0.92)' : 'rgba(22,22,22,0.92)';
  const loopChipBg = isDay ? 'rgba(212,210,206,0.95)' : 'rgba(10,10,10,0.9)';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.forgeBlack },
    safe: { flex: 1, backgroundColor: palette.forgeBlack },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyTitle: {
      color: palette.forgeOrange,
      fontFamily: fonts.display,
      fontSize: 16,
      letterSpacing: 4,
      marginBottom: spacing.sm,
    },
    emptyText: { color: palette.dim, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
    overlayTop: { position: 'absolute', top: 0, left: 0, right: 0 },
    overlayCard: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: overlayCardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sunsetRow: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: sunsetBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sunsetLabel: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 3,
    },
    sunsetValue: {
      color: palette.bone,
      fontFamily: fonts.display,
      fontSize: 15,
    },
    stat: { flex: 1, alignItems: 'center' },
    statLabel: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 3,
      marginBottom: 2,
    },
    statValue: { color: palette.white, fontFamily: fonts.display, fontSize: 16 },
    dotOuter: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: palette.forgeOrangeGlow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: palette.forgeOrange,
      borderWidth: 2,
      borderColor: palette.forgeBlack,
    },
    loopBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    loopBarTitle: {
      color: palette.dimmer,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 3,
      marginBottom: spacing.xs,
      marginHorizontal: spacing.lg,
    },
    loopScroll: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
      alignItems: 'center',
    },
    loopChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: loopChipBg,
    },
    loopChipSelected: {
      borderColor: palette.forgeOrange,
      backgroundColor: palette.forgeOrangeGlow,
    },
    loopChipText: {
      color: palette.bone,
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 1,
    },
    loopChipTextSelected: {
      color: palette.forgeOrange,
    },
    loopChipClear: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
    },
    loopChipClearText: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 12,
      letterSpacing: 2,
    },
  });
}

export default function MapScreen() {
  useKeepAwake();
  const { palette, resolved } = useAppearance();
  const styles = useMemo(() => createMapStyles(palette), [palette]);
  const trip = useTrip();
  const mapRef = useRef<MapView | null>(null);
  const [activeLoop, setActiveLoop] = useState<SavedLoop | null>(null);
  const mergedFitDoneRef = useRef(false);
  const prevLoopRef = useRef<SavedLoop | null>(null);

  const sunset = useSunsetMinutes(
    trip.position?.latitude ?? null,
    trip.position?.longitude ?? null,
  );

  const edgePad = { top: 200, right: 28, bottom: 200, left: 28 };

  // Follow GPS unless a saved loop is active (then the map stays framed so you can see the planned route).
  useEffect(() => {
    if (activeLoop != null) return;
    if (trip.position && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: trip.position.latitude,
            longitude: trip.position.longitude,
          },
        },
        { duration: 600 },
      );
    }
  }, [trip.position?.latitude, trip.position?.longitude, activeLoop]);

  useEffect(() => {
    mergedFitDoneRef.current = false;
  }, [activeLoop?.id]);

  useEffect(() => {
    if (!activeLoop || !mapRef.current) return;
    const id = setTimeout(() => {
      mapRef.current?.fitToCoordinates(activeLoop.coordinates, {
        edgePadding: edgePad,
        animated: true,
      });
    }, 80);
    return () => clearTimeout(id);
  }, [activeLoop?.id]);

  useEffect(() => {
    if (!activeLoop || !trip.position || mergedFitDoneRef.current || !mapRef.current) return;
    mergedFitDoneRef.current = true;
    mapRef.current.fitToCoordinates([...activeLoop.coordinates, trip.position], {
      edgePadding: edgePad,
      animated: true,
    });
  }, [activeLoop, trip.position?.latitude, trip.position?.longitude]);

  useEffect(() => {
    const prev = prevLoopRef.current;
    prevLoopRef.current = activeLoop;
    if (prev != null && activeLoop == null && trip.position && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: trip.position.latitude,
            longitude: trip.position.longitude,
          },
        },
        { duration: 500 },
      );
    }
  }, [activeLoop, trip.position]);

  const selectLoop = (loop: SavedLoop) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (activeLoop?.id === loop.id) {
      setActiveLoop(null);
      return;
    }
    trip.resetTrip();
    setActiveLoop(loop);
  };

  const clearLoop = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveLoop(null);
  };

  if (!trip.hasPermission || !trip.position) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>WAITING FOR GPS</Text>
          <Text style={styles.emptyText}>
            Once your position locks in, your live route will appear here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle={resolved === 'day' ? 'light' : 'dark'}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsBuildings={false}
        showsTraffic={false}
        initialRegion={{
          latitude: trip.position.latitude,
          longitude: trip.position.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
      >
        {trip.checkpoints.map((cp) => (
          <Circle
            key={cp.id}
            center={{ latitude: cp.latitude, longitude: cp.longitude }}
            radius={cp.radiusMeters}
            strokeColor="rgba(255, 106, 26, 0.45)"
            fillColor="rgba(255, 106, 26, 0.06)"
            strokeWidth={1}
          />
        ))}
        {activeLoop != null && activeLoop.coordinates.length > 1 && (
          <Polyline
            coordinates={activeLoop.coordinates}
            strokeColor="rgba(255,255,255,0.35)"
            strokeWidth={3}
            lineDashPattern={[10, 8]}
          />
        )}
        {trip.breadcrumb.length > 1 && (
          <Polyline
            coordinates={trip.breadcrumb}
            strokeColor={palette.forgeOrange}
            strokeWidth={4}
          />
        )}
        <Marker coordinate={trip.position} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.dotOuter}>
            <View style={styles.dotInner} />
          </View>
        </Marker>
      </MapView>

      <SafeAreaView edges={['top']} style={styles.overlayTop} pointerEvents="box-none">
        <View style={styles.overlayCard}>
          <Stat label="SPEED" value={`${Math.round(trip.speedMph)} mph`} styles={styles} />
          <Stat label="TRIP" value={`${trip.distanceMiles.toFixed(2)} mi`} styles={styles} />
          <Stat label="MAX" value={`${Math.round(trip.maxMph)} mph`} styles={styles} />
        </View>
        <View style={styles.sunsetRow}>
          <Text style={styles.sunsetLabel}>SUNSET</Text>
          <Text style={styles.sunsetValue}>
            {sunset.status === 'waiting' && '—'}
            {sunset.status === 'until' && `${sunset.minutes} min until dark`}
            {sunset.status === 'dark' && 'Past sunset'}
          </Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.loopBar} pointerEvents="box-none">
        <Text style={styles.loopBarTitle}>SAVED LOOPS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.loopScroll}
        >
          {SAVED_LOOPS.map((loop) => {
            const selected = activeLoop?.id === loop.id;
            return (
              <Pressable
                key={loop.id}
                onPress={() => selectLoop(loop)}
                style={[styles.loopChip, selected && styles.loopChipSelected]}
              >
                <Text style={[styles.loopChipText, selected && styles.loopChipTextSelected]}>
                  {loop.name}
                </Text>
              </Pressable>
            );
          })}
          {activeLoop != null && (
            <Pressable onPress={clearLoop} style={styles.loopChipClear}>
              <Text style={styles.loopChipClearText}>CLEAR</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createMapStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}
