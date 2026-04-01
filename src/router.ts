import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import calendar from "./routes/calendar.js";

const app = new OpenAPIHono();

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
