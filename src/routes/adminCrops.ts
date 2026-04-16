import { Hono } from 'hono'
import {
  listCrops,
  getCrop,
  createCrop,
  updateCrop,
  deleteCrop,
  getMethod,
  createMethod,
  updateMethod,
  deleteMethod,
} from '../repositories/cropRepository.js'
import {
  InsertCropSchema,
  UpdateCropSchema,
  InsertCropMethodSchema,
  UpdateCropMethodSchema,
} from '../schemas/crops.js'

const adminCrops = new Hono()

// ── Crops ──────────────────────────────────────────────────────────────────

// GET /admin/crops
// Returns all crops with their methods
adminCrops.get('/', async (c) => {
  const allCrops = await listCrops()
  return c.json(allCrops)
})

// GET /admin/crops/:id
// Returns a single crop with its methods, 404 if not found
adminCrops.get('/:id', async (c) => {
  const crop = await getCrop(c.req.param('id'))
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json(crop)
})

// POST /admin/crops
// Creates a new crop. Returns 409 if id already exists.
adminCrops.post('/', async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ error: 'invalid_body', message: 'Request body must be valid JSON.' }, 400)
  }

  const parsed = InsertCropSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      error:   'validation_error',
      message: parsed.error.issues[0]?.message ?? 'Invalid request body.',
      issues:  parsed.error.issues,
    }, 400)
  }

  const existing = await getCrop(parsed.data.id)
  if (existing) {
    return c.json({
      error:   'conflict',
      message: `A crop with id "${parsed.data.id}" already exists.`,
    }, 409)
  }

  const created = await createCrop(parsed.data)
  return c.json(created, 201)
})

// PUT /admin/crops/:id
// Updates a crop's top-level fields. Returns 404 if not found.
adminCrops.put('/:id', async (c) => {
  const body: unknown = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ error: 'invalid_body', message: 'Request body must be valid JSON.' }, 400)
  }

  const parsed = UpdateCropSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      error:   'validation_error',
      message: parsed.error.issues[0]?.message ?? 'Invalid request body.',
      issues:  parsed.error.issues,
    }, 400)
  }

  const updated = await updateCrop(c.req.param('id'), parsed.data)
  if (!updated) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json(updated)
})

// DELETE /admin/crops/:id
// Deletes a crop and all its methods (cascade). Returns 404 if not found.
adminCrops.delete('/:id', async (c) => {
  const deleted = await deleteCrop(c.req.param('id'))
  if (!deleted) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json({ deleted: true, id: deleted.id })
})

// ── Crop methods ───────────────────────────────────────────────────────────

// GET /admin/crops/:id/methods
// Returns all methods for a crop. Returns 404 if the crop does not exist.
adminCrops.get('/:id/methods', async (c) => {
  const crop = await getCrop(c.req.param('id'))
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json(crop.methods)
})

// POST /admin/crops/:id/methods
// Adds a new method to an existing crop. Returns 404 if crop not found,
// 409 if method id already exists.
adminCrops.post('/:id/methods', async (c) => {
  const cropId = c.req.param('id')
  const crop = await getCrop(cropId)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }

  const body: unknown = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ error: 'invalid_body', message: 'Request body must be valid JSON.' }, 400)
  }

  // Inject cropId from the URL — caller does not need to supply it
  const parsed = InsertCropMethodSchema.safeParse({ ...body, cropId })
  if (!parsed.success) {
    return c.json({
      error:   'validation_error',
      message: parsed.error.issues[0]?.message ?? 'Invalid request body.',
      issues:  parsed.error.issues,
    }, 400)
  }

  const existing = await getMethod(parsed.data.id)
  if (existing) {
    return c.json({
      error:   'conflict',
      message: `A method with id "${parsed.data.id}" already exists.`,
    }, 409)
  }

  const created = await createMethod(parsed.data)
  return c.json(created, 201)
})

// PUT /admin/crops/:id/methods/:mid
// Updates a crop method. Returns 404 if crop or method not found.
adminCrops.put('/:id/methods/:mid', async (c) => {
  const cropId   = c.req.param('id')
  const methodId = c.req.param('mid')

  const crop = await getCrop(cropId)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }

  const method = await getMethod(methodId)
  if (method?.cropId !== cropId) {
    return c.json({ error: 'not_found', message: 'Method not found.' }, 404)
  }

  const body: unknown = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ error: 'invalid_body', message: 'Request body must be valid JSON.' }, 400)
  }

  const parsed = UpdateCropMethodSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      error:   'validation_error',
      message: parsed.error.issues[0]?.message ?? 'Invalid request body.',
      issues:  parsed.error.issues,
    }, 400)
  }

  const updated = await updateMethod(methodId, parsed.data)
  if (!updated) {
    return c.json({ error: 'not_found', message: 'Method not found.' }, 404)
  }
  return c.json(updated)
})

// DELETE /admin/crops/:id/methods/:mid
// Deletes a single crop method. Returns 404 if crop or method not found.
adminCrops.delete('/:id/methods/:mid', async (c) => {
  const cropId   = c.req.param('id')
  const methodId = c.req.param('mid')

  const crop = await getCrop(cropId)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }

  const method = await getMethod(methodId)
  if (method?.cropId !== cropId) {
    return c.json({ error: 'not_found', message: 'Method not found.' }, 404)
  }

  const deleted = await deleteMethod(methodId)
  if (!deleted) {
    return c.json({ error: 'not_found', message: 'Method not found.' }, 404)
  }
  return c.json({ deleted: true, id: deleted.id })
})

export default adminCrops
