import type { NearestStation } from '../services/stationLookup.js'

export interface ClimateProfile {
  postcode:         string;
  lastFrostDoy:     number;
  lastFrostP90:     number;
  firstFrostDoy:    number;
  firstFrostP10:    number;
  growingDays:      number;
  gddAnnual:        number;
  gddP10:           number;
  gddP90:           number;
  gddCv:            number;
  monthlyMeanTemps: number[];
}

export interface StationWeight {
  station:    NearestStation;
  weight:     number;     // 1 / distance²
  elevDeltaM: number;     // postcode elevation minus station elevation
                          // positive = postcode higher than station
                          // negative = postcode lower than station
}
