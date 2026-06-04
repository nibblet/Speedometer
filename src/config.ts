/**
 * Build-time feature flags.
 *
 * `battery` gates the Runleader RL-BI025-BT Bluetooth battery monitor — a
 * personal hardware integration that isn't relevant to public/App Store users.
 * It's OFF by default; enable it for a personal build with:
 *
 *   npm run ios:personal
 *   npm run start:personal          (dev client + Metro)
 *   npm run build:ios:personal      (EAS profile `personal` in eas.json)
 *
 * The same env var drives the native Bluetooth permissions/plugin in
 * app.config.js, so flipping it keeps the JS UI and the native config in sync.
 */
export const FEATURES = {
  battery: process.env.EXPO_PUBLIC_ENABLE_BATTERY === '1',
} as const;
