import type { InferSelectModel} from "drizzle-orm";
import {eq} from "drizzle-orm";
import {db, postcodeZones} from "../db/index.js";
import type {Zone} from "../zoneClassifier.js"

type PostcodeZoneRow = InferSelectModel<typeof postcodeZones>

export async function getZoneByPostcode(postcode: string): Promise<Zone | null> {
  const rows = await db
    .select()
    .from(postcodeZones)
    .where(eq(postcodeZones.postcode, postcode))
    .limit(1);

  if (rows.length === 0) {return null;}
  return rows[0].zoneId as Zone;
}

export async function getAllPostcodes(): Promise<PostcodeZoneRow[]>{
  return db
      .select()
      .from(postcodeZones);
}

export async function savePostcodeZone(
  postcode: string,
  lat: number,
  lng: number,
  zone: Zone,
  placeName: string,
  adminName1: string | null
): Promise<void> {
  await db.insert(postcodeZones).values({
    postcode,
    lat: String(lat),
    lng: String(lng),
    zoneId: zone,
    placeName,
    adminName1,
  });
}
