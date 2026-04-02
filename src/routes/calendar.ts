import { OpenAPIHono, createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { lookupPostcode } from "../repositories/postcodeDb.js";
import { classifyZone, type Zone } from "../zoneClassifier.js";
import { getCalendar } from "../calendarLookup.js";
import { getZoneByPostcode, savePostcodeZone } from "../repositories/postcodeZoneRepository.js";

const PostcodeQuery = z.object({
  postcode: z
    .string()
    .regex(/^\d{5}$/, "Postcode must be exactly 5 digits")
    .openapi({ example: "11120" }),
});

const CropCalendarEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  sow: z.array(z.number().int().min(1).max(12)),
  plant: z.array(z.number().int().min(1).max(12)).nullable(),
  harvest: z.array(z.number().int().min(1).max(12)),
}).openapi("CropCalendarEntry");

const CalendarResponseSchema = z.object({
  postcode: z.string().openapi({ example: "11120" }),
  zone: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]).openapi({ example: 3, description: "Swedish growing zone (1–5, where 1 is southernmost)" }),
  crops: z.array(CropCalendarEntrySchema),
}).openapi("CalendarResponse");

const ErrorSchema = z.object({
  error: z.string().openapi({ example: "not_found" }),
  message: z.string().openapi({ example: "Postcode 99999 not found in the Swedish postcode database" }),
}).openapi("Error");

const getCalendarRoute = createRoute({
  method: "get",
  path: "/calendar",
  summary: "Get crop calendar for a Swedish postcode",
  description: "Resolves the growing zone for a 5-digit Swedish postcode and returns a month-by-month sow/plant/harvest calendar for each supported crop.",
  tags: ["Calendar"],
  request: {
    query: PostcodeQuery,
  },
  responses: {
    200: {
      content: { "application/json": { schema: CalendarResponseSchema } },
      description: "Crop calendar for the given postcode",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid or missing postcode",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Postcode not found in the Swedish postcode database",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Internal server error",
    },
  },
});

const getCalendarHandler: RouteHandler<typeof getCalendarRoute> = async (c) => {
  const { postcode } = c.req.valid("query");

  try {
    let zone: Zone;

    const cached = await getZoneByPostcode(postcode);
    if (cached !== null) {
      zone = cached;
    } else {
      const location = lookupPostcode(postcode);
      if (!location) {
        return c.json(
          { error: "not_found", message: `Postcode ${postcode} not found in the Swedish postcode database` },
          404
        );
      }

      const resolvedZone = classifyZone(location.lat, location.lng);
      if (!resolvedZone) {
        return c.json(
          { error: "not_found", message: `Postcode ${postcode} does not map to a Swedish growing zone` },
          404
        );
      }

      zone = resolvedZone;
      await savePostcodeZone(postcode, location.lat, location.lng, zone, location.placeName, location.adminName1);
    }

    const crops = getCalendar(zone);
    return c.json({ postcode, zone, crops }, 200);
  } catch (err) {
    console.error(err);
    return c.json(
      { error: "internal_error", message: "An unexpected error occurred" },
      500
    );
  }
};

const calendar = new OpenAPIHono();
calendar.openapi(getCalendarRoute, getCalendarHandler);

export default calendar;
