import * as SQLite from 'expo-sqlite';

export type Trip = {
  id: number;
  startedAt: number; // ms epoch
  endedAt: number;
  distanceMiles: number;
  maxMph: number;
  durationSeconds: number;
  routeJson: string | null;
};

export type NewTrip = Omit<Trip, 'id'>;

export type Checkpoint = {
  id: number;
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type CheckpointEventRow = {
  id: number;
  checkpointId: number;
  kind: 'enter' | 'exit';
  at: number;
};

const DEFAULT_CHECKPOINT_RADIUS_M = 20;
const LEGACY_CHECKPOINT_RADII = [85, 40];

/** Placeholder origin used by earlier builds — pins seeded here are "unplaced". */
const LEGACY_SEED_ORIGIN = { latitude: 33.502, longitude: -117.063 };

const DEFAULT_PLACES: {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
}[] = [
  { key: 'home', name: 'Home', latitude: 38.32412971676258, longitude: -85.56328839802686 },
  { key: 'kids_pool', name: 'Pool', latitude: 38.33197678197266, longitude: -85.57328078544803 },
  { key: 'big_park', name: 'Big Park', latitude: 38.331669395493265, longitude: -85.57135393835345 },
  { key: 'amphitheatre', name: 'Amphitheatre', latitude: 38.32931018931509, longitude: -85.56877609942313 },
];

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('cartspeedo.db');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  database.execSync(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      distance_miles REAL NOT NULL,
      max_mph REAL NOT NULL,
      duration_seconds INTEGER NOT NULL,
      route_json TEXT
    );
    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL DEFAULT ${DEFAULT_CHECKPOINT_RADIUS_M}
    );
    CREATE TABLE IF NOT EXISTS checkpoint_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkpoint_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('enter','exit')),
      at INTEGER NOT NULL,
      FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoint_events_at ON checkpoint_events(at DESC);
  `);
  migrateLegacyCheckpointKeys();
  ensureDefaultCheckpoints();
  relocateLegacyDefaultCheckpoints();
  shrinkLegacyCheckpointRadius();
}

/** Shrink default geofence rings to the current default (skips custom radii). */
function shrinkLegacyCheckpointRadius(): void {
  const database = getDb();
  for (const legacy of LEGACY_CHECKPOINT_RADII) {
    database.runSync(`UPDATE checkpoints SET radius_meters = ? WHERE radius_meters = ?`, [
      DEFAULT_CHECKPOINT_RADIUS_M,
      legacy,
    ]);
  }
}

/** Rename placeholder keys from earlier builds without wiping saved coordinates. */
function migrateLegacyCheckpointKeys(): void {
  const database = getDb();
  const legacy: [string, string, string][] = [
    ['sunset', 'home', 'Home'],
    ['pool', 'kids_pool', 'Kids Pool'],
    ['pickleball', 'big_park', 'Big Park'],
  ];
  // Earlier builds named the home checkpoint "Barn"; rename to "Home".
  database.runSync(`UPDATE checkpoints SET name = 'Home' WHERE key = 'home' AND name = 'Barn'`);
  for (const [fromKey, toKey, name] of legacy) {
    database.runSync(`UPDATE checkpoints SET key = ?, name = ? WHERE key = ?`, [
      toKey,
      name,
      fromKey,
    ]);
  }
}

/** Insert missing default places at their real coordinates; preserve existing. */
function ensureDefaultCheckpoints(): void {
  const database = getDb();
  for (const place of DEFAULT_PLACES) {
    const existing = database.getFirstSync<{ key: string }>(
      'SELECT key FROM checkpoints WHERE key = ?',
      [place.key],
    );
    if (existing != null) continue;
    database.runSync(
      `INSERT INTO checkpoints (key, name, latitude, longitude, radius_meters)
       VALUES (?, ?, ?, ?, ?)`,
      [place.key, place.name, place.latitude, place.longitude, DEFAULT_CHECKPOINT_RADIUS_M],
    );
  }
}

/**
 * Earlier builds seeded every place at a placeholder origin, so all pins stacked
 * on one far-away point. Move any checkpoint still sitting on that origin to its
 * real coordinate. Idempotent: only rows still at the legacy origin are touched,
 * so user-placed pins are never overwritten.
 */
function relocateLegacyDefaultCheckpoints(): void {
  const database = getDb();
  for (const place of DEFAULT_PLACES) {
    database.runSync(
      `UPDATE checkpoints SET latitude = ?, longitude = ?
         WHERE key = ?
           AND ABS(latitude - ?) < 1e-4
           AND ABS(longitude - ?) < 1e-4`,
      [
        place.latitude,
        place.longitude,
        place.key,
        LEGACY_SEED_ORIGIN.latitude,
        LEGACY_SEED_ORIGIN.longitude,
      ],
    );
  }
}

export function listCheckpoints(): Checkpoint[] {
  const database = getDb();
  const rows = database.getAllSync<{
    id: number;
    key: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
  }>(
    `SELECT id, key, name, latitude, longitude, radius_meters
       FROM checkpoints
       ORDER BY name COLLATE NOCASE ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    radiusMeters: r.radius_meters,
  }));
}

export function updateCheckpointCoordinates(key: string, latitude: number, longitude: number): void {
  const database = getDb();
  database.runSync(`UPDATE checkpoints SET latitude = ?, longitude = ? WHERE key = ?`, [
    latitude,
    longitude,
    key,
  ]);
}

export function insertCheckpointEvent(checkpointId: number, kind: 'enter' | 'exit'): void {
  const database = getDb();
  database.runSync(
    `INSERT INTO checkpoint_events (checkpoint_id, kind, at) VALUES (?, ?, ?)`,
    [checkpointId, kind, Date.now()],
  );
}

export function listCheckpointEvents(limit = 200): CheckpointEventRow[] {
  const database = getDb();
  const rows = database.getAllSync<{
    id: number;
    checkpoint_id: number;
    kind: 'enter' | 'exit';
    at: number;
  }>(
    `SELECT id, checkpoint_id, kind, at
       FROM checkpoint_events
       ORDER BY at DESC
       LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    checkpointId: r.checkpoint_id,
    kind: r.kind,
    at: r.at,
  }));
}

export function saveTrip(trip: NewTrip): number {
  const database = getDb();
  const result = database.runSync(
    `INSERT INTO trips
       (started_at, ended_at, distance_miles, max_mph, duration_seconds, route_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      trip.startedAt,
      trip.endedAt,
      trip.distanceMiles,
      trip.maxMph,
      trip.durationSeconds,
      trip.routeJson,
    ],
  );
  return result.lastInsertRowId;
}

export function listTrips(): Trip[] {
  const database = getDb();
  const rows = database.getAllSync<{
    id: number;
    started_at: number;
    ended_at: number;
    distance_miles: number;
    max_mph: number;
    duration_seconds: number;
    route_json: string | null;
  }>(
    `SELECT id, started_at, ended_at, distance_miles, max_mph, duration_seconds, route_json
       FROM trips
       ORDER BY started_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    distanceMiles: r.distance_miles,
    maxMph: r.max_mph,
    durationSeconds: r.duration_seconds,
    routeJson: r.route_json,
  }));
}

export function deleteTrip(id: number): void {
  const database = getDb();
  database.runSync(`DELETE FROM trips WHERE id = ?`, [id]);
}

export function deleteAllTrips(): void {
  const database = getDb();
  database.runSync(`DELETE FROM trips`);
}
