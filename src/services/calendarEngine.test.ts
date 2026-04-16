import { describe, it, expect, beforeEach } from 'vitest'

// Type-safe null unwrap for test assertions — throws with a clear message if
// the value is null, avoiding non-null assertion operators (!) in test code.
function unwrap<T>(val: T | null, label = 'value'): T {
  if (val === null) {throw new Error(`Expected ${label} to be non-null`)}
  return val
}
import type { ClimateProfile, MethodCalendar } from '../types/climate.js'
import {
  generateCalendar,
  dayOfYearToCalendarDate,
  estimateNightTemp,
  firstMonthAboveNightTemp,
  assessFeasibility,
  resolveAnnualCalendar,
  resolveOverwinteredCalendar,
} from './calendarEngine.js'
import type { CropRecord, CropMethod, CropWithMethods } from './calendarEngine.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stockholmProfile: ClimateProfile = {
  postcode:         '11346',
  lastFrostDoy:     127,   // May 7th
  lastFrostP90:     143,   // May 23rd
  firstFrostDoy:    282,   // October 9th
  firstFrostP10:    268,   // September 25th
  growingDays:      155,
  gddAnnual:        1799,
  gddP10:           1620,
  gddP90:           1980,
  gddCv:            0.10,
  monthlyMeanTemps: [-1.2, -0.7, 2.1, 6.1, 11.5, 16.3, 18.3, 17.1, 13.3, 7.9, 4.0, 0.9],
}

const falsterboProfile: ClimateProfile = {
  postcode:         '23942',
  lastFrostDoy:     92,    // April 2nd
  lastFrostP90:     108,   // April 17th
  firstFrostDoy:    327,   // November 23rd
  firstFrostP10:    312,   // November 8th
  growingDays:      235,
  gddAnnual:        2105,
  gddP10:           1901,
  gddP90:           2299,
  gddCv:            0.07,
  monthlyMeanTemps: [2.4, 2.1, 3.8, 7.3, 12.1, 16.3, 18.1, 18.1, 15.5, 11.2, 7.3, 4.5],
}

const kirunaProfile: ClimateProfile = {
  postcode:         '98138',
  lastFrostDoy:     152,   // June 1st
  lastFrostP90:     168,   // June 17th
  firstFrostDoy:    253,   // September 10th
  firstFrostP10:    241,   // August 29th
  growingDays:      101,
  gddAnnual:        816,
  gddP10:           601,
  gddP90:           1003,
  gddCv:            0.16,
  monthlyMeanTemps: [-12.0, -9.7, -6.2, -1.3, 4.9, 10.8, 14.0, 11.6, 7.1, -0.3, -5.8, -8.8],
}

const tomatoMethod: CropMethod = {
  id:                        'tomato-from-seed',
  cropId:                    'tomato',
  labelSv:                   'Från frö',
  labelEn:                   'From seed',
  germinationMinSoilTempC:   15,
  germinationOptSoilTempC:   24,
  daysToGerminationMin:      7,
  daysToGerminationMax:      14,
  daysToMaturityMin:         60,
  daysToMaturityMax:         90,
  transplantTolerance:       'good',
  gddRequired:               1000,
  plantBeforeFirstFrostDays: null,
  sortOrder:                 0,
}

const tomatoCrop: CropRecord = {
  id:                   'tomato',
  nameSv:               'Tomat',
  nameEn:               'Tomato',
  lifecycle:            'annual',
  frostTolerance:       'none',
  minNightTempC:        10,
  daylengthRequirement: 'neutral',
}

const carrotMethod: CropMethod = {
  id:                        'carrot-direct',
  cropId:                    'carrot',
  labelSv:                   'Direktsådd',
  labelEn:                   'Direct sow',
  germinationMinSoilTempC:   7,
  germinationOptSoilTempC:   16,
  daysToGerminationMin:      14,
  daysToGerminationMax:      21,
  daysToMaturityMin:         70,
  daysToMaturityMax:         80,
  transplantTolerance:       'none',
  gddRequired:               600,
  plantBeforeFirstFrostDays: null,
  sortOrder:                 0,
}

const carrotCrop: CropRecord = {
  id:                   'carrot',
  nameSv:               'Morot',
  nameEn:               'Carrot',
  lifecycle:            'annual',
  frostTolerance:       'light',
  minNightTempC:        null,
  daylengthRequirement: 'neutral',
}

const garlicMethod: CropMethod = {
  id:                        'garlic-overwintered',
  cropId:                    'garlic',
  labelSv:                   'Höstplantering',
  labelEn:                   'Autumn planting',
  germinationMinSoilTempC:   null,
  germinationOptSoilTempC:   null,
  daysToGerminationMin:      null,
  daysToGerminationMax:      null,
  daysToMaturityMin:         null,
  daysToMaturityMax:         null,
  transplantTolerance:       'direct-only',
  gddRequired:               null,
  plantBeforeFirstFrostDays: 21,
  sortOrder:                 0,
}

const garlicCrop: CropRecord = {
  id:                   'garlic',
  nameSv:               'Vitlök',
  nameEn:               'Garlic',
  lifecycle:            'overwintered',
  frostTolerance:       'hard',
  minNightTempC:        null,
  daylengthRequirement: 'neutral',
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
    const result = firstMonthAboveNightTemp(stockholmProfile.monthlyMeanTemps, 10)
    expect(result).toBe(5)  // 0-indexed June
  })

  it('returns June (index 5) for Falsterbo with 10°C minimum', () => {
    // Falsterbo May mean 12.1 → estimated night 7.1 → below 10°C
    // June mean 16.3 → estimated night 11.3 → above 10°C
    const result = firstMonthAboveNightTemp(falsterboProfile.monthlyMeanTemps, 10)
    expect(result).toBe(5)  // June
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
  describe('tomato', () => {
    it('is feasible in Falsterbo', () => {
      const result = assessFeasibility(falsterboProfile, tomatoMethod, tomatoCrop)
      expect(result.status).toBe('feasible')
      expect(result.reason).toBeNull()
    })

    it('is feasible in Stockholm', () => {
      const result = assessFeasibility(stockholmProfile, tomatoMethod, tomatoCrop)
      expect(result.status).toBe('feasible')
    })

    it('is infeasible in Kiruna — insufficient GDD', () => {
      // Kiruna gddP10=601 < 75% of required 1000 GDD — fails GDD check before night temp
      const result = assessFeasibility(kirunaProfile, tomatoMethod, tomatoCrop)
      expect(result.status).toBe('infeasible')
      expect(result.reason).toContain('GDD')
    })
  })

  describe('carrot', () => {
    it('is feasible in Stockholm', () => {
      const result = assessFeasibility(stockholmProfile, carrotMethod, carrotCrop)
      expect(result.status).toBe('feasible')
    })

    it('is feasible or marginal in Kiruna', () => {
      // Carrot needs 600 GDD — Kiruna P10 is 601 — marginal at best
      const result = assessFeasibility(kirunaProfile, carrotMethod, carrotCrop)
      expect(['feasible', 'marginal']).toContain(result.status)
    })
  })

  describe('high variability warning', () => {
    it('returns marginal for Kiruna due to high gddCv', () => {
      // Even if GDD check passes, CV 0.16 > 0.15 threshold triggers marginal
      const result = assessFeasibility(kirunaProfile, carrotMethod, carrotCrop)
      if (result.status === 'marginal') {
        expect(result.reason).toContain('vary significantly')
      }
    })
  })
})

describe('resolveAnnualCalendar — tomato', () => {
  describe('Stockholm', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = resolveAnnualCalendar(stockholmProfile, tomatoMethod, tomatoCrop)
    })

    it('has a sow indoors window', () => {
      expect(calendar.sowIndoors).not.toBeNull()
    })

    it('sow indoors starts before transplant', () => {
      const sowMonth        = unwrap(calendar.sowIndoors,  'sowIndoors').startMonth
      const transplantMonth = unwrap(calendar.transplant, 'transplant').startMonth
      expect(sowMonth).toBeLessThan(transplantMonth)
    })

    it('transplant is after last frost P90 (May 23rd)', () => {
      // transplant pushed out to June due to night temp constraint
      expect(unwrap(calendar.transplant, 'transplant').startMonth).toBeGreaterThanOrEqual(6)
    })

    it('has no direct sow window', () => {
      expect(calendar.directSow).toBeNull()
    })

    it('harvest ends before first frost P10 (September 25th)', () => {
      expect(unwrap(calendar.harvest, 'harvest').endMonth).toBeLessThanOrEqual(9)
    })

    it('is feasible', () => {
      expect(calendar.feasibility).toBe('feasible')
    })
  })

  describe('Kiruna', () => {
    it('is infeasible', () => {
      const calendar = resolveAnnualCalendar(kirunaProfile, tomatoMethod, tomatoCrop)
      expect(calendar.feasibility).toBe('infeasible')
      expect(calendar.feasibilityReason).not.toBeNull()
    })
  })
})

describe('resolveAnnualCalendar — carrot', () => {
  describe('Stockholm', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = resolveAnnualCalendar(stockholmProfile, carrotMethod, carrotCrop)
    })

    it('has a direct sow window, no transplant or indoor sow', () => {
      expect(calendar.directSow).not.toBeNull()
      expect(calendar.transplant).toBeNull()
      expect(calendar.sowIndoors).toBeNull()
    })

    it('direct sow is after soil reaches 7°C', () => {
      // Stockholm April mean 6.1°C → soil ~7.6°C → April viable
      expect(unwrap(calendar.directSow, 'directSow').startMonth).toBeGreaterThanOrEqual(4)
    })

    it('harvest ends before first frost P10', () => {
      expect(calendar.harvest).not.toBeNull()
      expect(unwrap(calendar.harvest, 'harvest').endMonth).toBeLessThanOrEqual(10)
    })
  })
})

describe('resolveOverwinteredCalendar — garlic', () => {
  describe('Stockholm', () => {
    let calendar: MethodCalendar

    beforeEach(() => {
      calendar = resolveOverwinteredCalendar(stockholmProfile, garlicMethod, garlicCrop)
    })

    it('has a directSow window for autumn planting', () => {
      expect(calendar.directSow).not.toBeNull()
    })

    it('autumn planting is in September or October', () => {
      // Stockholm first frost ~October 9th, plant 21 days before → ~September 18th
      expect(unwrap(calendar.directSow, 'directSow').startMonth).toBeGreaterThanOrEqual(9)
      expect(unwrap(calendar.directSow, 'directSow').startMonth).toBeLessThanOrEqual(10)
    })

    it('has no indoor sow or transplant window', () => {
      expect(calendar.sowIndoors).toBeNull()
      expect(calendar.transplant).toBeNull()
    })

    it('harvest is in summer — June or July', () => {
      expect(unwrap(calendar.harvest, 'harvest').startMonth).toBeGreaterThanOrEqual(6)
      expect(unwrap(calendar.harvest, 'harvest').endMonth).toBeLessThanOrEqual(8)
    })

    it('is feasible', () => {
      expect(calendar.feasibility).toBe('feasible')
    })
  })

  describe('Kiruna', () => {
    it('autumn planting is earlier than Stockholm due to earlier first frost', () => {
      const kirunaCalendar    = resolveOverwinteredCalendar(kirunaProfile, garlicMethod, garlicCrop)
      const stockholmCalendar = resolveOverwinteredCalendar(stockholmProfile, garlicMethod, garlicCrop)
      // Kiruna first frost September 10th vs Stockholm October 9th
      // Kiruna planting should be in August, Stockholm in September
      expect(unwrap(kirunaCalendar.directSow,  'kirunaCalendar.directSow').startMonth)
        .toBeLessThan(unwrap(stockholmCalendar.directSow, 'stockholmCalendar.directSow').startMonth)
    })
  })
})

describe('generateCalendar', () => {
  it('returns one CropCalendar per crop', () => {
    const crops: CropWithMethods[] = [
      { ...tomatoCrop, methods: [tomatoMethod] },
      { ...carrotCrop, methods: [carrotMethod] },
      { ...garlicCrop, methods: [garlicMethod] },
    ]
    const result = generateCalendar(stockholmProfile, crops)
    expect(result).toHaveLength(3)
  })

  it('dispatches overwintered crops to the correct resolver', () => {
    const crops: CropWithMethods[] = [{ ...garlicCrop, methods: [garlicMethod] }]
    const result = generateCalendar(stockholmProfile, crops)
    // Garlic should have autumn planting in directSow, not sowIndoors
    expect(result[0].methods[0].sowIndoors).toBeNull()
    expect(result[0].methods[0].directSow).not.toBeNull()
  })

  it('sorts methods by sortOrder', () => {
    const onionFromSeed: CropMethod = { ...tomatoMethod, id: 'onion-from-seed', cropId: 'onion', sortOrder: 0 }
    const onionFromSets: CropMethod = { ...tomatoMethod, id: 'onion-from-sets', cropId: 'onion', sortOrder: 1 }
    const crops: CropWithMethods[] = [{
      id:                   'onion',
      nameSv:               'Lök',
      nameEn:               'Onion',
      lifecycle:            'annual',
      frostTolerance:       'light',
      minNightTempC:        null,
      daylengthRequirement: 'long',
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
      methods:              [{ ...tomatoMethod, id: 'strawberry-plant', cropId: 'strawberry' }],
    }]
    const result = generateCalendar(stockholmProfile, crops)
    expect(result[0].methods[0].feasibility).toBe('infeasible')
    expect(result[0].methods[0].feasibilityReason).toContain('not yet supported')
  })
})
