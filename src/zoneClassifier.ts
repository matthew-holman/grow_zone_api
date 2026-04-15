export type Zone = 1 | 2 | 3 | 4 | 5;

// Sweden bounding box (approximate)
const SWEDEN_LAT_MIN = 55.0;
const SWEDEN_LAT_MAX = 69.5;
const SWEDEN_LNG_MIN = 10.0;
const SWEDEN_LNG_MAX = 25.0;

// Zone boundaries by latitude (south to north)
const ZONE_BOUNDARIES: [Zone, number][] = [
  [1, 57.0],
  [2, 58.5],
  [3, 60.0],
  [4, 62.5],
];

export function classifyZone(lat: number, lng: number): Zone | null {
  if (
    lat < SWEDEN_LAT_MIN ||
    lat > SWEDEN_LAT_MAX ||
    lng < SWEDEN_LNG_MIN ||
    lng > SWEDEN_LNG_MAX
  ) {
    return null;
  }

  for (const [zone, upperBound] of ZONE_BOUNDARIES) {
    if (lat < upperBound) {return zone;}
  }

  return 5;
}
