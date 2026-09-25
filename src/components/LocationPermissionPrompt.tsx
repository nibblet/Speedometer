import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { fonts, radius, spacing, type ThemePalette } from '@/theme';
import { useAppearance } from '@/context/AppearanceContext';
import { useTrip } from '@/context/TripContext';

/**
 * Shown wherever the app needs GPS but doesn't have it. Once the user has denied
 * access, iOS won't show the system prompt again, so the only way forward is the
 * app's page in Settings — offer that instead of a button that silently does nothing.
 */
export function LocationPermissionPrompt() {
  const { palette } = useAppearance();
  const { permissionStatus, requestPermission, openLocationSettings } = useTrip();
  const styles = useMemo(() => createStyles(palette), [palette]);

  if (permissionStatus === 'unknown') {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={palette.forgeOrange} />
        <Text style={styles.text}>Checking location access…</Text>
      </View>
    );
  }

  const blocked = permissionStatus === 'blocked';

  return (
    <View style={styles.root}>
      <Text style={styles.title}>LOCATION IS OFF</Text>
      <Text style={styles.text}>
        CARTpath uses your location to show speed, heading, trip distance, and your spot on
        the map. It stays on this phone and is never shared.
      </Text>
      {blocked && (
        <Text style={styles.hint}>
          Turn it on in Settings → CARTpath → Location → While Using the App.
        </Text>
      )}
      <Pressable
        style={styles.btn}
        onPress={blocked ? openLocationSettings : requestPermission}
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>{blocked ? 'OPEN SETTINGS' : 'ALLOW LOCATION'}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    title: {
      color: palette.forgeOrange,
      fontFamily: fonts.display,
      fontSize: 16,
      letterSpacing: 4,
    },
    text: {
      color: palette.dim,
      fontFamily: fonts.body,
      fontSize: 14,
      textAlign: 'center',
    },
    hint: {
      color: palette.white,
      fontFamily: fonts.body,
      fontSize: 13,
      textAlign: 'center',
    },
    btn: {
      marginTop: spacing.sm,
      backgroundColor: palette.forgeOrange,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: radius.pill,
    },
    btnText: {
      color: palette.ink,
      fontFamily: fonts.display,
      fontSize: 14,
      letterSpacing: 2,
    },
  });
}
