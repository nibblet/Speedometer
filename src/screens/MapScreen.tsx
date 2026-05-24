import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import MapView, {
  Polyline,
  Marker,
  Circle,
  PROVIDER_DEFAULT,
  type LongPressEvent,
} from 'react-native-maps';
import Svg, { Rect } from 'react-native-svg';
import { fonts, palettes, spacing, radius, type ThemePalette } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';
import { useTrip } from '@/context/TripContext';
import { useDaylightMessage } from '@/hooks/useDaylightMessage';
import { updateCheckpointCoordinates, type Checkpoint } from '@/db';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAP_ZOOM_DELTA = 0.005 / 1.2;
const GPS_HEADING_MIN_MPH = 1.5;

const PLACE_ORDER = ['home', 'kids_pool', 'big_park', 'amphitheatre'] as const;

const PLACE_LABELS: Record<(typeof PLACE_ORDER)[number], string> = {
  home: 'Barn',
  kids_pool: 'Pool',
  big_park: 'Big Park',
  amphitheatre: 'Amphitheatre',
};

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
      flexShrink: 1,
      textAlign: 'right',
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
    centerChipRow: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    centerChip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: overlayCardBg,
    },
    centerChipActive: {
      borderColor: palette.forgeOrange,
      backgroundColor: palette.forgeOrangeGlow,
    },
    centerChipText: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 2,
    },
    centerChipTextActive: {
      color: palette.forgeOrange,
    },
    cartMarker: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: palette.forgeOrangeGlow,
      borderWidth: 1,
      borderColor: palette.forgeOrange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placePin: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: palette.forgeOrange,
      borderWidth: 2,
      borderColor: palette.white,
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
    placeHint: {
      color: palette.dim,
      fontFamily: fonts.body,
      fontSize: 11,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    placeCoords: {
      color: palette.bone,
      fontFamily: fonts.body,
      fontSize: 11,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
      letterSpacing: 0.5,
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
  });
}

const PLACE_KEY_SET = new Set<string>(PLACE_ORDER);

function sortPlaces(checkpoints: Checkpoint[]): Checkpoint[] {
  const order = new Map(PLACE_ORDER.map((key, i) => [key, i]));
  return [...checkpoints].sort((a, b) => {
    const ai = order.get(a.key as (typeof PLACE_ORDER)[number]) ?? 99;
    const bi = order.get(b.key as (typeof PLACE_ORDER)[number]) ?? 99;
    return ai - bi;
  });
}

function placeLabel(cp: Checkpoint): string {
  return PLACE_LABELS[cp.key as (typeof PLACE_ORDER)[number]] ?? cp.name;
}

export default function MapScreen() {
  useKeepAwake();
  const { palette, resolved } = useAppearance();
  const styles = useMemo(() => createMapStyles(palette), [palette]);
  const trip = useTrip();
  const mapRef = useRef<MapView | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [armedPlaceKey, setArmedPlaceKey] = useState<string | null>(null);
  const lastMovingHeadingRef = useRef(0);

  const daylight = useDaylightMessage(
    trip.position?.latitude ?? null,
    trip.position?.longitude ?? null,
  );

  const sortedPlaces = useMemo(
    () => sortPlaces(trip.checkpoints.filter((cp) => PLACE_KEY_SET.has(cp.key))),
    [trip.checkpoints],
  );

  const armedPlace = armedPlaceKey
    ? sortedPlaces.find((cp) => cp.key === armedPlaceKey) ?? null
    : null;

  const mapHeading =
    trip.speedMph > GPS_HEADING_MIN_MPH ? trip.headingDeg : lastMovingHeadingRef.current;

  useEffect(() => {
    if (trip.speedMph > GPS_HEADING_MIN_MPH) {
      lastMovingHeadingRef.current = trip.headingDeg;
    }
  }, [trip.speedMph, trip.headingDeg]);

  const animateToCart = useCallback(
    (duration = 600) => {
      if (!trip.position || !mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center: {
            latitude: trip.position.latitude,
            longitude: trip.position.longitude,
          },
          heading: mapHeading,
          pitch: 0,
        },
        { duration },
      );
    },
    [trip.position, mapHeading],
  );

  useEffect(() => {
    if (!isFollowing) return;
    animateToCart();
  }, [trip.position?.latitude, trip.position?.longitude, isFollowing, animateToCart]);

  const togglePlace = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArmedPlaceKey((prev) => (prev === key ? null : key));
  };

  const handleMapLongPress = (event: LongPressEvent) => {
    const { coordinate } = event.nativeEvent;
    if (!armedPlace) {
      Alert.alert('Select a place', 'Tap Barn, Pool, Big Park, or Amphitheatre first.');
      return;
    }
    const label = placeLabel(armedPlace);
    Alert.alert(
      `Set ${label} here?`,
      `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: () => {
            updateCheckpointCoordinates(armedPlace.key, coordinate.latitude, coordinate.longitude);
            trip.refreshCheckpoints();
            setIsFollowing(false);
          },
        },
      ],
    );
  };

  if (!trip.hasPermission || !trip.position) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>WARMING UP THE CART</Text>
          <Text style={styles.emptyText}>
            Once the satellites find your fairway, your joyride shows up here.
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
        rotateEnabled
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        onPanDrag={() => setIsFollowing(false)}
        onLongPress={handleMapLongPress}
        initialRegion={{
          latitude: trip.position.latitude,
          longitude: trip.position.longitude,
          latitudeDelta: MAP_ZOOM_DELTA,
          longitudeDelta: MAP_ZOOM_DELTA,
        }}
      >
        {trip.checkpoints.map((cp) => (
          <React.Fragment key={cp.id}>
            <Circle
              center={{ latitude: cp.latitude, longitude: cp.longitude }}
              radius={cp.radiusMeters}
              strokeColor="rgba(255, 106, 26, 0.45)"
              fillColor="rgba(255, 106, 26, 0.06)"
              strokeWidth={1}
            />
            <Marker
              coordinate={{ latitude: cp.latitude, longitude: cp.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              title={placeLabel(cp)}
            >
              <View style={styles.placePin} />
            </Marker>
          </React.Fragment>
        ))}
        {trip.breadcrumb.length > 1 && (
          <Polyline
            coordinates={trip.breadcrumb}
            strokeColor={palette.forgeOrange}
            strokeWidth={4}
          />
        )}
        <Marker coordinate={trip.position} anchor={{ x: 0.5, y: 0.5 }} flat rotation={0}>
          <View style={styles.cartMarker}>
            <CartIcon palette={palette} />
          </View>
        </Marker>
      </MapView>

      <SafeAreaView edges={['top']} style={styles.overlayTop} pointerEvents="box-none">
        <View style={styles.overlayCard}>
          <Stat label="SPEED" value={`${Math.round(trip.speedMph)} mph`} styles={styles} />
          <Stat label="DISTANCE" value={`${trip.distanceMiles.toFixed(2)} mi`} styles={styles} />
        </View>
        <View style={styles.sunsetRow}>
          <Text style={styles.sunsetLabel}>
            {daylight.status === 'ready' ? daylight.label : 'DAYLIGHT'}
          </Text>
          <Text style={styles.sunsetValue}>
            {daylight.status === 'waiting' ? '—' : daylight.message}
          </Text>
        </View>
        <View style={styles.centerChipRow} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              setIsFollowing(true);
              animateToCart(400);
            }}
            style={[styles.centerChip, isFollowing && styles.centerChipActive]}
          >
            <Text style={[styles.centerChipText, isFollowing && styles.centerChipTextActive]}>
              CENTER
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.loopBar} pointerEvents="box-none">
        <Text style={styles.loopBarTitle}>PLACES</Text>
        {armedPlace != null && (
          <>
            <Text style={styles.placeHint}>Long-press map to set</Text>
            <Text style={styles.placeCoords}>
              {armedPlace.latitude.toFixed(6)}, {armedPlace.longitude.toFixed(6)}
            </Text>
          </>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.loopScroll}
        >
          {sortedPlaces.map((cp) => {
            const selected = armedPlaceKey === cp.key;
            return (
              <Pressable
                key={cp.key}
                onPress={() => togglePlace(cp.key)}
                style={[styles.loopChip, selected && styles.loopChipSelected]}
              >
                <Text style={[styles.loopChipText, selected && styles.loopChipTextSelected]}>
                  {placeLabel(cp)}
                </Text>
              </Pressable>
            );
          })}
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

function CartIcon({ palette }: { palette: ThemePalette }) {
  const roof = palette.forgeOrange;
  const tire = palette.forgeBlack;
  const trim = palette.forgeOrangeDim;
  const windshield = palette.bone;
  return (
    <Svg width={22} height={28} viewBox="0 0 28 36">
      <Rect x={2} y={6} width={3} height={5} rx={1} fill={tire} />
      <Rect x={23} y={6} width={3} height={5} rx={1} fill={tire} />
      <Rect x={2} y={25} width={3} height={5} rx={1} fill={tire} />
      <Rect x={23} y={25} width={3} height={5} rx={1} fill={tire} />
      <Rect x={5} y={3} width={18} height={30} rx={4} fill={roof} stroke={trim} strokeWidth={1} />
      <Rect x={7} y={5} width={14} height={4} rx={1.5} fill={windshield} opacity={0.85} />
      <Rect x={7} y={18} width={14} height={1.5} rx={0.5} fill={trim} opacity={0.5} />
    </Svg>
  );
}
