import type { RouteHandler } from '@hono/zod-openapi'
import { OpenAPIHono, createRoute, z  } from '@hono/zod-openapi'
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
import { ErrorSchema, ValidationErrorSchema } from '../schemas/common.js'
import {
  SelectCropSchema,
  SelectCropMethodSchema,
  InsertCropSchema,
  UpdateCropSchema,
  InsertCropMethodBodySchema,
  UpdateCropMethodSchema,
  CropWithMethodsSchema,
  DeletedSchema,
} from '../schemas/crops.js'

// ---------------------------------------------------------------------------
// Shared param schemas
// ---------------------------------------------------------------------------

const CropIdParam   = z.object({ id:  z.string() })
const MethodIdParam = z.object({ id:  z.string(), mid: z.string() })

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const listCropsRoute = createRoute({
  method:  'get',
  path:    '/',
  tags:    ['Admin Crops'],
  summary: 'List all crops with their methods',
  responses: {
    200: {
      content:     { 'application/json': { schema: z.array(CropWithMethodsSchema) } },
      description: 'All crops with their methods',
    },
  },
})

const getCropRoute = createRoute({
  method:  'get',
  path:    '/:id',
  tags:    ['Admin Crops'],
  summary: 'Get a single crop with its methods',
  request: { params: CropIdParam },
  responses: {
    200: {
      content:     { 'application/json': { schema: CropWithMethodsSchema } },
      description: 'Crop with its methods',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop not found',
    },
  },
})

const createCropRoute = createRoute({
  method:  'post',
  path:    '/',
  tags:    ['Admin Crops'],
  summary: 'Create a crop',
  request: {
    body: {
      content:  { 'application/json': { schema: InsertCropSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content:     { 'application/json': { schema: SelectCropSchema } },
      description: 'Crop created',
    },
    400: {
      content:     { 'application/json': { schema: ValidationErrorSchema } },
      description: 'Validation error',
    },
    409: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'A crop with this id already exists',
    },
  },
})

const updateCropRoute = createRoute({
  method:  'put',
  path:    '/:id',
  tags:    ['Admin Crops'],
  summary: 'Update a crop',
  request: {
    params: CropIdParam,
    body: {
      content:  { 'application/json': { schema: UpdateCropSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content:     { 'application/json': { schema: SelectCropSchema } },
      description: 'Updated crop',
    },
    400: {
      content:     { 'application/json': { schema: ValidationErrorSchema } },
      description: 'Validation error',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop not found',
    },
  },
})

const deleteCropRoute = createRoute({
  method:  'delete',
  path:    '/:id',
  tags:    ['Admin Crops'],
  summary: 'Delete a crop and cascade its methods',
  request: { params: CropIdParam },
  responses: {
    200: {
      content:     { 'application/json': { schema: DeletedSchema } },
      description: 'Crop deleted',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop not found',
    },
  },
})

const listMethodsRoute = createRoute({
  method:  'get',
  path:    '/:id/methods',
  tags:    ['Admin Crops'],
  summary: "List a crop's methods",
  request: { params: CropIdParam },
  responses: {
    200: {
      content:     { 'application/json': { schema: z.array(SelectCropMethodSchema) } },
      description: 'Methods for the crop',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop not found',
    },
  },
})

const createMethodRoute = createRoute({
  method:  'post',
  path:    '/:id/methods',
  tags:    ['Admin Crops'],
  summary: 'Add a method to a crop',
  description: 'cropId is taken from the URL — do not include it in the request body.',
  request: {
    params: CropIdParam,
    body: {
      content:  { 'application/json': { schema: InsertCropMethodBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content:     { 'application/json': { schema: SelectCropMethodSchema } },
      description: 'Method created',
    },
    400: {
      content:     { 'application/json': { schema: ValidationErrorSchema } },
      description: 'Validation error',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop not found',
    },
    409: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'A method with this id already exists',
    },
  },
})

const updateMethodRoute = createRoute({
  method:  'put',
  path:    '/:id/methods/:mid',
  tags:    ['Admin Crops'],
  summary: 'Update a crop method',
  request: {
    params: MethodIdParam,
    body: {
      content:  { 'application/json': { schema: UpdateCropMethodSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content:     { 'application/json': { schema: SelectCropMethodSchema } },
      description: 'Updated method',
    },
    400: {
      content:     { 'application/json': { schema: ValidationErrorSchema } },
      description: 'Validation error',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop or method not found',
    },
  },
})

const deleteMethodRoute = createRoute({
  method:  'delete',
  path:    '/:id/methods/:mid',
  tags:    ['Admin Crops'],
  summary: 'Delete a crop method',
  request: { params: MethodIdParam },
  responses: {
    200: {
      content:     { 'application/json': { schema: DeletedSchema } },
      description: 'Method deleted',
    },
    404: {
      content:     { 'application/json': { schema: ErrorSchema } },
      description: 'Crop or method not found',
    },
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const listCropsHandler: RouteHandler<typeof listCropsRoute> = async (c) => {
  const allCrops = await listCrops()
  return c.json(allCrops, 200)
}

const getCropHandler: RouteHandler<typeof getCropRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const crop = await getCrop(id)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json(crop, 200)
}

const createCropHandler: RouteHandler<typeof createCropRoute> = async (c) => {
  const data = c.req.valid('json')

  const existing = await getCrop(data.id)
  if (existing) {
    return c.json({
      error:   'conflict',
      message: `A crop with id "${data.id}" already exists.`,
    }, 409)
  }

  const created = await createCrop(data)
  return c.json(created, 201)
}

const updateCropHandler: RouteHandler<typeof updateCropRoute> = async (c) => {
  const { id }  = c.req.valid('param')
  const data    = c.req.valid('json')
  const updated = await updateCrop(id, data)
  if (!updated) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json(updated, 200)
}

const deleteCropHandler: RouteHandler<typeof deleteCropRoute> = async (c) => {
  const { id }  = c.req.valid('param')
  const deleted = await deleteCrop(id)
  if (!deleted) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json({ deleted: true as const, id: deleted.id }, 200)
}

const listMethodsHandler: RouteHandler<typeof listMethodsRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const crop   = await getCrop(id)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }
  return c.json(crop.methods, 200)
}

const createMethodHandler: RouteHandler<typeof createMethodRoute> = async (c) => {
  const { id: cropId } = c.req.valid('param')

  const crop = await getCrop(cropId)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }

  const body = c.req.valid('json')

  const existing = await getMethod(body.id)
  if (existing) {
    return c.json({
      error:   'conflict',
      message: `A method with id "${body.id}" already exists.`,
    }, 409)
  }

  // Inject cropId from the URL — the body schema omits it deliberately.
  const created = await createMethod({ ...body, cropId })
  return c.json(created, 201)
}

const updateMethodHandler: RouteHandler<typeof updateMethodRoute> = async (c) => {
  const { id: cropId, mid: methodId } = c.req.valid('param')

  const crop = await getCrop(cropId)
  if (!crop) {
    return c.json({ error: 'not_found', message: 'Crop not found.' }, 404)
  }

  const method = await getMethod(methodId)
  if (method?.cropId !== cropId) {
    return c.json({ error: 'not_found', message: 'Method not found.' }, 404)
  }

  const data    = c.req.valid('json')
  const updated = await updateMethod(methodId, data)
  if (!updated) {
    return c.json({ error: 'not_found', message: 'Method not found.' }, 404)
  }
  return c.json(updated, 200)
}

const deleteMethodHandler: RouteHandler<typeof deleteMethodRoute> = async (c) => {
  const { id: cropId, mid: methodId } = c.req.valid('param')

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
  return c.json({ deleted: true as const, id: deleted.id }, 200)
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const adminCrops = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({
        error:   'validation_error',
        message: result.error.issues[0]?.message ?? 'Invalid request.',
        issues:  result.error.issues,
      }, 400)
    }
  },
})

adminCrops.openapi(listCropsRoute,    listCropsHandler)
adminCrops.openapi(getCropRoute,      getCropHandler)
adminCrops.openapi(createCropRoute,   createCropHandler)
adminCrops.openapi(updateCropRoute,   updateCropHandler)
adminCrops.openapi(deleteCropRoute,   deleteCropHandler)
adminCrops.openapi(listMethodsRoute,  listMethodsHandler)
adminCrops.openapi(createMethodRoute, createMethodHandler)
adminCrops.openapi(updateMethodRoute, updateMethodHandler)
adminCrops.openapi(deleteMethodRoute, deleteMethodHandler)

export default adminCrops
