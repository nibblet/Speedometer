import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Rajdhani_400Regular,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from '@/navigation/RootNavigator';
import { TripProvider } from '@/context/TripContext';
import { AppearanceProvider, useAppearance } from '@/context/AppearanceContext';
import { initDb } from '@/db';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });

  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    try {
      initDb();
      setDbReady(true);
    } catch (e) {
      console.warn('DB init failed', e);
      setDbReady(true);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forgeOrange} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <TripProvider>
        <AppearanceProvider>
          <ThemedStatusBar />
          <RootNavigator />
        </AppearanceProvider>
      </TripProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { resolved } = useAppearance();
  return <StatusBar style={resolved === 'day' ? 'dark' : 'light'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.forgeBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
