import { eq, sql  } from "drizzle-orm";
import { db, postcodeZones } from "../db/index.js";

export interface PostcodeLocation {
  postcode:   string;
  lat:        number;
  lng:        number;
  elevationM: number;
}

export interface RawStationRow {
  id:                 number;
  name:               string;
  lat:                number;
  lng:                number;
  elevation_m:        number;
  last_frost_doy:     number | null;
  last_frost_p90:     number | null;
  first_frost_doy:    number | null;
  first_frost_p10:    number | null;
  growing_days:       number | null;
  gdd_annual:         number | null;
  gdd_p10:            number | null;
  gdd_p90:            number | null;
  gdd_cv:             number | null;
  monthly_mean_temps: string | string[];
  distance_km:        number;
}

export async function getPostcodeLocation(
  postcode: string
): Promise<PostcodeLocation | null> {
  const rows = await db
    .select({
      postcode:   postcodeZones.postcode,
      lat:        postcodeZones.lat,
      lng:        postcodeZones.lng,
      elevationM: postcodeZones.elevationM,
    })
    .from(postcodeZones)
    .where(eq(postcodeZones.postcode, postcode))
    .limit(1);

  if (rows.length === 0) {return null;}

  const row = rows[0];
  return {
    postcode:   row.postcode,
    lat:        parseFloat(row.lat),
    lng:        parseFloat(row.lng),
    elevationM: row.elevationM,
  };
}

export async function queryNearestStations(
  lat: number,
  lng: number
): Promise<RawStationRow[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      name,
      lat::float,
      lng::float,
      elevation_m::float,
      last_frost_doy,
      last_frost_p90,
      first_frost_doy,
      first_frost_p10,
      growing_days,
      gdd_annual::float,
      gdd_p10::float,
      gdd_p90::float,
      gdd_cv::float,
      monthly_mean_temps,
      (
        6371 * acos(
          LEAST(1.0,
            cos(radians(${lat})) * cos(radians(lat::float)) *
            cos(radians(lng::float) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(lat::float))
          )
        )
      ) AS distance_km
    FROM weather_stations
    WHERE last_frost_doy IS NOT NULL
    ORDER BY distance_km
    LIMIT 3
  `);

  return result.rows as unknown as RawStationRow[];
}
