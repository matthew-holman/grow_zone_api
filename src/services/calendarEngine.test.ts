import { describe, it, expect, beforeEach } from 'vitest'

// Type-safe null unwrap for test assertions — throws with a clear message if
// the value is null, avoiding non-null assertion operators (!) in test code.
function unwrap<T>(val: T | null, label = 'value'): T {
  if (val === null) { throw new Error(`Expected ${label} to be non-null`) }
  return val
}

import type { ClimateProfile } from '../domain/climate.js'
import type { MethodCalendar } from '../schemas/calendar.js'
import {
  generateCalendar,
  dayOfYearToCalendarDate,
  estimateNightTemp,
  firstMonthAboveNightTemp,
  assessFeasibility,
  generateCalendarForCrop,
  generateOverwinteredCalendarForCrop,
} from './calendarEngine.js'
import type { CropCalendarRecord, CropMethodCalendarRecord, CropWithMethods } from '../schemas/crops.js'

// ---------------------------------------------------------------------------
// Climate profile fixtures
//
// Values are calibrated against real Swedish station data. Comments show the
// human-readable date equivalent for key DOY values.
// ---------------------------------------------------------------------------

const stockholmProfile: ClimateProfile = {
  postcode:         '11346',
  lastFrostDoy:     127,   // May 7
  lastFrostP90:     143,   // May 23 — conservative transplant anchor
  firstFrostDoy:    282,   // October 9
  firstFrostP10:    268,   // September 25 — conservative harvest deadline
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
}

// Falsterbo — maritime south, Sweden's most favourable growing climate.
const falsterboProfile: ClimateProfile = {
  postcode:         '23942',
  lastFrostDoy:     92,    // April 2
  lastFrostP90:     108,   // April 17
  firstFrostDoy:    327,   // November 23
  firstFrostP10:    312,   // November 8
  growingDays:      235,
  gddBase5:         2105,
  gddBase5P10:      1901,
  gddBase5Cv:       0.07,
  gddBase7:         1607,
  gddBase7P10:      1428,
  gddBase7Cv:       0.09,
  gddBase10:        1018,
  gddBase10P10:     831,
  gddBase10Cv:      0.12,
  gddBase15:        301,
  gddBase15P10:     174,
  gddBase15Cv:      0.30,
  monthlyMeanTemps: [2.4, 2.1, 3.8, 7.3, 12.1, 16.3, 18.1, 18.1, 15.5, 11.2, 7.3, 4.5],
}

// Kiruna — subarctic north, the hardest Swedish growing environment.
const kirunaProfile: ClimateProfile = {
  postcode:         '98138',
  lastFrostDoy:     152,   // June 1
  lastFrostP90:     168,   // June 17
  firstFrostDoy:    253,   // September 10
  firstFrostP10:    241,   // August 29
  growingDays:      101,
  gddBase5:         816,
  gddBase5P10:      601,
  gddBase5Cv:       0.16,
  gddBase7:         614,
  gddBase7P10:      399,
  gddBase7Cv:       0.19,
  gddBase10:        311,
  gddBase10P10:     96,
  gddBase10Cv:      0.28,
  gddBase15:        15,
  gddBase15P10:     0,
  gddBase15Cv:      0.0,
  monthlyMeanTemps: [-12.0, -9.7, -6.2, -1.3, 4.9, 10.8, 14.0, 11.6, 7.1, -0.3, -5.8, -8.8],
}

// ---------------------------------------------------------------------------
// Crop + method fixtures
//
// gddToMaturity values are calibrated to real horticultural figures.
// Tomato (base 10°C): ~1000 GDD from transplant to first harvest.
// Carrot (base 5°C):  ~600 GDD from sow to harvest.
// Garlic: overwintered, no GDD maturity figure needed.
//
// Key implication for Stockholm:
//   gddBase10 = 868, gddBase10P10 = 712
//   Tomato needs 1000 GDD(10°C) — Stockholm cannot reliably mature tomatoes.
//   This is the engine being correct, not a fixture error.
//
// Key implication for Falsterbo:
//   gddBase10 = 1018, gddBase10P10 = 831
//   Median just clears 1000 GDD but P10 does not → marginal, not reliable.
// ---------------------------------------------------------------------------

const tomatoFromSeedMethod: CropMethodCalendarRecord = {
  id:                         'tomato-from-seed',
  cropId:                     'tomato',
  labelSv:                    'Från frö',
  labelEn:                    'From seed',
  germinationMinSoilTempC:    15,
  germinationOptSoilTempC:    24,
  daysToGerminationMin:       7,
  daysToGerminationMax:       14,
  daysToMaturityMin:          60,
  daysToMaturityMax:          90,
  transplantTolerance:        'good',
  gddToMaturity:              1000,
  gddToMaturityP10:           null,
  weeksIndoorBeforeLastFrost: 7,
  sortOrder:                  0,
}

const tomatoCrop: CropCalendarRecord = {
  id:                   'tomato',
  nameSv:               'Tomat',
  nameEn:               'Tomato',
  lifecycle:            'annual',
  frostTolerance:       'none',
  minNightTempC:        10,
  daylengthRequirement: 'neutral',
  gddBaseTempC:         10,
}

const carrotMethod: CropMethodCalendarRecord = {
  id:                         'carrot-direct',
  cropId:                     'carrot',
  labelSv:                    'Direktsådd',
  labelEn:                    'Direct sow',
  germinationMinSoilTempC:    4,
  germinationOptSoilTempC:    13,
  daysToGerminationMin:       14,
  daysToGerminationMax:       21,
  daysToMaturityMin:          70,
  daysToMaturityMax:          80,
  transplantTolerance:        'none',
  gddToMaturity:              600,
  gddToMaturityP10:           null,
  weeksIndoorBeforeLastFrost: null,
  sortOrder:                  0,
}

const carrotCrop: CropCalendarRecord = {
  id:                   'carrot',
  nameSv:               'Morot',
  nameEn:               'Carrot',
  lifecycle:            'annual',
  frostTolerance:       'light',
  minNightTempC:        null,
  daylengthRequirement: 'neutral',
  gddBaseTempC:         5,
}

const garlicMethod: CropMethodCalendarRecord = {
  id:                         'garlic-overwintered',
  cropId:                     'garlic',
  labelSv:                    'Höstplantering',
  labelEn:                    'Autumn planting',
  germinationMinSoilTempC:    null,
  germinationOptSoilTempC:    null,
  daysToGerminationMin:       null,
  daysToGerminationMax:       null,
  daysToMaturityMin:          null,
  daysToMaturityMax:          null,
  transplantTolerance:        'direct-only',
  gddToMaturity:              null,
  gddToMaturityP10:           null,
  weeksIndoorBeforeLastFrost: null,
  sortOrder:                  0,
}

const garlicCrop: CropCalendarRecord = {
  id:                   'garlic',
  nameSv:               'Vitlök',
  nameEn:               'Garlic',
  lifecycle:            'overwintered',
  frostTolerance:       'hard',
  minNightTempC:        null,
  daylengthRequirement: 'neutral',
  gddBaseTempC:         5,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dayOfYearToCalendarDate', () => {
  it('converts day 1 to January 1st', () => {
    expect(dayOfYearToCalendarDate(1)).toEqual({ month: 1, day: 1 })
  })

  it('converts day 32 to February 1st', () => {
    expect(dayOfYearToCalendarDate(32)).toEqual({ month: 2, day: 1 })
  })

  it('converts day 127 to May 7th', () => {
    expect(dayOfYearToCalendarDate(127)).toEqual({ month: 5, day: 7 })
  })

  it('converts day 365 to December 31st', () => {
    expect(dayOfYearToCalendarDate(365)).toEqual({ month: 12, day: 31 })
  })
})

describe('estimateNightTemp', () => {
  it('subtracts 5°C from monthly mean', () => {
    const temps = [0, 0, 0, 0, 0, 16.3, 0, 0, 0, 0, 0, 0]
    expect(estimateNightTemp(temps, 5)).toBe(11.3)
  })

  it('returns negative value for cold months', () => {
    const temps = [-1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(estimateNightTemp(temps, 0)).toBe(-6.2)
  })
})

describe('firstMonthAboveNightTemp', () => {
  it('returns June (index 5) for Stockholm with 10°C minimum', () => {
    // Stockholm June mean 16.3 → estimated night 11.3 → above 10°C
    // May mean 11.5 → estimated night 6.5 → below 10°C
    const result = firstMonthAboveNightTemp(stockholmProfile.monthlyMeanTemps, 10)
    expect(result).toBe(5)
  })

  it('returns June (index 5) for Falsterbo with 10°C minimum', () => {
    // Falsterbo May mean 12.1 → estimated night 7.1 → below 10°C
    // June mean 16.3 → estimated night 11.3 → above 10°C
    const result = firstMonthAboveNightTemp(falsterboProfile.monthlyMeanTemps, 10)
    expect(result).toBe(5)
  })

  it('returns null for Kiruna with 10°C minimum', () => {
    // Kiruna July mean 14.0 → estimated night 9.0 → never reaches 10°C
    const result = firstMonthAboveNightTemp(kirunaProfile.monthlyMeanTemps, 10)
    expect(result).toBeNull()
  })

  it('returns null when threshold is never reached', () => {
    const coldTemps = Array(12).fill(-10) as number[]
    expect(firstMonthAboveNightTemp(coldTemps, 5)).toBeNull()
  })
})

describe('assessFeasibility', () => {
  describe('tomato (gddBaseTempC: 10, gddToMaturity: 1000)', () => {
    it('is marginal in Falsterbo — median GDD clears but P10 does not', () => {
      // Falsterbo gddBase10=1018 (≥1000) but gddBase10P10=831 (<1000) → marginal
      const result = assessFeasibility(falsterboProfile, tomatoFromSeedMethod, tomatoCrop)
      expect(result.status).toBe('marginal')
      expect(result.reason).not.toBeNull()
    })

    it('is infeasible in Stockholm — insufficient GDD even at median', () => {
      // Stockholm gddBase10=868 < 1000 required, gddBase10P10=712 < 750 (75% threshold) → infeasible
      const result = assessFeasibility(stockholmProfile, tomatoFromSeedMethod, tomatoCrop)
      expect(result.status).toBe('infeasible')
      expect(result.reason).toContain('GDD')
    })

    it('is infeasible in Kiruna — severely insufficient GDD', () => {
      // Kiruna gddBase10=311, P10=96 — far below 1000 required
      const result = assessFeasibility(kirunaProfile, tomatoFromSeedMethod, tomatoCrop)
      expect(result.status).toBe('infeasible')
      expect(result.reason).toContain('GDD')
    })
  })

  describe('carrot (gddBaseTempC: 5, gddToMaturity: 600)', () => {
    it('is feasible in Stockholm', () => {
      // Stockholm gddBase5=1799, gddBase5P10=1620 — both well above 600
      // CV=0.10 < 0.15 threshold → feasible
      const result = assessFeasibility(stockholmProfile, carrotMethod, carrotCrop)
      expect(result.status).toBe('feasible')
      expect(result.reason).toBeNull()
    })

    it('is feasible in Falsterbo', () => {
      // Falsterbo gddBase5=2105, P10=1901 — well above 600, CV=0.07 very stable
      const result = assessFeasibility(falsterboProfile, carrotMethod, carrotCrop)
      expect(result.status).toBe('feasible')
      expect(result.reason).toBeNull()
    })

    it('is marginal in Kiruna — GDD clears but CV exceeds threshold', () => {
      // Kiruna gddBase5P10=601 just clears 600 required → passes GDD check
      // But gddBase5Cv=0.16 > 0.15 → marginal due to high variability
      const result = assessFeasibility(kirunaProfile, carrotMethod, carrotCrop)
      expect(result.status).toBe('marginal')
      expect(result.reason).toContain('vary significantly')
    })
  })

  describe('GDD base temp selection', () => {
    it('uses gddBase10 fields for a base-10 crop, not gddBase5', () => {
      // Stockholm gddBase5P10=1620 would pass a 1000 GDD check (1620 > 750)
      // but gddBase10P10=712 correctly fails it (712 < 750) — proves correct field selection
      const result = assessFeasibility(stockholmProfile, tomatoFromSeedMethod, tomatoCrop)
      expect(result.status).toBe('infeasible')
    })
  })
})

describe('resolveAnnualCalendar — tomato', () => {
  // Tomato is infeasible in Stockholm (gddBase10=868 < 1000 required).
  // The engine should still return a calendar object — with infeasible status
  // and null windows — rather than throwing.
  describe('Stockholm — infeasible', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = generateCalendarForCrop(stockholmProfile, tomatoFromSeedMethod, tomatoCrop)
    })

    it('returns infeasible status', () => {
      expect(calendar.feasibility).toBe('infeasible')
    })

    it('includes a reason explaining the GDD shortfall', () => {
      expect(calendar.feasibilityReason).not.toBeNull()
      expect(calendar.feasibilityReason).toContain('GDD')
    })

    it('still returns sow and transplant windows despite infeasibility', () => {
      // The engine calculates windows regardless of feasibility — the UI decides
      // whether to show them. An infeasible crop still has a theoretical calendar.
      expect(calendar.sowIndoors).not.toBeNull()
      expect(calendar.transplant).not.toBeNull()
    })

    it('has no direct sow window — tomato is transplant-only', () => {
      expect(calendar.directSow).toBeNull()
    })
  })

  describe('Falsterbo — marginal', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = generateCalendarForCrop(falsterboProfile, tomatoFromSeedMethod, tomatoCrop)
    })

    it('returns marginal status', () => {
      expect(calendar.feasibility).toBe('marginal')
    })

    it('has an indoor sow window', () => {
      expect(calendar.sowIndoors).not.toBeNull()
    })

    it('sow indoors starts before transplant', () => {
      const sowMonth        = unwrap(calendar.sowIndoors, 'sowIndoors').startMonth
      const transplantMonth = unwrap(calendar.transplant, 'transplant').startMonth
      expect(sowMonth).toBeLessThan(transplantMonth)
    })

    it('transplant is in May or June — after last frost P90 (April 17) and night temp constraint', () => {
      // Falsterbo lastFrostP90=April 17 (DOY 108), but night temp constraint pushes
      // transplant to June (first month nights exceed 10°C)
      const transplantMonth = unwrap(calendar.transplant, 'transplant').startMonth
      expect(transplantMonth).toBeGreaterThanOrEqual(5)
      expect(transplantMonth).toBeLessThanOrEqual(6)
    })

    it('indoor sow is in March or April — 7 weeks before June transplant', () => {
      const sowMonth = unwrap(calendar.sowIndoors, 'sowIndoors').startMonth
      expect(sowMonth).toBeGreaterThanOrEqual(3)
      expect(sowMonth).toBeLessThanOrEqual(4)
    })

    it('harvest window falls before first frost P10 (November 8)', () => {
      const harvestEnd = unwrap(calendar.harvest, 'harvest').endMonth
      expect(harvestEnd).toBeLessThanOrEqual(11)
    })

    it('harvest starts in August or September — after ~1000 GDD(10°C) accumulated from June transplant', () => {
      const harvestStart = unwrap(calendar.harvest, 'harvest').startMonth
      expect(harvestStart).toBeGreaterThanOrEqual(7)
      expect(harvestStart).toBeLessThanOrEqual(9)
    })
  })

  describe('Kiruna — infeasible', () => {
    it('returns infeasible status', () => {
      const calendar = generateCalendarForCrop(kirunaProfile, tomatoFromSeedMethod, tomatoCrop)
      expect(calendar.feasibility).toBe('infeasible')
      expect(calendar.feasibilityReason).not.toBeNull()
    })

    it('returns no harvest window', () => {
      const calendar = generateCalendarForCrop(kirunaProfile, tomatoFromSeedMethod, tomatoCrop)
      expect(calendar.harvest).toBeNull()
    })
  })
})

describe('resolveAnnualCalendar — carrot', () => {
  describe('Stockholm', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = generateCalendarForCrop(stockholmProfile, carrotMethod, carrotCrop)
    })

    it('is feasible', () => {
      expect(calendar.feasibility).toBe('feasible')
    })

    it('has a direct sow window with no transplant or indoor sow', () => {
      expect(calendar.directSow).not.toBeNull()
      expect(calendar.transplant).toBeNull()
      expect(calendar.sowIndoors).toBeNull()
    })

    it('direct sow opens in April — soil reaches 7°C by April in Stockholm', () => {
      // Stockholm April mean 6.1°C → estimated soil temp 7.6°C → above 7°C min
      expect(unwrap(calendar.directSow, 'directSow').startMonth).toBe(4)
    })

    it('harvest starts in July or August — after ~600 GDD(5°C) from April sow', () => {
      // April sow + germination + 600 GDD(5°C) accumulation from Stockholm temps
      // Stockholm May=11.5, Jun=16.3, Jul=18.3 → accumulates quickly
      const harvestStart = unwrap(calendar.harvest, 'harvest').startMonth
      expect(harvestStart).toBeGreaterThanOrEqual(7)
      expect(harvestStart).toBeLessThanOrEqual(8)
    })

    it('harvest ends before first frost P10 (September 25)', () => {
      const harvestEnd = unwrap(calendar.harvest, 'harvest').endMonth
      expect(harvestEnd).toBeLessThanOrEqual(9)
    })
  })

  describe('Kiruna', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = generateCalendarForCrop(kirunaProfile, carrotMethod, carrotCrop)
    })

    it('is marginal due to high GDD variability', () => {
      expect(calendar.feasibility).toBe('marginal')
    })

    it('direct sow opens later than Stockholm — soil warming is delayed', () => {
      const stockholmCalendar = generateCalendarForCrop(stockholmProfile, carrotMethod, carrotCrop)
      const kirunaSowMonth    = unwrap(calendar.directSow, 'directSow').startMonth
      const stockholmSowMonth = unwrap(stockholmCalendar.directSow, 'directSow').startMonth
      expect(kirunaSowMonth).toBeGreaterThanOrEqual(stockholmSowMonth)
    })
  })
})

describe('resolveOverwinteredCalendar — garlic', () => {
  describe('Stockholm', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = generateOverwinteredCalendarForCrop(stockholmProfile, garlicMethod, garlicCrop)
    })

    it('has a directSow window for autumn planting', () => {
      expect(calendar.directSow).not.toBeNull()
    })

    it('autumn planting is in September — 21 days before first frost (October 9)', () => {
      // firstFrostDoy=282 (Oct 9) - 21 days = DOY 261 = September 18
      const plantMonth = unwrap(calendar.directSow, 'directSow').startMonth
      expect(plantMonth).toBe(9)
    })

    it('has no indoor sow or transplant window', () => {
      expect(calendar.sowIndoors).toBeNull()
      expect(calendar.transplant).toBeNull()
    })

    it('harvest is in July — 60–90 days after last frost (May 7)', () => {
      // lastFrostDoy=127 (May 7) + 60 days = DOY 187 = July 6
      // lastFrostDoy=127 + 90 days = DOY 217 = August 5
      const harvestStart = unwrap(calendar.harvest, 'harvest').startMonth
      const harvestEnd   = unwrap(calendar.harvest, 'harvest').endMonth
      expect(harvestStart).toBeGreaterThanOrEqual(6)
      expect(harvestEnd).toBeLessThanOrEqual(8)
    })

    it('is feasible', () => {
      expect(calendar.feasibility).toBe('feasible')
    })
  })

  describe('Kiruna', () => {
    it('autumn planting is in August — earlier first frost means earlier planting', () => {
      // Kiruna firstFrostDoy=253 (Sep 10) - 21 days = DOY 232 = August 20
      const calendar   = generateOverwinteredCalendarForCrop(kirunaProfile, garlicMethod, garlicCrop)
      const plantMonth = unwrap(calendar.directSow, 'directSow').startMonth
      expect(plantMonth).toBe(8)
    })

    it('autumn planting is earlier than Stockholm', () => {
      const kirunaCalendar    = generateOverwinteredCalendarForCrop(kirunaProfile, garlicMethod, garlicCrop)
      const stockholmCalendar = generateOverwinteredCalendarForCrop(stockholmProfile, garlicMethod, garlicCrop)
      expect(unwrap(kirunaCalendar.directSow, 'kirunaCalendar.directSow').startMonth)
          .toBeLessThan(unwrap(stockholmCalendar.directSow, 'stockholmCalendar.directSow').startMonth)
    })
  })
})

describe('generateCalendar', () => {
  it('returns one CropCalendar per crop', () => {
    const crops: CropWithMethods[] = [
      { ...tomatoCrop, methods: [tomatoFromSeedMethod] },
      { ...carrotCrop, methods: [carrotMethod] },
      { ...garlicCrop, methods: [garlicMethod] },
    ]
    const result = generateCalendar(stockholmProfile, crops)
    expect(result).toHaveLength(3)
  })

  it('dispatches overwintered crops to the correct resolver', () => {
    const crops: CropWithMethods[] = [{ ...garlicCrop, methods: [garlicMethod] }]
    const result = generateCalendar(stockholmProfile, crops)
    // Garlic autumn planting appears as directSow, not sowIndoors
    expect(result[0].methods[0].sowIndoors).toBeNull()
    expect(result[0].methods[0].directSow).not.toBeNull()
  })

  it('dispatches annual crops to the correct resolver', () => {
    const crops: CropWithMethods[] = [{ ...carrotCrop, methods: [carrotMethod] }]
    const result = generateCalendar(falsterboProfile, crops)
    expect(result[0].methods[0].directSow).not.toBeNull()
  })

  it('sorts methods by sortOrder', () => {
    const onionFromSeed: CropMethodCalendarRecord = {
      ...tomatoFromSeedMethod,
      id:        'onion-from-seed',
      cropId:    'onion',
      sortOrder: 0,
    }
    const onionFromSets: CropMethodCalendarRecord = {
      ...tomatoFromSeedMethod,
      id:        'onion-from-sets',
      cropId:    'onion',
      sortOrder: 1,
    }
    const crops: CropWithMethods[] = [{
      id:                   'onion',
      nameSv:               'Lök',
      nameEn:               'Onion',
      lifecycle:            'annual',
      frostTolerance:       'light',
      minNightTempC:        null,
      daylengthRequirement: 'long',
      gddBaseTempC:         5,
      methods:              [onionFromSets, onionFromSeed],  // intentionally wrong order
    }]
    const result = generateCalendar(stockholmProfile, crops)
    expect(result[0].methods[0].methodId).toBe('onion-from-seed')
    expect(result[0].methods[1].methodId).toBe('onion-from-sets')
  })

  it('returns infeasible status for unsupported lifecycle types', () => {
    const crops: CropWithMethods[] = [{
      id:                   'strawberry',
      nameSv:               'Jordgubbe',
      nameEn:               'Strawberry',
      lifecycle:            'perennial',
      frostTolerance:       'light',
      minNightTempC:        null,
      daylengthRequirement: 'neutral',
      gddBaseTempC:         5,
      methods:              [{ ...tomatoFromSeedMethod, id: 'strawberry-plant', cropId: 'strawberry' }],
    }]
    const result = generateCalendar(stockholmProfile, crops)
    expect(result[0].methods[0].feasibility).toBe('infeasible')
    expect(result[0].methods[0].feasibilityReason).toContain('not yet supported')
  })
})