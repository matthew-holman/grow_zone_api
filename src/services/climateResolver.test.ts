import { describe, it, expect } from "vitest";
import {
  computeWeights,
  applyElevationCorrection,
  weightedAverage,
  resolveClimateProfile,
} from "./climateResolver.js";
import type { NearestStation, PostcodeLocation } from "./stationLookup.js";

// A minimal valid NearestStation used as a base for spread overrides
const baseStation: NearestStation = {
  id:               1,
  name:             "Base Station",
  lat:              59.35,
  lng:              18.05,
  elevationM:       20,
  lastFrostDoy:     127,
  lastFrostP90:     143,
  firstFrostDoy:    282,
  firstFrostP10:    268,
  growingDays:      155,
  gddBase5:         1799,
  gddBase5P10:      1620,
  gddBase5Cv:       0.10,
  gddBase7:         1374,
  gddBase7P10:      1238,
  gddBase7Cv:       0.11,
  gddBase10:        868,
  gddBase10P10:     712,
  gddBase10Cv:      0.14,
  gddBase15:        258,
  gddBase15P10:     159,
  gddBase15Cv:      0.27,
  monthlyMeanTemps: [-1.2, -0.7, 2.1, 6.1, 11.5, 16.3, 18.3, 17.1, 13.3, 7.9, 4.0, 0.9],
  distanceKm:       10,
};

describe("computeWeights", () => {
  it("assigns higher weight to closer stations", () => {
    const location: PostcodeLocation = { postcode: "11346", lat: 59.34, lng: 18.06, elevationM: 28 };
    const stations: NearestStation[] = [
      { ...baseStation, distanceKm: 10, elevationM: 20 },
      { ...baseStation, distanceKm: 30, elevationM: 40 },
      { ...baseStation, distanceKm: 50, elevationM: 60 },
    ];
    const weights = computeWeights(location, stations);
    expect(weights[0].weight).toBeGreaterThan(weights[1].weight);
    expect(weights[1].weight).toBeGreaterThan(weights[2].weight);
  });

  it("computes elevDeltaM as location minus station elevation", () => {
    const location: PostcodeLocation = { postcode: "11346", lat: 59.34, lng: 18.06, elevationM: 100 };
    const stations: NearestStation[] = [{ ...baseStation, distanceKm: 10, elevationM: 60 }];
    const weights = computeWeights(location, stations);
    expect(weights[0].elevDeltaM).toBe(40);
  });

  it("produces negative elevDeltaM when postcode is lower than station", () => {
    const location: PostcodeLocation = { postcode: "11346", lat: 59.34, lng: 18.06, elevationM: 20 };
    const stations: NearestStation[] = [{ ...baseStation, distanceKm: 10, elevationM: 80 }];
    const weights = computeWeights(location, stations);
    expect(weights[0].elevDeltaM).toBe(-60);
  });
});

describe("applyElevationCorrection", () => {
  it("reduces value when postcode is higher than station", () => {
    // postcode 200m above station, GDD rate 90/100m → subtract 180
    expect(applyElevationCorrection(1000, 200, 90)).toBe(820);
  });

  it("increases value when postcode is lower than station", () => {
    // postcode 100m below station, GDD rate 90/100m → add 90
    expect(applyElevationCorrection(1000, -100, 90)).toBe(1090);
  });

  it("returns unchanged value when elevations are equal", () => {
    expect(applyElevationCorrection(1000, 0, 90)).toBe(1000);
  });
});

describe("weightedAverage", () => {
  it("returns the single value when only one station", () => {
    expect(weightedAverage([1500], [1])).toBe(1500);
  });

  it("weights closer station more heavily", () => {
    // weight 4 vs weight 1 — result should be much closer to first value
    const result = weightedAverage([2000, 1000], [4, 1]);
    expect(result).toBe(1800);
  });

  it("returns midpoint for equal weights", () => {
    expect(weightedAverage([1000, 2000], [1, 1])).toBe(1500);
  });
});

describe("resolveClimateProfile — reference validation", () => {

  // Falsterbo A — our southern anchor station
  const falsterbo: NearestStation = {
    id: 52240, name: "Falsterbo A",
    lat: 55.3837, lng: 12.8166, elevationM: 2,
    lastFrostDoy: 92,  lastFrostP90: 108,
    firstFrostDoy: 327, firstFrostP10: 312,
    growingDays: 235,
    gddBase5: 2105, gddBase5P10: 1901, gddBase5Cv: 0.07,
    gddBase7: 1607, gddBase7P10: 1428, gddBase7Cv: 0.09,
    gddBase10: 1018, gddBase10P10: 831, gddBase10Cv: 0.12,
    gddBase15: 301, gddBase15P10: 174, gddBase15Cv: 0.30,
    monthlyMeanTemps: [2.4, 2.1, 3.8, 7.3, 12.1, 16.3, 18.1, 18.1, 15.5, 11.2, 7.3, 4.5],
    distanceKm: 0,
  };

  // Stockholm Bromma — central reference station
  const bromma: NearestStation = {
    id: 97200, name: "Stockholm-Bromma Flygplats",
    lat: 59.3537, lng: 17.9513, elevationM: 14,
    lastFrostDoy: 127, lastFrostP90: 143,
    firstFrostDoy: 282, firstFrostP10: 268,
    growingDays: 155,
    gddBase5: 1799, gddBase5P10: 1620, gddBase5Cv: 0.10,
    gddBase7: 1374, gddBase7P10: 1238, gddBase7Cv: 0.11,
    gddBase10: 868, gddBase10P10: 712, gddBase10Cv: 0.14,
    gddBase15: 258, gddBase15P10: 159, gddBase15Cv: 0.27,
    monthlyMeanTemps: [-1.2, -0.7, 2.1, 6.1, 11.5, 16.3, 18.3, 17.1, 13.3, 7.9, 4.0, 0.9],
    distanceKm: 0,
  };

  // Kiruna Flygplats — northern reference station
  const kiruna: NearestStation = {
    id: 180940, name: "Kiruna Flygplats",
    lat: 67.827, lng: 20.3387, elevationM: 459,
    lastFrostDoy: 152, lastFrostP90: 168,
    firstFrostDoy: 253, firstFrostP10: 241,
    growingDays: 101,
    gddBase5: 816, gddBase5P10: 601, gddBase5Cv: 0.16,
    gddBase7: 614, gddBase7P10: 399, gddBase7Cv: 0.19,
    gddBase10: 311, gddBase10P10: 96, gddBase10Cv: 0.28,
    gddBase15: 15, gddBase15P10: 0, gddBase15Cv: 0.0,
    monthlyMeanTemps: [-12.0, -9.7, -6.2, -1.3, 4.9, 10.8, 14.0, 11.6, 7.1, -0.3, -5.8, -8.8],
    distanceKm: 0,
  };

  it("resolves profile for a postcode near Falsterbo with identical nearby stations", () => {
    // When 3 identical stations surround a postcode at the same elevation,
    // the resolved profile should match the station values exactly
    const location: PostcodeLocation = {
      postcode: "23942", lat: 55.38, lng: 12.82, elevationM: 2,
    };
    const stations: NearestStation[] = [
      { ...falsterbo, distanceKm: 5 },
      { ...falsterbo, distanceKm: 8 },
      { ...falsterbo, distanceKm: 12 },
    ];
    const profile = resolveClimateProfile(location, stations);
    expect(profile.postcode).toBe("23942");
    expect(profile.lastFrostDoy).toBe(92);
    expect(profile.firstFrostDoy).toBe(327);
    expect(profile.growingDays).toBe(235);
    expect(profile.gddBase5).toBe(2105);
  });

  it("resolves profile between Falsterbo and Bromma with correct gradient", () => {
    // A postcode midway between the two stations should get intermediate values
    const location: PostcodeLocation = {
      postcode: "30260", lat: 57.4, lng: 15.4, elevationM: 8,
    };
    const stations: NearestStation[] = [
      { ...falsterbo, distanceKm: 20 },
      { ...bromma,    distanceKm: 22 },
      { ...bromma,    distanceKm: 35 },
    ];
    const profile = resolveClimateProfile(location, stations);
    // GDD should be between Falsterbo and Bromma values
    expect(profile.gddBase5).toBeGreaterThan(1799);
    expect(profile.gddBase5).toBeLessThan(2105);
    // Last frost should be between the two
    expect(profile.lastFrostDoy).toBeGreaterThan(92);
    expect(profile.lastFrostDoy).toBeLessThan(127);
  });

  it("applies elevation correction — higher postcode gets lower GDD", () => {
    // Postcode at 400m, stations at 14m — should lose ~347 GDD (3.86 × 90)
    const location: PostcodeLocation = {
      postcode: "83000", lat: 59.35, lng: 17.95, elevationM: 400,
    };
    const stations: NearestStation[] = [
      { ...bromma, distanceKm: 10, elevationM: 14 },
      { ...bromma, distanceKm: 15, elevationM: 14 },
      { ...bromma, distanceKm: 20, elevationM: 14 },
    ];
    const profile = resolveClimateProfile(location, stations);
    // Bromma GDD is 1799, elevation delta is 386m → penalty ~347 GDD
    expect(profile.gddBase5).toBeCloseTo(1452, 0);
  });

  it("applies elevation correction — higher postcode gets later last frost", () => {
    const location: PostcodeLocation = {
      postcode: "83000", lat: 59.35, lng: 17.95, elevationM: 400,
    };
    const stations: NearestStation[] = [
      { ...bromma, distanceKm: 10, elevationM: 14 },
      { ...bromma, distanceKm: 15, elevationM: 14 },
      { ...bromma, distanceKm: 20, elevationM: 14 },
    ];
    const profile = resolveClimateProfile(location, stations);
    // Bromma lastFrostDoy is 127, elevation delta 386m → ~13.5 days later
    expect(profile.lastFrostDoy).toBeGreaterThan(127);
    expect(profile.lastFrostDoy).toBeCloseTo(141, 0);
  });

  it("applies elevation correction — higher postcode gets earlier first frost", () => {
    const location: PostcodeLocation = {
      postcode: "83000", lat: 59.35, lng: 17.95, elevationM: 400,
    };
    const stations: NearestStation[] = [
      { ...bromma, distanceKm: 10, elevationM: 14 },
      { ...bromma, distanceKm: 15, elevationM: 14 },
      { ...bromma, distanceKm: 20, elevationM: 14 },
    ];
    const profile = resolveClimateProfile(location, stations);
    // Bromma firstFrostDoy is 282, elevation delta 386m → ~13.5 days earlier
    expect(profile.firstFrostDoy).toBeLessThan(282);
    expect(profile.firstFrostDoy).toBeCloseTo(268, 0);
  });

  it("growingDays is always derived from resolved frost dates not averaged", () => {
    const location: PostcodeLocation = {
      postcode: "11346", lat: 59.34, lng: 18.06, elevationM: 28,
    };
    const stations: NearestStation[] = [
      { ...bromma, distanceKm: 8 },
      { ...bromma, distanceKm: 12 },
      { ...bromma, distanceKm: 18 },
    ];
    const profile = resolveClimateProfile(location, stations);
    expect(profile.growingDays).toBe(profile.firstFrostDoy - profile.lastFrostDoy);
  });

  it("resolves 12 monthly mean temperatures", () => {
    const location: PostcodeLocation = {
      postcode: "11346", lat: 59.34, lng: 18.06, elevationM: 14,
    };
    const stations: NearestStation[] = [
      { ...bromma, distanceKm: 8 },
      { ...bromma, distanceKm: 12 },
      { ...bromma, distanceKm: 18 },
    ];
    const profile = resolveClimateProfile(location, stations);
    expect(profile.monthlyMeanTemps).toHaveLength(12);
    // July (index 6) must be warmer than January (index 0)
    expect(profile.monthlyMeanTemps[6]).toBeGreaterThan(profile.monthlyMeanTemps[0]);
  });

  it("gddBase5Cv is not elevation-corrected — it is a dimensionless variability score", () => {
    // CV is a ratio, not an absolute value — elevation does not change variability
    const location: PostcodeLocation = {
      postcode: "11346", lat: 59.34, lng: 18.06, elevationM: 400,
    };
    const stations: NearestStation[] = [
      { ...bromma, distanceKm: 10, elevationM: 14 },
      { ...bromma, distanceKm: 15, elevationM: 14 },
      { ...bromma, distanceKm: 20, elevationM: 14 },
    ];
    const profile = resolveClimateProfile(location, stations);
    // CV should be close to Bromma's CV of 0.10 regardless of elevation
    expect(profile.gddBase5Cv).toBeCloseTo(0.10, 1);
  });

  it("resolves a profile for Kiruna with correct northern characteristics", () => {
    const location: PostcodeLocation = {
      postcode: "98138", lat: 67.83, lng: 20.34, elevationM: 459,
    };
    const stations: NearestStation[] = [
      { ...kiruna, distanceKm: 5 },
      { ...kiruna, distanceKm: 9 },
      { ...kiruna, distanceKm: 14 },
    ];
    const profile = resolveClimateProfile(location, stations);
    expect(profile.lastFrostDoy).toBeGreaterThan(140);   // late spring frost
    expect(profile.firstFrostDoy).toBeLessThan(270);     // early autumn frost
    expect(profile.growingDays).toBeLessThan(130);       // short season
    expect(profile.gddBase5).toBeLessThan(900);         // low heat accumulation
    expect(profile.gddBase5Cv).toBeGreaterThan(0.14);         // high variability
  });
});
