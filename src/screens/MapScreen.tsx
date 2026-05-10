import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, fonts, spacing } from '@/theme';
import { useTrip } from '@/context/TripContext';

// Apple Maps dark style is automatic on iOS when userInterfaceStyle is "dark".
// On Android we'd pass a customMapStyle JSON; left empty here for simplicity.

export default function MapScreen() {
  useKeepAwake();
  const trip = useTrip();
  const mapRef = useRef<MapView | null>(null);

  // Re-center to current position when it changes meaningfully
  useEffect(() => {
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
  }, [trip.position?.latitude, trip.position?.longitude]);

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
        userInterfaceStyle="dark"
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
        {trip.breadcrumb.length > 1 && (
          <Polyline
            coordinates={trip.breadcrumb}
            strokeColor={colors.forgeOrange}
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
          <Stat label="SPEED" value={`${Math.round(trip.speedMph)} mph`} />
          <Stat label="TRIP" value={`${trip.distanceMiles.toFixed(2)} mi`} />
          <Stat label="MAX" value={`${Math.round(trip.maxMph)} mph`} />
        </View>
      </SafeAreaView>
    </View>
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
  container: { flex: 1, backgroundColor: colors.forgeBlack },
  safe: { flex: 1, backgroundColor: colors.forgeBlack },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: {
    color: colors.forgeOrange,
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  emptyText: { color: colors.dim, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  overlayCard: {
    margin: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slateBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: {
    color: colors.dim,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 2,
  },
  statValue: { color: colors.white, fontFamily: fonts.display, fontSize: 16 },
  dotOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.forgeOrangeGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.forgeOrange,
    borderWidth: 2,
    borderColor: colors.forgeBlack,
  },
});
