import { z } from '@hono/zod-openapi'

export const ErrorSchema = z.object({
  error:   z.string().openapi({ example: 'postcode_not_found' }),
  message: z.string().openapi({ example: 'Postcode 00000 was not found in the database.' }),
}).openapi('Error')

export type AppError = z.infer<typeof ErrorSchema>
