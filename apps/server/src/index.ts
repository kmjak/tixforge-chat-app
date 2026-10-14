import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createPingDb } from "./db-ping";
import { parsePort } from "./port";

const port = parsePort(process.env.PORT);
const app = createApp({ pingDb: createPingDb(process.env.DATABASE_URL) });

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`server listening on http://localhost:${info.port}`);
});
