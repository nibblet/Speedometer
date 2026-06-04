// Dynamic Expo config. Starts from app.json and, only when the personal-build
// flag is set (EXPO_PUBLIC_ENABLE_BATTERY=1), adds the Bluetooth permissions and
// the react-native-ble-plx plugin needed by the Runleader battery monitor.
// Public/App Store builds leave the flag unset and request no Bluetooth at all.

const BLE_REASON =
  "Used to read your cart's battery voltage and charge level from the Runleader battery monitor.";

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_ENABLE_BATTERY !== '1') return config;

  config.ios = config.ios ?? {};
  config.ios.infoPlist = {
    ...config.ios.infoPlist,
    NSBluetoothAlwaysUsageDescription: BLE_REASON,
    NSBluetoothPeripheralUsageDescription: BLE_REASON,
  };

  config.android = config.android ?? {};
  config.android.permissions = [
    ...(config.android.permissions ?? []),
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.BLUETOOTH_CONNECT',
  ];

  config.plugins = [
    ...(config.plugins ?? []),
    [
      'react-native-ble-plx',
      { isBackgroundEnabled: false, modes: ['central'], bluetoothAlwaysPermission: BLE_REASON },
    ],
  ];

  return config;
};
