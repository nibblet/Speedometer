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
import {
  saveTrip,
  listCheckpoints,
  insertCheckpointEvent,
  type Checkpoint,
} from '@/db';

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
  /** Dev-only: synthetic speed/heading for testing UI without driving */
  devSimulateMotion: boolean;
  setDevSimulateMotion: (on: boolean) => void;
  /** Saved checkpoint places (persisted); enter/exit recorded to SQLite while driving. */
  checkpoints: Checkpoint[];
  refreshCheckpoints: () => void;
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

/** True bearing in 0..360 — fixes JS `%` leaving negative remainders. */
function normalizeHeadingDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

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

/** Enter at full radius; exit only after GPS leaves an expanded ring (reduces jitter). */
function checkpointHysteresis(
  wasInside: boolean,
  distanceMeters: number,
  radiusMeters: number,
): boolean {
  const exitStretch = 1.35;
  if (!wasInside) return distanceMeters <= radiusMeters;
  return distanceMeters <= radiusMeters * exitStretch;
}

function evaluateCheckpointTransitions(
  pos: LatLng,
  checkpoints: Checkpoint[],
  insideIds: Set<number>,
): void {
  for (const cp of checkpoints) {
    const d = haversineMeters(pos, {
      latitude: cp.latitude,
      longitude: cp.longitude,
    });
    const was = insideIds.has(cp.id);
    const next = checkpointHysteresis(was, d, cp.radiusMeters);
    if (next === was) continue;
    if (next) insideIds.add(cp.id);
    else insideIds.delete(cp.id);
    try {
      insertCheckpointEvent(cp.id, next ? 'enter' : 'exit');
    } catch (e) {
      console.warn('checkpoint event failed', e);
    }
  }
}

function loadCheckpointsSafe(): Checkpoint[] {
  try {
    return listCheckpoints();
  } catch {
    return [];
  }
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TripState>(initialState);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(loadCheckpointsSafe);
  const [devSimulateMotion, setDevSimulateMotion] = useState(false);
  const simTRef = useRef(0);
  const simFrameRef = useRef<number | null>(null);
  const devSimulateMotionRef = useRef(false);
  const speedSamplesRef = useRef<number[]>([]);
  const stateRef = useRef<TripState>(initialState);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkpointsRef = useRef<Checkpoint[]>(checkpoints);
  const insideCheckpointIdsRef = useRef<Set<number>>(new Set());

  // Keep a ref of latest state so AppState listener can read it without stale closure.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    devSimulateMotionRef.current = __DEV__ && devSimulateMotion;
  }, [devSimulateMotion]);

  useEffect(() => {
    checkpointsRef.current = checkpoints;
  }, [checkpoints]);

  const refreshCheckpoints = useCallback(() => {
    setCheckpoints(loadCheckpointsSafe());
  }, []);

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
          const newPos: LatLng = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          if (devSimulateMotionRef.current) {
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
                position: newPos,
                distanceMiles: nextDistance,
                breadcrumb: nextBreadcrumb,
              };
            });
            return;
          }

          const rawMs = loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed : 0;
          const rawMph = rawMs * MS_TO_MPH;

          const samples = speedSamplesRef.current;
          samples.push(rawMph);
          if (samples.length > SMOOTH_WINDOW) samples.shift();
          const smoothed =
            samples.reduce((acc, v) => acc + v, 0) / samples.length;
          const speedMph = smoothed < 0.5 ? 0 : smoothed;

          const courseDeg = loc.coords.heading;
          const useGpsHeading =
            speedMph > 1.5 &&
            courseDeg != null &&
            Number.isFinite(courseDeg);

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
              headingDeg: useGpsHeading
                ? normalizeHeadingDeg(courseDeg as number)
                : prev.headingDeg,
              position: newPos,
              distanceMiles: nextDistance,
              breadcrumb: nextBreadcrumb,
            };
          });

          evaluateCheckpointTransitions(
            newPos,
            checkpointsRef.current,
            insideCheckpointIdsRef.current,
          );
        },
      );
      subRef.current = sub;

      // Compass heading from device sensors (used when stopped)
      const headingSub = await Location.watchHeadingAsync((h) => {
        if (cancelled) return;
        if (devSimulateMotionRef.current) return;
        // Only use compass heading when essentially stationary
        setState((prev) => {
          if (prev.speedMph > 1.5) return prev;
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (raw < 0 || !Number.isFinite(raw)) return prev;
          return { ...prev, headingDeg: normalizeHeadingDeg(raw) };
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

  // Synthetic motion for simulator / desk testing (__DEV__ only)
  useEffect(() => {
    if (!__DEV__ || !devSimulateMotion) {
      if (simFrameRef.current != null) {
        cancelAnimationFrame(simFrameRef.current);
        simFrameRef.current = null;
      }
      return;
    }
    let last = Date.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simTRef.current += dt;
      const t = simTRef.current;
      const simSpeed = Math.max(0, 11.5 + 12 * Math.sin(t * 0.85));
      const simHeading = normalizeHeadingDeg((t * 38) % 360);
      setState((prev) => ({
        ...prev,
        speedMph: simSpeed,
        headingDeg: simHeading,
        maxMph: Math.max(prev.maxMph, simSpeed),
      }));
      simFrameRef.current = requestAnimationFrame(loop);
    };
    simFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (simFrameRef.current != null) cancelAnimationFrame(simFrameRef.current);
      simFrameRef.current = null;
    };
  }, [devSimulateMotion]);

  const value = useMemo<TripContextValue>(
    () => ({
      ...state,
      resetTrip,
      requestPermission,
      devSimulateMotion: __DEV__ ? devSimulateMotion : false,
      setDevSimulateMotion: __DEV__
        ? setDevSimulateMotion
        : () => {
            /* no-op in production */
          },
      checkpoints,
      refreshCheckpoints,
    }),
    [state, resetTrip, requestPermission, devSimulateMotion, checkpoints, refreshCheckpoints],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}
