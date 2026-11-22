import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

createApp({
  apiUrl,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
}).listen(port, () => {
  console.log(`Gateway listening on http://localhost:${port} -> ${apiUrl}`);
});
