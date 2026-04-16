import type { ClimateProfile, StationWeight } from "../domain/climate.js";
import type { NearestStation, PostcodeLocation } from "./stationLookup.js";

// Lapse rate constants — from SLU published climate data
const GDD_PER_100M_ELEVATION = 90;   // degree-days lost per 100m of elevation gain
const FROST_DAYS_PER_100M    = 3.5;  // frost days shifted per 100m of elevation gain
const TEMP_C_PER_100M        = 0.6;  // °C lost per 100m of elevation gain

export function computeWeights(
  location: PostcodeLocation,
  stations: NearestStation[]
): StationWeight[] {
  return stations.map(station => ({
    station,
    weight:     1 / (station.distanceKm ** 2),
    elevDeltaM: location.elevationM - station.elevationM,
  }));
}

export function applyElevationCorrection(
  value: number,
  elevDeltaM: number,
  ratePerHundredM: number
): number {
  return value - (elevDeltaM / 100) * ratePerHundredM;
}

export function weightedAverage(
  values: number[],
  weights: number[]
): number {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  return values.reduce((sum, v, i) => sum + v * (weights[i] / totalWeight), 0);
}

export function resolveMonthlyTemps(
  stationWeights: StationWeight[]
): number[] {
  return Array.from({ length: 12 }, (_, month) => {
    const correctedValues = stationWeights.map(sw =>
      applyElevationCorrection(
        sw.station.monthlyMeanTemps[month],
        sw.elevDeltaM,
        TEMP_C_PER_100M
      )
    );
    return round1dp(weightedAverage(
      correctedValues,
      stationWeights.map(sw => sw.weight)
    ));
  });
}

export function resolveClimateProfile(
  location: PostcodeLocation,
  stations: NearestStation[]
): ClimateProfile {
  const stationWeights = computeWeights(location, stations);
  const weights = stationWeights.map(sw => sw.weight);

  // Throw if a required station field is null — indicates bad seed data.
  const req = (value: number | null | undefined, field: string): number => {
    if (value == null) {throw new Error(`Station is missing required field: ${field}`);}
    return value;
  };

  const resolve = (
    getValue: (s: NearestStation) => number,
    ratePerHundredM: number
  ): number => weightedAverage(
    stationWeights.map(sw =>
      applyElevationCorrection(getValue(sw.station), sw.elevDeltaM, ratePerHundredM)
    ),
    weights
  );

  // Sign convention for frost day elevation correction:
  // Higher elevation → last frost later  (DOY increases) → negative rate
  // Higher elevation → first frost earlier (DOY decreases) → positive rate
  //
  // applyElevationCorrection computes: value - (elevDelta / 100) * rate
  //   negative rate → subtracting a negative → addition   → later date  ✓ (last frost)
  //   positive rate → subtracting a positive → subtraction → earlier date ✓ (first frost)
  //
  // Using FROST_DAYS_PER_100M (positive) for lastFrost would move it earlier — wrong.
  // Using -FROST_DAYS_PER_100M for firstFrost would move it later — wrong.
  const lastFrostDoy  = Math.round(resolve(s => req(s.lastFrostDoy,  'lastFrostDoy'),  -FROST_DAYS_PER_100M));
  const lastFrostP90  = Math.round(resolve(s => req(s.lastFrostP90,  'lastFrostP90'),  -FROST_DAYS_PER_100M));
  const firstFrostDoy = Math.round(resolve(s => req(s.firstFrostDoy, 'firstFrostDoy'),  FROST_DAYS_PER_100M));
  const firstFrostP10 = Math.round(resolve(s => req(s.firstFrostP10, 'firstFrostP10'),  FROST_DAYS_PER_100M));

  return {
    postcode:         location.postcode,
    lastFrostDoy,
    lastFrostP90,
    firstFrostDoy,
    firstFrostP10,
    growingDays:      firstFrostDoy - lastFrostDoy,
    gddAnnual:        round1dp(resolve(s => req(s.gddAnnual, 'gddAnnual'), GDD_PER_100M_ELEVATION)),
    gddP10:           round1dp(resolve(s => req(s.gddP10,    'gddP10'),    GDD_PER_100M_ELEVATION)),
    gddP90:           round1dp(resolve(s => req(s.gddP90,    'gddP90'),    GDD_PER_100M_ELEVATION)),
    gddCv:            round2dp(weightedAverage(
                        stationWeights.map(sw => req(sw.station.gddCv, 'gddCv')),
                        weights
                      )),
    monthlyMeanTemps: resolveMonthlyTemps(stationWeights),
  };
}

function round1dp(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2dp(value: number): number {
  return Math.round(value * 100) / 100;
}
