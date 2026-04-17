import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { RouteHandler } from '@hono/zod-openapi'
import { getAllCropsWithMethods } from '../repositories/cropRepository.js'
import {
  PostcodeQuery,
  CalendarResponseSchema,
  ErrorSchema,
} from '../schemas/index.js'
import { generateCalendar } from '../services/calendarEngine.js'
import { resolveClimateProfile } from '../services/climateResolver.js'
import { findNearestStations, PostcodeNotFoundError, InsufficientStationsError } from '../services/stationLookup.js'

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

const getCalendarRoute = createRoute({
  method: 'get',
  path:   '/calendar',
  summary:     'Get growing calendar for a Swedish postcode',
  description: 'Resolves the nearest SMHI weather stations for the postcode, derives a climate profile via inverse distance weighting, and returns a structured growing calendar for all crops in the database.',
  tags: ['Calendar'],
  request: {
    query: PostcodeQuery,
  },
  responses: {
    200: {
      content:     { 'application/json': { schema: CalendarResponseSchema } },
      description: 'Growing calendar for the given postcode',
    },
    400: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid or missing postcode',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Postcode not found in the database',
    },
    503: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Not enough weather station data for this location',
    },
  },
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const getCalendarHandler: RouteHandler<typeof getCalendarRoute> = async (c) => {
  const { postcode } = c.req.valid('query')

  try {
    const { location, stations } = await findNearestStations(postcode)
    const profile  = resolveClimateProfile(location, stations)
    const cropData = await getAllCropsWithMethods()
    const calendar = generateCalendar(profile, cropData)

    return c.json({
      postcode: profile.postcode,
      location: {
        lat:        location.lat,
        lng:        location.lng,
        elevationM: location.elevationM,
      },
      climate: {
        lastFrostDoy:     profile.lastFrostDoy,
        lastFrostP90:     profile.lastFrostP90,
        firstFrostDoy:    profile.firstFrostDoy,
        firstFrostP10:    profile.firstFrostP10,
        growingDays:      profile.growingDays,
        gddBase5:         profile.gddBase5,
        gddBase5P10:      profile.gddBase5P10,
        gddBase5Cv:       profile.gddBase5Cv,
        monthlyMeanTemps: profile.monthlyMeanTemps,
      },
      crops: calendar,
    }, 200)

  } catch (error) {
    if (error instanceof PostcodeNotFoundError) {
      return c.json({
        error:   'postcode_not_found',
        message: `Postcode ${postcode} was not found in the database.`,
      }, 404)
    }
    if (error instanceof InsufficientStationsError) {
      return c.json({
        error:   'insufficient_station_data',
        message: 'Not enough weather station data to generate a calendar for this location.',
      }, 503)
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const calendar = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({
        error:   'invalid_postcode',
        message: result.error.issues[0]?.message ?? 'Invalid postcode.',
      }, 400)
    }
  },
})

calendar.openapi(getCalendarRoute, getCalendarHandler)

export default calendar
