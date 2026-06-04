import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import MapView, {
  Polyline,
  Marker,
  Circle,
  PROVIDER_DEFAULT,
  type LongPressEvent,
} from 'react-native-maps';
import Svg, { Rect, Path } from 'react-native-svg';
import { fonts, spacing, radius, type ThemePalette } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';
import { useTrip } from '@/context/TripContext';
import { useBattery } from '@/context/BatteryContext';
import { useDaylightMessage } from '@/hooks/useDaylightMessage';
import { FEATURES } from '@/config';
import {
  createCheckpoint,
  deleteCheckpoint,
  renameCheckpoint,
  updateCheckpointCoordinates,
  type Checkpoint,
} from '@/db';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAP_ZOOM_DELTA = 0.0022;
const GPS_HEADING_MIN_MPH = 1.5;
/** Above this speed the 3D tilt auto-flattens to top-down for clarity. */
const AUTOFLATTEN_MPH = 15;

/**
 * Street vs Course mode. Street is the default 3D street map for cruising the
 * neighborhood; Course swaps to hybrid satellite imagery (the same view you get
 * in Apple/Google Maps) so the fairways, greens, and cart paths show through —
 * a "golf course mode" without needing any licensed course data.
 */
type MapMode = 'street' | 'course';
const MAP_MODE_KEY = 'mapMode';

type PlaceEditor =
  | { mode: 'add'; name: string }
  | { mode: 'rename'; id: number; name: string };

type LatLng = { latitude: number; longitude: number };

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** True bearing (0-360) from `a` to `b`. */
function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function formatDistance(meters: number): string {
  const ft = meters * 3.28084;
  if (ft < 1000) return `${Math.round(ft)} ft`;
  return `${(meters / 1609.344).toFixed(2)} mi`;
}

function createMapStyles(palette: ThemePalette, isDay: boolean) {
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
    statValueBig: {
      color: palette.white,
      fontFamily: fonts.display,
      fontSize: 48,
      lineHeight: 52,
      letterSpacing: 1,
    },
    overlayRightCol: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    miniStat: { alignItems: 'flex-end' },
    miniValue: {
      color: palette.white,
      fontFamily: fonts.display,
      fontSize: 18,
    },
    directionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    directionText: {
      color: palette.bone,
      fontFamily: fonts.display,
      fontSize: 16,
      letterSpacing: 0.5,
    },
    controlRow: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rightChips: { flexDirection: 'row', gap: spacing.sm },
    // Street/Course segmented control
    modeSegment: {
      flexDirection: 'row',
      backgroundColor: overlayCardBg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      padding: 3,
    },
    modeSegmentItem: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    modeSegmentItemActive: { backgroundColor: palette.forgeOrange },
    modeSegmentText: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 2,
    },
    modeSegmentTextActive: { color: palette.ink },
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
    placePinWrap: { alignItems: 'center' },
    placePinLabel: {
      color: isDay ? palette.ink : palette.white,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: isDay ? 'rgba(244,242,238,0.95)' : 'rgba(0,0,0,0.7)',
      overflow: 'hidden',
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
    loopBarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    loopBarTitle: {
      color: palette.dimmer,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 3,
    },
    placeActions: { flexDirection: 'row', gap: spacing.md },
    placeActionText: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 1,
    },
    placeActionDanger: { color: palette.danger },
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
      flexDirection: 'row',
      alignItems: 'center',
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
    chipDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
      backgroundColor: palette.forgeOrange,
    },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: palette.forgeOrange,
      backgroundColor: loopChipBg,
    },
    addChipText: {
      color: palette.forgeOrange,
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 1,
    },
    // Add / rename modal
    modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: palette.slateElevated,
      padding: spacing.lg,
    },
    modalTitle: {
      color: palette.dim,
      fontFamily: fonts.bold,
      fontSize: 11,
      letterSpacing: 4,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    modalInput: {
      borderWidth: 1,
      borderColor: palette.slateBorder,
      borderRadius: radius.md,
      backgroundColor: palette.slate,
      color: palette.white,
      fontFamily: fonts.display,
      fontSize: 18,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    modalBtnRow: { flexDirection: 'row', gap: spacing.sm },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.slateBorder,
      backgroundColor: palette.slate,
      alignItems: 'center',
    },
    modalBtnPrimary: {
      borderColor: palette.forgeOrange,
      backgroundColor: palette.forgeOrange,
    },
    modalBtnText: {
      color: palette.bone,
      fontFamily: fonts.display,
      fontSize: 15,
      letterSpacing: 2,
    },
    modalBtnTextPrimary: { color: palette.ink },
  });
}

export default function MapScreen() {
  useKeepAwake();
  const { palette, resolved } = useAppearance();
  const isDay = resolved === 'day';
  const styles = useMemo(() => createMapStyles(palette, isDay), [palette, isDay]);
  const trip = useTrip();
  const battery = useBattery();
  const mapRef = useRef<MapView | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [is3D, setIs3D] = useState(true); // 3D tilt on by default
  const [mapMode, setMapModeState] = useState<MapMode>('street');
  const [armedPlaceId, setArmedPlaceId] = useState<number | null>(null);
  const [placeEditor, setPlaceEditor] = useState<PlaceEditor | null>(null);
  const lastMovingHeadingRef = useRef(0);

  // Restore the last-used map mode.
  useEffect(() => {
    AsyncStorage.getItem(MAP_MODE_KEY).then((v) => {
      if (v === 'street' || v === 'course') setMapModeState(v);
    });
  }, []);

  const setMapMode = useCallback((m: MapMode) => {
    setMapModeState(m);
    AsyncStorage.setItem(MAP_MODE_KEY, m).catch(() => {});
  }, []);

  const daylight = useDaylightMessage(
    trip.position?.latitude ?? null,
    trip.position?.longitude ?? null,
  );

  const places = trip.checkpoints;
  const armedPlace = armedPlaceId != null
    ? places.find((cp) => cp.id === armedPlaceId) ?? null
    : null;

  const mapHeading =
    trip.speedMph > GPS_HEADING_MIN_MPH ? trip.headingDeg : lastMovingHeadingRef.current;

  // Distance + heading-relative bearing from the cart to the selected place.
  const targetInfo = useMemo(() => {
    if (!armedPlace || !trip.position) return null;
    const to = { latitude: armedPlace.latitude, longitude: armedPlace.longitude };
    const meters = haversineMeters(trip.position, to);
    const relative = ((bearingDeg(trip.position, to) - mapHeading) % 360 + 360) % 360;
    return { meters, relative };
  }, [armedPlace, trip.position, mapHeading]);

  const chargeValue =
    battery.percent != null
      ? `${Math.round(battery.percent)}%`
      : battery.available && battery.scanning
        ? '···'
        : '--';

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
          pitch: is3D && trip.speedMph < AUTOFLATTEN_MPH ? 55 : 0,
        },
        { duration },
      );
    },
    [trip.position, mapHeading, is3D, trip.speedMph],
  );

  const toggle3D = useCallback(() => {
    const next = !is3D;
    setIs3D(next);
    if (trip.position && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: trip.position.latitude,
            longitude: trip.position.longitude,
          },
          heading: mapHeading,
          pitch: next && trip.speedMph < AUTOFLATTEN_MPH ? 55 : 0,
        },
        { duration: 500 },
      );
    }
  }, [is3D, trip.position, mapHeading, trip.speedMph]);

  useEffect(() => {
    if (!isFollowing) return;
    animateToCart();
  }, [trip.position?.latitude, trip.position?.longitude, isFollowing, animateToCart]);

  const togglePlace = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArmedPlaceId((prev) => (prev === id ? null : id));
  };

  const openAddPlace = () => {
    if (!trip.position) {
      Alert.alert('No GPS fix yet', 'Wait for your location, then add a place where the cart is.');
      return;
    }
    setPlaceEditor({ mode: 'add', name: '' });
  };

  const openRenamePlace = (cp: Checkpoint) => {
    setPlaceEditor({ mode: 'rename', id: cp.id, name: cp.name });
  };

  const savePlaceEditor = () => {
    if (!placeEditor) return;
    const name = placeEditor.name.trim() || 'Place';
    if (placeEditor.mode === 'add') {
      if (!trip.position) return;
      const cp = createCheckpoint({
        name,
        latitude: trip.position.latitude,
        longitude: trip.position.longitude,
      });
      trip.refreshCheckpoints();
      setArmedPlaceId(cp.id);
    } else {
      renameCheckpoint(placeEditor.id, name);
      trip.refreshCheckpoints();
    }
    setPlaceEditor(null);
  };

  const removePlace = (cp: Checkpoint) => {
    Alert.alert(`Remove ${cp.name}?`, 'This deletes the place from your map.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteCheckpoint(cp.id);
          if (armedPlaceId === cp.id) setArmedPlaceId(null);
          trip.refreshCheckpoints();
        },
      },
    ]);
  };

  const handleMapLongPress = (event: LongPressEvent) => {
    const { coordinate } = event.nativeEvent;
    if (!armedPlace) {
      Alert.alert('Pick a place first', 'Tap a place chip below (or + Add) before long-pressing to move it.');
      return;
    }
    Alert.alert(
      `Move ${armedPlace.name} here?`,
      `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: () => {
            updateCheckpointCoordinates(armedPlace.id, coordinate.latitude, coordinate.longitude);
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
        mapType={mapMode === 'course' ? 'hybrid' : 'standard'}
        userInterfaceStyle={resolved === 'day' ? 'light' : 'dark'}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsBuildings
        showsTraffic={false}
        rotateEnabled
        scrollEnabled
        zoomEnabled
        pitchEnabled
        onPanDrag={() => setIsFollowing(false)}
        onLongPress={handleMapLongPress}
        initialRegion={{
          latitude: trip.position.latitude,
          longitude: trip.position.longitude,
          latitudeDelta: MAP_ZOOM_DELTA,
          longitudeDelta: MAP_ZOOM_DELTA,
        }}
      >
        {places.map((cp) => (
          <React.Fragment key={cp.id}>
            <Circle
              center={{ latitude: cp.latitude, longitude: cp.longitude }}
              radius={cp.radiusMeters}
              strokeColor={palette.forgeOrange}
              fillColor={palette.forgeOrangeGlow}
              strokeWidth={1}
            />
            <Marker
              coordinate={{ latitude: cp.latitude, longitude: cp.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              title={cp.name}
            >
              <View style={styles.placePinWrap}>
                <Text style={styles.placePinLabel}>{cp.name}</Text>
                <View style={styles.placePin} />
              </View>
            </Marker>
          </React.Fragment>
        ))}
        {trip.breadcrumb.length > 1 && (
          <>
            {/* Course mode: dark casing under the trail so it reads over satellite greens. */}
            {mapMode === 'course' && (
              <Polyline
                coordinates={trip.breadcrumb}
                strokeColor="rgba(0,0,0,0.55)"
                strokeWidth={9}
              />
            )}
            <Polyline
              coordinates={trip.breadcrumb}
              strokeColor={palette.forgeOrange}
              strokeWidth={mapMode === 'course' ? 5 : 4}
            />
          </>
        )}
        <Marker coordinate={trip.position} anchor={{ x: 0.5, y: 0.5 }} flat rotation={0}>
          <View style={styles.cartMarker}>
            <CartIcon palette={palette} />
          </View>
        </Marker>
      </MapView>

      <SafeAreaView edges={['top']} style={styles.overlayTop} pointerEvents="box-none">
        <View style={styles.overlayCard}>
          <Stat
            label="SPEED"
            value={`${Math.round(trip.speedMph)}`}
            unit="mph"
            big
            styles={styles}
          />
          <View style={styles.overlayRightCol}>
            <View style={styles.miniStat}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.miniValue}>{trip.distanceMiles.toFixed(2)} mi</Text>
            </View>
            {FEATURES.battery && (
              <View style={styles.miniStat}>
                <Text style={styles.statLabel}>CHARGE</Text>
                <Text style={styles.miniValue}>{chargeValue}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.sunsetRow}>
          <Text style={styles.sunsetLabel}>
            {daylight.status === 'ready' ? daylight.label : 'DAYLIGHT'}
          </Text>
          <Text style={styles.sunsetValue}>
            {daylight.status === 'waiting' ? '—' : daylight.message}
          </Text>
        </View>
        <View style={styles.controlRow} pointerEvents="box-none">
          <View style={styles.modeSegment}>
            {(['street', 'course'] as const).map((m) => {
              const active = mapMode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMapMode(m)}
                  style={[styles.modeSegmentItem, active && styles.modeSegmentItemActive]}
                >
                  <Text style={[styles.modeSegmentText, active && styles.modeSegmentTextActive]}>
                    {m === 'street' ? 'STREET' : 'COURSE'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.rightChips}>
            <Pressable
              onPress={toggle3D}
              style={[styles.centerChip, is3D && styles.centerChipActive]}
            >
              <Text style={[styles.centerChipText, is3D && styles.centerChipTextActive]}>3D</Text>
            </Pressable>
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
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.loopBar} pointerEvents="box-none">
        <View style={styles.loopBarHeader}>
          <Text style={styles.loopBarTitle}>PLACES</Text>
          {armedPlace != null && (
            <View style={styles.placeActions}>
              <Pressable onPress={() => openRenamePlace(armedPlace)} hitSlop={8}>
                <Text style={styles.placeActionText}>RENAME</Text>
              </Pressable>
              <Pressable onPress={() => removePlace(armedPlace)} hitSlop={8}>
                <Text style={[styles.placeActionText, styles.placeActionDanger]}>REMOVE</Text>
              </Pressable>
            </View>
          )}
        </View>
        {armedPlace != null ? (
          targetInfo ? (
            <>
              <View style={styles.directionRow}>
                <DirectionArrow deg={targetInfo.relative} color={palette.forgeOrange} />
                <Text style={styles.directionText}>
                  {armedPlace.name} · {formatDistance(targetInfo.meters)}
                </Text>
              </View>
              <Text style={styles.placeHint}>Long-press the map to move this pin</Text>
            </>
          ) : (
            <Text style={styles.placeCoords}>
              {armedPlace.latitude.toFixed(6)}, {armedPlace.longitude.toFixed(6)}
            </Text>
          )
        ) : places.length === 0 ? (
          <Text style={styles.placeHint}>
            No places yet — tap + Add to drop your cart spot, the clubhouse, home, anywhere.
          </Text>
        ) : (
          <Text style={styles.placeHint}>Tap a place to see distance and direction to it.</Text>
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.loopScroll}
        >
          {places.map((cp) => {
            const selected = armedPlaceId === cp.id;
            return (
              <Pressable
                key={cp.id}
                onPress={() => togglePlace(cp.id)}
                style={[styles.loopChip, selected && styles.loopChipSelected]}
              >
                <View style={styles.chipDot} />
                <Text style={[styles.loopChipText, selected && styles.loopChipTextSelected]}>
                  {cp.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={openAddPlace} style={styles.addChip}>
            <Text style={styles.addChipText}>+ ADD</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={placeEditor != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPlaceEditor(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setPlaceEditor(null)}
            accessibilityLabel="Close"
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {placeEditor?.mode === 'rename' ? 'RENAME PLACE' : 'ADD PLACE HERE'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={placeEditor?.name ?? ''}
              onChangeText={(t) =>
                setPlaceEditor((prev) => (prev ? { ...prev, name: t } : prev))
              }
              placeholder="Clubhouse, Home, Cart Barn…"
              placeholderTextColor={palette.dimmer}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={savePlaceEditor}
            />
            <View style={styles.modalBtnRow}>
              <Pressable style={styles.modalBtn} onPress={() => setPlaceEditor(null)}>
                <Text style={styles.modalBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={savePlaceEditor}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>SAVE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({
  label,
  value,
  unit,
  big,
  styles,
}: {
  label: string;
  value: string;
  unit?: string;
  big?: boolean;
  styles: ReturnType<typeof createMapStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>
        {label}
        {unit ? ` · ${unit.toUpperCase()}` : ''}
      </Text>
      <Text style={big ? styles.statValueBig : styles.statValue}>{value}</Text>
    </View>
  );
}

/** Triangle arrow pointing `deg` clockwise from straight up (0 = ahead). */
function DirectionArrow({ deg, color }: { deg: number; color: string }) {
  return (
    <Svg
      width={30}
      height={30}
      viewBox="0 0 24 24"
      style={{ transform: [{ rotate: `${deg}deg` }] }}
    >
      <Path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill={color} />
    </Svg>
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
