import { z } from '@hono/zod-openapi'

export const PostcodeQuery = z.object({
  postcode: z
    .string()
    .min(4, 'postcode too short')
    .max(6, 'postcode too long')
    .regex(/^\d+$/, 'postcode must contain only digits')
    .openapi({ example: '11346' }),
})

export const CalendarWindowSchema = z.object({
  startMonth: z.number().int().min(1).max(12),
  startDay:   z.number().int().min(1).max(31),
  endMonth:   z.number().int().min(1).max(12),
  endDay:     z.number().int().min(1).max(31),
}).openapi('CalendarWindow')

export const MethodCalendarSchema = z.object({
  methodId:          z.string(),
  methodLabelSv:     z.string(),
  methodLabelEn:     z.string(),
  feasibility:       z.enum(['feasible', 'marginal', 'infeasible']),
  feasibilityReason: z.string().nullable(),
  sowIndoors:        CalendarWindowSchema.nullable(),
  directSow:         CalendarWindowSchema.nullable(),
  transplant:        CalendarWindowSchema.nullable(),
  harvest:           CalendarWindowSchema.nullable(),
}).openapi('MethodCalendar')

export const CropCalendarSchema = z.object({
  cropId:     z.string(),
  cropNameSv: z.string(),
  cropNameEn: z.string(),
  lifecycle:  z.string(),
  methods:    z.array(MethodCalendarSchema),
}).openapi('CropCalendar')

export const CalendarResponseSchema = z.object({
  postcode: z.string().openapi({ example: '11346' }),
  location: z.object({
    lat:        z.number().openapi({ example: 59.334 }),
    lng:        z.number().openapi({ example: 18.063 }),
    elevationM: z.number().int().openapi({ example: 28 }),
  }),
  climate: z.object({
    lastFrostDoy:     z.number().int(),
    lastFrostP90:     z.number().int(),
    firstFrostDoy:    z.number().int(),
    firstFrostP10:    z.number().int(),
    growingDays:      z.number().int(),
    gddBase5:         z.number(),
    gddBase5P10:      z.number(),
    gddBase5Cv:       z.number(),
    monthlyMeanTemps: z.array(z.number()),
  }),
  crops: z.array(CropCalendarSchema),
}).openapi('CalendarResponse')

export type CalendarWindow    = z.infer<typeof CalendarWindowSchema>
export type FeasibilityStatus = z.infer<typeof MethodCalendarSchema>['feasibility']
export type MethodCalendar    = z.infer<typeof MethodCalendarSchema>
export type CropCalendar      = z.infer<typeof CropCalendarSchema>
export type CalendarResponse  = z.infer<typeof CalendarResponseSchema>
