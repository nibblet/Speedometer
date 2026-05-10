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
  `);
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
