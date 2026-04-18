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

// Minimum GDD coefficient-of-variation above which growing conditions are
// considered too variable to reliably reach maturity.
const GDD_CV_MARGINAL_THRESHOLD = 0.15

// Assumed indoor propagator temperature for the seedling phase of transplanted
// crops. Used to credit GDD accumulated between indoor sow and transplant.
// 18°C reflects a conservative home windowsill or unheated propagator — a
// heated mat would be warmer, but we err on the side of caution.
const INDOOR_PROPAGATOR_TEMP_C = 18

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
        .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
        .map((method: CropMethodCalendarRecord) => {
          switch (crop.lifecycle) {
            case 'overwintered':
              return generateOverwinteredCalendarForCrop(profile, method, crop)
            case 'annual':
              return generateCalendarForCrop(profile, method, crop)
            default:
              return unsupportedLifecycle(method, crop)
          }
        }),
  }))
}

export function dayOfYearToCalendarDate(doy: number): { month: number; day: number } {
  // Use a non-leap year so DOY aligns with a standard 365-day calendar.
  const date = new Date(2023, 0, 1)
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
  const cropGdd = getGddForCrop(profile, crop.gddBaseTempC)

  // 1. GDD check — uses the crop's own base temperature, not a hardcoded base.
  if (method.gddToMaturity !== null) {
    if (cropGdd.p10 < method.gddToMaturity * 0.75) {
      return {
        status: 'infeasible',
        reason: `Requires ${method.gddToMaturity} GDD (base ${crop.gddBaseTempC}°C) but this location reliably provides only ${cropGdd.p10} GDD (10th percentile).`,
      }
    }
    if (cropGdd.p10 < method.gddToMaturity) {
      return {
        status: 'marginal',
        reason: `Requires ${method.gddToMaturity} GDD (base ${crop.gddBaseTempC}°C). This location typically provides ${cropGdd.median} GDD but only ${cropGdd.p10} GDD in cooler years. Choose the earliest maturing variety.`,
      }
    }
  }

  // 2. Night temperature check — ensures the crop can survive outdoors at all.
  if (crop.minNightTempC !== null) {
    const warmMonth = firstMonthAboveNightTemp(profile.monthlyMeanTemps, crop.minNightTempC)
    if (warmMonth === null) {
      return {
        status: 'infeasible',
        reason: `Requires nights above ${crop.minNightTempC}°C for planting out. This is not reliably reached in this location.`,
      }
    }
  }

  // 3. Season length check for direct-sow crops only.
  // Transplanted crops bypass this because their indoor head start is already
  // captured in the GDD check above.
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

  // 4. High variability warning — even if median GDD is sufficient, a high CV
  // means unreliable outcomes year to year.
  if (cropGdd.cv > GDD_CV_MARGINAL_THRESHOLD) {
    return {
      status: 'marginal',
      reason: `Growing conditions in this area vary significantly year to year (variability score: ${cropGdd.cv}). Choose early-maturing varieties as a precaution.`,
    }
  }

  return { status: 'feasible', reason: null }
}

export function generateCalendarForCrop(
    profile: ClimateProfile,
    method: CropMethodCalendarRecord,
    crop: CropCalendarRecord,
): MethodCalendar {
  const feasibility = assessFeasibility(profile, method, crop)

  // ------------------------------------------------------------------
  // Transplant date
  // Start from the conservative last frost date and apply a frost buffer
  // based on how much cold the crop can tolerate.
  // ------------------------------------------------------------------
  const frostBuffer = frostToleranceBuffer(crop.frostTolerance)
  let transplantDoy = profile.lastFrostP90 + frostBuffer

  // Push later if the crop requires warm nights to survive outdoors.
  if (crop.minNightTempC !== null) {
    const warmMonth = firstMonthAboveNightTemp(profile.monthlyMeanTemps, crop.minNightTempC)
    if (warmMonth !== null) {
      transplantDoy = Math.max(transplantDoy, monthToDoyStart(warmMonth))
    }
  }

  // ------------------------------------------------------------------
  // Indoor sow window
  // Driven by per-method weeks-before-transplant data. The window spans
  // ±2 weeks around the target to give growers some flexibility.
  // ------------------------------------------------------------------
  let sowIndoors: CalendarWindow | null = null
  if (method.weeksIndoorBeforeLastFrost !== null) {
    const sowDoyStart = transplantDoy - (method.weeksIndoorBeforeLastFrost + 2) * 7
    const sowDoyEnd   = transplantDoy - method.weeksIndoorBeforeLastFrost * 7
    sowIndoors = windowFromDoyRange(sowDoyStart, sowDoyEnd)
  }

  // ------------------------------------------------------------------
  // Direct sow window
  // Only for crops that cannot be transplanted. Opens when soil is warm
  // enough for germination.
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Transplant window
  // ------------------------------------------------------------------
  let transplant: CalendarWindow | null = null
  if (method.transplantTolerance !== 'none' && method.transplantTolerance !== 'direct-only') {
    transplant = windowFromDoyRange(transplantDoy, transplantDoy + 14)
  }

  // ------------------------------------------------------------------
  // Harvest window
  //
  // GDD accumulation begins at germination completion, not at transplant.
  // This correctly models the head start gained by indoor propagation:
  // a tomato seedling accumulates heat units from the moment it germinates,
  // whether it is indoors or out.
  //
  // For transplanted crops:
  //   - Accumulate GDD at INDOOR_PROPAGATOR_TEMP_C from germination until
  //     transplant date, then switch to outdoor monthly mean temperatures.
  //   - This reflects the biological reality that the plant is growing
  //     throughout its indoor life, burning down the GDD budget before
  //     it ever reaches the garden.
  //
  // For direct-sow crops:
  //   - Accumulate GDD using outdoor temperatures throughout, starting
  //     after germination completes.
  // ------------------------------------------------------------------
  let harvestStartDoy: number
  let harvestEndDoy: number

  if (method.gddToMaturity !== null) {
    if (sowIndoors !== null) {
      // Transplanted crop: germination completes indoors, then growth
      // continues at indoor temp until transplant, then switches to outdoor.
      const germinationCompleteDoy =
          doyFromWindow(sowIndoors) + (method.daysToGerminationMax ?? 14)

      harvestStartDoy = gddAccumulatedByDoy(
          profile.monthlyMeanTemps,
          crop.gddBaseTempC,
          germinationCompleteDoy,
          method.gddToMaturity,
          transplantDoy,
          INDOOR_PROPAGATOR_TEMP_C,
      )
    } else if (directSow !== null) {
      // Direct-sow crop: germination completes outdoors, accumulate from there.
      const germinationCompleteDoy =
          doyFromWindow(directSow) + (method.daysToGerminationMax ?? 14)

      harvestStartDoy = gddAccumulatedByDoy(
          profile.monthlyMeanTemps,
          crop.gddBaseTempC,
          germinationCompleteDoy,
          method.gddToMaturity,
      )
    } else {
      // Transplanted crop with no indoor sow window modelled (e.g. bought as
      // a plug plant). Start accumulation from transplant date using outdoor temps.
      harvestStartDoy = gddAccumulatedByDoy(
          profile.monthlyMeanTemps,
          crop.gddBaseTempC,
          transplantDoy,
          method.gddToMaturity,
      )
    }

    harvestEndDoy = Math.min(
        harvestStartDoy + 28,   // default 4-week picking window
        profile.firstFrostP10 - 14,
    )
  } else {
    // No GDD data available — harvest window cannot be computed.
    harvestStartDoy = profile.firstFrostP10
    harvestEndDoy   = profile.firstFrostP10 - 14
  }

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

export function generateOverwinteredCalendarForCrop(
    profile: ClimateProfile,
    method: CropMethodCalendarRecord,
    _crop: CropCalendarRecord,
): MethodCalendar {
  // Plant in autumn before first frost. The 21-day offset is a standard
  // agronomic rule for overwintered alliums and brassicas — the plant needs
  // time to establish roots before the ground freezes, but must not send up
  // shoots that will be winter-killed.
  const plantDoy = profile.firstFrostDoy - 21

  // Harvest the following summer, after the plant has vernalised through
  // winter and resumed growth past the spring last-frost date.
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

// Returns the median, p10, and CV for the GDD accumulated above baseTempC
// using the pre-computed seasonal totals from the nearest weather stations.
function getGddForCrop(
    profile: ClimateProfile,
    baseTempC: number,
): { median: number; p10: number; cv: number } {
  switch (baseTempC) {
    case 5:  return { median: profile.gddBase5,  p10: profile.gddBase5P10,  cv: profile.gddBase5Cv  }
    case 7:  return { median: profile.gddBase7,  p10: profile.gddBase7P10,  cv: profile.gddBase7Cv  }
    case 10: return { median: profile.gddBase10, p10: profile.gddBase10P10, cv: profile.gddBase10Cv }
    case 15: return { median: profile.gddBase15, p10: profile.gddBase15P10, cv: profile.gddBase15Cv }
    default: throw new Error(
        `Unsupported GDD base temperature: ${baseTempC}°C. Must be one of 5, 7, 10, or 15.`,
    )
  }
}

// Walk forward day by day from fromDoy, accumulating daily GDD estimated from
// monthly mean temperatures, until targetGdd is reached.
//
// When switchDoy and overrideTempC are provided, the override temperature is
// used for all days before switchDoy (modelling indoor propagation), after
// which outdoor monthly mean temperatures take over.
//
// Returns the DOY on which accumulated GDD first meets or exceeds targetGdd,
// or 365 if the target is never reached within the calendar year.
function gddAccumulatedByDoy(
    monthlyMeanTemps: number[],
    baseTempC: number,
    fromDoy: number,
    targetGdd: number,
    switchDoy?: number,
    overrideTempC?: number,
): number {
  let accumulated = 0

  for (let doy = fromDoy; doy <= 365; doy++) {
    const useIndoorTemp = overrideTempC !== undefined
        && switchDoy !== undefined
        && doy < switchDoy

    const meanTemp = useIndoorTemp
        ? overrideTempC
        : monthlyMeanTemps[doyToMonth(doy)]

    accumulated += Math.max(0, meanTemp - baseTempC)

    if (accumulated >= targetGdd) { return doy }
  }

  return 365
}

function frostToleranceBuffer(tolerance: string): number {
  switch (tolerance) {
    case 'hard':  return -14
    case 'light': return 0
    case 'none':  return 14
    default:      return 0
  }
}

// First DOY of each month in a standard 365-day year.
const MONTH_DOY_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

function monthToDoyStart(month: number): number {
  return MONTH_DOY_STARTS[month]
}

function doyToMonth(doy: number): number {
  for (let m = 11; m >= 0; m--) {
    if (doy >= MONTH_DOY_STARTS[m]) { return m }
  }
  return 0
}

function estimateSoilTemp(monthlyMeanTemp: number): number {
  // Soil temperature lags air temperature slightly and moderates extremes.
  // +1.5°C is a reasonable approximation for topsoil in spring.
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

function unsupportedLifecycle(
    method: CropMethodCalendarRecord,
    crop: CropCalendarRecord,
): MethodCalendar {
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