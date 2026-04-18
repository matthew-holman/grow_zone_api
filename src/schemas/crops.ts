import { z } from '@hono/zod-openapi'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { crops, cropMethods } from '../db/schema.js'

// Schemas are derived from the Drizzle table definitions via drizzle-zod.
// Column types (string, number, nullable) flow automatically from the schema.
// Overrides below add domain-level constraints: enums, length limits, ranges.

// ── Crops ──────────────────────────────────────────────────────────────────

export const SelectCropSchema = createSelectSchema(crops).openapi('Crop')

export const InsertCropSchema = createInsertSchema(crops, {
  id:                   (schema: { min: (arg0: number) => { (): any; new(): any; regex: { (arg0: RegExp, arg1: string): any; new(): any } } }) => schema.min(1).regex(/^[a-z-]+$/, 'id must be lowercase letters and hyphens only'),
  nameSv:               (schema: { min: (arg0: number) => any }) => schema.min(1),
  nameEn:               (schema: { min: (arg0: number) => any }) => schema.min(1),
  lifecycle:            z.enum(['annual', 'overwintered', 'biennial', 'perennial']),
  frostTolerance:       z.enum(['none', 'light', 'hard']),
  // Override optional+nullable → required+nullable to match the existing API contract.
  // The DB allows NULL but callers must state their intent explicitly.
  minNightTempC:        z.number().int().min(-10).max(25).nullable(),
  // Override optional (has DB default) → required so callers always declare it.
  daylengthRequirement: z.enum(['neutral', 'long', 'short']),
  // Constrained to the four base temps available in weather station data.
  gddBaseTempC: z.union([z.literal(5), z.literal(7), z.literal(10), z.literal(15)]),
}).omit({ createdAt: true })

export const UpdateCropSchema = InsertCropSchema.omit({ id: true })

// ── Crop methods ───────────────────────────────────────────────────────────

export const SelectCropMethodSchema = createSelectSchema(cropMethods).openapi('CropMethod')

export const InsertCropMethodSchema = createInsertSchema(cropMethods, {
  id:                        (schema: { min: (arg0: number) => { (): any; new(): any; regex: { (arg0: RegExp, arg1: string): any; new(): any } } }) => schema.min(1).regex(/^[a-z-]+$/, 'id must be lowercase letters and hyphens only'),
  cropId:                    (schema: { min: (arg0: number) => any }) => schema.min(1),
  labelSv:                   (schema: { min: (arg0: number) => any }) => schema.min(1),
  labelEn:                   (schema: { min: (arg0: number) => any }) => schema.min(1),
  // All nullable numeric fields: override optional+nullable → required+nullable.
  germinationMinSoilTempC:   z.number().int().min(0).max(40).nullable(),
  germinationOptSoilTempC:   z.number().int().min(0).max(40).nullable(),
  daysToGerminationMin:      z.number().int().min(1).max(60).nullable(),
  daysToGerminationMax:      z.number().int().min(1).max(60).nullable(),
  daysToMaturityMin:         z.number().int().min(1).max(365).nullable(),
  daysToMaturityMax:         z.number().int().min(1).max(365).nullable(),
  transplantTolerance:        z.enum(['good', 'poor', 'none', 'direct-only']),
  gddToMaturity:              z.number().int().min(0).max(5000).nullable(),
  gddToMaturityP10:           z.number().int().min(0).max(5000).nullable(),
  weeksIndoorBeforeLastFrost: z.number().int().min(1).max(52).nullable(),
  // Override optional (has DB default 0) → required with Zod-level default.
  sortOrder:                 z.number().int().min(0).default(0),
}).omit({ createdAt: true })

export const UpdateCropMethodSchema = InsertCropMethodSchema.omit({ id: true, cropId: true })

// ── Composite / response schemas ───────────────────────────────────────────

// Full crop row with its methods — returned by list/get admin endpoints.
export const CropWithMethodsSchema = SelectCropSchema
  .extend({ methods: z.array(SelectCropMethodSchema) })
  .openapi('CropWithMethods')

// Body for POST /:id/methods — cropId is injected from the URL, not the body.
export const InsertCropMethodBodySchema = InsertCropMethodSchema.omit({ cropId: true })

// Confirmation envelope returned by DELETE endpoints.
export const DeletedSchema = z.object({
  deleted: z.literal(true),
  id:      z.string(),
}).openapi('Deleted')

// ── Inferred types ─────────────────────────────────────────────────────────

export type SelectCrop       = z.infer<typeof SelectCropSchema>
export type SelectCropMethod = z.infer<typeof SelectCropMethodSchema>

export type InsertCrop       = z.infer<typeof InsertCropSchema>
export type UpdateCrop       = z.infer<typeof UpdateCropSchema>
export type InsertCropMethod = z.infer<typeof InsertCropMethodSchema>
export type UpdateCropMethod = z.infer<typeof UpdateCropMethodSchema>

// ── Calendar input types ──────────────────────────────────────────────────────
// Narrowed to the fields getAllCropsWithMethods() passes to the calendar engine.

export const CropCalendarSchema = SelectCropSchema.omit({
  createdAt: true,
  notesSv:   true,
  notesEn:   true,
})
export type CropCalendarRecord = z.infer<typeof CropCalendarSchema>

export const CropMethodCalendarSchema = SelectCropMethodSchema.omit({ createdAt: true })
export type CropMethodCalendarRecord = z.infer<typeof CropMethodCalendarSchema>

export type CropWithMethods = CropCalendarRecord & { methods: CropMethodCalendarRecord[] }
