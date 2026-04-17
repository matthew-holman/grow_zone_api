import 'dotenv/config';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db, weatherStations } from '../src/db/index.js';

const WeatherStationSchema = z.object({
  id:                 z.number().int(),
  name:               z.string().min(1),
  lat:                z.number(),
  lng:                z.number(),
  elevationM:         z.number(),
  last_frost_doy:     z.number().int().nullable(),
  last_frost_p90:     z.number().int().nullable(),
  first_frost_doy:    z.number().int().nullable(),
  first_frost_p10:    z.number().int().nullable(),
  growing_days:       z.number().int().nullable(),
  gdd_base5:          z.number().nullable(),
  gdd_base5_p10:      z.number().nullable(),
  gdd_base5_cv:       z.number().nullable(),
  gdd_base7:          z.number().nullable(),
  gdd_base7_p10:      z.number().nullable(),
  gdd_base7_cv:       z.number().nullable(),
  gdd_base10:         z.number().nullable(),
  gdd_base10_p10:     z.number().nullable(),
  gdd_base10_cv:      z.number().nullable(),
  gdd_base15:         z.number().nullable(),
  gdd_base15_p10:     z.number().nullable(),
  gdd_base15_cv:      z.number().nullable(),
  monthly_mean_temps: z.array(z.number().nullable()).length(12),
});

const JSON_PATH = 'src/data/weather-stations.json';
const BATCH_SIZE = 100;

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
} catch {
  console.error(
    `Error: ${JSON_PATH} not found or is not valid JSON.\n` +
    `Copy the output file from the swedish-climate-data repository first:\n` +
    `  cp ../swedish-climate-data/output/weather-stations.json src/data/`
  );
  process.exit(1);
}

const parsed = z.array(WeatherStationSchema).safeParse(raw);
if (!parsed.success) {
  console.error('Validation failed:');
  for (const issue of parsed.error.issues) {
    const recordId = issue.path[0];
    console.error(` - record[${recordId}].${issue.path.slice(1).join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const records = parsed.data;

if (records.length === 0) {
  console.log('weather-stations.json is empty. Nothing to seed.');
  console.log('Copy the output file from the swedish-climate-data repository first.');
  process.exit(0);
}

const totalBatches = Math.ceil(records.length / BATCH_SIZE);

console.log('Seeding weather stations...');

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

  const mapped = batch.map((r) => ({
    id:               r.id,
    name:             r.name,
    lat:              String(r.lat),
    lng:              String(r.lng),
    elevationM:       String(r.elevationM),
    lastFrostDoy:     r.last_frost_doy,
    lastFrostP90:     r.last_frost_p90,
    firstFrostDoy:    r.first_frost_doy,
    firstFrostP10:    r.first_frost_p10,
    growingDays:      r.growing_days,
    gddBase5:         r.gdd_base5      !== null ? String(r.gdd_base5)      : null,
    gddBase5P10:      r.gdd_base5_p10  !== null ? String(r.gdd_base5_p10)  : null,
    gddBase5Cv:       r.gdd_base5_cv   !== null ? String(r.gdd_base5_cv)   : null,
    gddBase7:         r.gdd_base7      !== null ? String(r.gdd_base7)      : null,
    gddBase7P10:      r.gdd_base7_p10  !== null ? String(r.gdd_base7_p10)  : null,
    gddBase7Cv:       r.gdd_base7_cv   !== null ? String(r.gdd_base7_cv)   : null,
    gddBase10:        r.gdd_base10     !== null ? String(r.gdd_base10)     : null,
    gddBase10P10:     r.gdd_base10_p10 !== null ? String(r.gdd_base10_p10) : null,
    gddBase10Cv:      r.gdd_base10_cv  !== null ? String(r.gdd_base10_cv)  : null,
    gddBase15:        r.gdd_base15     !== null ? String(r.gdd_base15)     : null,
    gddBase15P10:     r.gdd_base15_p10 !== null ? String(r.gdd_base15_p10) : null,
    gddBase15Cv:      r.gdd_base15_cv  !== null ? String(r.gdd_base15_cv)  : null,
    monthlyMeanTemps: r.monthly_mean_temps.map((v) => v !== null ? String(v) : null),
  }));

  await db.insert(weatherStations)
    .values(mapped)
    .onConflictDoUpdate({
      target: weatherStations.id,
      set: {
        name:             sql`excluded.name`,
        lat:              sql`excluded.lat`,
        lng:              sql`excluded.lng`,
        elevationM:       sql`excluded.elevation_m`,
        lastFrostDoy:     sql`excluded.last_frost_doy`,
        lastFrostP90:     sql`excluded.last_frost_p90`,
        firstFrostDoy:    sql`excluded.first_frost_doy`,
        firstFrostP10:    sql`excluded.first_frost_p10`,
        growingDays:      sql`excluded.growing_days`,
        gddBase5:         sql`excluded.gdd_base5`,
        gddBase5P10:      sql`excluded.gdd_base5_p10`,
        gddBase5Cv:       sql`excluded.gdd_base5_cv`,
        gddBase7:         sql`excluded.gdd_base7`,
        gddBase7P10:      sql`excluded.gdd_base7_p10`,
        gddBase7Cv:       sql`excluded.gdd_base7_cv`,
        gddBase10:        sql`excluded.gdd_base10`,
        gddBase10P10:     sql`excluded.gdd_base10_p10`,
        gddBase10Cv:      sql`excluded.gdd_base10_cv`,
        gddBase15:        sql`excluded.gdd_base15`,
        gddBase15P10:     sql`excluded.gdd_base15_p10`,
        gddBase15Cv:      sql`excluded.gdd_base15_cv`,
        monthlyMeanTemps: sql`excluded.monthly_mean_temps`,
      },
    });
}

console.log(`Done. Seeded ${records.length} weather stations.`);
process.exit(0);
