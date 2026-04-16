import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { crops, cropMethods } from '../db/schema.js'

// Schemas are derived from the Drizzle table definitions via drizzle-zod.
// Column types (string, number, nullable) flow automatically from the schema.
// Overrides below add domain-level constraints: enums, length limits, ranges.

// ── Crops ──────────────────────────────────────────────────────────────────

export const SelectCropSchema = createSelectSchema(crops)

export const InsertCropSchema = createInsertSchema(crops, {
  id:                   (schema) => schema.min(1).regex(/^[a-z-]+$/, 'id must be lowercase letters and hyphens only'),
  nameSv:               (schema) => schema.min(1),
  nameEn:               (schema) => schema.min(1),
  lifecycle:            z.enum(['annual', 'overwintered', 'biennial', 'perennial']),
  frostTolerance:       z.enum(['none', 'light', 'hard']),
  // Override optional+nullable → required+nullable to match the existing API contract.
  // The DB allows NULL but callers must state their intent explicitly.
  minNightTempC:        z.number().int().min(-10).max(25).nullable(),
  // Override optional (has DB default) → required so callers always declare it.
  daylengthRequirement: z.enum(['neutral', 'long', 'short']),
}).omit({ createdAt: true })

export const UpdateCropSchema = InsertCropSchema.omit({ id: true })

// ── Crop methods ───────────────────────────────────────────────────────────

export const SelectCropMethodSchema = createSelectSchema(cropMethods)

export const InsertCropMethodSchema = createInsertSchema(cropMethods, {
  id:                        (schema) => schema.min(1).regex(/^[a-z-]+$/, 'id must be lowercase letters and hyphens only'),
  cropId:                    (schema) => schema.min(1),
  labelSv:                   (schema) => schema.min(1),
  labelEn:                   (schema) => schema.min(1),
  // All nullable numeric fields: override optional+nullable → required+nullable.
  germinationMinSoilTempC:   z.number().int().min(0).max(40).nullable(),
  germinationOptSoilTempC:   z.number().int().min(0).max(40).nullable(),
  daysToGerminationMin:      z.number().int().min(1).max(60).nullable(),
  daysToGerminationMax:      z.number().int().min(1).max(60).nullable(),
  daysToMaturityMin:         z.number().int().min(1).max(365).nullable(),
  daysToMaturityMax:         z.number().int().min(1).max(365).nullable(),
  transplantTolerance:       z.enum(['good', 'poor', 'none', 'direct-only']),
  gddRequired:               z.number().int().min(0).max(5000).nullable(),
  plantBeforeFirstFrostDays: z.number().int().min(1).max(90).nullable(),
  // Override optional (has DB default 0) → required with Zod-level default.
  sortOrder:                 z.number().int().min(0).default(0),
}).omit({ createdAt: true })

export const UpdateCropMethodSchema = InsertCropMethodSchema.omit({ id: true, cropId: true })

// ── Inferred types ─────────────────────────────────────────────────────────

export type InsertCrop       = z.infer<typeof InsertCropSchema>
export type UpdateCrop       = z.infer<typeof UpdateCropSchema>
export type InsertCropMethod = z.infer<typeof InsertCropMethodSchema>
export type UpdateCropMethod = z.infer<typeof UpdateCropMethodSchema>
