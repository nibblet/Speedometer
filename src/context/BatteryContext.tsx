import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import {
  RUNLEADER_SERVICE_UUID,
  RUNLEADER_NOTIFY_UUID,
  macKeyFromManufacturerData,
  decodeNotification,
  bytesFromBase64,
  type BatteryReading,
} from '@/ble/runleader';

/**
 * Connects to the Runleader RL-BI025-BT battery monitor over BLE and exposes
 * the live pack voltage / state-of-charge. Read-only: we scan, connect, and
 * subscribe to the FFE2 notify characteristic — the monitor streams realtime
 * frames on its own, so no handshake or polling is needed.
 *
 * Requires a custom dev/EAS build (react-native-ble-plx native module); the
 * provider degrades gracefully to `available: false` when the module is
 * missing (e.g. Expo Go) so the rest of the app keeps working.
 */

type BatteryState = {
  /** True when the BLE native module is present (dev/EAS build). */
  available: boolean;
  scanning: boolean;
  connected: boolean;
  voltageV: number | null;
  percent: number | null;
  /** ms epoch of the last successful reading, or null. */
  lastUpdated: number | null;
  error: string | null;
};

type BatteryContextValue = BatteryState & {
  /** Begin scanning/connecting. Safe to call repeatedly. */
  start: () => void;
  /** Stop scanning and disconnect. */
  stop: () => void;
  /** Dev-only synthetic reading for UI testing without hardware. */
  devSimulate: boolean;
  setDevSimulate: (on: boolean) => void;
};

const DEVICE_NAME_PREFIX = 'AiLink';

const initialState: BatteryState = {
  available: false,
  scanning: false,
  connected: false,
  voltageV: null,
  percent: null,
  lastUpdated: null,
  error: null,
};

const BatteryContext = createContext<BatteryContextValue | null>(null);

/** Lazy-load the native module so the app survives its absence (Expo Go). */
function loadBleManager(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require('react-native-ble-plx');
    return new BleManager();
  } catch {
    return null;
  }
}

async function ensureAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PermissionsAndroid } = require('react-native');
    const perms = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ].filter(Boolean);
    const granted = await PermissionsAndroid.requestMultiple(perms);
    return Object.values(granted).every(
      (v) => v === PermissionsAndroid.RESULTS.GRANTED,
    );
  } catch {
    return true;
  }
}

export function BatteryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BatteryState>(initialState);
  const [devSimulate, setDevSimulate] = useState(false);

  const managerRef = useRef<any | null>(null);
  const macKeyRef = useRef<number[] | null>(null);
  const deviceRef = useRef<any | null>(null);
  const wantConnectedRef = useRef(false);
  const monitorSubRef = useRef<any | null>(null);
  const disconnectSubRef = useRef<any | null>(null);

  const patch = useCallback((p: Partial<BatteryState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  // Initialize the manager once.
  useEffect(() => {
    const mgr = loadBleManager();
    managerRef.current = mgr;
    patch({ available: mgr != null });
    return () => {
      try {
        monitorSubRef.current?.remove();
        disconnectSubRef.current?.remove();
        mgr?.destroy();
      } catch {
        /* noop */
      }
    };
  }, [patch]);

  const handleNotification = useCallback(
    (valueB64: string | null | undefined) => {
      if (!valueB64 || !macKeyRef.current) return;
      const reading: BatteryReading | null = decodeNotification(
        bytesFromBase64(valueB64),
        macKeyRef.current,
      );
      if (reading) {
        patch({
          voltageV: reading.voltageV,
          percent: reading.percent,
          lastUpdated: Date.now(),
          error: null,
        });
      }
    },
    [patch],
  );

  const subscribe = useCallback(
    (device: any) => {
      monitorSubRef.current?.remove();
      monitorSubRef.current = device.monitorCharacteristicForService(
        RUNLEADER_SERVICE_UUID,
        RUNLEADER_NOTIFY_UUID,
        (err: any, characteristic: any) => {
          if (err) return; // disconnect handler deals with teardown
          handleNotification(characteristic?.value);
        },
      );
    },
    [handleNotification],
  );

  const connect = useCallback(
    async (scanned: any) => {
      const mgr = managerRef.current;
      if (!mgr) return;
      try {
        mgr.stopDeviceScan();
        patch({ scanning: false });

        // Derive the XOR key (device MAC) from the advertisement, falling back
        // to the Android platform MAC reversed.
        let macKey = macKeyFromManufacturerData(
          scanned.manufacturerData
            ? bytesFromBase64(scanned.manufacturerData)
            : null,
        );
        if (!macKey && Platform.OS === 'android' && scanned.id?.includes(':')) {
          macKey = scanned.id
            .split(':')
            .map((h: string) => parseInt(h, 16))
            .reverse();
        }
        macKeyRef.current = macKey;

        const device = await scanned.connect();
        await device.discoverAllServicesAndCharacteristics();
        deviceRef.current = device;

        disconnectSubRef.current?.remove();
        disconnectSubRef.current = device.onDisconnected(() => {
          patch({ connected: false });
          deviceRef.current = null;
          if (wantConnectedRef.current) scan(); // auto-reconnect
        });

        subscribe(device);
        patch({ connected: true, error: null });
      } catch (e: any) {
        patch({ connected: false, error: e?.message ?? 'connect failed' });
        if (wantConnectedRef.current) setTimeout(() => scan(), 2000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, subscribe],
  );

  const scan = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    patch({ scanning: true, error: null });
    mgr.startDeviceScan(
      [RUNLEADER_SERVICE_UUID],
      { allowDuplicates: false },
      (err: any, device: any) => {
        if (err) {
          patch({ scanning: false, error: err?.message ?? 'scan failed' });
          return;
        }
        if (!device) return;
        const name: string = device.name ?? device.localName ?? '';
        if (name.startsWith(DEVICE_NAME_PREFIX) || device.serviceUUIDs) {
          connect(device);
        }
      },
    );
  }, [patch, connect]);

  const start = useCallback(async () => {
    if (!managerRef.current) return;
    wantConnectedRef.current = true;
    const ok = await ensureAndroidPermissions();
    if (!ok) {
      patch({ error: 'Bluetooth permission denied' });
      return;
    }
    scan();
  }, [patch, scan]);

  const stop = useCallback(() => {
    wantConnectedRef.current = false;
    const mgr = managerRef.current;
    try {
      mgr?.stopDeviceScan();
      monitorSubRef.current?.remove();
      disconnectSubRef.current?.remove();
      deviceRef.current?.cancelConnection();
    } catch {
      /* noop */
    }
    deviceRef.current = null;
    patch({ scanning: false, connected: false });
  }, [patch]);

  // Dev simulator: gentle sag/recovery around a 48V pack.
  useEffect(() => {
    if (!__DEV__ || !devSimulate) return;
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const v = 50.5 + 2.5 * Math.sin(t / 6);
      const pct = Math.round(((v - 44) / (52 - 44)) * 100);
      patch({
        voltageV: Math.round(v * 100) / 100,
        percent: Math.max(0, Math.min(100, pct)),
        lastUpdated: Date.now(),
        connected: true,
      });
    }, 1000);
    return () => clearInterval(id);
  }, [devSimulate, patch]);

  const value = useMemo<BatteryContextValue>(
    () => ({
      ...state,
      start,
      stop,
      devSimulate: __DEV__ ? devSimulate : false,
      setDevSimulate: __DEV__ ? setDevSimulate : () => {},
    }),
    [state, start, stop, devSimulate],
  );

  return (
    <BatteryContext.Provider value={value}>{children}</BatteryContext.Provider>
  );
}

export function useBattery(): BatteryContextValue {
  const ctx = useContext(BatteryContext);
  if (!ctx) throw new Error('useBattery must be used inside BatteryProvider');
  return ctx;
}
