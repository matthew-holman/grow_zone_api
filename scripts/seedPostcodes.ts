/**
 * Seed script: parse src/data/postcodes/SE.zip and populate the postcode_zones table.
 *
 * Data source: GeoNames (https://www.geonames.org/export/zip/)
 * Licence: Creative Commons Attribution 4.0 — attribution to geonames.org required.
 *
 * Usage:
 *   npm run db:seed-postcodes
 *
 * Safe to re-run: existing rows are skipped via ON CONFLICT DO NOTHING.
 * To fully refresh, truncate the postcode_zones table first.
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { db, postcodeZones } from "../src/db/index.js";
import { classifyZone } from "../src/zoneClassifier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = path.join(__dirname, "../src/data/postcodes/SE.zip");
const BATCH_SIZE = 500;

interface PostcodeRow {
  postcode: string;
  lat: number;
  lng: number;
  placeName: string;
  adminName1: string | null;
}

function parseZip(zipPath: string): PostcodeRow[] {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry("SE.txt");
  if (!entry) throw new Error("SE.txt not found inside SE.zip");

  const rows: PostcodeRow[] = [];

  for (const line of entry.getData().toString("utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split("\t");
    if (cols.length < 11) continue;

    // GeoNames SE.txt columns:
    // 0: country_code  1: postal_code  2: place_name
    // 3: admin_name1   4: admin_code1  5: admin_name2
    // 6: admin_code2   7: admin_name3  8: admin_code3
    // 9: latitude     10: longitude   11: accuracy
    const postcode = cols[1].replace(/\s/g, "");
    if (!/^\d{5}$/.test(postcode)) continue;

    const lat = parseFloat(cols[9]);
    const lng = parseFloat(cols[10]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const placeName = cols[2].trim();
    if (!placeName) continue;

    const adminName1 = cols[3].trim() || null;

    rows.push({ postcode, lat, lng, placeName, adminName1 });
  }

  return rows;
}

async function seed(): Promise<void> {
  console.log("Parsing SE.zip...");
  const rows = parseZip(ZIP_PATH);
  console.log(`Parsed ${rows.length} postcodes`);

  let inserted = 0;
  let skipped = 0;
  let noZone = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const values = batch.flatMap(({ postcode, lat, lng, placeName, adminName1 }) => {
      const zone = classifyZone(lat, lng);
      if (!zone) {
        noZone++;
        return [];
      }
      return [{
        postcode,
        lat: String(lat),
        lng: String(lng),
        zoneId: zone,
        placeName,
        adminName1,
      }];
    });

    if (values.length === 0) continue;

    const result = await db
      .insert(postcodeZones)
      .values(values)
      .onConflictDoNothing()
      .returning({ postcode: postcodeZones.postcode });

    inserted += result.length;
    skipped += values.length - result.length;

    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log(`\n\nDone.`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped} (already existed)`);
  console.log(`  No zone  : ${noZone} (outside Swedish growing zones)`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
