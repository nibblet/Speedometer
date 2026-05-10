import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SunCalc from 'suncalc';
import type { LatLng } from '@/context/TripContext';
import { useTrip } from '@/context/TripContext';
import { palettes, type ThemePalette } from '@/theme';

const STORAGE_KEY = 'appearanceMode';

export type AppearanceMode = 'auto' | 'day' | 'night';

type AppearanceContextValue = {
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => void;
  /** Resolved palette after auto (sun) logic. */
  resolved: 'day' | 'night';
  palette: ThemePalette;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function resolveDayNight(mode: AppearanceMode, position: LatLng | null): 'day' | 'night' {
  if (mode === 'day') return 'day';
  if (mode === 'night') return 'night';
  if (
    position == null ||
    !Number.isFinite(position.latitude) ||
    !Number.isFinite(position.longitude)
  ) {
    return 'night';
  }
  const now = new Date();
  const times = SunCalc.getTimes(now, position.latitude, position.longitude);
  const t = now.getTime();
  const rise = times.sunrise.getTime();
  const set = times.sunset.getTime();
  if (!Number.isFinite(rise) || !Number.isFinite(set)) return 'night';
  return t >= rise && t <= set ? 'day' : 'night';
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>('auto');
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'auto' || raw === 'day' || raw === 'night') {
        setModeState(raw);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const setMode = useCallback((m: AppearanceMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const trip = useTrip();

  const resolved = useMemo(() => {
    void tick;
    void hydrated;
    return resolveDayNight(mode, trip.position);
  }, [mode, trip.position?.latitude, trip.position?.longitude, tick, hydrated]);

  const palette = resolved === 'day' ? palettes.day : palettes.night;

  const value = useMemo(
    () => ({ mode, setMode, resolved, palette }),
    [mode, setMode, resolved, palette],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used inside AppearanceProvider');
  return ctx;
}
