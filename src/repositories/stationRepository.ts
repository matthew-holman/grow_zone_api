import { eq, sql  } from "drizzle-orm";
import { db, postcodes } from "../db/index.js";

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
  gdd_base5:          number | null;
  gdd_base5_p10:      number | null;
  gdd_base5_cv:       number | null;
  gdd_base7:          number | null;
  gdd_base7_p10:      number | null;
  gdd_base7_cv:       number | null;
  gdd_base10:         number | null;
  gdd_base10_p10:     number | null;
  gdd_base10_cv:      number | null;
  gdd_base15:         number | null;
  gdd_base15_p10:     number | null;
  gdd_base15_cv:      number | null;
  monthly_mean_temps: string | string[];
  distance_km:        number;
}

export async function getPostcodeLocation(
  postcode: string
): Promise<PostcodeLocation | null> {
  const rows = await db
    .select({
      postcode:   postcodes.postcode,
      lat:        postcodes.lat,
      lng:        postcodes.lng,
      elevationM: postcodes.elevationM,
    })
    .from(postcodes)
    .where(eq(postcodes.postcode, postcode))
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
      gdd_base5::float,
      gdd_base5_p10::float,
      gdd_base5_cv::float,
      gdd_base7::float,
      gdd_base7_p10::float,
      gdd_base7_cv::float,
      gdd_base10::float,
      gdd_base10_p10::float,
      gdd_base10_cv::float,
      gdd_base15::float,
      gdd_base15_p10::float,
      gdd_base15_cv::float,
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
