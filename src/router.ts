import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import calendar from "./routes/calendar.js";
import { cors } from 'hono/cors'

const app = new OpenAPIHono();

// CORS should be called before the route
app.use(
    '/*',
    cors({
      origin: 'http://localhost:3000',
      allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
      maxAge: 600,
      credentials: true,
    })
)

app.route("/", calendar);

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Growzone API",
    version: "1.0.0",
    description: "Swedish grow calendar API — returns month-by-month sowing, planting, and harvest calendars calibrated to local climate zones.",
  },
});

app.use("/docs", Scalar({ url: "/openapi.json" }));

export default app;
