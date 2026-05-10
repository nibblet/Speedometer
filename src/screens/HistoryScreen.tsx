import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, spacing } from '@/theme';
import { listTrips, deleteTrip, deleteAllTrips, Trip } from '@/db';

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default function HistoryScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    try {
      setTrips(listTrips());
    } catch (e) {
      console.warn('Failed to load trips', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  };

  const onDelete = (trip: Trip) => {
    Alert.alert('Delete trip?', `${formatDate(trip.startedAt)} — ${trip.distanceMiles.toFixed(2)} mi`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTrip(trip.id);
          load();
        },
      },
    ]);
  };

  const onClearAll = () => {
    Alert.alert('Clear all history?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          deleteAllTrips();
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>HISTORY</Text>
        {trips.length > 0 && (
          <Pressable onPress={onClearAll} hitSlop={12}>
            <Text style={styles.clearLabel}>CLEAR</Text>
          </Pressable>
        )}
      </View>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>NO TRIPS YET</Text>
          <Text style={styles.emptyText}>
            Trips are saved automatically when you close or background the app.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id.toString()}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.forgeOrange}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => onDelete(item)}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.slateElevated },
              ]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowDate}>{formatDate(item.startedAt)}</Text>
                <Text style={styles.rowTime}>{formatTime(item.startedAt)}</Text>
              </View>
              <View style={styles.rowStats}>
                <RowStat label="DIST" value={`${item.distanceMiles.toFixed(2)} mi`} />
                <RowStat label="TIME" value={formatDuration(item.durationSeconds)} />
                <RowStat label="MAX" value={`${Math.round(item.maxMph)} mph`} />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowStat}>
      <Text style={styles.rowStatLabel}>{label}</Text>
      <Text style={styles.rowStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.forgeBlack },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 6,
  },
  clearLabel: {
    color: colors.forgeOrange,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 3,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: {
    color: colors.forgeOrange,
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  row: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.slate,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slateBorder,
  },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  rowDate: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
  },
  rowTime: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  rowStats: { flexDirection: 'row', justifyContent: 'space-between' },
  rowStat: { flex: 1 },
  rowStatLabel: {
    color: colors.dim,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  rowStatValue: {
    color: colors.forgeOrange,
    fontFamily: fonts.display,
    fontSize: 16,
  },
});
