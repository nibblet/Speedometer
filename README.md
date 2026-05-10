# Cart Speedo — forVEX Golf Cart Speedometer

A personal iPhone speedometer for your golf cart, built with React Native + Expo.
forVEX styling: Forge Black background, Forge Orange accents, Rajdhani display type.

## Features

- **Analog / Digital toggle** — switch between a 0–25 mph dial with rotating compass rose and a big digital MPH readout
- **Map tab** — live position dot with a forge-orange breadcrumb of the current trip
- **History tab** — past trips with date, distance, duration, max speed (long-press a row to delete)
- **Auto trip-saving** — when you close or background the app, the current trip is saved to history and the trip resets when you reopen
- **Screen stays awake** — `expo-keep-awake` is active on the Speedometer and Map tabs
- **Smoothed GPS speed** — 4-sample moving average + dead-zone below 0.5 mph to suppress jitter at idle

## Setup

```bash
# 1. Install Node 20+ and the Expo CLI is bundled with the project (npx expo …)

# 2. From the project root:
npm install

# 3. Start the dev server
npx expo start
```

### Run on your iPhone (development)

1. Install **Expo Go** from the App Store
2. Make sure your phone and computer are on the same Wi-Fi network
3. With `npx expo start` running, scan the QR code from your iPhone's Camera app
4. Grant location permission when prompted

> Note: `react-native-maps` works in Expo Go on iOS for development. If you hit
> any limitations, switch to a development build (next section).

### Build a permanent install on your iPhone (no dev server needed)

You'll need a free Apple ID; this avoids the App Store and TestFlight entirely.

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log in (Expo account)
eas login

# 3. Configure
eas build:configure

# 4. Build a development client tied to your Apple ID
eas build --profile development --platform ios

# 5. Once finished, EAS gives you a URL — open it on your iPhone to install
```

Free Apple IDs install builds that expire every 7 days. If you have a paid
Apple Developer account ($99/yr), you can use `--profile preview` and get a
year-long install.

## File Layout

```
golf-cart-speedo/
├── App.tsx                          # Root: fonts, DB, providers, navigation
├── app.json                         # Expo config (portrait, dark, location perm)
├── package.json
├── tsconfig.json
├── babel.config.js
└── src/
    ├── theme.ts                     # forVEX color + type tokens
    ├── db.ts                        # SQLite trip history
    ├── context/
    │   └── TripContext.tsx          # Live GPS state, breadcrumb, auto-save on bg
    ├── components/
    │   ├── AnalogDial.tsx           # 0–25 mph dial (react-native-svg)
    │   ├── DigitalReadout.tsx       # Big MPH numerals
    │   └── CompassRose.tsx          # Rotating compass with N/E/S/W
    ├── screens/
    │   ├── SpeedometerScreen.tsx    # Toggle + dial/digital + stats
    │   ├── MapScreen.tsx            # Live position + breadcrumb
    │   └── HistoryScreen.tsx        # Past trips list
    └── navigation/
        └── RootNavigator.tsx        # Bottom tabs with custom tab bar
```

## Design Tokens (src/theme.ts)

```ts
forgeBlack:  #0A0A0A   // background
slate:       #161616   // elevated surfaces / tab bar
slateBorder: #2A2A2A   // hairlines
forgeOrange: #FF6A1A   // primary accent — needle, active states
white:       #FFFFFF   // primary numerals
```

If you have exact forVEX brand HEX values, swap them in `src/theme.ts` —
every component reads from there.

## Notable Implementation Choices

- **`SPEED_MAX_MPH = 25`** in `src/theme.ts` — change here to recalibrate the dial
- **GPS smoothing**: 4-sample moving average; speeds < 0.5 mph snap to 0 to keep the needle still at idle
- **Heading source**: GPS course-over-ground when moving > 1.5 mph, magnetometer (`watchHeadingAsync`) when stationary
- **Trip lifecycle**: a trip starts on app launch, ends on `AppState` `background`/`inactive`, and is saved to SQLite if it covered ≥ 0.02 mi (~100 ft)
- **Map**: native Apple Maps in dark mode (Android uses default light style — add a custom JSON if you ever run there)

## Personalization Ideas

- **forVEX wordmark on splash** — drop `splash.png` and `icon.png` into `src/assets/` (currently referenced but not provided)
- **HUD mode** — mirror-flipped display for windshield reflection (the reference app had this; trivial to add as a third toggle option)
- **Top-speed celebration** — pulse the dial frame in forge orange when you set a new max
- **Trip route playback** — tap a history row to push a detail screen with the saved `routeJson` rendered as a polyline
