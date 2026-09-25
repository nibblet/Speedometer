// Keep react-native-ble-plx's native code out of public/App Store builds.
//
// The JS side is already lazy-required behind FEATURES.battery, but autolinking
// would still compile the library into every binary. A binary that links
// CoreBluetooth without NSBluetoothAlwaysUsageDescription is rejected on upload
// (ITMS-90683), and on Android the library's manifest would merge Bluetooth
// permissions into the store build. Same flag as app.config.js / src/config.ts.

const batteryEnabled = process.env.EXPO_PUBLIC_ENABLE_BATTERY === '1';

module.exports = {
  dependencies: batteryEnabled
    ? {}
    : {
        'react-native-ble-plx': {
          platforms: { ios: null, android: null },
        },
      },
};
