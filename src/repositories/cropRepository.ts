import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { crops, cropMethods } from '../db/schema.js'
import type { InsertCrop, UpdateCrop, InsertCropMethod, UpdateCropMethod, CropWithMethods } from '../schemas/crops.js'

// Used by the calendar pipeline — returns only the fields the engine needs,
// with explicit mapping and a typed return signature.
export async function getAllCropsWithMethods(): Promise<CropWithMethods[]> {
  const cropRows = await db.select().from(crops)
  const methodRows = await db
    .select()
    .from(cropMethods)
    .orderBy(asc(cropMethods.sortOrder))

  return cropRows.map(crop => ({
    id:                   crop.id,
    nameSv:               crop.nameSv,
    nameEn:               crop.nameEn,
    lifecycle:            crop.lifecycle,
    frostTolerance:       crop.frostTolerance,
    minNightTempC:        crop.minNightTempC,
    daylengthRequirement: crop.daylengthRequirement,
    methods:              methodRows
                            .filter(m => m.cropId === crop.id)
                            .map(m => ({
                              id:                        m.id,
                              cropId:                    m.cropId,
                              labelSv:                   m.labelSv,
                              labelEn:                   m.labelEn,
                              germinationMinSoilTempC:   m.germinationMinSoilTempC,
                              germinationOptSoilTempC:   m.germinationOptSoilTempC,
                              daysToGerminationMin:      m.daysToGerminationMin,
                              daysToGerminationMax:      m.daysToGerminationMax,
                              daysToMaturityMin:         m.daysToMaturityMin,
                              daysToMaturityMax:         m.daysToMaturityMax,
                              transplantTolerance:       m.transplantTolerance,
                              gddRequired:               m.gddRequired,
                              plantBeforeFirstFrostDays: m.plantBeforeFirstFrostDays,
                              sortOrder:                 m.sortOrder,
                            })),
  }))
}

// ── Crops ──────────────────────────────────────────────────────────────────

export async function listCrops() {
  const cropRows   = await db.select().from(crops)
  const methodRows = await db.select().from(cropMethods).orderBy(asc(cropMethods.sortOrder))
  return cropRows.map(crop => ({
    ...crop,
    methods: methodRows.filter(m => m.cropId === crop.id),
  }))
}

export async function getCrop(id: string) {
  const rows = await db.select().from(crops).where(eq(crops.id, id))
  const crop = rows.at(0)
  if (!crop) {return null}
  const methods = await db
    .select()
    .from(cropMethods)
    .where(eq(cropMethods.cropId, id))
    .orderBy(asc(cropMethods.sortOrder))
  return { ...crop, methods }
}

export async function createCrop(data: InsertCrop) {
  const [created] = await db.insert(crops).values({
    id:                   data.id,
    nameSv:               data.nameSv,
    nameEn:               data.nameEn,
    lifecycle:            data.lifecycle,
    frostTolerance:       data.frostTolerance,
    minNightTempC:        data.minNightTempC,
    daylengthRequirement: data.daylengthRequirement,
    notesSv:              data.notesSv ?? null,
    notesEn:              data.notesEn ?? null,
  }).returning()
  return created
}

export async function updateCrop(id: string, data: UpdateCrop) {
  const rows = await db
    .update(crops)
    .set({
      nameSv:               data.nameSv,
      nameEn:               data.nameEn,
      lifecycle:            data.lifecycle,
      frostTolerance:       data.frostTolerance,
      minNightTempC:        data.minNightTempC,
      daylengthRequirement: data.daylengthRequirement,
      notesSv:              data.notesSv ?? null,
      notesEn:              data.notesEn ?? null,
    })
    .where(eq(crops.id, id))
    .returning()
  return rows.at(0) ?? null
}

export async function deleteCrop(id: string) {
  const rows = await db
    .delete(crops)
    .where(eq(crops.id, id))
    .returning()
  return rows.at(0) ?? null
}

// ── Crop methods ───────────────────────────────────────────────────────────

export async function getMethod(id: string) {
  const rows = await db
    .select()
    .from(cropMethods)
    .where(eq(cropMethods.id, id))
  return rows.at(0) ?? null
}

export async function createMethod(data: InsertCropMethod) {
  const [created] = await db.insert(cropMethods).values({
    id:                        data.id,
    cropId:                    data.cropId,
    labelSv:                   data.labelSv,
    labelEn:                   data.labelEn,
    germinationMinSoilTempC:   data.germinationMinSoilTempC,
    germinationOptSoilTempC:   data.germinationOptSoilTempC,
    daysToGerminationMin:      data.daysToGerminationMin,
    daysToGerminationMax:      data.daysToGerminationMax,
    daysToMaturityMin:         data.daysToMaturityMin,
    daysToMaturityMax:         data.daysToMaturityMax,
    transplantTolerance:       data.transplantTolerance,
    gddRequired:               data.gddRequired,
    plantBeforeFirstFrostDays: data.plantBeforeFirstFrostDays,
    sortOrder:                 data.sortOrder,
  }).returning()
  return created
}

export async function updateMethod(id: string, data: UpdateCropMethod) {
  const rows = await db
    .update(cropMethods)
    .set({
      labelSv:                   data.labelSv,
      labelEn:                   data.labelEn,
      germinationMinSoilTempC:   data.germinationMinSoilTempC,
      germinationOptSoilTempC:   data.germinationOptSoilTempC,
      daysToGerminationMin:      data.daysToGerminationMin,
      daysToGerminationMax:      data.daysToGerminationMax,
      daysToMaturityMin:         data.daysToMaturityMin,
      daysToMaturityMax:         data.daysToMaturityMax,
      transplantTolerance:       data.transplantTolerance,
      gddRequired:               data.gddRequired,
      plantBeforeFirstFrostDays: data.plantBeforeFirstFrostDays,
      sortOrder:                 data.sortOrder,
    })
    .where(eq(cropMethods.id, id))
    .returning()
  return rows.at(0) ?? null
}

export async function deleteMethod(id: string) {
  const rows = await db
    .delete(cropMethods)
    .where(eq(cropMethods.id, id))
    .returning()
  return rows.at(0) ?? null
}
