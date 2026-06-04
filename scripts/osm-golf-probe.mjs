#!/usr/bin/env node
/**
 * OpenStreetMap golf-data coverage probe.
 *
 * Decides whether free OSM/Overpass data is good enough to build golf-course
 * features on, BEFORE committing to a paid data provider (iGolf, golfapi.io, …).
 *
 * For each course name you pass, it finds the `leisure=golf_course` polygon and
 * counts the golf features inside it, then prints a quick coverage grade.
 *
 * Usage (needs Node 18+ for global fetch; no npm install required):
 *   node scripts/osm-golf-probe.mjs "Valhalla Golf" "Pebble Beach Golf" "Bethpage"
 *
 * Tip: quote each name; the match is case-insensitive substring on the course's
 * OSM `name` tag. Run it from a network that allows api.overpass-api.de.
 */

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Pass one or more course-name patterns, e.g.:');
  console.error('  node scripts/osm-golf-probe.mjs "Valhalla Golf" "Pebble Beach Golf"');
  process.exit(1);
}

/** Build an Overpass QL query: find matching course areas, gather golf features inside. */
function query(pattern) {
  const p = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[out:json][timeout:120];
( way["leisure"="golf_course"]["name"~"${p}",i];
  rel["leisure"="golf_course"]["name"~"${p}",i]; )->.c;
.c map_to_area->.a;
( nwr(area.a)["golf"]; )->.f;
.c out tags;
.f out tags;`;
}

async function probe(pattern) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Public Overpass instances reject requests with no User-Agent (HTTP 406).
      'User-Agent': 'cartpath-osm-golf-probe/1.0 (coverage check)',
      Accept: 'application/json',
    },
    body: 'data=' + encodeURIComponent(query(pattern)),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  const els = json.elements ?? [];

  const courses = els.filter((e) => e.tags?.leisure === 'golf_course');
  const courseNames = [...new Set(courses.map((c) => c.tags?.name).filter(Boolean))];

  const byType = {};
  let greenPolys = 0;
  for (const e of els) {
    const g = e.tags?.golf;
    if (!g) continue;
    byType[g] = (byType[g] ?? 0) + 1;
    // A "green" with geometry (way/relation, not a single node) gives us a
    // centroid we can measure distance to — the core rangefinder primitive.
    if (g === 'green' && (e.type === 'way' || e.type === 'relation')) greenPolys += 1;
  }

  const holes = byType.hole ?? 0;
  const greens = byType.green ?? 0;
  let grade;
  if (greenPolys >= 17) grade = 'GOOD — full green polygons, distance-to-green is viable';
  else if (greens >= 9 || holes >= 9) grade = 'PARTIAL — some data, expect gaps';
  else if (courses.length > 0) grade = 'OUTLINE ONLY — course exists, ~no hole/green detail';
  else grade = 'NOT FOUND — no matching golf_course in OSM';

  return { pattern, courseNames, byType, greenPolys, grade };
}

const FEATURES = ['hole', 'green', 'tee', 'fairway', 'bunker', 'rough', 'water_hazard', 'lateral_water_hazard', 'path', 'driving_range'];

for (const pattern of names) {
  try {
    const r = await probe(pattern);
    console.log(`\n===== "${pattern}" =====`);
    console.log(`matched: ${r.courseNames.length ? r.courseNames.join(' | ') : '(none)'}`);
    const cells = FEATURES
      .filter((f) => r.byType[f])
      .map((f) => `${f}=${r.byType[f]}`);
    const other = Object.keys(r.byType).filter((k) => !FEATURES.includes(k)).map((k) => `${k}=${r.byType[k]}`);
    console.log(`features: ${[...cells, ...other].join('  ') || '(none)'}`);
    console.log(`green polygons (usable for distance): ${r.greenPolys}`);
    console.log(`grade: ${r.grade}`);
  } catch (e) {
    console.log(`\n===== "${pattern}" =====`);
    console.log(`ERROR: ${e.message}`);
  }
  // Be polite to the public Overpass instance.
  await new Promise((r) => setTimeout(r, 1500));
}
console.log('');
