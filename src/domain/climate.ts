import type { NearestStation } from '../services/stationLookup.js'

export interface ClimateProfile {
  postcode:         string;
  lastFrostDoy:     number;
  lastFrostP90:     number;
  firstFrostDoy:    number;
  firstFrostP10:    number;
  growingDays:      number;
  gddBase5:         number;
  gddBase5P10:      number;
  gddBase5Cv:       number;
  gddBase7:         number;
  gddBase7P10:      number;
  gddBase7Cv:       number;
  gddBase10:        number;
  gddBase10P10:     number;
  gddBase10Cv:      number;
  gddBase15:        number;
  gddBase15P10:     number;
  gddBase15Cv:      number;
  monthlyMeanTemps: number[];
}

export interface StationWeight {
  station:    NearestStation;
  weight:     number;     // 1 / distance²
  elevDeltaM: number;     // postcode elevation minus station elevation
                          // positive = postcode higher than station
                          // negative = postcode lower than station
}
