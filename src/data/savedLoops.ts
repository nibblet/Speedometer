export type LatLng = { latitude: number; longitude: number };

export type SavedLoop = {
  id: string;
  name: string;
  /** Ordered points along the route (repeat first point at end for a closed loop). */
  coordinates: LatLng[];
};

/**
 * Anchor saved loops to your neighborhood. Replace with real coordinates (e.g. clubhouse
 * or home); sample shapes below are small circuits ~few hundred meters across at mid-latitudes.
 */
export const SAVED_LOOP_ORIGIN: LatLng = {
  latitude: 33.502,
  longitude: -117.063,
};

function o(dLat: number, dLng: number): LatLng {
  return {
    latitude: SAVED_LOOP_ORIGIN.latitude + dLat,
    longitude: SAVED_LOOP_ORIGIN.longitude + dLng,
  };
}

/**
 * Edit `coordinates` from GPX or map pins; first point seeds each checkpoint’s center on first DB init.
 * Checkpoint positions persist in SQLite after that — update via app logic or run UPDATE if you move home.
 */
export const SAVED_LOOPS: SavedLoop[] = [
  {
    id: 'home',
    name: 'Back to the Barn',
    coordinates: [
      o(0, 0),
      o(0.0022, 0.0011),
      o(0.0035, -0.0004),
      o(0.002, -0.002),
      o(0, -0.0012),
      o(0, 0),
    ],
  },
  {
    id: 'kids_pool',
    name: 'Pool Patrol',
    coordinates: [
      o(0, 0),
      o(0.0015, 0.0028),
      o(0.004, 0.002),
      o(0.0045, -0.0005),
      o(0.002, -0.0025),
      o(0, 0),
    ],
  },
  {
    id: 'big_park',
    name: 'Sunset Lap',
    coordinates: [
      o(0, 0),
      o(-0.002, 0.0015),
      o(-0.0035, 0.004),
      o(0, 0.0048),
      o(0.0025, 0.002),
      o(0, 0),
    ],
  },
];
