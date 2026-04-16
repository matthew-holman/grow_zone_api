import 'dotenv/config';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db, postcodeZones } from '../src/db/index.js';

const PostcodeRecordSchema = z.object({
  postcode: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  placeName: z.string(),
  adminName1: z.string().nullable(),
  elevationM: z.number().int(),
});

const JSON_PATH = 'src/data/postcodes-enriched.json';
const BATCH_SIZE = 500;

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
} catch {
  console.error(
    `Error: ${JSON_PATH} not found or is not valid JSON.\n` +
    `Copy the output file from the swedish-climate-data repository first:\n` +
    `  cp ../swedish-climate-data/output/postcodes-enriched.json src/data/`
  );
  process.exit(1);
}

const parsed = z.array(PostcodeRecordSchema).safeParse(raw);
if (!parsed.success) {
  console.error('Validation failed:');
  for (const issue of parsed.error.issues) {
    console.error(` - [${issue.path.join('.')}] ${issue.message}`);
  }
  process.exit(1);
}

const records = parsed.data;

if (records.length === 0) {
  console.log('Done. Seeded 0 postcodes.');
  process.exit(0);
}

const totalBatches = Math.ceil(records.length / BATCH_SIZE);

console.log('Seeding postcodes...');

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

  await db.insert(postcodeZones)
    .values(batch.flatMap((r) => {
      return [{
        postcode: r.postcode,
        lat: String(r.lat),
        lng: String(r.lng),
        zoneId: 2,  // this should be removed from the schema, no zones anymore
        placeName: r.placeName,
        adminName1: r.adminName1,
        elevationM: r.elevationM,
      }];
    }))
    .onConflictDoUpdate({
      target: postcodeZones.postcode,
      set: {
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        zoneId: sql`excluded.zone_id`,
        placeName: sql`excluded.place_name`,
        adminName1: sql`excluded.admin_name1`,
        elevationM: sql`excluded.elevation_m`,
      },
    });
}

console.log(`Done. Seeded ${records.length} postcodes.`);
process.exit(0);
