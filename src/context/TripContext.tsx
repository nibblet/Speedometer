import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { saveTrip } from '@/db';

const MS_TO_MPH = 2.23694;
const SMOOTH_WINDOW = 4; // moving-average window for speed
const MIN_MOVE_METERS = 1.5; // ignore GPS jitter below this when adding distance/breadcrumb
const MIN_DISTANCE_FOR_SAVE_MILES = 0.02; // skip trips < ~100ft

export type LatLng = { latitude: number; longitude: number };

type TripState = {
  hasPermission: boolean;
  speedMph: number;
  maxMph: number;
  headingDeg: number; // 0-360, true bearing
  distanceMiles: number;
  position: LatLng | null;
  breadcrumb: LatLng[];
  startedAt: number;
  durationSeconds: number;
};

type TripContextValue = TripState & {
  resetTrip: () => void;
  requestPermission: () => Promise<boolean>;
};

const initialState: TripState = {
  hasPermission: false,
  speedMph: 0,
  maxMph: 0,
  headingDeg: 0,
  distanceMiles: 0,
  position: null,
  breadcrumb: [],
  startedAt: Date.now(),
  durationSeconds: 0,
};

const TripContext = createContext<TripContextValue | null>(null);

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

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TripState>(initialState);
  const speedSamplesRef = useRef<number[]>([]);
  const stateRef = useRef<TripState>(initialState);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a ref of latest state so AppState listener can read it without stale closure.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const resetTrip = useCallback(() => {
    speedSamplesRef.current = [];
    setState((prev) => ({
      ...initialState,
      hasPermission: prev.hasPermission,
      startedAt: Date.now(),
    }));
  }, []);

  const persistAndReset = useCallback(() => {
    const s = stateRef.current;
    if (s.distanceMiles >= MIN_DISTANCE_FOR_SAVE_MILES) {
      const endedAt = Date.now();
      try {
        saveTrip({
          startedAt: s.startedAt,
          endedAt,
          distanceMiles: s.distanceMiles,
          maxMph: s.maxMph,
          durationSeconds: Math.round((endedAt - s.startedAt) / 1000),
          routeJson: JSON.stringify(s.breadcrumb),
        });
      } catch (e) {
        console.warn('Failed to save trip', e);
      }
    }
    resetTrip();
  }, [resetTrip]);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setState((p) => ({ ...p, hasPermission: granted }));
    return granted;
  }, []);

  // Start GPS subscriptions when permission granted
  useEffect(() => {
    if (!state.hasPermission) return;

    let cancelled = false;

    (async () => {
      // Position + speed
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (loc) => {
          if (cancelled) return;
          const rawMs = loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed : 0;
          const rawMph = rawMs * MS_TO_MPH;

          // Smooth speed
          const samples = speedSamplesRef.current;
          samples.push(rawMph);
          if (samples.length > SMOOTH_WINDOW) samples.shift();
          const smoothed =
            samples.reduce((acc, v) => acc + v, 0) / samples.length;
          const speedMph = smoothed < 0.5 ? 0 : smoothed; // dead-zone

          const newPos: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          // Heading from GPS course when moving; else keep prior
          const courseDeg = loc.coords.heading;
          const useGpsHeading = speedMph > 1.5 && courseDeg != null && courseDeg >= 0;

          setState((prev) => {
            let nextDistance = prev.distanceMiles;
            let nextBreadcrumb = prev.breadcrumb;
            if (prev.position) {
              const dM = haversineMeters(prev.position, newPos);
              if (dM >= MIN_MOVE_METERS) {
                nextDistance = prev.distanceMiles + dM / 1609.344;
                nextBreadcrumb = [...prev.breadcrumb, newPos];
              }
            } else {
              nextBreadcrumb = [newPos];
            }

            return {
              ...prev,
              speedMph,
              maxMph: Math.max(prev.maxMph, speedMph),
              headingDeg: useGpsHeading ? (courseDeg as number) : prev.headingDeg,
              position: newPos,
              distanceMiles: nextDistance,
              breadcrumb: nextBreadcrumb,
            };
          });
        },
      );
      subRef.current = sub;

      // Compass heading from device sensors (used when stopped)
      const headingSub = await Location.watchHeadingAsync((h) => {
        if (cancelled) return;
        // Only use compass heading when essentially stationary
        setState((prev) => {
          if (prev.speedMph > 1.5) return prev;
          const trueHeading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (trueHeading < 0) return prev;
          return { ...prev, headingDeg: trueHeading };
        });
      });
      headingSubRef.current = headingSub;
    })();

    // Tick duration every second
    tickRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        durationSeconds: Math.round((Date.now() - prev.startedAt) / 1000),
      }));
    }, 1000);

    return () => {
      cancelled = true;
      subRef.current?.remove();
      headingSubRef.current?.remove();
      subRef.current = null;
      headingSubRef.current = null;
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.hasPermission]);

  // Save trip when app backgrounds
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        persistAndReset();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [persistAndReset]);

  const value = useMemo<TripContextValue>(
    () => ({ ...state, resetTrip, requestPermission }),
    [state, resetTrip, requestPermission],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}
