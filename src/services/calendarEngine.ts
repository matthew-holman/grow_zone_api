import type { ClimateProfile } from '../domain/climate.js'
import type {
  CalendarWindow,
  FeasibilityStatus,
  MethodCalendar,
  CropCalendar,
} from '../schemas/calendar.js'
import type {
  CropCalendarRecord,
  CropMethodCalendarRecord,
  CropWithMethods,
} from '../schemas/crops.js'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateCalendar(
  profile: ClimateProfile,
  crops: CropWithMethods[],
): CropCalendar[] {
  return crops.map(crop => ({
    cropId:     crop.id,
    cropNameSv: crop.nameSv,
    cropNameEn: crop.nameEn,
    lifecycle:  crop.lifecycle,
    methods:    crop.methods
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(method => {
        switch (crop.lifecycle) {
          case 'overwintered':
            return resolveOverwinteredCalendar(profile, method, crop)
          case 'annual':
            return resolveAnnualCalendar(profile, method, crop)
          default:
            return unsupportedLifecycle(method, crop)
        }
      }),
  }))
}

export function dayOfYearToCalendarDate(doy: number): { month: number; day: number } {
  const date = new Date(2023, 0, 1)  // non-leap year so DOY aligns with standard 365-day calendar
  date.setDate(date.getDate() + Math.round(doy) - 1)
  return { month: date.getMonth() + 1, day: date.getDate() }
}

export function estimateNightTemp(
  monthlyMeanTemps: number[],
  month: number,  // 0-indexed
): number {
  return monthlyMeanTemps[month] - 5
}

export function firstMonthAboveNightTemp(
  monthlyMeanTemps: number[],
  minNightTempC: number,
): number | null {
  for (let month = 0; month < 12; month++) {
    if (estimateNightTemp(monthlyMeanTemps, month) >= minNightTempC) {
      return month
    }
  }
  return null
}

export function assessFeasibility(
  profile: ClimateProfile,
  method: CropMethodCalendarRecord,
  crop: CropCalendarRecord,
): { status: FeasibilityStatus; reason: string | null } {
  // 1. GDD check
  if (method.gddRequired !== null) {
    if (profile.gddBase5P10 < method.gddRequired * 0.75) {
      return {
        status: 'infeasible',
        reason: `Requires ${method.gddRequired} GDD but this location reliably provides only ${profile.gddBase5P10} GDD (10th percentile).`,
      }
    }
    if (profile.gddBase5P10 < method.gddRequired) {
      return {
        status: 'marginal',
        reason: `Requires ${method.gddRequired} GDD. This location typically provides ${profile.gddBase5} GDD but only ${profile.gddBase5P10} GDD in cooler years. Choose the earliest maturing variety.`,
      }
    }
  }

  // 2. Night temperature check
  if (crop.minNightTempC !== null) {
    const warmMonth = firstMonthAboveNightTemp(profile.monthlyMeanTemps, crop.minNightTempC)
    if (warmMonth === null) {
      return {
        status: 'infeasible',
        reason: `Requires nights above ${crop.minNightTempC}°C for planting out. This is not reliably reached in this location.`,
      }
    }
  }

  // 3. Season length check for direct-sow crops
  if (method.transplantTolerance === 'none' || method.transplantTolerance === 'direct-only') {
    const daysNeeded = (method.daysToMaturityMax ?? 0) + (method.daysToGerminationMax ?? 0)
    if (profile.growingDays < daysNeeded * 0.75) {
      return {
        status: 'infeasible',
        reason: `Needs ${daysNeeded} days from sow to harvest but this location has only ${profile.growingDays} frost-free days.`,
      }
    }
    if (profile.growingDays < daysNeeded) {
      return {
        status: 'marginal',
        reason: `Needs ${daysNeeded} days from sow to harvest. This location has ${profile.growingDays} frost-free days — only early varieties recommended.`,
      }
    }
  }

  // 4. High variability warning
  if (profile.gddBase5Cv > 0.15) {
    return {
      status: 'marginal',
      reason: `Growing conditions in this area vary significantly year to year (variability score: ${profile.gddBase5Cv}). Choose early-maturing varieties as a precaution.`,
    }
  }

  return { status: 'feasible', reason: null }
}

export function resolveAnnualCalendar(
  profile: ClimateProfile,
  method: CropMethodCalendarRecord,
  crop: CropCalendarRecord,
): MethodCalendar {
  const feasibility = assessFeasibility(profile, method, crop)

  // Transplant date — start from conservative last frost, apply frost buffer
  const frostBuffer = frostToleranceBuffer(crop.frostTolerance)
  let transplantDoy = profile.lastFrostP90 + frostBuffer

  // Push out further if crop needs warm nights
  if (crop.minNightTempC !== null) {
    const warmMonth = firstMonthAboveNightTemp(profile.monthlyMeanTemps, crop.minNightTempC)
    if (warmMonth !== null) {
      transplantDoy = Math.max(transplantDoy, monthToDoyStart(warmMonth))
    }
  }

  // Indoor sow window — for transplantable crops
  let sowIndoors: CalendarWindow | null = null
  if (
    (method.transplantTolerance === 'good' || method.transplantTolerance === 'poor') &&
    method.daysToGerminationMax !== null &&
    method.daysToMaturityMax !== null
  ) {
    const weeksIndoors = computeWeeksIndoors(profile, method)
    // Always generate an indoor sow window for transplantable crops — even when
    // the growing season is technically long enough, starting indoors gives a
    // reliable head start and accounts for soil temperature constraints.
    const sowDoyStart = transplantDoy - (weeksIndoors + 2) * 7
    const sowDoyEnd   = transplantDoy - weeksIndoors * 7
    sowIndoors = windowFromDoyRange(sowDoyStart, sowDoyEnd)
  }

  // Direct sow window — for non-transplantable crops
  let directSow: CalendarWindow | null = null
  if (
    (method.transplantTolerance === 'none' || method.transplantTolerance === 'direct-only') &&
    method.germinationMinSoilTempC !== null
  ) {
    const sowDoy = firstDayAboveSoilTemp(profile.monthlyMeanTemps, method.germinationMinSoilTempC)
    if (sowDoy !== null) {
      directSow = windowFromDoyRange(sowDoy, sowDoy + 28)
    }
  }

  // Transplant window
  let transplant: CalendarWindow | null = null
  if (method.transplantTolerance !== 'none' && method.transplantTolerance !== 'direct-only') {
    transplant = windowFromDoyRange(transplantDoy, transplantDoy + 14)
  }

  // Harvest window
  const baseDoy = directSow !== null
    ? doyFromWindow(directSow) + (method.daysToGerminationMax ?? 0)
    : transplantDoy

  const harvestStartDoy = baseDoy + (method.daysToMaturityMin ?? 60)
  const harvestEndDoy   = Math.min(
    baseDoy + (method.daysToMaturityMax ?? 90),
    profile.firstFrostP10 - 14,
  )

  const harvest: CalendarWindow | null = harvestStartDoy < harvestEndDoy
    ? windowFromDoyRange(harvestStartDoy, harvestEndDoy)
    : null

  return {
    methodId:          method.id,
    methodLabelSv:     method.labelSv,
    methodLabelEn:     method.labelEn,
    feasibility:       feasibility.status,
    feasibilityReason: feasibility.reason,
    sowIndoors,
    directSow,
    transplant,
    harvest,
  }
}

export function resolveOverwinteredCalendar(
  profile: ClimateProfile,
  method: CropMethodCalendarRecord,
  _crop: CropCalendarRecord,
): MethodCalendar {
  // Plant in autumn before first frost
  const plantDoy = profile.firstFrostDoy - (method.plantBeforeFirstFrostDays ?? 21)

  // Harvest the following summer
  const harvestStartDoy = profile.lastFrostDoy + 60
  const harvestEndDoy   = profile.lastFrostDoy + 90

  return {
    methodId:          method.id,
    methodLabelSv:     method.labelSv,
    methodLabelEn:     method.labelEn,
    feasibility:       'feasible',
    feasibilityReason: null,
    sowIndoors:        null,
    directSow:         windowFromDoyRange(plantDoy, plantDoy + 14),
    transplant:        null,
    harvest:           windowFromDoyRange(harvestStartDoy, harvestEndDoy),
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function frostToleranceBuffer(tolerance: string): number {
  switch (tolerance) {
    case 'hard':  return -14
    case 'light': return 0
    case 'none':  return 14
    default:      return 0
  }
}

const MONTH_DOY_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

function monthToDoyStart(month: number): number {
  return MONTH_DOY_STARTS[month]
}

function estimateSoilTemp(monthlyMeanTemp: number): number {
  return monthlyMeanTemp + 1.5
}

function firstDayAboveSoilTemp(
  monthlyMeanTemps: number[],
  minSoilTempC: number,
): number | null {
  for (let month = 0; month < 12; month++) {
    if (estimateSoilTemp(monthlyMeanTemps[month]) >= minSoilTempC) {
      return monthToDoyStart(month)
    }
  }
  return null
}

function computeWeeksIndoors(profile: ClimateProfile, method: CropMethodCalendarRecord): number {
  const totalDaysNeeded = (method.daysToGerminationMax ?? 0) + (method.daysToMaturityMax ?? 0)
  const deficit = totalDaysNeeded - profile.growingDays
  if (deficit <= 0) {return 0}
  return Math.ceil(deficit / 7) + 2
}

function windowFromDoyRange(startDoy: number, endDoy: number): CalendarWindow {
  const start = dayOfYearToCalendarDate(Math.max(1, startDoy))
  const end   = dayOfYearToCalendarDate(Math.min(365, endDoy))
  return {
    startMonth: start.month,
    startDay:   start.day,
    endMonth:   end.month,
    endDay:     end.day,
  }
}

function doyFromWindow(window: CalendarWindow): number {
  return monthToDoyStart(window.startMonth - 1)
}

function unsupportedLifecycle(method: CropMethodCalendarRecord, crop: CropCalendarRecord): MethodCalendar {
  return {
    methodId:          method.id,
    methodLabelSv:     method.labelSv,
    methodLabelEn:     method.labelEn,
    feasibility:       'infeasible',
    feasibilityReason: `Lifecycle type "${crop.lifecycle}" is not yet supported.`,
    sowIndoors:        null,
    directSow:         null,
    transplant:        null,
    harvest:           null,
  }
}
