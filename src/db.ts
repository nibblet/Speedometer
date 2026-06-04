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
  /** ms epoch the place was created; used for stable ordering. May be null on legacy rows. */
  createdAt: number | null;
};

export type NewCheckpoint = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
};

const DEFAULT_CHECKPOINT_RADIUS_M = 20;

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
      radius_meters REAL NOT NULL DEFAULT ${DEFAULT_CHECKPOINT_RADIUS_M},
      created_at INTEGER
    );
  `);
  ensureCheckpointColumns();
}

/** Add columns introduced after the original schema, for installs created on older builds. */
function ensureCheckpointColumns(): void {
  const database = getDb();
  // ALTER throws if the column already exists; that's the "already migrated" case.
  try {
    database.execSync(`ALTER TABLE checkpoints ADD COLUMN created_at INTEGER`);
  } catch {
    /* column already present */
  }
}

let placeKeySeq = 0;

/** Unique, non-semantic key for a user-created place (the `key` column stays UNIQUE NOT NULL). */
function nextPlaceKey(): string {
  placeKeySeq += 1;
  return `place_${Date.now().toString(36)}_${placeKeySeq.toString(36)}`;
}

/** Create a user place at the given coordinate. Returns the inserted row. */
export function createCheckpoint(input: NewCheckpoint): Checkpoint {
  const database = getDb();
  const createdAt = Date.now();
  const radius = input.radiusMeters ?? DEFAULT_CHECKPOINT_RADIUS_M;
  const key = nextPlaceKey();
  const result = database.runSync(
    `INSERT INTO checkpoints (key, name, latitude, longitude, radius_meters, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [key, input.name, input.latitude, input.longitude, radius, createdAt],
  );
  return {
    id: result.lastInsertRowId,
    key,
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: radius,
    createdAt,
  };
}

export function renameCheckpoint(id: number, name: string): void {
  const database = getDb();
  database.runSync(`UPDATE checkpoints SET name = ? WHERE id = ?`, [name, id]);
}

export function deleteCheckpoint(id: number): void {
  const database = getDb();
  database.runSync(`DELETE FROM checkpoints WHERE id = ?`, [id]);
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
    created_at: number | null;
  }>(
    `SELECT id, key, name, latitude, longitude, radius_meters, created_at
       FROM checkpoints
       ORDER BY created_at IS NULL, created_at ASC, name COLLATE NOCASE ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    radiusMeters: r.radius_meters,
    createdAt: r.created_at,
  }));
}

export function updateCheckpointCoordinates(id: number, latitude: number, longitude: number): void {
  const database = getDb();
  database.runSync(`UPDATE checkpoints SET latitude = ?, longitude = ? WHERE id = ?`, [
    latitude,
    longitude,
    id,
  ]);
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
