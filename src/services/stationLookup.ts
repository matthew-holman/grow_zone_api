import {
  getPostcodeLocation,
  queryNearestStations,
} from "../repositories/stationRepository.js";
import type {
  PostcodeLocation,
  RawStationRow,
} from "../repositories/stationRepository.js";

export type { PostcodeLocation };

export interface NearestStation {
  id:               number;
  name:             string;
  lat:              number;
  lng:              number;
  elevationM:       number;
  lastFrostDoy:     number | null;
  lastFrostP90:     number | null;
  firstFrostDoy:    number | null;
  firstFrostP10:    number | null;
  growingDays:      number | null;
  gddAnnual:        number | null;
  gddP10:           number | null;
  gddP90:           number | null;
  gddCv:            number | null;
  monthlyMeanTemps: number[];
  distanceKm:       number;
}

export class PostcodeNotFoundError extends Error {
  constructor(postcode: string) {
    super(`Postcode not found: ${postcode}`);
    this.name = "PostcodeNotFoundError";
  }
}

export class InsufficientStationsError extends Error {
  constructor(postcode: string, found: number) {
    super(`Found only ${found} stations near ${postcode}, need at least 3`);
    this.name = "InsufficientStationsError";
  }
}

// pg returns PostgreSQL array columns as the raw wire string "{v1,v2,...}" in
// raw sql queries. Handle both that format and a pre-parsed string[].
function parsePgNumericArray(val: string | string[]): number[] {
  if (Array.isArray(val)) {return val.map(parseFloat);}
  // Strip surrounding braces and split on commas
  return val.slice(1, -1).split(",").map(parseFloat);
}

function parseStation(row: RawStationRow): NearestStation {
  return {
    id:               row.id,
    name:             row.name,
    lat:              row.lat,
    lng:              row.lng,
    elevationM:       row.elevation_m,
    lastFrostDoy:     row.last_frost_doy,
    lastFrostP90:     row.last_frost_p90,
    firstFrostDoy:    row.first_frost_doy,
    firstFrostP10:    row.first_frost_p10,
    growingDays:      row.growing_days,
    gddAnnual:        row.gdd_annual,
    gddP10:           row.gdd_p10,
    gddP90:           row.gdd_p90,
    gddCv:            row.gdd_cv,
    monthlyMeanTemps: parsePgNumericArray(row.monthly_mean_temps),
    distanceKm:       row.distance_km,
  };
}

export async function findNearestStations(
  postcode: string
): Promise<{ location: PostcodeLocation; stations: NearestStation[] }> {
  const location = await getPostcodeLocation(postcode);
  if (location === null) {
    throw new PostcodeNotFoundError(postcode);
  }

  const rows = await queryNearestStations(location.lat, location.lng);

  if (rows.length < 3) {
    throw new InsufficientStationsError(postcode, rows.length);
  }

  const stations = rows.map(parseStation);

  return { location, stations };
}
