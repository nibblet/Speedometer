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
import {
  ACCENTS,
  DEFAULT_ACCENT_KEY,
  accentHexForKey,
  makePalette,
  type ThemePalette,
} from '@/theme';

const STORAGE_KEY = 'appearanceMode';
const ACCENT_STORAGE_KEY = 'accentColor';

export type AppearanceMode = 'auto' | 'day' | 'night';

const ACCENT_KEYS = new Set(ACCENTS.map((a) => a.key));

type AppearanceContextValue = {
  mode: AppearanceMode;
  setMode: (m: AppearanceMode) => void;
  /** Selected accent color key (see ACCENTS in theme). */
  accent: string;
  setAccent: (key: string) => void;
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
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT_KEY);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'auto' || raw === 'day' || raw === 'night') {
        setModeState(raw);
      }
      setHydrated(true);
    });
    AsyncStorage.getItem(ACCENT_STORAGE_KEY).then((raw) => {
      if (raw && ACCENT_KEYS.has(raw)) setAccentState(raw);
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

  const setAccent = useCallback((key: string) => {
    if (!ACCENT_KEYS.has(key)) return;
    setAccentState(key);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, key).catch(() => {});
  }, []);

  const trip = useTrip();

  const resolved = useMemo(() => {
    void tick;
    void hydrated;
    return resolveDayNight(mode, trip.position);
  }, [mode, trip.position?.latitude, trip.position?.longitude, tick, hydrated]);

  const palette = useMemo(
    () => makePalette(resolved, accentHexForKey(accent)),
    [resolved, accent],
  );

  const value = useMemo(
    () => ({ mode, setMode, accent, setAccent, resolved, palette }),
    [mode, setMode, accent, setAccent, resolved, palette],
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
