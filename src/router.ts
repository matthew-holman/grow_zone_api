import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from 'hono/cors'
import adminCrops from "./routes/adminCrops.js";
import calendar from "./routes/calendar.js";

const app = new OpenAPIHono();

// CORS should be called before the route
app.use('/*', cors())
// app.use(
//     '/*',
//     cors({
//       origin: '*', // TODO FIX this before moving to production
//       allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
//       allowMethods: ['POST', 'GET', 'OPTIONS'],
//       exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
//       maxAge: 600,
//       credentials: true,
//     })
// )

app.route("/", calendar);
app.route("/admin/crops", adminCrops);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Growzone API",
    version: "1.0.0",
    description: "Swedish grow calendar API — returns month-by-month sowing, planting, and harvest calendars calibrated to local climate zones.",
  },
});
if (process.env.NODE_ENV !== 'production') {
    app.use("/docs", Scalar({ url: "/openapi.json" }));
}

export default app;
