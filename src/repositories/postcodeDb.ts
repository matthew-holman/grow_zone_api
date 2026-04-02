import AdmZip from "adm-zip";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = path.join(__dirname, "data", "postcodes", "SE.zip");

export interface PostcodeLocation {
  lat: number;
  lng: number;
  placeName: string;
  adminName1: string | null;
}

// Zod schema for a single parsed row before it enters the map
const postcodeRowSchema = z.object({
  postcode: z.string().regex(/^\d{5}$/),
  lat: z.number(),
  lng: z.number(),
  placeName: z.string().min(1),
  adminName1: z.string().nullable(),
});

function loadPostcodeDb(): Map<string, PostcodeLocation> {
  let zip: AdmZip;
  try {
    zip = new AdmZip(ZIP_PATH);
  } catch {
    throw new Error(`Failed to open postcode database at ${ZIP_PATH}`);
  }

  const entry = zip.getEntry("SE.txt");
  if (!entry) {
    throw new Error("SE.txt not found inside SE.zip");
  }

  const lines = entry.getData().toString("utf-8").split("\n");
  const db = new Map<string, PostcodeLocation>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split("\t");
    if (cols.length < 11) continue;

    // GeoNames SE.txt columns:
    // 0: country_code  1: postal_code  2: place_name
    // 3: admin_name1   4: admin_code1  5: admin_name2
    // 6: admin_code2   7: admin_name3  8: admin_code3
    // 9: latitude     10: longitude   11: accuracy
    const rawPostcode = cols[1].replace(/\s/g, "");
    const lat = parseFloat(cols[9]);
    const lng = parseFloat(cols[10]);
    const placeName = cols[2].trim();
    const adminName1 = cols[3].trim() || null;

    const parsed = postcodeRowSchema.safeParse({ postcode: rawPostcode, lat, lng, placeName, adminName1 });
    if (!parsed.success) continue;

    db.set(parsed.data.postcode, {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      placeName: parsed.data.placeName,
      adminName1: parsed.data.adminName1,
    });
  }

  if (db.size === 0) {
    throw new Error("Postcode database loaded but contains no entries — check SE.zip");
  }

  console.log(`Postcode database loaded: ${db.size} entries`);
  return db;
}

const postcodeDb = loadPostcodeDb();

export function lookupPostcode(postcode: string): PostcodeLocation | null {
  return postcodeDb.get(postcode) ?? null;
}

export function postcodeDbSize(): number {
  return postcodeDb.size;
}
